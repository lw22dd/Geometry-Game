/**
 * 激光计时系统 —— 更新所有 Timer 组件的 on 状态。
 * 周期公式：on = ((time + ph) % period) < onDur（与旧 laserOn 一致）。
 * 数据源：新 ECS。
 */
import { qTimers } from '../../core/ecs';
import { Timer } from '../../core/ecs';
import { gs } from '../game/gameState';

export function updateLaserTimer(): void {
  for (const e of qTimers()) {
    Timer.on[e] = ((gs.time + Timer.ph[e]) % Timer.period[e]) < Timer.onDur[e] ? 1 : 0;
  }
}
