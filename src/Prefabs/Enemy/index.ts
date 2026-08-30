/**
 * Prefabs/Enemy —— 敌人预制体 barrel。
 * 提供敌人种类注册表（ENEMY_KINDS / getEnemyKind）与纯绘制（drawEnemy / drawEnemies）。
 * system 只通过本模块的 API 与敌人体系交互，不直接 import 具体实现。
 */
export { ENEMY_KINDS, getEnemyKind, drawEnemy } from './kinds';
export type { EnemyKindDef, WalkerState } from './kinds';
export { drawEnemies } from './drawEnemies';