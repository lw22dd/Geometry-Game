/**
 * 保存/加载/导出地图。
 *
 * 编辑器唯一产出物 = 标准地图数据 v2（版本化 JSON，两层结构）。
 * MapDefinition TS 代码仅作为「兼容视图」供人工粘贴旧流程使用。
 */
import type { EditorStore } from './store';
import type { MapData } from './mapTypes';
import { createEmptyMapData, migrateMapData } from './mapTypes';
import { compileMapData, decompileMapDefinition } from './mapCodec';
import type { MapDefinition } from '@game/types';
import { MAP_TEMPLATES } from './templates';
import { centerOn } from './camera';
import { showToast } from './toast';
import { renderIcon } from './td-icons';
import { importMvMapFile, MvImportError } from './mvmapImport';

/* ==================== 保存为模板（当前地图 → 自定义模板，存浏览器 localStorage） ==================== */

/** 自定义模板的浏览器存储键（模板存在本地，与 MVMap 的 Storage 思路一致） */
const USER_TEMPLATES_KEY = 'mapcreater.userTemplates';

interface UserTemplate {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** 模板的 MapData 快照（深拷贝存储） */
  data: MapData;
}

/** 「保存为模板」弹窗当前作用的地图 store */
let saveTplStore: EditorStore | null = null;

function loadUserTemplates(): UserTemplate[] {
  try {
    const raw = localStorage.getItem(USER_TEMPLATES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (t): t is UserTemplate => !!t && typeof t.id === 'string' && !!t.data && typeof t.data === 'object',
    );
  } catch { return []; }
}

function persistUserTemplates(list: UserTemplate[]): void {
  localStorage.setItem(USER_TEMPLATES_KEY, JSON.stringify(list));
}

function removeUserTemplate(id: string): void {
  persistUserTemplates(loadUserTemplates().filter((t) => t.id !== id));
}

/** 打开「保存为模板」弹窗（文件菜单 / 快捷键 Ctrl+S 入口） */
export function openSaveTemplateDialog(store: EditorStore): void {
  saveTplStore = store;
  const nameEl = document.getElementById('templateSaveName') as HTMLInputElement;
  nameEl.value = store.map.name || '';
  const newEl = document.getElementById('templateSaveNew') as HTMLInputElement | null;
  if (newEl) {
    newEl.checked = false;
    // 勾选/取消「另存为新文件」时即时刷新提示文案
    newEl.onchange = () => updateSaveTemplateHint(store);
  }
  updateSaveTemplateHint(store); // 异步：先更新静态判断，再拉取磁盘注册清单校正
  document.getElementById('templateSaveOverlay')!.classList.remove('hidden');
  nameEl.focus();
  nameEl.select();
}

/** 从 dev 服务器拉取 src/mapTemplate 磁盘上已注册的模板 id 清单（权威判定依据） */
async function fetchRegisteredTemplateIds(): Promise<string[]> {
  try {
    const r = await fetch('/__dsh-template-save', { method: 'GET' });
    const j = await r.json();
    if (j && j.ok && Array.isArray(j.templates)) {
      return j.templates.map((t: { id?: string }) => t.id ?? '');
    }
  } catch { /* dev 服务器不可用 → 回退静态清单 */ }
  return [];
}

