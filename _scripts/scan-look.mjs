/** scan-look.mjs —— 受控复刻 renderGame 的真实观感（背景渐变 + drawFloor + drawSolids，
 *  无相机竞争），对 mvmap-2d-map-design 逐格采样精确 RGB，量化色块在真实背景上的可见度。 */
import { chromium } from 'playwright';

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

const mid = process.argv[2] || 'mvmap-2d-map-design';
const r = await page.evaluate(async ({ urls, mid }) => {
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
  const VW = 1280, VH = 720, PPM = 48;
  const z = Math.min(VW / (PPM * mp.width), VH / (PPM * mp.height)) * 0.96;
  const vw = VW / (PPM * z), vh = VH / (PPM * z);
  camMod.view.zoom = z; camMod.view.SZ = PPM * z;
  camMod.view.SL = mp.width / 2 - vw / 2;
  camMod.view.SB = mp.height / 2 - vh / 2;
  g.setTransform(1, 0, 0, 1, 0, 0);
  // 复刻 render() 的竖向渐变背景
  let gr = g.createLinearGradient(0, 0, 0, VH);
  gr.addColorStop(0, '#080517'); gr.addColorStop(0.5, '#120a30'); gr.addColorStop(1, '#1d0f45');
  g.fillStyle = gr; g.fillRect(0, 0, VW, VH);
  // 复刻 renderGame 的径向光晕（无 pulse 波动取基值）
  g.globalCompositeOperation = 'lighter';
  let bg = g.createRadialGradient(VW / 2, VH * 1.05, 50, VW / 2, VH * 1.05, VH * 0.95);
  bg.addColorStop(0, 'rgba(120,70,255,0.16)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = bg; g.fillRect(0, 0, VW, VH);
  g.globalCompositeOperation = 'source-over';
  scenes.drawFloor();
  scenes.drawSolids();
  const SZ = PPM * z;
  const sx = (x) => (x - camMod.view.SL) * SZ;
  const sy = (y) => VH - (y - camMod.view.SB) * SZ;
  const img = g.getImageData(0, 0, VW, VH).data;
  const rows = [];
  for (let ty = 0; ty < mp.height; ty++) {
    const my = mp.height - 1 - ty;
    const row = [];
    for (let mx = 0; mx < mp.width; mx++) {
      const px = Math.round(sx(mx + 0.5)), py = Math.round(sy(my + 0.5));
      const i = (py * VW + px) * 4;
      row.push([img[i], img[i + 1], img[i + 2]]);
    }
    rows.push(row);
  }
  // 期望分类
  const cls = rows.map((row, ty) => row.map((_, mx) => {
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
  return { w: mp.width, h: mp.height, rows, cls };
}, { urls, mid });

// 打印带真实颜色的网格：每个格显示 亮度/分类
console.log(`\n═══ ${mid} (${r.w}×${r.h}) 受控"真实观感"渲染（背景渐变+floor+solids）═══`);
for (let ty = 0; ty < r.h; ty++) {
  let line = '';
  for (let mx = 0; mx < r.w; mx++) {
    const s = r.rows[ty][mx];
    const lum = Math.round(0.299 * s[0] + 0.587 * s[1] + 0.114 * s[2]);
    const e = r.cls[ty][mx];
    const ch = e === '.' ? '·' : e; // ·=背景
    line += (e === '.' ? ' ' : ch) + String(lum).padStart(2).replace(' ', '');
  }
  console.log(String(r.h - 1 - ty).padStart(2) + ' ' + line);
}
// 抽样几个代表性格子的精确 RGB（色块/墙/背景）
const probes = [
  { label: '色块(蓝 #4c8dd8)', x: 20, y: 18 },
  { label: '色块(绿 #3fb27f)', x: 3, y: 13 },
  { label: '色块(青 #4cc9d8)', x: 4, y: 7 },
  { label: '色块(黄 #d8b64c)', x: 4, y: 4 },
  { label: '墙体', x: 0, y: 20 },
  { label: '墙体2', x: 20, y: 20 },
  { label: '墙体3', x: 20, y: 0 },
];
console.log('\n精确采样:');
for (const p of probes) {
  const ty = r.h - 1 - p.y;
  const s = r.rows[ty][p.x];
  const e = r.cls[ty][p.x];
  console.log(`  ${p.label} (${p.x},${p.y}) 分类=${e}  RGB=(${s[0]},${s[1]},${s[2]})  亮度=${Math.round(0.299 * s[0] + 0.587 * s[1] + 0.114 * s[2])}`);
}

await browser.close();
console.log('\nDONE');