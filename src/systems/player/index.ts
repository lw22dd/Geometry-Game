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
} from '../../config';
import { getMode, type PhysicsKey } from '../game/gameMode';
import { trail } from '../particles';
import { world } from '../../core/ecs';
import { Position } from '../../components/Position';
import { Collider } from '../../components/Collider';
import { PathMotion } from '../../components/PathMotion';
import { SpringPad } from '../../components/SpringPad';
import { Timer } from '../../components/Timer';
import { Hazard } from '../../components/Hazard';
import { Track } from '../../components/Track';
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
    stepTrackMotion(p, dt, getMode(), outSignals);
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
  const jumpFresh = jumpPressed && !p.jumpWasDown;
  p.jumpWasDown = jumpPressed;

  const dir = (Rt ? 1 : 0) - (Lf ? 1 : 0);
  if (dir) p.face = dir;

  // 冲刺
  const spr = shiftPressed && (dir !== 0 || Math.abs(p.vx) > 2);
  p.wasSpr = spr;
  p.sprint = spr;

  // 水平加速度
  const target = dir * (spr ? SPRINT : RUN);
  const acc = p.grounded ? (dir !== 0 ? 90 : 120) : ph.air;
  const dv = target - p.vx;
  const st = acc * dt;
  p.vx += Math.abs(dv) <= st ? dv : Math.sign(dv) * st;

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
    p.vy = ph.JV;
    p.grounded = false;
    p.coyote = 0;
    p.jbuf = 0;
  } else if (jumpFresh && p.extraJumps > 0) {
    // 空中二段跳：仅"松开后再次按下"的二次按压触发，消耗一次额外跳跃
    p.extraJumps--;
    p.vy = ph.JV;
    p.jbuf = 0;
    if (outSignals) outSignals.doubleJump = true;
  }

  // 重力
  const hold = input !== null ? input.jump : (keys.Space || keys.KeyW || keys.ArrowUp);
  const gm = mode === 'tuned'
    ? (p.vy > 0 ? (hold ? 1 : 2.6) : (hold ? 1.4 : 2.2))
    : 1;
  p.vy -= ph.G * gm * dt;
  if (p.vy < -ph.MF) p.vy = -ph.MF;
  const pv = p.vy;

  // 水平碰撞
  p.x += p.vx * dt;
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
          p.springX = spring.forceX;
          p.springY = spring.forceY;
          // 瞬间冲量：水平弹簧需要克服水平阻尼，直接给足速度
          p.vx += spring.forceX;
          p.vy += spring.forceY;
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
      if (outSignals && Math.abs(p.vx) > 5) outSignals.wallBump = true;
      if (p.vx > 0) p.x = s.x - p.half;
      else if (p.vx < 0) p.x = s.x + s.w + p.half;
      else {
        const dl = p.x + p.half - s.x;
        const dr = s.x + s.w - (p.x - p.half);
        p.x += dl < dr ? -dl : dr;
      }
      p.vx = 0;
    }
  }
  p.x = clamp(p.x, p.half, currentMap.width - p.half);

  // 垂直碰撞
  p.y += p.vy * dt;
  p.grounded = false;
  p.plat = null;
  let springEnt: number | null = null;
  for (const s of solidsNow) {
    if (boxHitFor(p, s)) {
      if (p.vy <= 0) {
        p.y = s.top + p.half;
        p.vy = 0;
        p.grounded = true;
        if (s.plat) p.plat = s.plat;
        // 扁宽弹簧（w >= h）只能从顶部踩触发
        if (s.springPad !== undefined && s.w >= s.h) springEnt = s.springPad;
      } else {
        p.y = s.y - p.half;
        p.vy = 0;
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
      p.springX = spring.forceX;
      p.springY = spring.forceY;
      if (outSignals) outSignals.spring = true;
    }
  }

  // 弹簧持续加速（加速时间 = springT，与弹簧伸缩动画同步）
  if (p.springT > 0) {
    p.vx += p.springX * dt;
    p.vy += p.springY * dt;
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
 */
function stepTrackMotion(
  p: PlayerState,
  dt: number,
  mode: PhysicsKey,
  signals?: FrameSignals,
): void {
  const t = p.track!;
  const cl = t.cumulative;
  // 衰减（与自由物理步进保持一致）
  p.jbuf -= dt;
  p.coyote -= dt;
  p.springT = Math.max(0, p.springT - dt);
  p.inv = Math.max(0, p.inv - dt);

  // 切向重力分量（通用路径版本）
  const gTan = pathGravityTangent(t.segments, cl, t.dist, PHYS[mode].G);
  t.speed += gTan * dt;
  // 摩擦阻尼
  t.speed *= 1 - TRACK_FRICTION * dt;

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
    // 反转方向：速度变负，继续沿路径滑回
    t.speed = -0.5;
    if (signals) signals.trackRollback = true;
    return;
  }

  // ── 反向滑回入口 → 释放（带着切向速度飞回）──
  if (t.speed < 0 && t.dist <= t.entryDist) {
    releaseFromTrack(p, t);
    return;
  }
}

/** 释放玩家出轨道：将路径切线速度转为 vx/vy，清除 track 状态 */
function releaseFromTrack(p: PlayerState, t: TrackState): void {
  const tan = pathTangent(t.segments, t.cumulative, t.dist);
  p.vx = tan.x * t.speed;
  p.vy = tan.y * t.speed;
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
  const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);

  for (const e of world.query(Position, Track)) {
    const tr = world.get<Track>(e, Track);
    if (sp < tr.speedThreshold) continue;
    const dx = p.x - tr.entryX;
    const dy = p.y - tr.entryY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > TRACK_CAPTURE_RADIUS) continue;

    // 方向检查：速度与入口切线方向点积
    const entryTan = pathTangent(tr.segments, buildCumulativeLengths(tr.segments), tr.entryDist);
    const dot = (p.vx * entryTan.x + p.vy * entryTan.y) / sp;
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