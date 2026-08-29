/**
 * 场景预制体 —— 收集品 / 终点建模。
 * 光球、检查点、NOVA 星、双跳票、钩锁道具。
 * 数据从新 ECS 查询（Position + Collider + Collectible/RespawnPoint/Goal + Renderable + Animator + 标签组件）。
 */
import { ctx, VW, VH } from '../../core/canvas';
import { sx, sy, view } from '../../core/camera';
import { Position, Collider, Collectible, RespawnPoint, Goal, Renderable, Animator, Orb, JumpBoost, Hook, ShieldPickup, SpeedPickup } from '../../core/ecs';
import { gs } from '../../systems/game/gameState';
import { colliderWorldRect } from '../../systems/level';
import { T } from './theme';
import { getAnimOutput } from '../Animations';
import { query } from 'bitecs';
import { world } from '../../core/ecs';
import { spawnParticles } from '../../systems/particles';
import { FX } from '../Fx';

/** 光球 */
export function drawOrbs(): void {
  for (const e of query(world, [Position, Collider, Collectible, Animator, Orb])) {
    if (Collectible.collected[e] === 1) continue;
    const ren = { radius: Renderable.radius[e] };
    const out = getAnimOutput(e);
    const px = sx(Position.x[e]);
    if (px < -60 || px > VW + 60) continue;
    const py = sy(Position.y[e] + out.offsetY);
    const r = ren.radius * view.SZ;

    // 外发光（受 alpha 影响）
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = out.alpha;
    const g = ctx.createRadialGradient(px, py, 0, px, py, r * 2.6);
    g.addColorStop(0, 'rgba(140,246,255,.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(px, py, r * 2.6, 0, 6.283); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // 核心
    ctx.fillStyle = '#eaffff';
    ctx.shadowColor = '#8ff6ff';
    ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(px, py, r * 0.55 * out.scaleX, 0, 6.283); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // 旋转方框（受 scaleX 鼓胀）
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(out.rotation);
    ctx.scale(out.scaleX, 1);
    ctx.strokeStyle = 'rgba(160,250,255,.85)';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
    ctx.restore();
  }
}

/** 检查点光柱 */
export function drawCheckpoints(p: number): void {
  for (const e of query(world, [Position, RespawnPoint, Renderable])) {
    const pos = { x: Position.x[e], y: Position.y[e] };
    const rp_active = RespawnPoint.active[e];
    const rp_nearby = RespawnPoint.nearby[e];
    const px = sx(Position.x[e]);
    if (px < -40 || px > VW + 40) continue;
    const py = sy(Position.y[e]);
    const g = ctx.createLinearGradient(0, py, 0, py - 6.5 * view.SZ);
    g.addColorStop(0, rp_active === 1 ? 'rgba(125,249,255,' + (0.28 + 0.2 * p) + ')' : 'rgba(140,130,255,.10)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(px - 0.28 * view.SZ, py - 6.5 * view.SZ, 0.56 * view.SZ, 6.5 * view.SZ);
    ctx.fillStyle = rp_active === 1 ? 'rgba(125,249,255,.9)' : 'rgba(140,130,255,.55)';
    ctx.shadowColor = rp_active === 1 ? '#7df9ff' : '#8a82ff';
    ctx.shadowBlur = rp_active === 1 ? 12 : 4;
    ctx.fillRect(px - 0.9 * view.SZ, sy(Position.y[e] + 0.3), 1.8 * view.SZ, 0.3 * view.SZ);
    ctx.shadowBlur = 0;

    // ── E 交互提示（未激活且玩家在附近时，贴近底座）──
    if (rp_active !== 1 && rp_nearby === 1) {
      const beat = 0.55 + 0.45 * Math.sin(gs.time * 5.5);
      const ey = py - 0.7 * view.SZ;
      const er = 0.5 * view.SZ * (1 + beat * 0.06);
      ctx.save();
      ctx.globalAlpha = 0.75 + 0.25 * beat;
      ctx.shadowColor = 'rgba(125,249,255,.6)';
      ctx.shadowBlur = 10;
      ctx.fillStyle = 'rgba(16,60,40,.85)';
      ctx.beginPath();
      ctx.arc(px, ey, er, 0, 6.283);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(200,255,240,.95)';
      ctx.font = '700 14px "Segoe UI",Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('E', px, ey + 1);
      ctx.restore();
    }
  }
}

/** NOVA 星（终点） */
export function drawNOVA(p: number): void {
  const e = query(world, [Position, Goal]).find(() => true);
  if (!e) return;
  const pos = { x: Position.x[e], y: Position.y[e] };
  const ren = { radius: Renderable.radius[e] };
  const out = getAnimOutput(e);
  const px = sx(Position.x[e]);
  if (px < -160 || px > VW + 160) return;
  const py = sy(Position.y[e]);
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
  ctx.rotate(out.rotation);
  ctx.shadowColor = gs.win ? '#ffd76b' : '#c07dff';
  ctx.shadowBlur = 22;
  const d = ren.radius * view.SZ * out.scaleX;
  // ★ 星体下方椭圆光池（"神圣"光池，叠加在光柱之上的地面光斑）
  ctx.save();
  ctx.translate(px, py + d * 1.1);
  ctx.scale(1, 0.28);
  const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, d * 2);
  pool.addColorStop(0, 'rgba(' + col + ',.30)');
  pool.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.arc(0, 0, d * 2, 0, 6.283);
  ctx.fill();
  ctx.restore();
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

/** 双跳增益箭（绿色箭头 + 淡绿泛光圈，拾取后获得一次二段跳） */
export function drawJumpBoosts(): void {
  for (const e of query(world, [Position, Collider, Collectible, Renderable, Animator, JumpBoost])) {
    if (Collectible.collected[e] === 1) continue;
    const ren = { radius: Renderable.radius[e] };
    const out = getAnimOutput(e);
    const r = colliderWorldRect(e);
    const cx = sx(r.x + r.w / 2);
    const cy = sy(r.top + r.h / 2 + out.offsetY);
    const R = Renderable.radius[e] * view.SZ;

    // ① 淡绿泛光圈（外发光层）
    ctx.globalAlpha = out.alpha;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 2.4);
    g.addColorStop(0, 'rgba(120,255,170,.28)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R * 2.4, 0, 6.283); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // ② 绿色上行箭头
    ctx.save();
    ctx.translate(cx, cy + R * 0.1);
    ctx.rotate(out.rotation);
    ctx.shadowColor = 'rgba(120,255,170,.9)';
    ctx.shadowBlur = T.glowMovable;
    ctx.fillStyle = '#59ff8f';
    ctx.beginPath();
    ctx.moveTo(0, -R * 1.3);
    ctx.lineTo(R * 0.65, -R * 0.15);
    ctx.lineTo(R * 0.24, -R * 0.15);
    ctx.lineTo(R * 0.24, R);
    ctx.lineTo(-R * 0.24, R);
    ctx.lineTo(-R * 0.24, -R * 0.15);
    ctx.lineTo(-R * 0.65, -R * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    // 箭头高光竖线（对应"顶光"语法）
    ctx.fillStyle = 'rgba(230,255,240,.9)';
    ctx.fillRect(-R * 0.08, -R * 1.1, R * 0.16, R * 0.9);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

/** 钩锁道具（金色钩形 + 淡金泛光圈，拾取后进入背包主动栏） */
export function drawHookPickups(): void {
  for (const e of query(world, [Position, Collider, Collectible, Renderable, Animator, Hook])) {
    if (Collectible.collected[e] === 1) continue;
    const ren = { radius: Renderable.radius[e] };
    const out = getAnimOutput(e);
    const r = colliderWorldRect(e);
    const cx = sx(r.x + r.w / 2);
    const cy = sy(r.top + r.h / 2 + out.offsetY);
    const R = Renderable.radius[e] * view.SZ;

    // ① 淡金泛光圈（外发光层）
    ctx.globalAlpha = out.alpha;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 2.4);
    g.addColorStop(0, 'rgba(255,190,90,.30)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R * 2.4, 0, 6.283); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // ② 金色钩形（钩杆 + 弯钩 + 倒刺）
    ctx.save();
    ctx.translate(cx, cy + R * 0.2);
    ctx.rotate(out.rotation);
    ctx.shadowColor = 'rgba(255,180,70,.9)';
    ctx.shadowBlur = T.glowMovable;
    ctx.strokeStyle = '#ffc04d';
    ctx.lineWidth = R * 0.42;
    ctx.lineCap = 'round';
    // 钩杆：竖直
    ctx.beginPath();
    ctx.moveTo(0, -R * 1.25);
    ctx.lineTo(0, R * 0.35);
    ctx.stroke();
    // 弯钩：从杆尾向左弯回（钩口朝左）
    ctx.beginPath();
    ctx.arc(0, R * 0.35, R * 0.65, -Math.PI * 0.82, Math.PI * 1.02);
    ctx.stroke();
    // 倒刺（小三角箭头，指向钩住方向）
    ctx.fillStyle = '#ffd27a';
    ctx.beginPath();
    ctx.moveTo(0, R * 0.28);
    ctx.lineTo(-R * 0.55, R * 0.10);
    ctx.lineTo(0, -R * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    // 顶部圆头（发射端）
    ctx.fillStyle = '#ffe3ad';
    ctx.beginPath(); ctx.arc(0, -R * 1.25, R * 0.22, 0, 6.283); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

/** 护盾道具（蓝紫盾形 + 泛光圈，拾取获得限时护盾） */
export function drawShieldPickups(): void {
  for (const e of query(world, [Position, Collider, Collectible, Renderable, Animator, ShieldPickup])) {
    if (Collectible.collected[e] === 1) continue;
    const out = getAnimOutput(e);
    const r = colliderWorldRect(e);
    const cx = sx(r.x + r.w / 2);
    const cy = sy(r.top + r.h / 2 + out.offsetY);
    const R = Renderable.radius[e] * view.SZ;

    // ① 蓝紫泛光圈（外发光层）
    ctx.globalAlpha = out.alpha;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 2.4);
    g.addColorStop(0, 'rgba(150,140,255,.30)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R * 2.4, 0, 6.283); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // ② 盾形（上圆 + 收尖下底 + V 型高光）
    ctx.save();
    ctx.translate(cx, cy + R * 0.1);
    ctx.rotate(out.rotation);
    ctx.shadowColor = 'rgba(150,140,255,.9)';
    ctx.shadowBlur = T.glowMovable;
    ctx.fillStyle = '#b3c7ff';
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.75, Math.PI, 0);
    ctx.lineTo(R * 0.75, R * 0.45);
    ctx.lineTo(0, R * 0.95);
    ctx.lineTo(-R * 0.75, R * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    // V 型高光
    ctx.strokeStyle = 'rgba(235,240,255,.9)';
    ctx.lineWidth = R * 0.16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-R * 0.3, -R * 0.2);
    ctx.lineTo(0, R * 0.25);
    ctx.lineTo(R * 0.3, -R * 0.2);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

/** 加速道具（青白「》》」双箭头 + 泛光圈，拾取获得限时移速 ×2） */
export function drawSpeedPickups(): void {
  for (const e of query(world, [Position, Collider, Collectible, Renderable, Animator, SpeedPickup])) {
    if (Collectible.collected[e] === 1) continue;
    const out = getAnimOutput(e);
    const r = colliderWorldRect(e);
    const cx = sx(r.x + r.w / 2);
    const cy = sy(r.top + r.h / 2 + out.offsetY);
    const R = Renderable.radius[e] * view.SZ;

    // ① 青白泛光圈（外发光层）
    ctx.globalAlpha = out.alpha;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 2.4);
    g.addColorStop(0, 'rgba(140,246,255,.32)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R * 2.4, 0, 6.283); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // ② 「》》」双箭头：两枚右向 chevron（外小内大，冲刺感）
    ctx.save();
    ctx.translate(cx, cy + R * 0.1);
    ctx.rotate(out.rotation);
    ctx.shadowColor = 'rgba(120,230,255,.9)';
    ctx.shadowBlur = T.glowMovable;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#8ff6ff';
    ctx.lineWidth = R * 0.34;
    // 后箭头（左小）
    ctx.beginPath();
    ctx.moveTo(-R * 0.82, -R * 0.78);
    ctx.lineTo(-R * 0.05, 0);
    ctx.lineTo(-R * 0.82, R * 0.78);
    ctx.stroke();
    // 前箭头（右大）
    ctx.strokeStyle = '#eaffff';
    ctx.beginPath();
    ctx.moveTo(-R * 0.18, -R * 0.78);
    ctx.lineTo(R * 0.6, 0);
    ctx.lineTo(-R * 0.18, R * 0.78);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

/**
 * 光球环境光尘 —— 每颗未收集光球每 0.5s 缓慢上浮一颗青白光尘。
 * 由 game step 每帧调用（与粒子步进同帧）。
 */
export function emitItemAmbient(dt: number): void {
  for (const e of query(world, [Position, Collectible, Orb])) {
    if (Collectible.collected[e] === 1) continue;
    const ph = Position.x[e] * 0.37 + Position.y[e] * 0.13;
    if ((gs.time + ph) % 0.5 < dt) {                       // 每光球每 0.5s 一颗
      spawnParticles(FX.orbAmbient, Position.x[e], Position.y[e], 1);
    }
  }
}