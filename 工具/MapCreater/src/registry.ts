/**
 * 预制体注册表 —— 编辑器调色板的数据源。
 *
 * 关键：通过 `@game/*` alias 引用游戏侧的工厂函数与类型，
 * 编辑器不复制任何预制体实现，游戏新增/修改预制体后刷新即同步。
 *
 * 工厂函数仅用于注册表元数据，编辑器不直接调用——它们由游戏运行时使用。
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

/** 全部注册表条目 */
export const PREFAB_ENTRIES: PrefabEntry[] = [
  // ── 静态几何 ──
  {
    type: 'solid', name: '平台', category: '静态几何',
    swatch: '#4a7dff', icon: '▬', factory: null,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y', label: 'Y', type: 'number', step: 0.5 },
      { key: 'w', label: '宽', type: 'number', step: 0.5, min: 0.1 },
      { key: 'h', label: '高', type: 'number', step: 0.5, min: 0.1 },
    ],
    defaults: () => ({ type: 'solid', x: 0, y: 0, w: 4, h: 1 }),
  },
  {
    type: 'spike', name: '尖刺', category: '静态几何',
    swatch: '#ff4a6a', icon: '▲', factory: createSpike,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y', label: 'Y', type: 'number', step: 0.5 },
    ],
    defaults: () => ({ type: 'spike', x: 0, y: 0 }),
  },
  {
    type: 'deco', name: '装饰方块', category: '静态几何',
    swatch: '#994aff', icon: '◇', factory: null,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y', label: 'Y', type: 'number', step: 0.5 },
      { key: 'size', label: '尺寸', type: 'number', step: 0.1, min: 0.1 },
      { key: 'rotSpeed', label: '转速', type: 'number', step: 0.1 },
    ],
    defaults: () => ({ type: 'deco', x: 0, y: 0, size: 0.8, rotSpeed: 0.5 }),
  },

  // ── 可收集物 ──
  {
    type: 'orb', name: '光球', category: '可收集物',
    swatch: '#8ff6ff', icon: '●', factory: createOrb,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y', label: 'Y', type: 'number', step: 0.5 },
    ],
    defaults: () => ({ type: 'orb', x: 0, y: 0 }),
  },
  {
    type: 'jumpBoost', name: '双跳光球', category: '可收集物',
    swatch: '#ffb347', icon: '⏫', factory: createJumpBoost,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y', label: 'Y', type: 'number', step: 0.5 },
    ],
    defaults: () => ({ type: 'jumpBoost', x: 0, y: 0 }),
  },
  {
    type: 'checkpoint', name: '检查点', category: '可收集物',
    swatch: '#7df9ff', icon: '🏁', factory: createCheckpoint,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y', label: 'Y', type: 'number', step: 0.5 },
    ],
    defaults: () => ({ type: 'checkpoint', x: 0, y: 0 }),
  },

  // ── 机关 ──
  {
    type: 'mover', name: '移动平台', category: '机关',
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
    type: 'laser', name: '激光栅栏', category: '机关',
    swatch: '#ff2d55', icon: '⚡', factory: createLaser,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y0', label: '底部 Y', type: 'number', step: 0.5 },
      { key: 'len', label: '高度', type: 'number', step: 0.5, min: 0.1 },
      { key: 'ph', label: '相位', type: 'number', step: 0.1 },
    ],
    defaults: () => ({ type: 'laser', x: 0, y0: 0, len: 6, ph: 0 }),
  },
  {
    type: 'springPad', name: '弹簧平台', category: '机关',
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
    defaults: () => ({ type: 'springPad', x: 0, y: 0, w: 2, h: 0.6, forceX: 0, forceY: 12, duration: 0.15 }),
  },

  // ── 特殊 ──
  {
    type: 'nova', name: 'NOVA 终点', category: '特殊',
    swatch: '#c07dff', icon: '★', factory: createNova,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y', label: 'Y', type: 'number', step: 0.5 },
    ],
    defaults: () => ({ type: 'nova', x: 0, y: 0 }),
  },
  {
    type: 'hint', name: '提示文字', category: '特殊',
    swatch: '#ffd700', icon: '💬', factory: null,
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.5 },
      { key: 'y', label: 'Y', type: 'number', step: 0.5 },
      { key: 'text', label: '文案', type: 'string', placeholder: '提示内容' },
    ],
    defaults: () => ({ type: 'hint', x: 0, y: 0, text: '提示' }),
  },
];

export function getPrefabEntry(type: InstanceType): PrefabEntry | undefined {
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