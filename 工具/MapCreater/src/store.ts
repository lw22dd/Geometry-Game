/**
 * 编辑器状态管理 —— 两层地图数据、选中、工具、撤销/重做。
 *
 * selection 结构：
 *   { layer: 'geometry', index: n }  → 几何图元
 *   { layer: 'objects', index: n }   → 对象实例
 *   { layer: 'spawn' }               → 出生点（唯一）
 */
import type { MapInstance, MapData, GeometryItem, RectItem } from './mapTypes';
import { createEmptyMapData, migrateMapData, moveGeometry, moveInstance } from './mapTypes';

/** 编辑器模式 */
export type EditorMode = 'geometry' | 'objects';

/** 几何工具栏工具 */
export type GeomTool = 'select' | 'rect';

/** 选中引用 */
export type Sel =
  | { layer: 'geometry'; index: number }
  | { layer: 'objects'; index: number }
  | { layer: 'spawn' };

export class EditorStore {
  map: MapData = createEmptyMapData();
  /** 选中引用列表（MVP 单选为主） */
  selection: Sel[] = [];
  /** 当前模式 */
  mode: EditorMode = 'geometry';
  /** 几何模式工具 */
  geomTool: GeomTool = 'select';
  /** 对象模式工具（null = 选择；值为调色板条目的 toolId） */
  objTool: string | null = null;
  /** 当前激活的「放置类」工具（对象或几何绘制），用于统一提示 */
  tool: string | 'rect' | null = null;
  /** 网格吸附步长 */
  snap = 0.5;
  /** 旋转吸附步长（度） */
  rotationSnap = 5;
  /** 锁定工具：放置后不自动清除 */
  lockPlace = false;

  private undoStack: string[] = [];
  private redoStack: string[] = [];
  onChange: (() => void) | null = null;

  constructor() {
    this._snapshot();
  }

  /* ==================== 修改通知 ==================== */

  private _notify(): void {
    this.onChange?.();
  }

