/**
 * 碰撞箱工具 —— 从 Position + Collider 计算世界坐标 Rect、AABB 成对检测。
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

/** 从 ECS 实体获取世界坐标 Rect（快捷方式） */
export function rectFromEntity(e: EntityId): Rect {
  const pos = world.get<Position>(e, Position);
  const col = world.get<Collider>(e, Collider);
  return colliderWorldRect(pos, col);
}

/** 玩家位置点是否落入实体的碰撞箱（替代旧距离检测） */
export function pointInCollider(e: EntityId, px: number, py: number): boolean {
  const pos = world.get<Position>(e, Position);
  const col = world.get<Collider>(e, Collider);
  const r = colliderWorldRect(pos, col);
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.top;
}

/**
 * AABB 成对重叠检测（两个矩形是否相交）。
 * 用于 CollisionSystem 的通用碰撞检测。
 */
export function aabbOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.top &&
    a.top > b.y
  );
}

/**
 * AABB 成对重叠检测（基于两个 ECS 实体）。
 */
export function entityOverlap(a: EntityId, b: EntityId): boolean {
  return aabbOverlap(rectFromEntity(a), rectFromEntity(b));
}