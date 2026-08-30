/**
 * systems/enemy —— 敌人系统 barrel（S3）。
 * EnemyController：生成 / 步进（FSM + 轻量物理）。
 * death：敌人死亡表现 + 广播（房主判定入口 killEnemy）。
 * 接触伤害（敌人 → 玩家）走 collisionBus，接线在 systems/interactions/CollisionHooks（enemy 分支）。
 */
export { spawnEnemy, stepEnemies } from './EnemyController';
export type { EnemySpawnData } from './EnemyController';
export { killEnemy } from './death';
export { spawnLevelEnemies } from './spawn';