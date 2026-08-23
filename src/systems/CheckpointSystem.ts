/**
 * 检查点激活系统 —— 查询 [PlayerTag + Position, Checkpoint + Position]，
 * 检测玩家靠近未激活的检查点并激活。
 */
import { world } from '../core/ecs';
import { Position } from '../components/Position';
import { Checkpoint } from '../components/Checkpoint';
import { PlayerTag } from '../components/PlayerTag';
import { cpPoint } from '../config';
import { cpFx } from './world/particles';
import { sfx } from '../core/audio';

export function updateCheckpointSystem(): void {
  const player = world.queryOne(PlayerTag, Position);
  if (!player) return;
  const pp = world.get<Position>(player, Position);

  for (const e of world.query(Position, Checkpoint)) {
    const pos = world.get<Position>(e, Position);
    const cp = world.get<Checkpoint>(e, Checkpoint);
    if (cp.active) continue;

    if (Math.abs(pp.x - pos.x) < 1.1 && pp.y < pos.y + 2.4 && pp.y > pos.y - 1) {
      cp.active = true;
      cpPoint.x = pos.x;
      cpPoint.y = pos.y;
      cpFx({ x: pos.x, y: pos.y });
      sfx.cp();
    }
  }
}