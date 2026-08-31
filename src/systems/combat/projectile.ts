/**
 * 抛体系统（S2/S8）—— 手雷 / 火箭筒 / 冰冻炸弹的物理 + 引信 + 爆炸圆判定。
 *
 * 弹种由 Projectile.source（weaponToCode 编码）区分：
 *  - grenade：抛物线（重力）+ 引信爆炸
 *  - rocket：直线弹道（重力 0）+ 超 maxRange 消失（超出范围子弹消失）+ 撞墙/撞敌人爆炸
 *  - iceBomb：与手雷一致抛物线 + 引信爆炸 + 爆炸给范围内敌人施加减速（冰冻）
 *
 * 与玩家物理解耦：抛体走独立的逐物理步积分（初速 + 重力），不参与玩家碰撞引擎。
 * 引信 = Projectile.fuse 递减（复用 Timer 的计时语义，独立字段避免与激光周期混淆）。
 * 爆炸：半径圆内所有 qDamageable（敌人/可摧毁物）→ dealDamage + 击退 + 特效 + 音效。
 * 敌人击杀回调 → killEnemy（systems/enemy，含死亡广播）。
 *
 * 联机权威：抛体由「发起玩家」所在进程步进（本地预测 / 房主模拟远端），
 * 爆炸对玩家的伤害结算由目标侧结算管线裁决（与既有伤害权威一致）。
 */
import { addEntity, addComponent, removeEntity, hasComponent } from 'bitecs';
import type { PlayerState, Vector2 } from '../../types';
import { world, Position, Projectile, qProjectiles, qDamageable, EnemyBrain } from '../../core/ecs';
import type { EnemyState } from '../../Prefabs/Enemy';
import { weaponToCode } from '../../config/weapons';
import type { WeaponDef } from '../../config/weapons';
import { dealDamage } from './damage';
import { killEnemy } from '../enemy';
import { getSolids } from '../player';
import { colliderWorldRect } from '../level';
import { spawnParticles } from '../particles';
import { FX } from '../../Prefabs/Fx';
import { sfx } from '../../core/audio';
import { gs } from '../game/gameState';
import { VIS } from '../../config';
import { sx, sy, view, panOfX } from '../../core/camera';
import { ctx, VW } from '../../core/canvas';
import { drawWeaponIcon } from '../ui/icons';

/** 弹种编码（source 写入用） */
const SRC_GRENADE = weaponToCode('grenade');
const SRC_ROCKET = weaponToCode('rocket');
const SRC_ICEBOMB = weaponToCode('iceBomb');

/**
 * 生成抛体实体（Position + Projectile）—— 手雷 / 火箭筒 / 冰冻炸弹共用。
 * @param p 发射者玩家状态（提供出生位置）
 * @param dir 发射方向（单位向量）
 * @param def 武器定义（取 projectile 参数 + damage/knockback）
 */
export function spawnProjectile(p: PlayerState, dir: Vector2, def: WeaponDef): number {
  const pr = def.projectile!;
  const e = addEntity(world);
  addComponent(world, e, Position);
  Position.x[e] = p.x + dir.x * (p.half + 0.1);
  Position.y[e] = p.y + dir.y * (p.half + 0.1);
  addComponent(world, e, Projectile);
  Projectile.vx[e] = dir.x * pr.speed;
  Projectile.vy[e] = dir.y * pr.speed;
  Projectile.gravity[e] = pr.gravity;
  Projectile.fuse[e] = pr.fuse;
  Projectile.blastRadius[e] = pr.blastRadius;
  Projectile.damage[e] = def.damage;
  Projectile.maxRange[e] = pr.maxRange ?? 0;
  Projectile.traveled[e] = 0;
  Projectile.source[e] = weaponToCode(def.id);
  Projectile.slowFactor[e] = pr.slowFactor ?? 1;
  Projectile.slowDur[e] = pr.slowDur ?? 0;
  return e;
}

/** 兼容旧命名（weapon.ts 既有调用方；返回同 spawnProjectile） */
export function spawnGrenade(p: PlayerState, dir: Vector2, def: WeaponDef): number {
  return spawnProjectile(p, dir, def);
}

/** 抛体是否与当前固体重叠（提前引爆：撞墙/撞地立即爆炸） */
function hitsSolid(x: number, y: number): boolean {
  for (const s of getSolids()) {
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.top) return true;
  }
  return false;
}

/** 直射类（火箭筒）是否撞到敌人：命中点在某敌人 AABB 内 → 提前爆炸 */
function hitsEnemy(x: number, y: number): boolean {
  for (const t of qDamageable()) {
    if (!hasComponent(world, t, EnemyBrain)) continue;
    const r = colliderWorldRect(t);
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.top) return true;
  }
  return false;
}

/** 给敌人施加减速（冰冻炸弹命中）：写入 EnemyBrain 侧表的慢速计时（共享状态 st.slow） */
function applySlowToEnemy(eid: number, slowFactor: number, slowDur: number): void {
  const st = EnemyBrain[eid].state as EnemyState;
  st.slow = { t: Math.max(st.slow?.t ?? 0, slowDur), f: slowFactor };
}

