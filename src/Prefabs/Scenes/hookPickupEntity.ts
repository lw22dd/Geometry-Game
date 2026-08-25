/**
 * 钩锁道具预制体工厂 —— 创建 ECS 实体。
 * 组装 Position + Collider(触发) + Collectible(kind='hook') + Renderable。
 * 拾取后玩家获得钩锁主动道具，可鼠标瞄准+左键发射滑索。
 */
import { world } from '../../core/ecs';
import type { EntityId } from '../../core/ecs/Entity';
import { Position } from '../../components/physics/Position';
import { Collider } from '../../components/physics/Collider';
import { Collectible } from '../../components/gameplay/Collectible';
import { Renderable } from '../../components/render/Renderable';

export function createHookPickup(x: number, y: number, phase: number): EntityId {
  const e = world.createEntity();
  world.add(e, Position, { x, y });
  world.add(e, Collider, { w: 1.2, h: 1.2, solid: false });
  world.add(e, Collectible, { collected: false, kind: 'hook' });
  world.add(e, Renderable, {
    radius: 0.45,
    bodyGrad: ['#ffe0b3', '#ffb347', '#cc7000'],
    glow: 'rgba(255,180,70,.85)',
    phase,
    bobSpeed: 2.8,
    rotSpeed: 2.2,
  });
  return e;
}