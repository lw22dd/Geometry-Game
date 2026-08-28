/**
 * 地图数据模型 v2 —— 编辑器内使用的标准数据格式。
 *
 * 两层架构：
 *   - layers.geometry：基础地图矢量层（矩形，xywh + 旋转）
 *   - layers.objects：场景物品摆放层（预制体实例）
 *
 * 部分对象类型从游戏侧 `@game/types` 复用 spawn 数据形状，确保同步。
 */
import type { MoverSpawnData, LaserSpawnData, SpringPadSpawnData, PathSegment } from '@game/types';
import { buildCumulativeLengths, pathPosition } from '@game/core/path';

/* ==================== 几何图元（基础地图层） ==================== */

/** 矩形图元：x,y = 左下角（与游戏 R(x,y,w,h) 一致），rotation 绕中心（度） */
export interface RectItem {
  type: 'rect';
  x: number; y: number; w: number; h: number;
  /** 旋转角（度），绕矩形中心 */
  rotation: number;
}

/** 几何图元联合（未来可扩展 polygon / line） */
export type GeometryItem = RectItem;

/* ==================== 对象实例（场景物品层） ==================== */

export interface SpikeInstance {
  type: 'spike';
  x: number; y: number;
  rotation?: number;
}

export interface DecoInstance {
  type: 'deco';
  x: number; y: number; size: number; rotSpeed: number;
  rotation?: number;
}

export interface HintInstance {
  type: 'hint';
  x: number; y: number; text: string;
  rotation?: number;
}

export interface MoverInstance extends MoverSpawnData {
  type: 'mover';
  rotation?: number;
}

export interface LaserInstance extends LaserSpawnData {
  type: 'laser';
  rotation?: number;
}

export interface OrbInstance {
  type: 'orb';
  x: number; y: number;
  rotation?: number;
}

export interface JumpBoostInstance {
  type: 'jumpBoost';
  x: number; y: number;
  rotation?: number;
}

export interface CheckpointInstance {
  type: 'checkpoint';
  x: number; y: number;
  rotation?: number;
}

export interface NovaInstance {
  type: 'nova';
  x: number; y: number;
  rotation?: number;
}

export interface HookPickupInstance {
  type: 'hookPickup';
  x: number; y: number;
  rotation?: number;
}

/** 冲刺轨道（玻璃管道）：路径段数组 + 入口/出口弧长 + 捕获速度 */
export interface TrackInstance {
  type: 'track';
  segments: PathSegment[];
  entryDist: number;
  exitDist: number;
  speedThreshold?: number;
  /** 入口世界坐标（轨道移动/选中锚点；编辑器计算的派生值） */
  x: number; y: number;
  rotation?: number;
}

export interface SpringPadInstance extends SpringPadSpawnData {
  type: 'springPad';
  rotation?: number;
  /** 放置来源工具 id（区分垂直/水平弹簧等同类多预设，编辑器元数据） */
  toolId?: string;
}

export type MapInstance =
  | SpikeInstance
  | DecoInstance
  | HintInstance
  | MoverInstance
  | LaserInstance
  | OrbInstance
  | JumpBoostInstance
  | CheckpointInstance
  | NovaInstance
  | HookPickupInstance
  | TrackInstance
  | SpringPadInstance;

export type ObjectInstance = MapInstance;
export type InstanceType = MapInstance['type'];

/* ==================== 地图存档 v2 ==================== */

/**
 * 底盘可行走区（MVMap 风格）—— 由 MVMap 导入器生成，只读展示。
 * 每个元素是一块「同区域色的可行走带」，游戏渲染时按格线纹理平铺。
 *
 * 语义（模式 A / 恶魔城）：色块 = 区域 = 可行走空间，不是墙。
 * 碰撞体是 geometry（墙 = 包围盒 − 可行走区）；floorCells 只是
 * 「可行走区」的视觉层 + 区域划分参考。
 */
export interface FloorCell {
  x: number; y: number; w: number; h: number;
  /** 区域色（hex，如 "#4c8dd8"） */
  color: string;
}

export interface MapLayers {
  geometry: GeometryItem[];
  objects: ObjectInstance[];
  /** MVMap 底盘可行走区视觉层（只读）：合并矩形 + 区域色。缺失 = 无底盘风格。
   *  语义：色块 = 区域 = 可行走空间；墙 = geometry（包围盒 − 可行走区）。 */
  floorCells?: FloorCell[] | null;
  /** 底盘格子边长（游戏单位米），默认 1（1 MVMap 格 = 1 米） */
  gridSize?: number;
}

