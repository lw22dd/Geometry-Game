/**
 * 背包运行时 —— 玩家自带的 10 格装备栏数据逻辑。
 *
 * 背包即玩家状态上的 backpack: ItemId[]（最长 10 格，顺序即槽位）。
 * 本模块只提供纯函数 + 道具注册表，不持有全局状态：
 *  - addItem / hasItem / isFull：槽位操作
 *  - itemToNet / netToItem：网络数字编码（单一事实源 = ITEMS 条目的 code 字段）
 *  - ITEMS：道具元数据（名称 / 类别：主动·被动）
 *
 * 类别语义：
 *  - passive 被动道具：拾取即生效（二段跳票 → extraJumpsMax=1；护盾/加速 → 限时 buff）
 *  - active  主动道具：由玩家触发使用（钩锁 → 鼠标瞄准 + 左键发射；AK/手雷 → 选中槽位后左键开火/投掷）
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
  /** 网络数字编码（联机背包序列化；单一事实源 —— 编码转换一律由 itemToNet/netToItem 从本字段派生） */
  code: number;
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

/** 加速有效时长（秒）：限时 buff，速度 ×2，到期自动失效并退出背包 */
export const SPEED_TIME = 10;

/** 道具注册表（全项目道具在此登记；新道具 = 新增条目 + 可选能力组件/系统） */
export const ITEMS: Record<ItemId, ItemDef> = {
  doubleJump: {
    id: 'doubleJump',
    code: 0,
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
    code: 1,
    name: '钩锁',
    category: 'active',
    // 主动装备：拾取后自动选中该槽位，便于立即使用
    onPickup: (p) => {
      p.selectedSlot = p.backpack.indexOf('hook');
    },
  },
  shield: {
    id: 'shield',
    code: 2,
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
  recall: {
    id: 'recall',
    code: 6,
    name: '重置箭头',
    category: 'active',
    // 主动装备：拾取后自动选中该槽位，便于立即使用
    onPickup: (p) => {
      p.selectedSlot = p.backpack.indexOf('recall');
    },
    // onActivate 由 recall.ts 注册（回到绑定的检查点）
  },
  speed: {
    id: 'speed',
    code: 3,
    name: '加速',
    category: 'passive',
    // 被动效果：经契约层 + Modifier 管道授予水平移速 ×2（限时 buff：dur 到期由
    // stepBuffTimers 自动失效；再拾取 = applyModifier 同键替换 → 重置计时）
    onPickup: (p) => applyEffect(p, {
      kind: 'ApplyModifier',
      mod: { stat: 'moveSpeed', op: 'set', value: 2, source: 'speed', dur: SPEED_TIME, t: SPEED_TIME },
    }),
    // 到期表现由 game 层按 stepBuffTimers 到期列表处理（toast/粒子）；此处保持纯。
  },
  ak: {
    id: 'ak',
    code: 4,
    name: 'AK',
    category: 'active',
    // 主动装备：拾取后自动选中该槽位，便于立即开火
    onPickup: (p) => {
      p.selectedSlot = p.backpack.indexOf('ak');
    },
  },
  grenade: {
    id: 'grenade',
    code: 5,
    name: '手雷',
    category: 'active',
    // 主动装备：拾取后自动选中该槽位，便于立即投掷
    onPickup: (p) => {
      p.selectedSlot = p.backpack.indexOf('grenade');
    },
  },
  };

/**
 * 按来源取道具定义（Modifier source 为自由键：道具 id / 机制名）。
 * 问题 12：ITEMS 索引的类型安全边界 —— 未知来源返回 undefined，
 * 消除调用方的 `as ItemId` 断言（既有修饰到期回调按来源分发时使用）。
 */
export function itemDefBySource(source: string): ItemDef | undefined {
  // 运行时先 `in` 判定再取键：越界来源（机制名）不会真的索引越界
  return source in ITEMS ? ITEMS[source as ItemId] : undefined;
}

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

/**
 * 道具 id → 网络数字编码（单一事实源 = ITEMS 条目的 code 字段；
 * 编码转换不再有第二份手写 —— 加道具只改 ITEMS 一行）。
 */
export function itemToNet(id: ItemId): number {
  return ITEMS[id].code;
}

/** 网络数字编码 → 道具 id（未知编码回退二段跳票，防御） */
export function netToItem(n: number): ItemId {
  for (const id of Object.keys(ITEMS) as ItemId[]) {
    if (ITEMS[id].code === n) return id;
  }
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

/**
 * 加速一致性（invariant：背包有 'speed' ⟺ 移速能力激活中 speedMult > 1）。
 * 与 reconcileShield 同模式：限时 buff 两条失效路径（超时移除 / 背包权威移除）统一收尾。
 * 超时路径只 removeModifier，背包清理由本函数统一完成；客机权威同步后也调用。
 */
export function reconcileSpeed(p: PlayerState): void {
  if (!hasItem(p.backpack, 'speed') && p.speedMult > 1) {
    // 有能力但背包被权威移除（如房主超时移除后广播）→ 同步清除能力
    removeModifier(p, 'moveSpeed', 'speed');
  }
  if (hasItem(p.backpack, 'speed') && p.speedMult <= 1) {
    // 能力已失效（超时）但背包残留 → 退出背包
    p.backpack = p.backpack.filter(id => id !== 'speed');
  }
}