/**
 * 速度组件 —— 水平 / 垂直速度（m/s）。
 * 本游戏坐标系：vy > 0 向上，vy < 0 向下。
 */
export interface Velocity {
  vx: number;
  vy: number;
}