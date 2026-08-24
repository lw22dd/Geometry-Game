/**
 * 地图实例类型 —— 编辑器内使用的数据格式。
 *
 * 部分类型从游戏侧 `@game/types` 复用 spawn 数据形状，确保同步。
 */
import type { MoverSpawnData, LaserSpawnData, SpringPadSpawnData } from '@game/types';

/* ==================== 实例类型 ==================== */

export interface SolidInstance {
  type: 'solid';
  x: number; y: number; w: number; h: number;
}

export interface SpikeInstance {
  type: 'spike';
  x: number; y: number;
}

export interface DecoInstance {
  type: 'deco';
  x: number; y: number; size: number; rotSpeed: number;
}

export interface HintInstance {
  type: 'hint';
  x: number; y: number; text: string;
}

export interface MoverInstance extends MoverSpawnData {
  type: 'mover';
}

export interface LaserInstance extends LaserSpawnData {
  type: 'laser';
}

export interface OrbInstance {
  type: 'orb';
  x: number; y: number;
}

export interface JumpBoostInstance {
  type: 'jumpBoost';
  x: number; y: number;
}

export interface CheckpointInstance {
  type: 'checkpoint';
  x: number; y: number;
}

export interface NovaInstance {
  type: 'nova';
  x: number; y: number;
}

export interface SpringPadInstance extends SpringPadSpawnData {
  type: 'springPad';
}

export type MapInstance =
  | SolidInstance
  | SpikeInstance
  | DecoInstance
  | HintInstance
  | MoverInstance
  | LaserInstance
  | OrbInstance
  | JumpBoostInstance
  | CheckpointInstance
  | NovaInstance
  | SpringPadInstance;

export type InstanceType = MapInstance['type'];

/* ==================== 地图存档 ==================== */

export interface MapData {
  version: 1;
  id: string;
  name: string;
  width: number;
  height: number;
  playerSpawn: { x: number; y: number };
  instances: MapInstance[];
}

export function createEmptyMapData(id = 'untitled', name = '未命名关卡'): MapData {
  return {
    version: 1,
    id,
    name,
    width: 120,
    height: 72,
    playerSpawn: { x: 6, y: 4 },
    instances: [],
  };
}

/* ==================== 实例辅助函数 ==================== */

/** 获取实例的「锚点」世界坐标（用于选中/移动/放置） */
export function instancePosition(inst: MapInstance): { x: number; y: number } {
  switch (inst.type) {
    case 'solid':   return { x: inst.x, y: inst.y };
    case 'spike':   return { x: inst.x, y: inst.y };
    case 'deco':    return { x: inst.x, y: inst.y };
    case 'hint':    return { x: inst.x, y: inst.y };
    case 'mover':   return { x: inst.x0, y: inst.y };
    case 'laser':   return { x: inst.x, y: inst.y0 };
    case 'orb':     return { x: inst.x, y: inst.y };
    case 'jumpBoost': return { x: inst.x, y: inst.y };
    case 'checkpoint': return { x: inst.x, y: inst.y };
    case 'nova':    return { x: inst.x, y: inst.y };
    case 'springPad': return { x: inst.x, y: inst.y };
  }
}

/** 移动实例的锚点（增量） */
export function moveInstance(inst: MapInstance, dx: number, dy: number): void {
  switch (inst.type) {
    case 'solid':   inst.x += dx; inst.y += dy; break;
    case 'spike':   inst.x += dx; inst.y += dy; break;
    case 'deco':    inst.x += dx; inst.y += dy; break;
    case 'hint':    inst.x += dx; inst.y += dy; break;
    case 'mover':   inst.x0 += dx; inst.y += dy; break;
    case 'laser':   inst.x += dx; inst.y0 += dy; break;
    case 'orb':     inst.x += dx; inst.y += dy; break;
    case 'jumpBoost': inst.x += dx; inst.y += dy; break;
    case 'checkpoint': inst.x += dx; inst.y += dy; break;
    case 'nova':    inst.x += dx; inst.y += dy; break;
    case 'springPad': inst.x += dx; inst.y += dy; break;
  }
}

