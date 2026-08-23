/**
 * 胜利触发组件 —— 标记终点（NOVA 星）。
 */
import type { ComponentType } from '../core/ecs';

export interface WinTrigger {
  triggered: boolean;
}

export const WinTrigger = 'WinTrigger' as unknown as ComponentType<WinTrigger>;