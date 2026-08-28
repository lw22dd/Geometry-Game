/**
 * 路径运动系统 —— 更新所有 Position + PathMotion 实体的位置。
 * 支持正弦路径运动（移动平台）：水平往返（axis=0 'x'）/ 垂直升降（axis=1 'y'，电梯）。
 * 数据源：新 ECS。
 */
import { qMovers } from '../../core/ecs';
import { Position, PathMotion } from '../../core/ecs';
import { gs } from '../game/gameState';

export function updateMotion(): void {
  for (const e of qMovers()) {
    if (PathMotion.axis[e] === 1) {
      // 垂直升降：以 y0 为基线上下摆动 yRange
      const ny = PathMotion.y0[e] + (Math.sin(gs.time * PathMotion.spd[e] + PathMotion.ph[e]) * 0.5 + 0.5) * PathMotion.yRange[e];
      PathMotion.dy[e] = ny - Position.y[e];
      PathMotion.dx[e] = 0;
      Position.y[e] = ny;
    } else {
      // 水平往返：x0 → x0 + range
      const nx = PathMotion.x0[e] + (Math.sin(gs.time * PathMotion.spd[e] + PathMotion.ph[e]) * 0.5 + 0.5) * PathMotion.range[e];
      PathMotion.dx[e] = nx - Position.x[e];
      PathMotion.dy[e] = 0;
      Position.x[e] = nx;
    }
  }
}
