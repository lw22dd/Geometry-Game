/**
 * NOVA 星预制体工厂 —— 创建 ECS 实体。
 * 组装 Position(中心) + Collider(触发) + Goal + Renderable。
 */
import { world } from '../../core/ecs';
import type { EntityId } from '../../core/ecs/Entity';
import { Position } from '../../components/physics/Position';
import { Collider } from '../../components/physics/Collider';
import { Goal } from '../../components/gameplay/Goal';
import { Renderable } from '../../components/render/Renderable';

export function createNova(x: number, y: number): EntityId {
  const e = world.createEntity();
  world.add(e, Position, { x, y });
  // 触发区：|dx|<1.34 && |dy|<1.34（与旧 NovaSystem 距离<√1.8≈1.342 一致）
  world.add(e, Collider, { w: 2.68, h: 2.68, solid: false });
  world.add(e, Goal, { triggered: false });
  world.add(e, Renderable, {
    radius: 0.72,
    bodyGrad: ['#f2e4ff', '#e3ccff', '#c07dff'],
    glow: '#c07dff',
    phase: 0,
    bobSpeed: 0,
    rotSpeed: 0.9,
  });
  return e;
}