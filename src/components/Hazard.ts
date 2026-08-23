/**
 * 危险组件 —— 标记实体为危险物（激光、尖刺等）。
 * 由 HazardSystem 或 player physics 处理致死逻辑。
 */
import type { ComponentType } from '../core/ecs';

export interface Hazard {
  /** 伤害值（预留，暂未使用） */
  damage: number;
}

export const Hazard = 'Hazard' as unknown as ComponentType<Hazard>;