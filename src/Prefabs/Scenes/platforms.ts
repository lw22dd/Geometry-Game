/**
 * 场景预制体 —— 平台（长方形）建模。
 * 静态平台 / 移动平台（ECS）/ 地图边框 / 装饰方块 / 网格线。
 */
import { ctx, VW, VH } from '../../core/canvas';
import { sx, sy, view } from '../../core/camera';
import { clamp } from '../../core/math';
import { currentMap } from '../../config';
import { gs } from '../../systems/game/state';
import { world } from '../../core/ecs';
import { Position } from '../../components/Position';
import { Collider } from '../../components/Collider';
import { PathMotion } from '../../components/PathMotion';
import { colliderWorldRect } from '../../systems/level';

/** 颜色渐变（随位置从青 → 紫 → 品红） */
const hue2 = (x: number, y: number): number =>
  196 + 100 * clamp(x / currentMap.width * 0.55 + y / currentMap.height * 0.45, 0, 1);

/** 网格线 */
export function drawGrid(p: number): void {
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(120,150,255,' + (0.05 + 0.05 * p) + ')';
  ctx.beginPath();
  const gy0 = Math.max(0, view.SB), gy1 = Math.min(currentMap.height, view.SB + VH / view.SZ);
  const gx0 = Math.max(0, view.SL), gx1 = Math.min(currentMap.width, view.SL + VW / view.SZ);
  for (let x = Math.max(0, Math.floor(view.SL / 2) * 2); x <= gx1; x += 2) {
    ctx.moveTo(sx(x), sy(gy0)); ctx.lineTo(sx(x), sy(gy1));
  }
  for (let y = Math.max(0, Math.floor(view.SB / 2) * 2); y <= gy1; y += 2) {
    ctx.moveTo(sx(gx0), sy(y)); ctx.lineTo(sx(gx1), sy(y));
  }
  ctx.stroke();
}

/** 地图边界发光 */
export function drawBorder(): void {
  ctx.shadowColor = 'rgba(120,90,255,.8)';
  ctx.shadowBlur = 16;
  ctx.strokeStyle = 'rgba(150,120,255,.7)';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(sx(0), sy(currentMap.height), currentMap.width * view.SZ, currentMap.height * view.SZ);
  ctx.shadowBlur = 0;
}

/** 装饰旋转方块 */
export function drawDecos(): void {
  ctx.lineWidth = 1.5;
  for (const d of currentMap.decos) {
    const px = sx(d[0]), py = sy(d[1]);
    if (px < -60 || px > VW + 60) continue;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(gs.time * d[3]);
    ctx.strokeStyle = 'rgba(170,140,255,.3)';
    const r = d[2] * view.SZ * 0.5;
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }
}

/** 静态平台（长方形刚体，读取当前地图静态几何） */
export function drawSolids(): void {
  const vl = view.SL, vr = view.SL + VW / view.SZ;
  const vb = view.SB, vt = view.SB + VH / view.SZ;
  for (const r of currentMap.solids) {
    if (r.x + r.w < vl || r.x > vr || r.top < vb || r.y > vt) continue;
    const x = sx(r.x), y = sy(r.top), w = r.w * view.SZ, h = r.h * view.SZ;
    const hu = hue2(r.x + r.w / 2, r.top);
    ctx.fillStyle = 'rgba(15,11,42,.94)';
    ctx.fillRect(x, y, w, h);
    if (w > 8 && h > 8) {
      ctx.strokeStyle = 'hsla(' + hu + ',90%,65%,.12)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
    }
    ctx.shadowColor = 'hsla(' + hu + ',100%,60%,.85)';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = 'hsla(' + hu + ',95%,66%,.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'hsla(' + hu + ',100%,78%,.95)';
    ctx.fillRect(x, y, w, 2.2);
  }
}

/** 移动平台（ECS 实体）+ 轨迹线 */
export function drawMovers(): void {
  for (const e of world.query(Position, Collider, PathMotion)) {
    const pos = world.get<Position>(e, Position);
    const col = world.get<Collider>(e, Collider);
    const pm = world.get<PathMotion>(e, PathMotion);
    const r = colliderWorldRect(pos, col);

    ctx.setLineDash([3, 7]);
    ctx.strokeStyle = 'rgba(150,170,255,.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx(pm.x0), sy(r.y + r.h / 2));
    ctx.lineTo(sx(pm.x0 + pm.range + r.w), sy(r.y + r.h / 2));
    ctx.stroke();
    ctx.setLineDash([]);

    const x = sx(r.x), y = sy(r.top), w = r.w * view.SZ, h = r.h * view.SZ;
    const hu = hue2(r.x, r.y);
    ctx.fillStyle = 'rgba(20,14,52,.95)';
    ctx.fillRect(x, y, w, h);
    ctx.shadowColor = 'hsla(' + hu + ',100%,65%,.9)';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = 'hsla(' + hu + ',100%,70%,.95)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'hsla(' + hu + ',100%,80%,.95)';
    ctx.fillRect(x, y, w, 2);
  }
}