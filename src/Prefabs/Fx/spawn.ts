/**
 * 通用特效发射器 —— 按预设模板生成一批粒子。
 * 替代原 burstDeath/dust/sparkle/cpFx/confetti 五个函数。
 */
import { part } from '../../systems/particles';
import type { FxPreset } from './presets';

/** 辅助：区间内均匀随机 */
const rand = (r: [number, number]): number => r[0] + Math.random() * (r[1] - r[0]);

/**
 * 发射一次特效。
 * @param preset 特效预设（Prefabs/Fx/presets 的 FX 表）
 * @param x 世界 X（米）
 * @param y 世界 Y（米）
 * @param countOverride 覆盖粒子数量（如落地尘土按落地速度定量）
 */
export function spawnFx(preset: FxPreset, x: number, y: number, countOverride?: number): void {
  const n = countOverride ?? preset.count;
  for (let i = 0; i < n; i++) {
    const ox = preset.spreadX ? (Math.random() - 0.5) * 2 * preset.spreadX : 0;
    let vx: number, vy: number;
    const vel = preset.vel;
    if (vel.mode === 'axis') {
      vx = rand(vel.vx); vy = rand(vel.vy);
    } else if (vel.uniform) {
      // 均匀射线：第 i 颗指向 i/n 圆周角
      const a = i / n * Math.PI * 2;
      const v = rand(vel.speed);
      vx = Math.cos(a) * v; vy = Math.sin(a) * v;
    } else {
      // 随机方向 + 可选垂直偏置
      const a = Math.random() * Math.PI * 2;
      const v = rand(vel.speed);
      vx = Math.cos(a) * v; vy = Math.sin(a) * v + (vel.vyBias ?? 0);
    }
    part({
      x: x + ox, y,
      vx, vy,
      grav: preset.gravity,
      life: rand(preset.life),
      size: rand(preset.size),
      col: preset.colors[i % preset.colors.length],
      type: preset.kind,
      rot: preset.spin ? rand(preset.spin.start) : 0,
      vr: preset.spin ? rand(preset.spin.rate) : 0,
    });
  }
}