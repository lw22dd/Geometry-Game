/**
 * NOVA 星预制体工厂 —— 创建 ECS 实体，组装 Position + WinTrigger + Renderable。
 */
import { world } from '../../core/ecs';
import type { EntityId } from '../../core/ecs/Entity';
import { Position } from '../../components/Position';
import { WinTrigger } from '../../components/WinTrigger';
import { Renderable } from '../../components/Renderable';

export function createNova(x: number, y: number): EntityId {
  const e = world.createEntity();
  world.add(e, Position, { x, y });
  world.add(e, WinTrigger, { triggered: false });
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