export interface MapData {
  version: 2;
  id: string;
  name: string;
  width: number;
  height: number;
  playerSpawn: { x: number; y: number };
  layers: MapLayers;
}

export function createEmptyMapData(id = 'untitled', name = '未命名关卡'): MapData {
  return {
    version: 2,
    id,
    name,
    width: 120,
    height: 72,
    playerSpawn: { x: 6, y: 4 },
    layers: { geometry: [], objects: [], floorCells: null, gridSize: 1 },
  };
}

/* ==================== v1 → v2 迁移 ==================== */

/** v1 存档形状（兼容读取） */
interface MapDataV1 {
  version: 1;
  id: string;
  name: string;
  width: number;
  height: number;
  playerSpawn: { x: number; y: number };
  /** v1 的实例列表（含 solid） */
  instances: (RectLike | any)[];
}

interface RectLike {
  type: 'solid';
  x: number; y: number; w: number; h: number;
}

/**
 * 任意版本 → 规范 v2。
 * v1：solid → layers.geometry，其余 → layers.objects。
 */
export function migrateMapData(raw: unknown): MapData {
  const src = raw as Partial<MapDataV1> & Partial<MapData>;

  const base = {
    id: src.id ?? 'untitled',
    name: src.name ?? '未命名关卡',
    width: src.width ?? 120,
    height: src.height ?? 72,
    playerSpawn: src.playerSpawn ?? { x: 6, y: 4 },
  };

  // 已经是 v2
  if (src.version === 2 && src.layers) {
    const result: MapData = {
      version: 2,
      ...base,
      layers: {
        geometry: src.layers.geometry ?? [],
        objects: src.layers.objects ?? [],
        floorCells: src.layers.floorCells ?? null,
        gridSize: src.layers.gridSize ?? 1,
      },
    };
    // 旧字段迁移：springPad 实例的 forceX/forceY → force: {x, y}
    for (const inst of result.layers.objects) {
      if (inst.type === 'springPad' && (inst as any).forceX !== undefined) {
        const old = inst as any;
        inst.force = { x: old.forceX, y: old.forceY };
        delete old.forceX;
        delete old.forceY;
      }
    }
    return result;
  }

  // v1 → v2
  const geometry: GeometryItem[] = [];
  const objects: ObjectInstance[] = [];
  for (const inst of src.instances ?? []) {
    if (inst && inst.type === 'solid') {
      const r = inst as RectLike;
      geometry.push({ type: 'rect', x: r.x, y: r.y, w: r.w, h: r.h, rotation: 0 });
    } else if (inst && typeof inst.type === 'string') {
      objects.push(inst as ObjectInstance);
    }
  }

  return { version: 2, ...base, layers: { geometry, objects, floorCells: null, gridSize: 1 } };
}

/* ==================== 几何辅助函数 ==================== */

/** 矩形中心（旋转轴） */
export function rectCenter(r: RectItem): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** 矩形旋转角 → 弧度 */
export function rectRad(r: RectItem): number {
  return (r.rotation * Math.PI) / 180;
}

/**
 * 旋转后矩形的世界 AABB（用于渲染裁剪与选中框绘制）
 */
