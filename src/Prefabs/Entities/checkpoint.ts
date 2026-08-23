/**
 * 检查点预制体工厂 —— 创建 ECS 实体。
 * 组装 Position(底座) + Collider(trigger) + RespawnPoint + Renderable。
 */
import { world } from '../../core/ecs';
import type { EntityId } from '../../core/ecs/Entity';
import { Position } from '../../components/Position';
import { Collider } from '../../components/Collider';
import { RespawnPoint } from '../../components/RespawnPoint';
import { Renderable } from '../../components/Renderable';

export function createCheckpoint(x: number, y: number): EntityId {
  const e = world.createEntity();
  world.add(e, Position, { x, y });
  // 触发区：水平 |dx|<1.1，垂直 [y-1, y+2.4]（与旧 CheckpointSystem 一致）
  world.add(e, Collider, { w: 2.2, h: 3.4, trigger: true, oy: 0.7 });
  world.add(e, RespawnPoint, { active: false });
  world.add(e, Renderable, {
    radius: 0.3,
    bodyGrad: ['#7df9ff', '#7df9ff', '#7df9ff'],
    glow: '#7df9ff',
    phase: 0,
    bobSpeed: 0,
    rotSpeed: 0,
  });
  return e;
}