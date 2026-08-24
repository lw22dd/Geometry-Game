/**
 * 双跳光球预制体工厂 —— 创建 ECS 实体。
 * 组装 Position + Collider(触发) + JumpBoost + Renderable。
 * 拾取后玩家获得额外跳跃次数（空中可再跳）。
 */
import { world } from '../../core/ecs';
import type { EntityId } from '../../core/ecs/Entity';
import { Position } from '../../components/Position';
import { Collider } from '../../components/Collider';
import { JumpBoost } from '../../components/JumpBoost';
import { Renderable } from '../../components/Renderable';

export function createJumpBoost(x: number, y: number, phase: number): EntityId {
  const e = world.createEntity();
  world.add(e, Position, { x, y });
  world.add(e, Collider, { w: 2.6, h: 2.6, solid: false });
  world.add(e, JumpBoost, { collected: false });
  world.add(e, Renderable, {
    radius: 0.45,
    bodyGrad: ['#d6ffe6', '#66ff99', '#1fbf5f'],
    glow: 'rgba(120,255,170,.85)',
    phase,
    bobSpeed: 2.8,
    rotSpeed: 2.2,
  });
  return e;
}