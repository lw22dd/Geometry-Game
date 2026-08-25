/**
 * 背包运行时 —— 玩家自带的 5 格装备栏数据逻辑。
 *
 * 背包即玩家状态上的 backpack: ItemId[]（最长 5 格，顺序即槽位）。
 * 本模块只提供纯函数 + 道具注册表，不持有全局状态：
 *  - addItem / hasItem / isFull：槽位操作
 *  - itemToNet / netToItem：网络数字编码（0=doubleJump, 1=hook）
 *  - ITEMS：道具元数据（名称 / 类别：主动·被动）
 *
 * 类别语义：
 *  - passive 被动道具：拾取即生效常驻（二段跳票 → extraJumpsMax=1）
 *  - active  主动道具：由玩家触发使用（钩锁 → 鼠标瞄准 + 左键发射）
 */
import type { ItemCategory, ItemId } from '../../types';
import { MAX_BACKPACK } from '../../types';

/** 道具元数据 */
export interface ItemDef {
  id: ItemId;
  name: string;
  category: ItemCategory;
}

/** 道具注册表（全项目道具在此登记） */
export const ITEMS: Record<ItemId, ItemDef> = {
  doubleJump: { id: 'doubleJump', name: '二段跳票', category: 'passive' },
  hook: { id: 'hook', name: '钩锁', category: 'active' },
};

/** 背包已满 */
export function isFull(backpack: ItemId[]): boolean {
  return backpack.length >= MAX_BACKPACK;
}

/** 是否已拥有该道具 */
export function hasItem(backpack: ItemId[], id: ItemId): boolean {
  return backpack.includes(id);
}

/**
 * 将道具装入背包。
 * @returns true = 装入成功；false = 已拥有 / 背包已满
 */
export function addItem(backpack: ItemId[], id: ItemId): boolean {
  if (hasItem(backpack, id) || isFull(backpack)) return false;
  backpack.push(id);
  return true;
}

/** 道具 id → 网络数字编码 */
export function itemToNet(id: ItemId): number {
  return id === 'hook' ? 1 : 0;
}

/** 网络数字编码 → 道具 id（未知编码视为二段跳票，防御） */
export function netToItem(n: number): ItemId {
  return n === 1 ? 'hook' : 'doubleJump';
}