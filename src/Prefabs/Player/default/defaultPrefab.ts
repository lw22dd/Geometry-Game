import { ctx } from '../../../core/canvas';
import { sx, sy, view } from '../../../core/camera';
import { gs } from '../../../systems/game/state';
import type { PlayerState } from '../../../types';
import type { CharacterStyle } from '../characters/default';
import {
  createDefaultAnimationState,
  getDefaultScale,
  stepDefaultAnimation,
  type DefaultAnimationState,
} from './animation';

const animationStates = new WeakMap<object, DefaultAnimationState>();

function animationStateFor(player: object): DefaultAnimationState {
  let state = animationStates.get(player);
  if (!state) {
    state = createDefaultAnimationState();
    animationStates.set(player, state);
  }
  return state;
}

/** Advance animation state owned by the default player prefab. */
export function stepDefaultPlayerAnimation(player: PlayerState, dt: number): void {
  const state = animationStateFor(player);
  stepDefaultAnimation(state, player, dt);
  player.squash = state.squash;
}

/** Draw the default round player using its own animation state. */
export function drawDefaultPlayer(
  player: PlayerState,
  style: CharacterStyle,
): void {
  const state = animationStateFor(player);
  if (player.dead) return;
  if (player.inv > 0 && Math.floor(gs.time * 14) % 2 === 0) return;

  const px = sx(player.x);
  const py = sy(player.y);
  const scale = getDefaultScale(state, player);

  ctx.save();
  ctx.translate(px, py);
  ctx.scale(scale.x, scale.y);

  const r = style.radius * view.SZ;
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

  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const blink = (gs.time % 3.4) > 3.25;
  const ew = r * 0.17;
  const eh = blink ? 2 : r * 0.36;
  ctx.fillStyle = style.eyeColor;
  ctx.fillRect(player.face * r * style.eyeDX[0] - ew / 2, -r * 0.3, ew, eh);
  ctx.fillRect(player.face * r * style.eyeDX[1] - ew / 2, -r * 0.3, ew, eh);
  ctx.restore();
}
