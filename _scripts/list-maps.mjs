/** list-maps.mjs —— 列出游戏当前加载的全部地图 */
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:5174', { waitUntil: 'load' });
await page.waitForTimeout(900);
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
const list = await page.evaluate(async ({ urls }) => {
  const l = await import(urls['/src/config/level.ts']);
  return l.maps.map((m) => `${m.id}  ·  ${m.name}  (${m.width}×${m.height})`);
}, { urls });
console.log('共 ' + list.length + ' 张地图：');
list.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
await browser.close();