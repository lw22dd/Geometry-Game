/**
 * 玩家系统 —— 物理引擎 + PlayerController 导出。
 *
 * 导出的物理函数（纯函数，无副作用）：
 *  - stepPlayerGeneric(p, input, dt, isLocal, outSignals)
 *  - buildSolids()
 *  - boxHit(s)
 *  - boxHitFor(p, s)
 *
 * PlayerController 管理玩家生命周期与事件：
 *  - playerController 单例
 *  - P（只读 PlayerState 引用，向后兼容）
 *
 * 联机模式下：
 *   房主：playerController.step() 为本地玩家，stepPlayerGeneric() 为每个客机
 *   客机：playerController.step() 为本地预测 + 后续被权威状态矫正
 */
import type { FrameSignals, PlayerState, Rect, InputKeys, TrackState } from '../../types';
import { clamp } from '../../core/math';
import {
  PHYS, RUN, SPRINT, currentMap,
  TRACK_CAPTURE_RADIUS, TRACK_STOP_SPEED, TRACK_FRICTION,
  TRACK_ROLLBACK_SPEED, TRACK_ROLLBACK_RELEASE,
} from '../../config';
import { getMode, type PhysicsKey } from '../game/gameMode';
import { trail } from '../particles';
import {
  PathMotion, SpringPad, Track, TrackGeom,
  qMovers, qSpringPads, qHookTargets, qTracks,
  CONTROL_MODE_TRACK, CONTROL_MODE_ZIPLINE, CONTROL_MODE_DEAD, CONTROL_MODE_CONSTRAINT,
} from '../../core/ecs';
import { colliderWorldRect } from '../level';
import {
  pathPosition, pathTangent, pathGravityTangent,
  buildCumulativeLengths, pathTotalLength,
} from '../../core/path';
import { PlayerController } from './PlayerController';
import { applyEffect, consumeImpulses, decayImpulses } from '../effects';

/* ==================== Controller 单例 ==================== */

/** 本地玩家控制器（Game 层通过此对象管理玩家） */
export const playerController = new PlayerController(
  6, 5,  // 初始 spawn (同原 P 硬编码默认值, cpPoint 只在运行时 respawn 使用)
);

/**
 * 只读玩家状态引用（向后兼容 UI/渲染层）。
 * 注意：不要通过此引用写状态，所有写操作应走 playerController 接口。
 */
export const P: PlayerState = playerController.getState();

/* ==================== 当前帧碰撞体 ==================== */

const solidsNow: Rect[] = [];

/** 只读访问本帧碰撞体（玩家物理推挤用） */
export function getSolids(): readonly Rect[] {
  return solidsNow;
}

/** 构建本帧碰撞体（静态平台 + ECS 移动平台当前位置 + 弹簧平台） */
export function buildSolids(): void {
  solidsNow.length = 0;
  for (const s of currentMap.solids) solidsNow.push(s);
  for (const e of qMovers()) {
    const r = colliderWorldRect(e);
    r.plat = { dx: PathMotion.dx[e], dy: PathMotion.dy[e] };
    solidsNow.push(r);
  }
  for (const e of qSpringPads()) {
    const r = colliderWorldRect(e);
    r.springPad = e;
    solidsNow.push(r);
  }
  // 钩锁目标随本帧碰撞体一并刷新（射线检测用同一份"本帧世界几何"）
  buildHookTargets();
}

/* ==================== 当前帧钩锁目标 ==================== */

/** 钩锁射线目标：静态几何（hookable !== false）+ 带 Hookable 组件的实体 */
const hookTargetsNow: Rect[] = [];

/** 只读访问本帧钩锁目标列表（钩锁射线检测用） */
export function getHookTargets(): readonly Rect[] {
  return hookTargetsNow;
}

/**
 * 构建本帧钩锁目标。
 * 能力语义由 Hookable 组件显式声明：可为棋子加 Hookable 使其可勾
 * （激光/尖刺等危险物不加，即天然不可勾）；静态几何用 Rect.hookable 标记。
 */
