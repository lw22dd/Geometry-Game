/**
 * 碰撞箱工具 —— 从新 ECS 的 SoA 组件计算世界坐标 Rect、AABB 成对检测。
 * 提供重载：新签名 (eid) + 旧签名 (pos, col) 兼容过渡期调用点。
 */
import { Position, Collider } from '../../core/ecs';
import type { Rect } from '../../types';

/** 从实体 ID 计算世界坐标 Rect（新签名） */
export function colliderWorldRect(e: number): Rect;
export function colliderWorldRect(pos: { x: number; y: number; ox?: number; oy?: number }, col: { w: number; h: number; ox?: number; oy?: number }): Rect;
export function colliderWorldRect(arg1: any, arg2?: any): Rect {
  if (typeof arg1 === 'number') {
    // 新签名：实体 ID
    const e = arg1;
    const cx = Position.x[e] + (Collider.ox[e] || 0);
    const cy = Position.y[e] + (Collider.oy[e] || 0);
    const w = Collider.w[e], h = Collider.h[e];
    const hw = w / 2, hh = h / 2;
    return { x: cx - hw, y: cy - hh, w, h, top: cy + hh };
  } else {
    // 旧签名：pos + col 对象
    const pos = arg1;
    const col = arg2;
    const cx = pos.x + (col.ox ?? 0);
    const cy = pos.y + (col.oy ?? 0);
    const hw = col.w / 2, hh = col.h / 2;
    return { x: cx - hw, y: cy - hh, w: col.w, h: col.h, top: cy + hh };
  }
}

/** 兼容别名 */
export const rectFromEntity = (e: number): Rect => colliderWorldRect(e);

/** 玩家位置点是否落入实体的碰撞箱 */
export function pointInCollider(e: number, px: number, py: number): boolean {
  const pos = colliderWorldRect(e);
  return px >= pos.x && px <= pos.x + pos.w && py >= pos.y && py <= pos.top;
}

/** AABB 成对重叠检测（纯数学） */
export function aabbOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.top &&
    a.top > b.y
  );
}

/** 基于两个 ECS 实体的 AABB 重叠检测 */
export function entityOverlap(a: number, b: number): boolean {
  return aabbOverlap(colliderWorldRect(a), colliderWorldRect(b));
}