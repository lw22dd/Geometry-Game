/**
 * 碰撞组件 —— 碰撞箱与实体/触发标记。
 * 碰撞箱中心 = Position + (ox, oy) 偏移；尺寸为 w × h。
 * solid=true  为实体（阻挡玩家，走物理推挤）
 * solid=false 为触发区（仅触发事件，尖刺/光球/检查点/终点）
 */
import type { ComponentType } from '../core/ecs';

export interface Collider {
  /** 碰撞箱宽（格） */
  w: number;
  /** 碰撞箱高（格） */
  h: number;
  /** true=实体阻挡（平台），false=触发区（尖刺/光球/检查点/终点） */
  solid: boolean;
  /** 碰撞箱中心相对 Position 的 X 偏移（格，默认 0） */
  ox?: number;
  /** 碰撞箱中心相对 Position 的 Y 偏移（格，默认 0） */
  oy?: number;
}

export const Collider = 'Collider' as unknown as ComponentType<Collider>;