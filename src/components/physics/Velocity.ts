/**
 * 速度组件 —— 速度矢量（格/秒）。
 * 本游戏坐标系：value.y > 0 向上，value.y < 0 向下。
 * @category 物理/运动
 */
import type { ComponentType } from '../../core/ecs';
import type { Vector2 } from '../../types';

export interface Velocity {
  /** 速度矢量（格/秒） */
  velocity: Vector2;
}

export const Velocity = 'Velocity' as unknown as ComponentType<Velocity>;