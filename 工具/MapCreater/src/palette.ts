/**
 * 调色板 DOM —— 侧边栏（按模式切换：基础几何工具 / 场景物品预制体）。
 *
 * 几何工具与预制体都来自 registry（预制体外部引用游戏工厂）。
 */
import type { EditorStore } from './store';
import { getPrefabCategories, GEOMETRY_TOOLS } from './registry';

export function buildPalette(store: EditorStore): void {
  const container = document.getElementById('palette')!;
  container.innerHTML = '';

  // 模式分段切换
  const modeRow = document.createElement('div');
  modeRow.className = 'mode-row';
  const modes: { id: 'geometry' | 'objects'; label: string; hint: string }[] = [
    { id: 'geometry', label: '🏗 基础几何', hint: '矢量绘制：地面/墙壁/阶梯' },
    { id: 'objects', label: '🎯 场景物品', hint: '摆放玩法预制体' },
  ];
  for (const m of modes) {
    const btn = document.createElement('button');
    btn.className = 'mode-btn' + (store.mode === m.id ? ' active' : '');
    btn.textContent = m.label;
    btn.title = m.hint;
    btn.addEventListener('click', () => {
      store.setMode(m.id);
      buildPalette(store);
      store.onChange?.();
    });
    modeRow.appendChild(btn);
  }
  container.appendChild(modeRow);

  // 批量放置锁
  const lockRow = document.createElement('div');
  lockRow.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 8px;margin-bottom:4px;border-bottom:1px solid rgba(100,80,200,.2)';
  const lockCheck = document.createElement('input');
  lockCheck.type = 'checkbox';
  lockCheck.id = 'lockPlace';
  lockCheck.checked = store.lockPlace;
  lockCheck.addEventListener('change', () => { store.lockPlace = lockCheck.checked; });
  const lockLabel = document.createElement('label');
  lockLabel.htmlFor = 'lockPlace';
  lockLabel.textContent = '🔒 连续绘制/放置';
  lockLabel.style.cssText = 'font-size:12px;color:rgba(170,200,255,.6);cursor:pointer';
  lockRow.appendChild(lockCheck);
  lockRow.appendChild(lockLabel);
  container.appendChild(lockRow);

  if (store.mode === 'geometry') {
    buildGeometryTools(store, container);
  } else {
    buildPrefabPalette(store, container);
  }

  refreshActive(store);
}

/* ==================== 几何工具 ==================== */

function buildGeometryTools(store: EditorStore, container: HTMLElement): void {
  const section = document.createElement('div');
  section.className = 'palette-category';

  const title = document.createElement('h3');
  title.textContent = '矢量工具';
  section.appendChild(title);

  for (const tool of GEOMETRY_TOOLS) {
    const el = document.createElement('div');
    el.className = 'palette-entry';
    el.dataset.tool = tool.id;

    const swatch = document.createElement('div');
    swatch.className = 'palette-swatch';
    swatch.style.background = 'rgba(110,200,255,.15)';
    swatch.style.color = '#8ff6ff';
    swatch.textContent = tool.icon;

    const wrap = document.createElement('div');
    wrap.style.flex = '1';
    const name = document.createElement('div');
    name.textContent = tool.name;
    name.style.fontSize = '13px';
    const hint = document.createElement('div');
    hint.textContent = tool.hint;
    hint.style.cssText = 'font-size:10px;color:rgba(170,200,255,.35);margin-top:1px';
    wrap.appendChild(name);
    wrap.appendChild(hint);

    el.appendChild(swatch);
    el.appendChild(wrap);

    el.addEventListener('click', () => {
      store.setGeomTool(tool.id);
      refreshActive(store);
      store.onChange?.();
    });

    section.appendChild(el);
  }

  container.appendChild(section);
}

/* ==================== 预制体调色板 ==================== */

function buildPrefabPalette(store: EditorStore, container: HTMLElement): void {
  const categories = getPrefabCategories();

  for (const [catName, entries] of categories) {
    const section = document.createElement('div');
    section.className = 'palette-category';

    const title = document.createElement('h3');
    title.textContent = catName;
    section.appendChild(title);

    for (const entry of entries) {
      const el = document.createElement('div');
      el.className = 'palette-entry';
      el.dataset.toolid = entry.toolId;

      const swatch = document.createElement('div');
      swatch.className = 'palette-swatch';
      swatch.style.background = entry.swatch + '33';
      swatch.style.color = entry.swatch;
      swatch.textContent = entry.icon;

      const label = document.createElement('span');
      label.textContent = entry.name;

      el.appendChild(swatch);
      el.appendChild(label);

      el.addEventListener('click', () => {
        if (store.objTool === entry.toolId) {
          store.setObjTool(null);
        } else {
          store.setObjTool(entry.toolId);
        }
        refreshActive(store);
        store.onChange?.();
      });

      section.appendChild(el);
    }

    container.appendChild(section);
  }
}

/* ==================== 激活态 ==================== */

function refreshActive(store: EditorStore): void {
  document.querySelectorAll('.palette-entry').forEach(el => {
    const elm = el as HTMLElement;
    if (store.mode === 'geometry') {
      const tool = elm.dataset.tool;
      elm.classList.toggle('active', tool === store.geomTool);
    } else {
      const toolId = elm.dataset.toolid;
      elm.classList.toggle('active', toolId === store.objTool);
    }
  });
}