/** 实例的显示标签 */
export function instanceLabel(inst: MapInstance): string {
  switch (inst.type) {
    case 'solid':   return `平台 (${inst.x.toFixed(1)}, ${inst.y.toFixed(1)})`;
    case 'spike':   return `尖刺 (${inst.x.toFixed(1)}, ${inst.y.toFixed(1)})`;
    case 'deco':    return `装饰 (${inst.x.toFixed(1)}, ${inst.y.toFixed(1)})`;
    case 'hint':    return `提示: ${inst.text}`;
    case 'mover':   return `移动平台 (${inst.x0.toFixed(1)}, ${inst.y.toFixed(1)})`;
    case 'laser':   return `激光 (${inst.x.toFixed(1)}, ${inst.y0.toFixed(1)})`;
    case 'orb':     return `光球 (${inst.x.toFixed(1)}, ${inst.y.toFixed(1)})`;
    case 'jumpBoost': return `双跳 (${inst.x.toFixed(1)}, ${inst.y.toFixed(1)})`;
    case 'checkpoint': return `检查点 (${inst.x.toFixed(1)}, ${inst.y.toFixed(1)})`;
    case 'nova':    return `NOVA (${inst.x.toFixed(1)}, ${inst.y.toFixed(1)})`;
    case 'springPad': return `弹簧 (${inst.x.toFixed(1)}, ${inst.y.toFixed(1)})`;
  }
}

/**
 * 实例的命中区域（世界坐标 AABB）—— 与渲染几何一致。
 * 这是「点击触发网格体」的唯一权威定义：
 * hitTest 用它做命中判定，render.ts 用它绘制选中/悬停框。
 */
export function instanceHitBounds(inst: MapInstance, minSize = 0.6): { x: number; y: number; w: number; h: number } {
  switch (inst.type) {
    case 'solid':
      return { x: inst.x, y: inst.y, w: inst.w, h: inst.h };
    case 'spike': {
      const w = Math.max(1, minSize), h = Math.max(1, minSize);
      return { x: inst.x - 0.1, y: inst.y - 0.1, w: w + 0.2, h: h + 0.2 };
    }
    case 'deco': {
      const r = Math.max(inst.size / 2, minSize / 2);
      return { x: inst.x - r, y: inst.y - r, w: r * 2, h: r * 2 };
    }
    case 'hint':
      return { x: inst.x - 0.2, y: inst.y - 0.6, w: 5.4, h: 1.2 };
    case 'mover':
      return { x: inst.x0, y: inst.y, w: inst.w, h: inst.h };
    case 'laser':
      return { x: inst.x - 0.3, y: inst.y0 - 0.2, w: 0.6, h: inst.len + 0.4 };
    case 'orb': {
      const r = Math.max(0.4, minSize / 2);
      return { x: inst.x - r, y: inst.y - r, w: r * 2, h: r * 2 };
    }
    case 'jumpBoost': {
      const r = Math.max(0.45, minSize / 2);
      return { x: inst.x - r, y: inst.y - r, w: r * 2, h: r * 2 };
    }
    case 'checkpoint':
      return { x: inst.x - 0.9, y: inst.y - 0.1, w: 1.8, h: 6.6 };
    case 'nova': {
      const r = Math.max(0.72, minSize / 2);
      return { x: inst.x - r, y: inst.y - r, w: r * 2, h: r * 2 };
    }
    case 'springPad':
      return { x: inst.x, y: inst.y, w: inst.w, h: inst.h };
  }
}

/**
 * 命中检测：鼠标世界点 (mx,my) 是否命中实例。
 * 判定区域 = instanceHitBounds（与渲染几何一致），
 * 过小物体以最小像素点击尺寸兜底。
 */
export function hitTest(inst: MapInstance, mx: number, my: number, minSize = 0.6): boolean {
  const b = instanceHitBounds(inst, minSize);
  return mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;
}