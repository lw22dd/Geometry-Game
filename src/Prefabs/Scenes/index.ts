/**
 * Prefabs/Scenes —— 场景道具预制体 barrel 导出。
 * 绘制函数由 `systems/game` 直接引用；实体工厂由 `config/level` 初始化调用。
 */
export { drawSolids, drawMovers, drawSpringPads, drawBorder, drawDecos, drawGrid } from './platforms';
export { drawSpikes, drawLasers } from './hazards';
export { drawOrbs, drawJumpBoosts, drawHookPickups, drawCheckpoints, drawNOVA } from './items';
export { drawParallax, drawTrail, drawParticles, drawHints } from './atmosphere';
export { drawTracks, neonGlassTube } from './tracks';

// 场景实体工厂（ECS 装配，由 config/level 的 initECSFromLevel 调用）
export { createCheckpoint } from './checkpointEntity';
export { createJumpBoost } from './jumpBoostEntity';
export { createLaser } from './laserEntity';
export { createLoopTrack } from './loopTrackEntity';
export { createMovingPlatform } from './movingPlatformEntity';
export { createNova } from './novaEntity';
export { createOrb } from './orbEntity';
export { createSpike } from './spikeEntity';
export { createSpringPad } from './springPadEntity';
export { createHookPickup } from './hookPickupEntity';