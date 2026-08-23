/**
 * Prefabs/Scenes —— 场景道具预制体 barrel 导出。
 * `systems/world/defs.ts` 为本目录的薄委托，调用方通过 defs 引用。
 */
export { drawSolids, drawMovers, drawBorder, drawDecos, drawGrid } from './platforms';
export { drawSpikes, drawLasers } from './hazards';
export { drawOrbs, drawCheckpoints, drawNOVA } from './items';
export { drawParallax, drawTrail, drawParticles, drawHints } from './atmosphere';