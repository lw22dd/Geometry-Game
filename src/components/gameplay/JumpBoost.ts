/**
 * 双跳增益组件 —— 标记实体为双跳光球，记录是否已拾取。
 * @category 玩法/交互
 */
import type { ComponentType } from '../../core/ecs';

export interface JumpBoost {
  collected: boolean;
}

export const JumpBoost = 'JumpBoost' as unknown as ComponentType<JumpBoost>;