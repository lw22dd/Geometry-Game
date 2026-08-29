/**
 * 场景预制体 —— 平台（长方形）建模。
 * 静态平台 / 移动平台（ECS）/ 地图边框 / 装饰方块 / 网格线。
 * 数据源：新 ECS（静态平台仍读 currentMap，动态实体读 ECS）。
 */
import { ctx, VW, VH } from '../../core/canvas';
import { sx, sy, view } from '../../core/camera';
import { clamp } from '../../core/math';
import { currentMap } from '../../config';
import { gs } from '../../systems/game/gameState';
import { Position, Collider, PathMotion, SpringPad } from '../../core/ecs';
import { colliderWorldRect } from '../../systems/level';
import { T, neonBox } from './theme';
import { query } from 'bitecs';
import { world } from '../../core/ecs';

/** 功能色：绿 = 弹射/加速 */
const HUE_SPRING = 145;

/** hex("#rrggbb") → "rgba(r,g,b,a)" */
function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

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
  // 已被 MVMap 底盘可行走区（floor）完全覆盖的矩形不再重复霓虹绘制——
  // 语义上 floor 是可走带视觉层；若某矩形恰与可走带重合（旧式 1:1 布局），
  // 交给 drawFloor 用区域色绘制，避免霓虹盖住可走带色。
  const floorSet = new Set<string>();
  for (const c of currentMap.floor?.cells ?? []) {
    floorSet.add(c.x + ',' + c.y + ',' + c.w + ',' + c.h);
  }
  for (const r of currentMap.solids) {
    if (r.x + r.w < vl || r.x > vr || r.top < vb || r.y > vt) continue;
    if (floorSet.has(r.x + ',' + r.y + ',' + r.w + ',' + r.h)) continue;
    neonBox(
      sx(r.x), sy(r.top), r.w * view.SZ, r.h * view.SZ,
      hue2(r.x + r.w / 2, r.top),
    );
  }
}

/**
 * MVMap 底盘可行走区视觉层（只读，格子化可行走带）。
 * 读取 currentMap.floor：合并矩形按区域色平铺 + 内部 1 米格线（MVMap 风格）。
 *
 * 语义（模式 A / 恶魔城）：色块 = 区域 = 可行走空间，不是墙。
 * 仅视觉；碰撞仍由 solids 承担。
 */
export function drawFloor(): void {
  const floor = currentMap.floor;
  if (!floor || floor.cells.length === 0) return;
  const grid = floor.gridSize ?? 1;
  const vl = view.SL, vr = view.SL + VW / view.SZ;
  const vb = view.SB, vt = view.SB + VH / view.SZ;
  const sub = Math.max(0.5, grid); // 每格边长(米) → 格线间隔

  for (const c of floor.cells) {
    if (c.x + c.w < vl || c.x > vr || c.y + c.h < vb || c.y > vt) continue;
    const px = sx(c.x), py = sy(c.y + c.h);
    const pw = c.w * view.SZ, ph = c.h * view.SZ;
    if (pw <= 0 || ph <= 0) continue;

    // 底色（半透明，柔和）
    ctx.fillStyle = hexA(c.color, 0.3);
    ctx.fillRect(px, py, pw, ph);

    // 内部 1 米格线（「格子化」纹理）
    ctx.strokeStyle = hexA(c.color, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = c.x + sub; gx < c.x + c.w; gx += sub) {
      const gpx = sx(gx);
      ctx.moveTo(gpx, py); ctx.lineTo(gpx, py + ph);
    }
    for (let gy = c.y + sub; gy < c.y + c.h; gy += sub) {
      const gpy = sy(gy);
      ctx.moveTo(px, gpy); ctx.lineTo(px + pw, gpy);
    }
    ctx.stroke();

    // 外框
    ctx.strokeStyle = hexA(c.color, 0.95);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px, py, pw, ph);
  }
}

