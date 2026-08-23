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
import type { FrameSignals, PlayerState, Rect, InputKeys } from '../../types';
import { keys } from '../../core/input';
import { clamp } from '../../core/math';
import {
  PHYS, RUN, SPRINT, currentMap,
} from '../../config';
import { getMode } from '../game/gameMode';
import { trail } from '../particles';
import { world } from '../../core/ecs';
import { Position } from '../../components/Position';
import { Collider } from '../../components/Collider';
import { PathMotion } from '../../components/PathMotion';
import { Timer } from '../../components/Timer';
import { Hazard } from '../../components/Hazard';
import { colliderWorldRect, aabbOverlap } from '../level';
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

/** 构建本帧碰撞体（静态平台 + ECS 移动平台当前位置） */
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
  buildSolids();

  // 移动平台携带
  if (p.plat) p.x += p.plat.dx;

  const mode = getMode();
  const ph = PHYS[mode];

  // 从输入源读取按键
  const Lf = input !== null ? input.left : (keys.ArrowLeft || keys.KeyA);
  const Rt = input !== null ? input.right : (keys.ArrowRight || keys.KeyD);
  const jumpPressed = input !== null ? input.jump : (keys.Space || keys.KeyW || keys.ArrowUp);
  const shiftPressed = input !== null ? input.sprint : (keys.ShiftLeft || keys.ShiftRight);

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

  // 跳跃
  if (p.jbuf > 0 && (p.grounded || p.coyote > 0)) {
    p.vy = ph.JV;
    p.grounded = false;
    p.coyote = 0;
    p.jbuf = 0;
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
      // 撞墙信号（水平速度足够大时；碰撞后 vx 清零，连按不会重复触发）
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
  for (const s of solidsNow) {
    if (boxHitFor(p, s)) {
      if (p.vy <= 0) {
        p.y = s.top + p.half;
        p.vy = 0;
        p.grounded = true;
        if (s.plat) p.plat = s.plat;
      } else {
        p.y = s.y - p.half;
        p.vy = 0;
      }
    }
  }

  if (p.grounded) p.coyote = ph.coy;

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
}