export function buildHookTargets(): void {
  hookTargetsNow.length = 0;
  for (const s of currentMap.solids) {
    if (s.hookable !== false) hookTargetsNow.push(s);
  }
  for (const e of qHookTargets()) {
    hookTargetsNow.push(colliderWorldRect(e));
  }
}

/** AABB 碰撞检测（对 P 使用） */
export function boxHit(s: Rect): boolean {
  return (
    P.x - P.half < s.x + s.w &&
    P.x + P.half > s.x &&
    P.y - P.half < s.top &&
    P.y + P.half > s.y
  );
}

/** AABB 碰撞检测（通用版，对任意玩家状态） */
export function boxHitFor(p: PlayerState, s: Rect): boolean {
  return (
    p.x - p.half < s.x + s.w &&
    p.x + p.half > s.x &&
    p.y - p.half < s.top &&
    p.y + p.half > s.y
  );
}

/* ==================== 通用物理引擎 ==================== */

/**
 * 通用玩家物理步。
 *
 * 纯物理函数：只处理物理分辨率（加速度/跳跃/重力/平台推挤/外力消费）。
 * 不含副作用（音效/粒子/gs 写入）—— 这些由调用方（PlayerController 或 Game）处理。
 * 触发事件（致死/收集/检查点/终点）：一律经契约层（effects/applyEffect）投递请求，
 * 由结算管线裁决 —— 本函数不直接判定致死。
 * 危险物重叠检测已迁出（systems/interactions/hazard.ts），供本地/远程统一使用。
 *
 * 轨道分派：若 p.track 非空，则进入轨道运动模式（stepTrackMotion），
 * 完全替代自由物理步进；自由步进末尾调用 tryEnterTrack 检测入口捕获。
 *
 * @param p      玩家状态（读写）
 * @param input  外部输入（本帧按键；必须显式传入，不得为 null —— 物理与全局键盘解耦）
 * @param dt     帧时间
 * @param isLocal 是否为本地玩家（控制音效/粒子触发）
 * @param outSignals 可选输出参数，物理步内写入 wallBump 等信号
 */
export function stepPlayerGeneric(
  p: PlayerState,
  input: InputKeys,
  dt: number,
  isLocal: boolean,
  outSignals?: FrameSignals,
): void {
  // 轨道/滑索 → 轨道分派；否则 → 自由物理（与 S3 消费入口 stepPlayerByMode 逐位一致）
  if (p.track) {
    stepTrackDispatch(p, input, dt, outSignals);
    return;
  }
  stepFreePhysics(p, input, dt, isLocal, outSignals);
}

/**
 * S3 控制权消费入口（MovementSystem 读 ControlMode）—— 按仲裁结果分派物理。
 * 当前各档映射与旧行为逐位一致（金测试护栏，S1–S8 不变）：
 *   DEAD → 无物理（死亡计时/复活由 PlayerController 生命周期处理）；
 *   ZIPLINE / TRACK → 轨道分派（含滑索长按锁定）；
 *   FREE → 自由物理（含外力消费 / 轨道入口捕获）。
 * 扩展位：CONSTRAINT（眩晕/定身）→ 玩家被冻结，跳过自由输入积分，仅衰减计时。
 * 新控制权机制（冰冻/眩晕/强制冲刺）= 在 controlArbiter PRIORITY 表插更高优先级谓词
 * + 本函数加对应分支；MovementSystem 其余部分零改动 —— "之后眩晕/定身零物理改动"。
 */
export function stepPlayerByMode(
  p: PlayerState,
  mode: number,
  input: InputKeys,
  dt: number,
  isLocal: boolean,
  outSignals?: FrameSignals,
): void {
  if (mode === CONTROL_MODE_DEAD) return;
  if (mode === CONTROL_MODE_ZIPLINE || mode === CONTROL_MODE_TRACK) {
    stepTrackDispatch(p, input, dt, outSignals);
    return;
  }
  // 扩展位：约束类控制权（眩晕/定身）—— 冻结，跳过自由输入积分
  if (mode === CONTROL_MODE_CONSTRAINT) {
    p.jumpWasDown = input.jump;
    decayImpulses(p, dt);
    p.inv = Math.max(0, p.inv - dt);
    return;
  }
  stepFreePhysics(p, input, dt, isLocal, outSignals);
}

