/**
 * 弹簧平台组件 —— 标记实体为弹簧平台，记录弹射参数与动画状态。
 */
import type { ComponentType } from '../core/ecs';

export interface SpringPad {
  /** 弹射力 X 分量（格/秒） */
  forceX: number;
  /** 弹射力 Y 分量（格/秒） */
  forceY: number;
  /** 加速度持续时长（秒） */
  duration: number;
  /** 剩余冷却时间（秒，冷却中不可触发） */
  cooldown: number;
  /** 动画计时器（秒，>0 时弹簧压缩，递减到 0 弹起） */
  animTimer: number;
  /** 是否正在弹射 */
  firing: boolean;
}

export const SpringPad = 'SpringPad' as unknown as ComponentType<SpringPad>;