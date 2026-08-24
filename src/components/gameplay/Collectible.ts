/**
 * 可收集组件 —— 标记实体为收集品，记录是否已收集。
 * @category 玩法/交互
 */
import type { ComponentType } from '../../core/ecs';

export interface Collectible {
  collected: boolean;
}

export const Collectible = 'Collectible' as unknown as ComponentType<Collectible>;