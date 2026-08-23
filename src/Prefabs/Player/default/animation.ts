import type { PlayerState } from '../../../types';
import { clamp } from '../../../core/math';

export interface DefaultAnimationState {
  squash: number;
  previousGrounded: boolean;
  previousVy: number;
  initialized: boolean;
}

export const createDefaultAnimationState = (): DefaultAnimationState => ({
  squash: 0,
  previousGrounded: false,
  previousVy: 0,
  initialized: false,
});

/** Update shape-specific squash/stretch without adding visual rules to physics. */
export function stepDefaultAnimation(
  state: DefaultAnimationState,
  player: PlayerState,
  dt: number,
): void {
  if (!state.initialized) {
    state.previousGrounded = player.grounded;
    state.previousVy = player.vy;
    state.initialized = true;
  } else {
    if (state.previousGrounded && !player.grounded && player.vy > 0) {
      state.squash = -0.24;
    } else if (!state.previousGrounded && player.grounded && state.previousVy < -7.5) {
      state.squash = Math.min(0.42, -state.previousVy * 0.028);
    }
  }

  state.squash *= Math.exp(-7 * dt);
  state.previousGrounded = player.grounded;
  state.previousVy = player.vy;
}

export function getDefaultScale(
  state: DefaultAnimationState,
  player: PlayerState,
): { x: number; y: number } {
  let x = 1 + state.squash;
  let y = 1 - state.squash;
  if (!player.grounded) {
    const stretch = clamp(Math.abs(player.vy) * 0.012, 0, 0.2);
    y *= 1 + stretch * 0.5;
    x *= 1 - stretch * 0.4;
  }
  return { x, y };
}
