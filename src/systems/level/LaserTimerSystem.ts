/**
 * 激光计时系统 —— 更新所有 Timer 组件的 on 状态。
 * 周期公式：on = ((time + ph) % period) < onDur（与旧 laserOn 一致）。
 */
import { world } from '../../core/ecs';
import { Timer } from '../../components/Timer';
import { gs } from '../game/gameState';

export function updateLaserTimer(): void {
  for (const e of world.query(Timer)) {
    const t = world.get<Timer>(e, Timer);
    t.on = ((gs.time + t.ph) % t.period) < t.onDur;
  }
}