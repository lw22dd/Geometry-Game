/**
 * 复活点组件 —— 玩家可在此处重生，记录是否已激活。
 * 新增 nearby 状态：玩家进入触发区后转为可交互，按 E 激活。
 * @category 玩法/交互
 */
import type { ComponentType } from '../../core/ecs';

export interface RespawnPoint {
  /** 是否已激活（固定为当前复活点） */
  active: boolean;
  /** 玩家在触发区内、等待按 E 交互 */
  nearby: boolean;
}

export const RespawnPoint = 'RespawnPoint' as unknown as ComponentType<RespawnPoint>;