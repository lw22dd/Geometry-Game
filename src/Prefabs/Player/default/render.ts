/**
 * 默认角色绘制 —— 纯 Canvas 渲染，只读 AnimOutput 参数与角色样式。
 * 不包含任何动画逻辑（状态机、边沿检测、形变计算）。
 */
import { ctx } from '../../../core/canvas';
import { sx, sy, view } from '../../../core/camera';
import { gs } from '../../../systems/game/gameState';
import type { AnimOutput, PlayerState } from '../../../types';
import type { CharacterStyle } from '../characters';

/** 绘制默认角色（发光圆球 + 双眼 + 眨眼 + 受击无敌闪烁） */
export function renderDefaultPlayer(
  player: PlayerState,
  output: AnimOutput,
  style: CharacterStyle,
): void {
  if (output.alpha <= 0 || player.dead) return;
  // 受击无敌反馈（护盾格挡 / 复活 / 受伤后 inv>0，全程 1.2s）：
  //   · 刚进入无敌（剩余 >0.7s，约前 0.5s）→ 明显的半透明受击闪烁，
  //     让玩家明确感知「护盾破环 / 被击中」；
  //   · 无敌后半段 → 柔和微光，避免长时间频闪（再长的无敌也不该刷屏）。
  // 半透明硬切而非整帧消失：既不丢建模可见性，又保留经典受击反馈。
  let invAlpha = 1;
  if (player.inv > 0) {
    if (player.inv > 0.7) {
      invAlpha = Math.floor(gs.time * 14) % 2 === 0 ? 0.4 : 1;
    } else {
      invAlpha = 0.88 + 0.12 * Math.sin(gs.time * 6);
    }
  }

  const px = sx(player.x);
  const py = sy(player.y);

  // 形变（squash & stretch）：垂直速度越大越"抽长"，横向相应收窄。
  // 纯表现层——叠加在 AnimOutput 的 scale 之上，不改动动画契约（land 压缩仍由 FSM 负责）。
  const stretch = player.grounded ? 0 : Math.min(0.3, Math.abs(player.velocity.y) / 60);

  ctx.save();
  ctx.translate(px + output.offsetX * view.SZ, py + output.offsetY * view.SZ);
  ctx.scale(output.scaleX * (1 - stretch * 0.55), output.scaleY * (1 + stretch));
  ctx.rotate(output.rotation);
  ctx.globalAlpha = output.alpha * invAlpha;

  const r = style.radius * view.SZ;

  // 身体发光
  ctx.shadowColor = style.glow;
  ctx.shadowBlur = 18;
  const gradient = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.15, 0, 0, r);
  gradient.addColorStop(0, style.bodyGrad[0]);
  gradient.addColorStop(0.55, style.bodyGrad[1]);
  gradient.addColorStop(1, style.bodyGrad[2]);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, 6.283);
  ctx.fill();
  ctx.shadowBlur = 0;

  // 外描边
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 边缘光：沿运动反方向的月牙高光（立体感 + 速度感，速度越快越亮）
  const spd = Math.hypot(player.velocity.x, player.velocity.y);
  if (spd > 1.5) {
    // 屏幕坐标 Y 轴向下，故速度取反后再求角度
    const ang = Math.atan2(-player.velocity.y, -player.velocity.x);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = output.alpha * Math.min(0.5, 0.14 + spd * 0.012);
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.shadowColor = style.glow;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.93, ang - 1.0, ang + 1.0);
    ctx.stroke();
    ctx.restore();
  }

  // 护盾光罩（限时护盾：蓝紫脉冲光罩，外扩到 1.5r，与受伤无敌闪烁区分）
  if (player.shields > 0) {
    const pulse = 0.5 + 0.5 * Math.sin(gs.time * 5);
    // ① 外层光晕（lighter 叠加，强化存在感）
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (0.22 + 0.12 * pulse) * output.alpha;
    const g = ctx.createRadialGradient(0, 0, r * 1.1, 0, 0, r * 2.0);
    g.addColorStop(0, 'rgba(150,140,255,.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.0, 0, 6.283);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // ② 主光罩环（呼吸 + 强发光）
    ctx.globalAlpha = (0.75 + 0.25 * pulse) * output.alpha;
    ctx.strokeStyle = 'rgba(170,160,255,.95)';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(150,140,255,1)';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.5, 0, 6.283);
    ctx.stroke();
    // ③ 内层细环（层次感）
    ctx.globalAlpha = (0.35 + 0.2 * pulse) * output.alpha;
    ctx.strokeStyle = 'rgba(200,200,255,.9)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.32, 0, 6.283);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = output.alpha;
  }

  // 加速光效（限时加速：青色脉冲光罩 + 尾部 》》速线，外扩到 1.5r，速度感）
  if (player.speedMult > 1) {
    const pulse = 0.5 + 0.5 * Math.sin(gs.time * 9);
    // ① 外层光晕（lighter 叠加，强化存在感）
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (0.2 + 0.12 * pulse) * output.alpha;
    const g2 = ctx.createRadialGradient(0, 0, r * 1.1, 0, 0, r * 2.0);
    g2.addColorStop(0, 'rgba(90,225,255,.5)');
    g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.0, 0, 6.283);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // ② 主光环（高速旋转感：虚线环呼吸）
    ctx.globalAlpha = (0.7 + 0.3 * pulse) * output.alpha;
    ctx.strokeStyle = 'rgba(90,225,255,.95)';
    ctx.lineWidth = 2.6;
    ctx.shadowColor = 'rgba(90,225,255,1)';
    ctx.shadowBlur = 18;
    ctx.setLineDash([7 * view.SZ, 5 * view.SZ]);
    ctx.lineDashOffset = -gs.time * 40;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.5, 0, 6.283);
    ctx.stroke();
    ctx.setLineDash([]);
    // ③ 尾部 》》速线（面朝反方向拖尾，速度感）
    ctx.globalAlpha = (0.85 + 0.15 * pulse) * output.alpha;
    ctx.strokeStyle = '#5ae1ff';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const tx = -player.face * r * 1.35;
    for (const off of [-1, 1]) {
      const ox = tx - player.face * off * r * 0.22;
      ctx.beginPath();
      ctx.moveTo(ox, off * r * 0.42);
      ctx.lineTo(ox - player.face * r * 0.6, 0);
      ctx.lineTo(ox, -off * r * 0.42);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = output.alpha;
  }

  // 双眼（眨眼）
  const blink = (gs.time % 3.4) > 3.25;
  const ew = r * 0.17;
  const eh = blink ? 2 : r * 0.36;
  ctx.fillStyle = style.eyeColor;
  ctx.fillRect(player.face * r * style.eyeDX[0] - ew / 2, -r * 0.3, ew, eh);
  ctx.fillRect(player.face * r * style.eyeDX[1] - ew / 2, -r * 0.3, ew, eh);

  ctx.restore();
}