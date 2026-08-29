/**
 * 预制体注册表 —— 编辑器「场景物品层」调色板的数据源。
 *
 * 关键：通过 `@game/*` alias 引用游戏侧的工厂函数与类型，
 * 编辑器不复制任何预制体实现，游戏新增/修改预制体后刷新即同步。
 *
 * 工厂函数仅用于注册表元数据，编辑器不直接调用——它们由游戏运行时使用。
 *
 * 基础地图层（几何图元）不在此注册表：几何层工具见下方 GEOMETRY_TOOLS——
 * 目前仅「选择/移动」（SceneEditor 已移除底盘的矩形画笔绘制，结构由 MVMap 导入）。
 */
import type { MapInstance, InstanceType } from './mapTypes';
// 引用外部预制体文件夹（游戏源码）—— 确保工厂存在即同步
// 游戏侧工厂统一收口于 sceneFactory（旧 Prefabs/Scenes/*Entity.ts 已重构合并）
import {
  createSpike, createOrb, createJumpBoost, createCheckpoint, createNova,
  createHookPickup, createShieldPickup, createSpeedPickup, createLoopTrack, createMovingPlatform, createLaser, createSpringPad,
} from '@game/Prefabs/Scene/sceneFactory';
// 弹簧默认数值与游戏侧单一数据源（垂直/水平预设）
import { VERTICAL_SPRING, HORIZONTAL_SPRING } from '@game/config/springs';

/** 字段定义（inspector 动态表单） */
export interface FieldDef {
  key: string;
  label: string;
  type: 'number' | 'string';
  step?: number;
  min?: number;
  max?: number;
  placeholder?: string;
}

/** 注册表条目 */
export interface PrefabEntry {
  /** 工具唯一标识（默认 = type，同 type 多个预设时需显式指定） */
  toolId: string;
  type: InstanceType;
  name: string;
  category: string;
  swatch: string;
  icon: string;
  /** 游戏侧的工厂函数（外部引用，编辑器不调用） */
  factory: ((...args: any[]) => any) | null;
  fields: FieldDef[];
  defaults(): MapInstance;
}

