/**
 * 场景预制体 —— 平台（长方形）建模。
 * 静态平台 / 移动平台（ECS）/ 地图边框 / 装饰方块 / 网格线。
 * 所有绘制归一到 theme.ts 的 neonBox 原语 + 令牌。
 */
import { ctx, VW, VH } from '../../core/canvas';
import { sx, sy, view } from '../../core/camera';
import { clamp } from '../../core/math';
import { currentMap } from '../../config';
import { gs } from '../../systems/game/gameState';
import { world } from '../../core/ecs';
import { Position } from '../../components/physics/Position';
import { Collider } from '../../components/physics/Collider';
import { PathMotion } from '../../components/physics/PathMotion';
import { SpringPad } from '../../components/physics/SpringPad';
import { colliderWorldRect } from '../../systems/level';
import { T, neonBox } from './theme';

/** 功能色：绿 = 弹射/加速 */
const HUE_SPRING = 145;

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
    neonBox(
      sx(r.x), sy(r.top), r.w * view.SZ, r.h * view.SZ,
      hue2(r.x + r.w / 2, r.top),
    );
  }
}

/** 移动平台（ECS 实体）+ 轨迹线 */
export function drawMovers(): void {
  for (const e of world.query(Position, Collider, PathMotion)) {
    const pos = world.get<Position>(e, Position);
    const col = world.get<Collider>(e, Collider);
    const pm = world.get<PathMotion>(e, PathMotion);
    const r = colliderWorldRect(pos, col);
    const hu = hue2(r.x + r.w / 2, r.top); // 采样点与静态平台统一

    // 轨迹虚线：统一令牌 + 沿运动方向流动（强化可动感）
    const vertical = pm.axis === 'y';
    ctx.setLineDash(T.trailDash);
    ctx.strokeStyle = T.trailColor;
    ctx.lineWidth = 1;
    ctx.lineDashOffset = -(gs.time * T.dashFlow) * (vertical ? Math.sign(pm.dy || 1) : Math.sign(pm.dx || 1));
    ctx.beginPath();
    if (vertical) {
      ctx.moveTo(sx(r.x + r.w / 2), sy(pm.y0));
      ctx.lineTo(sx(r.x + r.w / 2), sy(pm.y0 + pm.yRange));
    } else {
      ctx.moveTo(sx(pm.x0), sy(r.y + r.h / 2));
      ctx.lineTo(sx(pm.x0 + pm.range + r.w), sy(r.y + r.h / 2));
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

/** 弹簧平台（ECS 实体：Position + Collider + SpringPad） */
export function drawSpringPads(): void {
  for (const e of world.query(Position, Collider, SpringPad)) {
    const pos = world.get<Position>(e, Position);
    const col = world.get<Collider>(e, Collider);
    const spring = world.get<SpringPad>(e, SpringPad);
    const r = colliderWorldRect(pos, col);

    const px = sx(r.x);
    if (px < -60 || px > VW + 60) continue;
    const w = r.w * view.SZ;
    const restH = r.h * view.SZ;
    const isWall = r.w < r.h; // 细长竖放 → 墙壁弹簧（横向绘制）

    // 压缩动画（通用）
    let scale = 1;
    if (spring.animTimer > 0) {
      const u = Math.min(1, spring.animTimer / spring.duration);
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
      if (!spring.firing) {
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
      ctx.shadowBlur = spring.firing ? T.glowFiring : T.glowMovable;
      ctx.strokeStyle = `hsla(${HUE_SPRING},95%,66%,.9)`;
      ctx.lineWidth = T.strokeW;
      ctx.strokeRect(faceX, py, barW, h);
      ctx.shadowBlur = 0;
      // 右侧高光（对应顶光语法）
      ctx.fillStyle = `hsla(${HUE_SPRING},100%,78%,.95)`;
      ctx.fillRect(faceX + barW - T.topBarH, py, T.topBarH, h);

      // ⑤ 弹射脉冲
      if (spring.firing) {
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
      if (!spring.firing) {
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
        glow: spring.firing ? T.glowFiring : T.glowMovable,
        body: 'rgba(14,32,24,.95)',
      });

      // ⑤ 弹射脉冲
      if (spring.firing) {
        const pulse = 0.15 + 0.12 * Math.sin(gs.time * 24);
        ctx.fillStyle = `hsla(${HUE_SPRING},100%,75%,${pulse.toFixed(3)})`;
        ctx.fillRect(px - 4, topY - 4, w + 8, barH + 8);
      }
    }
  }
}