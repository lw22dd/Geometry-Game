/**
 * 路径运动组件 —— 正弦路径运动数据（用于移动平台）。
 * 由 MotionSystem 每帧更新位置和 dx/dy 差值。
 * 支持水平（axis='x'）和垂直（axis='y'）两种模式。
 */
import type { ComponentType } from '../core/ecs';

export interface PathMotion {
  /** 起始 X 坐标 */
  x0: number;
  /** 水平摆动范围（格，axis='x' 时生效） */
  range: number;
  /** 运动速度 */
  spd: number;
  /** 相位偏移 */
  ph: number;
  /** 本帧水平位移增量（用于平台携带，由系统更新） */
  dx: number;
  /** 运动轴：'x' 水平往返（默认）/ 'y' 垂直升降 */
  axis: 'x' | 'y';
  /** 起始 Y 坐标（垂直模式用） */
  y0: number;
  /** 垂直升降范围（格，axis='y' 时生效） */
  yRange: number;
  /** 本帧垂直位移增量（用于平台携带，由系统更新） */
  dy: number;
}

export const PathMotion = 'PathMotion' as unknown as ComponentType<PathMotion>;