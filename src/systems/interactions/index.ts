/**
 * systems/interactions —— 玩法交互触发系统 barrel。
 *
 * 本地玩家的碰撞交互已事件化（CollisionHooks 订阅 collisionBus）。
 * 远程玩家（host 模拟）同样走碰撞路由（setCollisionSim → CollisionSystem → CollisionHooks），
 * ItemPickupSystem 坐标版检测链已删除（无调用点），仅保留 orbCount 计数。
 */
export { initCollisionHooks, resetCollisionHooks, tryInteractCheckpoint, setCollisionSim } from './CollisionHooks';
export { orbCount } from './ItemPickupSystem';
export { updateRespawnPointSystem } from './RespawnPointSystem';
export { checkHazardOverlap } from './hazard';
export { updateCipherSystem, resetCipherSpark, cipherCount, cipherDoneCount } from './CipherSystem';
export { stepChests, updateChestSystem, resetChestState } from './ChestSystem';