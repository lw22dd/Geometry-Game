/**
 * 场景预制体 —— 氛围特效建模。
 * 视差、曳光、粒子、文字提示。
 */
import { ctx, VW, VH } from '../../core/canvas';
import { sx, sy, view } from '../../core/camera';
import { farShapes, midShapes, currentMap, TLIFE } from '../../config';
import { gs } from '../../systems/game/gameState';
import { playerController } from '../../systems/player';
import { trail, particles } from '../../systems/particles';

/** 视差远层光斑 + 中层旋转形状 */
export function drawParallax(): void {
  for (const s of farShapes) {
    const px = (s.x - view.SL * 0.18) * view.SZ;
    const py = VH - (s.y - view.SB * 0.18) * view.SZ;
    if (px < -260 || px > VW + 260) continue;
    const g = ctx.createRadialGradient(px, py, 0, px, py, s.r * view.SZ);
    g.addColorStop(0, 'rgba(' + s.c + ',' + s.a + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, s.r * view.SZ, 0, 6.283);
    ctx.fill();
  }
  ctx.lineWidth = 1.2;
  for (const s of midShapes) {
    const px = (s.x - view.SL * 0.45) * view.SZ;
    const py = VH - (s.y - view.SB * 0.45) * view.SZ;
    if (px < -80 || px > VW + 80) continue;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(gs.time * s.sp + s.ph);
    ctx.strokeStyle = s.t ? 'rgba(140,190,255,.12)' : 'rgba(190,130,255,.12)';
    if (s.t === 0) {
      ctx.strokeRect(-s.s * view.SZ / 2, -s.s * view.SZ / 2, s.s * view.SZ, s.s * view.SZ);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, s.s * view.SZ / 2, 0, 6.283);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** 冲刺曳光 */
export function drawTrail(): void {
  ctx.globalCompositeOperation = 'lighter';
  for (const q of trail) {
    const a = 1 - q.age / TLIFE;
    if (a <= 0) continue;
    const r = (0.1 + 0.38 * a) * view.SZ;
    ctx.fillStyle = 'hsla(' + (195 + 95 * (1 - a)) + ',100%,66%,' + (0.3 * a) + ')';
    ctx.beginPath(); ctx.arc(sx(q.x), sy(q.y), r, 0, 6.283); ctx.fill();
  }
  const p = playerController.getState();
  if (p.sprint && !p.dead) {
    ctx.strokeStyle = 'rgba(150,220,255,.14)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const off = ((i * 47 + gs.time * 260) % 80) - 40;
      const yy = sy(p.y) + off;
      const xx = sx(p.x) - p.face * (26 + i * 20);
      ctx.beginPath();
      ctx.moveTo(xx, yy);
      ctx.lineTo(xx - p.face * 24, yy);
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** 粒子绘制 */
export function drawParticles(): void {
  for (const q of particles.all) {
    const a = 1 - q.age / q.life;
    if (a <= 0) continue;
    const px = sx(q.x), py = sy(q.y);
    if (q.type === 'frag') {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(q.rot);
      ctx.globalAlpha = a;
      ctx.fillStyle = q.col;
      const s = q.size * view.SZ;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
      ctx.globalAlpha = 1;
    } else if (q.type === 'arrow') {
      // 小绿色箭头（向上）
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(q.rot);
      ctx.globalAlpha = a * 0.85;
      ctx.fillStyle = q.col;
      const s = q.size * view.SZ;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.5, 0);
      ctx.lineTo(s * 0.2, 0);
      ctx.lineTo(s * 0.2, s);
      ctx.lineTo(-s * 0.2, s);
      ctx.lineTo(-s * 0.2, 0);
      ctx.lineTo(-s * 0.5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = q.col;
      ctx.beginPath(); ctx.arc(px, py, q.size * view.SZ, 0, 6.283); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

/** 关卡文字提示 */
export function drawHints(): void {
  ctx.font = '600 ' + Math.round(0.5 * view.SZ) + 'px "Segoe UI","Microsoft YaHei",Arial';
  ctx.fillStyle = 'rgba(170,200,255,.42)';
  ctx.textAlign = 'center';
  for (const h of currentMap.hints) {
    const px = sx(h[0]), py = sy(h[1]);
    if (px < -220 || px > VW + 220) continue;
    ctx.fillText(h[2], px, py);
  }
  ctx.textAlign = 'left';
}

/* ==================== 漂浮尘埃 / 底部雾（美术升级 3） ==================== */

/** 前景漂浮尘埃（不进 ECS，同 trail 轻量管理；step 中调用 stepMotes） */
interface Mote { x: number; y: number; vx: number; vy: number; r: number; ph: number; }
const motes: Mote[] = [];

export function stepMotes(dt: number): void {
  while (motes.length < 26) {
    motes.push({
      x: view.SL + Math.random() * (VW / view.SZ),
      y: view.SB + Math.random() * (VH / view.SZ),
      vx: (Math.random() - 0.5) * 0.3,
      vy: 0.08 + Math.random() * 0.22,
      r: 0.02 + Math.random() * 0.05,
      ph: Math.random() * 6.28,
    });
  }
  for (let i = motes.length - 1; i >= 0; i--) {
    const m = motes[i];
    m.x += (m.vx + Math.sin(gs.time * 0.7 + m.ph) * 0.15) * dt;
    m.y += m.vy * dt;
    if (m.y > view.SB + VH / view.SZ + 2) motes.splice(i, 1);
  }
}

export function drawMotes(): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = '#bcd8ff';
  for (const m of motes) {
    const a = 0.12 + 0.12 * Math.sin(gs.time * 1.3 + m.ph);
    if (a <= 0.02) continue;
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(sx(m.x), sy(m.y), m.r * view.SZ, 0, 6.283);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** 底部雾（缓慢呼吸，增加纵深） */
export function drawFog(): void {
  const wob = 0.10 + 0.03 * Math.sin(gs.time * 0.5);
  const g = ctx.createLinearGradient(0, VH * 0.72, 0, VH);
  g.addColorStop(0, 'rgba(90,70,180,0)');
  g.addColorStop(1, 'rgba(90,70,180,' + wob.toFixed(3) + ')');
  ctx.fillStyle = g;
  ctx.fillRect(0, VH * 0.72, VW, VH * 0.28);
}