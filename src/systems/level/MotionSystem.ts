/**
 * 路径运动系统 —— 更新所有 Position + PathMotion 实体的位置。
 * 支持正弦路径运动（移动平台）。
 */
import { world } from '../../core/ecs';
import { Position } from '../../components/Position';
import { PathMotion } from '../../components/PathMotion';
import { gs } from '../game/gameState';

export function updateMotion(): void {
  for (const e of world.query(Position, PathMotion)) {
    const pos = world.get<Position>(e, Position);
    const pm = world.get<PathMotion>(e, PathMotion);
    const nx = pm.x0 + (Math.sin(gs.time * pm.spd + pm.ph) * 0.5 + 0.5) * pm.range;
    pm.dx = nx - pos.x;
    pos.x = nx;
  }
}