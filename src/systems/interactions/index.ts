/**
 * systems/interactions —— 玩法交互触发系统 barrel。
 *
 * 本地玩家的碰撞交互已事件化（CollisionHooks 订阅 collisionBus）。
 * 远程玩家（host 模拟，无 ECS 实体）仍使用坐标版交互系统：
 *   updateCollectSystem(tx, ty) / updateRespawnPointSystem(tx, ty) / updateGoalSystem()
 */
export { initCollisionHooks, resetCollisionHooks } from './CollisionHooks';
export { updateCollectSystem } from './CollectSystem';
export { updateRespawnPointSystem } from './RespawnPointSystem';
export { updateGoalSystem } from './GoalSystem';