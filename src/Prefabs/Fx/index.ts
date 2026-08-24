/**
 * Prefabs/Fx —— 特效预制体数据层 barrel。
 * 本层只提供特效"长什么样"的纯数据模板（FX 表）；
 * 粒子实例的生命周期（生成/步进/回收）由 systems/particles 的 spawnParticles 负责。
 */
export { FX } from './presets';
export type { FxPreset, FxVel } from './presets';