/**
 * 玩家系统 —— 物理引擎 + PlayerController 导出。
 *
 * 导出的物理函数（纯函数，无副作用）：
 *  - stepPlayerGeneric(p, input, dt, isLocal, outSignals, checkHazards)
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
import { keys } from '../../core/input';
import { clamp } from '../../core/math';
import {
  PHYS, RUN, SPRINT, currentMap,
  TRACK_CAPTURE_RADIUS, TRACK_STOP_SPEED, TRACK_FRICTION,
  TRACK_ROLLBACK_SPEED, TRACK_ROLLBACK_RELEASE,
} from '../../config';
import { getMode, type PhysicsKey } from '../game/gameMode';
import { trail } from '../particles';
import { world } from '../../core/ecs';
import { Position } from '../../components/physics/Position';
import { Collider } from '../../components/physics/Collider';
import { PathMotion } from '../../components/physics/PathMotion';
import { SpringPad } from '../../components/physics/SpringPad';
import { Timer } from '../../components/gameplay/Timer';
import { Hazard } from '../../components/gameplay/Hazard';
import { Track } from '../../components/physics/Track';
import { colliderWorldRect, aabbOverlap } from '../level';
import {
  pathPosition, pathTangent, pathGravityTangent,
  buildCumulativeLengths, pathTotalLength,
} from '../../core/path';
import { PlayerController } from './PlayerController';

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

/** 只读访问本帧碰撞体（钩锁射线检测等复用） */
export function getSolids(): readonly Rect[] {
  return solidsNow;
}

