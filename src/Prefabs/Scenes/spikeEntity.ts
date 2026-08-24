/**
 * 尖刺预制体工厂 —— 创建 ECS 实体。
 * 组装 Position(底) + Collider(触发) + Hazard。
 * 尖刺尺寸 0.4×0.55，与旧硬编码检测一致。
 */
import { world } from '../../core/ecs';
import type { EntityId } from '../../core/ecs/Entity';
import { Position } from '../../components/Position';
import { Collider } from '../../components/Collider';
import { Hazard } from '../../components/Hazard';

export function createSpike(x: number, y: number): EntityId {
  const e = world.createEntity();
  world.add(e, Position, { x, y });
  // 碰撞箱 0.4×0.55，与旧硬编码一致：
  //   水平 [x+0.3, x+0.7]（中心 x+0.5），垂直 [y, y+0.55]（中心 y+0.275）
  world.add(e, Collider, { w: 0.4, h: 0.55, solid: false, ox: 0.5, oy: 0.275 });
  world.add(e, Hazard, { damage: 1 });
  return e;
}