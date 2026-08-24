/**
 * 位置组件 —— 世界坐标（格）。
 * @category 物理/运动
 */
import type { ComponentType } from '../../core/ecs';

export interface Position {
  x: number;
  y: number;
}

/** 运行时类型标识 */
export const Position = 'Position' as unknown as ComponentType<Position>;