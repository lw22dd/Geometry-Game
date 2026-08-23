/**
 * 调度中枢 —— 编排各系统，管理主循环。
 * 导出 step(dt)、render(dt)、frame() 供 main.ts 启动。
 */
import { ctx, VW, VH, DPR, PPM } from '../../core/canvas';
import { updateCamera, view } from '../../core/camera';
import { musicTick, MUS, sfx, AU } from '../../core/audio';
import { movers, PHYS } from '../../config';
import { gs, getMode, setMode } from './state';
import { P, stepPlayer, respawn } from '../player';
import { stepParticles } from '../world/particles';
import {
  drawParallax, drawGrid, drawBorder, drawDecos, drawSolids, drawMovers,
  drawCheckpoints, drawSpikes, drawLasers, drawOrbs, drawNOVA,
  drawTrail, drawParticles, drawHints,
} from '../world/defs';
import { drawPlayer } from '../player/defs';
import { drawHUD, drawMinimap, drawMenu, checkMenuClick } from '../ui';

/* ==================== 开始游戏 ==================== */

/** 从菜单进入游戏 */
export function startGame(): void {
  gs.screen = 'playing';
  gs.started = true;
}

/* ==================== 主循环 ==================== */

let last = performance.now();
let acc = 0;
const FDT = 1 / 120;

/** 逐帧步进（固定时间步长 1/120s） */
export function step(dt: number): void {
  // 1. 时间
  gs.time += dt;

  // 2. 移动平台
  for (const m of movers) {
    const nx = m.x0 + (Math.sin(gs.time * m.spd + m.ph) * 0.5 + 0.5) * m.range;
    m.dx = nx - m.x;
    m.x = nx;
  }

  // 3. 粒子 + 曳光
  stepParticles(dt);

  // 4. Toast 衰减
  if (gs.toastT > 0) gs.toastT -= dt;

  // 5. 菜单中不执行游戏逻辑
  if (gs.screen !== 'playing') return;

  // 6. 游戏计时
  gs.gt += dt;

  // 7. 死亡计时
  if (P.dead) {
    P.deadT -= dt;
    if (P.deadT <= 0) respawn();
    return;
  }

  // 8. 玩家物理
  stepPlayer(dt);
}

/** 逐帧渲染 */
export function render(dt: number): void {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  // 背景渐变（菜单与游戏共用）
  let gr = ctx.createLinearGradient(0, 0, 0, VH);
  gr.addColorStop(0, '#080517');
  gr.addColorStop(0.5, '#120a30');
  gr.addColorStop(1, '#1d0f45');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, VW, VH);

  // 菜单画面
  if (gs.screen === 'menu') {
    drawMenu();
    return;
  }

  // === 游戏画面 ===
  updateCamera(dt, P, gs);

  const vw = VW / (PPM * view.zoom);
  const vh = VH / (PPM * view.zoom);

  const pulse = Math.exp(-((gs.time * 128 / 60) % 1) * 4.5);

  ctx.globalCompositeOperation = 'lighter';
  let bg = ctx.createRadialGradient(VW / 2, VH * 1.05, 50, VW / 2, VH * 1.05, VH * 0.95);
  bg.addColorStop(0, 'rgba(120,70,255,' + (0.16 + 0.14 * pulse) + ')');
  bg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, VW, VH);
  ctx.globalCompositeOperation = 'source-over';

  drawParallax();
  drawGrid(pulse);
  drawBorder();
  drawDecos();
  drawSolids();
  drawMovers();
  drawCheckpoints(pulse);
  drawSpikes();
  drawLasers();
  drawOrbs();
  drawNOVA(pulse);
  drawTrail();
  drawParticles();
  drawPlayer();
  drawHints();

  let vg = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.38, VW / 2, VH / 2, VH * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(3,0,14,.5)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, VW, VH);

  if (gs.flash > 0) {
    ctx.fillStyle = 'rgba(255,80,160,' + (gs.flash * 0.28) + ')';
    ctx.fillRect(0, 0, VW, VH);
  }

  if (P.dead) {
    ctx.fillStyle = 'rgba(15,2,25,' + (0.4 * (1 - P.deadT / 0.85)) + ')';
    ctx.fillRect(0, 0, VW, VH);
  }

  drawHUD();
  drawMinimap(vw, vh);
}

/** 帧回调（requestAnimationFrame） */
export function frame(nowMs: number): void {
  requestAnimationFrame(frame);
  let dt = (nowMs - last) / 1000;
  last = nowMs;
  if (dt > 0.06) dt = 0.06;
  acc += dt;
  if (acc > 0.2) acc = 0.2;
  let n = 0;
  while (acc >= FDT && n < 10) { step(FDT); acc -= FDT; n++; }
  musicTick();
  render(dt);
}

/** 启动主循环 */
export function startLoop(): void {
  requestAnimationFrame(frame);
}

/* ==================== 输入回调 ==================== */

/** 按键逻辑（由 core/input 的 keydown 回调调用） */
export function handleKeyDown(e: KeyboardEvent): void {
  // 菜单中：Enter / Space 开始游戏
  if (gs.screen === 'menu') {
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') {
      startGame();
    }
    return;
  }

  // 游戏中操作
  if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
    P.jbuf = PHYS[getMode()].jb;
  }

  if (e.code === 'KeyR') respawn();

  if (e.code === 'KeyP') {
    const cur = getMode();
    const next = cur === 'tuned' ? 'classic' : 'tuned';
    const old = PHYS[cur], nw = PHYS[next];
    P.vy *= nw.JV / old.JV;
    setMode(next);
    gs.toast = '物理 · ' + nw.name;
    gs.toastT = 2;
  }

  if (e.code === 'KeyM') {
    AU.on = !AU.on;
    gs.toast = AU.on ? '♪ 音效：开' : '♪ 音效：关';
    gs.toastT = 2;
    if (AU.on && AU.ctx) MUS.next = AU.ctx.currentTime + 0.05;
  }
}