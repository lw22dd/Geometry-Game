/**
 * 光球收集系统 —— 通过坐标检测玩家与光球重叠（远程玩家 host 模拟复用；
 * 本地玩家走 CollisionSystem + CollisionHooks 的 enter:player:pickup）。
 * 光球为通用 Collectible(kind='orb')；计数用共享 orbCount()。
 */
import { world } from '../../core/ecs';
import { Position } from '../../components/physics/Position';
import { Collider } from '../../components/physics/Collider';
import { Collectible } from '../../components/gameplay/Collectible';
import { PlayerTag } from '../../components/gameplay/PlayerTag';
import { gs } from '../game/gameState';
import { FX } from '../../Prefabs/Fx';
import { spawnParticles } from '../particles';
import { sfx } from '../../core/audio';
import { netBus } from '../../core/netBus';
import { pointInCollider } from '../level';
import { orbCount } from './ItemPickupSystem';

/**
 * 光球收集检测。
 * @param tx 目标 X（可选；缺省时查询本地玩家实体）
 * @param ty 目标 Y（可选；缺省时查询本地玩家实体）
 * @returns 本次是否收集到光球
 */
export function updateCollectSystem(tx?: number, ty?: number): boolean {
  let px: number, py: number;
  if (tx !== undefined && ty !== undefined) {
    px = tx; py = ty;
  } else {
    const player = world.queryOne(PlayerTag, Position);
    if (!player) return false;
    const pp = world.get<Position>(player, Position);
    px = pp.x; py = pp.y;
  }

  const totalOrbs = orbCount();

  for (const e of world.query(Position, Collider, Collectible)) {
    const col = world.get<Collectible>(e, Collectible);
    if (col.kind !== 'orb' || col.collected) continue;
    if (!pointInCollider(e, px, py)) continue;

    col.collected = true;
    gs.gotN++;
    const pos = world.get<Position>(e, Position);
    spawnParticles(FX.sparkle, pos.x, pos.y);
    sfx.orb();
    netBus.emit({ type: 'game:orb', count: gs.gotN, total: totalOrbs });
    if (gs.gotN === totalOrbs) {
      gs.toast = '✦ 全部 ' + totalOrbs + ' 枚光球收集完成！';
      gs.toastT = 3;
      spawnParticles(FX.confetti, pos.x, pos.y);
      sfx.cp();
    }
    return true;
  }

  return false;
}