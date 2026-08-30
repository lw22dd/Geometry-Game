/**
 * 关卡敌人生成（S3）—— 从地图数据的敌人出生点批量生成。
 * 由 game 层 applyLevel 调用（房主/单机进程生成；客机为接收事件的木偶，不本地生成）。
 * 数据源：MapDefinition.entitySpawners.enemies（config/level 的 maps 表）。
 */
import type { EnemySpawnData } from './EnemyController';
import { spawnEnemy } from './EnemyController';

/** 批量生成一关的敌人（接受出生点数组，数据从地图读取） */
export function spawnLevelEnemies(list: EnemySpawnData[]): void {
  for (const d of list) spawnEnemy(d.kind, d.x, d.y);
}