/**
 * 场景预制体 —— 障碍物（尖刺 + 激光）建模。
 * 数据源：新 ECS。
 */
import { ctx, VW } from '../../core/canvas';
import { sx, sy, view } from '../../core/camera';
import { gs } from '../../systems/game/gameState';
import { Position, Collider, Timer, Hazard } from '../../core/ecs';
import { colliderWorldRect } from '../../systems/level';
import { query, hasComponent } from 'bitecs';
import { world } from '../../core/ecs';

/** 尖刺（三角形，合并路径一次描边发光） */
export function drawSpikes(): void {
  ctx.beginPath();
  for (const e of query(world, [Position, Collider, Hazard])) {
    // 激光也带 Hazard，按是否挂载 Timer 区分（激光用 drawLasers 绘制）
    if (hasComponent(world, e, Timer)) continue;
    const px = sx(Position.x[e]);
    if (px < -40 || px > VW + 40) continue;
    ctx.moveTo(px, sy(Position.y[e]));
    ctx.lineTo(px + view.SZ, sy(Position.y[e]));
    ctx.lineTo(px + view.SZ * 0.5, sy(Position.y[e] + 1));
    ctx.closePath();
  }
  ctx.fillStyle = 'rgba(30,12,50,.95)';
  ctx.fill();
  ctx.shadowColor = 'rgba(255,110,220,.9)';
  ctx.shadowBlur = 10;
  ctx.strokeStyle = '#ff8ade';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

/** 激光栅栏 */
export function drawLasers(): void {
  for (const e of query(world, [Position, Collider, Timer])) {
    const r = colliderWorldRect(e);

    const px = sx(Position.x[e]);
    if (px < -60 || px > VW + 60) continue;
    const y0 = sy(r.y), y1 = sy(r.top);
    const on = Timer.on[e] === 1;
    const warn = ((gs.time + Timer.ph[e]) % Timer.period[e]) > Timer.period[e] - 0.3;
    const em = (on || warn) && (Math.floor(gs.time * 12) % 2 === 0) ? '#ffffff' : '#ff8ad8';
    ctx.shadowColor = '#ff5fc8';
    ctx.shadowBlur = on ? 14 : 5;
    ctx.fillStyle = em;
    ctx.fillRect(px - 0.3 * view.SZ, y0 - 0.18 * view.SZ, 0.6 * view.SZ, 0.3 * view.SZ);
    ctx.fillRect(px - 0.3 * view.SZ, y1 - 0.12 * view.SZ, 0.6 * view.SZ, 0.3 * view.SZ);
    ctx.shadowBlur = 0;
    if (on) {
      const jx = Math.sin(gs.time * 47 + Position.x[e]) * 1.2;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,90,200,.14)'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(px + jx, y0); ctx.lineTo(px + jx, y1); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,140,220,.5)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(px + jx, y0); ctx.lineTo(px + jx, y1); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(px + jx, y0); ctx.lineTo(px + jx, y1); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.setLineDash([4, 7]);
      ctx.strokeStyle = 'rgba(255,110,200,.25)';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(px, y0); ctx.lineTo(px, y1); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}