/**
 * 契约层冒烟测试 —— 验证 applyEffect 结算管线（影响来源只投递请求，玩家侧统一裁决）。
 * 覆盖：KillRequest 免疫规则 / Impulse 入队消费 / GrantJumpCharges / item onPickup 经契约层。
 * 运行：npx vitest run src/__smoke__/effects.smoke.test.ts
 */
import { describe, it, expect } from 'vitest';
import { createPlayerState } from '../systems/player/createPlayerState';
import { applyEffect, consumeImpulses, applyModifier, removeModifier, recomputeStats, stepBuffTimers } from '../systems/effects';
import { ITEMS, reconcileShield } from '../systems/items/backpack';
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
    // 双跳票：先入背包（onPickup 前置），再挂能力（经 Modifier 管道）
    p.backpack.push('doubleJump');
    ITEMS['doubleJump'].onPickup?.(p);
    expect(p.extraJumpsMax).toBe(1);
    expect(p.extraJumps).toBe(1);
    // 管道落表：modifiers 含来源标记的跳充能修正
    expect(p.modifiers).toEqual([{ stat: 'jumpCharges', op: 'set', value: 1, source: 'doubleJump' }]);
  });

  it('Modifier 管道：ApplyModifier 请求幂等落表 + recomputeStats 重算', () => {
    const p = fresh();
    // 双跳票（set=1）
    applyEffect(p, { kind: 'ApplyModifier', mod: { stat: 'jumpCharges', op: 'set', value: 1, source: 'doubleJump' } });
    expect(p.extraJumpsMax).toBe(1);
    expect(p.modifiers).toHaveLength(1);
    // 同源重复投递 → 幂等替换（不叠加）
    applyEffect(p, { kind: 'ApplyModifier', mod: { stat: 'jumpCharges', op: 'set', value: 1, source: 'doubleJump' } });
    expect(p.modifiers).toHaveLength(1);
    expect(p.extraJumpsMax).toBe(1);
    // 第三方 add 修正 → 累加（如三跳票 add 1 → max 2）
    applyEffect(p, { kind: 'ApplyModifier', mod: { stat: 'jumpCharges', op: 'add', value: 1, source: 'tripleJump' } });
    expect(p.extraJumpsMax).toBe(2);
  });

  it('Modifier 管道：removeModifier 移除来源后重算', () => {
    const p = fresh();
    applyModifier(p, { stat: 'jumpCharges', op: 'set', value: 1, source: 'doubleJump' });
    applyModifier(p, { stat: 'jumpCharges', op: 'add', value: 1, source: 'tripleJump' });
    expect(p.extraJumpsMax).toBe(2);
    removeModifier(p, 'jumpCharges', 'tripleJump');
    expect(p.extraJumpsMax).toBe(1);
    expect(p.modifiers).toHaveLength(1);
    // recomputeStats 可直接手动触发（幂等）
    recomputeStats(p);
    expect(p.extraJumpsMax).toBe(1);
  });
});

describe('护盾（限时 buff · 刷新式）', () => {
  it('拾取经 Modifier 管道获得 1 格护盾（含限时 dur/t）', () => {
    const p = fresh();
    p.backpack.push('shield');
    ITEMS['shield'].onPickup?.(p);
    expect(p.shieldsMax).toBe(1);
    expect(p.shields).toBe(1);
    expect(p.modifiers).toEqual([
      { stat: 'shields', op: 'set', value: 1, source: 'shield', dur: expect.any(Number), t: expect.any(Number) },
    ]);
  });

  it('KillRequest 被护盾格挡：不致死、消耗护盾、获得短暂无敌、触发 onShieldBlock', () => {
    const p = fresh();
    p.backpack.push('shield');
    ITEMS['shield'].onPickup?.(p);
    let blocked = false;
    applyEffect(p, { kind: 'KillRequest' }, { onShieldBlock: () => { blocked = true; } });
    expect(p.dead).toBe(false);
    expect(blocked).toBe(true);
    expect(p.shields).toBe(0);
    expect(p.shieldsMax).toBe(0);
    expect(p.inv).toBeGreaterThan(0);
    // 格挡后短暂无敌仍在 → 紧接命中被 inv 免疫（不消耗已耗尽的护盾）
    let rehit = false;
    applyEffect(p, { kind: 'KillRequest' }, { onShieldBlock: () => { rehit = true; } });
    expect(rehit).toBe(false);
    expect(p.dead).toBe(false);
    // 无敌耗尽后（清 inv 模拟）再次被击中 → 正常致死（onKill）
    p.inv = 0;
    let killed = false;
    applyEffect(p, { kind: 'KillRequest' }, { onKill: () => { killed = true; } });
    expect(killed).toBe(true);
  });

  it('无敌帧优先于护盾：inv 期间命中不消耗护盾', () => {
    const p = fresh();
    p.inv = 1.2;
    p.backpack.push('shield');
    ITEMS['shield'].onPickup?.(p);
    let blocked = false;
    applyEffect(p, { kind: 'KillRequest' }, { onShieldBlock: () => { blocked = true; } });
    expect(blocked).toBe(false);
    expect(p.shields).toBe(1);
    expect(p.dead).toBe(false);
  });

  it('stepBuffTimers 到期自动失效（背包由 reconcileShield 退出）', () => {
    const p = fresh();
    p.backpack.push('shield');
    ITEMS['shield'].onPickup?.(p);
    expect(p.shieldsMax).toBe(1);
    // 到期前仍在
    stepBuffTimers(p, 5);
    expect(p.shieldsMax).toBe(1);
    // 越过到期点
    const expired = stepBuffTimers(p, 5.1);
    expect(expired.some(e => e.source === 'shield')).toBe(true);
    expect(p.shieldsMax).toBe(0);
    expect(p.shields).toBe(0);
    // 背包自动退出（invariant）
    expect(p.backpack).toContain('shield');
    reconcileShield(p);
    expect(p.backpack).not.toContain('shield');
  });

  it('reconcileShield 双方向一致：格挡后清背包 / 背包权威移除后清能力', () => {
    // 方向一：能力被格挡消耗（removeModifier）但背包残留 → 清背包
    const p = fresh();
    p.backpack.push('shield');
    ITEMS['shield'].onPickup?.(p);
    removeModifier(p, 'shields', 'shield');
    expect(p.backpack).toContain('shield');
    reconcileShield(p);
    expect(p.backpack).not.toContain('shield');

    // 方向二：有能力但背包被权威移除（房主超时广播）→ 清能力
    const q = fresh();
    ITEMS['shield'].onPickup?.(q);
    expect(q.shieldsMax).toBe(1);
    q.backpack = [];
    reconcileShield(q);
    expect(q.shieldsMax).toBe(0);
    expect(q.shields).toBe(0);
  });

  it('再拾取 = 重置计时（同键替换不叠加格数）', () => {
    const p = fresh();
    p.backpack.push('shield');
    ITEMS['shield'].onPickup?.(p);
    stepBuffTimers(p, 7);
    const tBefore = p.modifiers[0].t ?? 0;
    expect(tBefore).toBeLessThan(10);
    // 再拾取 → 计时重置
    ITEMS['shield'].onPickup?.(p);
    expect(p.modifiers).toHaveLength(1);
    expect(p.shieldsMax).toBe(1);
    expect(p.modifiers[0].t ?? 0).toBeGreaterThan(tBefore);
  });
});