export function rotatedRectBounds(r: RectItem): { x: number; y: number; w: number; h: number } {
  const corners = rectWorldCorners(r);
  const xs = corners.map(p => p.x), ys = corners.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * 矩形的四个世界坐标角点（逆时针 + 旋转，世界约定 Y 向上）。
 * hitTestRect / 渲染 / gizmo 全部基于此函数，保证三方一致。
 * 顺序：左下 → 右下 → 右上 → 左上
 */
export function rectWorldCorners(r: RectItem): { x: number; y: number }[] {
  const c = rectCenter(r);
  const rad = rectRad(r);
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const hw = r.w / 2, hh = r.h / 2;
  // 世界旋转：w = c + R_world(θ)·local，R_world(θ) = [cos,-sin; sin,cos]
  const rot = (lx: number, ly: number) => ({
    x: c.x + lx * cos - ly * sin,
    y: c.y + lx * sin + ly * cos,
  });
  return [rot(-hw, -hh), rot(hw, -hh), rot(hw, hh), rot(-hw, hh)];
}

/**
 * 旋转手柄锚点：矩形顶部中心在世界的坐标（local (0, +hh) 旋转后）。
 */
export function rectTopCenter(r: RectItem): { x: number; y: number } {
  const c = rectCenter(r);
  const rad = rectRad(r);
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const hh = r.h / 2;
  // local (0, hh)：x = 0*cos - hh*sin, y = 0*sin + hh*cos
  return { x: c.x + -hh * sin, y: c.y + hh * cos };
}

/**
 * 命中检测：鼠标世界点是否命中（逆旋转回局部坐标后做 AABB 判定）。
 */
export function hitTestRect(r: RectItem, mx: number, my: number, pad = 0.1): boolean {
  const c = rectCenter(r);
  const rad = rectRad(r);
  const cos = Math.cos(rad), sin = Math.sin(rad);
  // 世界 → 局部（逆旋转）
  const dx = mx - c.x, dy = my - c.y;
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;
  return Math.abs(lx) <= r.w / 2 + pad && Math.abs(ly) <= r.h / 2 + pad;
}

/** 移动几何图元（增量） */
export function moveGeometry(item: GeometryItem, dx: number, dy: number): void {
  item.x += dx;
  item.y += dy;
}

/* ==================== 对象实例辅助函数 ==================== */

/** 获取实例的「锚点」世界坐标（用于选中/移动/放置） */
export function instancePosition(inst: MapInstance): { x: number; y: number } {
  switch (inst.type) {
    case 'spike':   return { x: inst.x, y: inst.y };
    case 'deco':    return { x: inst.x, y: inst.y };
    case 'hint':    return { x: inst.x, y: inst.y };
    case 'mover':   return { x: inst.x0, y: inst.y };
    case 'laser':   return { x: inst.x, y: inst.y0 };
    case 'orb':     return { x: inst.x, y: inst.y };
    case 'jumpBoost': return { x: inst.x, y: inst.y };
    case 'checkpoint': return { x: inst.x, y: inst.y };
    case 'nova':    return { x: inst.x, y: inst.y };
    case 'hookPickup': return { x: inst.x, y: inst.y };
    case 'track':   return { x: inst.x, y: inst.y };
    case 'springPad': return { x: inst.x, y: inst.y };
  }
}

/** 移动实例锚点（增量） */
export function moveInstance(inst: MapInstance, dx: number, dy: number): void {
  switch (inst.type) {
    case 'spike':   inst.x += dx; inst.y += dy; break;
    case 'deco':    inst.x += dx; inst.y += dy; break;
    case 'hint':    inst.x += dx; inst.y += dy; break;
    case 'mover':   inst.x0 += dx; inst.y += dy; break;
    case 'laser':   inst.x += dx; inst.y0 += dy; break;
    case 'orb':     inst.x += dx; inst.y += dy; break;
    case 'jumpBoost': inst.x += dx; inst.y += dy; break;
    case 'checkpoint': inst.x += dx; inst.y += dy; break;
    case 'nova':    inst.x += dx; inst.y += dy; break;
    case 'hookPickup': inst.x += dx; inst.y += dy; break;
    case 'track': {
      inst.x += dx; inst.y += dy;
      for (const seg of inst.segments) {
        if (seg.type === 'line') { seg.x1 += dx; seg.y1 += dy; seg.x2 += dx; seg.y2 += dy; }
        else if (seg.type === 'arc') { seg.cx += dx; seg.cy += dy; }
      }
      break;
    }
    case 'springPad': inst.x += dx; inst.y += dy; break;
  }
}

/** 实例的显示标签 */
export function instanceLabel(inst: MapInstance): string {
  switch (inst.type) {
    case 'spike':   return `尖刺 (${inst.x.toFixed(1)}, ${inst.y.toFixed(1)})`;
    case 'deco':    return `装饰 (${inst.x.toFixed(1)}, ${inst.y.toFixed(1)})`;
    case 'hint':    return `提示: ${inst.text}`;
    case 'mover':   return `移动平台 (${inst.x0.toFixed(1)}, ${inst.y.toFixed(1)})`;
    case 'laser':   return `激光 (${inst.x.toFixed(1)}, ${inst.y0.toFixed(1)})`;
    case 'orb':     return `光球 (${inst.x.toFixed(1)}, ${inst.y.toFixed(1)})`;
    case 'jumpBoost': return `双跳 (${inst.x.toFixed(1)}, ${inst.y.toFixed(1)})`;
    case 'checkpoint': return `检查点 (${inst.x.toFixed(1)}, ${inst.y.toFixed(1)})`;
    case 'nova':    return `NOVA (${inst.x.toFixed(1)}, ${inst.y.toFixed(1)})`;
    case 'hookPickup': return `钩锁 (${inst.x.toFixed(1)}, ${inst.y.toFixed(1)})`;
    case 'track':   return `轨道 (${inst.x.toFixed(1)}, ${inst.y.toFixed(1)})`;
    case 'springPad': return `${inst.h > inst.w ? '水平' : '垂直'}弹簧 (${inst.x.toFixed(1)}, ${inst.y.toFixed(1)})`;
  }
}

/**
 * 实例的命中区域（世界坐标 AABB）—— 与渲染几何一致。
 */
export function instanceHitBounds(inst: MapInstance, minSize = 0.6): { x: number; y: number; w: number; h: number } {
  switch (inst.type) {
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
      return { x: inst.x - 1.1, y: inst.y, w: 2.2, h: 3.4 };
    case 'nova': {
      const r = Math.max(0.72, minSize / 2);
      return { x: inst.x - r, y: inst.y - r, w: r * 2, h: r * 2 };
    }
    case 'hookPickup': {
      const r = Math.max(0.6, minSize / 2);
      return { x: inst.x - r, y: inst.y - r, w: r * 2, h: r * 2 };
    }
    case 'track': {
      // 轨道命中范围 = 路径段包围盒（退化段补最小尺寸）
      let minX = inst.x, maxX = inst.x, minY = inst.y, maxY = inst.y;
      for (const seg of inst.segments) {
        if (seg.type === 'line') {
          minX = Math.min(minX, seg.x1, seg.x2); maxX = Math.max(maxX, seg.x1, seg.x2);
          minY = Math.min(minY, seg.y1, seg.y2); maxY = Math.max(maxY, seg.y1, seg.y2);
        } else {
          minX = Math.min(minX, seg.cx - seg.radius); maxX = Math.max(maxX, seg.cx + seg.radius);
          minY = Math.min(minY, seg.cy - seg.radius); maxY = Math.max(maxY, seg.cy + seg.radius);
        }
      }
      const w = Math.max(maxX - minX, minSize);
      const h = Math.max(maxY - minY, minSize);
      return { x: minX, y: minY, w, h };
    }
    case 'springPad':
      return { x: inst.x, y: inst.y, w: inst.w, h: inst.h };
  }
}

/** 命中检测：鼠标世界点是否命中对象实例（考虑旋转） */
export function hitTest(inst: MapInstance, mx: number, my: number, minSize = 0.6): boolean {
  const rot = inst.rotation ?? 0;
  if (rot !== 0) {
    // 旋转物体：把鼠标点逆旋转回局部坐标系后再做 AABB 判定
    const pos = instancePosition(inst);
    const rad = rot * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const dx = mx - pos.x, dy = my - pos.y;
    const lx = dx * cos + dy * sin;
    const ly = -dx * sin + dy * cos;
    // 局部坐标下的命中框（相对锚点）
    const b = instanceHitBounds(inst, minSize);
    const lx0 = b.x - pos.x, ly0 = b.y - pos.y;
    return lx >= lx0 && lx <= lx0 + b.w && ly >= ly0 && ly <= ly0 + b.h;
  }
  // 未旋转：直接检测
  const b = instanceHitBounds(inst, minSize);
  return mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;
}

/**
 * 将实例锚点设置到 (x, y)；轨道会整体平移路径段使入口点落到锚点。
 * 编辑器放置/幽灵预览用（与 moveInstance 增量移动区分）。
 */
export function placeInstanceAt(inst: MapInstance, x: number, y: number): void {
  if (inst.type === 'track') {
    // 入口点 = 路径上 entryDist 处；平移全部路径段使入口落在 (x, y)
    const cl = buildCumulativeLengths(inst.segments);
    const entry = pathPosition(inst.segments, cl, inst.entryDist);
    const dx = x - entry.x, dy = y - entry.y;
    for (const seg of inst.segments) {
      if (seg.type === 'line') { seg.x1 += dx; seg.y1 += dy; seg.x2 += dx; seg.y2 += dy; }
      else { seg.cx += dx; seg.cy += dy; }
    }
    inst.x = x; inst.y = y;
    return;
  }
  if (inst.type === 'mover') inst.x0 = x;
  else if (inst.type === 'laser') { inst.x = x; inst.y0 = y; }
  else { inst.x = x; inst.y = y; }
}