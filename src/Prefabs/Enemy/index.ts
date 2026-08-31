/**
 * Prefabs/Enemy —— 敌人预制体 barrel。
 * 每个敌人种类 = 一个模块（walkers / creeper / gorilla），自含「配置 + 纯绘制 + 专属行为（step）」。
 * system/systems/enemy 只通过本模块的 API 与敌人体系交互：
 *   - ENEMY_KINDS / getEnemyKind：种类数据查询
 *   - createEnemyState / stepEnemyBehavior / drawEnemy：行为与表现分派
 *   - drawEnemies / drawEnemyRocks / stepGorillaRocks / clearGorillaRocks：批处理转发
 *
 * 结构：
 *   types.ts      共享契约（EnemyBaseDef + 判别联合 + 判别状态 + StepInput/StepResult + DrawView）
 *   combat.ts     敌人 → 玩家 共享伤害结算（damagePlayerFromEnemy / panOfX）
 *   kinds.ts      ENEMY_KINDS 注册表 + getEnemyKind + create/step/draw 三大分派
 *   walker.ts     行走兵：纯绘制 + createWalkerState + stepWalker
 *   creeper.ts    苦力怕：纯绘制 + createCreeperState + stepCreeper（引爆/自爆）
 *   gorilla.ts    大猩猩：纯绘制 + createGorillaState + stepGorilla（近战/投石）+ 石头弹道
 *   drawEnemies.ts 批量绘制
 */
export {
  ENEMY_KINDS, getEnemyKind, createEnemyState, stepEnemyBehavior, drawEnemy,
} from './kinds';
export { drawEnemyRock, stepGorillaRocks, clearGorillaRocks } from './gorilla';
export type {
  EnemyBaseDef, WalkerDef, CreeperDef, GorillaDef, EnemyKindDef,
  CreeperFuseDef, GorillaMeleeDef, GorillaRockDef,
  SlowState, CreeperFuseState, GorillaAttackState,
  EnemySharedState, WalkerState, CreeperState, GorillaState, EnemyState,
  StepInput, StepResult, DrawView,
} from './types';
export { drawEnemies, drawEnemyRocks } from './drawEnemies';