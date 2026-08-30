/**
 * 武器系统（S2）—— 开火节流 / 散布 / 弹匣 / 换弹 / hitscan 命中结算。
 *
 * 本地玩家与房主模拟的远端玩家统一走 stepWeapon（tick 管线内调用），
 * 与玩家物理 / 主动道具（钩锁）同一次步进。目标是「武器代码只写一次」。
 *
 * hitscan（AK）：开火帧 raycastWorld（固体 + 敌人）→ 最近命中 → dealDamage
 *   + 枪口火光 + 曳光 + 命中火花。
 * 副武器（手雷）：右键 edge 投掷 → projectile.ts 生成抛体实体（抛物线由 Projectile 步进）。
 *
 * 伤害权威：玩家侧由目标自己的结算管线裁决；敌人由 Health 管线裁决。
 * 本地命中表现（火光/曳光/音效）只在 isLocal 时播放，避免房主替远端玩家出声。
 */
import { hasComponent } from 'bitecs';
import type { InputKeys, PlayerState, Vector2 } from '../../types';
import { world, EnemyBrain, qDamageable } from '../../core/ecs';
import { WEAPONS, type WeaponDef } from '../../config/weapons';
import { getSolids } from '../player';
import { colliderWorldRect } from '../level';
import { dealDamage } from './damage';
import { raycastWorld, segRectT } from './raycast';
import { spawnGrenade } from './projectile';
import { killEnemy } from '../enemy';
import { spawnParticles } from '../particles';
import { FX } from '../../Prefabs/Fx';
import { sfx } from '../../core/audio';
import { ctx, VW } from '../../core/canvas';
import { sx, sy, view } from '../../core/camera';
import { netBus } from '../../core/netBus';

/** 武器步进上下文 */
export interface WeaponStepCtx {
  dt: number;
  /** 瞄准方向（单位向量；本地 = 鼠标引导，远端 = 客机上报 aim） */
  aim: { x: number; y: number };
  /** 本地玩家：播放音效/粒子；远端（房主模拟）静默 */
  isLocal: boolean;
}

/* ==================== 曳光 ==================== */

/** 曳光（短暂直线）：由 hitscan 开火帧生成，纯表现，不进 ECS */
export interface Tracer {
  x1: number; y1: number; x2: number; y2: number;
  age: number; life: number;
}

const tracers: Tracer[] = [];

/** 步进曳光（游戏 step 调用） */
export function stepTracers(dt: number): void {
  for (let i = tracers.length - 1; i >= 0; i--) {
    tracers[i].age += dt;
    if (tracers[i].age >= tracers[i].life) tracers.splice(i, 1);
  }
}

/** 绘制曳光（渲染帧；lighter 叠加淡出线） */
export function drawTracers(): void {
  if (tracers.length === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const tr of tracers) {
    const a = 1 - tr.age / tr.life;
    if (a <= 0) continue;
    ctx.globalAlpha = a * 0.9;
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ffcf5a';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(sx(tr.x1), sy(tr.y1));
    ctx.lineTo(sx(tr.x2), sy(tr.y2));
    ctx.stroke();
  }
  ctx.restore();
}

/* ==================== 输入边沿追踪 ==================== */

/** 每玩家上次输入状态（换弹/主武器按下沿检测；key = PlayerState 对象身份） */
const prevInput = new WeakMap<object, { reload: boolean; fire: boolean }>();

/* ==================== 开火 ==================== */

/** 开火曳光表现（模拟端 / 客机 fx_shot 广播端共用；纯表现，最短寿命） */
export function spawnShotTracer(x1: number, y1: number, x2: number, y2: number): void {
  tracers.push({ x1, y1, x2, y2, age: 0, life: 0.12 });
}

/** 开火反馈（纯表现）：枪口火光 + 射击音 + 命中火花（本地开火帧 / 客机广播补播共用） */
export function spawnShotFeedback(mx: number, my: number, hitX: number, hitY: number, hitApplied: boolean): void {
  spawnParticles(FX.muzzleFlash, mx, my);
  sfx.shot({ pan: panOfX(mx) });
  if (hitApplied) {
    spawnParticles(FX.hitSpark, hitX, hitY);
    sfx.hit({ pan: panOfX(hitX) });
  }
}

/** 玩家 → 枪口世界坐标（中心沿瞄准方向前推 half） */
function muzzlePos(p: PlayerState, dir: Vector2): { x: number; y: number } {
  return { x: p.x + dir.x * (p.half + 0.08), y: p.y + dir.y * (p.half + 0.08) };
}

/** 散布：瞄准方向绕随机角度 ±spread */
function spreadDir(aim: Vector2, spread: number): Vector2 {
  if (spread <= 0) return aim;
  const a = Math.atan2(aim.y, aim.x) + (Math.random() * 2 - 1) * spread;
  return { x: Math.cos(a), y: Math.sin(a) };
}

/**
 * hitscan 开火：raycastWorld（固体最近 → 敌人最近）取更近者。
 * 命中敌人 → dealDamage + 命中火花；命中/射空 → 曳光到命中点或射程末端。
 */
