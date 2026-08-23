/**
 * 碰撞箱工具 —— 从 Position + Collider 计算世界坐标 Rect、点与碰撞箱重叠检测。
 */
import type { EntityId } from '../../core/ecs';
import { world } from '../../core/ecs';
import { Position } from '../../components/Position';
import { Collider } from '../../components/Collider';
import type { Rect } from '../../types';

/** 根据 Position + Collider 计算世界坐标 Rect（矩形底左角 + 宽高） */
export function colliderWorldRect(pos: Position, col: Collider): Rect {
  const cx = pos.x + (col.ox ?? 0);
  const cy = pos.y + (col.oy ?? 0);
  const hw = col.w / 2, hh = col.h / 2;
  return { x: cx - hw, y: cy - hh, w: col.w, h: col.h, top: cy + hh };
}

/** 玩家位置点是否落入实体的碰撞箱（替代旧距离检测） */
export function pointInCollider(e: EntityId, px: number, py: number): boolean {
  const pos = world.get<Position>(e, Position);
  const col = world.get<Collider>(e, Collider);
  const r = colliderWorldRect(pos, col);
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.top;
}