/**
 * 场景大纲树 DOM —— 左侧面板上格。
 *
 * 分两组展示当前地图内容：基础几何（矩形）与场景对象（预制体实例），
 * 支持搜索过滤、组折叠/展开，点击节点选中（与画布选中联动）。
 */
import type { EditorStore } from './store';
import { getEntryByType } from './registry';
import { instanceLabel } from './mapTypes';
import { renderIcon } from './td-icons';

/** 组折叠状态（按组 id 持久，避免 onChange 重建后丢失） */
const collapsedGroups = new Set<string>([]);
/** 最近一次渲染的 store（折叠点击后用于重建） */
let lastStore: EditorStore | null = null;

export function buildOutliner(store: EditorStore): void {
  lastStore = store;
  const container = document.getElementById('outliner');
  if (!container) return;
  const filter = ((document.getElementById('outlinerSearch') as HTMLInputElement)?.value || '').trim().toLowerCase();
  container.textContent = '';

  // 几何组
  buildGroup(container, {
    id: 'geometry',
    label: '基础几何',
    icon: (_i: number) => 'Rectangle',
    title: (n: number) => `Rect #${n}`,
    count: store.map.layers.geometry.length,
    selected: (i: number) => store.selGeomIndex === i,
    select: (i: number) => {
      store.select({ layer: 'geometry', index: i });
      store.onChange?.();
    },
    filter,
  });

  // 对象组
  buildGroup(container, {
    id: 'objects',
    label: '场景对象',
    icon: (i: number) => {
      const inst = store.map.layers.objects[i];
      const entry = inst ? getEntryByType(inst.type) : undefined;
      return entry?.icon || 'Module';
    },
    title: (i: number) => {
      const inst = store.map.layers.objects[i];
      const entry = inst ? getEntryByType(inst.type) : undefined;
      return `${entry?.name || inst?.type || '?'} #${i + 1}`;
    },
    hint: (i: number) => {
      const inst = store.map.layers.objects[i];
      return inst ? instanceLabel(inst) : '';
    },
    count: store.map.layers.objects.length,
    selected: (i: number) => store.selObjIndex === i,
    select: (i: number) => {
      store.select({ layer: 'objects', index: i });
      store.onChange?.();
    },
    filter,
  });
}

/* ==================== 组构建 ==================== */

interface GroupSpec {
  id: string;
  label: string;
  count: number;
  icon: (i: number) => string;
  title: (i: number) => string;
  hint?: (i: number) => string;
  selected: (i: number) => boolean;
  select: (i: number) => void;
  filter: string;
}

function buildGroup(container: HTMLElement, spec: GroupSpec): void {
  const group = document.createElement('div');

  const forceExpand = spec.filter.length > 0;
  const collapsed = !forceExpand && collapsedGroups.has(spec.id);
  const parent = document.createElement('div');
  parent.className = 'tree-parent';
  parent.innerHTML = `${collapsed ? '▶' : '▼'} ${spec.label} (${spec.count})`;

  const children = document.createElement('div');
  children.className = 'tree-children';
  if (collapsed) children.style.display = 'none';

  const visible: number[] = [];
  for (let i = 0; i < spec.count; i++) {
    const name = spec.title(i).toLowerCase();
    if (spec.filter && !name.includes(spec.filter)) continue;
    visible.push(i);
  }

  for (const i of visible) {
    const node = document.createElement('div');
    node.className = 'tree-node' + (spec.selected(i) ? ' selected' : '');
    node.innerHTML = `<span class="tree-node-icon">${renderIcon(spec.icon(i), 13)}</span><span>${escapeHtml(spec.title(i))}</span>`;
    const hint = spec.hint?.(i);
    if (hint) {
      node.innerHTML += `<span class="tree-hint">${escapeHtml(hint)}</span>`;
    }
    node.addEventListener('click', () => spec.select(i));
    children.appendChild(node);
  }

  parent.addEventListener('click', () => {
    if (collapsedGroups.has(spec.id)) collapsedGroups.delete(spec.id);
    else collapsedGroups.add(spec.id);
    if (lastStore) buildOutliner(lastStore);
  });

  group.appendChild(parent);
  group.appendChild(children);
  container.appendChild(group);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}