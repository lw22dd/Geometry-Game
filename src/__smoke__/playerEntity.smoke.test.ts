/**
 * 玩家 ECS 实体接线冒烟测试 —— 验证 qLocalPlayer 可查、桥同步一致。
 * 覆盖：ensurePlayerEntity 创建 / clearWorld 后重建 / syncToEcs 字段镜像。
 * 运行：npx vitest run src/__smoke__/playerEntity.smoke.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { initEcs, clearWorld, qLocalPlayer, Position, Velocity, JumpCharges } from '../core/ecs';
import { ensurePlayerEntity, syncToEcs, getPlayerEid, syncFromEcs, isPlayerEntityMounted } from '../systems/player/playerEntity';
import { createPlayerState } from '../systems/player/createPlayerState';
import { applyEffect } from '../systems/effects';

beforeEach(() => {
  initEcs();
  clearWorld();
});

describe('玩家 ECS 实体桥接', () => {
  it('ensurePlayerEntity 后 qLocalPlayer 可查到玩家实体', () => {
    const eid = ensurePlayerEntity(7);
    expect(eid).toBeGreaterThanOrEqual(0);
    expect(getPlayerEid()).toBe(eid);
    expect(qLocalPlayer()).toContain(eid);
  });

  it('syncToEcs 镜像 Position/Velocity/契约组件', () => {
    const eid = ensurePlayerEntity(7);
    const p = createPlayerState(3, 5);
    p.velocity.x = 7;
    p.extraJumpsMax = 1;
    applyEffect(p, { kind: 'GrantJumpCharges', max: 1 });
    syncToEcs(p);

    expect(Position.x[eid]).toBe(3);
    expect(Position.y[eid]).toBe(5);
    expect(Velocity.x[eid]).toBe(7);
    expect(JumpCharges.max[eid]).toBe(1);
    expect(JumpCharges.left[eid]).toBe(1);
  });

  it('clearWorld 后实体被移除，重建可再次查询（bitECS 会复用已释放的 eid）', () => {
    ensurePlayerEntity(7);
    clearWorld();
    expect(qLocalPlayer()).toHaveLength(0);
    const second = ensurePlayerEntity(7);
    expect(qLocalPlayer()).toContain(second);
  });

  it('round-trip：syncToEcs → syncFromEcs 全字段一致（组件层完整承载 PlayerState）', () => {
    const eid = ensurePlayerEntity(7);
    const p = createPlayerState(3, 5);
    p.velocity.x = 7;
    p.velocity.y = -3.2;
    p.half = 0.42;
    p.grounded = true;
    p.coyote = 0.1;
    p.jbuf = 0.2;
    p.face = -1;
    p.sprint = true;
    p.wasSpr = false;
    p.inv = 1.2;
    p.dead = false;
    p.deadT = 0;
    p.jumpWasDown = false;
    p.jumpFresh = true;
    p.hookCd = 0.5;
    p.hookMissT = 0.3;
    p.selectedSlot = 2;
    p.plat = { dx: 0.5, dy: 0.25 };
    p.track = {
      segments: [{ type: 'line', x1: 0, y1: 5, x2: 20, y2: 5 }],
      cumulative: [0, 20],
      dist: 3.7,
      speed: 8,
      totalLength: 20,
      entryDist: 0,
      exitDist: 20,
      zipline: false,
    };
    p.backpack = ['doubleJump', 'hook'];
    applyEffect(p, { kind: 'GrantJumpCharges', max: 1 });
    applyEffect(p, { kind: 'Impulse', ax: 0, ay: 96, dur: 0.3 });
    syncToEcs(p);

    const view = syncFromEcs(eid);
    expect(view).not.toBeNull();
    expect(view!.x).toBe(3);
    expect(view!.y).toBe(5);
    expect(view!.velocity).toEqual({ x: 7, y: -3.2 });
    expect(view!.grounded).toBe(true);
    expect(view!.sprint).toBe(true);
    expect(view!.inv).toBe(1.2);
    expect(view!.face).toBe(-1);
    expect(view!.jumpFresh).toBe(true);
    expect(view!.hookCd).toBe(0.5);
    expect(view!.selectedSlot).toBe(2);
    expect(view!.plat).toEqual({ dx: 0.5, dy: 0.25 });
    expect(view!.track?.dist).toBe(3.7);
    expect(view!.track?.speed).toBe(8);
    expect(view!.backpack).toEqual(['doubleJump', 'hook']);
    expect(view!.extraJumpsMax).toBe(1);
    expect(view!.impulses).toHaveLength(1);
  });

  it('isPlayerEntityMounted 反映接线状态', () => {
    expect(isPlayerEntityMounted()).toBe(false);
    ensurePlayerEntity(7);
    expect(isPlayerEntityMounted()).toBe(true);
  });

  it('真源切换回环：组件 → 工作副本(hydrateFrom 语义) → 副本修改 → syncToEcs 全字段一致', () => {
    const eid = ensurePlayerEntity(7);
    const p = createPlayerState(3, 5);
    p.velocity.x = 7;
    p.grounded = true;
    p.extraJumpsMax = 1;
    p.backpack = ['hook'];
    syncToEcs(p);

    // 物理前：组件 → 工作副本（hydrateFrom 即 Object.assign 覆盖，语义等价）
    const view = syncFromEcs(eid)!;
    const working = createPlayerState(0, 0);
    Object.assign(working, view);
    expect(working.x).toBe(3);
    expect(working.velocity.x).toBe(7);
    expect(working.backpack).toEqual(['hook']);

    // 模拟物理步对副本的修改（如落地位移 / 外力写入）
    working.x += 2;
    working.velocity.y = -9.5;
    applyEffect(working, { kind: 'Impulse', ax: 0, ay: 96, dur: 0.3 });

    // 物理后：副本 → 组件
    syncToEcs(working);

    // 组件反映全部修改（下帧 hydrate 可读回）
    const after = syncFromEcs(eid)!;
    expect(after.x).toBe(5);
    expect(after.velocity.y).toBe(-9.5);
    expect(after.impulses).toHaveLength(1);
    expect(after.impulses[0].ay).toBe(96);
  });
});