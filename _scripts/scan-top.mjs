/** scan-top.mjs —— 验证「地图小于视口时相机钳制病态」：
 *  updateCamera 的 clamp(cam, vh/2, mapH-vh/2) 在 mapH < 视口高 时 a>b，
 *  clamp 退化成：v<7.5→7.5，v≥7.5→-1.5 → 相机逐帧在两端交替 = 顶部重影。
 *  用法：node scan-top.mjs [mapId] */
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

const mid = process.argv[2] || 'mvmap-platform-tree';
const r = await page.evaluate(async ({ urls, mid }) => {
  const game = await import(urls['/src/systems/game/index.ts']);
  const gsMod = await import(urls['/src/systems/game/gameState.ts']);
  const lvl = await import(urls['/src/config/level.ts']);
  const cam = await import(urls['/src/core/camera.ts']);
  const player = await import(urls['/src/systems/player/index.ts']);

  const ids = lvl.maps.map(m => m.id);
  game.applyLevel(mid);
  gsMod.gs.screen = 'playing';
  const mp = lvl.currentMap;
  const P = player.playerController.getState();
  P.x = 8.5; P.y = 4.0; P.velocity.x = 0; P.velocity.y = 0; P.sprint = false; P.dead = false;

  // ── A) 垂直：玩家在顶部 y∈[4,5.8]，速度向上/向下，连续 updateCamera 30 与 31 帧 ──
  const rowsA = [];
  for (let y = 4.0; y <= 5.8; y += 0.2) {
    for (const vy of [0, 6, -6]) {
      P.x = 8.5; P.y = y; P.velocity.y = vy;
      cam.cam.x = 9; cam.cam.y = 3;
      const ty = P.y + 2.3 + Math.max(-3.5, Math.min(3.5, P.velocity.y * 0.14));
      let a30 = null, a31 = null;
      for (let i = 1; i <= 31; i++) {
        cam.updateCamera(1 / 60, P, gsMod.gs, mp.width, mp.height);
        if (i === 30) a30 = { cy: cam.cam.y, SB: cam.view.SB };
        if (i === 31) a31 = { cy: cam.cam.y, SB: cam.view.SB };
      }
      rowsA.push({ y: y.toFixed(1), vy, ty: ty.toFixed(2),
        c30: a30.cy.toFixed(2), s30: a30.SB.toFixed(2),
        c31: a31.cy.toFixed(2), s31: a31.SB.toFixed(2) });
    }
  }

  // ── B) 水平：玩家靠右 x∈[12,17.5]，验证 cam.x 在 13.33/4.67 交替 ──
  const rowsB = [];
  for (const x of [12.5, 13.5, 15, 17]) {
    P.x = x; P.y = 1.5; P.velocity.y = 0;
    cam.cam.x = 9; cam.cam.y = 7.5;
    let a30 = null, a31 = null;
    for (let i = 1; i <= 31; i++) {
      cam.updateCamera(1 / 60, P, gsMod.gs, mp.width, mp.height);
      if (i === 30) a30 = { cx: cam.cam.x, SL: cam.view.SL };
      if (i === 31) a31 = { cx: cam.cam.x, SL: cam.view.SL };
    }
    rowsB.push({ x, tx: x.toFixed(1),
      c30: a30.cx.toFixed(2), s30: a30.SL.toFixed(2),
      c31: a31.cx.toFixed(2), s31: a31.SL.toFixed(2) });
  }

  // ── C) 真实渲染（页面上主循环持续在跑）：固定屏幕点 (432,456)（SB=0 时恰好是天花板色块中心）
  //     玩家在顶部带上下跳，采样该点 → 若相机逐帧翻转，同一屏幕点会交替显示色块/背景 ──
  const g = document.getElementById('c').getContext('2d');
  const sample = (px, py) => {
    const d = g.getImageData(px, py, 1, 1).data;
    return [d[0], d[1], d[2]];
  };
  const settle = (ms) => new Promise((res) => setTimeout(res, ms));
  const P2 = player.playerController.getState();
  P2.x = 8.5; P2.y = 4.8; P2.velocity.x = 0;
  const visuals = [];
  // 状态 A：持续向上速度 → ty≥7.5 → 相机应在 SB=0/-9 两端逐帧翻转
  P2.velocity.y = 8;
  cam.cam.y = 3;
  await settle(200);
  const a1 = sample(432, 456), sb1 = cam.view.SB.toFixed(2);
  await settle(80);
  const a2 = sample(432, 456), sb2 = cam.view.SB.toFixed(2);
  const same = a1[0] === a2[0] && a1[1] === a2[1] && a1[2] === a2[2];
  visuals.push({ label: 'A vy=+8 连续两采样(间隔80ms)', rgb1: a1, sb1, rgb2: a2, sb2, note: same ? '相同(稳定)' : '★★ 同一屏幕点内容翻转 = 重影' });
  // 状态 B：向下速度 → ty<7.5 → SB≈0（地图上部在正常位置）
  P2.velocity.y = -8;
  await settle(200);
  const b1 = sample(432, 456), sb3 = cam.view.SB.toFixed(2);
  visuals.push({ label: 'B vy=-8 (下落)', rgb1: b1, sb1: sb3 });

  return { ids, dims: { w: mp.width, h: mp.height }, rowsA, rowsB, visuals };
}, { urls, mid });