  private _snapshot(): void {
    this.undoStack.push(JSON.stringify(this.map));
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  /* ==================== 模式与工具 ==================== */

  setMode(mode: EditorMode): void {
    this.mode = mode;
    // 模式切换时清空选中与放置工具
    this.selection = [];
    this.tool = 'rect'; // 几何模式默认矩形工具
    if (mode === 'objects') this.tool = this.objTool;
    if (mode === 'geometry') this.geomTool = 'rect';
    this._notify();
  }

  setObjTool(t: string | null): void {
    this.objTool = t;
    this.tool = t;
    this.selection = [];
    this._notify();
  }

  setGeomTool(t: GeomTool): void {
    this.geomTool = t;
    this.tool = t === 'rect' ? 'rect' : null;
    this.selection = [];
    this._notify();
  }

  /* ==================== 地图元数据 ==================== */

  setMapMeta(partial: Partial<Pick<MapData, 'id' | 'name' | 'width' | 'height' | 'playerSpawn'>>): void {
    this._snapshot();
    Object.assign(this.map, partial);
    this._notify();
  }

  /* ==================== 几何操作 ==================== */

  /** 添加矩形（返回索引） */
  addRect(x: number, y: number, w: number, h: number, rotation = 0): number {
    this._snapshot();
    const item: RectItem = { type: 'rect', x, y, w, h, rotation };
    const idx = this.map.layers.geometry.length;
    this.map.layers.geometry.push(item);
    this.selection = [{ layer: 'geometry', index: idx }];
    this._notify();
    return idx;
  }

  /** 更新几何选中项（x/y/w/h/rotation） */
  updateGeometryField(index: number, key: string, value: number): void {
    this._snapshot();
    const item = this.map.layers.geometry[index];
    if (item) (item as any)[key] = value;
    this._notify();
  }

  /** 旋转几何选中项（增量，度），实时调用 */
  rotateSelected(deltaDeg: number): void {
    for (const sel of this.selection) {
      if (sel.layer !== 'geometry') continue;
      const item = this.map.layers.geometry[sel.index];
      if (item && item.type === 'rect') {
        item.rotation = (item.rotation + deltaDeg) % 360;
      }
    }
    this._notify();
  }

  /** 拖动旋转手柄时：将旋转设为「手柄指向角 - 90°」（手柄初始在顶部） */
  rotateToAngle(deg: number): void {
    for (const sel of this.selection) {
      if (sel.layer !== 'geometry') continue;
      const item = this.map.layers.geometry[sel.index];
      if (item && item.type === 'rect') {
        item.rotation = (deg % 360 + 360) % 360;
      }
    }
    this._notify();
  }

  /** 缩放几何选中项（按角引脚）：MVP 语义 = 中心固定，重设 w/h */
  resizeRect(index: number, w: number, h: number): void {
    const item = this.map.layers.geometry[index];
    if (!item || item.type !== 'rect') return;
    item.w = Math.max(0.1, w);
    item.h = Math.max(0.1, h);
    this._notify();
  }

  /* ==================== 对象操作 ==================== */

  addInstance(inst: MapInstance): number {
    this._snapshot();
    const idx = this.map.layers.objects.length;
    this.map.layers.objects.push(inst);
    this.selection = [{ layer: 'objects', index: idx }];
    this._notify();
    return idx;
  }

  /* ==================== 通用选中操作 ==================== */

  removeSelected(): void {
    if (this.selection.length === 0) return;
    this._snapshot();
    // 按 layer 分组删除（倒序）
    const geomIdx = this.selection
      .filter((s): s is Sel & { layer: 'geometry' } => s.layer === 'geometry')
      .map(s => s.index).sort((a, b) => b - a);
    const objIdx = this.selection
      .filter((s): s is Sel & { layer: 'objects' } => s.layer === 'objects')
      .map(s => s.index).sort((a, b) => b - a);
    for (const i of geomIdx) this.map.layers.geometry.splice(i, 1);
    for (const i of objIdx) this.map.layers.objects.splice(i, 1);
    this.selection = [];
    this._notify();
  }

  duplicateSelected(): void {
    if (this.selection.length === 0) return;
    this._snapshot();
    const newSel: Sel[] = [];
    for (const sel of this.selection) {
      if (sel.layer === 'geometry') {
        const item = this.map.layers.geometry[sel.index];
        const clone = JSON.parse(JSON.stringify(item)) as GeometryItem;
        moveGeometry(clone, this.snap, this.snap);
        newSel.push({ layer: 'geometry', index: this.map.layers.geometry.length });
        this.map.layers.geometry.push(clone);
      } else if (sel.layer === 'objects') {
        const inst = this.map.layers.objects[sel.index];
        const clone = JSON.parse(JSON.stringify(inst)) as MapInstance;
        moveInstance(clone, this.snap, this.snap);
        newSel.push({ layer: 'objects', index: this.map.layers.objects.length });
        this.map.layers.objects.push(clone);
      }
    }
    this.selection = newSel;
    this._notify();
  }

  moveSelected(dx: number, dy: number): void {
    for (const sel of this.selection) {
      if (sel.layer === 'geometry') {
        const item = this.map.layers.geometry[sel.index];
        if (item) moveGeometry(item, dx, dy);
      } else if (sel.layer === 'objects') {
        const inst = this.map.layers.objects[sel.index];
        if (inst) moveInstance(inst, dx, dy);
      }
    }
    this._notify();
  }

  commitMove(): void {
    this._snapshot();
  }

  /** 更新对象实例字段（支持点路径，如 "force.x" → inst.force.x） */
  updateInstanceField(index: number, key: string, value: number | string): void {
    this._snapshot();
    const inst = this.map.layers.objects[index] as any;
    if (inst === undefined) return;
    const parts = key.split('.');
    let target = inst;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      // 中间段不存在时创建对象（如 force 未初始化）
      if (target[seg] == null || typeof target[seg] !== 'object') target[seg] = {};
      target = target[seg];
    }
    target[parts[parts.length - 1]] = value;
    this._notify();
  }

