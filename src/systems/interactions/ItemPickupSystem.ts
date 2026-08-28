/**
 * 可拾取物系统（坐标版）—— 供远程玩家（host 模拟）检测可拾取物收集。
 * 与本地玩家的 CollisionSystem + CollisionHooks（enter:player:pickup）不同，
 * 远程玩家无 ECS 碰撞实体，由房主用玩家坐标逐类检测。
 *
 * 通用 Collectible 组件 + 类型 tag（Orb / JumpBoost / Hook）。
 * 本模块同时提供共享的光球计数 helper（orbCount），供所有"全部光球"判定复用。
 */
import { Collectible, Orb, JumpBoost, Hook, qOrbs, qJumpBoosts, qHooks } from '../../core/ecs';
import { pointInCollider } from '../level';

/** 可拾取物类型（tag 组件 → 道具效果） */
export type CollectibleKind = 'orb' | 'jumpBoost' | 'hook';

/** 当前地图光球总数（仅 Orb tag） */
export function orbCount(): number {
  return qOrbs().length;
}

/**
 * 检测某玩家坐标是否与指定类型的可拾取物重叠。
 * @param kind 可拾取物类型（orb / jumpBoost / hook）
 * @returns true = 本次拾取（调用方据此执行对应效果：计数 / 入背包）
 */
export function updateItemPickupSystem(tx: number, ty: number, kind: CollectibleKind): boolean {
  const ents = kind === 'orb'
    ? qOrbs()
    : kind === 'jumpBoost'
      ? qJumpBoosts()
      : qHooks();
  for (const e of ents) {
    if (Collectible.collected[e]) continue;
    if (!pointInCollider(e, tx, ty)) continue;
    Collectible.collected[e] = 1;
    return true;
  }
  return false;
}