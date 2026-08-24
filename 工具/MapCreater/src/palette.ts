/**
 * 调色板 DOM —— 侧边栏的预制体列表。
 *
 * 从 registry 读取预制体定义（外部引用游戏工厂），
 * 点击设置当前放置工具。
 */
import type { EditorStore } from './store';
import { getPrefabCategories } from './registry';
import type { InstanceType } from './mapTypes';

export function buildPalette(store: EditorStore): void {
  const container = document.getElementById('palette')!;
  container.innerHTML = '';

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
  lockLabel.textContent = '🔒 连续放置';
  lockLabel.style.cssText = 'font-size:12px;color:rgba(170,200,255,.6);cursor:pointer';
  lockRow.appendChild(lockCheck);
  lockRow.appendChild(lockLabel);
  container.appendChild(lockRow);

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
      el.dataset.type = entry.type;

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
        if (store.tool === entry.type) {
          store.tool = null;
        } else {
          store.tool = entry.type;
        }
        store.clearSelection();
        refreshActive(store);
        store.onChange?.();
      });

      section.appendChild(el);
    }

    container.appendChild(section);
  }

  refreshActive(store);
}

function refreshActive(store: EditorStore): void {
  const current = store.tool;
  document.querySelectorAll('.palette-entry').forEach(el => {
    const type = (el as HTMLElement).dataset.type as InstanceType | undefined;
    el.classList.toggle('active', type === current);
  });
}