/**
 * 契约层冒烟测试 —— 验证 applyEffect 结算管线（影响来源只投递请求，玩家侧统一裁决）。
 * 覆盖：KillRequest 免疫规则 / Impulse 入队消费 / GrantJumpCharges / item onPickup 经契约层。
 * 运行：npx vitest run src/__smoke__/effects.smoke.test.ts
 */
import { describe, it, expect } from 'vitest';
import { createPlayerState } from '../systems/player/createPlayerState';
import { applyEffect, consumeImpulses } from '../systems/effects';
import { ITEMS } from '../systems/items/backpack';
import type { PlayerState } from '../types';

/** 最小玩家状态（工厂构造；测试只改需要验证的字段） */
function fresh(): PlayerState {
  return createPlayerState(0, 0);
}

describe('契约层结算管线', () => {
  it('KillRequest：无敌帧免疫致死（不调用 onKill）', () => {
    const p = fresh();
    p.inv = 1.2;
    let killed = false;
    applyEffect(p, { kind: 'KillRequest' }, { onKill: () => { killed = true; } });
    expect(p.dead).toBe(false);
    expect(killed).toBe(false);
  });

  it('KillRequest：已死不再重复致死', () => {
    const p = fresh();
    p.dead = true;
    let killed = 0;
    applyEffect(p, { kind: 'KillRequest' }, { onKill: () => { killed++; } });
    expect(killed).toBe(0);
  });

  it('KillRequest：正常情况经 onKill 应用（本地 die() 语义）', () => {
    const p = fresh();
    let killed = false;
    applyEffect(p, { kind: 'KillRequest' }, { onKill: () => { p.dead = true; killed = true; } });
    expect(killed).toBe(true);
    expect(p.dead).toBe(true);
  });

  it('KillRequest：无 onKill 时缺省 killState（远程 host 模拟语义）', () => {
    const p = fresh();
    applyEffect(p, { kind: 'KillRequest' });
    expect(p.dead).toBe(true);
  });

  it('Impulse：入队后经 consumeImpulses 施力并到期移除', () => {
    const p = fresh();
    applyEffect(p, { kind: 'Impulse', ax: 0, ay: 96, dur: 0.3 });
    expect(p.impulses.length).toBe(1);
    consumeImpulses(p, 1 / 120);
    expect(p.velocity.y).toBeCloseTo(96 / 120, 10);
    expect(p.impulses[0].t).toBeCloseTo(0.3 - 1 / 120, 10);
    // 模拟完整时长后队列清空
    let dt = 1 / 120;
    while (p.impulses.length > 0) consumeImpulses(p, dt);
    expect(p.impulses.length).toBe(0);
  });

  it('GrantJumpCharges：设置充能上限并立即回满', () => {
    const p = fresh();
    applyEffect(p, { kind: 'GrantJumpCharges', max: 1 });
    expect(p.extraJumpsMax).toBe(1);
    expect(p.extraJumps).toBe(1);
  });

  it('道具 onPickup 经契约层生效（不直写玩家字段）', () => {
    const p = fresh();
    // 双跳票：先入背包（onPickup 前置），再挂能力
    p.backpack.push('doubleJump');
    ITEMS['doubleJump'].onPickup?.(p);
    expect(p.extraJumpsMax).toBe(1);
    expect(p.extraJumps).toBe(1);
  });
});