/** 保存弹窗里的动态提示：编辑既有地图 → 覆盖原文件；新地图/空白画布 → 新建文件；勾选另存 → 派生新文件 */
async function updateSaveTemplateHint(store: EditorStore): Promise<void> {
  const hint = document.getElementById('templateSaveHint');
  if (!hint) return;
  const newEl = document.getElementById('templateSaveNew') as HTMLInputElement | null;
  const forceNew = !!newEl?.checked;
  const id = store.map.id;
  const existing = MAP_TEMPLATES.find((t) => t.id === id);

  // 勾选「另存为新文件」：无论当前地图是否已注册，一律派生新文件、不覆盖原文件
  if (forceNew) {
    hint.innerHTML = existing
      ? `将<strong>新建</strong>副本 <code>src/mapTemplate/&lt;名称&gt;.ts</code>（<strong>不覆盖</strong>现有模板「${escHtml(existing.name)}」），并注册进 templates.ts。`
      : `将<strong>新建</strong> <code>src/mapTemplate/&lt;名称&gt;.ts</code> 并注册进 templates.ts。`;
    return;
  }

  const isNew = !id || id === 'untitled' || id === 'empty';
  if (isNew) {
    hint.innerHTML = `将<strong>新建</strong> <code>src/mapTemplate/&lt;名称&gt;.ts</code> 并注册进 templates.ts。`;
    return;
  }
  // 权威判定：磁盘注册清单优先（新建模板后无需刷新页面即准确），失败则回退打包时静态 MAP_TEMPLATES
  const diskIds = await fetchRegisteredTemplateIds();
  const registered = diskIds.length > 0 ? diskIds : MAP_TEMPLATES.map((t) => t.id);
  hint.innerHTML = registered.includes(id)
    ? `将<strong>覆盖</strong>现有模板「${escHtml(existing?.name ?? id)}」<code>${escHtml(id)}</code>，不新增文件。改名只更新模板名称，不改变文件。`
    : `将<strong>新建</strong> <code>src/mapTemplate/&lt;名称&gt;.ts</code> 并注册进 templates.ts。`;
}

/** 关闭「保存为模板」弹窗 */
export function hideTemplateSave(): void {
  document.getElementById('templateSaveOverlay')!.classList.add('hidden');
}

/**
 * 确认：把当前地图保存为模板。
 * 优先通过 dev 服务器自动写入 src/mapTemplate/*.ts 并注册进 templates.ts（需 npm run dev）；
 * 写入失败时回退为浏览器 localStorage 自定义模板。
 */
export function confirmSaveTemplate(): void {
  const nameEl = document.getElementById('templateSaveName') as HTMLInputElement;
  const iconEl = document.getElementById('templateSaveIcon') as HTMLSelectElement;
  const descEl = document.getElementById('templateSaveDesc') as HTMLInputElement;
  const newEl = document.getElementById('templateSaveNew') as HTMLInputElement | null;
  const name = nameEl.value.trim();
  if (!name) { showToast('请输入模板名称', 'error'); nameEl.focus(); return; }
  if (!saveTplStore) { showToast('未找到当前地图', 'error'); return; }

  const icon = iconEl?.value || 'Star';
  const desc = descEl?.value.trim() || '';
  const snapshot = saveTplStore.mapSnapshot();

  // 先落一份到浏览器 localStorage 兜底（dev 写入失败时也能用）
  const tpl: UserTemplate = {
    id: 'tpl-' + Date.now().toString(36),
    name,
    icon,
    desc,
    data: JSON.parse(JSON.stringify(snapshot)) as MapData,
  };
  try {
    const list = loadUserTemplates();
    list.push(tpl);
    persistUserTemplates(list);
  } catch {
    showToast('模板保存失败（可能超出浏览器存储上限）', 'error');
    return;
  }
  hideTemplateSave();

  // 自动写入 src/mapTemplate/*.ts（dev 服务器中间件；不可用则提示手动导出）
  const forceNew = !!newEl?.checked;
  saveTemplateSourceToDisk(name, icon, desc, snapshot, forceNew).then((res) => {
    if (res.ok) {
      removeUserTemplate(tpl.id); // 已固化为内置源码模板，移除浏览器里的重复副本
      // 新建分支（含 forceNew 另存）：服务器生成了新文件与其 id，把打开地图的 id 同步过去，
      // 保证「再次保存」是覆盖同一文件，而不是又新建一个副本。
      if (res.id && !res.updated) {
        saveTplStore!.setMapMeta({ id: res.id, name });
      }
      showToast(`已保存为模板「${name}」→ 写入 src/mapTemplate/${res.fileName}（已在 templates.ts 注册）`, 'success');
    } else {
      showToast(`已保存为浏览器模板「${name}」（未自动写入源码：${res.error}）。可用「导出为内置模板源码」手动生成文件`, 'info');
    }
  });
}