  /* ==================== 出生点 ==================== */

  selectSpawn(): void {
    this.selection = [{ layer: 'spawn' }];
    this._notify();
  }

  isSpawnSelected(): boolean {
    return this.selection.length === 1 && this.selection[0].layer === 'spawn';
  }

  moveSpawn(dx: number, dy: number): void {
    this.map.playerSpawn.x += dx;
    this.map.playerSpawn.y += dy;
    this._notify();
  }

  setSpawnPos(x: number, y: number): void {
    this._snapshot();
    this.map.playerSpawn.x = x;
    this.map.playerSpawn.y = y;
    this._notify();
  }

  /* ==================== 选中 ==================== */

  select(sel: Sel): void {
    this.selection = [sel];
    this._notify();
  }

  clearSelection(): void {
    this.selection = [];
    this._notify();
  }

  /** 当前选中的几何索引（单选有效时返回） */
  get selGeomIndex(): number | null {
    if (this.selection.length === 1 && this.selection[0].layer === 'geometry') {
      return this.selection[0].index;
    }
    return null;
  }

  /** 当前选中的对象索引（单选有效时返回） */
  get selObjIndex(): number | null {
    if (this.selection.length === 1 && this.selection[0].layer === 'objects') {
      return this.selection[0].index;
    }
    return null;
  }

  /* ==================== 撤销/重做 ==================== */

  undo(): void {
    if (this.undoStack.length <= 1) return;
    this.redoStack.push(JSON.stringify(this.map));
    this.undoStack.pop();
    this.map = migrateMapData(JSON.parse(this.undoStack[this.undoStack.length - 1]));
    this.selection = [];
    this._notify();
  }

  redo(): void {
    if (this.redoStack.length === 0) return;
    this.undoStack.push(JSON.stringify(this.map));
    this.map = migrateMapData(JSON.parse(this.redoStack.pop()!));
    this.selection = [];
    this._notify();
  }

  /* ==================== 完整替换 ==================== */

  loadMap(raw: unknown): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.map = migrateMapData(raw);
    this.selection = [];
    this._snapshot();
    this._notify();
  }

  /** 当前地图的 JSON 深拷贝 */
  mapSnapshot(): MapData {
    return JSON.parse(JSON.stringify(this.map));
  }

  /* ==================== 剪贴板（复制/粘贴） ==================== */

  clipboard: { type: 'geom' | 'obj'; data: any } | null = null;

  /** 复制当前选中项（单选有效）到剪贴板 */
  copySelected(): boolean {
    if (this.selection.length === 0) return false;
    const sel = this.selection[0];
    if (sel.layer === 'geometry') {
      this.clipboard = { type: 'geom', data: JSON.parse(JSON.stringify(this.map.layers.geometry[sel.index])) };
    } else if (sel.layer === 'objects') {
      this.clipboard = { type: 'obj', data: JSON.parse(JSON.stringify(this.map.layers.objects[sel.index])) };
    } else {
      return false;
    }
    return true;
  }

  /** 从剪贴板粘贴（偏移 snap 后插入，选中新项） */
  pasteFromClipboard(): boolean {
    if (!this.clipboard) return false;
    this._snapshot();
    const snap = this.snap || 0.5;
    if (this.clipboard.type === 'geom') {
      const d = JSON.parse(JSON.stringify(this.clipboard.data)) as GeometryItem;
      moveGeometry(d, snap, snap);
      this.map.layers.geometry.push(d);
      this.selection = [{ layer: 'geometry', index: this.map.layers.geometry.length - 1 }];
    } else {
      const d = JSON.parse(JSON.stringify(this.clipboard.data)) as MapInstance;
      moveInstance(d, snap, snap);
      this.map.layers.objects.push(d);
      this.selection = [{ layer: 'objects', index: this.map.layers.objects.length - 1 }];
    }
    this._notify();
    return true;
  }
}