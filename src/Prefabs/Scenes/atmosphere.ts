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