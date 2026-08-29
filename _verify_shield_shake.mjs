/** 临时验证：护盾格挡 → 震屏。走真实回调链：真实护盾拾取 → collisionBus hazard 事件 → onShieldBlock → gs.shake。验证后删除。 */
import { chromium } from 'playwright';

const URL = 'http://localhost:5184';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));

await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
await page.keyboard.press('Enter');
await page.waitForTimeout(1600);

const r = await page.evaluate(async () => {
  const { playerController } = await import('/src/systems/player/index.ts');
  const { collisionBus } = await import('/src/core/collisionBus.ts');
  const { ITEMS } = await import('/src/systems/items/backpack.ts');
  const { gs } = await import('/src/systems/game/gameState.ts');
  const { VIS } = await import('/src/config/visuals.ts');

  const out = {};
  const p = playerController.getState();

  // 1) 真实拾取路径：护盾 onPickup 挂载能力（与 PickupSystem 同源）
  p.backpack.push('shield');
  ITEMS['shield'].onPickup?.(p);
  playerController.flush();
  out.shieldBefore = p.shields;

  // 2) 投递真实碰撞事件（碰撞系统同款载荷 { b }，b 用不存在实体绕过激光 Timer 检查）
  collisionBus.emit('enter:player:hazard', { a: 1, b: 91234 });

  out.shieldAfter = p.shields;
  out.inv = p.inv;
  out.dead = p.dead;
  out.shake = gs.shake;
  out.expected = VIS.screen.shieldShake;
  out.hitstop = gs.hitstop;
  out.shakeAmp = VIS.screen.shakeAmp;

  // 3) 震屏渲染联通性：强位移（shake=1 → 16px）vs 静止帧，全屏网格采样对比。
  //    0.42 级位移仅 ~2.8px，在无高频细节背景上不可分辨，故用最大强度验证管线。
  const cv = document.getElementById('c');
  const c = cv.getContext('2d');
  const dpr = cv.width / 1280;
  const sample = () => {
    const out = [];
    for (let gx = 40; gx < 1240; gx += 120) {
      for (let gy = 100; gy < 700; gy += 100) {
        const d = c.getImageData(gx * dpr, gy * dpr, Math.max(1, Math.round(6 * dpr)), 1).data;
        let mx = 0;
        for (let i = 0; i < d.length; i += 4) {
          const v = (d[i] + d[i + 1] + d[i + 2]) / 3;
          if (v > mx) mx = v;
        }
        out.push(Math.round(mx));
      }
    }
    return out;
  };
  gs.shake = 1;
  await new Promise((res) => setTimeout(res, 90)); // 游戏渲染多帧带摇动
  const shakeA = sample();
  gs.shake = 0;
  await new Promise((res) => setTimeout(res, 150)); // 衰减至静止并稳定
  const calmB = sample();
  let changed = 0;
  for (let i = 0; i < shakeA.length; i++) {
    if (Math.abs(shakeA[i] - calmB[i]) > 25) changed++;
  }
  out.renderDiffPixels = changed;
  out.renderTotal = shakeA.length;
  return out;
});

console.log('护盾格挡前 shields:', r.shieldBefore);
console.log('格挡后 shields:', r.shieldAfter, '| inv:', r.inv, '| dead:', r.dead);
console.log('gs.shake:', r.shake, '（期望 = VIS.screen.shieldShake =', r.expected, '）');
console.log('震屏生效:', r.shake === r.expected && r.shake > 0 ? 'OK' : 'FAIL');
console.log('命中停顿 hitstop:', r.hitstop, '>0:', r.hitstop > 0 ? 'OK' : 'FAIL');
console.log('护盾被消耗/存活/获得无敌:', !r.dead && r.shieldAfter === 0 && r.inv > 0 ? 'OK' : 'FAIL');
console.log('震屏驱动渲染（变化样点/总样点）:', r.renderDiffPixels + '/' + r.renderTotal, r.renderDiffPixels > r.renderTotal * 0.15 ? 'OK' : 'FAIL');
console.log('控制台错误数:', errors.length);
for (const e of errors.slice(0, 6)) console.log('   ', e);
await browser.close();