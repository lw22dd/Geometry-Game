/**
 * MapCreater 入口 —— 引导编辑器、挂载事件、主循环。
 *
 * 两层模式：
 *   - geometry：矢量绘制（矩形画笔 / 选择移动 / 角缩放 / 圆柄旋转）
 *   - objects：场景物品摆放
 */
import './style.css';
import { cv, ctx, resizeCanvas, DPR, VW, VH } from './canvas';
import { view, centerOn, screenToWorld, zoomAt, pan, snapToGrid } from './camera';
import { EditorStore } from './store';
import {
  renderGrid, renderGeometry, renderObjects, renderSelection, renderSpawn,
  renderGhost, renderRectPreview, renderMapBounds, updateStatusBar, renderHover,
} from './render';
import { buildPalette } from './palette';
import { buildInspector } from './inspector';
import { saveToFile, loadFromFile, showExport, autoSave, loadAutoSave, buildImportDialog, setExportTab, runSelfCheck } from './io';
import { createEmptyMapData, hitTest, hitTestRect, rectCenter, rectRad } from './mapTypes';
import { getPrefabEntry } from './registry';
import type { Sel } from './store';
import type { RectItem } from './mapTypes';
import { sx, sy } from './camera';

/* ==================== 初始化 ==================== */

const store = new EditorStore();

if (!loadAutoSave(store)) {
  store.loadMap(createEmptyMapData());
}
centerOn(store.map.playerSpawn.x, store.map.playerSpawn.y, 0.8);

buildPalette(store);
store.onChange = () => {
  buildInspector(store);
  updateStatusBar(store);
};
store.onChange();

/* ==================== 拖拽状态机 ==================== */

type DragKind =
  | 'none'
  | 'pan'         // 右键或空白左键拖拽平移
  | 'move'        // 移动选中项
  | 'draw-rect'   // 矩形画笔（几何模式）
  | 'resize'      // 角柄缩放
  | 'rotate';     // 顶部圆柄旋转

interface DragState {
  kind: DragKind;
  button: number;
  sx: number; sy: number;      // 屏幕起始
  wx: number; wy: number;      // 世界起始
  ax: number; ay: number;      // 绘制锚点（世界）
  target: Sel | null;          // 移动/缩放的选中目标
  resizedIndex: number | null; // 缩放目标几何索引
}

const drag: DragState = {
  kind: 'none', button: 0, sx: 0, sy: 0, wx: 0, wy: 0, ax: 0, ay: 0,
  target: null, resizedIndex: null,
};

let mouseWX = 0, mouseWY = 0;

function mouseXY(e: MouseEvent): [number, number] {
  const rect = cv.getBoundingClientRect();
  return [
    (e.clientX - rect.left) * (VW / rect.width),
    (e.clientY - rect.top) * (VH / rect.height),
  ];
}

/* ==================== 几何命中与手柄 ==================== */

/** 几何命中：返回几何索引或 null（几何模式下优先） */
function hitTestGeometry(wx: number, wy: number): number | null {
  for (let i = store.map.layers.geometry.length - 1; i >= 0; i--) {
    const item = store.map.layers.geometry[i];
    if (item.type === 'rect' && hitTestRect(item, wx, wy)) return i;
  }
  return null;
}

/** 对象命中：返回对象索引或 null */
function hitTestObjects(wx: number, wy: number): number | null {
  for (let i = store.map.layers.objects.length - 1; i >= 0; i--) {
    if (hitTest(store.map.layers.objects[i], wx, wy)) return i;
  }
  return null;
}

/** 出生点命中 */
function hitTestSpawn(wx: number, wy: number): boolean {
  const sp = store.map.playerSpawn;
  return Math.abs(wx - sp.x) < 1.5 && Math.abs(wy - sp.y) < 1.5;
}

/**
 * 检测选中矩形的交互部件。
 * 返回：'rotate' | 'corner' | 'body' | null
 * 基于屏幕距离判定（像素），保证手柄可点。
 */
