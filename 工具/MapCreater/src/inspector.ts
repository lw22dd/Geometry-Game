/**
 * 属性面板 DOM —— 选中实例的字段编辑。
 */
import type { EditorStore } from './store';
import { getPrefabEntry } from './registry';
import { instanceLabel } from './mapTypes';

export function buildInspector(store: EditorStore): void {
  const container = document.getElementById('inspectorInner')!;

  // 出生点选中
  if (store.isSpawnSelected()) {
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
    return;
  }

  if (store.selection.length !== 1) {
    container.innerHTML = '<div class="inspector-empty">选择一个实例以编辑属性</div>';
    return;
  }

  const idx = store.selection[0];
  const inst = store.map.instances[idx];
  if (!inst) { container.innerHTML = ''; return; }

  const entry = getPrefabEntry(inst.type);
  if (!entry) { container.innerHTML = ''; return; }

  const html: string[] = [];

  // 标题
  html.push(`<div class="inspector-header">${entry.icon} ${entry.name}</div>`);

  // 字段
  for (const field of entry.fields) {
    const val = (inst as any)[field.key];
    html.push('<div class="inspector-field">');
    html.push(`<label>${field.label}</label>`);
    if (field.type === 'number') {
      html.push(`<input type="number" step="${field.step || 0.1}" min="${field.min ?? ''}" max="${field.max ?? ''}" value="${val}" data-key="${field.key}" />`);
    } else if (field.type === 'string') {
      html.push(`<input type="text" value="${escapeHtml(String(val ?? ''))}" placeholder="${field.placeholder || ''}" data-key="${field.key}" />`);
    }
    html.push('</div>');
  }

  // 操作按钮
  html.push(`<div class="inspector-actions">
    <button class="del-btn" data-action="delete">🗑 删除</button>
    <button data-action="duplicate">📋 复制</button>
  </div>`);

  container.innerHTML = html.join('');

  // 绑定事件
  container.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', () => {
      const key = (input as HTMLElement).dataset.key!;
      const raw = input.value;
      const isNumber = input.type === 'number';
      store.updateInstanceField(idx, key, isNumber ? parseFloat(raw) : raw);
    });
  });

  container.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
    store.removeSelected();
  });

  container.querySelector('[data-action="duplicate"]')?.addEventListener('click', () => {
    store.duplicateSelected();
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}