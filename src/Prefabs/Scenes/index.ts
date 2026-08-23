/**
 * Prefabs/Scenes —— 场景道具预制体 barrel 导出。
 * `systems/game` 通过本 barrel 直接引用绘制函数。
 */
export { drawSolids, drawMovers, drawBorder, drawDecos, drawGrid } from './platforms';
export { drawSpikes, drawLasers } from './hazards';
export { drawOrbs, drawCheckpoints, drawNOVA } from './items';
export { drawParallax, drawTrail, drawParticles, drawHints } from './atmosphere';