/** 轨道/滑索运动分派（TRACK / ZIPLINE 档） */
function stepTrackDispatch(
  p: PlayerState,
  input: InputKeys,
  dt: number,
  outSignals?: FrameSignals,
): void {
  // 保持 jumpWasDown 同步（轨道退出后 jumpFresh 不乱）
  p.jumpWasDown = input.jump;
  // 钩锁"长按锁定"输入：发射后持续按下左键 → 到站锁定（拉住不动）
  const hookHeld = input.hook;
  stepTrackMotion(p, dt, getMode(), outSignals, hookHeld);
}

/** 自由物理核心（FREE 档；金测试经 stepPlayerGeneric 直接调用） */
function stepFreePhysics(
  p: PlayerState,
  input: InputKeys,
  dt: number,
  isLocal: boolean,
  outSignals?: FrameSignals,
): void {
  buildSolids();

  // 移动平台携带（水平 + 垂直）
  if (p.plat) {
    p.x += p.plat.dx;
    p.y += p.plat.dy;
  }

  const mode = getMode();
  const ph = PHYS[mode];

  // 从输入源读取按键
  const Lf = input.left;
  const Rt = input.right;
  const jumpPressed = input.jump;
  const shiftPressed = input.sprint;

  // 跳跃"新按下沿"检测：上一物理步未按下 && 本步刚按下 → 一次按压只触发一次
  // jumpWasDown 由 PlayerController.setInput 在每帧注入时预先更新（反映上一帧的 input.jump），
  // 此处再写入当前帧状态，供下一帧/远程玩家使用。
  const jumpFresh = jumpPressed && !p.jumpWasDown;
  p.jumpWasDown = jumpPressed;

  const dir = (Rt ? 1 : 0) - (Lf ? 1 : 0);
  if (dir) p.face = dir;

  // 冲刺
  const spr = shiftPressed && (dir !== 0 || Math.abs(p.velocity.x) > 2);
  p.wasSpr = spr;
  p.sprint = spr;

  // 水平加速度（移速倍率由 Modifier 管道重算：默认 1，加速 buff = 2）
  const target = dir * (spr ? SPRINT : RUN) * (p.speedMult > 0 ? p.speedMult : 1);
  const acc = p.grounded ? (dir !== 0 ? 90 : 120) : ph.air;
  const dv = target - p.velocity.x;
  const st = acc * dt;
  p.velocity.x += Math.abs(dv) <= st ? dv : Math.sign(dv) * st;

  // 跳跃缓冲 & 土狼时间
  p.jbuf = jumpPressed ? ph.jb : 0;
  p.coyote -= dt;

  // 跳跃（地面 / 土狼时间：保留缓冲手感；一段跳不消耗二段跳）
  if (p.jbuf > 0 && (p.grounded || p.coyote > 0)) {
    p.velocity.y = ph.JV;
    p.grounded = false;
    p.coyote = 0;
    p.jbuf = 0;
    // 一次按压只跳一次：地面跳消耗输入层按下标记，防止同一按同时触发二段跳
    p.jumpFresh = false;
  } else if (p.extraJumps > 0 && (p.jumpFresh || jumpFresh)) {
    // 空中二段跳：
    //  - p.jumpFresh 输入层按下标记（keydown handler 写入），不受帧间 timing 影响，
    //    松开再按下必定触发；长按不产生新 keydown → 不会自动跳
    //  - jumpFresh 物理层边沿，作为远程玩家（无本地 keydown）的兜底
    p.jumpFresh = false;
    p.extraJumps--;
    p.velocity.y = ph.JV;
    p.jbuf = 0;
    if (outSignals) outSignals.doubleJump = true;
  } else {
    // 无跳跃发生的帧也消耗标记，防止残留到下帧误触发（如空中按了但当时没有二段跳次数）
    p.jumpFresh = false;
  }

  // 重力
  const hold = input.jump;
  const gm = mode === 'tuned'
    ? (p.velocity.y > 0 ? (hold ? 1 : 2.6) : (hold ? 1.4 : 2.2))
    : 1;
  p.velocity.y -= ph.G * gm * dt;
  if (p.velocity.y < -ph.MF) p.velocity.y = -ph.MF;
  const pv = p.velocity.y;

  // 水平碰撞
  p.x += p.velocity.x * dt;
  for (const s of solidsNow) {
    if (boxHitFor(p, s)) {
      // 玩家脚底贴住固体顶面（站立 / 被移动平台携带 / 重力微沉）
      // → 由垂直碰撞吸附，不做水平推挤（否则站在平台上会被推出边缘 → x 位移）
      if (p.y - p.half >= s.top - 0.05) continue;
      // ── 墙壁弹簧（细长 w<h，侧面碰撞）：触发弹射，不阻断速度 ──
      if (s.springPad !== undefined && s.w < s.h) {
        const sid = s.springPad;
        if (SpringPad.cooldown[sid] <= 0) {
          SpringPad.cooldown[sid] = SpringPad.duration[sid] + 0.3;
          SpringPad.animTimer[sid] = SpringPad.duration[sid];
          SpringPad.firing[sid] = 1;
          // 契约：弹射 = ImpulseRequest（瞬间冲量 + 持续加速），不直写玩家弹簧字段
          applyEffect(p, {
            kind: 'Impulse',
            ax: SpringPad.fx[sid],
            ay: SpringPad.fy[sid],
            dur: SpringPad.duration[sid],
            instant: true,
          });
          // 首次触发时推挤到最近边缘（基于玩家位置，避免瞬移）
          if (p.x < s.x + s.w / 2) {
            p.x = s.x - p.half;      // 在左半边 → 推到左侧
          } else {
            p.x = s.x + s.w + p.half; // 在右半边 → 推到右侧
          }
          if (outSignals) outSignals.spring = true;
        }
        // 后续帧不再推挤——玩家靠瞬间冲量的速度自然穿过弹簧
        continue; // 跳过普通墙壁的 vx=0 清零
      }

      // 普通墙壁推挤
      if (outSignals && Math.abs(p.velocity.x) > 5) outSignals.wallBump = true;
      if (p.velocity.x > 0) p.x = s.x - p.half;
      else if (p.velocity.x < 0) p.x = s.x + s.w + p.half;
      else {
        const dl = p.x + p.half - s.x;
        const dr = s.x + s.w - (p.x - p.half);
        p.x += dl < dr ? -dl : dr;
      }
      p.velocity.x = 0;
    }
  }
  p.x = clamp(p.x, p.half, currentMap.width - p.half);

  // 垂直碰撞
  p.y += p.velocity.y * dt;
  p.grounded = false;
  p.plat = null;
  let springEnt: number | null = null;
  for (const s of solidsNow) {
    if (boxHitFor(p, s)) {
      if (p.velocity.y <= 0) {
        p.y = s.top + p.half;
        p.velocity.y = 0;
        p.grounded = true;
        if (s.plat) p.plat = s.plat;
        // 扁宽弹簧（w >= h）只能从顶部踩触发
        if (s.springPad !== undefined && s.w >= s.h) springEnt = s.springPad;
      } else {
        p.y = s.y - p.half;
        p.velocity.y = 0;
      }
    }
  }

  // 弹簧平台：落在弹簧上且冷却结束 → 开始弹射（加速度持续 duration，动画同步）
  if (springEnt !== null) {
    const sid = springEnt;
    if (SpringPad.cooldown[sid] <= 0) {
      SpringPad.cooldown[sid] = SpringPad.duration[sid] + 0.3;
      SpringPad.animTimer[sid] = SpringPad.duration[sid];
      SpringPad.firing[sid] = 1;
      // 契约：顶簧 = ImpulseRequest（仅持续加速），不直写玩家弹簧字段
      applyEffect(p, {
        kind: 'Impulse',
        ax: SpringPad.fx[sid],
        ay: SpringPad.fy[sid],
        dur: SpringPad.duration[sid],
      });
      if (outSignals) outSignals.spring = true;
    }
  }

  // 外力消费（弹簧/击退/气流通用；与弹簧伸缩动画同步）
  consumeImpulses(p, dt);

  if (p.grounded) {
    p.coyote = ph.coy;
    // 着陆刷新额外跳跃（双跳为永久能力，每次着地恢复满）
    p.extraJumps = p.extraJumpsMax;
  }

  p.inv = Math.max(0, p.inv - dt);

  // 坠落死亡（仅设标记，无副作用）
  if (!p.dead && p.y < -8) {
    p.dead = true;
  }

  // ── 轨道入口捕获（自由步进最后，!p.track 时检测）──
  tryEnterTrack(p, dt, outSignals);
}

