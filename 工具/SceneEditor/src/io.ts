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

/* ==================== 保存（下载标准地图数据 JSON v2） ==================== */

export function saveToFile(store: EditorStore): void {
  const data = store.mapSnapshot();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`已保存 ${data.name}（${data.width}×${data.height}）`, 'success');
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

/** 构建模板选择列表并打开弹窗 */
export function buildTemplateDialog(store: EditorStore): void {
  const overlay = document.getElementById('templateOverlay')!;
  const list = document.getElementById('templateList')!;
  list.innerHTML = '';
  for (const tpl of MAP_TEMPLATES) {
    const btn = document.createElement('button');
    btn.className = 'template-item';
    btn.innerHTML = `
      <span class="template-icon">${renderIcon(tpl.icon, 18)}</span>
      <span class="template-main">
        <span class="template-name">${tpl.name}</span>
        <span class="template-desc">${tpl.desc}</span>
      </span>
      <code>${tpl.id}</code>`;
    btn.addEventListener('click', () => {
      store.loadMap(tpl.create());
      centerOn(store.map.playerSpawn.x, store.map.playerSpawn.y, 0.8);
      overlay.classList.add('hidden');
      store.onChange?.();
      showToast(`已新建「${tpl.name}」`, 'success');
    });
    list.appendChild(btn);
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