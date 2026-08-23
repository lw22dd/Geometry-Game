/**
 * 粒子系统 —— 粒子池 + 特效函数。
 * 实体池由 core/ecs/entityPool 提供。
 */
import type { Particle, TrailPoint } from '../../types';
import { EntityPool } from '../../core/ecs/entityPool';
import { TLIFE } from '../../config';

/** 粒子池（上限 420，超限从头剔除） */
export const particles = new EntityPool<Particle>([]);

/** 冲刺曳光轨迹 */
export const trail: TrailPoint[] = [];

/** 生成粒子（默认值合并） */
export function part(o: Partial<Particle> & { x: number; y: number }): void {
  particles.push(Object.assign(
    { age: 0, life: 0.6, vx: 0, vy: 0, grav: 0, size: 0.12, col: '#8ff6ff', type: 'dot', rot: 0, vr: 0 },
    o,
  ));
  if (particles.length() > 420) particles.splice(0, particles.length() - 420);
}

/** 死亡爆裂 */
export function burstDeath(x: number, y: number): void {
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * 6.283, v = 4 + Math.random() * 9;
    part({
      x, y,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v + 3,
      grav: 22, life: 0.7 + Math.random() * 0.4,
      size: 0.14 + Math.random() * 0.12,
      col: Math.random() < 0.5 ? '#7de8ff' : '#c77dff',
      type: 'frag', rot: Math.random() * 3, vr: (Math.random() - 0.5) * 14,
    });
  }
}

/** 落地尘土 */
export function dust(x: number, y: number, n: number): void {
  for (let i = 0; i < n; i++) {
    part({
      x: x + (Math.random() - 0.5) * 0.6, y,
      vx: (Math.random() - 0.5) * 3, vy: Math.random() * 2,
      grav: 5, life: 0.35, size: 0.08, col: '#9fb8ff',
    });
  }
}

/** 光球收集闪光 */
export function sparkle(x: number, y: number): void {
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * 6.283;
    part({
      x, y,
      vx: Math.cos(a) * 3.5, vy: Math.sin(a) * 3.5,
      life: 0.5, size: 0.09, col: i % 2 ? '#ffffff' : '#8ff6ff',
    });
  }
}

/** 检查点激活光柱 FX */
export function cpFx(c: { x: number; y: number }): void {
  for (let i = 0; i < 10; i++) {
    part({
      x: c.x + (Math.random() - 0.5) * 1.4, y: c.y + 0.3,
      vx: 0, vy: 2 + Math.random() * 3,
      life: 0.8, size: 0.08, col: '#7df9ff',
    });
  }
}

/** 通关彩带 */
export function confetti(x: number, y: number): void {
  for (let i = 0; i < 80; i++) {
    const a = Math.random() * 6.283, v = 3 + Math.random() * 8;
    part({
      x, y,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v + 4,
      grav: 12, life: 1.2, size: 0.12,
      col: ['#7de8ff', '#c77dff', '#ff8ad8', '#ffffff'][i % 4],
      type: 'frag', rot: Math.random() * 3, vr: (Math.random() - 0.5) * 10,
    });
  }
}

/** 粒子 + 曳光逐帧步进（由 game/index step 调用） */
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