/** 构建本帧碰撞体（静态平台 + ECS 移动平台当前位置 + 弹簧平台） */
export function buildSolids(): void {
  solidsNow.length = 0;
  for (const s of currentMap.solids) solidsNow.push(s);
  for (const e of world.query(Position, Collider, PathMotion)) {
    const pos = world.get<Position>(e, Position);
    const col = world.get<Collider>(e, Collider);
    const pm = world.get<PathMotion>(e, PathMotion);
    const r = colliderWorldRect(pos, col);
    r.plat = pm;
    solidsNow.push(r);
  }
  for (const e of world.query(Position, Collider, SpringPad)) {
    const pos = world.get<Position>(e, Position);
    const col = world.get<Collider>(e, Collider);
    const r = colliderWorldRect(pos, col);
    r.springPad = e as number;
    solidsNow.push(r);
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
 * 纯物理函数：只处理物理分辨率（加速度/跳跃/重力/平台推挤）。
 * 不含副作用（音效/粒子/gs 写入）—— 这些由调用方（PlayerController 或 Game）处理。
 * 触发事件（致死/收集/检查点/终点）：
 *   - 本地玩家由 CollisionSystem + CollisionHooks 处理
 *   - 远程玩家（host 模拟）通过 checkHazards 参数启用行内检测
 *
 * 轨道分派：若 p.track 非空，则进入轨道运动模式（stepTrackMotion），
 * 完全替代自由物理步进；自由步进末尾调用 tryEnterTrack 检测入口捕获。
 *
 * @param p      玩家状态（读写）
 * @param input  外部输入（null 则从本地 keys 表读取）
 * @param dt     帧时间
 * @param isLocal 是否为本地玩家（控制音效/粒子触发）
 * @param outSignals 可选输出参数，物理步内写入 wallBump 信号
 * @param checkHazards 是否行内检测危险物（host 模拟远程玩家时使用）
 */
export function stepPlayerGeneric(
  p: PlayerState,
  input: InputKeys | null,
  dt: number,
  isLocal: boolean,
  outSignals?: FrameSignals,
  checkHazards?: boolean,
): void {
  // ── 轨道运动分派：在轨玩家不走自由物理 ──
  if (p.track) {
    // 保持 jumpWasDown 同步（轨道退出后 jumpFresh 不乱）
    p.jumpWasDown = input !== null ? input.jump : (keys.Space || keys.KeyW || keys.ArrowUp);
    // 钩锁"长按锁定"输入：发射后持续按下左键 → 到站锁定（拉住不动）
    const hookHeld = input !== null ? input.hook : false;
    stepTrackMotion(p, dt, getMode(), outSignals, hookHeld);
    return;
  }

  buildSolids();

  // 移动平台携带（水平 + 垂直）
  if (p.plat) {
    p.x += p.plat.dx;
    p.y += p.plat.dy;
  }

  const mode = getMode();
  const ph = PHYS[mode];

  // 从输入源读取按键
  const Lf = input !== null ? input.left : (keys.ArrowLeft || keys.KeyA);
  const Rt = input !== null ? input.right : (keys.ArrowRight || keys.KeyD);
  const jumpPressed = input !== null ? input.jump : (keys.Space || keys.KeyW || keys.ArrowUp);
  const shiftPressed = input !== null ? input.sprint : (keys.ShiftLeft || keys.ShiftRight);

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

  // 水平加速度
  const target = dir * (spr ? SPRINT : RUN);
  const acc = p.grounded ? (dir !== 0 ? 90 : 120) : ph.air;
  const dv = target - p.velocity.x;
  const st = acc * dt;
  p.velocity.x += Math.abs(dv) <= st ? dv : Math.sign(dv) * st;

  // 跳跃缓冲 & 土狼时间
  if (input !== null) {
    p.jbuf = jumpPressed ? ph.jb : 0;
    p.coyote -= dt;
  } else {
    p.jbuf -= dt;
    p.coyote -= dt;
  }

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
  const hold = input !== null ? input.jump : (keys.Space || keys.KeyW || keys.ArrowUp);
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
        const spring = world.get<SpringPad>(s.springPad, SpringPad);
        if (spring.cooldown <= 0) {
          spring.cooldown = spring.duration + 0.3;
          spring.animTimer = spring.duration;
          spring.firing = true;
          p.springT = spring.duration;
          p.springAcceleration.x = spring.force.x;
          p.springAcceleration.y = spring.force.y;
          // 瞬间冲量：水平弹簧需要克服水平阻尼，直接给足速度
          p.velocity.x += spring.force.x;
          p.velocity.y += spring.force.y;
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
    const spring = world.get<SpringPad>(springEnt, SpringPad);
    if (spring.cooldown <= 0) {
      spring.cooldown = spring.duration + 0.3;
      spring.animTimer = spring.duration;
      spring.firing = true;
      p.springT = spring.duration;
      p.springAcceleration.x = spring.force.x;
      p.springAcceleration.y = spring.force.y;
      if (outSignals) outSignals.spring = true;
    }
  }

  // 弹簧持续加速（加速时间 = springT，与弹簧伸缩动画同步）
  if (p.springT > 0) {
    p.velocity.x += p.springAcceleration.x * dt;
    p.velocity.y += p.springAcceleration.y * dt;
    p.springT -= dt;
    if (p.springT < 0) p.springT = 0;
  }

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

  // ── 远程玩家行内危险物检测（host 模拟远程玩家时启用）──
  if (checkHazards && !p.dead && p.inv <= 0) {
    // 尖刺（ECS 实体：Position + Collider + Hazard，无 Timer）
    for (const e of world.query(Position, Collider, Hazard)) {
      if (world.has(e, Timer)) continue; // 激光带 Timer，下方处理
      const pos = world.get<Position>(e, Position);
      const col = world.get<Collider>(e, Collider);
      const r = colliderWorldRect(pos, col);
      if (aabbOverlap(
        { x: p.x - p.half, y: p.y - p.half, w: p.half * 2, h: p.half * 2, top: p.y + p.half },
        r,
      )) {
        p.dead = true;
        break;
      }
    }
    // 激光（ECS 实体：Position + Collider + Timer + Hazard）
    if (!p.dead) {
      for (const e of world.query(Position, Collider, Timer, Hazard)) {
        const t = world.get<Timer>(e, Timer);
        if (!t.on) continue;
        const pos = world.get<Position>(e, Position);
        const col = world.get<Collider>(e, Collider);
        const r = colliderWorldRect(pos, col);
        if (aabbOverlap(
          { x: p.x - p.half, y: p.y - p.half, w: p.half * 2, h: p.half * 2, top: p.y + p.half },
          r,
        )) {
          p.dead = true;
          break;
        }
      }
    }
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
  p.springT = Math.max(0, p.springT - dt);
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

  for (const e of world.query(Position, Track)) {
    const tr = world.get<Track>(e, Track);
    // 速度阈值检查 + 静止/超低速 NaN 防护（sp≈0 → 0/0 导致传送至出口）
    if (sp < Math.max(tr.speedThreshold, 1e-3)) continue;
    const dx = p.x - tr.entryX;
    const dy = p.y - tr.entryY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > TRACK_CAPTURE_RADIUS) continue;

    // 方向检查：速度与入口切线方向点积
    const entryTan = pathTangent(tr.segments, buildCumulativeLengths(tr.segments), tr.entryDist);
    const dot = (p.velocity.x * entryTan.x + p.velocity.y * entryTan.y) / sp;
    if (dot < 0.5) continue;

    // 捕获
    const cl = buildCumulativeLengths(tr.segments);
    const total = cl[cl.length - 1];
    const entryPos = pathPosition(tr.segments, cl, tr.entryDist);
    p.track = {
      segments: tr.segments,
      cumulative: cl,
      dist: tr.entryDist,
      speed: Math.max(sp * dot, tr.speedThreshold),
      totalLength: total,
      entryDist: tr.entryDist,
      exitDist: tr.exitDist,
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