/**
 * 计时组件 —— 周期开关数据（用于激光等周期性物件）。
 * on 字段由 LaserTimerSystem 每帧更新。
 * @category 玩法/交互
 */
import type { ComponentType } from '../../core/ecs';

export interface Timer {
  /** 周期（秒） */
  period: number;
  /** 点亮时长（秒） */
  onDur: number;
  /** 相位偏移 */
  ph: number;
  /** 当前是否点亮（由系统更新） */
  on: boolean;
}

export const Timer = 'Timer' as unknown as ComponentType<Timer>;