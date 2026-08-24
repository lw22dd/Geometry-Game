/**
 * 终点组件 —— 标记实体为关卡终点（NOVA 星）。
 * 由 GoalSystem 在玩家进入触发区时更新 triggered。
 * @category 玩法/交互
 */
import type { ComponentType } from '../../core/ecs';

export interface Goal {
  triggered: boolean;
}

export const Goal = 'Goal' as unknown as ComponentType<Goal>;