/**
 * 战斗伤害冒烟测试 —— 验证伤害管线（玩家走契约层结算 / 实体走 Health 组件）。
 *
 * 覆盖：扣血 / 无敌帧免疫 / 护盾格挡 / 致死 / 受击节拍 / 击退 / 统一入口多态。
 * 运行：npx vitest run src/__smoke__/combat.smoke.test.ts
 */
import { describe, it, expect, vi } from 'vitest';
import { addEntity, addComponent } from 'bitecs';

// combat barrel 现在含 weapon/projectile（依赖 canvas 的 document）→ mock（同金测试）
vi.mock('../core/canvas', () => ({
  cv: {} as HTMLCanvasElement,
  ctx: {} as CanvasRenderingContext2D,
  VW: 1280,
  VH: 720,
  PPM: 48,
  DPR: 1,
  resize: () => {},
}));

import { createPlayerState } from '../systems/player/createPlayerState';
import { applyEffect } from '../systems/effects';
import { dealDamage } from '../systems/combat';
import { world, Health } from '../core/ecs';
import { HIT_INV, SPIKE_DAMAGE, PLAYER_MAX_HP } from '../config/combat';
import type { PlayerState } from '../types';

/** 最小玩家状态（工厂构造；测试只改需要验证的字段） */
function fresh(): PlayerState {
  return createPlayerState(0, 0);
}

/** 造一个带 Health 的实体（敌人 / 可摧毁物替身） */
function freshEntity(hp: number): number {
  const e = addEntity(world);
  addComponent(world, e, Health);
  Health.hp[e] = hp;
  Health.max[e] = hp;
  Health.inv[e] = 0;
  return e;
}

describe('玩家伤害结算（DamageRequest）', () => {
  it('扣血：hp 按量减少，未归零不致死', () => {
    const p = fresh();
    let damaged = false;
    applyEffect(p, { kind: 'DamageRequest', amount: 30 }, { onDamaged: () => { damaged = true; } });
    expect(p.hp).toBe(PLAYER_MAX_HP - 30);
    expect(p.dead).toBe(false);
    expect(damaged).toBe(true);
  });

  it('无敌帧免疫伤害（hp 不变）', () => {
    const p = fresh();
    p.inv = 1.2;
    applyEffect(p, { kind: 'DamageRequest', amount: 30 });
    expect(p.hp).toBe(PLAYER_MAX_HP);
  });

  it('已死不再受伤', () => {
    const p = fresh();
    p.dead = true;
    applyEffect(p, { kind: 'DamageRequest', amount: 30 });
    expect(p.hp).toBe(PLAYER_MAX_HP);
  });

  it('护盾格挡：消耗一格、不掉血、给无敌', () => {
    const p = fresh();
    p.shields = 1;
    p.shieldsMax = 1;
    p.modifiers = [{ stat: 'shields', op: 'set', value: 1, source: 'shield' }];
    let blocked = false;
    applyEffect(p, { kind: 'DamageRequest', amount: 30 }, { onShieldBlock: () => { blocked = true; } });
    expect(blocked).toBe(true);
    expect(p.hp).toBe(PLAYER_MAX_HP);
    expect(p.shields).toBe(0);
    expect(p.inv).toBeGreaterThan(0);
  });

  it('致死：hp 归零经 onKill 应用（生死裁决权在玩家侧）', () => {
    const p = fresh();
    let killed = false;
    applyEffect(p, { kind: 'DamageRequest', amount: PLAYER_MAX_HP }, { onKill: () => { killed = true; } });
    expect(p.hp).toBe(0);
    expect(killed).toBe(true);
  });

  it('致死：无 onKill 时缺省 killState（远程 host 模拟语义）', () => {
    const p = fresh();
    applyEffect(p, { kind: 'DamageRequest', amount: PLAYER_MAX_HP });
    expect(p.dead).toBe(true);
  });

  it('受击节拍：一次伤害后进入无敌，紧随的伤害被免疫', () => {
    const p = fresh();
    applyEffect(p, { kind: 'DamageRequest', amount: 10 });
    const afterFirst = p.hp;
    expect(p.inv).toBeCloseTo(HIT_INV, 6);
    // 持续接触伤害（地刺 stay 逐物理步触发）靠这个节拍才不会一帧刮死
    applyEffect(p, { kind: 'DamageRequest', amount: 10 });
    expect(p.hp).toBe(afterFirst);
  });

  it('击退：写入外力队列并立即给速度（instant 语义）', () => {
    const p = fresh();
    applyEffect(p, { kind: 'DamageRequest', amount: 10, knockback: { x: 5, y: 3 } });
    expect(p.impulses.length).toBe(1);
    expect(p.velocity.x).toBe(5);
    expect(p.velocity.y).toBe(3);
  });

  it('hp 下限钳制为 0（不会扣成负数）', () => {
    const p = fresh();
    applyEffect(p, { kind: 'DamageRequest', amount: 999 });
    expect(p.hp).toBe(0);
  });
});

