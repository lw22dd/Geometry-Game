/**
 * 磁铁道具系统 —— 持有「磁铁」的玩家持续吸引附近光球。
 *
 * 被动道具语义：只要背包里有 'magnet'（无时限），每物理步把半径
 * MAGNET_RADIUS 内的未收集光球沿「玩家 → 光球」方向拉近。
 * 收集本身不经本模块：光球被拉入玩家碰撞体后，由现有碰撞路由
 * （updateCollisionSystem → enter:player:pickup → CollisionHooks）自然触发，
 * 磁铁无需任何收集逻辑 —— 这也是「加道具零抄写」的一部分。
 *
 * 本地玩家与远端玩家（host 模拟）共用：远端 rp.backpack 由房主模拟维护；
 * 客机端 rp.backpack 恒为空数组 → 自动只吸引本地磁铁。
 */
import { query } from 'bitecs';
import { world, Position, Collider, Collectible, Orb } from '../../core/ecs';
import { playerController } from '../player';
import { remotes } from '../player/remote';

/** 磁铁吸引半径（格） */
export const MAGNET_RADIUS = 6;
/** 光球被吸引的移动速度（格/秒） */
export const MAGNET_PULL = 26;

/** 步进磁铁吸引（每个物理步调用一次，须早于碰撞检测） */
export function stepMagnetAttraction(dt: number): void {
  const actors: { x: number; y: number }[] = [];
  const local = playerController.getState();
  if (!local.dead && local.backpack.includes('magnet')) actors.push(local);
  for (const [, rp] of remotes) {
    if (!rp.dead && rp.backpack.includes('magnet')) actors.push(rp);
  }
  if (actors.length === 0) return;

  const r2 = MAGNET_RADIUS * MAGNET_RADIUS;
  for (const e of query(world, [Position, Collider, Collectible, Orb])) {
    if (Collectible.collected[e] === 1) continue;
    let bx = 0, by = 0, bd = r2, found = false;
    for (const a of actors) {
      const dx = a.x - Position.x[e];
      const dy = a.y - Position.y[e];
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; bx = dx; by = dy; found = true; }
    }
    if (!found) continue;
    const dist = Math.sqrt(bd);
    const pull = Math.min(MAGNET_PULL * dt, dist); // 不越过玩家
    if (dist > 1e-6) {
      Position.x[e] += (bx / dist) * pull;
      Position.y[e] += (by / dist) * pull;
    }
  }
}
