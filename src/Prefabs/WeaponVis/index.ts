/**
 * WeaponVis —— 武器外观预制体（建模单一来源）。
 *
 * 集中所有武器绘制：AK 步枪 / 手雷 的本体建模与图标。
 * 调用方（拾取物 / 抛体 / 玩家持枪 / HUD / 图鉴）统一从这里取武器形状，
 * 不再各自散落一份武器绘制代码。
 *
 * API 分层：
 *  - drawAKShape / drawGrenadeShape：纯本体（在原点绘制，r 为尺度单位）；
 *    发光阴影由调用方控制（拾取物发光、图标自发光各异）。
 *  - drawAKIcon / drawGrenadeIcon / drawWeaponIcon：带发光阴影的图标
 *    （HUD 背包栏 / 持枪 / 抛体用）。
 */
import { ctx } from '../../core/canvas';

/** 体素块：带顶光 / 底阴影 / 右缘暗的矩形（material 控制纹理细节） */
function voxelBlock(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, material?: string): void {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
  // 顶缘受光
  c.fillStyle = 'rgba(255,255,255,.13)';
  c.fillRect(x, y, w, Math.min(h, 0.9));
  // 底缘阴影
  c.fillStyle = 'rgba(0,0,0,.20)';
  c.fillRect(x, y + h - 0.9, w, Math.min(h, 0.9));
  // 右缘微暗（体积感）
  c.fillStyle = 'rgba(0,0,0,.10)';
  c.fillRect(x + w - 0.7, y, 0.7, h);
  if (material === 'wood') {
    c.fillStyle = 'rgba(0,0,0,.10)';
    c.fillRect(x, y + h * 0.34, w, 0.6);
    c.fillRect(x, y + h * 0.62, w, 0.6);
  }
}

/**
 * AK 步枪本体（参考写实建模）。
 * 固定参考坐标系：枪口朝右，x 向右、y 向下为正，图形整体落在 x≈[2,39] / y≈[-11,4]；
 * 由 drawAKShape 经 scale/translate 映射为以 r 为尺度的原点绘制。
 */
function paintAK(c: CanvasRenderingContext2D): void {
  // ── 木枪托（梯形：贴腮近水平，下缘斜下，托端加高）──
  c.beginPath();
  c.moveTo(12, -7.2); c.lineTo(3.2, -6.4); c.lineTo(3.2, .6); c.lineTo(12, -3.2);
  c.closePath();
  c.fillStyle = '#6b4a2a'; c.fill();
  c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(3.6, -6.8, 8.2, .7);   // 顶缘受光
  c.fillStyle = 'rgba(0,0,0,.22)'; // 下缘阴影
  c.beginPath(); c.moveTo(12, -4.6); c.lineTo(3.2, -1.2); c.lineTo(3.2, .6); c.lineTo(12, -3.2); c.closePath(); c.fill();
  // 托底板（金属）
  voxelBlock(c, 2.2, -6.8, 1.2, 7.6, '#3a3e46', 'metal');
  // ── 手枪握把（后倾）──
  c.save(); c.translate(13.4, -2.6); c.rotate(.32);
  voxelBlock(c, -1.1, -.6, 2.2, 5, '#23262c', 'rough');
  c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(-1.1, -.6, .7, 4.4);
  c.restore();
  // ── 香蕉弹匣：三段递进前弯（金属三色阶）──
  c.save(); c.translate(17.2, -2.6); c.rotate(-.18);
  voxelBlock(c, -2.2, -1, 4.4, 3.6, '#1c1e23', 'metal');
  c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(-.4, -.8, .6, 3.2);
  c.translate(0, 2.4); c.rotate(-.28);
  voxelBlock(c, -2.1, -1, 4.2, 3.6, '#1c1e23', 'metal');
  c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(-.4, -.8, .6, 3.2);
  c.translate(0, 2.4); c.rotate(-.3);
  voxelBlock(c, -2, -1, 4, 3.8, '#1c1e23', 'metal');
  c.fillStyle = '#3a3e46'; c.fillRect(-2.2, 2.2, 4.4, 1); // 匣底板
  c.restore();
  // ── 机匣 ──
  voxelBlock(c, 12, -8.8, 10.5, 6.4, '#2a2d33', 'metal');
  // 机匣盖（带加强筋）
  voxelBlock(c, 12, -9.6, 10.5, 2.4, '#3a3e46', 'metal');
  // 铆钉
  c.fillStyle = '#4a4e55';
  c.beginPath(); c.arc(14.2, -7.2, .8, 0, 7); c.fill();
  c.beginPath(); c.arc(20.6, -7.2, .8, 0, 7); c.fill();
  // 抛壳窗
  voxelBlock(c, 18.6, -7.8, 2.2, 1.6, '#1c1e23', 'metal');
  // 快慢机/保险拨片（长拨杆+轴点）
  voxelBlock(c, 13.6, -6.2, 4.4, 1.1, '#4a4e55', 'metal');
  c.fillStyle = '#4a4e55'; c.beginPath(); c.arc(14, -5.6, .9, 0, 7); c.fill();
  // 表尺座（机匣盖与护木交界）
  voxelBlock(c, 21.3, -9.9, 1.4, 1.2, '#23262c', 'metal');
  // ── 木护木（真品表面光滑，无散热孔）──
  voxelBlock(c, 22.5, -5, 6, 3, '#6b4a2a', 'wood');
  // 导气管（护木上方）
  voxelBlock(c, 22.5, -6.8, 6, 1.7, '#3a3e46', 'metal');
  // 导气箍
  voxelBlock(c, 28.5, -7, 1.6, 3.4, '#23262c', 'metal');
  // ── 枪管（加长，外露段≈全枪 26%）──
  voxelBlock(c, 29.8, -6.1, 6.4, 1.7, '#2e3138', 'metal');
  // ── 准星（移至枪口附近）──
  voxelBlock(c, 34.6, -8.2, 1.8, 2.2, '#3a3e46', 'metal');          // 准星座
  c.fillStyle = '#23262c'; c.fillRect(35.2, -10.6, .8, 2.6); // 准星柱（高出顶线）
  c.fillRect(34.5, -9.4, .5, 1.4); c.fillRect(36.3, -9.4, .5, 1.4); // 护翼
  // ── 枪口制退器（斜切口多边形，开口朝前上）──
  c.beginPath();
  c.moveTo(36.4, -6.9); c.lineTo(38.6, -6.9); c.lineTo(37.8, -4.4); c.lineTo(36.4, -4.4);
  c.closePath();
  c.fillStyle = '#3a3e46'; c.fill();
  c.fillStyle = '#23262c'; c.fillRect(36.4, -6.9, .7, 2.5); // 暗端
}

