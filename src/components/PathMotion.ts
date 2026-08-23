/**
 * 路径运动组件 —— 正弦路径运动数据（用于移动平台）。
 * 由 MotionSystem 每帧更新 x 位置和 dx 差值。
 */
import type { ComponentType } from '../core/ecs';

export interface PathMotion {
  /** 起始 X 坐标 */
  x0: number;
  /** 摆动范围（格） */
  range: number;
  /** 运动速度 */
  spd: number;
  /** 相位偏移 */
  ph: number;
  /** 本帧位移增量（用于平台携带，由系统更新） */
  dx: number;
}

export const PathMotion = 'PathMotion' as unknown as ComponentType<PathMotion>;