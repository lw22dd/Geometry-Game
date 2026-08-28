/** check-spawn.mjs —— 检查每张 MVMap 图出生点：是否在墙内 / 下方是否有墙支撑（避免出生后大落差）。 */
import { chromium } from 'playwright';

const maps = [
  'mvmap-2d-map-design',
  'mvmap-platform-tree',
  'mvmap-scatter-platforms',
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:5174', { waitUntil: 'load' });
await page.waitForTimeout(1000);

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

const lvl = await page.evaluate(async ({ urls }) => {
  const l = await import(urls['/src/config/level.ts']);
  return l.maps.filter((m) => m.id.startsWith('mvmap-'));
}, { urls });

for (const mp of lvl) {
  const sx = mp.playerSpawn.x, sy2 = mp.playerSpawn.y;
  const cx = Math.floor(sx), cy = Math.floor(sy2);
  const inWall = mp.solids.some((s) => cx >= s.x && cx < s.x + s.w && cy >= s.y && cy < s.y + s.h);
  // 下方是否有墙（支撑）
  let floorBelow = false, floorBelowY = -1;
  for (let yy = cy - 1; yy >= 0; yy--) {
    const hit = mp.solids.find((s) => cx >= s.x && cx < s.x + s.w && yy >= s.y && yy < s.y + s.h);
    if (hit) { floorBelow = true; floorBelowY = yy; break; }
  }
  // 出生点所在格下方的墙顶
  const support = mp.solids.filter((s) => sx >= s.x && sx < s.x + s.w && cy - 1 >= s.y && cy - 1 < s.y + s.h);
  console.log(`\n${mp.id} 出生点(${sx.toFixed(2)},${sy2.toFixed(2)}) 格(${cx},${cy}) 在墙内=${inWall}`);
  console.log(`  下方最近墙顶 y=${floorBelowY}（有支撑=${floorBelow}，与出生格相距 ${(cy - floorBelowY).toFixed(0)} 格）`);
  console.log(`  出生格正下方(cy-1=${cy - 1})是否有墙顶支撑: ${support.length > 0 ? '是 ' + JSON.stringify(support[0]) : '否（会下落）'}`);
}
await browser.close();
console.log('\nDONE');