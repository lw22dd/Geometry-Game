/**
 * MapCreater 入口 —— 引导编辑器、挂载事件、主循环。
 */
import './style.css';
import { cv, ctx, resizeCanvas, DPR, VW, VH } from './canvas';
import { view, centerOn, screenToWorld, zoomAt, pan, snapToGrid } from './camera';
import { EditorStore } from './store';
import { renderGrid, renderInstances, renderSelection, renderSpawn, renderGhost, renderMapBounds, updateStatusBar, renderHover } from './render';
import { buildPalette } from './palette';
import { buildInspector } from './inspector';
import { saveToFile, loadFromFile, showExport, autoSave, loadAutoSave, buildImportDialog, setExportTab, runSelfCheck } from './io';
import { hitTest, createEmptyMapData } from './mapTypes';
import { getPrefabEntry } from './registry';

/* ==================== 初始化 ==================== */

const store = new EditorStore();

// 加载自动保存，没有则新建
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

/* ==================== 鼠标交互 ==================== */

interface DragState {
  button: number;
  sx: number; sy: number;  // 屏幕起始像素
  wx: number; wy: number;  // 世界起始坐标
  moving: boolean;
  moved: boolean;
  draggedIdx: number | null; // null = pan, -1 = spawn, >=0 = instance
  /** mousedown 时是否命中已有实例（用于 mouseup 区分「放置」与「选中」） */
  hitOnDown: boolean;
}

const drag: DragState = {
  button: 0, sx: 0, sy: 0, wx: 0, wy: 0,
  moving: false, moved: false, draggedIdx: null, hitOnDown: false,
};

let mouseWX = 0, mouseWY = 0;

/** 鼠标像素 → 逻辑像素 */
function mouseXY(e: MouseEvent): [number, number] {
  const rect = cv.getBoundingClientRect();
  return [
    (e.clientX - rect.left) * (VW / rect.width),
    (e.clientY - rect.top) * (VH / rect.height),
  ];
}

/** 命中测试：返回实例索引或 'spawn' 或 null */
function hitTestAll(wx: number, wy: number): number | 'spawn' | null {
  // 出生点
  const sp = store.map.playerSpawn;
  if (Math.abs(wx - sp.x) < 1.5 && Math.abs(wy - sp.y) < 1.5) return 'spawn';
  // 实例（倒序遍历，上层优先）
  for (let i = store.map.instances.length - 1; i >= 0; i--) {
    if (hitTest(store.map.instances[i], wx, wy)) return i;
  }
  return null;
}

cv.addEventListener('mousedown', (e: MouseEvent) => {
  const [mx, my] = mouseXY(e);
  const w = screenToWorld(mx, my);

  drag.button = e.button;
  drag.sx = mx; drag.sy = my;
  drag.wx = w.x; drag.wy = w.y;
  drag.moving = false;
  drag.moved = false;
  drag.draggedIdx = null;
  drag.hitOnDown = false;

  if (e.button !== 0) return;

  // 1. 命中检测
  const hit = hitTestAll(w.x, w.y);
  if (hit === 'spawn') {
    // 选中出生点
    store.selectSpawn();
    drag.draggedIdx = -1;
    drag.hitOnDown = true;
    store.tool = null;
    buildPalette(store);
    return;
  }
  if (typeof hit === 'number') {
    store.select(hit);
    drag.draggedIdx = hit;
    drag.hitOnDown = true;
    store.tool = null;
    buildPalette(store);
    return;
  }

  // 2. 未命中：清除选中
  store.clearSelection();
});

