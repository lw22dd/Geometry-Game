/**
 * Prefabs/Scenes —— 场景道具预制体 barrel 导出。
 * 绘制函数由 `systems/game` 直接引用；实体工厂统一走 `Prefabs/Scene/sceneFactory`
 * （由 `config/level` 初始化调用）。
 */
export { drawSolids, drawFloor, drawMovers, drawSpringPads, drawBorder, drawDecos, drawGrid } from './platforms';
export { drawSpikes, drawLasers } from './hazards';
export { drawOrbs, drawJumpBoosts, drawHookPickups, drawCheckpoints, drawNOVA } from './items';
export { drawParallax, drawTrail, drawParticles, drawHints } from './atmosphere';
export { drawTracks, neonGlassTube } from './tracks';