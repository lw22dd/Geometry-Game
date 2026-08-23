/**
 * 玩家预制体 —— PLAYER 绘制委托实现。
 * 纯绘制，不包含游戏逻辑；外观由 characters/ 角色样式驱动。
 */
import { ctx } from '../../core/canvas';
import { sx, sy, view } from '../../core/camera';
import { clamp } from '../../core/math';
import { P } from '../../systems/player';
import { gs } from '../../systems/game/state';
import { DEFAULT_CHARACTER, type CharacterStyle } from './characters';

export { CHARACTERS, DEFAULT_CHARACTER } from './characters';
export type { CharacterStyle } from './characters';

/** 绘制玩家角色（默认霓虹跑者，可传其他角色样式） */
export function drawPlayer(style: CharacterStyle = DEFAULT_CHARACTER): void {
  if (P.dead) return;
  // 受伤无敌闪烁
  if (P.inv > 0 && Math.floor(gs.time * 14) % 2 === 0) return;

  const px = sx(P.x), py = sy(P.y), sq = P.squash;
  let kx = 1 + sq, ky = 1 - sq;
  // 空中拉伸 / 落地压扁
  if (!P.grounded) {
    const e = clamp(Math.abs(P.vy) * 0.012, 0, 0.2);
    ky *= 1 + e * 0.5;
    kx *= 1 - e * 0.4;
  }

  ctx.save();
  ctx.translate(px, py);
  ctx.scale(kx, ky);

  const r = style.radius * view.SZ;

  // 身体
  ctx.shadowColor = style.glow;
  ctx.shadowBlur = 18;
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.15, 0, 0, r);
  g.addColorStop(0, style.bodyGrad[0]);
  g.addColorStop(0.55, style.bodyGrad[1]);
  g.addColorStop(1, style.bodyGrad[2]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, 6.283);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 双眼（眨眼）
  const blink = (gs.time % 3.4) > 3.25;
  const ew = r * 0.17, eh = blink ? 2 : r * 0.36;
  ctx.fillStyle = style.eyeColor;
  ctx.fillRect(P.face * r * style.eyeDX[0] - ew / 2, -r * 0.3, ew, eh);
  ctx.fillRect(P.face * r * style.eyeDX[1] - ew / 2, -r * 0.3, ew, eh);

  ctx.restore();
}