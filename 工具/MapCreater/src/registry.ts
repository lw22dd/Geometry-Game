/**
 * 预制体注册表 —— 编辑器「场景物品层」调色板的数据源。
 *
 * 关键：通过 `@game/*` alias 引用游戏侧的工厂函数与类型，
 * 编辑器不复制任何预制体实现，游戏新增/修改预制体后刷新即同步。
 *
 * 工厂函数仅用于注册表元数据，编辑器不直接调用——它们由游戏运行时使用。
 *
 * 基础地图层（几何图元）不在此注册表：矩形由「几何模式」的矢量工具直接
 * 绘制（见 store.ts 的 addRect），不经过预制体工厂。
 */
import type { MapInstance, InstanceType } from './mapTypes';
// 引用外部预制体文件夹（游戏源码）—— 确保工厂存在即同步
import { createSpike } from '@game/Prefabs/Scenes/spikeEntity';
import { createOrb } from '@game/Prefabs/Scenes/orbEntity';
import { createJumpBoost } from '@game/Prefabs/Scenes/jumpBoostEntity';
import { createCheckpoint } from '@game/Prefabs/Scenes/checkpointEntity';
import { createNova } from '@game/Prefabs/Scenes/novaEntity';
import { createMovingPlatform } from '@game/Prefabs/Scenes/movingPlatformEntity';
import { createLaser } from '@game/Prefabs/Scenes/laserEntity';
import { createSpringPad } from '@game/Prefabs/Scenes/springPadEntity';

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
    swatch: '#8ff6ff', icon: '●', factory: createOrb,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y', label: 'Y', type: 'number', step: 0.5 },
      { key: 'rotation', label: '旋转°', type: 'number', step: 5 },
    ],
    defaults: () => ({ type: 'orb', x: 0, y: 0 }),
  },
  {
    toolId: 'jumpBoost', type: 'jumpBoost', name: '双跳光球', category: '可收集物',
    swatch: '#ffb347', icon: '⏫', factory: createJumpBoost,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y', label: 'Y', type: 'number', step: 0.5 },
      { key: 'rotation', label: '旋转°', type: 'number', step: 5 },
    ],
    defaults: () => ({ type: 'jumpBoost', x: 0, y: 0 }),
  },
  {
    toolId: 'checkpoint', type: 'checkpoint', name: '检查点', category: '可收集物',
    swatch: '#7df9ff', icon: '🏁', factory: createCheckpoint,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y', label: 'Y', type: 'number', step: 0.5 },
      { key: 'rotation', label: '旋转°', type: 'number', step: 5 },
    ],
    defaults: () => ({ type: 'checkpoint', x: 0, y: 0 }),
  },

  // ── 机关 ──
  {
    toolId: 'mover', type: 'mover', name: '移动平台', category: '机关',
    swatch: '#ff7d4a', icon: '⇄', factory: createMovingPlatform,
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
    swatch: '#ff2d55', icon: '⚡', factory: createLaser,
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
    swatch: '#4aff8a', icon: '⬆', factory: createSpringPad,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y', label: 'Y', type: 'number', step: 0.5 },
      { key: 'w', label: '宽', type: 'number', step: 0.5, min: 0.1 },
      { key: 'h', label: '高', type: 'number', step: 0.5, min: 0.1 },
      { key: 'forceX', label: '弹射力 X', type: 'number', step: 0.5 },
      { key: 'forceY', label: '弹射力 Y', type: 'number', step: 0.5 },
      { key: 'duration', label: '加速时长', type: 'number', step: 0.1, min: 0 },
    ],
    defaults: () => ({ type: 'springPad', x: 0, y: 0, w: 2.5, h: 2, forceX: 0, forceY: 96, duration: 0.3 }),
  },
  // ── 水平弹簧（高 > 宽，弹射力向右）──
  {
    toolId: 'springPadH', type: 'springPad', name: '水平弹簧', category: '机关',
    swatch: '#4aff8a', icon: '➡', factory: createSpringPad,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y', label: 'Y', type: 'number', step: 0.5 },
      { key: 'w', label: '宽', type: 'number', step: 0.5, min: 0.1 },
      { key: 'h', label: '高', type: 'number', step: 0.5, min: 0.1 },
      { key: 'forceX', label: '弹射力 X', type: 'number', step: 0.5 },
      { key: 'forceY', label: '弹射力 Y', type: 'number', step: 0.5 },
      { key: 'duration', label: '加速时长', type: 'number', step: 0.1, min: 0 },
    ],
    defaults: () => ({ type: 'springPad', x: 0, y: 0, w: 2, h: 2.5, forceX: 96, forceY: 10, duration: 0.3 }),
  },

  // ── 危险物 ──
  {
    toolId: 'spike', type: 'spike', name: '尖刺', category: '危险物',
    swatch: '#ff4a6a', icon: '▲', factory: createSpike,
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
    swatch: '#994aff', icon: '◇', factory: null,
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
    swatch: '#ffd700', icon: '💬', factory: null,
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
    swatch: '#c07dff', icon: '★', factory: createNova,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y', label: 'Y', type: 'number', step: 0.5 },
      { key: 'rotation', label: '旋转°', type: 'number', step: 5 },
    ],
    defaults: () => ({ type: 'nova', x: 0, y: 0 }),
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
  id: 'select' | 'rect';
  name: string;
  icon: string;
  hint: string;
}

export const GEOMETRY_TOOLS: GeomToolDesc[] = [
  { id: 'select', name: '选择/移动', icon: '🖱', hint: '点击选中，拖动移动，角柄缩放，顶部圆柄旋转' },
  { id: 'rect', name: '矩形画笔', icon: '▭', hint: '按住拖动绘制矩形（支持连续放置）' },
];