/** scan-full.mjs —— 完整游戏管线（非手工渲染）逐格采样：
 *  强制整图入视口（setInterval 压住 updateCamera），真实渲染下一帧采样，
 *  展示用户实际看到的画面（含视差/光晕/小地图叠加），用字符网格输出。 */
import { chromium } from 'playwright';

const maps = [
  'mvmap-2d-map-design',
  'mvmap-platform-tree',
  'mvmap-scatter-platforms',
];

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

for (const mid of maps) {
  const r = await page.evaluate(async ({ urls, mid, VW, VH }) => {
    const game = await import(urls['/src/systems/game/index.ts']);
    const gsMod = await import(urls['/src/systems/game/gameState.ts']);
    const lvl = await import(urls['/src/config/level.ts']);
    const camMod = await import(urls['/src/core/camera.ts']);
    const playerMod = await import(urls['/src/systems/player/index.ts']);
    game.applyLevel(mid);
    gsMod.gs.screen = 'playing';
    const mp = lvl.currentMap;
    const p = playerMod.playerController.getState();
    p.x = mp.width / 2; p.y = mp.height / 2;
    p.velocity.x = 0; p.velocity.y = 0; p.dead = false;
    const PPM = 48, z = Math.min(VW / (PPM * mp.width), VH / (PPM * mp.height)) * 0.95;
    const vw = VW / (PPM * z), vh = VH / (PPM * z);
    // 每 16ms 压住相机（updateCamera 每帧会被覆盖）
    camMod.view.zoom = z;
    const timer = setInterval(() => {
      camMod.view.zoom = z;
      camMod.view.SZ = PPM * z;
      camMod.cam.x = mp.width / 2;
      camMod.cam.y = mp.height / 2;
      camMod.view.SL = mp.width / 2 - vw / 2;
      camMod.view.SB = mp.height / 2 - vh / 2;
    }, 16);
    await new Promise((res) => setTimeout(res, 600));
    const cv = document.getElementById('c');
    const g = cv.getContext('2d');
    const img = g.getImageData(0, 0, VW, VH).data;
    const SZ = PPM * z;
    const sx = (x) => (x - camMod.view.SL) * SZ;
    const sy = (y) => VH - (y - camMod.view.SB) * SZ;
    const sampled = [];
    const badPx = [];
    for (let topRow = 0; topRow < mp.height; topRow++) {
      const my = mp.height - 1 - topRow;
      const row = [];
      for (let mx = 0; mx < mp.width; mx++) {
        const px = Math.round(sx(mx + 0.5)), py = Math.round(sy(my + 0.5));
        if (px < 0 || px >= VW || py < 0 || py >= VH) { row.push([0, 0, 0]); continue; }
        const i = (py * VW + px) * 4;
        row.push([img[i], img[i + 1], img[i + 2]]);
      }
      sampled.push(row);
    }
    clearInterval(timer);
    return { id: mp.id, w: mp.width, h: mp.height, sampled };
  }, { urls, mid, VW: 1280, VH: 720 });

  console.log('\n═══ ' + r.id + ` (${r.w}×${r.h}) 完整渲染 ═══ 字符：F=亮色块, f=暗色块, W=亮墙, w=暗墙, .=背景`);
  for (let ty = 0; ty < r.h; ty++) {
    let line = '';
    for (let mx = 0; mx < r.w; mx++) {
      const s = r.sampled[ty][mx];
      const lum = 0.299 * s[0] + 0.587 * s[1] + 0.114 * s[2];
      const r2 = s[0], g2 = s[1], b2 = s[2];
      // 颜色倾向
      const sat = Math.max(r2, g2, b2) - Math.min(r2, g2, b2);
      if (lum > 70) line += 'W';            // 亮（墙边/玩家/霓虹）
      else if (sat > 30 && lum > 28) line += 'F'; // 有色且偏亮（色块）
      else if (lum > 30) line += 'f';       // 中亮（暗色块/受光晕影响的背景）
      else line += '.';                     // 暗
    }
    console.log(String(r.h - 1 - ty).padStart(2) + ' ' + line);
  }
}

await browser.close();
console.log('\nDONE');