/**
 * systems/interactions —— 玩法交互触发系统 barrel。
 * 光球收集 / 检查点激活 / 终点登顶（均可被本地与远程玩家检测复用）。
 */
export { updateCollectSystem } from './CollectSystem';
export { updateRespawnPointSystem } from './RespawnPointSystem';
export { updateGoalSystem } from './GoalSystem';