function hitRectGizmo(item: RectItem, mx: number, my: number): 'rotate' | 'corner' | null {
  const c = rectCenter(item);
  const rad = rectRad(item);
  const ccx = sx(c.x), ccy = sy(c.y);
  const hw = item.w * view.SZ / 2, hh = item.h * view.SZ / 2;

  // 转屏幕坐标（考虑旋转）
  const toScreen = (lx: number, ly: number): [number, number] => {
    const cos = Math.cos(rad), sin = Math.sin(rad);
    return [ccx + lx * cos - ly * sin, ccy + lx * sin + ly * cos];
  };

  // 旋转手柄（顶部中心，世界 +Y）
  const [rhx, rhy] = toScreen(0, -hh - 16);
  if (Math.hypot(mx - rhx, my - rhy) < 12) return 'rotate';

  // 四个角
  const corners: [number, number][] = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  for (const [lx, ly] of corners) {
    const [px, py] = toScreen(lx, ly);
    if (Math.hypot(mx - px, my - py) < 9) return 'corner';
  }
  return null;
}

/* ==================== 鼠标事件 ==================== */

cv.addEventListener('mousedown', (e: MouseEvent) => {
  const [mx, my] = mouseXY(e);
  const w = screenToWorld(mx, my);

  drag.button = e.button;
  drag.sx = mx; drag.sy = my;
  drag.wx = w.x; drag.wy = w.y;
  drag.ax = w.x; drag.ay = w.y;
  drag.target = null;
  drag.resizedIndex = null;

  if (e.button !== 0) return;

  // ── 出生点优先 ──
  if (store.mode === 'objects' || store.mode === 'geometry') {
    if (hitTestSpawn(w.x, w.y)) {
      store.selectSpawn();
      drag.kind = 'move';
      drag.target = { layer: 'spawn' };
      return;
    }
  }

  if (store.mode === 'geometry') {
    handleGeomMouseDown(w.x, w.y, mx, my);
  } else {
    handleObjMouseDown(w.x, w.y);
  }
});

function handleGeomMouseDown(wx: number, wy: number, mx: number, my: number): void {
  // 已选中矩形的部件交互（选择工具下）
  if (store.geomTool === 'select' && store.selGeomIndex !== null) {
    const item = store.map.layers.geometry[store.selGeomIndex];
    if (item && item.type === 'rect') {
      const gizmo = hitRectGizmo(item, mx, my);
      if (gizmo === 'rotate') { drag.kind = 'rotate'; store.commitMove(); return; }
      if (gizmo === 'corner') {
        drag.kind = 'resize';
        drag.resizedIndex = store.selGeomIndex;
        store.commitMove();
        return;
      }
    }
  }

  // 命中几何 → 选中 + 移动
  const idx = hitTestGeometry(wx, wy);
  if (idx !== null) {
    store.select({ layer: 'geometry', index: idx });
    drag.kind = 'move';
    drag.target = { layer: 'geometry', index: idx };
    return;
  }

  // 矩形画笔：空白处按下开始绘制
  if (store.geomTool === 'rect') {
    drag.kind = 'draw-rect';
    store.clearSelection();
    return;
  }

  // 选择工具：空白拖拽 = 平移
  store.clearSelection();
  drag.kind = 'pan';
  drag.resizedIndex = null;
}

function handleObjMouseDown(wx: number, wy: number): void {
  // 激活了放置工具：优先放置新实例（点中已有对象时仍可选中/移动）
  if (store.objTool) {
    const entry = getPrefabEntry(store.objTool);
    if (entry) {
      const sx2 = snapToGrid(wx, store.snap);
      const sy2 = snapToGrid(wy, store.snap);
      const inst = entry.defaults();
      if (inst.type === 'mover') inst.x0 = sx2;
      else if (inst.type === 'laser') { inst.x = sx2; inst.y0 = sy2; }
      else { inst.x = sx2; inst.y = sy2; }
      store.addInstance(inst);
      if (!store.lockPlace) {
        store.setObjTool(null);
        buildPalette(store);
      }
      return;
    }
  }

  const idx = hitTestObjects(wx, wy);
  if (idx !== null) {
    store.select({ layer: 'objects', index: idx });
    drag.kind = 'move';
    drag.target = { layer: 'objects', index: idx };
    return;
  }
  store.clearSelection();
  drag.kind = 'pan';
}