/** 爆炸：弹种分发特效/音效 + 半径圆敌人结算 → 随后移除实体 */
function explode(e: number): void {
  const x = Position.x[e];
  const y = Position.y[e];
  const radius = Projectile.blastRadius[e];
  const dmg = Projectile.damage[e];
  const source = Projectile.source[e];
  const slowF = Projectile.slowFactor[e];
  const slowDur = Projectile.slowDur[e];
  const isIce = source === SRC_ICEBOMB;

  // 特效 + 音效 + 震屏（表现层，调用方进程内播放；弹种分发）
  if (isIce) {
    spawnParticles(FX.iceBoom, x, y);
    spawnParticles(FX.iceShock, x, y);
  } else {
    spawnParticles(FX.grenadeBoom, x, y);
    spawnParticles(FX.grenadeShock, x, y);
  }
  sfx.explosion({ pan: panOfX(x) });
  gs.shake = Math.max(gs.shake, VIS.screen.shieldShake * 0.8);

  // 敌人 / 可摧毁物：半径圆内结算（onEntityKilled → 敌人死亡广播 + 移除）
  for (const t of qDamageable()) {
    if (!hasComponent(world, t, EnemyBrain)) continue; // 只炸敌人
    const dx = Position.x[t] - x;
    const dy = Position.y[t] - y;
    if (dx * dx + dy * dy <= radius * radius) {
      dealDamage(t, {
        amount: dmg,
        source: source === SRC_ROCKET ? 'rocket' : source === SRC_ICEBOMB ? 'iceBomb' : 'grenade',
        knockback: { x: Math.sign(dx) * 4, y: 3 },
      }, {
        onEntityKilled: (eid) => killEnemy(eid),
      });
      // 冰冻炸弹：命中后施加减速（积分到 EnemyController 速度计算）
      if (isIce && (slowF ?? 1) < 1 && slowDur > 0) applySlowToEnemy(t, slowF, slowDur);
    }
  }

  removeEntity(world, e);
}

/**
 * 抛体步进（固定物理步调用）：抛物线积分 + 引信递减 + 撞固体/撞敌人提前引爆。
 * 火箭筒（maxRange>0）：累计飞行距离，超出 maxRange 即消失（超出范围子弹消失，无爆炸）。
 * 表现层（爆炸特效/音效/震屏）由各端本地播发，伤害裁决由目标侧结算管线完成。
 */
export function stepProjectiles(dt: number): void {
  for (const e of qProjectiles()) {
    // 引信
    Projectile.fuse[e] -= dt;
    // 积分（重力向下加速）
    Projectile.vy[e] -= Projectile.gravity[e] * dt;
    Position.x[e] += Projectile.vx[e] * dt;
    Position.y[e] += Projectile.vy[e] * dt;
    // 直线类：累计飞行距离
    if (Projectile.maxRange[e] > 0) {
      const sp = Math.hypot(Projectile.vx[e], Projectile.vy[e]);
      Projectile.traveled[e] += sp * dt;
    }
    // 火箭筒超射程 → 直接消失（超出范围子弹消失）
    if (Projectile.maxRange[e] > 0 && Projectile.traveled[e] >= Projectile.maxRange[e]) {
      removeEntity(world, e);
      continue;
    }
    // 撞墙/撞地提前引爆；火箭筒额外撞敌人引爆
    const hitWall = hitsSolid(Position.x[e], Position.y[e]);
    const hitEnemy = Projectile.source[e] === SRC_ROCKET && hitsEnemy(Position.x[e], Position.y[e]);
    if (Projectile.fuse[e] <= 0 || hitWall || hitEnemy) {
      explode(e);
    }
  }
}

/**
 * 绘制全部抛体（手雷 / 火箭筒 / 冰冻炸弹本体）：按弹种分发图标 + 飞行朝向旋转。
 * 渲染帧调用；只读 Position/Projectile，纯表现无副作用。
 */
export function drawProjectiles(): void {
  for (const e of qProjectiles()) {
    const px = sx(Position.x[e]);
    if (px < -60 || px > VW + 60) continue;
    const py = sy(Position.y[e]);
    const R = 0.26 * view.SZ; // 抛体世界半径 0.26 格
    const source = Projectile.source[e];

    ctx.save();
    ctx.translate(px, py);
    // 火箭筒朝速度方向旋转；其余（手雷/冰冻炸弹）保留微小翻滚凸显引信
    if (source === SRC_ROCKET) {
      const ang = Math.atan2(-Projectile.vy[e], Projectile.vx[e]);
      ctx.rotate(ang);
    } else {
      const wob = Math.sin(gs.time * 10 + e * 1.7) * 0.5;
      ctx.rotate(wob);
    }
    drawWeaponIcon(0, 0, R * 1.4, source === SRC_ROCKET ? 'rocket' : source === SRC_ICEBOMB ? 'iceBomb' : 'grenade');
    ctx.restore();
  }
}

/** 清空全部抛体（切图重建用，applyLevel 调用） */
export function clearProjectiles(): void {
  for (const e of qProjectiles()) {
    if (hasComponent(world, e, Projectile)) removeEntity(world, e);
  }
}