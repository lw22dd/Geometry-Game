/**
 * 玩家系统 —— 物理 / 碰撞 / 生死。
 * 注册表 export：P, die, respawn, stepPlayer, stepRemotePlayer, buildSolids, boxHit。
 *
 * 联机模式下：
 *   房主：stepPlayer() 为本地玩家，stepRemotePlayer() 为每个客机
 *   客机：stepPlayer() 为本地预测 + 后续被权威状态矫正
 */
import type { PlayerState, Rect, InputKeys } from '../../types';
import { keys } from '../../core/input';
import { clamp } from '../../core/math';
import { sfx } from '../../core/audio';
import { netBus } from '../../core/netBus';
import { room } from '../../net/room';
import {
  PHYS, RUN, SPRINT, currentMap, cpPoint,
  type PhysicsKey,
} from '../../config';
import { gs, getMode } from '../game/state';
import { trail } from '../particles';
import { spawnFx, FX } from '../../Prefabs/Fx';
import { world } from '../../core/ecs';
import { Position } from '../../components/Position';
import { Collider } from '../../components/Collider';
import { PathMotion } from '../../components/PathMotion';
import { Timer } from '../../components/Timer';
import { Hazard } from '../../components/Hazard';
import { colliderWorldRect } from '../level';
import { updateCollectSystem } from '../interactions';
import { updateRespawnPointSystem } from '../interactions';
import { updateGoalSystem } from '../interactions';
import { stepDefaultPlayerAnimation } from '../../Prefabs/Player/default/defaultPrefab';

/** 本地玩家状态 */
export const P: PlayerState = {
  x: 6, y: 5, vx: 0, vy: 0, half: 0.42, grounded: false,
  coyote: 0, jbuf: 0, face: 1, squash: 0, dead: false, deadT: 0,
  plat: null, sprint: false, wasSpr: false, inv: 0,
};

/** 当前帧碰撞体列表（每次物理步构建） */
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

/* ==================== 本地玩家 ==================== */

/** 死亡 */
export function die(): void {
  if (P.dead || P.inv > 0) return;
  P.dead = true;
  P.deadT = 0.85;
  gs.deaths++;
  gs.shake = 1;
  gs.flash = 0.6;
  spawnFx(FX.death, P.x, P.y);
  sfx.die();
  // 房主模式下广播死亡事件（netBridge 负责转发）
  netBus.emit({ type: 'game:death', deaths: gs.deaths });
}

/** 复活 */
export function respawn(): void {
  P.dead = false;
  P.x = cpPoint.x;
  P.y = cpPoint.y + 1.2;
  P.vx = 0;
  P.vy = 0;
  P.inv = 1.2;
  P.plat = null;
  trail.length = 0;
}

/** 玩家物理步（由 game/index step 调用，读取本地 keys 表） */
export function stepPlayer(dt: number): void {
  stepPlayerGeneric(P, null, dt, true);
}

/* ==================== 通用物理引擎 ==================== */

/**
 * 通用玩家物理步。
 * @param p      玩家状态（读写）
 * @param input  外部输入（null 则从本地 keys 表读取）
 * @param dt     帧时间
 * @param isLocal 是否为本地玩家（控制音效/粒子/收集系统触发）
 */
export function stepPlayerGeneric(
  p: PlayerState,
  input: InputKeys | null,
  dt: number,
  isLocal: boolean,
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
  if (isLocal) {
    if (spr && !p.wasSpr) sfx.dash();
  }
  p.wasSpr = spr;
  p.sprint = spr;

  // 水平加速度
  const target = dir * (spr ? SPRINT : RUN);
  const acc = p.grounded ? (dir !== 0 ? 90 : 120) : ph.air;
  const dv = target - p.vx;
  const st = acc * dt;
  p.vx += Math.abs(dv) <= st ? dv : Math.sign(dv) * st;

  // 跳跃缓冲 & 土狼时间
  // 注意：客机输入不含 jbuf，由 jumpPressed 的上升沿处理
  // 如果 input 驱动，则 jumpPressed 持续 true 即为按住
  if (input !== null) {
    // 外部输入模式：jumpPressed 即按住跳跃
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
    if (isLocal) sfx.jump();
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
        if (pv < -7.5 && isLocal) {
          spawnFx(FX.dust, p.x, p.y - p.half, 6);
          sfx.land(-pv * 0.02);
        }
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
  stepDefaultPlayerAnimation(p, dt);

  // 冲刺曳光（仅本地玩家）
  if (p.sprint && isLocal) {
    trail.push({ x: p.x - p.face * 0.12, y: p.y, age: 0 });
  }

  // 尖刺 / 激光 / 坠落
  if (p.inv <= 0 && !p.dead) {
    for (const s of currentMap.spikes) {
      if (p.x + p.half > s.x + 0.3 && p.x - p.half < s.x + 0.7 &&
          p.y - p.half < s.y + 0.55 && p.y + p.half > s.y) {
        if (isLocal) die();
        else p.dead = true;
        break;
      }
    }
    if (!p.dead) {
      for (const e of world.query(Position, Collider, Timer, Hazard)) {
        const t = world.get<Timer>(e, Timer);
        if (!t.on) continue;
        const pos = world.get<Position>(e, Position);
        const col = world.get<Collider>(e, Collider);
        const r = colliderWorldRect(pos, col);
        if (Math.abs(p.x - pos.x) < 0.56 &&
            p.y + p.half > r.y + 0.1 && p.y - p.half < r.top) {
          if (isLocal) die();
          else p.dead = true;
          break;
        }
      }
    }
  }
  if (!p.dead && p.y < -8) {
    if (isLocal) die();
    else p.dead = true;
  }

  // 收集品 / 检查点 / 终点（仅本地玩家；客机模式下权威逻辑在房主端，本地不执行）
  if (!p.dead && isLocal && room.role !== 'client') {
    updateCollectSystem();
    updateRespawnPointSystem();
    updateGoalSystem();
  }
}

/**
 * 步进远程玩家（房主用：为每个客机模拟物理）。
 * 简化版：不触发音效/粒子/收集系统，仅物理同步。
 */
export function stepRemotePlayer(p: RemotePlayerState, input: InputKeys | null, dt: number): void {
  // 用临时 PlayerState 执行物理
  const tmp: PlayerState = {
    x: p.x, y: p.y, vx: p.vx, vy: p.vy, half: 0.42,
    grounded: p.grounded, coyote: 0, jbuf: 0, face: p.face,
    squash: p.squash, dead: p.dead, deadT: 0, plat: null,
    sprint: p.sprint, wasSpr: false, inv: p.inv,
  };

  stepPlayerGeneric(tmp, input, dt, false);

  // 写回
  p.x = tmp.x; p.y = tmp.y;
  p.vx = tmp.vx; p.vy = tmp.vy;
  p.grounded = tmp.grounded;
  p.face = tmp.face;
  p.squash = tmp.squash;
  p.dead = tmp.dead;
  p.inv = tmp.inv;
  p.sprint = tmp.sprint;
}

/** 远程玩家权威状态精简接口（给 stepRemotePlayer 用） */
interface RemotePlayerState {
  x: number; y: number; vx: number; vy: number;
  face: number; grounded: boolean; dead: boolean;
  sprint: boolean; squash: number; inv: number;
}