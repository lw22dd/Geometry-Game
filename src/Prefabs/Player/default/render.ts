/**
 * 默认角色绘制 —— 纯 Canvas 渲染，只读 AnimOutput 参数与角色样式。
 * 不包含任何动画逻辑（状态机、边沿检测、形变计算）。
 */
import { ctx } from '../../../core/canvas';
import { sx, sy, view } from '../../../core/camera';
import { gs } from '../../../systems/game/state';
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

  // 双眼（眨眼）
  const blink = (gs.time % 3.4) > 3.25;
  const ew = r * 0.17;
  const eh = blink ? 2 : r * 0.36;
  ctx.fillStyle = style.eyeColor;
  ctx.fillRect(player.face * r * style.eyeDX[0] - ew / 2, -r * 0.3, ew, eh);
  ctx.fillRect(player.face * r * style.eyeDX[1] - ew / 2, -r * 0.3, ew, eh);

  ctx.restore();
}