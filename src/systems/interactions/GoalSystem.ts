/**
 * 终点登顶系统 —— 通过 Collider 触发区检测玩家到达终点。
 */
import { world } from '../../core/ecs';
import { Position } from '../../components/physics/Position';
import { Collider } from '../../components/physics/Collider';
import { Goal } from '../../components/gameplay/Goal';
import { Collectible } from '../../components/gameplay/Collectible';
import { PlayerTag } from '../../components/gameplay/PlayerTag';
import { gs } from '../game/gameState';
import { FX } from '../../Prefabs/Fx';
import { spawnParticles } from '../particles';
import { sfx } from '../../core/audio';
import { netBus } from '../../core/netBus';
import { room } from '../../net/room';
import { pointInCollider } from '../level';
import { orbCount } from './ItemPickupSystem';

export function updateGoalSystem(): boolean {
  const player = world.queryOne(PlayerTag, Position);
  if (!player) return false;
  const pp = world.get<Position>(player, Position);

  for (const e of world.query(Position, Collider, Goal)) {
    const goal = world.get<Goal>(e, Goal);
    if (goal.triggered) continue;
    if (!pointInCollider(e, pp.x, pp.y)) continue;

    goal.triggered = true;
    gs.win = true;
    gs.winTime = gs.gt;
    sfx.win();
    spawnParticles(FX.confetti, pp.x, pp.y);
    gs.shake = 0.5;
    netBus.emit({ type: 'game:win', time: gs.winTime, orbs: gs.gotN, total: orbCount(), x: pp.x, y: pp.y, playerId: room.playerId });
    return true;
  }

  return false;
}