/** 经 dev 服务器把当前地图自动写入 src/mapTemplate/*.ts 并注册（vite.config.ts 的中间件） */
function saveTemplateSourceToDisk(
  name: string, icon: string, desc: string, snapshot: MapData, forceNew: boolean,
): Promise<{ ok: boolean; fileName?: string; id?: string; updated?: boolean; error?: string }> {
  return fetch('/__dsh-template-save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, icon, desc, data: snapshot, forceNew }),
  })
    .then((r) => r.json().catch(() => ({ ok: false, error: '响应解析失败' })))
    .then((j) => {
      if (j && j.ok) {
        return {
          ok: true,
          fileName: j.fileName as string,
          id: j.id as string,
          updated: j.updated as boolean,
        };
      }
      return { ok: false, error: (j && j.error) || '写入失败' };
    })
    .catch(() => ({ ok: false, error: 'dev 服务器不可用（请用 npm run dev 启动编辑器）' }));
}

/* ==================== 加载（从文件读取，兼容 v1/v2） ==================== */

export function loadFromFile(store: EditorStore): Promise<void> {
  return new Promise((resolve, reject) => {
    const input = document.getElementById('fileInput') as HTMLInputElement;
    input.value = '';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { reject(); return; }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const raw = JSON.parse(reader.result as string);
          if (raw && raw.version !== 1 && raw.version !== 2) {
            throw new Error('不支持的版本号: ' + raw?.version);
          }
          store.loadMap(migrateMapData(raw));
          resolve();
          showToast(`已加载 ${store.map.name}`, 'success');
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    };
    input.click();
  });
}

/* ==================== 导出 ==================== */

/** 标准地图数据 JSON v2（编辑器唯一产出物） */
export function standardMapDataJSON(store: EditorStore): string {
  return JSON.stringify(store.mapSnapshot(), null, 2);
}

