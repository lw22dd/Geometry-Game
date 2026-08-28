/** play-test.mjs —— 在真实游戏循环里实测移动逻辑：
 *  每张 MVMap 图进场 → 出生点落地 → 按住右键 → 检查能否在色块上行走/被墙挡住。
 *  直接回答「色块是否=移动区域」。 */
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
  const st = await page.evaluate(async ({ urls, mid }) => {
    const game = await import(urls['/src/systems/game/index.ts']);
    const gsMod = await import(urls['/src/systems/game/gameState.ts']);
    const lvl = await import(urls['/src/config/level.ts']);
    const playerMod = await import(urls['/src/systems/player/index.ts']);
    game.applyLevel(mid);
    gsMod.gs.screen = 'playing';
    const mp = lvl.currentMap;
    const pc = playerMod.playerController;
    const p = pc.getState();
    // 在出生点等物理稳定 800ms
    await new Promise((r) => setTimeout(r, 800));
    const s1 = { x: p.x, y: p.y, grounded: p.grounded, dead: p.dead, vx: p.velocity.x, vy: p.velocity.y };
    return {
      id: mp.id, spawn: mp.playerSpawn, settled: s1,
      floorCells: mp.floor?.cells.length ?? 0, solids: mp.solids.length,
    };
  }, { urls, mid });
  console.log('\n══ ' + st.id + ' 出生点 ' + JSON.stringify(st.spawn) + ' 落地后: ' + JSON.stringify(st.settled));

  // 按住右键 1.5s → 看是否在色块上行走
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1500);
  await page.keyboard.up('ArrowRight');
  const move = await page.evaluate(async ({ urls }) => {
    const playerMod = await import(urls['/src/systems/player/index.ts']);
    const p = playerMod.playerController.getState();
    return { x: p.x, y: p.y, grounded: p.grounded, dead: p.dead, vx: p.velocity.x, vy: p.velocity.y };
  }, { urls });
  console.log('按住→ 1.5s 后: ' + JSON.stringify(move) + '  位移 Δx=' + (move.x - st.settled.x).toFixed(2));

  // 传送到一个已知墙格中心（数据里第一个 1×1 墙体外的纯墙格），看是否被推出
  const wallTest = await page.evaluate(async ({ urls, mid }) => {
    const game = await import(urls['/src/systems/game/index.ts']);
    const gsMod = await import(urls['/src/systems/game/gameState.ts']);
    const lvl = await import(urls['/src/config/level.ts']);
    const playerMod = await import(urls['/src/systems/player/index.ts']);
    const mp = lvl.currentMap;
    const pc = playerMod.playerController;
    const p = pc.getState();
    // 找第一个墙体格的右上角附近位置（墙格中心）
    const s = mp.solids[0];
    const tx = s.x + s.w / 2, ty = s.y + s.h / 2;
    p.x = tx; p.y = ty; p.velocity.x = 0; p.velocity.y = 0; p.dead = false;
    await new Promise((r) => setTimeout(r, 700));
    return {
      target: { x: tx, y: ty }, settled: { x: p.x, y: p.y }, grounded: p.grounded,
      moved: Math.abs(p.x - tx) > 0.01 || Math.abs(p.y - ty) > 0.01,
    };
  }, { urls, mid });
  console.log('传送到墙格(' + wallTest.target.x.toFixed(1) + ',' + wallTest.target.y.toFixed(1) + ') → 稳定在('
    + wallTest.settled.x.toFixed(2) + ',' + wallTest.settled.y.toFixed(2) + ') grounded=' + wallTest.grounded + ' 被推出=' + wallTest.moved);
}

await browser.close();
console.log('\nDONE');