/* ==================== 轨道运动辅助 ==================== */

/**
 * 轨道运动步进 —— 沿路径（直线/圆弧）参数化运动。
 * 切向重力减速/加速 + 速度耗尽滚回 + 出口释放。
 * 不处理 AABB 碰撞（玩家在轨时不受普通碰撞影响）。
 *
 * 路径几何由 TrackState.segments 定义，通过 core/path 纯函数计算位置/切线。
 * @param hookHeld 钩锁发射后左键是否仍按住（钩锁滑索到站时锁定，拉住不动）
 */
function stepTrackMotion(
  p: PlayerState,
  dt: number,
  mode: PhysicsKey,
  signals?: FrameSignals,
  hookHeld = false,
): void {
  const t = p.track!;
  const cl = t.cumulative;
  // 衰减（与自由物理步进保持一致）
  p.jbuf -= dt;
  p.coyote -= dt;
  decayImpulses(p, dt); // 在轨时外力只衰减计时，不施力（与原 springT 语义一致）
  p.inv = Math.max(0, p.inv - dt);

  // ── 滑索（钩锁）分支：匀速前进，不受切向重力/摩擦/滚回 ──
  if (t.zipline) {
    t.dist += t.speed * dt;
    if (t.dist >= t.exitDist) {
      t.dist = t.exitDist;
      const pos = pathPosition(t.segments, cl, t.dist);
      p.x = pos.x;
      p.y = pos.y;
      const tan = pathTangent(t.segments, cl, t.dist);
      if (Math.abs(tan.x) > 0.05) p.face = Math.sign(tan.x);
      // 长按锁定：保持在锚点（拉住不动），绳索持续可见；松开左键才脱钩
      if (hookHeld) {
        t.speed = 0;
        p.velocity.x = 0;
        p.velocity.y = 0;
        return; // 保持 p.track，下帧继续走锁定分支
      }
      releaseFromTrack(p, t);
      if (signals) signals.trackExited = true;
      return;
    }
    const pos = pathPosition(t.segments, cl, t.dist);
    p.x = pos.x;
    p.y = pos.y;
    const tan = pathTangent(t.segments, cl, t.dist);
    if (Math.abs(tan.x) > 0.05) p.face = Math.sign(tan.x);
    return;
  }

  // 切向重力分量（通用路径版本）
  const gTan = pathGravityTangent(t.segments, cl, t.dist, PHYS[mode].G);
  t.speed += gTan * dt;
  // 摩擦阻尼（仅正向；反向滚回不衰减，保证长直线能滑回入口）
  if (t.speed >= 0) t.speed *= 1 - TRACK_FRICTION * dt;

  // 沿路径前进
  t.dist += t.speed * dt;
  if (t.dist < 0) t.dist = 0;
  const pos = pathPosition(t.segments, cl, t.dist);
  p.x = pos.x;
  p.y = pos.y;

  // 面朝切线水平分量
  const tan = pathTangent(t.segments, cl, t.dist);
  if (Math.abs(tan.x) > 0.05) p.face = Math.sign(tan.x);

  // ── 出口判定（到达出口距离）──
  if (t.dist >= t.exitDist) {
    releaseFromTrack(p, t);
    if (signals) signals.trackExited = true;
    return;
  }

  // ── 滚回判定（正向爬升中速度耗尽 → 反向滑回入口）──
  if (t.speed >= 0 && t.speed < TRACK_STOP_SPEED && t.dist < t.exitDist) {
    // 原 -0.5 会被摩擦耗尽：长直线（10 格）必须更高速度才能滑回入口
    t.speed = -TRACK_ROLLBACK_SPEED;
    if (signals) signals.trackRollback = true;
    return;
  }

  // ── 反向滑回入口 → 释放（统一温和回弹，避免高速滚回入口弹射过猛）──
  if (t.speed < 0 && t.dist <= t.entryDist) {
    t.speed = -TRACK_ROLLBACK_RELEASE;
    releaseFromTrack(p, t);
    return;
  }
}

