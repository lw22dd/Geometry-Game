/**
 * 可收集组件 —— 通用可拾取物标记：记录是否已收集 + 道具类型（kind）。
 * 光球 / 二段跳票 / 钩锁 共用本组件，以 kind 区分玩法语义：
 *  - 'orb'        光球（计数收集）
 *  - 'jumpBoost'  二段跳票（被动道具 → 背包 + 二段跳能力）
 *  - 'hook'       钩锁（主动道具 → 背包 + 鼠标瞄准滑索）
 * @category 玩法/交互
 */
import type { ComponentType } from '../../core/ecs';

/** 可拾取物类型 */
export type CollectibleKind = 'orb' | 'jumpBoost' | 'hook';

export interface Collectible {
  collected: boolean;
  /** 可拾取物类型 */
  kind: CollectibleKind;
}

export const Collectible = 'Collectible' as unknown as ComponentType<Collectible>;