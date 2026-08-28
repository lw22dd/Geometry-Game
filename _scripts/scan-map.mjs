/** scan-map.mjs —— 页内像素级渲染核查：
 *  手动把相机设为整图视图 + 清屏为纯色背景，只调 drawFloor/drawSolids，
 *  逐世界格采样中心像素，与「期望颜色」（floor 色块 0.3 混色 / 墙暗体 / 空背景）比对，
 *  输出字符网格 + 差异清单，用于在无图像模型输入下核查渲染正确性。 */
import { chromium } from 'playwright';
import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = path.resolve('./_scan');
mkdirSync(OUT, { recursive: true });
const maps = [  'mvmap-2d-map-design',
  'mvmap-platform-tree',
  'mvmap-scatter-platforms',
  'map_vrg5wrvjcd',
];

const BG = [7, 4, 23]; // 与游戏背景同族的纯色背景（flat）
const WALL_BODY = [15, 11, 42]; // neonBox 底体

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:5174', { waitUntil: 'load' });
await page.waitForTimeout(1200);

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

const results = [];
for (const mapId of maps) {
  const scan = await page.evaluate(async ({ urls, mid, BG, WALL_BODY, VW, VH }) => {
    const game = await import(urls['/src/systems/game/index.ts']);
    const gsMod = await import(urls['/src/systems/game/gameState.ts']);
    const lvl = await import(urls['/src/config/level.ts']);
    const camMod = await import(urls['/src/core/camera.ts']);
    const scenes = await import(urls['/src/Prefabs/Scenes/index.ts']);
    game.applyLevel(mid);
    gsMod.gs.screen = 'playing';
    const mp = lvl.currentMap;
    const cv = document.getElementById('c');
    const g = cv.getContext('2d');
    const PPM = 48;
    const z = Math.min(VW / (PPM * mp.width), VH / (PPM * mp.height)) * 0.96;
    const vw = VW / (PPM * z), vh = VH / (PPM * z);
    camMod.view.zoom = z; camMod.view.SZ = PPM * z;
    camMod.view.SL = mp.width / 2 - vw / 2;
    camMod.view.SB = mp.height / 2 - vh / 2;
    camMod.cam.x = mp.width / 2; camMod.cam.y = mp.height / 2;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = `rgb(${BG[0]},${BG[1]},${BG[2]})`;
    g.fillRect(0, 0, VW, VH);
    scenes.drawFloor();
    scenes.drawSolids();
    const SZ = PPM * z;
    const sx = (x) => (x - camMod.view.SL) * SZ;
    const sy = (y) => VH - (y - camMod.view.SB) * SZ;
    const img = g.getImageData(0, 0, VW, VH).data;
    // 采样：每格中心（显示行序：最高 y 在最上）
    const sampled = [];
    for (let topRow = 0; topRow < mp.height; topRow++) {
      const my = mp.height - 1 - topRow;
      const row = [];
      for (let mx = 0; mx < mp.width; mx++) {
        const px = Math.round(sx(mx + 0.5)), py = Math.round(sy(my + 0.5));
        const i = (py * VW + px) * 4;
        row.push([img[i], img[i + 1], img[i + 2]]);
      }
      sampled.push(row);
    }
    // 期望分类：F=色块, W=墙, .=空, B=重叠
    const cls = sampled.map((row, ty) => row.map((_, mx) => {
      const my = mp.height - 1 - ty;
      let f = false, w = false;
      for (const c of mp.floor?.cells ?? []) {
        if (mx >= c.x && mx < c.x + c.w && my >= c.y && my < c.y + c.h) { f = true; break; }
      }
      for (const s of mp.solids) {
        if (mx >= s.x && mx < s.x + s.w && my >= s.y && my < s.y + s.h) { w = true; break; }
      }
      return f ? (w ? 'B' : 'F') : (w ? 'W' : '.');
    }));
    // 期望色（格中心，不上格线/描边）：floor=色块0.3+bg0.7；wall=暗体
    const expColor = (mx, my) => {
      for (const c of mp.floor?.cells ?? []) {
        if (mx >= c.x && mx < c.x + c.w && my >= c.y && my < c.y + c.h) {
          const n = parseInt(c.color.replace('#', ''), 16);
          const cr = (n >> 16) & 255, cg = (n >> 8) & 255, cb = n & 255;
          return [Math.round(cr * 0.3 + BG[0] * 0.7), Math.round(cg * 0.3 + BG[1] * 0.7), Math.round(cb * 0.3 + BG[2] * 0.7)];
        }
      }
      for (const s of mp.solids) {
        if (mx >= s.x && mx < s.x + s.w && my >= s.y && my < s.y + s.h) return WALL_BODY;
      }
      return BG;
    };
    const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
    const tol = 45; // 光晕/抗锯齿容差
    const bad = [];
    for (let ty = 0; ty < mp.height; ty++) {
      for (let mx = 0; mx < mp.width; mx++) {
        const my = mp.height - 1 - ty;
        const s = sampled[ty][mx], e = expColor(mx, my);
        const d = dist(s, e);
        if (d > tol && cls[ty][mx] !== '.') {
          bad.push({ x: mx, y: my, cls: cls[ty][mx], sampled: s.join(','), exp: e.join(','), d });
        }
      }
    }
    // 移动语义：色块中心是否被墙覆盖；空缺是否全部被墙覆盖
    const floorCells = [];
    for (const c of mp.floor?.cells ?? []) {
      for (let yy = 0; yy < c.h; yy++) for (let xx = 0; xx < c.w; xx++) floorCells.push([c.x + xx, c.y + yy]);
    }
    const wallSet = new Set();
    for (const s of mp.solids) {
      for (let yy = 0; yy < s.h; yy++) for (let xx = 0; xx < s.w; xx++) wallSet.add(s.x + xx + ',' + (s.y + yy));
    }
    const floorInWall = floorCells.filter(([x, y]) => wallSet.has(x + ',' + y)).length;
    let emptyNotWall = 0, firstGap = null;
    for (let my = 0; my < mp.height; my++) {
      for (let mx = 0; mx < mp.width; mx++) {
        const isFloor = floorCells.some(([x, y]) => x === mx && y === my);
        const isWall = wallSet.has(mx + ',' + my);
        if (!isFloor && !isWall) { emptyNotWall++; if (!firstGap) firstGap = [mx, my]; }
      }
    }
    return {
      id: mp.id, w: mp.width, h: mp.height,
      floorRectCount: mp.floor?.cells.length ?? 0, solidCount: mp.solids.length,
      floorCellCount: floorCells.length, wallCellCount: wallSet.size,
      floorInWall, emptyNotWall, firstGap,
      sampled, cls, bad: bad.slice(0, 25), badCount: bad.length,
    };
  }, { urls, mid: mapId, BG, WALL_BODY, VW: 1280, VH: 720 });
  results.push(scan);
  writeFileSync(path.join(OUT, scan.id + '.json'), JSON.stringify(scan, null, 1));
}

