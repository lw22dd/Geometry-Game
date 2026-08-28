/**
 * mvmap2level.ts —— 把 Draft/*.mvmap.json 编译为「特定格式 JSON」数据（管道隔离）。
 *
 * 语义（与 mvmapImport.ts 完全一致）：
 *   · 色块（房间 cells）= 可行走区 → floor（视觉层）
 *   · 包围盒内未涂色格  = 墙 → solids（碰撞体）
 *   · 门               = 墙上开洞（门两侧格从墙中挖掉）
 *   · 灰盒 solid/platform → solids；note → hints；房间备注 → hints
 *
 * 边界：工具只负责产出 JSON 数据（工具/SceneEditor/export/mvmap-maps.json），
 * 绝不写入游戏源码（src/config/** 一律不碰）。游戏侧地图在 src/config/level.ts 手写维护。
 *
 * 运行方式（SceneEditor 目录下）：
 *   npx tsx verify/mvmap2level.ts            # 打印每张底图的统计
 *   npx tsx verify/mvmap2level.ts --json     # 只打印 JSON 统计
 *   npx tsx verify/mvmap2level.ts --write    # 导出 export/mvmap-maps.json（等价 verify/export-json.mjs）
 */
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import * as path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));      // SceneEditor/
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

const writeFlag = process.argv.includes('--write');
const jsonFlag = process.argv.includes('--json');

try {
  const imp = await server.ssrLoadModule('/src/mvmapImport.ts');
  const codec = await server.ssrLoadModule('/src/mapCodec.ts');

  const files = readdirSync(DRAFT_DIR).filter((f: string) => f.endsWith('.mvmap.json')).sort();

  const maps: any[] = [];
  for (const f of files) {
    const raw = readFileSync(path.join(DRAFT_DIR, f), 'utf8');
    const data = imp.importMvMapJson(raw);
    const compiled = codec.compileMapData(data);
    const map = compiled.map;
    // 稳定 id：mvmap-<草稿文件名>（游戏侧引用以此为准）
    map.id = 'mvmap-' + f.replace(/\.mvmap\.json$/, '');
    // floor 视觉层 = 墙体（与 solids 逐块同坐标，统一色块）→ 游戏按旧地图方式把墙画成色块
    map.floor = {
      gridSize: 1,
      cells: map.solids.map((s) => ({ x: s.x, y: s.y, w: s.w, h: s.h, color: WALL_COLOR })),
    };
    maps.push(map);
    console.log(
      `✓ ${f.padEnd(32)} ${map.name.padEnd(20)} ${String(map.width).padStart(3)}×${String(map.height).padStart(3)} ` +
      `墙 ${String(map.solids.length).padStart(3)} / 色块 ${String(map.floor.cells.length).padStart(3)} / hint ${map.hints.length}`,
    );
  }

  if (jsonFlag) {
    console.log(JSON.stringify(maps.map((m) => ({ id: m.id, name: m.name, w: m.width, h: m.height })), null, 2));
  } else if (writeFlag) {
    const payload = {
      format: 'mvmap-levels',
      version: 1,
      generatedAt: new Date().toISOString(),
      note: '由 SceneEditor/verify/mvmap2level.ts --write（或 verify/export-json.mjs）从 工具/MVMap/Draft/*.mvmap.json 编译导出。' +
        '工具只负责产出本 JSON 数据；游戏侧地图为手写维护数据，不自动引用本文件。',
      maps,
    };
    mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8');
    console.log(`\n✅ 已导出 ${OUT_FILE}（${maps.length} 张地图）`);
  } else {
    console.log(`\n共 ${maps.length} 张底图。加 --write 导出 ${OUT_FILE}，或 --json 输出摘要。`);
  }
} finally {
  await server.close();
}