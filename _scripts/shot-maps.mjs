/** shot-maps.mjs —— 打开运行中的游戏，按精确 ?t= 模块 URL 动态 import 拿到同一实例，
 *  applyLevel 逐张切到导入地图，做语义验证（色块=可走区？）并分片截图。 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const OUT = process.env.SHOT_DIR || path.resolve('./_shots');
mkdirSync(OUT, { recursive: true });

const maps = [
  'map_vrg5wrvjcd',
  'mvmap-2d-map-design',
  'mvmap-platform-tree',
  'mvmap-scatter-platforms',
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:5174', { waitUntil: 'load' });
await page.waitForTimeout(1200);

// ── 爬取主应用真实模块 URL ──
const urls = await page.evaluate(async () => {
  const sc = document.querySelector('script[type=module][src*="/src/main.ts"]');
  const entry = sc.src;
  const parseImports = (src) => {
    const map = {};
    for (const m of src.matchAll(/(?:import\s+[^'"]*?\s+from\s+|import\s+)["'](\/src\/[^"']+\.ts(?:\?t=\d+)?)["']/g)) {
      map[m[1].split('?')[0]] = m[1];
    }
    return map;
  };
  const entrySrc = await (await fetch(entry)).text();
  const m1 = parseImports(entrySrc);
  const gameSrc = await (await fetch(m1['/src/systems/game/index.ts'])).text();
  const m2 = parseImports(gameSrc);
  return { ...m2, ...m1 };
});
console.log('urls:', JSON.stringify(urls, null, 2));

for (const mapId of maps) {
  // 切图 + 语义验证
  const stat = await page.evaluate(async ({ urls, mid }) => {
    const game = await import(urls['/src/systems/game/index.ts']);
    const gsMod = await import(urls['/src/systems/game/gameState.ts']);
    const lvl = await import(urls['/src/config/level.ts']);
    game.applyLevel(mid);
    gsMod.gs.screen = 'playing';
    const mp = lvl.currentMap;
    // 语义：色块 floor 格中心是否被任何 solid（墙）覆盖
    const overlapped = [];
    for (const c of mp.floor?.cells ?? []) {
      const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
      for (const s of mp.solids) {
        if (cx >= s.x && cx < s.x + s.w && cy >= s.y && cy < s.y + s.h) {
          overlapped.push({ floor: { x: c.x, y: c.y, w: c.w, h: c.h }, solid: { x: s.x, y: s.y, w: s.w, h: s.h } });
          break;
        }
      }
    }
    return {
      id: mp.id, name: mp.name, w: mp.width, h: mp.height, spawn: mp.playerSpawn,
      solids: mp.solids.length, floorCells: mp.floor?.cells.length ?? 0,
      floorOverlapsSolid: overlapped.length,
      overlapSample: overlapped.slice(0, 3),
      nova: mp.entitySpawners?.nova ?? null,
    };
  }, { urls, mid: mapId });
  console.log('map:', JSON.stringify(stat));
  await page.waitForTimeout(450);

  // ── 分片截图（zoom=1 视口 26.67×15；片内中心距 20×12）──
  const { w, h, id } = stat;
  const nx = Math.max(1, Math.ceil(w / 20));
  const ny = Math.max(1, Math.ceil(h / 12));
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x = w * (i + 0.5) / nx;
      const y = h * (j + 0.5) / ny;
      await page.evaluate(async ({ x, y, urls }) => {
        const camMod = await import(urls['/src/core/camera.ts']);
        const playerMod = await import(urls['/src/systems/player/index.ts']);
        const p = playerMod.playerController.getState();
        p.x = x; p.y = y; p.velocity.x = 0; p.velocity.y = 0; p.dead = false;
        camMod.cam.x = x; camMod.cam.y = y + 2.3;
      }, { x, y, urls });
      await page.waitForTimeout(220);
      await page.evaluate(async ({ urls }) => {
        const camMod = await import(urls['/src/core/camera.ts']);
        const gsMod = await import(urls['/src/systems/game/gameState.ts']);
        gsMod.gs.screen = 'playing';
        const vp = { zoom: 1 };
        camMod.view.zoom = 1; camMod.view.SZ = 48;
        void vp;
      }, { urls });
      await page.waitForTimeout(80);
      await page.screenshot({ path: path.join(OUT, `${id}-${i}x${j}.png`) });
    }
  }
}

await browser.close();
console.log('DONE →', OUT);