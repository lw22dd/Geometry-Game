/**
 * 批量绘制全部敌人（渲染帧调用）。
 * 反射读 ECS：qEnemies = [Position, Collider, Health, EnemyBrain]，每个读 kind + AoS 状态。
 */
import { qEnemies, EnemyBrain } from '../../core/ecs';
import type { EnemyKind } from '../../types';
import { drawEnemy } from './kinds';

/** 绘制全部敌人（每帧一次） */
export function drawEnemies(): void {
  for (const e of qEnemies()) {
    const brain = EnemyBrain[e];
    if (!brain) continue;
    drawEnemy(e, brain.kind as EnemyKind, brain.state);
  }
}