/** MapDefinition TS 代码（兼容视图；rotation≠0 的矩形跳过并注释） */
export function mapDefinitionTSCode(store: EditorStore): string {
  const { map, skippedRotated } = compileMapData(store.mapSnapshot());
  const fmt = (n: number) => parseFloat(n.toFixed(4)).toString();
  const indent = '    ';
  const R = (r: { x: number; y: number; w: number; h: number }) =>
    `R(${fmt(r.x)}, ${fmt(r.y)}, ${fmt(r.w)}, ${fmt(r.h)})`;

  let out = `/**\n * 地图：${map.name}\n * 尺寸：${map.width} × ${map.height}\n`;
  if (skippedRotated > 0) {
    out += ` * ⚠ 警告：${skippedRotated} 个旋转矩形已跳过（游戏当前不支持旋转矩形）\n`;
  }
  out += ` */\n{\n`;
  out += `${indent}id: '${map.id}',\n`;
  out += `${indent}name: '${map.name}',\n`;
  out += `${indent}width: ${map.width},\n`;
  out += `${indent}height: ${map.height},\n`;
  out += `${indent}playerSpawn: { x: ${fmt(map.playerSpawn.x)}, y: ${fmt(map.playerSpawn.y)} },\n\n`;
  out += `${indent}// ── 静态几何 ──\n`;
  out += `${indent}solids: [\n${map.solids.map(r => `${indent}${indent}${R(r)},`).join('\n')}\n${indent}],\n\n`;
  out += `${indent}spikes: [\n${map.spikes.map(s => `${indent}${indent}{ x: ${fmt(s.x)}, y: ${fmt(s.y)} },`).join('\n')}\n${indent}],\n\n`;
  out += `${indent}decos: [\n${map.decos.map(d => `${indent}${indent}[${d.map(fmt).join(', ')}],`).join('\n')}\n${indent}],\n\n`;
  out += `${indent}hints: [\n${map.hints.map(h => `${indent}${indent}[${fmt(h[0])}, ${fmt(h[1])}, '${h[2].replace(/'/g, "\\'")}'],`).join('\n')}\n${indent}],\n\n`;
  if (map.floor && map.floor.cells.length > 0) {
    out += `${indent}// ── MVMap 底盘视觉层 ──\n`;
    out += `${indent}floor: {\n`;
    out += `${indent}${indent}gridSize: ${map.floor.gridSize ?? 1},\n`;
    out += `${indent}${indent}cells: [\n`;
    for (const c of map.floor.cells) {
      out += `${indent}${indent}${indent}{ x: ${fmt(c.x)}, y: ${fmt(c.y)}, w: ${fmt(c.w)}, h: ${fmt(c.h)}, color: ${JSON.stringify(c.color)} },\n`;
    }
    out += `${indent}${indent}],\n`;
    out += `${indent}},\n\n`;
  }
  out += `${indent}// ── 实体生成描述 ──\n`;
  out += `${indent}entitySpawners: {\n`;
  out += `${indent}${indent}movers: [\n${map.entitySpawners.movers.map(m => `${indent}${indent}${indent}{ x0: ${fmt(m.x0)}, y: ${fmt(m.y)}, w: ${fmt(m.w)}, h: ${fmt(m.h)}, range: ${fmt(m.range)}, spd: ${fmt(m.spd)}, ph: ${m.ph === Math.PI ? 'Math.PI' : fmt(m.ph)} },`).join('\n')}\n${indent}${indent}],\n`;
  out += `${indent}${indent}springPads: [\n${map.entitySpawners.springPads.map(s => `${indent}${indent}${indent}{ x: ${fmt(s.x)}, y: ${fmt(s.y)}, w: ${fmt(s.w)}, h: ${fmt(s.h)}, force: { x: ${fmt(s.force.x)}, y: ${fmt(s.force.y)} }, duration: ${fmt(s.duration)} },`).join('\n')}\n${indent}${indent}],\n`;
  out += `${indent}${indent}lasers: [\n${map.entitySpawners.lasers.map(l => `${indent}${indent}${indent}{ x: ${fmt(l.x)}, y0: ${fmt(l.y0)}, len: ${fmt(l.len)}, ph: ${fmt(l.ph)} },`).join('\n')}\n${indent}${indent}],\n`;
  out += `${indent}${indent}orbs: [\n${map.entitySpawners.orbs.map(o => `${indent}${indent}${indent}[${fmt(o[0])}, ${fmt(o[1])}],`).join('\n')}\n${indent}${indent}],\n`;
  out += `${indent}${indent}jumpBoosts: [\n${map.entitySpawners.jumpBoosts.map(j => `${indent}${indent}${indent}[${fmt(j[0])}, ${fmt(j[1])}],`).join('\n')}\n${indent}${indent}],\n`;
  out += `${indent}${indent}checkpoints: [\n${map.entitySpawners.checkpoints.map(c => `${indent}${indent}${indent}[${fmt(c[0])}, ${fmt(c[1])}],`).join('\n')}\n${indent}${indent}],\n`;
  if (map.entitySpawners.hooks && map.entitySpawners.hooks.length > 0) {
    out += `${indent}${indent}hooks: [\n${map.entitySpawners.hooks.map(h => `${indent}${indent}${indent}[${fmt(h[0])}, ${fmt(h[1])}],`).join('\n')}\n${indent}${indent}],\n`;
  }
  if (map.entitySpawners.tracks && map.entitySpawners.tracks.length > 0) {
    out += `${indent}${indent}tracks: [\n`;
    for (const tr of map.entitySpawners.tracks) {
      out += `${indent}${indent}${indent}{\n`;
      out += `${indent}${indent}${indent}${indent}segments: [\n`;
      for (const seg of tr.segments) {
        if (seg.type === 'line') {
          out += `${indent}${indent}${indent}${indent}${indent}{ type: 'line', x1: ${fmt(seg.x1)}, y1: ${fmt(seg.y1)}, x2: ${fmt(seg.x2)}, y2: ${fmt(seg.y2)} },\n`;
        } else {
          out += `${indent}${indent}${indent}${indent}${indent}{ type: 'arc', cx: ${fmt(seg.cx)}, cy: ${fmt(seg.cy)}, radius: ${fmt(seg.radius)}, startAngle: ${seg.startAngle === Math.PI / 2 ? 'Math.PI / 2' : seg.startAngle === -Math.PI / 2 ? '-Math.PI / 2' : fmt(seg.startAngle)}, endAngle: ${seg.endAngle === Math.PI / 2 ? 'Math.PI / 2' : seg.endAngle === -Math.PI / 2 ? '-Math.PI / 2' : fmt(seg.endAngle)}, dir: ${seg.dir} },\n`;
        }
      }
      out += `${indent}${indent}${indent}${indent}],\n`;
      out += `${indent}${indent}${indent}${indent}entryDist: ${fmt(tr.entryDist)},\n`;
      out += `${indent}${indent}${indent}${indent}exitDist: ${fmt(tr.exitDist)},\n`;
      if (tr.speedThreshold !== undefined && tr.speedThreshold !== 7) {
        out += `${indent}${indent}${indent}${indent}speedThreshold: ${fmt(tr.speedThreshold)},\n`;
      }
      out += `${indent}${indent}${indent}},\n`;
    }
    out += `${indent}${indent}],\n`;
  }
  out += `${indent}${indent}nova: { x: ${fmt(map.entitySpawners.nova.x)}, y: ${fmt(map.entitySpawners.nova.y)} },\n`;
  out += `${indent}},\n}`;
  return out;
}

