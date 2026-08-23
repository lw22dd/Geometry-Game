/**
 * 终点登顶系统 —— 通过 Collider 触发区检测玩家到达终点。
 */
import { world } from '../../core/ecs';
import { Position } from '../../components/Position';
import { Collider } from '../../components/Collider';
import { Goal } from '../../components/Goal';
import { Collectible } from '../../components/Collectible';
import { PlayerTag } from '../../components/PlayerTag';
import { gs } from '../game/state';
import { spawnFx, FX } from '../../Prefabs/Fx';
import { sfx } from '../../core/audio';
import { netBus } from '../../core/netBus';
import { pointInCollider } from '../level';

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
    spawnFx(FX.confetti, pp.x, pp.y);
    gs.shake = 0.5;
    netBus.emit({ type: 'game:win', time: gs.winTime, orbs: gs.gotN, total: world.query(Collectible).length });
    return true;
  }

  return false;
}