/** 释放玩家出轨道：将路径切线速度转为 vx/vy，清除 track 状态 */
function releaseFromTrack(p: PlayerState, t: TrackState): void {
  const tan = pathTangent(t.segments, t.cumulative, t.dist);
  p.velocity.x = tan.x * t.speed;
  p.velocity.y = tan.y * t.speed;
  p.track = null;
  p.grounded = false;
  p.plat = null;
  p.jbuf = 0;
}

/**
 * 轨道入口捕获检测 —— 搜索附近 Track 实体，检查速度/方向条件。
 * 捕获后立即吸附到入口点，设置 TrackState。
 */
function tryEnterTrack(p: PlayerState, _dt: number, signals?: FrameSignals): void {
  if (p.track || p.dead) return;
  const sp = Math.sqrt(p.velocity.x * p.velocity.x + p.velocity.y * p.velocity.y);

  for (const e of qTracks()) {
    // 速度阈值检查 + 静止/超低速 NaN 防护（sp≈0 → 0/0 导致传送至出口）
    if (sp < Math.max(Track.speedThreshold[e], 1e-3)) continue;
    const dx = p.x - Track.entryX[e];
    const dy = p.y - Track.entryY[e];
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > TRACK_CAPTURE_RADIUS) continue;

    // 方向检查：速度与入口切线方向点积
    const segments = TrackGeom[e].segments;
    const entryTan = pathTangent(segments, buildCumulativeLengths(segments), Track.entryDist[e]);
    const dot = (p.velocity.x * entryTan.x + p.velocity.y * entryTan.y) / sp;
    if (dot < 0.5) continue;

    // 捕获
    const cl = buildCumulativeLengths(segments);
    const total = cl[cl.length - 1];
    const entryPos = pathPosition(segments, cl, Track.entryDist[e]);
    p.track = {
      segments,
      cumulative: cl,
      dist: Track.entryDist[e],
      speed: Math.max(sp * dot, Track.speedThreshold[e]),
      totalLength: total,
      entryDist: Track.entryDist[e],
      exitDist: Track.exitDist[e],
    };
    p.grounded = false;
    p.plat = null;
    p.jbuf = 0;
    // 立即吸附到入口点
    p.x = entryPos.x;
    p.y = entryPos.y;
    if (signals) signals.trackEntered = true;
    break;
  }
}

/* ==================== S3 控制权仲裁 ==================== */

// 控制权仲裁（每帧写 ControlMode 组件）：resolveControlMode 纯函数 + stepControlArbiter 系统入口。
// 详见 controlArbiter.ts；MovementSystem 未来只读仲裁结果。
export { resolveControlMode, writeControlMode, stepControlArbiter } from './controlArbiter';
