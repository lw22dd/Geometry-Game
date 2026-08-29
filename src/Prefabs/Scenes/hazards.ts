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
import { T } from './theme';

/** 尖刺（三角形，合并路径一次描边发光；呼吸脉冲 + 尖端亮点） */
export function drawSpikes(): void {
  const pulse = 0.75 + 0.25 * Math.sin(gs.time * T.breathSpeed);
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
  ctx.shadowBlur = 8 + 6 * pulse;                       // ★ 呼吸光晕
  ctx.strokeStyle = 'rgba(255,138,222,' + (0.7 + 0.3 * pulse).toFixed(3) + ')';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.shadowBlur = 0;
  // ★ 尖端亮点（第二次遍历，呼吸 alpha）
  ctx.fillStyle = 'rgba(255,200,245,' + (0.45 + 0.4 * pulse).toFixed(3) + ')';
  for (const e of query(world, [Position, Collider, Hazard])) {
    if (hasComponent(world, e, Timer)) continue;
    const px = sx(Position.x[e]);
    if (px < -40 || px > VW + 40) continue;
    ctx.beginPath();
    ctx.arc(px + view.SZ * 0.5, sy(Position.y[e] + 1), 1.6, 0, 6.283);
    ctx.fill();
  }
}

/** 激光栅栏（★ 开启前 0.3s 充电预警：能量珠两端向中心汇聚 + 预览虚线渐显） */
export function drawLasers(): void {
  for (const e of query(world, [Position, Collider, Timer])) {
    const r = colliderWorldRect(e);

    const px = sx(Position.x[e]);
    if (px < -60 || px > VW + 60) continue;
    const y0 = sy(r.y), y1 = sy(r.top);
    const on = Timer.on[e] === 1;
    const tMod = (gs.time + Timer.ph[e]) % Timer.period[e];
    const warn = tMod > Timer.period[e] - 0.3;
    const charge = warn ? (tMod - (Timer.period[e] - 0.3)) / 0.3 : 0; // 0→1 充电进度
    const em = (on || warn) && (Math.floor(gs.time * 12) % 2 === 0) ? '#ffffff' : '#ff8ad8';
    ctx.shadowColor = '#ff5fc8';
    ctx.shadowBlur = on ? 14 : 5;
    ctx.fillStyle = em;
    ctx.fillRect(px - 0.3 * view.SZ, y0 - 0.18 * view.SZ, 0.6 * view.SZ, 0.3 * view.SZ);
    ctx.fillRect(px - 0.3 * view.SZ, y1 - 0.12 * view.SZ, 0.6 * view.SZ, 0.3 * view.SZ);
    ctx.shadowBlur = 0;

    // ★ 充电预警：能量珠从两端向中心汇聚 + 预览虚线渐显
    if (!on && charge > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const ce = charge * charge; // easeIn：先慢后快冲向中心
      for (const sgn of [0, 1]) {
        const cy = sgn === 0 ? y0 + (y1 - y0) * ce : y1 + (y0 - y1) * ce;
        ctx.fillStyle = 'rgba(255,120,220,' + (0.2 + 0.6 * charge).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(px, cy, 1.2 + 2.8 * charge, 0, 6.283);
        ctx.fill();
      }
      ctx.globalAlpha = 0.35 * charge;
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = '#ff5fc8';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, y0); ctx.lineTo(px, y1); ctx.stroke();
      ctx.restore();
    }

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
    } else if (charge <= 0) {
      ctx.setLineDash([4, 7]);
      ctx.strokeStyle = 'rgba(255,110,200,.25)';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(px, y0); ctx.lineTo(px, y1); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}