// ── 输出字符网格 + 概览 ──
for (const r of results) {
  console.log('\n═══ ' + r.id + ` (${r.w}×${r.h}) 色块矩形 ${r.floorRectCount} / 墙矩形 ${r.solidCount} / 色块格 ${r.floorCellCount} / 墙格 ${r.wallCellCount} ═══`);
  console.log(`色块格被墙覆盖: ${r.floorInWall} | 空缺未覆盖格: ${r.emptyNotWall}${r.firstGap ? ' e.g.(' + r.firstGap + ')' : ''} | 采样偏离>tol: ${r.badCount}`);
  console.log('--- 采样字符网格（期望→渲染比对: F色块/W墙/.空 一致；! 偏离；? 空处异常亮）---');
  for (let ty = 0; ty < r.h; ty++) {
    let line = '';
    for (let mx = 0; mx < r.w; mx++) {
      const s = r.sampled[ty][mx];
      const e = r.cls[ty][mx];
      const lum = 0.299 * s[0] + 0.587 * s[1] + 0.114 * s[2];
      const expLum = 0.299 * BG[0] + 0.587 * BG[1] + 0.114 * BG[2];
      if (e === '.') line += lum > expLum + 25 ? '?' : ' ';
      else if (e === 'F') line += lum > expLum + 20 ? 'F' : '!';
      else line += lum > expLum + 25 ? 'W' : 'w'; // w=暗体内部(正常), W=亮边/亮块
    }
    console.log(String(r.h - 1 - ty).padStart(2) + ' ' + line);
  }
  if (r.badCount) {
    console.log('偏离样本(前8):', JSON.stringify(r.bad.slice(0, 8)));
  }
}

await browser.close();
console.log('\nDONE →', OUT);