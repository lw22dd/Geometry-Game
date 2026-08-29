/**
 * 弹簧平台预设 —— 垂直/水平弹簧的默认参数（单一数据源）。
 * 垂直弹簧：宽 > 高，弹射力向上（forceY 主导）
 * 水平弹簧：高 > 宽，弹射力向右（forceX 主导）
 * 地图描述符可通过 `{ x, y, ...VERTICAL_SPRING }` 展开使用。
 * 与 Fx/presets.ts 同构：纯数据预设表，跟 createSpringPad 工厂同层。
 * 只依赖 types。
 */
import type { SpringPadSpawnData } from '../../types';

/** 弹簧预设 = 除位置外的全部生成参数 */
export type SpringPreset = Omit<SpringPadSpawnData, 'x' | 'y'>;

/** 垂直弹簧默认值（宽 2.5 × 高 2，垂直弹跳力 96） */
export const VERTICAL_SPRING: SpringPreset = {
  w: 2.5,
  h: 2,
  force: { x: 0, y: 96 },
  duration: 0.3,
};

/** 水平弹簧默认值（宽 2 × 高 2.5，水平弹射力 96） */
export const HORIZONTAL_SPRING: SpringPreset = {
  w: 2,
  h: 2.5,
  force: { x: 96, y: 10 },
  duration: 0.3,
};

/** 工厂默认：未指定预设时为垂直弹簧 */
export const DEFAULT_SPRING: SpringPreset = VERTICAL_SPRING;
