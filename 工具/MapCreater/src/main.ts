/**
 * MapCreater 入口 —— 引导编辑器、挂载事件、主循环。
 *
 * 两层模式与原有拖拽状态机、渲染循环、自动保存均保持不变。
 * 新增：菜单栏、副工具栏、搜索、大纲树、小地图、Toast、复制/粘贴。
 */
import './style.css';
import { cv, ctx, resizeCanvas, DPR, VW, VH } from './canvas';
import { view, centerOn, screenToWorld, zoomAt, pan, snapToGrid } from './camera';
import { EditorStore } from './store';
import {
  renderGrid, renderGeometry, renderObjects, renderSelection, renderSpawn,
  renderGhost, renderRectPreview, renderMapBounds, updateStatusBar, renderHover,
  updateMouseStatus,
} from './render';
import { buildPalette } from './palette';
import { buildInspector } from './inspector';
import { saveToFile, loadFromFile, showExport, autoSave, loadAutoSave, buildImportDialog, setExportTab, runSelfCheck, buildTemplateDialog } from './io';
import { createEmptyMapData, hitTest, hitTestRect, rectCenter, rectRad, rectWorldCorners, rectTopCenter } from './mapTypes';
import { getPrefabEntry } from './registry';
import { buildOutliner } from './outliner';
import { bindMinimapStore, bindMinimapClick, drawMinimap } from './minimap';
import { showToast } from './toast';
import { runOverlapCheck } from './overlapCheck';
import { renderIcon } from './td-icons';
import type { Sel } from './store';
import type { RectItem } from './mapTypes';
import { sx, sy } from './camera';

/* ==================== 初始化 ==================== */

// 将静态 HTML 中的 [data-icon] 占位符渲染为 TDesign 图标
document.querySelectorAll('.td-icon[data-icon]').forEach(el => {
  const name = (el as HTMLElement).dataset.icon || '';
  const size = Number((el as HTMLElement).dataset.size || 17);
  (el as HTMLElement).innerHTML = renderIcon(name, size);
});

const store = new EditorStore();

if (!loadAutoSave(store)) {
  store.loadMap(createEmptyMapData());
}
centerOn(store.map.playerSpawn.x, store.map.playerSpawn.y, 0.8);

buildPalette(store);
bindMinimapStore(store);
bindMinimapClick();

store.onChange = () => {
  buildInspector(store);
  buildOutliner(store);
  updateStatusBar(store);
};
store.onChange();

/* ==================== 拖拽状态机 ==================== */

type DragKind =
  | 'none'
  | 'pan'
  | 'move'
  | 'draw-rect'
  | 'resize'
  | 'rotate';

interface DragState {
  kind: DragKind;
  button: number;
  sx: number; sy: number;
  wx: number; wy: number;
  ax: number; ay: number;
  target: Sel | null;
  resizedIndex: number | null;
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

function hitTestGeometry(wx: number, wy: number): number | null {
  for (let i = store.map.layers.geometry.length - 1; i >= 0; i--) {
    const item = store.map.layers.geometry[i];
    if (item.type === 'rect' && hitTestRect(item, wx, wy)) return i;
  }
  return null;
}

function hitTestObjects(wx: number, wy: number): number | null {
  for (let i = store.map.layers.objects.length - 1; i >= 0; i--) {
    if (hitTest(store.map.layers.objects[i], wx, wy)) return i;
  }
  return null;
}

function hitTestSpawn(wx: number, wy: number): boolean {
  const sp = store.map.playerSpawn;
  return Math.abs(wx - sp.x) < 1.5 && Math.abs(wy - sp.y) < 1.5;
}

function hitRectGizmo(item: RectItem, mx: number, my: number): 'rotate' | 'corner' | null {
  const top = rectTopCenter(item);
  const tpx = sx(top.x), tpy = sy(top.y);
  if (Math.hypot(mx - tpx, my - (tpy - 16)) < 12) return 'rotate';
  for (const p of rectWorldCorners(item)) {
    if (Math.hypot(mx - sx(p.x), my - sy(p.y)) < 9) return 'corner';
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

  const idx = hitTestGeometry(wx, wy);
  if (idx !== null) {
    store.select({ layer: 'geometry', index: idx });
    drag.kind = 'move';
    drag.target = { layer: 'geometry', index: idx };
    return;
  }

  if (store.geomTool === 'rect') {
    drag.kind = 'draw-rect';
    store.clearSelection();
    return;
  }

  store.clearSelection();
  drag.kind = 'pan';
  drag.resizedIndex = null;
}

function handleObjMouseDown(wx: number, wy: number): void {
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

  // 更新鼠标坐标状态
  updateMouseStatus(w.x, w.y);

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
      drag.wx = w.x; drag.wy = w.y;
      break;
    }
    case 'resize': {
      if (drag.resizedIndex === null) break;
      const item = store.map.layers.geometry[drag.resizedIndex];
      if (!item || item.type !== 'rect') break;
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
  const factor = e.deltaY > 0 ? 0.9 : 1.1;
  zoomAt(mx, my, factor);
  updateStatusBar(store);
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
  if (e.ctrlKey && e.key === 'c') {
    if (document.activeElement?.tagName === 'INPUT') return;
    if (store.copySelected()) { showToast('已复制到剪贴板', 'success'); }
    e.preventDefault();
  }
  if (e.ctrlKey && e.key === 'v') {
    if (document.activeElement?.tagName === 'INPUT') return;
    if (store.pasteFromClipboard()) { showToast('已粘贴', 'success'); }
    e.preventDefault();
  }
  if (e.key === 'Escape') {
    if (drag.kind === 'draw-rect') {
      drag.kind = 'none';
      return;
    }
    store.clearSelection();
    buildPalette(store);
    store.onChange?.();
    // 关闭菜单
    document.querySelectorAll('.menu-item.open').forEach(el => el.classList.remove('open'));
  }
});

/* ==================== 命令分发 ==================== */

function execCommand(cmd: string): void {
  switch (cmd) {
    case 'new':
      store.loadMap(createEmptyMapData());
      centerOn(store.map.playerSpawn.x, store.map.playerSpawn.y, 0.8);
      buildPalette(store);
      showToast('已新建空白地图', 'info');
      break;
    case 'template':
      buildTemplateDialog(store);
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
    case 'check-overlap':
      runOverlapCheck(store);
      break;
    case 'undo':
      store.undo();
      break;
    case 'redo':
      store.redo();
      break;
    case 'copy':
      if (store.copySelected()) showToast('已复制到剪贴板', 'success');
      break;
    case 'paste':
      if (store.pasteFromClipboard()) showToast('已粘贴', 'success');
      break;
    case 'duplicate':
      store.duplicateSelected();
      break;
    case 'delete':
      store.removeSelected();
      break;
    case 'toggle-minimap': {
      const el = document.getElementById('minimap-container');
      if (el) el.classList.toggle('hidden');
      break;
    }
    case 'reset-zoom':
      centerOn(store.map.playerSpawn.x, store.map.playerSpawn.y, 1);
      updateStatusBar(store);
      showToast('缩放已重置', 'info');
      break;
    case 'help-shortcuts':
      showToast(
        'Ctrl+Z 撤销 · Ctrl+Shift+Z 重做 · Ctrl+S 保存 · Ctrl+D 克隆 · Del 删除 · Ctrl+C/V 复制/粘贴 · Esc 取消选中',
        'info',
      );
      break;
  }
}

// 关闭菜单下拉
function closeMenus(): void {
  document.querySelectorAll('.menu-item.open').forEach(el => el.classList.remove('open'));
}

// 点击其他区域关闭菜单
document.addEventListener('click', (e) => {
  if (!(e.target as HTMLElement)?.closest('.menu-item')) {
    closeMenus();
  }
});

/* ==================== 工具栏按钮 ==================== */

document.querySelectorAll('[data-cmd]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const cmd = (btn as HTMLElement).dataset.cmd!;
    execCommand(cmd);
    closeMenus();
  });
});

