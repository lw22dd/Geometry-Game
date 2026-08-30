/**
 * 抛体系统（S2）—— 手雷的抛物线物理 + 引信 + 爆炸圆判定。
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
import type { WeaponDef } from '../../config/weapons';
import { dealDamage } from './damage';
import { killEnemy } from '../enemy';
import { getSolids } from '../player';
import { spawnParticles } from '../particles';
import { FX } from '../../Prefabs/Fx';
import { sfx } from '../../core/audio';
import { gs } from '../game/gameState';
import { VIS } from '../../config';
import { sx, sy, view } from '../../core/camera';
import { ctx, VW } from '../../core/canvas';
import { drawGrenadeIcon } from '../ui/icons';

/** 世界 X → 声像 -1..1 */
function panOfX(worldX: number): number {
  const q = (sx(worldX) / VW - 0.5) * 1.4;
  return q < -1 ? -1 : q > 1 ? 1 : q;
}

/**
 * 投掷手雷：创建抛体实体（Position + Projectile）。
 * @param p 投掷者玩家状态（提供出生位置）
 * @param dir 发射方向（单位向量）
 * @param def 武器定义（取 projectile 参数 + damage/knockback）
 */
export function spawnGrenade(p: PlayerState, dir: Vector2, def: WeaponDef): number {
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
  return e;
}

/** 抛体是否与当前固体重叠（提前引爆：撞墙/撞地立即爆炸） */
function hitsSolid(x: number, y: number): boolean {
  for (const s of getSolids()) {
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.top) return true;
  }
  return false;
}

/** 爆炸：半径圆判定 → 范围内敌人 dealDamage + 玩家击退，随后移除实体 */
function explode(e: number): void {
  const x = Position.x[e];
  const y = Position.y[e];
  const radius = Projectile.blastRadius[e];
  const dmg = Projectile.damage[e];

  // 特效 + 音效 + 震屏（表现层，调用方进程内播放）
  spawnParticles(FX.grenadeBoom, x, y);
  spawnParticles(FX.grenadeShock, x, y);
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
        source: 'grenade',
        knockback: { x: Math.sign(dx) * 4, y: 3 },
      }, {
        onEntityKilled: (eid) => killEnemy(eid),
      });
    }
  }

  removeEntity(world, e);
}

/**
 * 抛体步进（固定物理步调用）：抛物线积分 + 引信递减 + 撞固体提前引爆。
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
    // 撞固体（墙/地）提前引爆
    if (Projectile.fuse[e] <= 0 || hitsSolid(Position.x[e], Position.y[e])) {
      explode(e);
    }
  }
}

/**
 * 绘制全部抛体（手雷本体）：按速度方向旋转、带引信残留时的警示光。
 * 渲染帧调用；只读 Position/Projectile，纯表现无副作用。
 */
export function drawProjectiles(): void {
  for (const e of qProjectiles()) {
    const px = sx(Position.x[e]);
    if (px < -60 || px > VW + 60) continue;
    const py = sy(Position.y[e]);
    const R = 0.26 * view.SZ; // 手雷世界半径 0.26 格

    ctx.save();
    ctx.translate(px, py);
    // 轻微翻滚（引信大体朝上，不随速度硬转向，避免拉环颠倒）
    const wob = Math.sin(gs.time * 10 + e * 1.7) * 0.5;
    ctx.rotate(wob);
    drawGrenadeIcon(0, 0, R * 1.55);
    ctx.restore();
  }
}

/** 清空全部抛体（切图重建用，applyLevel 调用） */
export function clearProjectiles(): void {
  for (const e of qProjectiles()) {
    if (hasComponent(world, e, Projectile)) removeEntity(world, e);
  }
}