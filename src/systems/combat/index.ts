/**
 * combat —— 战斗系统 barrel。
 * 伤害入口 / 武器（S2）/ 射线（S2）/ 抛体（S2）。
 */
export { dealDamage, stepHealthInv } from './damage';
export type { DamageInfo, DamageTarget, DamageContext, DamageResult } from './damage';
export { raycastWorld, segRectT } from './raycast';
export type { RayHit, RayFace } from './raycast';
export { stepWeapon, stepTracers, drawTracers, spawnShotTracer, spawnShotFeedback } from './weapon';
export type { WeaponStepCtx, Tracer } from './weapon';
export { spawnProjectile, spawnGrenade, stepProjectiles, drawProjectiles, clearProjectiles } from './projectile';