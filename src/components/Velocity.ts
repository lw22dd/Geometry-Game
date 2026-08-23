/**
 * 速度组件 —— 水平 / 垂直速度（m/s）。
 * 本游戏坐标系：vy > 0 向上，vy < 0 向下。
 */
import type { ComponentType } from '../core/ecs';

export interface Velocity {
  vx: number;
  vy: number;
}

export const Velocity = 'Velocity' as unknown as ComponentType<Velocity>;