/** 显示导出弹窗（默认展示标准地图数据 v2） */
export function showExport(store: EditorStore): void {
  setExportTab(store, 'standard');
  document.getElementById('exportOverlay')!.classList.remove('hidden');
}

/** 切换导出视图：'standard' 标准数据 / 'ts' MapDefinition 代码 */
export function setExportTab(store: EditorStore, tab: 'standard' | 'ts'): void {
  const ta = document.getElementById('exportCode') as HTMLTextAreaElement;
  ta.value = tab === 'standard' ? standardMapDataJSON(store) : mapDefinitionTSCode(store);
  document.querySelectorAll('#exportTabs .tab').forEach(el => {
    el.classList.toggle('active', (el as HTMLElement).dataset.tab === tab);
  });
}

/* ==================== 从游戏源码导入现有地图 ==================== */

import { maps as gameMaps } from '@game/config/level';

export function getGameMaps(): MapDefinition[] {
  return gameMaps;
}

/** 按索引导入游戏地图（decompile 为 v2） */
export function importGameMap(store: EditorStore, index: number): void {
  const def = gameMaps[index];
  if (!def) return;
  store.loadMap(decompileMapDefinition(def));
}

/** 构建「从游戏导入」列表 */
export function buildImportDialog(store: EditorStore): void {
  const overlay = document.getElementById('importOverlay')!;
  const list = document.getElementById('importList')!;
  list.innerHTML = '';
  gameMaps.forEach((m, i) => {
    const btn = document.createElement('button');
    btn.className = 'import-item';
    btn.innerHTML = `<span class="import-icon">${renderIcon('Map', 16)}</span><span>${m.name}</span><code>${m.id}</code>`;
    btn.addEventListener('click', () => {
      importGameMap(store, i);
      overlay.classList.add('hidden');
      store.onChange?.();
      showToast(`已导入「${m.name}」`, 'success');
    });
    list.appendChild(btn);
  });
  overlay.classList.remove('hidden');
}

/* ==================== 从 MVMap 导入结构底盘 ==================== */

/**
 * 从 MVMap 导出的 .json 导入结构底盘（模式 A：色块=可行走区，黑块=墙，门=墙洞）。
 * 使用专用隐藏 input（#mvFileInput），不干扰「打开…」的 #fileInput。
 */
export function importMvMap(store: EditorStore): void {
  const input = document.getElementById('mvFileInput') as HTMLInputElement;
  if (!input) { showToast('缺少 MVMap 导入控件', 'error'); return; }
  input.value = '';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    importMvMapFile(file)
      .then((data) => {
        store.loadMap(data);
        centerOn(store.map.playerSpawn.x, store.map.playerSpawn.y, 0.8);
        store.onChange?.();
        showToast(
          `已从 MVMap 导入「${data.name}」（${data.width}×${data.height}，` +
          `${data.layers.geometry.length} 块墙 / ${data.layers.floorCells?.length ?? 0} 块可行走区）`,
          'success',
        );
      })
      .catch((e) => {
        showToast(e instanceof MvImportError ? e.message : 'MVMap 导入失败', 'error');
      });
  };
  input.click();
}

/* ==================== 模板新建弹窗 ==================== */

/** HTML 转义（用户输入的模板名/描述可能含特殊字符） */
function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

