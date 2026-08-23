/**
 * 光球收集系统 —— 查询 [PlayerTag + Position, Collectible + Position]，
 * 检测玩家与光球距离，触发收集逻辑。
 */
import { world } from '../core/ecs';
import { Position } from '../components/Position';
import { Collectible } from '../components/Collectible';
import { PlayerTag } from '../components/PlayerTag';
import { gs } from './game/state';
import { sparkle, confetti } from './world/particles';
import { sfx } from '../core/audio';

export function updateCollectSystem(): void {
  const player = world.queryOne(PlayerTag, Position);
  if (!player) return;
  const pp = world.get<Position>(player, Position);

  const totalOrbs = world.query(Collectible).length;

  for (const e of world.query(Position, Collectible)) {
    const pos = world.get<Position>(e, Position);
    const col = world.get<Collectible>(e, Collectible);
    if (col.collected) continue;

    const dx = pp.x - pos.x, dy = pp.y - pos.y;
    if (dx * dx + dy * dy < 1.7) {
      col.collected = true;
      gs.gotN++;
      sparkle(pos.x, pos.y);
      sfx.orb();
      if (gs.gotN === totalOrbs) {
        gs.toast = '✦ 全部 42 枚光球收集完成！';
        gs.toastT = 3;
        confetti(pp.x, pp.y);
        sfx.cp();
      }
    }
  }
}