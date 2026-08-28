/**
 * 终点登顶系统 —— 通过 Collider 触发区检测玩家到达终点。
 */
import { world, Position, Collider, Goal, qGoal } from '../../core/ecs';
import { gs } from '../game/gameState';
import { playerController } from '../player';
import { FX } from '../../Prefabs/Fx';
import { spawnParticles } from '../particles';
import { sfx } from '../../core/audio';
import { netBus } from '../../core/netBus';
import { room } from '../../net/room';
import { pointInCollider } from '../level';
import { orbCount } from './ItemPickupSystem';

export function updateGoalSystem(): boolean {
  const pp = playerController.getState();

  for (const e of qGoal()) {
    if (Goal.triggered[e]) continue;
    if (!pointInCollider(e, pp.x, pp.y)) continue;

    Goal.triggered[e] = 1;
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