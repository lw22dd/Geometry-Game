/**
 * Prefabs/Scenes —— 场景道具预制体 barrel 导出。
 * 绘制函数由 `systems/game` 直接引用；实体工厂 sceneFactory 与绘制同目录（问题 6 合并）。
 */
export { drawSolids, drawFloor, drawMovers, drawSpringPads, drawBorder, drawDecos, drawGrid } from './platforms';
export { drawSpikes, drawLasers } from './hazards';
export { drawOrbs, drawJumpBoosts, drawHookPickups, drawShieldPickups, drawSpeedPickups, drawCheckpoints, drawNOVA, emitItemAmbient } from './items';
export { drawMagnets } from './magnet';
export { drawParallax, drawTrail, drawParticles, drawHints, drawMotes, stepMotes, drawFog } from './atmosphere';
export { drawTracks, neonGlassTube } from './tracks';