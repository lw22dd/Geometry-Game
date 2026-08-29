/**
 * 默认角色绘制 —— 纯 Canvas 渲染，只读 AnimOutput 参数与角色样式。
 * 不包含任何动画逻辑（状态机、边沿检测、形变计算）。
 */
import { ctx } from '../../../core/canvas';
import { sx, sy, view } from '../../../core/camera';
import { gs } from '../../../systems/game/gameState';
import type { AnimOutput, PlayerState } from '../../../types';
import type { CharacterStyle } from '../characters';

/** 绘制默认角色（发光圆球 + 双眼 + 眨眼 + 受伤闪烁） */
export function renderDefaultPlayer(
  player: PlayerState,
  output: AnimOutput,
  style: CharacterStyle,
): void {
  if (output.alpha <= 0 || player.dead) return;
  // 受伤无敌闪烁
  if (player.inv > 0 && Math.floor(gs.time * 14) % 2 === 0) return;

  const px = sx(player.x);
  const py = sy(player.y);

  ctx.save();
  ctx.translate(px + output.offsetX * view.SZ, py + output.offsetY * view.SZ);
  ctx.scale(output.scaleX, output.scaleY);
  ctx.rotate(output.rotation);
  ctx.globalAlpha = output.alpha;

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