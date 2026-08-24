/**
 * 菜单场景 —— 开始菜单（标题 / 按钮 / 背景动画）。
 * 通过 UIManager 注册与切换；不依赖 game 循环。
 */
import { ctx, VW, VH } from '../../core/canvas';
import { rr } from '../../core/math';
import { Button, UI_SCENE } from '../../core/uiComponent';
import type { UIScene } from '../../core/uiComponent';
import { openGallery } from './gallery';
import { openInstructions } from './instructions';

/* ==================== 开始菜单 ==================== */

/** 菜单本地计时（入场动画用，独立于游戏时间） */
let _menuT = 0;
let _menuLast = 0;

/* ---------- 小工具 ---------- */
const _lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const _ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
function _seed(a: number): () => number {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** 四角星（描边） */
function _drawStar(cx: number, cy: number, r: number, rot: number, col: string, lw: number, alpha: number): void {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = col; ctx.lineWidth = lw;
  const k = r * .22;
  ctx.beginPath();
  ctx.moveTo(0, -r); ctx.lineTo(k, -k); ctx.lineTo(r, 0); ctx.lineTo(k, k);
  ctx.lineTo(0, r); ctx.lineTo(-k, k); ctx.lineTo(-r, 0); ctx.lineTo(-k, -k);
  ctx.closePath(); ctx.stroke();
  ctx.restore();
}

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

/** 正多边形线框路径 */
function _wireShape(n: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = i / n * 6.283 - 1.5708;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
}

/** 迷你光球图标（同游戏内光球样式） */
function _miniOrb(px: number, py: number, t: number, r: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(px, py, 0, px, py, r * 2.4);
  g.addColorStop(0, 'rgba(140,246,255,.5)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(px, py, r * 2.4, 0, 6.283); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#eaffff';
  ctx.shadowColor = '#8ff6ff'; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.arc(px, py, r * .55, 0, 6.283); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.translate(px, py); ctx.rotate(t * 1.8);
  ctx.strokeStyle = 'rgba(160,250,255,.9)'; ctx.lineWidth = 1.4;
  ctx.strokeRect(-r * .8, -r * .8, r * 1.6, r * 1.6);
  ctx.restore();
}

/* ---------- 菜单装饰数据（种子随机，稳定不闪） ---------- */
const _rng = _seed(97);
const _MENU_AURA = [
  { ax: 190, y: 140, r: 240, spd: .10, ph: 0,   c: '96,140,255' },
  { ax: 330, y: 430, r: 300, spd: .13, ph: 2.1, c: '168,110,255' },
  { ax: 250, y: 270, r: 190, spd: .17, ph: 4.2, c: '255,110,220' },
];
const _MENU_STARS: { x: number; y: number; r: number; spd: number; ph: number; a: number; c: string }[] = [];
for (let i = 0; i < 34; i++) {
  _MENU_STARS.push({
    x: _rng() * VW, y: _rng() * VH,
    r: .8 + _rng() * 1.8, spd: 6 + _rng() * 14,
    ph: _rng() * 6.28, a: .3 + _rng() * .7,
    c: _rng() < .6 ? '140,220,255' : '200,150,255',
  });
}
const _MENU_SHAPES: { x: number; y: number; r: number; n: number; rot: number; dx: number; dy: number; ph: number; a: number; c: string }[] = [];
for (let i = 0; i < 9; i++) {
  _MENU_SHAPES.push({
    x: 70 + _rng() * (VW - 140), y: 60 + _rng() * (VH - 120),
    r: 14 + _rng() * 30, n: [3, 4, 6][(_rng() * 3) | 0],
    rot: (_rng() - .5) * .8, dx: .08 + _rng() * .14, dy: .06 + _rng() * .1,
    ph: _rng() * 6.28, a: .06 + _rng() * .08,
    c: _rng() < .5 ? '150,190,255' : '190,140,255',
  });
}
const _MENU_METEORS = [
  { per: 6.5, x0: -60, x1: VW + 120, y0: 70, y1: 210 },
  { per: 9.5, x0: VW + 80, x1: -120, y0: 110, y1: 260 },
];

/* ---------- 背景氛围层 ---------- */
function _menuBackdrop(t: number): void {
  ctx.save();
  // 暗化 + 晕影
  ctx.fillStyle = 'rgba(5,3,16,.68)';
  ctx.fillRect(0, 0, VW, VH);
  const vg = ctx.createRadialGradient(VW / 2, VH / 2, VH * .3, VW / 2, VH / 2, VH * .95);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(2,0,10,.6)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, VW, VH);

  // 极光辉斑
  ctx.globalCompositeOperation = 'lighter';
  for (const a of _MENU_AURA) {
    const px = VW / 2 + Math.cos(t * a.spd + a.ph) * a.ax;
    const py = a.y + Math.sin(t * a.spd * 1.35 + a.ph) * 46;
    const g = ctx.createRadialGradient(px, py, 0, px, py, a.r);
    g.addColorStop(0, 'rgba(' + a.c + ',.09)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(px, py, a.r, 0, 6.283); ctx.fill();
  }
  // 上升微粒
  for (const s of _MENU_STARS) {
    let yy = (s.y - t * s.spd) % VH;
    if (yy < 0) yy += VH;
    const fl = .5 + .5 * Math.sin(t * 1.6 + s.ph);
    ctx.fillStyle = 'rgba(' + s.c + ',' + (s.a * (.25 + .6 * fl)) + ')';
    ctx.beginPath(); ctx.arc(s.x, yy, s.r, 0, 6.283); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  // 漂浮线框几何
  ctx.lineWidth = 1.2;
  for (const g of _MENU_SHAPES) {
    const px = g.x + Math.sin(t * g.dx + g.ph) * 34;
    const py = g.y + Math.cos(t * g.dy + g.ph) * 22;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(t * g.rot + g.ph);
    ctx.strokeStyle = 'rgba(' + g.c + ',' + g.a + ')';
    _wireShape(g.n, g.r);
    ctx.stroke();
    ctx.restore();
  }

  // 流星（周期性划过）
  for (const m of _MENU_METEORS) {
    const p = (t % m.per) / m.per;
    if (p >= .08) continue;
    const q = p / .08;
    const x = _lerp(m.x0, m.x1, q), y = _lerp(m.y0, m.y1, q);
    const dx = Math.sign(m.x1 - m.x0);
    ctx.save();
    ctx.strokeStyle = 'rgba(210,235,255,' + (.65 * (1 - q)) + ')';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(160,220,255,.8)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - dx * 66, y - 15);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/* ---------- 四角 HUD 取景框 ---------- */
function _menuFrame(a: number): void {
  if (a <= 0) return;
  const m = 26, L = 36;
  ctx.save();
  ctx.strokeStyle = 'rgba(140,170,255,' + (.42 * a) + ')';
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(120,150,255,.55)';
  ctx.shadowBlur = 8;
  const cs = [[m, m, 1, 1], [VW - m, m, -1, 1], [m, VH - m, 1, -1], [VW - m, VH - m, -1, -1]];
  ctx.beginPath();
  for (const c of cs) {
    ctx.moveTo(c[0] + L * c[2], c[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.lineTo(c[0], c[1] + L * c[3]);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(140,246,255,' + (.6 * a) + ')';
  for (const c of cs) {
    ctx.beginPath(); ctx.arc(c[0] + 6 * c[2], c[1] + 6 * c[3], 2, 0, 6.283); ctx.fill();
  }
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
  _drawStar(0, 0, 175, 0, '#9f8bff', 2, 1);
  ctx.rotate(Math.PI / 4);
  _drawStar(0, 0, 120, 0, '#7de8ff', 1.5, 1);
  ctx.restore();

  // 主标题：色差双层 + 渐变主体 + 紫晕
  ctx.font = '900 italic 76px Arial';
  const wob = Math.sin(t * 1.1) * 1.6;
  ctx.fillStyle = 'rgba(0,229,255,.5)';
  ctx.fillText('NEON ASCENT', VW / 2 - 3 - wob, cy + dy);
  ctx.fillStyle = 'rgba(255,90,220,.5)';
  ctx.fillText('NEON ASCENT', VW / 2 + 3 + wob, cy + dy);
  ctx.shadowColor = 'rgba(125,107,255,.9)';
  ctx.shadowBlur = 30;
  const tg = ctx.createLinearGradient(0, cy + dy - 62, 0, cy + dy + 14);
  tg.addColorStop(0, '#ffffff');
  tg.addColorStop(.55, '#dff2ff');
  tg.addColorStop(1, '#9fc6ff');
  ctx.fillStyle = tg;
  ctx.fillText('NEON ASCENT', VW / 2, cy + dy);

  // 流光扫过（只作用于字形）
  const cyc = 3.2, q = (t % cyc) / cyc;
  if (q < .45) {
    const u = q / .45;
    const sx = VW / 2 - 420 + u * 840;
    const sg = ctx.createLinearGradient(sx - 70, 0, sx + 70, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(.5, 'rgba(255,255,255,.9)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur = 0;
    ctx.fillStyle = sg;
    ctx.fillText('NEON ASCENT', VW / 2, cy + dy);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.shadowBlur = 0;

  // 副标题 + 两侧菱形星
  const subY = cy + 38 + dy;
  ctx.font = '600 17px "Segoe UI","Microsoft YaHei",Arial';
  ctx.fillStyle = '#b9c8ff';
  ctx.fillText('霓 虹 攀 升  ·  FEEL-TUNED EDITION', VW / 2, subY);
  for (const s of [-1, 1]) {
    _drawStar(VW / 2 + s * 185, subY - 6, 5, t * .8 * s, 'rgba(140,246,255,.8)', 1, 1);
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

  _miniOrb(x + orbR, y + Math.sin(t * 2.6) * 2.5, t, orbR);
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
  ctx.fillText('— 按任意键开始 · 点击进入 —', VW / 2, by + 64 + 74);
  ctx.restore();
}

/** 菜单背景绘制（场景 draw，不含按钮——按钮是独立组件） */
function drawMenuScene(_t: number): void {
  const nowMs = performance.now();
  if (_menuLast) _menuT += Math.min(.05, (nowMs - _menuLast) / 1000);
  _menuLast = nowMs;
  const t = _menuT;

  _menuBackdrop(t);
  _menuFrame(_ease(t / .5));
  _menuTitle(t, _ease(t / .7));
  _menuGoal(t, _ease((t - .45) / .6));
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

  return {
    name: UI_SCENE.MENU,
    widgets: [menuBtn, galleryBtn, instrBtn],
    draw: drawMenuScene,
    onExit: () => {
      // 复位 hover 与光标（修复原 menuClosed 未被调用的问题）
      menuBtn.hover = false;
      galleryBtn.hover = false;
      instrBtn.hover = false;
      const c = ctx.canvas;
      if (c) c.style.cursor = 'default';
    },
  };
}