/* ==================== 菜单系统 ==================== */

document.querySelectorAll('.menu-item[data-menu]').forEach(item => {
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    closeMenus();
    item.classList.toggle('open');
  });
});

// 菜单项点击时自动关闭父级菜单
document.querySelectorAll('.menu-drop .menu-opt').forEach(opt => {
  opt.addEventListener('click', () => {
    closeMenus();
  });
});

/* ==================== 控件绑定 ==================== */

document.getElementById('snapSelect')?.addEventListener('change', (e) => {
  store.snap = parseFloat((e.target as HTMLSelectElement).value);
  updateStatusBar(store);
});

document.getElementById('rotSnapSelect')?.addEventListener('change', (e) => {
  store.rotationSnap = parseFloat((e.target as HTMLSelectElement).value);
});

document.getElementById('paletteSearch')?.addEventListener('input', () => {
  buildPalette(store);
});

document.getElementById('outlinerSearch')?.addEventListener('input', () => {
  buildOutliner(store);
});

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
  const el = document.getElementById('statusSelf');
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

let lastCanvasW = VW, lastCanvasH = VH;

function frame(time: number): void {
  requestAnimationFrame(frame);

  const container = cv.parentElement!;
  if (
    container.clientWidth !== VW || container.clientHeight !== VH ||
    cv.width !== Math.round(VW * DPR) || cv.height !== Math.round(VH * DPR) ||
    cv.style.width !== VW + 'px' || cv.style.height !== VH + 'px'
  ) {
    resizeCanvas();
  }

  if (VW !== lastCanvasW || VH !== lastCanvasH) {
    const oldCenterX = view.SL + lastCanvasW / (2 * view.SZ);
    const oldCenterY = view.SB + lastCanvasH / (2 * view.SZ);
    view.SL = oldCenterX - VW / (2 * view.SZ);
    view.SB = oldCenterY - VH / (2 * view.SZ);
    lastCanvasW = VW;
    lastCanvasH = VH;
  }

  tickAutoSave(0.016);

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const bg = ctx.createLinearGradient(0, 0, 0, VH);
  bg.addColorStop(0, '#080517');
  bg.addColorStop(0.5, '#120a30');
  bg.addColorStop(1, '#1d0f45');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, VW, VH);

  renderGrid();
  renderMapBounds(store);
  renderSpawn(store);
  renderGeometry(store);
  renderObjects(store, time / 1000);

  if (drag.kind === 'draw-rect') {
    renderRectPreview(store, drag.ax, drag.ay, mouseWX, mouseWY);
  }

  renderSelection(store);

  if (store.mode === 'objects' && store.objTool) {
    renderGhost(store, mouseWX, mouseWY);
  } else {
    renderHover(store, mouseWX, mouseWY);
  }

  // 每帧更新小地图
  drawMinimap(store);
}

requestAnimationFrame(frame);