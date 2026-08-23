/**
 * 检查点组件 —— 标记复活点，记录是否已激活。
 */
import type { ComponentType } from '../core/ecs';

export interface Checkpoint {
  active: boolean;
}

export const Checkpoint = 'Checkpoint' as unknown as ComponentType<Checkpoint>;