cv.addEventListener('mousemove', (e: MouseEvent) => {
  const [mx, my] = mouseXY(e);
  const w = screenToWorld(mx, my);
  mouseWX = w.x; mouseWY = w.y;

  // 右键平移
  if (drag.button === 2) {
    pan(mx - drag.sx, my - drag.sy);
    drag.sx = mx; drag.sy = my;
    drag.moved = true;
    return;
  }

  // 左键拖拽
  if (drag.button === 0) {
    // 已进入拖拽状态 → 移动选中
    if (drag.moving) {
      const dx = w.x - drag.wx, dy = w.y - drag.wy;
      drag.wx = w.x; drag.wy = w.y;
      if (drag.draggedIdx === -1) {
        // 拖拽出生点
        store.moveSpawn(dx, dy);
      } else if (drag.draggedIdx !== null && store.selection.length > 0) {
        store.moveSelected(dx, dy);
      }
      drag.moved = true;
      return;
    }
    // 首次超过阈值 → 进入拖拽
    if (Math.abs(mx - drag.sx) > 3 || Math.abs(my - drag.sy) > 3) {
      drag.moving = true;
      if (drag.draggedIdx === null && !store.tool) {
        // 空白拖拽 = 平移
      }
    }
  }
});

cv.addEventListener('mouseup', (e: MouseEvent) => {
  if (e.button !== 0) return;

  const [mx, my] = mouseXY(e);
  const w = screenToWorld(mx, my);

  if (!drag.moved) {
    // ── 点击（无拖拽）──
    if (store.tool && !drag.hitOnDown) {
      // 放置模式：在网格对齐位置添加实例
      const wx = snapToGrid(w.x, store.snap);
      const wy = snapToGrid(w.y, store.snap);
      const entry = getPrefabEntry(store.tool);
      if (entry) {
        const inst = entry.defaults();
        switch (inst.type) {
          case 'mover': inst.x0 = wx; inst.y = wy; break;
          case 'laser': inst.x = wx; inst.y0 = wy; break;
          default: inst.x = wx; inst.y = wy; break;
        }
        store.addInstance(inst);
        // 如果不锁定工具，放置后自动清除
        if (!store.lockPlace) {
          store.tool = null;
          buildPalette(store);
        }
      }
    }
    // 命中的情况已在 mousedown 中处理了选中
  } else {
    // ── 拖拽结束 ──
    if (drag.draggedIdx === -1) {
      store.commitMove();
    } else if (drag.draggedIdx !== null && store.selection.length > 0) {
      store.commitMove();
    }
  }

  drag.button = -1;
  drag.moving = false;
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
  if (e.ctrlKey && e.key === 'z') {
    store.undo();
    e.preventDefault();
  }
  if (e.ctrlKey && e.key === 'Z' && e.shiftKey) {
    store.redo();
    e.preventDefault();
  }
  if (e.ctrlKey && e.key === 's') {
    saveToFile(store);
    e.preventDefault();
  }
  if (e.key === 'Escape') {
    store.tool = null;
    store.clearSelection();
    buildPalette(store);
    store.onChange?.();
  }
  if (e.key === 'd' && e.ctrlKey) {
    store.duplicateSelected();
    e.preventDefault();
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
for (const line of checkResults) {
  console.log(line);
}
// 把自检摘要显示到状态栏
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

  // 检测画布尺寸变化
  const container = cv.parentElement!;
  if (container.clientWidth !== VW || container.clientHeight !== VH) {
    resizeCanvas();
    // 更新相机保持视口聚焦
    const oldCenterX = view.SL + VW / (2 * view.SZ);
    const oldCenterY = view.SB + VH / (2 * view.SZ);
    // 重新计算后 VW/VH 已变，需重新 set
    view.SL = oldCenterX - VW / (2 * view.SZ);
    view.SB = oldCenterY - VH / (2 * view.SZ);
  }

  const dt = 0.016; // 近似，实际可在动画循环中计算
  tickAutoSave(dt);

  // 清屏
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const bg = ctx.createLinearGradient(0, 0, 0, VH);
  bg.addColorStop(0, '#080517');
  bg.addColorStop(0.5, '#120a30');
  bg.addColorStop(1, '#1d0f45');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, VW, VH);

  // 渲染
  renderGrid();
  renderMapBounds(store);
  renderSpawn(store);
  renderInstances(store, time / 1000);
  renderSelection(store);
  renderHover(store, mouseWX, mouseWY);

  // 放置预览
  if (store.tool) {
    renderGhost(store, mouseWX, mouseWY);
  }
}

requestAnimationFrame(frame);