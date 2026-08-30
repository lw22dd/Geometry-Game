/**
 * effects —— 契约层 barrel。
 * 影响来源 → PlayerRequest → applyEffect（结算）→ verbs（写入玩家状态）。
 */
export { applyEffect, SHIELD_BLOCK_INV } from './effects';
export type { PlayerRequest, EffectContext } from './effects';
export {
  grantImpulse, consumeImpulses, decayImpulses, grantJumpCharges, grantInv, killState,
  damageState, applyModifier, removeModifier, recomputeStats, stepBuffTimers,
} from './verbs';
