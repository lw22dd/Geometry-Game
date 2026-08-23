/**
 * 可渲染组件 —— 实体的视觉数据（供 Prefabs 绘制函数读取）。
 * 纯数据，不含绘制逻辑。
 */
import type { ComponentType } from '../core/ecs';

export interface Renderable {
  /** 身体半径（米） */
  radius: number;
  /** 径向渐变三档（0 / 0.55 / 1） */
  bodyGrad: [string, string, string];
  /** 发光色 */
  glow: string;
  /** 动画相位（浮动 / 旋转偏移） */
  phase: number;
  /** 浮动速度 */
  bobSpeed: number;
  /** 旋转速度 */
  rotSpeed: number;
}

export const Renderable = 'Renderable' as unknown as ComponentType<Renderable>;