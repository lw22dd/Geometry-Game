/**
 * 场景预制体 —— 收集品 / 终点建模。
 * 光球、检查点、NOVA 星。
 * 数据从 ECS World 查询（Position + Collider/Collectible/RespawnPoint/Goal + Renderable）。
 */
import { ctx, VW, VH } from '../../core/canvas';
import { sx, sy, view } from '../../core/camera';
import { world } from '../../core/ecs';
import { Position } from '../../components/Position';
import { Collectible } from '../../components/Collectible';
import { RespawnPoint } from '../../components/RespawnPoint';
import { Goal } from '../../components/Goal';
import { Renderable } from '../../components/Renderable';
import { gs } from '../../systems/game/state';

/** 光球 */
export function drawOrbs(): void {
  for (const e of world.query(Position, Collectible, Renderable)) {
    const pos = world.get<Position>(e, Position);
    const col = world.get<Collectible>(e, Collectible);
    const ren = world.get<Renderable>(e, Renderable);
    if (col.collected) continue;
    const px = sx(pos.x);
    if (px < -60 || px > VW + 60) continue;
    const bob = Math.sin(gs.time * ren.bobSpeed + ren.phase) * 0.18;
    const py = sy(pos.y + bob), r = ren.radius * view.SZ;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(px, py, 0, px, py, r * 2.6);
    g.addColorStop(0, 'rgba(140,246,255,.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(px, py, r * 2.6, 0, 6.283); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#eaffff';
    ctx.shadowColor = '#8ff6ff';
    ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(px, py, r * 0.55, 0, 6.283); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(gs.time * ren.rotSpeed + ren.phase);
    ctx.strokeStyle = 'rgba(160,250,255,.85)';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
    ctx.restore();
  }
}

/** 检查点光柱 */
export function drawCheckpoints(p: number): void {
  for (const e of world.query(Position, RespawnPoint, Renderable)) {
    const pos = world.get<Position>(e, Position);
    const rp = world.get<RespawnPoint>(e, RespawnPoint);
    const px = sx(pos.x);
    if (px < -40 || px > VW + 40) continue;
    const py = sy(pos.y);
    const g = ctx.createLinearGradient(0, py, 0, py - 6.5 * view.SZ);
    g.addColorStop(0, rp.active ? 'rgba(125,249,255,' + (0.28 + 0.2 * p) + ')' : 'rgba(140,130,255,.10)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(px - 0.28 * view.SZ, py - 6.5 * view.SZ, 0.56 * view.SZ, 6.5 * view.SZ);
    ctx.fillStyle = rp.active ? 'rgba(125,249,255,.9)' : 'rgba(140,130,255,.55)';
    ctx.shadowColor = rp.active ? '#7df9ff' : '#8a82ff';
    ctx.shadowBlur = rp.active ? 12 : 4;
    ctx.fillRect(px - 0.9 * view.SZ, sy(pos.y + 0.3), 1.8 * view.SZ, 0.3 * view.SZ);
    ctx.shadowBlur = 0;
  }
}

/** NOVA 星（终点） */
export function drawNOVA(p: number): void {
  const nova = world.queryOne(Position, Goal);
  if (!nova) return;
  const pos = world.get<Position>(nova, Position);
  const ren = world.get<Renderable>(nova, Renderable);
  const px = sx(pos.x);
  if (px < -160 || px > VW + 160) return;
  const py = sy(pos.y);
  const col = gs.win ? '255,220,140' : '190,140,255';
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, py, 0, sy(0));
  g.addColorStop(0, 'rgba(' + col + ',' + (0.34 + 0.2 * p) + ')');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(px - 0.42 * view.SZ, sy(0), 0.84 * view.SZ, py - sy(0));
  for (let i = 0; i < 2; i++) {
    const tt = ((gs.time * 0.6 + i * 0.5) % 1), rr = tt * 6 * view.SZ;
    ctx.strokeStyle = 'rgba(' + (gs.win ? '255,230,160' : '210,160,255') + ',' + ((1 - tt) * 0.45) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px, py, rr, 0, 6.283); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(gs.time * ren.rotSpeed);
  ctx.shadowColor = gs.win ? '#ffd76b' : '#c07dff';
  ctx.shadowBlur = 22;
  const d = ren.radius * view.SZ;
  ctx.fillStyle = gs.win ? '#fff3cf' : '#f2e4ff';
  ctx.beginPath();
  ctx.moveTo(0, -d); ctx.lineTo(d, 0); ctx.lineTo(0, d); ctx.lineTo(-d, 0); ctx.closePath();
  ctx.fill();
  ctx.rotate(-gs.time * 1.9);
  ctx.strokeStyle = gs.win ? '#ffe9a8' : '#e3ccff';
  ctx.lineWidth = 2;
  ctx.strokeRect(-d * 0.5, -d * 0.5, d, d);
  ctx.restore();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.arc(px, py, 0.16 * view.SZ, 0, 6.283); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.font = '700 12px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(240,225,255,.85)';
  ctx.fillText('NOVA ★', px, py - d - 14);
  ctx.textAlign = 'left';
}