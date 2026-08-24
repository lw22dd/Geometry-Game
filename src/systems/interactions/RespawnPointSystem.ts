/**
 * 复活点激活系统 —— 通过 Collider 触发区检测玩家靠近未激活的复活点并激活。
 * 支持传入目标坐标（远程玩家复用本系统）。
 */
import { world } from '../../core/ecs';
import { Position } from '../../components/Position';
import { Collider } from '../../components/Collider';
import { RespawnPoint } from '../../components/RespawnPoint';
import { PlayerTag } from '../../components/PlayerTag';
import { cpPoint } from '../../config';
import { FX } from '../../Prefabs/Fx';
import { spawnParticles } from '../particles';
import { sfx } from '../../core/audio';
import { netBus } from '../../core/netBus';
import { pointInCollider } from '../level';

/**
 * 复活点激活检测。
 * @param tx 目标 X（可选；缺省时查询本地玩家实体）
 * @param ty 目标 Y（可选；缺省时查询本地玩家实体）
 * @returns 本次激活的复活点坐标；未激活返回 null
 */
export function updateRespawnPointSystem(tx?: number, ty?: number): { x: number; y: number } | null {
  let px: number, py: number;
  if (tx !== undefined && ty !== undefined) {
    px = tx; py = ty;
  } else {
    const player = world.queryOne(PlayerTag, Position);
    if (!player) return null;
    const pp = world.get<Position>(player, Position);
    px = pp.x; py = pp.y;
  }

  for (const e of world.query(Position, Collider, RespawnPoint)) {
    const rp = world.get<RespawnPoint>(e, RespawnPoint);
    if (rp.active) continue;
    if (!pointInCollider(e, px, py)) continue;

    rp.active = true;
    const pos = world.get<Position>(e, Position);
    cpPoint.x = pos.x;
    cpPoint.y = pos.y;
    spawnParticles(FX.cp, pos.x, pos.y);
    sfx.cp();
    netBus.emit({ type: 'game:checkpoint', x: pos.x, y: pos.y });
    return { x: pos.x, y: pos.y };
  }

  return null;
}