console.log(`\n═══ ${mid} (${r.dims.w}×${r.dims.h}) | 视口 26.67×15 | 地图是否小于视口: ${r.dims.w < 26.67 ? '是' : '否'}×${r.dims.h < 15 ? '是' : '否'} ═══`);
console.log(`游戏内地图 id 列表: ${r.ids.join(', ')}`);

console.log('\n[A] 垂直交替 —— 玩家在顶部带 (y=4.0..5.8)，连跑 30/31 帧后 cam.y 与 view.SB（SB 应在 0 或 -9 两端逐帧翻转）:');
console.log(' y    vy   ty目标  |  30帧:cy    SB   |  31帧:cy    SB   |  交替?');
for (const q of r.rowsA) {
  const flip = Math.abs(q.s30 - q.s31) > 0.5 ? '★ 是(重影)' : ' 否';
  console.log(` ${q.y}  ${String(q.vy).padStart(3)}  ${q.ty}   |  ${q.c30.padStart(5)}  ${q.s30.padStart(5)}  |  ${q.c31.padStart(5)}  ${q.s31.padStart(5)}  | ${flip}`);
}

console.log('\n[B] 水平交替 —— 玩家靠右 x=12.5..17（跨过 tx=13.33），cam.x 在 13.33/4.67 两端:');
console.log(' x     tx目标 |  30帧:cx    SL   |  31帧:cx    SL   |  交替?');
for (const q of r.rowsB) {
  const flip = Math.abs(q.s30 - q.s31) > 0.5 ? '★ 是(重影)' : ' 否';
  console.log(` ${q.x}  ${q.tx.padStart(5)}   |  ${q.c30.padStart(6)}  ${q.s30.padStart(6)}  |  ${q.c31.padStart(6)}  ${q.s31.padStart(6)}  | ${flip}`);
}

console.log('\n[C] 真实渲染，固定屏幕点 (432,456)（SB=0 时=天花板色块中心）:');
for (const v of r.visuals) {
  const rgb = v.rgb1 || v.rgb2;
  console.log(`  ${v.label}: RGB1=(${v.rgb1[0]},${v.rgb1[1]},${v.rgb1[2]}) SB=${v.sb1}` + (v.rgb2 ? ` | RGB2=(${v.rgb2[0]},${v.rgb2[1]},${v.rgb2[2]}) SB=${v.sb2} | ${v.note}` : ''));
}
console.log('  (若 RGB1/RGB2 差异巨大，说明同一屏幕点在逐帧交替显示色块/背景 = 重影)');

await browser.close();
console.log('\nDONE');