cv.addEventListener('mousemove', (e: MouseEvent) => {
  const [mx, my] = mouseXY(e);
  const w = screenToWorld(mx, my);
  mouseWX = w.x; mouseWY = w.y;

  // 右键平移
  if (drag.button === 2) {
    pan(mx - drag.sx, my - drag.sy);
    drag.sx = mx; drag.sy = my;
    return;
  }

  if (drag.button !== 0) return;

  const dx = w.x - drag.wx, dy = w.y - drag.wy;

  switch (drag.kind) {
    case 'move': {
      if (Math.abs(mx - drag.sx) < 3 && Math.abs(my - drag.sy) < 3) return;
      drag.wx = w.x; drag.wy = w.y;
      if (drag.target?.layer === 'spawn') store.moveSpawn(dx, dy);
      else if (drag.target) store.moveSelected(dx, dy);
      break;
    }
    case 'draw-rect': {
      // 只更新画布（预览在 frame 中绘制），无需修改数据
      drag.wx = w.x; drag.wy = w.y;
      break;
    }
    case 'resize': {
      if (drag.resizedIndex === null) break;
      const item = store.map.layers.geometry[drag.resizedIndex];
      if (!item || item.type !== 'rect') break;
      // 计算鼠标在局部空间的位置（逆旋转），以中心为原点
      const c = rectCenter(item);
      const rad = rectRad(item);
      const dxw = w.x - c.x, dyw = w.y - c.y;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const lx = dxw * cos + dyw * sin;
      const ly = -dxw * sin + dyw * cos;
      const newW = snapToGrid(Math.max(0.1, Math.abs(lx) * 2), store.snap);
      const newH = snapToGrid(Math.max(0.1, Math.abs(ly) * 2), store.snap);
      store.resizeRect(drag.resizedIndex, newW, newH);
      break;
    }
    case 'rotate': {
      if (store.selGeomIndex === null) break;
      const item = store.map.layers.geometry[store.selGeomIndex];
      if (!item || item.type !== 'rect') break;
      const c = rectCenter(item);
      // 世界角（atan2 逆时针为正），旋转手柄初始在顶部（+Y 方向）
      const rawDeg = (Math.atan2(w.y - c.y, w.x - c.x) * 180 / Math.PI) - 90;
      const snapped = snapToGrid(rawDeg, store.rotationSnap);
      store.rotateToAngle(snapped);
      break;
    }
    case 'pan': {
      pan(mx - drag.sx, my - drag.sy);
      drag.sx = mx; drag.sy = my;
      break;
    }
    default:
      break;
  }
});

cv.addEventListener('mouseup', (e: MouseEvent) => {
  if (e.button !== 0) return;

  const [mx, my] = mouseXY(e);
  const w = screenToWorld(mx, my);

  if (drag.kind === 'draw-rect') {
    // 提交矩形（仅当拖动超过阈值）
    const moved = Math.abs(mx - drag.sx) > 3 || Math.abs(my - drag.sy) > 3;
    if (moved) {
      const x1 = snapToGrid(Math.min(drag.ax, w.x), store.snap);
      const y1 = snapToGrid(Math.min(drag.ay, w.y), store.snap);
      const x2 = snapToGrid(Math.max(drag.ax, w.x), store.snap);
      const y2 = snapToGrid(Math.max(drag.ay, w.y), store.snap);
      store.addRect(x1, y1, Math.max(0.1, x2 - x1), Math.max(0.1, y2 - y1));
      if (!store.lockPlace) {
        store.setGeomTool('select');
        buildPalette(store);
      }
    } else {
      // 原地点击：如果点中已有矩形则选中，否则保持绘制工具
      const idx = hitTestGeometry(w.x, w.y);
      if (idx !== null) {
        store.select({ layer: 'geometry', index: idx });
      }
    }
  }

  if (drag.kind === 'move') {
    store.commitMove();
  }

  drag.kind = 'none';
  drag.button = -1;
});

cv.addEventListener('contextmenu', (e) => e.preventDefault());

cv.addEventListener('wheel', (e: WheelEvent) => {
  e.preventDefault();
  const [mx, my] = mouseXY(e);
  const factor = e.deltaY > 0 ? 1.1 : 0.9;
  zoomAt(mx, my, factor);
}, { passive: false });

/* ==================== 键盘事件 ==================== */

