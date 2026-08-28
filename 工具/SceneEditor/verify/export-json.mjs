/**
 * export-json.mjs —— MVMap 草稿 → 「特定格式 JSON」数据导出（管道隔离）。
 *
 * 职责：把 工具/MVMap/Draft/*.mvmap.json 通过导入器 + 编译逻辑转换后，
 * 导出为一份纯 JSON 数据文件（工具/MVMap/Draft → 工具/SceneEditor/export/mvmap-maps.json）。
 *
 * 边界：
 *  · 工具只负责产出 JSON 数据，绝不写入游戏源码（src/config/** 一律不碰）。
 *  · 游戏侧地图为手写维护数据（src/config/level.ts），玩家/作者从本 JSON 手工取用。
 *
 * 运行（SceneEditor 目录下）：node verify/export-json.mjs
 */
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import * as path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));       // SceneEditor/
const DRAFT_DIR = fileURLToPath(new URL('../../MVMap/Draft/', import.meta.url));
const OUT_FILE = fileURLToPath(new URL('../export/mvmap-maps.json', import.meta.url));

/** 墙体视觉层统一色块（与游戏旧地图一致） */
const WALL_COLOR = '#4c8dd8';

const server = await createServer({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  root: ROOT,
  server: { middlewareMode: true },
  logLevel: 'warn',
});

try {
  const imp = await server.ssrLoadModule('/src/mvmapImport.ts');
  const codec = await server.ssrLoadModule('/src/mapCodec.ts');

  const files = readdirSync(DRAFT_DIR).filter((f) => f.endsWith('.mvmap.json')).sort();
  if (files.length === 0) {
    console.log('工具/MVMap/Draft/ 下没有 *.mvmap.json 草稿，无数据可导出。');
    process.exit(0);
  }

  const maps = [];
  for (const f of files) {
    const raw = readFileSync(path.join(DRAFT_DIR, f), 'utf8');
    const data = imp.importMvMapJson(raw);
    const { map, skippedRotated } = codec.compileMapData(data);
    // 稳定 id：mvmap-<草稿文件名>（与旧版生成器一致，游戏侧引用以此为准）
    map.id = 'mvmap-' + f.replace(/\.mvmap\.json$/, '');
    // 墙体视觉层：与 solids 逐块同坐标、统一色块（游戏旧地图同款渲染约定）
    map.floor = {
      gridSize: 1,
      cells: map.solids.map((s) => ({ x: s.x, y: s.y, w: s.w, h: s.h, color: WALL_COLOR })),
    };
    maps.push(map);
    console.log(
      `✓ ${f.padEnd(32)} ${map.name.padEnd(20)} ${String(map.width).padStart(3)}×${String(map.height).padStart(3)} ` +
      `墙 ${String(map.solids.length).padStart(3)} / 色块 ${String(map.floor.cells.length).padStart(3)} / hint ${map.hints.length}` +
      (skippedRotated > 0 ? ` / 跳过旋转 ${skippedRotated}` : ''),
    );
  }

  const payload = {
    format: 'mvmap-levels',
    version: 1,
    generatedAt: new Date().toISOString(),
    note: '由 SceneEditor/verify/export-json.mjs 从 工具/MVMap/Draft/*.mvmap.json 编译导出。' +
      '工具只负责产出本 JSON 数据；游戏侧地图为手写维护数据，不自动引用本文件。',
    maps,
  };

  mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`\n✅ 已导出 ${OUT_FILE}（${maps.length} 张地图）`);
} finally {
  await server.close();
}