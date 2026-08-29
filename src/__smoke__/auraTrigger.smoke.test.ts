/**
 * 扩展占位冒烟测试 —— 光环（AuraSystem）与触发（TriggerSystem）基础设施。
 *
 * 验证契约：效果一律经 applyEffect 投递（PlayerRequest），来源不写玩家状态。
 * 配置驱动：新光环 = setAuraFx 配置 onEnter/onExit/onTick；新触发 = registerTrigger 订阅。
 * 战斗扩展（毒雾 DPS / 低血盾 / 事件引爆）到来时只是换请求种类，本层零改动。
 * 运行：npx vitest run src/__smoke__/auraTrigger.smoke.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { initEcs, clearWorld, Position, Aura, qAuras } from '../core/ecs';
import { createAura } from '../Prefabs/Scenes/sceneFactory';
import { setAuraFx, resetAuraState, stepAuraSystem } from '../systems/level/AuraSystem';
import { registerTrigger, resetTriggers, fireTriggers } from '../systems/effects/TriggerSystem';
import { createPlayerState } from '../systems/player/createPlayerState';

beforeEach(() => {
  initEcs();
  clearWorld();
  resetAuraState();
  resetTriggers();
});

describe('光环（AuraSystem · 配置驱动）', () => {
  it('范围内玩家按周期收到投递的请求（弹跳场：onTick → Impulse）', () => {
    const e = createAura(0, 0, 5, 1); // 半径 5，周期 1s
    setAuraFx(e, { onTick: { kind: 'Impulse', ax: 0, ay: 40, dur: 0.1 } });
    const p = createPlayerState(2, 1); // 在范围内
    const players = [{ id: 1, state: p }];
    stepAuraSystem(1, players); // dt=1 ≥ tick=1 → 1 次周期结算
    expect(p.impulses).toHaveLength(1);
    expect(p.impulses[0].ay).toBe(40);
    stepAuraSystem(2.5, players); // 再累计 2.5s → 2 次
    expect(p.impulses).toHaveLength(3);
  });

  it('进出触发 enter/exit 各一次（onEnter/onExit）', () => {
    const e = createAura(0, 0, 5, 0); // tick=0 → 仅进出
    setAuraFx(e, {
      onEnter: { kind: 'GrantJumpCharges', max: 1 },
      onExit: { kind: 'ApplyModifier', mod: { stat: 'jumpCharges', op: 'set', value: 0, source: 'auraTest' } },
    });
    const p = createPlayerState(2, 1); // 在范围内
    const players = [{ id: 1, state: p }];
    stepAuraSystem(0, players);
    expect(p.extraJumpsMax).toBe(1);
    // 移出范围 → onExit
    p.x = 100;
    stepAuraSystem(0, players);
    expect(p.extraJumpsMax).toBe(0);
    // 停留范围外 → 不重复触发
    stepAuraSystem(0, players);
    expect(p.extraJumpsMax).toBe(0);
  });

  it('范围外玩家不受影响', () => {
    const e = createAura(0, 0, 5, 1);
    setAuraFx(e, { onTick: { kind: 'Impulse', ax: 0, ay: 40, dur: 0.1 } });
    const p = createPlayerState(100, 100);
    stepAuraSystem(5, [{ id: 1, state: p }]);
    expect(p.impulses).toHaveLength(0);
  });

  it('createAura 实体可被 qAuras 查询', () => {
    const e = createAura(3, 4, 6, 0.5);
    expect(qAuras()).toContain(e);
    expect(Aura.radius[e]).toBe(6);
    expect(Aura.tick[e]).toBe(0.5);
    expect(Position.x[e]).toBe(3);
  });
});

describe('触发（TriggerSystem · 事件订阅）', () => {
  it('事件 → 条件满足 → 投递请求', () => {
    const p = createPlayerState(0, 0);
    registerTrigger({
      id: 'jump-on-first-death',
      event: 'died',
      condition: (pl, payload) => (payload as { deaths: number }).deaths === 1,
      fire: () => ({ kind: 'GrantJumpCharges', max: 1 }),
    });
    // 条件不满足（deaths=2）→ 不触发
    fireTriggers('died', p, { deaths: 2 });
    expect(p.extraJumpsMax).toBe(0);
    // 条件满足（deaths=1）→ 触发
    fireTriggers('died', p, { deaths: 1 });
    expect(p.extraJumpsMax).toBe(1);
  });

  it('事件不匹配的触发不触发', () => {
    const p = createPlayerState(0, 0);
    registerTrigger({
      id: 'only-on-dash',
      event: 'dashed',
      fire: () => ({ kind: 'GrantJumpCharges', max: 3 }),
    });
    fireTriggers('jumped', p);
    expect(p.extraJumpsMax).toBe(0);
  });
});
