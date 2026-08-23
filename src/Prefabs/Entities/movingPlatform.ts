/**
 * 移动平台预制体工厂 —— 创建 ECS 实体。
 * 组装 Position(底左) + Collider(solid) + PathMotion。
 * Position = 平台左缘底部（等同旧 Mover.x/.y）；位置由 systems/level/MotionSystem 每帧更新。
 */
import { world } from '../../core/ecs';
import type { EntityId } from '../../core/ecs/Entity';
import type { MoverSpawnData } from '../../types';
import { Position } from '../../components/Position';
import { Collider } from '../../components/Collider';
import { PathMotion } from '../../components/PathMotion';

export function createMovingPlatform(d: MoverSpawnData): EntityId {
  const e = world.createEntity();
  world.add(e, Position, { x: d.x0, y: d.y });
  world.add(e, Collider, { w: d.w, h: d.h, trigger: false, ox: d.w / 2, oy: d.h / 2 });
  world.add(e, PathMotion, { x0: d.x0, range: d.range, spd: d.spd, ph: d.ph, dx: 0 });
  return e;
}