/** 移动平台（ECS 实体）+ 轨迹线；alpha+prev 为问题 8 渲染插值（表现层，不影响物理） */
export function drawMovers(alpha = 1, prev?: number[]): void {
  let mi = 0;
  for (const e of query(world, [Position, Collider, PathMotion])) {
    const r = colliderWorldRect(e);
    // 问题 8：按上一物理批步前 [x, top] 快照 lerp（模块级复用数组，实体序与快照一致）
    if (prev && alpha < 1 && mi + 1 < prev.length) {
      r.x = prev[mi] + (r.x - prev[mi]) * alpha;
      r.top = prev[mi + 1] + (r.top - prev[mi + 1]) * alpha;
    }
    mi += 2;
    const hu = hue2(r.x + r.w / 2, r.top); // 采样点与静态平台统一

    // 轨迹虚线：统一令牌 + 沿运动方向流动（强化可动感）
    const vertical = PathMotion.axis[e] === 1;
    ctx.setLineDash(T.trailDash);
    ctx.strokeStyle = T.trailColor;
    ctx.lineWidth = 1;
    ctx.lineDashOffset = -(gs.time * T.dashFlow) * (vertical ? Math.sign(PathMotion.dy[e] || 1) : Math.sign(PathMotion.dx[e] || 1));
    ctx.beginPath();
    if (vertical) {
      ctx.moveTo(sx(r.x + r.w / 2), sy(PathMotion.y0[e]));
      ctx.lineTo(sx(r.x + r.w / 2), sy(PathMotion.y0[e] + PathMotion.yRange[e]));
    } else {
      ctx.moveTo(sx(PathMotion.x0[e]), sy(r.y + r.h / 2));
      ctx.lineTo(sx(PathMotion.x0[e] + PathMotion.range[e] + r.w), sy(r.y + r.h / 2));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    // 本体：同一套 neonBox，仅底色/光晕换可动档
    neonBox(sx(r.x), sy(r.top), r.w * view.SZ, r.h * view.SZ, hu, {
      glow: T.glowMovable,
      body: T.bodyMovable,
    });
  }
}

/** 弹簧平台（ECS 实体） */
export function drawSpringPads(): void {
  for (const e of query(world, [Position, Collider, SpringPad])) {
    const r = colliderWorldRect(e);

    const px = sx(r.x);
    if (px < -60 || px > VW + 60) continue;
    const w = r.w * view.SZ;
    const restH = r.h * view.SZ;
    const isWall = r.w < r.h; // 细长竖放 → 墙壁弹簧（横向绘制）

    // 压缩动画（通用）
    let scale = 1;
    if (SpringPad.animTimer[e] > 0) {
      const u = Math.min(1, SpringPad.animTimer[e] / SpringPad.duration[e]);
      scale = 0.55 + 0.45 * Math.pow(1 - u, 0.7);
    }
    const py = sy(r.top); // 顶/右端屏幕 y
    const h = r.h * view.SZ;

    if (isWall) {
      // ═══════════════ 墙壁弹簧（横向线圈）═══════════════
      const barW = Math.max(4, w * 0.35);
      const faceX = px + w * scale - barW * 0.5; // 右端顶板（可左右移动）
      const backX = px;                           // 左端底座（固定）

      // ① 待机呼吸（在顶板位置）
      if (!SpringPad.firing[e]) {
        const breath = 0.07 + 0.05 * Math.sin(gs.time * T.breathSpeed + r.x * 0.6);
        ctx.fillStyle = `hsla(${HUE_SPRING},100%,70%,${breath.toFixed(3)})`;
        ctx.fillRect(faceX - 3, py - 3, barW + 6, h + 6);
      }

      // ② 底座（左端竖条）
      ctx.fillStyle = T.bodySoft;
      ctx.fillRect(backX, py, barW, h);
      ctx.strokeStyle = `hsla(${HUE_SPRING},80%,60%,.6)`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(backX, py, barW, h);

      // ③ 横向线圈
      const coilLeft = backX + barW;
      const coilRight = faceX + barW * 0.5;
      ctx.strokeStyle = `hsla(${HUE_SPRING},100%,62%,.85)`;
      ctx.lineWidth = 2.2;
      ctx.shadowColor = `hsla(${HUE_SPRING},100%,55%,.7)`;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const cx = coilLeft + (coilRight - coilLeft) * t;
        const cy = py + h * (i % 2 === 0 ? 0.15 : 0.85);
        if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // ④ 顶板（右端竖条，模拟 neonBox 语法）
      ctx.fillStyle = 'rgba(14,32,24,.95)';
      ctx.fillRect(faceX, py, barW, h);
      ctx.shadowColor = `hsla(${HUE_SPRING},100%,60%,.85)`;
      ctx.shadowBlur = SpringPad.firing[e] ? T.glowFiring : T.glowMovable;
      ctx.strokeStyle = `hsla(${HUE_SPRING},95%,66%,.9)`;
      ctx.lineWidth = T.strokeW;
      ctx.strokeRect(faceX, py, barW, h);
      ctx.shadowBlur = 0;
      // 右侧高光（对应顶光语法）
      ctx.fillStyle = `hsla(${HUE_SPRING},100%,78%,.95)`;
      ctx.fillRect(faceX + barW - T.topBarH, py, T.topBarH, h);

      // ⑤ 弹射脉冲
      if (SpringPad.firing[e]) {
        const pulse = 0.15 + 0.12 * Math.sin(gs.time * 24);
        ctx.fillStyle = `hsla(${HUE_SPRING},100%,75%,${pulse.toFixed(3)})`;
        ctx.fillRect(faceX - 4, py - 4, barW + 8, h + 8);
      }
    } else {
      // ═══════════════ 普通垂直弹簧 ═══════════════
      const topY = sy(r.y + r.h * scale);
      const baseY = sy(r.y);
      const barH = Math.max(4, restH * 0.15);

      // ① 待机呼吸光环
      if (!SpringPad.firing[e]) {
        const breath = 0.07 + 0.05 * Math.sin(gs.time * T.breathSpeed + r.x * 0.6);
        ctx.fillStyle = `hsla(${HUE_SPRING},100%,70%,${breath.toFixed(3)})`;
        ctx.fillRect(px - 3, topY - 3, w + 6, barH + 6);
      }

      // ② 底座
      ctx.fillStyle = T.bodySoft;
      ctx.fillRect(px, baseY - barH * 0.5, w, barH);
      ctx.strokeStyle = `hsla(${HUE_SPRING},80%,60%,.6)`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px, baseY - barH * 0.5, w, barH);

      // ③ 纵向线圈
      const coilTop = topY + barH * 0.5;
      ctx.strokeStyle = `hsla(${HUE_SPRING},100%,62%,.85)`;
      ctx.lineWidth = 2.2;
      ctx.shadowColor = `hsla(${HUE_SPRING},100%,55%,.7)`;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const cy = baseY - (baseY - coilTop) * t;
        const cx = px + w * (i % 2 === 0 ? 0.22 : 0.78);
        if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // ④ 顶板：neonBox 语法
      neonBox(px, topY, w, barH, HUE_SPRING, {
        glow: SpringPad.firing[e] ? T.glowFiring : T.glowMovable,
        body: 'rgba(14,32,24,.95)',
      });

      // ⑤ 弹射脉冲
      if (SpringPad.firing[e]) {
        const pulse = 0.15 + 0.12 * Math.sin(gs.time * 24);
        ctx.fillStyle = `hsla(${HUE_SPRING},100%,75%,${pulse.toFixed(3)})`;
        ctx.fillRect(px - 4, topY - 4, w + 8, barH + 8);
      }
    }
  }
}