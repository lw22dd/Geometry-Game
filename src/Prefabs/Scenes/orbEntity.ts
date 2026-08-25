/**
 * 光球预制体工厂 —— 创建 ECS 实体。
 * 组装 Position + Collider(触发) + Collectible + Renderable。
 */
import { world } from '../../core/ecs';
import type { EntityId } from '../../core/ecs/Entity';
import { Position } from '../../components/physics/Position';
import { Collider } from '../../components/physics/Collider';
import { Collectible } from '../../components/gameplay/Collectible';
import { Renderable } from '../../components/render/Renderable';

export function createOrb(x: number, y: number, phase: number): EntityId {
  const e = world.createEntity();
  world.add(e, Position, { x, y });
  // 碰撞体半长 0.6 ≈ 视觉球体 + 旋转方框范围（0.4×1.6=0.64），接近发光圈（1.04）
  world.add(e, Collider, { w: 1.2, h: 1.2, solid: false });
  world.add(e, Collectible, { collected: false, kind: 'orb' });
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