describe('统一伤害入口 dealDamage（目标多态）', () => {
  it('玩家目标：汇总结算结果', () => {
    const p = fresh();
    const r = dealDamage(p, { amount: 20, source: 'test' });
    expect(r.applied).toBe(true);
    expect(r.killed).toBe(false);
    expect(r.hpLeft).toBe(PLAYER_MAX_HP - 20);
  });

  it('玩家目标：被无敌帧免疫时 applied=false', () => {
    const p = fresh();
    p.inv = 1;
    const r = dealDamage(p, { amount: 20 });
    expect(r.applied).toBe(false);
    expect(r.killed).toBe(false);
    expect(r.hpLeft).toBe(PLAYER_MAX_HP);
  });

  it('玩家目标：被护盾挡下时 applied=true 但 hp 不变', () => {
    const p = fresh();
    p.shields = 1;
    p.shieldsMax = 1;
    p.modifiers = [{ stat: 'shields', op: 'set', value: 1, source: 'shield' }];
    const r = dealDamage(p, { amount: 20 });
    expect(r.applied).toBe(true);
    expect(r.killed).toBe(false);
    expect(r.hpLeft).toBe(PLAYER_MAX_HP);
  });

  it('实体目标：扣 Health 组件并进入受击无敌', () => {
    const e = freshEntity(50);
    const r = dealDamage(e, { amount: 20 });
    expect(r.applied).toBe(true);
    expect(r.killed).toBe(false);
    expect(Health.hp[e]).toBe(30);
    expect(Health.inv[e]).toBeCloseTo(HIT_INV, 6);
  });

  it('实体目标：无敌帧内免疫（持续接触伤害的节拍）', () => {
    const e = freshEntity(50);
    dealDamage(e, { amount: 20 });
    const r = dealDamage(e, { amount: 20 });
    expect(r.applied).toBe(false);
    expect(Health.hp[e]).toBe(30);
  });

  it('实体目标：击杀触发 onEntityKilled（实体销毁由调用方决定）', () => {
    const e = freshEntity(10);
    let killedEid = -1;
    const r = dealDamage(e, { amount: 20 }, { onEntityKilled: (eid) => { killedEid = eid; } });
    expect(r.killed).toBe(true);
    expect(Health.hp[e]).toBe(0);
    expect(killedEid).toBe(e);
  });

  it('实体目标：已死实体不再受伤', () => {
    const e = freshEntity(0);
    const r = dealDamage(e, { amount: 20 });
    expect(r.applied).toBe(false);
    expect(r.killed).toBe(false);
  });
});

describe('危险物伤害数值', () => {
  it('地刺可造成多次伤害才致死（掉血而非即死）', () => {
    expect(SPIKE_DAMAGE).toBeGreaterThan(0);
    expect(SPIKE_DAMAGE).toBeLessThan(PLAYER_MAX_HP);

    // 玩家满血踩刺：第一次只掉血，不致死
    const p = fresh();
    const r = dealDamage(p, { amount: SPIKE_DAMAGE, source: 'spike' });
    expect(p.dead).toBe(false);
    expect(p.hp).toBe(PLAYER_MAX_HP - SPIKE_DAMAGE);
    expect(r.killed).toBe(false);
  });
});
