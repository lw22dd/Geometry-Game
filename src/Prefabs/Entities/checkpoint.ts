/**
 * 检查点预制体工厂 —— 创建 ECS 实体，组装 Position + Checkpoint + Renderable。
 */
import { world } from '../../core/ecs';
import type { EntityId } from '../../core/ecs/Entity';
import { Position } from '../../components/Position';
import { Checkpoint } from '../../components/Checkpoint';
import { Renderable } from '../../components/Renderable';

export function createCheckpoint(x: number, y: number): EntityId {
  const e = world.createEntity();
  world.add(e, Position, { x, y });
  world.add(e, Checkpoint, { active: false });
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