document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (document.activeElement?.tagName === 'INPUT') return;
    store.removeSelected();
    e.preventDefault();
  }
  if (e.ctrlKey && e.key === 'z') { store.undo(); e.preventDefault(); }
  if (e.ctrlKey && e.key === 'Z' && e.shiftKey) { store.redo(); e.preventDefault(); }
  if (e.ctrlKey && e.key === 's') { saveToFile(store); e.preventDefault(); }
  if (e.ctrlKey && e.key === 'd') { store.duplicateSelected(); e.preventDefault(); }
  if (e.key === 'Escape') {
    if (drag.kind === 'draw-rect') {
      drag.kind = 'none';
      return;
    }
    store.clearSelection();
    buildPalette(store);
    store.onChange?.();
  }
});

/* ==================== 工具栏按钮 ==================== */

document.querySelectorAll('[data-cmd]').forEach(btn => {
  btn.addEventListener('click', () => {
    const cmd = (btn as HTMLElement).dataset.cmd!;
    switch (cmd) {
      case 'new':
        store.loadMap(createEmptyMapData());
        centerOn(store.map.playerSpawn.x, store.map.playerSpawn.y, 0.8);
        buildPalette(store);
        break;
      case 'open':
        loadFromFile(store).then(() => {
          centerOn(store.map.playerSpawn.x, store.map.playerSpawn.y, 0.8);
          buildPalette(store);
        }).catch(() => {});
        break;
      case 'save':
        saveToFile(store);
        break;
      case 'import-game':
        buildImportDialog(store);
        break;
      case 'export':
        showExport(store);
        break;
      case 'undo':
        store.undo();
        break;
      case 'redo':
        store.redo();
        break;
    }
  });
});

// 吸附切换
document.getElementById('snapSelect')?.addEventListener('change', (e) => {
  store.snap = parseFloat((e.target as HTMLSelectElement).value);
  updateStatusBar(store);
});

// 导出 tab 切换
document.querySelectorAll('#exportTabs .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const t = (tab as HTMLElement).dataset.tab as 'standard' | 'ts';
    setExportTab(store, t);
  });
});

/* ==================== 启动自检（数据契约 round-trip） ==================== */

const checkResults = runSelfCheck();
for (const line of checkResults) console.log(line);
(function showCheckSummary(): void {
  const el = document.getElementById('statusBar');
  if (!el) return;
  const okCount = checkResults.filter(l => l.startsWith('✅')).length;
  el.textContent = `自检: ${okCount}/${checkResults.length} 地图 round-trip 无损`;
})();

/* ==================== 自动保存（每 5 秒） ==================== */

let saveTimer = 0;
function tickAutoSave(dt: number): void {
  saveTimer += dt;
  if (saveTimer > 5) {
    saveTimer = 0;
    autoSave(store);
  }
}

/* ==================== 主循环 ==================== */

function frame(time: number): void {
  requestAnimationFrame(frame);

  const container = cv.parentElement!;
  if (container.clientWidth !== VW || container.clientHeight !== VH) {
    resizeCanvas();
    const oldCenterX = view.SL + VW / (2 * view.SZ);
    const oldCenterY = view.SB + VH / (2 * view.SZ);
    view.SL = oldCenterX - VW / (2 * view.SZ);
    view.SB = oldCenterY - VH / (2 * view.SZ);
  }

  tickAutoSave(0.016);

  // 清屏
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const bg = ctx.createLinearGradient(0, 0, 0, VH);
  bg.addColorStop(0, '#080517');
  bg.addColorStop(0.5, '#120a30');
  bg.addColorStop(1, '#1d0f45');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, VW, VH);

  // 渲染（几何在下，对象在上）
  renderGrid();
  renderMapBounds(store);
  renderSpawn(store);
  renderGeometry(store);
  renderObjects(store, time / 1000);

  // 矩形画笔预览
  if (drag.kind === 'draw-rect') {
    renderRectPreview(store, drag.ax, drag.ay, mouseWX, mouseWY);
  }

  renderSelection(store);

  // 对象放置幽灵预览
  if (store.mode === 'objects' && store.objTool) {
    renderGhost(store, mouseWX, mouseWY);
  } else {
    renderHover(store, mouseWX, mouseWY);
  }
}

requestAnimationFrame(frame);