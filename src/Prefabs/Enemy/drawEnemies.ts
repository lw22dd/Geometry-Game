/**
 * 批量绘制全部敌人 + 敌人石头（渲染帧调用）。
 * 反射读 ECS：qEnemies = [Position, Collider, Health, EnemyBrain]，每个读 kind + AoS 状态；
 * 石头 qEnemyRocks = [Position, EnemyRock]，逐颗调用纯绘制。
 */
import { qEnemies, qEnemyRocks, EnemyBrain, Position } from '../../core/ecs';
import type { EnemyKind } from '../../types';
import { drawEnemy } from './kinds';
import { drawEnemyRock } from './gorilla';
import { sx } from '../../core/camera';
import { VW } from '../../core/canvas';

/** 绘制全部敌人（每帧一次） */
export function drawEnemies(): void {
  for (const e of qEnemies()) {
    const brain = EnemyBrain[e];
    if (!brain) continue;
    drawEnemy(e, brain.kind as EnemyKind, brain.state);
  }
}

/** 绘制全部敌人石头（大猩猩投石；在敌人之后、玩家之上绘制） */
export function drawEnemyRocks(): void {
  for (const r of qEnemyRocks()) {
    const px = sx(Position.x[r]);
    if (px < -60 || px > VW + 60) continue;
    drawEnemyRock(r);
  }
}