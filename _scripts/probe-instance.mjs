/** probe-instance.mjs —— 验证用精确 ?t= URL 动态 import 能否拿到主应用同一模块实例，并 applyLevel 切图 */
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:5174', { waitUntil: 'load' });
await page.waitForTimeout(1200);

const out = await page.evaluate(async () => {
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
  const urls = { ...m2, ...m1 };

  const lvl = await import(urls['/src/config/level.ts']);
  const before = lvl.currentMap?.id;
  const game = await import(urls['/src/systems/game/index.ts']);
  let applyErr = null;
  try { game.applyLevel('mvmap-castlevania-map'); } catch (e) { applyErr = String(e); }
  await new Promise((r) => setTimeout(r, 200));
  const after = lvl.currentMap?.id;
  return { entry, urls, before, after, applyErr, maps: lvl.maps.map((m) => m.id) };
});

console.log(JSON.stringify(out, null, 2));
await browser.close();
