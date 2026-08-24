/**
 * 编辑器状态管理 —— 地图数据、选中、工具、撤销/重做。
 */
import type { MapInstance, InstanceType, MapData } from './mapTypes';
import { createEmptyMapData } from './mapTypes';

export class EditorStore {
  map: MapData = createEmptyMapData();
  /**
   * 选中的实例索引。
   * 特例：[-1] 表示选中出生点（playerSpawn）。
   */
  selection: number[] = [];
  /** 当前调色板工具（null = 选择模式） */
  tool: InstanceType | null = null;
  /** 网格吸附步长 */
  snap = 0.5;
  /** 锁定工具：放置后不自动清除（批量放置） */
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

  /* ==================== 地图元数据 ==================== */

  setMapMeta(partial: Partial<Pick<MapData, 'id' | 'name' | 'width' | 'height' | 'playerSpawn'>>): void {
    this._snapshot();
    Object.assign(this.map, partial);
    this._notify();
  }

  /* ==================== 实例操作 ==================== */

  addInstance(inst: MapInstance): number {
    this._snapshot();
    const idx = this.map.instances.length;
    this.map.instances.push(inst);
    this.selection = [idx];
    this._notify();
    return idx;
  }

  removeSelected(): void {
    if (this.selection.length === 0) return;
    this._snapshot();
    // 从高到低删除
    const sorted = [...this.selection].sort((a, b) => b - a);
    for (const i of sorted) this.map.instances.splice(i, 1);
    this.selection = [];
    this._notify();
  }

  duplicateSelected(): void {
    if (this.selection.length === 0) return;
    this._snapshot();
    const newIndices: number[] = [];
    for (const i of this.selection) {
      const clone = JSON.parse(JSON.stringify(this.map.instances[i])) as MapInstance;
      // 偏移 1 格避免重叠
      const pos = (inst: any) => {
        if (inst.x0 !== undefined) inst.x0 += 1;
        else if (inst.x !== undefined) inst.x += 1;
        inst.y += 1;
      };
      pos(clone);
      newIndices.push(this.map.instances.length);
      this.map.instances.push(clone);
    }
    this.selection = newIndices;
    this._notify();
  }

  moveSelected(dx: number, dy: number): void {
    for (const i of this.selection) {
      const inst = this.map.instances[i];
      this._moveInstance(inst, dx, dy);
    }
    this._notify();
  }

  commitMove(): void {
    this._snapshot();
    // 移动后被 pushUndo 了
  }

  private _moveInstance(inst: MapInstance, dx: number, dy: number): void {
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

  /** 更新实例的某个字段 */
  updateInstanceField(index: number, key: string, value: number | string): void {
    this._snapshot();
    const inst = this.map.instances[index] as any;
    if (inst !== undefined) {
      inst[key] = value;
    }
    this._notify();
  }

  /* ==================== 选中 ==================== */

  select(index: number, add = false): void {
    if (add) {
      const pos = this.selection.indexOf(index);
      if (pos >= 0) this.selection.splice(pos, 1);
      else this.selection.push(index);
    } else {
      this.selection = [index];
    }
    this._notify();
  }

  /** 选中出生点（特例 selection = [-1]） */
  selectSpawn(): void {
    this.selection = [-1];
    this._notify();
  }

  /** 当前是否选中出生点 */
  isSpawnSelected(): boolean {
    return this.selection.length === 1 && this.selection[0] === -1;
  }

  /** 移动出生点（增量，拖拽时实时调用） */
  moveSpawn(dx: number, dy: number): void {
    this.map.playerSpawn.x += dx;
    this.map.playerSpawn.y += dy;
    this._notify();
  }

  /** 设置出生点坐标（inspector 输入） */
  setSpawnPos(x: number, y: number): void {
    this._snapshot();
    this.map.playerSpawn.x = x;
    this.map.playerSpawn.y = y;
    this._notify();
  }

  clearSelection(): void {
    this.selection = [];
    this._notify();
  }

  /* ==================== 撤销/重做 ==================== */

  undo(): void {
    if (this.undoStack.length <= 1) return;
    this.redoStack.push(JSON.stringify(this.map));
    this.undoStack.pop();
    this.map = JSON.parse(this.undoStack[this.undoStack.length - 1]);
    this.selection = [];
    this._notify();
  }

  redo(): void {
    if (this.redoStack.length === 0) return;
    this.undoStack.push(JSON.stringify(this.map));
    this.map = JSON.parse(this.redoStack.pop()!);
    this.selection = [];
    this._notify();
  }

  /* ==================== 完整替换 ==================== */

  loadMap(data: MapData): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.map = data;
    this.selection = [];
    this.tool = null;
    this._snapshot();
    this._notify();
  }

  /** 当前地图的 JSON 深拷贝 */
  mapSnapshot(): MapData {
    return JSON.parse(JSON.stringify(this.map));
  }
}