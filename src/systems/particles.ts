/**
 * 粒子运行时系统 —— 粒子池 + 发射 + 逐帧步进 + 回收。
 * 本模块是粒子特效的唯一运行时入口（公开 API：spawnParticles / stepParticles）；
 * Prefabs/Fx 只为它提供纯数据预设表（FX），不参与实例生命周期。
 * 粒子不进入 ECS：寿命短、不碰撞、不需要被查询，统一由本池批量管理。
 */
import type { Particle, TrailPoint } from '../types';
import type { FxPreset } from '../Prefabs/Fx/presets';
import { EntityPool } from '../core/ecs/entityPool';
import { TLIFE } from '../config';

/** 粒子池（上限 420，超限从头剔除） */
export const particles = new EntityPool<Particle>([]);

/** 冲刺曳光轨迹 */
export const trail: TrailPoint[] = [];

/** 辅助：区间内均匀随机 */
function rand(r: [number, number]): number {
  return r[0] + Math.random() * (r[1] - r[0]);
}

/** 生成单个粒子（模块内私有，由 spawnParticles 批量调用） */
function part(o: Partial<Particle> & { x: number; y: number }): void {
  particles.push(Object.assign(
    { age: 0, life: 0.6, vx: 0, vy: 0, grav: 0, size: 0.12, col: '#8ff6ff', type: 'dot', rot: 0, vr: 0 },
    o,
  ));
  if (particles.length() > 420) particles.splice(0, particles.length() - 420);
}

/**
 * 发射一次特效 —— 按预设模板生成一批粒子并放入池。
 * @param preset 特效预设（Prefabs/Fx 的 FX 数据表）
 * @param x 世界 X（米）
 * @param y 世界 Y（米）
 * @param countOverride 覆盖粒子数量（如落地尘土按落地速度定量）
 */
export function spawnParticles(preset: FxPreset, x: number, y: number, countOverride?: number): void {
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

/** 粒子 + 曳光逐帧步进（由 game/index step 调用）；寿命结束由本函数回收 */
export function stepParticles(dt: number): void {
  const all = particles.all;
  for (let i = all.length - 1; i >= 0; i--) {
    const q = all[i];
    q.age += dt;
    if (q.age >= q.life) {
      particles.splice(i, 1);
      continue;
    }
    q.vy -= q.grav * dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.rot += q.vr * dt;
  }

  for (const q of trail) q.age += dt;
  while (trail.length && trail[0].age > TLIFE) trail.shift();
}