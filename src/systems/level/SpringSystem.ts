/**
 * 弹簧平台系统 —— 更新所有 SpringPad 组件的冷却与动画计时。
 * animTimer > 0 时弹簧处于压缩/弹起动画中（与玩家加速时长同步）。
 * 数据源：新 ECS。
 */
import { qSpringAll } from '../../core/ecs';
import { SpringPad } from '../../core/ecs';

export function updateSpringPads(dt: number): void {
  for (const e of qSpringAll()) {
    if (SpringPad.cooldown[e] > 0) {
      SpringPad.cooldown[e] -= dt;
      if (SpringPad.cooldown[e] < 0) SpringPad.cooldown[e] = 0;
    }
    if (SpringPad.animTimer[e] > 0) {
      SpringPad.animTimer[e] -= dt;
      if (SpringPad.animTimer[e] <= 0) {
        SpringPad.animTimer[e] = 0;
        SpringPad.firing[e] = 0;
      }
    }
  }
}
