/**
 * 路径运动系统 —— 更新所有 Position + PathMotion 实体的位置。
 * 支持正弦路径运动（移动平台）：水平往返（axis='x'）/ 垂直升降（axis='y'，电梯）。
 */
import { world } from '../../core/ecs';
import { Position } from '../../components/Position';
import { PathMotion } from '../../components/PathMotion';
import { gs } from '../game/gameState';

export function updateMotion(): void {
  for (const e of world.query(Position, PathMotion)) {
    const pos = world.get<Position>(e, Position);
    const pm = world.get<PathMotion>(e, PathMotion);
    if (pm.axis === 'y') {
      // 垂直升降：以 y0 为基线上下摆动 yRange
      const ny = pm.y0 + (Math.sin(gs.time * pm.spd + pm.ph) * 0.5 + 0.5) * pm.yRange;
      pm.dy = ny - pos.y;
      pm.dx = 0;
      pos.y = ny;
    } else {
      // 水平往返：x0 → x0 + range
      const nx = pm.x0 + (Math.sin(gs.time * pm.spd + pm.ph) * 0.5 + 0.5) * pm.range;
      pm.dx = nx - pos.x;
      pm.dy = 0;
      pos.x = nx;
    }
  }
}