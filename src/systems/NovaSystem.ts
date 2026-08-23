/**
 * NOVA 登顶系统 —— 查询 [PlayerTag + Position, WinTrigger + Position]，
 * 检测玩家到达终点。
 */
import { world } from '../core/ecs';
import { Position } from '../components/Position';
import { WinTrigger } from '../components/WinTrigger';
import { PlayerTag } from '../components/PlayerTag';
import { gs } from './game/state';
import { confetti } from './world/particles';
import { sfx } from '../core/audio';

export function updateNovaSystem(): void {
  const player = world.queryOne(PlayerTag, Position);
  if (!player) return;
  const pp = world.get<Position>(player, Position);

  for (const e of world.query(Position, WinTrigger)) {
    const pos = world.get<Position>(e, Position);
    const wt = world.get<WinTrigger>(e, WinTrigger);
    if (wt.triggered) continue;

    const nx = pp.x - pos.x, ny = pp.y - pos.y;
    if (nx * nx + ny * ny < 1.8) {
      wt.triggered = true;
      gs.win = true;
      gs.winTime = gs.gt;
      sfx.win();
      confetti(pp.x, pp.y);
      gs.shake = 0.5;
    }
  }
}