/** 全部注册表条目（场景物品层） */
export const PREFAB_ENTRIES: PrefabEntry[] = [
  // ── 可收集物 ──
  {
    toolId: 'orb', type: 'orb', name: '光球', category: '可收集物',
    swatch: '#8ff6ff', icon: 'Circle', factory: createOrb,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y', label: 'Y', type: 'number', step: 0.5 },
      { key: 'rotation', label: '旋转°', type: 'number', step: 5 },
    ],
    defaults: () => ({ type: 'orb', x: 0, y: 0 }),
  },
  {
    toolId: 'jumpBoost', type: 'jumpBoost', name: '双跳光球', category: '可收集物',
    swatch: '#ffb347', icon: 'ArrowUp', factory: createJumpBoost,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y', label: 'Y', type: 'number', step: 0.5 },
      { key: 'rotation', label: '旋转°', type: 'number', step: 5 },
    ],
    defaults: () => ({ type: 'jumpBoost', x: 0, y: 0 }),
  },
  {
    toolId: 'checkpoint', type: 'checkpoint', name: '检查点', category: '可收集物',
    swatch: '#7df9ff', icon: 'Flag', factory: createCheckpoint,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y', label: 'Y', type: 'number', step: 0.5 },
      { key: 'rotation', label: '旋转°', type: 'number', step: 5 },
    ],
    defaults: () => ({ type: 'checkpoint', x: 0, y: 0 }),
  },
  {
    toolId: 'hookPickup', type: 'hookPickup', name: '钩锁道具', category: '可收集物',
    swatch: '#ffc04d', icon: 'Attachment', factory: createHookPickup,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y', label: 'Y', type: 'number', step: 0.5 },
      { key: 'rotation', label: '旋转°', type: 'number', step: 5 },
    ],
    defaults: () => ({ type: 'hookPickup', x: 0, y: 0 }),
  },
  {
    toolId: 'shieldPickup', type: 'shieldPickup', name: '护盾道具', category: '可收集物',
    swatch: '#9aa7ff', icon: 'LockOn', factory: createShieldPickup,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y', label: 'Y', type: 'number', step: 0.5 },
      { key: 'rotation', label: '旋转°', type: 'number', step: 5 },
    ],
    defaults: () => ({ type: 'shieldPickup', x: 0, y: 0 }),
  },
  {
    toolId: 'speedPickup', type: 'speedPickup', name: '加速道具', category: '可收集物',
    swatch: '#59d4ff', icon: 'ArrowRight', factory: createSpeedPickup,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y', label: 'Y', type: 'number', step: 0.5 },
      { key: 'rotation', label: '旋转°', type: 'number', step: 5 },
    ],
    defaults: () => ({ type: 'speedPickup', x: 0, y: 0 }),
  },

  // ── 机关 ──
  {
    toolId: 'mover', type: 'mover', name: '移动平台', category: '机关',
    swatch: '#ff7d4a', icon: 'Move', factory: createMovingPlatform,
    fields: [
      { key: 'x0', label: '起始 X', type: 'number', step: 0.5 },
      { key: 'y', label: 'Y', type: 'number', step: 0.5 },
      { key: 'w', label: '宽', type: 'number', step: 0.5, min: 0.1 },
      { key: 'h', label: '高', type: 'number', step: 0.5, min: 0.1 },
      { key: 'range', label: '摆动范围', type: 'number', step: 0.5, min: 0 },
      { key: 'spd', label: '速度', type: 'number', step: 0.1, min: 0 },
      { key: 'ph', label: '相位', type: 'number', step: 0.1 },
    ],
    defaults: () => ({ type: 'mover', x0: 0, y: 0, w: 3, h: 0.8, range: 4, spd: 0.8, ph: 0 }),
  },
  {
    toolId: 'laser', type: 'laser', name: '激光栅栏', category: '机关',
    swatch: '#ff2d55', icon: 'Thunder', factory: createLaser,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y0', label: '底部 Y', type: 'number', step: 0.5 },
      { key: 'len', label: '高度', type: 'number', step: 0.5, min: 0.1 },
      { key: 'ph', label: '相位', type: 'number', step: 0.1 },
    ],
    defaults: () => ({ type: 'laser', x: 0, y0: 0, len: 6, ph: 0 }),
  },
  // ── 垂直弹簧（宽 > 高，弹射力向上）──
  {
    toolId: 'springPadV', type: 'springPad', name: '垂直弹簧', category: '机关',
    swatch: '#4aff8a', icon: 'ArrowUp', factory: createSpringPad,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y', label: 'Y', type: 'number', step: 0.5 },
      { key: 'w', label: '宽', type: 'number', step: 0.5, min: 0.1 },
      { key: 'h', label: '高', type: 'number', step: 0.5, min: 0.1 },
      { key: 'force.x', label: '力 X', type: 'number', step: 0.5 },
      { key: 'force.y', label: '力 Y', type: 'number', step: 0.5 },
      { key: 'duration', label: '加速时长', type: 'number', step: 0.1, min: 0 },
    ],
    defaults: () => ({ type: 'springPad', x: 0, y: 0, ...VERTICAL_SPRING }),
  },
  // ── 水平弹簧（高 > 宽，弹射力向右）──
  {
    toolId: 'springPadH', type: 'springPad', name: '水平弹簧', category: '机关',
    swatch: '#4aff8a', icon: 'ArrowRight', factory: createSpringPad,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y', label: 'Y', type: 'number', step: 0.5 },
      { key: 'w', label: '宽', type: 'number', step: 0.5, min: 0.1 },
      { key: 'h', label: '高', type: 'number', step: 0.5, min: 0.1 },
      { key: 'force.x', label: '力 X', type: 'number', step: 0.5 },
      { key: 'force.y', label: '力 Y', type: 'number', step: 0.5 },
      { key: 'duration', label: '加速时长', type: 'number', step: 0.1, min: 0 },
    ],
    defaults: () => ({ type: 'springPad', x: 0, y: 0, ...HORIZONTAL_SPRING }),
  },

  // ── 危险物 ──
  {
    toolId: 'spike', type: 'spike', name: '尖刺', category: '危险物',
    swatch: '#ff4a6a', icon: 'AlertTriangle', factory: createSpike,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y', label: 'Y', type: 'number', step: 0.5 },
      { key: 'rotation', label: '旋转°', type: 'number', step: 5 },
    ],
    defaults: () => ({ type: 'spike', x: 0, y: 0 }),
  },

  // ── 装饰与提示 ──
  {
    toolId: 'deco', type: 'deco', name: '装饰方块', category: '装饰与提示',
    swatch: '#994aff', icon: 'Module', factory: null,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y', label: 'Y', type: 'number', step: 0.5 },
      { key: 'size', label: '尺寸', type: 'number', step: 0.1, min: 0.1 },
      { key: 'rotSpeed', label: '转速', type: 'number', step: 0.1 },
    ],
    defaults: () => ({ type: 'deco', x: 0, y: 0, size: 0.8, rotSpeed: 0.5 }),
  },
  {
    toolId: 'hint', type: 'hint', name: '提示文字', category: '装饰与提示',
    swatch: '#ffd700', icon: 'ChatMessage', factory: null,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y', label: 'Y', type: 'number', step: 0.5 },
      { key: 'text', label: '文案', type: 'string', placeholder: '提示内容' },
    ],
    defaults: () => ({ type: 'hint', x: 0, y: 0, text: '提示' }),
  },

  // ── 特殊 ──
  {
    toolId: 'nova', type: 'nova', name: 'NOVA 终点', category: '特殊',
    swatch: '#c07dff', icon: 'Star', factory: createNova,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y', label: 'Y', type: 'number', step: 0.5 },
      { key: 'rotation', label: '旋转°', type: 'number', step: 5 },
    ],
    defaults: () => ({ type: 'nova', x: 0, y: 0 }),
  },
  {
    toolId: 'track', type: 'track', name: '玻璃管道（冲刺轨道）', category: '特殊',
    swatch: '#66d4ff', icon: 'Refresh', factory: createLoopTrack,
    fields: [
      { key: 'x1', label: '起点 X', type: 'number', step: 0.5 },
      { key: 'y1', label: '起点 Y', type: 'number', step: 0.5 },
      { key: 'x2', label: '终点 X', type: 'number', step: 0.5 },
      { key: 'y2', label: '终点 Y', type: 'number', step: 0.5 },
      { key: 'entryDist', label: '入口距离', type: 'number', step: 0.5, min: 0 },
      { key: 'exitDist', label: '出口距离', type: 'number', step: 0.5, min: 0 },
      { key: 'speedThreshold', label: '捕获速度', type: 'number', step: 0.5, min: 0 },
    ],
    defaults: () => ({
      type: 'track', x: 0, y: 0,
      segments: [{ type: 'line', x1: 0, y1: 0, x2: 8, y2: 0 }],
      entryDist: 0, exitDist: 8, speedThreshold: 7,
    }),
  },
];

