/**
 * 移动平台预制体工厂 —— 创建 ECS 实体。
 * 组装 Position(底左) + Collider(solid) + PathMotion + Hookable。
 * Position = 平台左缘底部（等同旧 Mover.x/.y）；位置由 systems/level/MotionSystem 每帧更新。
 * 支持水平（axis='x'）和垂直（axis='y'，电梯）两种模式。
 * Hookable：移动平台是平台，玩家可以勾住。
 */
import { world } from '../../core/ecs';
import type { EntityId } from '../../core/ecs/Entity';
import type { MoverSpawnData } from '../../types';
import { Position } from '../../components/physics/Position';
import { Collider } from '../../components/physics/Collider';
import { PathMotion } from '../../components/physics/PathMotion';
import { Hookable } from '../../components/gameplay/Hookable';

export function createMovingPlatform(d: MoverSpawnData): EntityId {
  const e = world.createEntity();
  const axis = d.axis ?? 'x';
  world.add(e, Position, { x: d.x0, y: d.y });
  world.add(e, Collider, { w: d.w, h: d.h, solid: true, ox: d.w / 2, oy: d.h / 2 });
  world.add(e, PathMotion, {
    x0: d.x0,
    range: d.range,
    spd: d.spd,
    ph: d.ph,
    dx: 0,
    axis,
    y0: d.y,
    yRange: d.yRange ?? 0,
    dy: 0,
  });
  // 可被钩锁命中
  world.add(e, Hookable, {});
  return e;
}