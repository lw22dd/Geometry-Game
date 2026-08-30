/**
 * ECS 运行时冒烟测试 —— 验证新 bitECS 层在真实运行时的行为。
 * 覆盖：initEcs / 场景工厂 / tag 组件查询 / hasComponent / SoA 读写 / 序列化。
 * 运行：npx vitest run src/__smoke__/ecs.smoke.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  world, initEcs, clearWorld,
  Position, Velocity, Collider, PathMotion, SpringPad, Timer, Hazard,
  Collectible, RespawnPoint, Goal, Track, TrackGeom, Renderable, Animator,
  Orb, JumpBoost, Hook, ShieldPickup, SpeedPickup, WeaponPickup, Hookable, renderStyles,
  qOrbs, qJumpBoosts, qHooks, qShields, qSpeeds, qWeaponPickups, qCheckpoints, qGoal, qMovers, qSpringPads,
  qTimers, qHazards, qLasers, qTracks, qHookTargets, qCollectibles,
} from '../core/ecs';
import { hasComponent, getAllEntities } from 'bitecs';
import {
  createOrb, createJumpBoost, createHookPickup, createShieldPickup, createSpeedPickup, createWeaponPickup, createCheckpoint, createNova,
  createSpike, createLaser, createMovingPlatform, createSpringPad, createLoopTrack,
} from '../Prefabs/Scenes/sceneFactory';

beforeEach(() => {
  initEcs();
  clearWorld();
  renderStyles.length = 0;
});

describe('bitECS 场景层运行时', () => {
  it('场景工厂创建后可查询到全部类型实体', () => {
    const orb = createOrb(1, 2, 0);
    const jb = createJumpBoost(3, 4, 0);
    const hk = createHookPickup(5, 6, 0);
    const sh = createShieldPickup(5.5, 6.5, 0);
    const sp = createSpeedPickup(6, 6.5, 0);
    const cp = createCheckpoint(7, 8);
    const nova = createNova(9, 10);
    const spike = createSpike(11, 12);
    const laser = createLaser({ x: 13, y0: 14, len: 6, ph: 0 });
    createMovingPlatform({ x0: 15, y: 16, w: 3, h: 0.8, range: 4, spd: 0.8, ph: 0 });
    createSpringPad({ x: 17, y: 18, w: 2.5, h: 1.2, force: { x: 0, y: 96 }, duration: 0.3 });
    createLoopTrack(
      [{ type: 'line', x1: 0, y1: 0, x2: 10, y2: 0 }],
      0, 10, 0,
    );

    expect(qOrbs()).toContain(orb);
    expect(qJumpBoosts()).toContain(jb);
    expect(qHooks()).toContain(hk);
    expect(qShields()).toContain(sh);
    expect(qSpeeds()).toContain(sp);
    expect(qCheckpoints()).toContain(cp);
    expect(qGoal()).toContain(nova);
    expect(qHazards()).toContain(spike);
    expect(qLasers()).toContain(laser);
    expect(qMovers().length).toBeGreaterThanOrEqual(1);
    expect(qSpringPads().length).toBeGreaterThanOrEqual(1);
    expect(qTracks().length).toBe(1);
    expect(qHookTargets().length).toBeGreaterThanOrEqual(2); // 平台 + 弹簧
    expect(qCollectibles().length).toBe(5); // orb + jumpBoost + hook + shield + speed
  });

  it('武器拾取物：工厂创建 + kind 编码 + 查询', () => {
    const ak = createWeaponPickup(2, 3, 'ak', 0);
    const gd = createWeaponPickup(4, 5, 'grenade', 0);
    expect(hasComponent(world, ak, WeaponPickup)).toBe(true);
    expect(hasComponent(world, ak, Collectible)).toBe(true);
    expect(WeaponPickup.kind[ak]).toBe(0);      // ak → code 0
    expect(WeaponPickup.kind[gd]).toBe(1);      // grenade → code 1
    expect(qWeaponPickups()).toContain(ak);
    expect(qWeaponPickups()).toContain(gd);
    // 拾取后 collected=1（绘制层据此隐藏，网络据此同步）
    Collectible.collected[ak] = 1;
  });

  it('tag 组件用 hasComponent 可正确判定类型', () => {
    const orb = createOrb(1, 2, 0);
    const jb = createJumpBoost(3, 4, 0);
    const hk = createHookPickup(5, 6, 0);
    const sh = createShieldPickup(5.5, 6.5, 0);
    const sp = createSpeedPickup(6, 6.5, 0);
    const spike = createSpike(11, 12);

    expect(hasComponent(world, orb, Orb)).toBe(true);
    expect(hasComponent(world, orb, JumpBoost)).toBe(false);
    expect(hasComponent(world, jb, JumpBoost)).toBe(true);
    expect(hasComponent(world, hk, Hook)).toBe(true);
    expect(hasComponent(world, sh, ShieldPickup)).toBe(true);
    expect(hasComponent(world, sp, SpeedPickup)).toBe(true);
    expect(hasComponent(world, spike, Hazard)).toBe(true);
    expect(hasComponent(world, spike, Timer)).toBe(false);
    expect(hasComponent(world, orb, Timer)).toBe(false);
  });

  it('SoA 组件字段可读写', () => {
    const orb = createOrb(1, 2, 0);
    expect(Position.x[orb]).toBe(1);
    expect(Position.y[orb]).toBe(2);
    expect(Collectible.collected[orb]).toBe(0);
    Collectible.collected[orb] = 1;
    expect(Collectible.collected[orb]).toBe(1);
  });

  it('Renderable styleId 与调色板对应', () => {
    const orb = createOrb(1, 2, 0);
    const nova = createNova(9, 10);
    const sh = createShieldPickup(5.5, 6.5, 0);
    const sp = createSpeedPickup(6, 6.5, 0);
    expect(renderStyles.length).toBe(7);
    expect(Renderable.styleId[orb]).toBe(0);
    expect(Renderable.styleId[nova]).toBe(4);
    expect(Renderable.styleId[sh]).toBe(5);
    expect(Renderable.styleId[sp]).toBe(6);
    expect(Renderable.radius[orb]).toBe(0.4);
  });

  it('移动平台携带位移 dx/dy 写入 PathMotion', () => {
    const m = createMovingPlatform({ x0: 15, y: 16, w: 3, h: 0.8, range: 4, spd: 0.8, ph: 0 });
    PathMotion.dx[m] = 0.5;
    PathMotion.dy[m] = 0.25;
    expect(PathMotion.dx[m]).toBe(0.5);
    expect(PathMotion.dy[m]).toBe(0.25);
  });

  it('轨道段几何存入 TrackGeom AoS 侧表', () => {
    const segments = [
      { type: 'line' as const, x1: 0, y1: 0, x2: 10, y2: 0 },
      { type: 'arc' as const, cx: 10, cy: 0, radius: 1, startAngle: -Math.PI / 2, endAngle: Math.PI / 2, dir: 1 as const },
    ];
    const t = createLoopTrack(segments, 0, 10 + Math.PI, 0);
    expect(TrackGeom[t].segments).toHaveLength(2);
    expect(Track.entryX[t]).toBe(0);
  });

  it('clearWorld 清空全部实体（切图重建路径）', () => {
    createOrb(1, 2, 0);
    createSpike(3, 4);
    expect(qAllCount()).toBeGreaterThan(0);
    clearWorld();
    expect(qAllCount()).toBe(0);
    // 清空后可重建
    const orb2 = createOrb(5, 6, 0);
    expect(qOrbs()).toContain(orb2);
  });

  it('组件挂载探测必须用 hasComponent（字段探测不可靠：TypedArray 槽位默认 0）', () => {
    const e1 = createOrb(1, 2, 0);          // 挂载 Collectible
    const e2 = createSpike(3, 4);            // 不挂载 Collectible
    // hasComponent 是唯一可靠探测
    expect(hasComponent(world, e1, Collectible)).toBe(true);
    expect(hasComponent(world, e2, Collectible)).toBe(false);
    // 反例：字段探测会误判 —— u8 数组对未挂载槽位可能返回 0 而非 undefined
    // （因此全部代码必须改用 hasComponent，禁止用 field[e] !== undefined 判断挂载）
    expect(hasComponent(world, e2, Hazard)).toBe(true);
    expect(hasComponent(world, e2, Timer)).toBe(false);
    expect(hasComponent(world, e1, Timer)).toBe(false);
  });
});

function qAllCount(): number {
  let n = 0;
  for (const _e of getAllEntities(world)) n++;
  return n;
}
