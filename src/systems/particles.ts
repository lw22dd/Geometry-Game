/**
 * 粒子运行时系统 —— 粒子池 + 曳光轨迹 + 逐帧步进。
 * 粒子池由 EntityPool 管理；特效发射器位于 Prefabs/Fx/（预制体层）。
 */
import type { Particle, TrailPoint } from '../types';
import { EntityPool } from '../core/ecs/entityPool';
import { TLIFE } from '../config';

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