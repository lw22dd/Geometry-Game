/**
 * 世界绘制注册表 —— 场景预制体绘制委托。
 * 实际建模位于 `Prefabs/Scenes/`（含 platforms / hazards / items / atmosphere）。
 * 本文件仅作转发：让 systems 层通过稳定的 defs 入口取绘制委托。
 */
export { drawSolids, drawMovers, drawBorder, drawDecos, drawGrid } from '../../Prefabs/Scenes/platforms';
export { drawSpikes, drawLasers } from '../../Prefabs/Scenes/hazards';
export { drawOrbs, drawCheckpoints, drawNOVA } from '../../Prefabs/Scenes/items';
export { drawParallax, drawTrail, drawParticles, drawHints } from '../../Prefabs/Scenes/atmosphere';