/** 构建模板选择列表并打开弹窗（内置模板 + 自定义模板） */
export function buildTemplateDialog(store: EditorStore): void {
  const overlay = document.getElementById('templateOverlay')!;
  const list = document.getElementById('templateList')!;
  list.innerHTML = '';

  const items: {
    id: string; name: string; icon: string; desc: string;
    removable: boolean; create: () => MapData;
  }[] = [
    ...MAP_TEMPLATES.map((tpl) => ({
      id: tpl.id, name: tpl.name, icon: tpl.icon, desc: tpl.desc,
      removable: false,
      create: () => tpl.create(),
    })),
    ...loadUserTemplates().map((ut) => ({
      id: ut.id, name: ut.name, icon: ut.icon, desc: ut.desc,
      removable: true,
      create: () => JSON.parse(JSON.stringify(ut.data)) as MapData,
    })),
  ];

  for (const it of items) {
    const row = document.createElement('div');
    row.className = 'template-row';

    const btn = document.createElement('button');
    btn.className = 'template-item';
    btn.innerHTML = `
      <span class="template-icon">${renderIcon(it.icon, 18)}</span>
      <span class="template-main">
        <span class="template-name">${escHtml(it.name)}</span>
        <span class="template-desc">${escHtml(it.desc)}</span>
      </span>
      <code>${escHtml(it.id)}</code>`;
    btn.addEventListener('click', () => {
      store.loadMap(it.create());
      centerOn(store.map.playerSpawn.x, store.map.playerSpawn.y, 0.8);
      overlay.classList.add('hidden');
      store.onChange?.();
      showToast(`已新建「${it.name}」`, 'success');
    });
    row.appendChild(btn);

    if (it.removable) {
      const del = document.createElement('button');
      del.className = 'template-del';
      del.title = '删除此模板';
      del.textContent = '×';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        removeUserTemplate(it.id);
        buildTemplateDialog(store);
        showToast(`已删除模板「${it.name}」`, 'info');
      });
      row.appendChild(del);
    }
    list.appendChild(row);
  }
  overlay.classList.remove('hidden');
}

/* ==================== 自检 ==================== */

import { verifyRoundTrip } from './mapCodec';

/** 启动自检：对游戏所有现有地图做 round-trip 验证 */
export function runSelfCheck(): string[] {
  const results: string[] = [];
  for (let i = 0; i < gameMaps.length; i++) {
    const report = verifyRoundTrip(gameMaps[i]);
    results.push(
      report.ok
        ? `✅ [${i}] ${gameMaps[i].name} — round-trip 无损（${report.objectCount} 对象）`
        : `❌ [${i}] ${gameMaps[i].name} — ${report.differences.slice(0, 3).join('; ')}`,
    );
  }
  return results;
}

/* ==================== 自动保存（localStorage，v2） ==================== */

const AUTO_SAVE_KEY = 'mapcreater.autosave';

export function autoSave(store: EditorStore): void {
  try {
    localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(store.mapSnapshot()));
  } catch { /* IO error, ignore */ }
}

export function loadAutoSave(store: EditorStore): boolean {
  try {
    const raw = localStorage.getItem(AUTO_SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data && (data.version === 1 || data.version === 2)) {
      store.loadMap(migrateMapData(data));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function clearAutoSave(): void {
  localStorage.removeItem(AUTO_SAVE_KEY);
}

// 全局导出函数（HTML 内联事件用）
const win = window as any;
win.hideExport = () => document.getElementById('exportOverlay')!.classList.add('hidden');
win.hideImport = () => document.getElementById('importOverlay')!.classList.add('hidden');
win.hideTemplate = () => document.getElementById('templateOverlay')!.classList.add('hidden');
win.hideTemplateSave = hideTemplateSave;
win.confirmSaveTemplate = confirmSaveTemplate;
win.copyExport = () => {
  const ta = document.getElementById('exportCode') as HTMLTextAreaElement;
  ta.select(); ta.setSelectionRange(0, 999999);
  navigator.clipboard.writeText(ta.value).then(() => {
    const btn = document.querySelector('.copyBtn')!;
    const orig = btn.textContent;
    btn.textContent = '已复制！';
    setTimeout(() => btn.textContent = orig, 1500);
  }).catch(() => {});
};