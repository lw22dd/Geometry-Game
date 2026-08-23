/**
 * 激光预制体工厂 —— 创建 ECS 实体。
 * 组装 Position(底) + Collider(trigger) + Timer + Hazard。
 * Position = 光束底部（等同旧 Laser.x/.y0）；Timer.on 由 LaserTimerSystem 每帧更新。
 */
import { world } from '../../core/ecs';
import type { EntityId } from '../../core/ecs/Entity';
import type { LaserSpawnData } from '../../types';
import { Position } from '../../components/Position';
import { Collider } from '../../components/Collider';
import { Timer } from '../../components/Timer';
import { Hazard } from '../../components/Hazard';

/** 激光周期 / 点亮时长默认值（与旧 LCYC / LON 一致） */
const LASER_PERIOD = 2.6;
const LASER_ON_DUR = 1.15;

/**
 * 创建激光实体。
 * @param d      生成数据（x / y0 / len / ph）
 * @param period 周期（秒），默认 2.6
 * @param onDur  点亮时长（秒），默认 1.15
 */
export function createLaser(d: LaserSpawnData, period: number = LASER_PERIOD, onDur: number = LASER_ON_DUR): EntityId {
  const e = world.createEntity();
  world.add(e, Position, { x: d.x, y: d.y0 });
  world.add(e, Collider, { w: 1.12, h: d.len, trigger: true, oy: d.len / 2 });
  world.add(e, Timer, { period, onDur, ph: d.ph, on: false });
  world.add(e, Hazard, { damage: 1 });
  return e;
}