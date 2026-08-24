/**
 * 属性面板 DOM —— 按选中内容渲染（出生点 / 几何矩形 / 对象实例）。
 */
import type { EditorStore } from './store';
import { getEntryByType } from './registry';
import { instanceLabel } from './mapTypes';

export function buildInspector(store: EditorStore): void {
  const container = document.getElementById('inspectorInner')!;

  // 出生点选中
  if (store.isSpawnSelected()) {
    buildSpawnInspector(store, container);
    return;
  }

  // 几何选中
  const geomIdx = store.selGeomIndex;
  if (geomIdx !== null) {
    buildGeometryInspector(store, container, geomIdx);
    return;
  }

  // 对象选中
  const objIdx = store.selObjIndex;
  if (objIdx !== null) {
    buildObjectInspector(store, container, objIdx);
    return;
  }

  container.innerHTML = '<div class="inspector-empty">选择一个对象以编辑属性<br/><span style="font-size:11px">几何模式：点矩形显示 xywh/旋转</span></div>';
}

/* ==================== 出生点 ==================== */

function buildSpawnInspector(store: EditorStore, container: HTMLElement): void {
  container.innerHTML = '<div class="inspector-header">✦ 出生点</div>'
    + '<div class="inspector-field"><label>X</label><input type="number" step="0.5" id="spawnX" /></div>'
    + '<div class="inspector-field"><label>Y</label><input type="number" step="0.5" id="spawnY" /></div>'
    + '<p style="color:rgba(170,200,255,.45);font-size:12px">拖动地图上的 ✦ 可移动出生点</p>';
  const xInput = document.getElementById('spawnX') as HTMLInputElement;
  const yInput = document.getElementById('spawnY') as HTMLInputElement;
  xInput.value = String(store.map.playerSpawn.x);
  yInput.value = String(store.map.playerSpawn.y);
  xInput.addEventListener('change', () => {
    store.setSpawnPos(parseFloat(xInput.value) || 0, store.map.playerSpawn.y);
  });
  yInput.addEventListener('change', () => {
    store.setSpawnPos(store.map.playerSpawn.x, parseFloat(yInput.value) || 0);
  });
}

/* ==================== 几何矩形 ==================== */

function buildGeometryInspector(store: EditorStore, container: HTMLElement, idx: number): void {
  const item = store.map.layers.geometry[idx];
  if (!item || item.type !== 'rect') { container.innerHTML = ''; return; }

  container.innerHTML = '<div class="inspector-header">▭ 矩形（基础几何）</div>'
    + field('X', 'gx', item.x)
    + field('Y', 'gy', item.y)
    + field('宽', 'gw', item.w)
    + field('高', 'gh', item.h)
    + field('旋转°', 'grot', item.rotation)
    + '<p style="color:rgba(170,200,255,.45);font-size:12px">拖角柄缩放 · 顶部圆柄旋转 · 吸附 5°</p>'
    + actionsHtml();

  const bind = (id: string, key: string) => {
    const input = document.getElementById(id) as HTMLInputElement;
    input.addEventListener('change', () => {
      store.updateGeometryField(idx, key, parseFloat(input.value) || 0);
    });
  };
  bind('gx', 'x'); bind('gy', 'y'); bind('gw', 'w'); bind('gh', 'h'); bind('grot', 'rotation');
  bindActions(store);
}

/* ==================== 对象实例 ==================== */

function buildObjectInspector(store: EditorStore, container: HTMLElement, idx: number): void {
  const inst = store.map.layers.objects[idx];
  if (!inst) { container.innerHTML = ''; return; }
  const entry = getEntryByType(inst.type);
  if (!entry) { container.innerHTML = ''; return; }

  container.innerHTML = `<div class="inspector-header">${entry.icon} ${entry.name}</div>`
    + `<div style="font-size:11px;color:rgba(170,200,255,.4);margin-bottom:8px">${instanceLabel(inst)}</div>`
    + entry.fields.map(f => field(f.label, `of_${f.key}`, (inst as any)[f.key])).join('')
    + actionsHtml();

  for (const f of entry.fields) {
    const input = document.getElementById(`of_${f.key}`) as HTMLInputElement;
    input.addEventListener('change', () => {
      const v = f.type === 'number' ? (parseFloat(input.value) || 0) : input.value;
      store.updateInstanceField(idx, f.key, v);
    });
  }
  bindActions(store);
}

/* ==================== 通用控件 ==================== */

function field(label: string, id: string, value: number | string | undefined): string {
  const num = typeof value === 'number';
  return `<div class="inspector-field"><label>${label}</label>`
    + `<input type="${num ? 'number' : 'text'}" step="0.5" id="${id}" value="${escapeHtml(String(value ?? ''))}" /></div>`;
}

function actionsHtml(): string {
  return `<div class="inspector-actions">
    <button class="del-btn" data-action="delete">🗑 删除</button>
    <button data-action="duplicate">📋 复制</button>
  </div>`;
}

function bindActions(store: EditorStore): void {
  const container = document.getElementById('inspectorInner')!;
  container.querySelector('[data-action="delete"]')?.addEventListener('click', () => store.removeSelected());
  container.querySelector('[data-action="duplicate"]')?.addEventListener('click', () => store.duplicateSelected());
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}