/** AK 步枪本体（原点绘制；枪口朝右，r 为尺度单位） */
function drawAKShape(r: number): void {
  ctx.save();
  const s = r * 0.09;
  ctx.scale(s, s);
  ctx.translate(-20, 3); // 将参考中心 (20,-3) 对齐到原点
  paintAK(ctx);
  ctx.restore();
}

/** 手雷本体（原点绘制；引信朝上，r 为尺度单位） */
function drawGrenadeShape(r: number): void {
  // 球体（暗绿渐变）
  const g = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.1, 0, 0, r * 0.9);
  g.addColorStop(0, '#7fb874');
  g.addColorStop(0.6, '#4c7a44');
  g.addColorStop(1, '#2e4a2a');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, r * 0.05, r * 0.85, 0, 6.283); ctx.fill();
  // 米字纹（爆炸槽）
  ctx.strokeStyle = 'rgba(20,35,20,.5)';
  ctx.lineWidth = r * 0.06;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 4 + 0.4;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.05);
    ctx.lineTo(Math.cos(a) * r * 0.82, r * 0.05 + Math.sin(a) * r * 0.82);
    ctx.stroke();
  }
  // 引信座（顶部凸起）
  ctx.fillStyle = '#3a4a36';
  ctx.fillRect(-r * 0.18, -r * 0.95, r * 0.36, r * 0.3);
  // 拉环（顶部金色圆环）
  ctx.strokeStyle = '#ffd76b';
  ctx.lineWidth = r * 0.1;
  ctx.beginPath(); ctx.arc(0, -r * 1.05, r * 0.18, 0, 6.283); ctx.stroke();
  // 高光
  ctx.fillStyle = 'rgba(220,255,210,.5)';
  ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.25, r * 0.18, 0, 6.283); ctx.fill();
}

/** 武器本体建模（按 kind 分发；在原点绘制，供拾取物 / 抛体用，阴影由调用方控制） */
export function drawWeaponModel(kind: 'ak' | 'grenade', r: number): void {
  if (kind === 'grenade') drawGrenadeShape(r);
  else drawAKShape(r);
}

/** AK 图标（带发光；中心绘制） */
export function drawAKIcon(cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.15);
  ctx.shadowColor = 'rgba(255,150,60,.9)';
  ctx.shadowBlur = 8;
  drawAKShape(r);
  ctx.shadowBlur = 0;
  ctx.restore();
}

/** 手雷图标（带发光；中心绘制） */
export function drawGrenadeIcon(cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = 'rgba(150,255,140,.9)';
  ctx.shadowBlur = 8;
  drawGrenadeShape(r);
  ctx.shadowBlur = 0;
  ctx.restore();
}

/** 武器图标统一出口（HUD / 图鉴 / 持枪用；按 kind 分发） */
export function drawWeaponIcon(cx: number, cy: number, r: number, kind: string): void {
  if (kind === 'grenade') drawGrenadeIcon(cx, cy, r);
  else drawAKIcon(cx, cy, r);
}
