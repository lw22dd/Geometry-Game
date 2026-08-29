/**
 * 场景预制体 —— 磁铁道具建模（组件驱动，同 drawOrbs/drawHookPickups 写法）。
 * 数据从新 ECS 查询（Position + Collider + Collectible + Renderable + Animator + MagnetPickup）。
 * 拾取逻辑不经此处：碰撞路由 → CollisionHooks 的 PICKUP_RULES 表驱动。
 */
import { ctx, VW } from '../../core/canvas';
import { sx, sy, view } from '../../core/camera';
import { Position, Collider, Collectible, Renderable, Animator, MagnetPickup } from '../../core/ecs';
import { colliderWorldRect } from '../../systems/level';
import { T } from './theme';
import { getAnimOutput } from '../Animations';
import { query } from 'bitecs';
import { world } from '../../core/ecs';

/** 磁铁道具（红粉马蹄磁铁：横杆 + 两垂直极柱 + 红端帽） */
export function drawMagnets(): void {
  for (const e of query(world, [Position, Collider, Collectible, Renderable, Animator, MagnetPickup])) {
    if (Collectible.collected[e] === 1) continue;
    const out = getAnimOutput(e);
    const r = colliderWorldRect(e);
    const cx = sx(r.x + r.w / 2);
    const cy = sy(r.top + r.h / 2 + out.offsetY);
    const R = Renderable.radius[e] * view.SZ;

    // ① 红粉泛光圈（外发光层）
    ctx.globalAlpha = out.alpha;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 2.4);
    g.addColorStop(0, 'rgba(255,110,140,.30)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R * 2.4, 0, 6.283); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // ② 马蹄磁铁（横杆 + 两垂直极柱 + 白色极柱 + 红端帽）
    ctx.save();
    ctx.translate(cx, cy + R * 0.15);
    ctx.rotate(out.rotation);
    ctx.shadowColor = 'rgba(255,110,140,.9)';
    ctx.shadowBlur = T.glowMovable;
    ctx.lineCap = 'round';
    const barX = R * 0.62;
    const barY = -R * 0.68;
    const legLen = R * 1.35;
    // 横杆
    ctx.strokeStyle = '#ff6a85';
    ctx.lineWidth = R * 0.46;
    ctx.beginPath();
    ctx.moveTo(-barX, barY);
    ctx.lineTo(barX, barY);
    ctx.stroke();
    // 左极柱
    ctx.beginPath();
    ctx.moveTo(-barX, barY);
    ctx.lineTo(-barX, barY + legLen);
    ctx.stroke();
    // 右极柱
    ctx.beginPath();
    ctx.moveTo(barX, barY);
    ctx.lineTo(barX, barY + legLen);
    ctx.stroke();
    // 极柱顶端的白色亮条（磁极）
    ctx.strokeStyle = '#ffd9e0';
    ctx.lineWidth = R * 0.2;
    ctx.beginPath();
    ctx.moveTo(-barX, barY + legLen);
    ctx.lineTo(-barX, barY + legLen - R * 0.22);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(barX, barY + legLen);
    ctx.lineTo(barX, barY + legLen - R * 0.22);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}