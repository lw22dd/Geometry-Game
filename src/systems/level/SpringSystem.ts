/**
 * 弹簧平台系统 —— 更新所有 SpringPad 组件的冷却与动画计时。
 * animTimer > 0 时弹簧处于压缩/弹起动画中（与玩家加速时长同步）。
 */
import { world } from '../../core/ecs';
import { SpringPad } from '../../components/physics/SpringPad';

export function updateSpringPads(dt: number): void {
  for (const e of world.query(SpringPad)) {
    const s = world.get<SpringPad>(e, SpringPad);
    if (s.cooldown > 0) {
      s.cooldown -= dt;
      if (s.cooldown < 0) s.cooldown = 0;
    }
    if (s.animTimer > 0) {
      s.animTimer -= dt;
      if (s.animTimer <= 0) {
        s.animTimer = 0;
        s.firing = false;
      }
    }
  }
}