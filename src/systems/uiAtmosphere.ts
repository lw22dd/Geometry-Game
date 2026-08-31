/**
 * UI 氛围层 —— 与 menu.ts 同款：种子随机星空 / 极光辉斑 / 漂浮线框几何 / 流星。
 * 提供给 instructions / prepare 等弹窗复用，保证全 UI 视觉一致。
 */
import { ctx, VW, VH, DPR } from '../core/canvas';
import { rr, lerp } from '../core/math';
import { ease } from './ui/primitives';

export { ease };
export { lerp };

export function seed(a: number): () => number {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------- 四角星（描边） ---------- */
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

function _wireShape(n: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = i / n * 6.283 - 1.5708;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
}

/* ---------- 主题色板（不同弹窗可换调子） ---------- */
export type AtmoTheme = {
  aura: [number, number, number, string][];   // [ax, y, r, "r,g,b"]
  starC: [string, string];
  shapeC: [string, string];
  meteor: boolean;
  seed: number;
};

const _DEFAULT: AtmoTheme = {
  aura: [[190, 140, 240, '96,140,255'], [330, 430, 300, '168,110,255'], [250, 270, 190, '255,110,220']],
  starC: ['140,220,255', '200,150,255'],
  shapeC: ['150,190,255', '190,140,255'],
  meteor: true,
  seed: 97,
};

/* ---------- 构建一组稳定的装饰数据 ---------- */
interface _AtmoData {
  aura: { ax: number; y: number; r: number; spd: number; ph: number; c: string }[];
  stars: { x: number; y: number; r: number; spd: number; ph: number; a: number; c: string }[];
  shapes: { x: number; y: number; r: number; n: number; rot: number; dx: number; dy: number; ph: number; a: number; c: string }[];
  meteors: { per: number; x0: number; x1: number; y0: number; y1: number }[];
}

const _cache = new Map<number, _AtmoData>();
export function buildAtmo(theme: AtmoTheme = _DEFAULT): _AtmoData {
  if (_cache.has(theme.seed)) return _cache.get(theme.seed)!;
  const rng = seed(theme.seed);
  const stars: _AtmoData['stars'] = [];
  for (let i = 0; i < 34; i++) stars.push({
    x: rng() * VW, y: rng() * VH, r: .8 + rng() * 1.8,
    spd: 6 + rng() * 14, ph: rng() * 6.28, a: .3 + rng() * .7,
    c: rng() < .6 ? theme.starC[0] : theme.starC[1],
  });
  const shapes: _AtmoData['shapes'] = [];
  for (let i = 0; i < 9; i++) shapes.push({
    x: 70 + rng() * (VW - 140), y: 60 + rng() * (VH - 120),
    r: 14 + rng() * 30, n: [3, 4, 6][(rng() * 3) | 0],
    rot: (rng() - .5) * .8, dx: .08 + rng() * .14, dy: .06 + rng() * .1,
    ph: rng() * 6.28, a: .06 + rng() * .08,
    c: rng() < .5 ? theme.shapeC[0] : theme.shapeC[1],
  });
  const data: _AtmoData = {
    aura: theme.aura.map(v => ({ ax: v[0], y: v[1], r: v[2], spd: .10 + Math.random() * .07, ph: Math.random() * 6.28, c: v[3] })),
    stars, shapes,
    meteors: theme.meteor
      ? [{ per: 6.5, x0: -60, x1: VW + 120, y0: 70, y1: 210 }, { per: 9.5, x0: VW + 80, x1: -120, y0: 110, y1: 260 }]
      : [],
  };
  _cache.set(theme.seed, data);
  return data;
}

/* ---------- 氛围背景（与 menu 同款） ---------- */

// 问题 9：全屏晕影渐变按 (VW, VH, DPR) 缓存，仅 resize 时重建（避免每帧 createRadialGradient 分配）
let _vignette: CanvasGradient | null = null;
let _vignetteKey = '';
function vignetteGradient(): CanvasGradient {
  const key = VW + 'x' + VH + '@' + DPR;
  if (_vignette === null || _vignetteKey !== key) {
    _vignetteKey = key;
    _vignette = ctx.createRadialGradient(VW / 2, VH / 2, VH * .3, VW / 2, VH / 2, VH * .95);
    _vignette.addColorStop(0, 'rgba(0,0,0,0)');
    _vignette.addColorStop(1, 'rgba(2,0,10,.6)');
  }
  return _vignette;
}

export function drawBackdrop(t: number, theme: AtmoTheme = _DEFAULT): void {
  const d = buildAtmo(theme);
  ctx.save();
  ctx.fillStyle = 'rgba(5,3,16,.68)';
  ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = vignetteGradient(); ctx.fillRect(0, 0, VW, VH);

  ctx.globalCompositeOperation = 'lighter';
  for (const a of d.aura) {
    const px = VW / 2 + Math.cos(t * a.spd + a.ph) * a.ax;
    const py = a.y + Math.sin(t * a.spd * 1.35 + a.ph) * 46;
    const g = ctx.createRadialGradient(px, py, 0, px, py, a.r);
    g.addColorStop(0, 'rgba(' + a.c + ',.09)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, a.r, 0, 6.283); ctx.fill();
  }
  for (const s of d.stars) {
    let yy = (s.y - t * s.spd) % VH; if (yy < 0) yy += VH;
    const fl = .5 + .5 * Math.sin(t * 1.6 + s.ph);
    ctx.fillStyle = 'rgba(' + s.c + ',' + (s.a * (.25 + .6 * fl)) + ')';
    ctx.beginPath(); ctx.arc(s.x, yy, s.r, 0, 6.283); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  ctx.lineWidth = 1.2;
  for (const g of d.shapes) {
    const px = g.x + Math.sin(t * g.dx + g.ph) * 34;
    const py = g.y + Math.cos(t * g.dy + g.ph) * 22;
    ctx.save();
    ctx.translate(px, py); ctx.rotate(t * g.rot + g.ph);
    ctx.strokeStyle = 'rgba(' + g.c + ',' + g.a + ')';
    _wireShape(g.n, g.r); ctx.stroke();
    ctx.restore();
  }
  for (const m of d.meteors) {
    const p = (t % m.per) / m.per;
    if (p >= .08) continue;
    const q = p / .08;
    const x = lerp(m.x0, m.x1, q), y = lerp(m.y0, m.y1, q);
    const dx = Math.sign(m.x1 - m.x0);
    ctx.save();
    ctx.strokeStyle = 'rgba(210,235,255,' + (.65 * (1 - q)) + ')';
    ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(160,220,255,.8)'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - dx * 66, y - 15); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/* ---------- 四角 HUD 取景框 ---------- */
export function drawHUDFrame(a: number): void {
  if (a <= 0) return;
  const m = 26, L = 36;
  ctx.save();
  ctx.strokeStyle = 'rgba(140,170,255,' + (.42 * a) + ')';
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(120,150,255,.55)'; ctx.shadowBlur = 8;
  const cs = [[m, m, 1, 1], [VW - m, m, -1, 1], [m, VH - m, 1, -1], [VW - m, VH - m, -1, -1]];
  ctx.beginPath();
  for (const c of cs) {
    ctx.moveTo(c[0] + L * c[2], c[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(c[0], c[1] + L * c[3]);
  }
  ctx.stroke(); ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(140,246,255,' + (.6 * a) + ')';
  for (const c of cs) {
    ctx.beginPath(); ctx.arc(c[0] + 6 * c[2], c[1] + 6 * c[3], 2, 0, 6.283); ctx.fill();
  }
  ctx.restore();
}

/* ---------- 色差双层 + 渐变 + 紫晕 + 流光标题 ---------- */
export function drawNeonTitle(
  cx: number, cy: number, text: string,
  fontSize: number, t: number, en: number,
  wobAmp = 1.6,
): void {
  if (en <= 0) return;
  const dy = (1 - en) * 24;
  ctx.save();
  ctx.globalAlpha = en;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `900 italic ${fontSize}px Arial`;
  const wob = Math.sin(t * 1.1) * wobAmp;
  ctx.fillStyle = 'rgba(38, 0, 255, 0.5)';
  ctx.fillText(text, cx - 3 - wob, cy + dy);
  ctx.fillStyle = 'rgba(255,90,220,.5)';
  ctx.fillText(text, cx + 3 + wob, cy + dy);
  ctx.shadowColor = 'rgba(125,107,255,.9)'; ctx.shadowBlur = 26;
  const tg = ctx.createLinearGradient(0, cy + dy - fontSize, 0, cy + dy + 14);
  tg.addColorStop(0, '#ff0000ff'); tg.addColorStop(.55, '#dfe2ffff'); tg.addColorStop(1, '#9fc6ff');
  ctx.fillStyle = tg; ctx.fillText(text, cx, cy + dy);

  // 流光扫过
  const cyc = 3.2, q = (t % cyc) / cyc;
  if (q < .45) {
    const u = q / .45;
    const sx = cx - 420 + u * 840;
    const sg = ctx.createLinearGradient(sx - 70, 0, sx + 70, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(.5, 'rgba(255,255,255,.9)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.shadowBlur = 0;
    ctx.fillStyle = sg; ctx.fillText(text, cx, cy + dy);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

/* ---------- 装饰小星（用于副标题两侧） ---------- */
export function drawDecoStar(cx: number, cy: number, r: number, rot: number, col: string, lw: number, alpha: number): void {
  _drawStar(cx, cy, r, rot, col, lw, alpha);
}