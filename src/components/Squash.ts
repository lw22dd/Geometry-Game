/**
 * 挤压 / 拉伸组件 —— 跳跃与落地的 squash-and-stretch 动画状态。
 * 正值 = 水平拉伸垂直压扁（落地）；负值 = 水平压扁垂直拉伸（起跳）。
 */
export interface Squash {
  value: number;
}