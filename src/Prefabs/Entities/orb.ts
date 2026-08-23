/**
 * 光球预制体工厂 —— 创建 ECS 实体。
 * 组装 Position + Collider(trigger) + Collectible + Renderable。
 */
import { world } from '../../core/ecs';
import type { EntityId } from '../../core/ecs/Entity';
import { Position } from '../../components/Position';
import { Collider } from '../../components/Collider';
import { Collectible } from '../../components/Collectible';
import { Renderable } from '../../components/Renderable';

export function createOrb(x: number, y: number, phase: number): EntityId {
  const e = world.createEntity();
  world.add(e, Position, { x, y });
  world.add(e, Collider, { w: 2.6, h: 2.6, trigger: true });
  world.add(e, Collectible, { collected: false });
  world.add(e, Renderable, {
    radius: 0.4,
    bodyGrad: ['#eaffff', '#8ff6ff', '#8ff6ff'],
    glow: 'rgba(140,246,255,.5)',
    phase,
    bobSpeed: 2.6,
    rotSpeed: 1.8,
  });
  return e;
}