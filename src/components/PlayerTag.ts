/**
 * 玩家标记组件 —— 空标记，用于查询玩家实体。
 */
import type { ComponentType } from '../core/ecs';

export interface PlayerTag {}

export const PlayerTag = 'PlayerTag' as unknown as ComponentType<PlayerTag>;