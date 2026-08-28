/** verify-floor.mjs —— 校验重生成后：floor 单元格与 solids 完全同坐标（drawSolids 跳过→墙以色块绘），
 *  并统计各图 hints / floor / solids 数量。 */
import { chromium } from 'playwright';

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

const out = await page.evaluate(async ({ urls }) => {
  const l = await import(urls['/src/config/level.ts']);
  const res = [];
  for (const mp of l.maps.filter((m) => m.id.startsWith('mvmap-'))) {
    const floorSet = new Set((mp.floor?.cells ?? []).map((c) => c.x + ',' + c.y + ',' + c.w + ',' + c.h));
    const noMatch = mp.solids.filter((s) => !floorSet.has(s.x + ',' + s.y + ',' + s.w + ',' + s.h));
    // 可行走空间（非 floor 非 solid 的格）是否真的无颜色填充
    res.push({
      id: mp.id, w: mp.width, h: mp.height,
      solids: mp.solids.length,
      floorCells: mp.floor?.cells.length ?? 0,
      solidWithoutFloorMatch: noMatch.length,
      hints: mp.hints.length,
      spawn: mp.playerSpawn,
      hintTexts: mp.hints.map((h) => h[2]),
    });
  }
  return res;
}, { urls });

for (const r of out) {
  console.log(`\n${r.id} (${r.w}×${r.h})`);
  console.log(`  solids=${r.solids} floorCells=${r.floorCells} 无floor匹配的solid=${r.solidWithoutFloorMatch} hints=${r.hints} spawn=(${r.spawn.x},${r.spawn.y})`);
  if (r.hintTexts.length) console.log('  hints:', JSON.stringify(r.hintTexts));
}

await browser.close();
console.log('\nDONE');