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
import type { ItemCategory, ItemId, PlayerState } from '../../types';
import { MAX_BACKPACK } from '../../types';
import { applyEffect, removeModifier } from '../effects';

/** 主动道具触发上下文（S7 槽位 ActiveItemSystem 传入） */
export interface ActiveItemContext {
  dt: number;
  /** 发射边沿（本地 = 鼠标按下沿；远端 = input.hook 沿） */
  hookEdge: boolean;
  /** 瞄准方向（单位向量；本地 = 鼠标引导，远端 = 客机上报 aim） */
  aim: { x: number; y: number };
  /** 是否播放音效（远端 host 模拟传 false，避免房主替远程玩家出声） */
  sfx?: boolean;
}

/** 道具元数据 */
export interface ItemDef {
  id: ItemId;
  name: string;
  category: ItemCategory;
  /** 拾取生效（被动道具挂载能力，经契约层） */
  onPickup?: (p: PlayerState) => void;
  /** 主动触发（S7 槽位 ActiveItemSystem 调用；内部自行判断选中槽位/冷却） */
  onActivate?: (p: PlayerState, ctx: ActiveItemContext) => void;
  /** 到期回调（限时 buff：stepBuffTimers 到期移除能力后调用；纯表现，不写玩家状态） */
  onExpire?: (p: PlayerState) => void;
}

/** 护盾有效时长（秒）：限时 buff，到期自动失效并退出背包 */
export const SHIELD_TIME = 10;

/** 道具注册表（全项目道具在此登记；新道具 = 新增条目 + 可选能力组件/系统） */
export const ITEMS: Record<ItemId, ItemDef> = {
  doubleJump: {
    id: 'doubleJump',
    name: '二段跳票',
    category: 'passive',
    // 被动效果：经契约层 + Modifier 管道授予一次空中跳充能（不直写 extraJumpsMax）
    onPickup: (p) => applyEffect(p, {
      kind: 'ApplyModifier',
      mod: { stat: 'jumpCharges', op: 'set', value: 1, source: 'doubleJump' },
    }),
  },
  hook: {
    id: 'hook',
    name: '钩锁',
    category: 'active',
    // 主动装备：拾取后自动选中该槽位，便于立即使用
    onPickup: (p) => {
      p.selectedSlot = p.backpack.indexOf('hook');
    },
  },
  shield: {
    id: 'shield',
    name: '护盾',
    category: 'passive',
    // 被动效果：经契约层 + Modifier 管道授予 1 格护盾（限时 buff：dur 到期由
    // stepBuffTimers 自动失效；再拾取 = applyModifier 同键替换 → 重置计时）
    onPickup: (p) => applyEffect(p, {
      kind: 'ApplyModifier',
      mod: { stat: 'shields', op: 'set', value: 1, source: 'shield', dur: SHIELD_TIME, t: SHIELD_TIME },
    }),
    // 到期表现由 game 层按 stepBuffTimers 到期列表处理（toast/粒子）；此处保持纯。
  },
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

/** 道具 id → 网络数字编码（0=doubleJump，1=hook，2=shield） */
export function itemToNet(id: ItemId): number {
  if (id === 'hook') return 1;
  if (id === 'shield') return 2;
  return 0;
}

/** 网络数字编码 → 道具 id（未知编码视为二段跳票，防御） */
export function netToItem(n: number): ItemId {
  if (n === 1) return 'hook';
  if (n === 2) return 'shield';
  return 'doubleJump';
}

/**
 * 护盾一致性（invariant：背包有 'shield' ⟺ 盾能力激活中 shieldsMax > 0）。
 * 两条失效路径（格挡消耗 / 超时）都用这一条收尾，避免 effects 反向依赖背包：
 * 格挡路径只 removeModifier，背包清理由本函数统一完成；客机权威同步后也调用。
 */
export function reconcileShield(p: PlayerState): void {
  if (!hasItem(p.backpack, 'shield') && p.shieldsMax > 0) {
    // 有能力但背包被权威移除（如房主超时移除后广播）→ 同步清除能力
    removeModifier(p, 'shields', 'shield');
  }
  if (hasItem(p.backpack, 'shield') && p.shieldsMax === 0) {
    // 能力已失效（格挡/超时）但背包残留 → 退出背包
    p.backpack = p.backpack.filter(id => id !== 'shield');
  }
}