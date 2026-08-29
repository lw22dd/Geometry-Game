/**
 * 菜单场景 —— 开始菜单（标题 / 按钮 / 背景动画）。
 * 通过 UIManager 注册与切换；不依赖 game 循环。
 */
import { ctx, VW, VH } from '../../core/canvas';
import { Button, UI_SCENE } from '../../core/uiComponent';
import type { UIScene } from '../../core/uiComponent';
import { drawBackdrop, drawHUDFrame, drawNeonTitle, drawDecoStar, ease } from '../uiAtmosphere';
import { resetHover } from './primitives';
import { drawOrbIcon } from './icons';
import { openGallery } from './gallery';
import { openInstructions } from './instructions';
import { openSettings } from './settings';

/* ==================== 开始菜单 ==================== */

/** 菜单本地计时（入场动画用，独立于游戏时间） */
let _menuT = 0;
let _menuLast = 0;

/** 实心 NOVA 星 */
function _fillStar(cx: number, cy: number, r: number, rot: number, fill: string, glow: string): void {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.shadowColor = glow; ctx.shadowBlur = 14;
  ctx.fillStyle = fill;
  const k = r * .3;
  ctx.beginPath();
  ctx.moveTo(0, -r); ctx.lineTo(k, -k); ctx.lineTo(r, 0); ctx.lineTo(k, k);
  ctx.lineTo(0, r); ctx.lineTo(-k, k); ctx.lineTo(-r, 0); ctx.lineTo(-k, -k);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

/* ---------- 标题区 ---------- */
function _menuTitle(t: number, en: number): void {
  if (en <= 0) return;
  const cy = VH / 2 - 156;
  const dy = (1 - en) * 24;
  ctx.save();
  ctx.globalAlpha = en;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // 顶部小标签 + 引导线
  const tagY = cy - 66 + dy;
  ctx.font = '600 13px "Segoe UI",Arial';
  ctx.fillStyle = 'rgba(150,180,255,.75)';
  ctx.fillText('◆  G E O M E T R Y   N E O N   R U N N E R  ◆', VW / 2, tagY + dy * 0);
  for (const s of [-1, 1]) {
    const g = ctx.createLinearGradient(VW / 2 + s * 185, 0, VW / 2 + s * 355, 0);
    g.addColorStop(0, 'rgba(140,170,255,.5)');
    g.addColorStop(1, 'rgba(140,170,255,0)');
    ctx.strokeStyle = g; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(VW / 2 + s * 185, tagY - 4);
    ctx.lineTo(VW / 2 + s * 355, tagY - 4);
    ctx.stroke();
  }

  // 背景巨星（缓转线框）
  ctx.save();
  ctx.translate(VW / 2, cy - 24 + dy);
  ctx.rotate(t * .15);
  ctx.globalAlpha = en * .10;
  drawDecoStar(0, 0, 175, 0, '#9f8bff', 2, 1);
  ctx.rotate(Math.PI / 4);
  drawDecoStar(0, 0, 120, 0, '#7de8ff', 1.5, 1);
  ctx.restore();

  // 主标题：色差双层 + 渐变主体 + 紫晕 + 流光（内部自带 dy 入场位移）
  drawNeonTitle(VW / 2, cy, 'NEON ASCENT', 76, t, en);

  // 副标题 + 两侧菱形星
  const subY = cy + 38 + dy;
  ctx.font = '600 17px "Segoe UI","Microsoft YaHei",Arial';
  ctx.fillStyle = '#b9c8ff';
  ctx.fillText('霓 虹 攀 升  ·  FEEL-TUNED EDITION', VW / 2, subY);
  for (const s of [-1, 1]) {
    drawDecoStar(VW / 2 + s * 185, subY - 6, 5, t * .8 * s, 'rgba(140,246,255,.8)', 1, 1);
  }
  ctx.restore();
}

/* ---------- 目标行（光球 + NOVA 实物图标） ---------- */
function _menuGoal(t: number, en: number): void {
  if (en <= 0) return;
  const y = VH / 2 + 150 + (1 - en) * 14;
  ctx.save();
  ctx.globalAlpha = en;
  ctx.textBaseline = 'middle';

  ctx.font = '700 19px "Segoe UI","Microsoft YaHei",Arial';
  const a = '收 集 42 枚 光 球';
  const b = '登 顶 寻 找 NOVA 星';
  const sep = '    ·    ';
  const wa = ctx.measureText(a).width;
  const wb = ctx.measureText(b).width;
  ctx.font = '600 19px Arial';
  const ws = ctx.measureText(sep).width;

  const orbR = 9, starR = 9, gap = 13;
  const total = orbR * 2 + gap + wa + ws + wb + gap + starR * 2;
  let x = VW / 2 - total / 2;

  drawOrbIcon(x + orbR, y + Math.sin(t * 2.6) * 2.5, t, orbR);
  x += orbR * 2 + gap;

  ctx.textAlign = 'left';
  ctx.font = '700 19px "Segoe UI","Microsoft YaHei",Arial';
  ctx.fillStyle = '#ffb0e8';
  ctx.fillText(a, x, y);
  x += wa;

  ctx.font = '600 19px Arial';
  ctx.fillStyle = 'rgba(150,170,255,.65)';
  ctx.fillText(sep, x, y);
  x += ws;

  ctx.font = '700 19px "Segoe UI","Microsoft YaHei",Arial';
  ctx.fillStyle = '#ffd9a0';
  ctx.fillText(b, x, y);
  x += wb;

  _fillStar(x + gap + starR, y + Math.sin(t * 2.2 + 1.3) * 2.5, starR, t * .8, '#ffd76b', 'rgba(255,215,107,.9)');
  ctx.restore();
}

/* ---------- 页脚 ---------- */
function _menuFooter(t: number): void {
  ctx.save();
  ctx.font = '600 11px "Segoe UI",Arial';
  ctx.fillStyle = 'rgba(160,180,255,.4)';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('FEEL-TUNED EDITION · 手感优化版', 40, VH - 34);
  ctx.textAlign = 'right';
  ctx.fillText('MAP 240 × 72  ·  ORBS ×42  ·  NOVA ★', VW - 40, VH - 34);
  ctx.restore();
}

/* ---------- 按钮下方呼吸提示 ---------- */
function _menuHint(t: number): void {
  const by = VH / 2 + 178;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '500 14px "Segoe UI","Microsoft YaHei",Arial';
  ctx.fillStyle = 'rgba(140,246,255,' + (.5 + .35 * Math.sin(t * 3.2)) + ')';
  ctx.restore();
}

/** 菜单背景绘制（场景 draw，不含按钮——按钮是独立组件） */
function drawMenuScene(_t: number): void {
  const nowMs = performance.now();
  if (_menuLast) _menuT += Math.min(.05, (nowMs - _menuLast) / 1000);
  _menuLast = nowMs;
  const t = _menuT;

  drawBackdrop(t);
  drawHUDFrame(ease(t / .5));
  _menuTitle(t, ease(t / .7));
  _menuGoal(t, ease((t - .45) / .6));
  _menuHint(t);
  _menuFooter(t);
}

/* ==================== UI 场景构建 ==================== */

/**
 * 构建菜单场景（由组合根 scenes.ts 注入 onStart 回调，避免 ui↔game 循环依赖）。
 */
export function buildMenuScene(onStart: () => void): UIScene {
  const menuBtn = new Button({
    id: 'menu_start',
    label: '开 始 游 戏',
    subLabel: 'ENTER ⏎',
    variant: 'primary',
    x: VW / 2 - 135, y: VH / 2 + 178, w: 270, h: 64,
    enterDelay: 0.6,
    onClick: onStart,
  });

  // 预制体图鉴按钮（位于开始游戏下方）
  const galleryBtn = new Button({
    id: 'menu_gallery',
    label: '预制体图鉴',
    variant: 'plain',
    x: VW / 2 - 215, y: VH / 2 + 250, w: 200, h: 36,
    enterDelay: 0.8,
    onClick: openGallery,
  });

  // 操作说明按钮（与图鉴并排）
  const instrBtn = new Button({
    id: 'menu_instr',
    label: '操作说明',
    variant: 'plain',
    x: VW / 2 + 15, y: VH / 2 + 250, w: 200, h: 36,
    enterDelay: 0.8,
    onClick: openInstructions,
  });

  // 设置按钮（音量 / 画质；图鉴与说明下方一行）
  const settingsBtn = new Button({
    id: 'menu_settings',
    label: '设 置',
    variant: 'plain',
    x: VW / 2 - 100, y: VH / 2 + 296, w: 200, h: 36,
    enterDelay: 0.9,
    onClick: openSettings,
  });

  return {
    name: UI_SCENE.MENU,
    widgets: [menuBtn, galleryBtn, instrBtn, settingsBtn],
    draw: drawMenuScene,
    onExit: () => resetHover(menuBtn, galleryBtn, instrBtn, settingsBtn),
  };
}