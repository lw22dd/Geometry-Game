/**
 * 双跳光球预制体工厂 —— 创建 ECS 实体。
 * 组装 Position + Collider(触发) + JumpBoost + Renderable。
 * 拾取后玩家获得额外跳跃次数（空中可再跳）。
 */
import { world } from '../../core/ecs';
import type { EntityId } from '../../core/ecs/Entity';
import { Position } from '../../components/physics/Position';
import { Collider } from '../../components/physics/Collider';
import { JumpBoost } from '../../components/gameplay/JumpBoost';
import { Renderable } from '../../components/render/Renderable';

export function createJumpBoost(x: number, y: number, phase: number): EntityId {
  const e = world.createEntity();
  world.add(e, Position, { x, y });
  // 碰撞体半长 0.6 ≈ 视觉箭头最大范围（0.585），略小于发光圈（1.08）
  world.add(e, Collider, { w: 1.2, h: 1.2, solid: false });
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