/** 按 toolId 查找条目（工具激活 / 放置时使用） */
export function getPrefabEntry(toolId: string): PrefabEntry | undefined {
  return PREFAB_ENTRIES.find(e => e.toolId === toolId);
}

/** 按实例 type 查找条目（属性面板等场景：同 type 多预设时取首个） */
export function getEntryByType(type: InstanceType): PrefabEntry | undefined {
  return PREFAB_ENTRIES.find(e => e.type === type);
}

/**
 * 按「实例」解析注册表条目 —— 区分同 type 的多预设（如垂直/水平弹簧）。
 * 优先用放置时记录在实例上的 toolId；缺失时对 springPad 按形状推断
 * （高 > 宽 → 水平），覆盖旧存档/导入数据。
 */
export function getEntryForInstance(inst: MapInstance): PrefabEntry | undefined {
  const toolId = (inst as { toolId?: string }).toolId;
  if (toolId) {
    const e = getPrefabEntry(toolId);
    if (e) return e;
  }
  if (inst.type === 'springPad') {
    return inst.h > inst.w ? getPrefabEntry('springPadH') : getPrefabEntry('springPadV');
  }
  return getEntryByType(inst.type);
}

/** 从对象中安全读取点路径值（如 "force.x" → obj.force.x） */
export function getField(obj: Record<string, any>, key: string): string | number | undefined {
  const parts = key.split('.');
  let v: unknown = obj;
  for (const p of parts) {
    if (v == null || typeof v !== 'object') return undefined;
    v = (v as Record<string, any>)[p];
  }
  return typeof v === 'number' ? v : String(v ?? '');
}

export function getPrefabCategories(): Map<string, PrefabEntry[]> {
  const map = new Map<string, PrefabEntry[]>();
  for (const entry of PREFAB_ENTRIES) {
    const list = map.get(entry.category) || [];
    list.push(entry);
    map.set(entry.category, list);
  }
  return map;
}

/* ==================== 几何模式工具描述 ==================== */

export interface GeomToolDesc {
  id: 'select';
  name: string;
  icon: string;
  hint: string;
}

export const GEOMETRY_TOOLS: GeomToolDesc[] = [
  { id: 'select', name: '选择/移动', icon: 'Cursor', hint: '点击选中，拖动移动，角柄缩放，顶部圆柄旋转' },
];