/**
 * 光球收集系统 —— 通过 Collider 触发区检测玩家与光球重叠，触发收集逻辑。
 * 支持传入目标坐标（远程玩家复用本系统）。
 */
import { world } from '../../core/ecs';
import { Position } from '../../components/Position';
import { Collider } from '../../components/Collider';
import { Collectible } from '../../components/Collectible';
import { PlayerTag } from '../../components/PlayerTag';
import { gs } from '../game/gameState';
import { FX } from '../../Prefabs/Fx';
import { spawnParticles } from '../particles';
import { sfx } from '../../core/audio';
import { netBus } from '../../core/netBus';
import { pointInCollider } from '../level';

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

  const totalOrbs = world.query(Collectible).length;
  let collected = false;

  for (const e of world.query(Position, Collider, Collectible)) {
    const col = world.get<Collectible>(e, Collectible);
    if (col.collected) continue;
    if (!pointInCollider(e, px, py)) continue;

    col.collected = true;
    gs.gotN++;
    collected = true;
    const pos = world.get<Position>(e, Position);
    spawnParticles(FX.sparkle, pos.x, pos.y);
    sfx.orb();
    netBus.emit({ type: 'game:orb', count: gs.gotN, total: totalOrbs });
    if (gs.gotN === totalOrbs) {
      gs.toast = '✦ 全部 42 枚光球收集完成！';
      gs.toastT = 3;
      spawnParticles(FX.confetti, px, py);
      sfx.cp();
    }
  }

  return collected;
}