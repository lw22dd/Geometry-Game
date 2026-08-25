/**
 * 可拾取物系统（坐标版）—— 供远程玩家（host 模拟）检测可拾取物收集。
 * 与本地玩家的 CollisionSystem + CollisionHooks（enter:player:pickup）不同，
 * 远程玩家无 ECS 碰撞实体，由房主用玩家坐标逐类检测。
 *
 * 通用 Collectible 组件以 kind 区分：'orb' / 'jumpBoost' / 'hook'。
 * 本模块同时提供共享的光球计数 helper（orbCount），供所有"全部光球"判定复用。
 */
import { world } from '../../core/ecs';
import { Position } from '../../components/physics/Position';
import { Collider } from '../../components/physics/Collider';
import { Collectible, type CollectibleKind } from '../../components/gameplay/Collectible';
import { pointInCollider } from '../level';

/** 当前地图光球总数（仅 kind === 'orb'） */
export function orbCount(): number {
  let n = 0;
  for (const e of world.query(Position, Collectible)) {
    if (world.get<Collectible>(e, Collectible).kind === 'orb') n++;
  }
  return n;
}

/**
 * 检测某玩家坐标是否与指定类型的可拾取物重叠。
 * @param kind 可拾取物类型（orb / jumpBoost / hook）
 * @returns true = 本次拾取（调用方据此执行对应效果：计数 / 入背包）
 */
export function updateItemPickupSystem(tx: number, ty: number, kind: CollectibleKind): boolean {
  for (const e of world.query(Position, Collider, Collectible)) {
    const c = world.get<Collectible>(e, Collectible);
    if (c.kind !== kind || c.collected) continue;
    if (!pointInCollider(e, tx, ty)) continue;
    c.collected = true;
    return true;
  }
  return false;
}