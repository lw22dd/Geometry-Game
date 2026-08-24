/**
 * 弹簧平台预制体工厂 —— 创建 ECS 实体。
 * 组装 Position(底左) + Collider(solid) + SpringPad。
 * 玩家踩踏后获得指定方向加速度，同时弹簧播放压缩/弹起动画。
 */
import { world } from '../../core/ecs';
import type { EntityId } from '../../core/ecs/Entity';
import type { SpringPadSpawnData } from '../../types';
import { Position } from '../../components/Position';
import { Collider } from '../../components/Collider';
import { SpringPad } from '../../components/SpringPad';

export function createSpringPad(d: SpringPadSpawnData): EntityId {
  const e = world.createEntity();
  world.add(e, Position, { x: d.x, y: d.y });
  world.add(e, Collider, { w: d.w, h: d.h, solid: true, ox: d.w / 2, oy: d.h / 2 });
  world.add(e, SpringPad, {
    forceX: d.forceX,
    forceY: d.forceY,
    duration: d.duration,
    cooldown: 0,
    animTimer: 0,
    firing: false,
  });
  return e;
}