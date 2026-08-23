/**
 * 复活点组件 —— 玩家可在此处重生，记录是否已激活。
 * 由 CheckpointSystem 在玩家进入触发区时更新 active。
 */
import type { ComponentType } from '../core/ecs';

export interface RespawnPoint {
  active: boolean;
}

export const RespawnPoint = 'RespawnPoint' as unknown as ComponentType<RespawnPoint>;