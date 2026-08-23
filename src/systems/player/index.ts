/**
 * 玩家系统 —— 物理 / 碰撞 / 生死。
 * 注册表 export：P, die, respawn, stepPlayer, buildSolids, boxHit（供 pickups 等使用）。
 */
import type { PlayerState, Rect } from '../../types';
import { keys } from '../../core/input';
import { clamp } from '../../core/math';
import { sfx } from '../../core/audio';
import {
  PHYS, RUN, SPRINT, MAP_W, MAP_H,
  solids, movers, spikes, lasers, laserOn, cpPoint,
  type PhysicsKey,
} from '../../config';
import { gs, getMode } from '../game/state';
import { trail } from '../world/particles';
import { burstDeath, dust } from '../world/particles';
import { updateCollectSystem } from '../CollectSystem';
import { updateCheckpointSystem } from '../CheckpointSystem';
import { updateNovaSystem } from '../NovaSystem';

/** 玩家状态 */
export const P: PlayerState = {
  x: 6, y: 5, vx: 0, vy: 0, half: 0.42, grounded: false,
  coyote: 0, jbuf: 0, face: 1, squash: 0, dead: false, deadT: 0,
  plat: null, sprint: false, wasSpr: false, inv: 0,
};

/** 当前帧碰撞体列表（每次物理步构建） */
const solidsNow: Rect[] = [];

/** 构建本帧碰撞体（静态平台 + 移动平台当前位置） */
export function buildSolids(): void {
  solidsNow.length = 0;
  for (const s of solids) solidsNow.push(s);
  for (const m of movers) solidsNow.push({ x: m.x, y: m.y, w: m.w, h: m.h, top: m.y + m.h, plat: m });
}

/** AABB 碰撞检测 */
export function boxHit(s: Rect): boolean {
  return (
    P.x - P.half < s.x + s.w &&
    P.x + P.half > s.x &&
    P.y - P.half < s.top &&
    P.y + P.half > s.y
  );
}

/** 死亡 */
export function die(): void {
  if (P.dead || P.inv > 0) return;
  P.dead = true;
  P.deadT = 0.85;
  gs.deaths++;
  gs.shake = 1;
  gs.flash = 0.6;
  burstDeath(P.x, P.y);
  sfx.die();
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
  // trail 不清空（原版本不清；原代码：trail.length=0;）
  // 原代码在 respawn 清空 trail: trail.length = 0;
  // 保持一致：清空
  trail.length = 0;
}

/** 玩家物理步（由 game/index step 调用） */
export function stepPlayer(dt: number): void {
  buildSolids();

  // 移动平台携带
  if (P.plat) P.x += P.plat.dx;

  const mode = getMode();
  const ph = PHYS[mode];

  // 方向输入
  const Lf = keys.ArrowLeft || keys.KeyA;
  const Rt = keys.ArrowRight || keys.KeyD;
  const dir = (Rt ? 1 : 0) - (Lf ? 1 : 0);
  if (dir) P.face = dir;

  // 冲刺
  const spr = (keys.ShiftLeft || keys.ShiftRight) && (dir !== 0 || Math.abs(P.vx) > 2);
  if (spr && !P.wasSpr) sfx.dash();
  P.wasSpr = spr;
  P.sprint = spr;

  // 水平加速度
  const target = dir * (spr ? SPRINT : RUN);
  const acc = P.grounded ? (dir !== 0 ? 90 : 120) : ph.air;
  const dv = target - P.vx;
  const st = acc * dt;
  P.vx += Math.abs(dv) <= st ? dv : Math.sign(dv) * st;

  P.jbuf -= dt;
  P.coyote -= dt;

  // 跳跃
  const hold = keys.Space || keys.KeyW || keys.ArrowUp;
  if (P.jbuf > 0 && (P.grounded || P.coyote > 0)) {
    P.vy = ph.JV;
    P.grounded = false;
    P.coyote = 0;
    P.jbuf = 0;
    P.squash = -0.24;
    sfx.jump();
  }

  // 重力（手感优化 vs 经典）
  const gm = mode === 'tuned'
    ? (P.vy > 0 ? (hold ? 1 : 2.6) : (hold ? 1.4 : 2.2))
    : 1;
  P.vy -= ph.G * gm * dt;
  if (P.vy < -ph.MF) P.vy = -ph.MF;
  const pv = P.vy;

  // 水平碰撞
  P.x += P.vx * dt;
  for (const s of solidsNow) {
    if (boxHit(s)) {
      if (P.vx > 0) P.x = s.x - P.half;
      else if (P.vx < 0) P.x = s.x + s.w + P.half;
      else {
        const dl = P.x + P.half - s.x;
        const dr = s.x + s.w - (P.x - P.half);
        P.x += dl < dr ? -dl : dr;
      }
      P.vx = 0;
    }
  }
  P.x = clamp(P.x, P.half, MAP_W - P.half);

  // 垂直碰撞
  P.y += P.vy * dt;
  P.grounded = false;
  P.plat = null;
  for (const s of solidsNow) {
    if (boxHit(s)) {
      if (P.vy <= 0) {
        P.y = s.top + P.half;
        if (pv < -7.5) {
          dust(P.x, P.y - P.half, 6);
          sfx.land(-pv * 0.02);
          P.squash = Math.min(0.42, -pv * 0.028);
        }
        P.vy = 0;
        P.grounded = true;
        if (s.plat) P.plat = s.plat;
      } else {
        P.y = s.y - P.half;
        P.vy = 0;
      }
    }
  }

  if (P.grounded) P.coyote = ph.coy;

  P.squash *= Math.exp(-7 * dt);
  P.inv = Math.max(0, P.inv - dt);

  // 冲刺曳光
  if (P.sprint) trail.push({ x: P.x - P.face * 0.12, y: P.y, age: 0 });

  // 尖刺 / 激光 / 坠落
  if (P.inv <= 0 && !P.dead) {
    for (const s of spikes) {
      if (P.x + P.half > s.x + 0.3 && P.x - P.half < s.x + 0.7 &&
          P.y - P.half < s.y + 0.55 && P.y + P.half > s.y) {
        die(); break;
      }
    }
    if (!P.dead) {
      for (const l of lasers) {
        if (laserOn(l, gs.time) && Math.abs(P.x - l.x) < 0.56 &&
            P.y + P.half > l.y0 + 0.1 && P.y - P.half < l.y0 + l.len) {
          die(); break;
        }
      }
    }
  }
  if (!P.dead && P.y < -8) die();

  // 收集品 / 检查点 / 终点（非死亡时）
  if (!P.dead) {
    updateCollectSystem();
    updateCheckpointSystem();
    updateNovaSystem();
  }
}