function fireHitscan(p: PlayerState, def: WeaponDef, ctx: WeaponStepCtx): void {
  const dir = spreadDir(ctx.aim, def.spread);
  const m = muzzlePos(p, dir);

  // 1) 固体：最近命中 t（无 = 射程末端 t=1）
  const wallHit = raycastWorld(m.x, m.y, dir.x, dir.y, def.range, getSolids());
  const wallT = wallHit ? wallHit.t : 1;

  // 2) 敌人：逐个 AABB 求最近命中 t
  let bestEnemy: { eid: number; t: number } | null = null;
  for (const e of qDamageable()) {
    if (!hasComponent(world, e, EnemyBrain)) continue; // 只打敌人
    const r = colliderWorldRect(e);
    const h = segRectT(m.x, m.y, dir.x * def.range, dir.y * def.range, r);
    if (h && (bestEnemy === null || h.t < bestEnemy.t)) bestEnemy = { eid: e, t: h.t };
  }

  const hitT = bestEnemy && bestEnemy.t < wallT ? bestEnemy.t : wallT;
  const hitX = m.x + dir.x * def.range * hitT;
  const hitY = m.y + dir.y * def.range * hitT;

  // 曳光：模拟端可见（本地玩家 / 房主替远端模拟）；对端经 fx:shot 广播补播
  spawnShotTracer(m.x, m.y, hitX, hitY);

  // 伤害结算（目标侧裁决；结果供表现分流）
  let hitApplied = false;
  if (bestEnemy && bestEnemy.t < wallT) {
    const r = dealDamage(bestEnemy.eid, {
      amount: def.damage,
      source: 'ak',
      knockback: def.knockback,
    }, {
      onEntityKilled: (eid) => killEnemy(eid),
    });
    hitApplied = r.applied;
  }

  // 本地反馈 + 广播（本地才播粒子/音效，避免房主替远端玩家出声；房主广播给客机补播）
  if (ctx.isLocal) {
    spawnShotFeedback(m.x, m.y, hitX, hitY, hitApplied);
    netBus.emit({ type: 'fx:shot', mx: m.x, my: m.y, hitX, hitY, hit: hitApplied });
  }
}

/** 手雷投掷：生成抛体实体（抛物线 + 引信 + 爆炸在 projectile.ts 步进） */
function throwGrenade(p: PlayerState, def: WeaponDef, ctx: WeaponStepCtx): void {
  const dir = spreadDir(ctx.aim, def.spread);
  spawnGrenade(p, dir, def);
  if (ctx.isLocal) {
    sfx.grenadeThrow({ pan: panOfX(p.x) });
  }
}

/** 世界 X → 声像 -1..1（按事件在屏幕上的左右位置映射） */
function panOfX(worldX: number): number {
  const q = (sx(worldX) / VW - 0.5) * 1.4;
  return q < -1 ? -1 : q > 1 ? 1 : q;
}

/* ==================== 主入口 ==================== */

/**
 * 步进玩家武器（tick 管线调用；本地 + 房主模拟远端共用）。
 * 顺序：冷却/换弹递减 → 换弹（R 按下沿）→ 主武器开火（按住，auto）→ 手雷（左键按下沿）。
 */
export function stepWeapon(p: PlayerState, input: InputKeys, ctx: WeaponStepCtx): void {
  // 边沿：换弹 / 主武器（手雷走左键按下沿，与钩锁 hookEdge 同模式）
  const prev = prevInput.get(p) ?? { reload: false, fire: false };
  const reloadEdge = input.reload && !prev.reload;
  const fireEdge = input.fire && !prev.fire;
  prevInput.set(p, { reload: input.reload, fire: input.fire });

  // 死亡时不操作武器
  if (p.dead) return;

  // 开火冷却递减（主武器节流；副武器共用 tick）
  p.fireCd = Math.max(0, p.fireCd - ctx.dt);

  // 武器均为主动道具：只有在背包中"持有"（选中对应槽位）才能使用，语义与钩锁一致。
  const held = p.backpack[p.selectedSlot];

  // ── 主武器 AK：选中 ak 槽位（持有）才可开火 / 换弹 ──
  if (held === 'ak' && p.weapon === 'ak') {
    const def = WEAPONS.ak;

    // 换弹完成判定：上一帧在换弹中且本帧计时归零 → 弹匣补满
    // （必须在递减前记录 wasReloading，否则无法区分"刚归零"与"本来为 0"）
    const wasReloading = p.reloadT > 0;
    p.reloadT = Math.max(0, p.reloadT - ctx.dt);
    if (wasReloading && p.reloadT === 0) {
      p.ammo = def.ammo;
    }

    // 换弹（R 按下沿 + 弹匣未满 + 未在换弹）
    if (reloadEdge && p.reloadT <= 0 && p.ammo < def.ammo) {
      p.reloadT = def.reloadTime;
      if (ctx.isLocal) sfx.reload({ pan: panOfX(p.x) });
    }

    // 开火：按住 + 冷却就绪 + 未换弹 + 有弹
    if (input.fire && p.fireCd <= 0 && p.reloadT <= 0) {
      if (p.ammo > 0) {
        p.ammo--;
        p.fireCd = 1 / def.rate;
        if (def.kind === 'hitscan') fireHitscan(p, def, ctx);
        else throwGrenade(p, def, ctx);
      } else {
        // 空膛自动换弹（与 R 手动换弹同路径）
        p.reloadT = def.reloadTime;
      }
    }
  }

  // ── 手雷（选中 grenade 槽位 + 左键按下沿 + 未换弹）──
  // 左键语义按选中槽位分发：AK=按住开火（上文），手雷=按下沿投掷（此处），钩锁=发射（canHook 独占）
  if (held === 'grenade' && fireEdge && p.hasGrenade && p.reloadT <= 0) {
    throwGrenade(p, WEAPONS.grenade, ctx);
  }
}