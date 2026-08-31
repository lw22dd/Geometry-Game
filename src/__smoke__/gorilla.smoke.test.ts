/**
 * 大猩猩攻击冒烟测试（S3）—— 近战砸地 / 远程投石都必须能命中玩家并扣血。
 *
 * 白盒驱动 stepEnemyBehavior + stepGorillaRocks，绕过物理/关卡几何，
 * 直接聚焦「发起攻击 → 前摇走完 → 结算判定 → 玩家扣血」这条链。
 * 用例目的：钉死"攻击不造成伤害"的回归（判定区域 / 石头命中）。
 *
 * 运行：npx vitest run src/__smoke__/gorilla.smoke.test.ts
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../core/canvas', () => ({
  cv: {} as HTMLCanvasElement,
  ctx: {} as CanvasRenderingContext2D,
  VW: 1280,
  VH: 720,
  PPM: 48,
  DPR: 1,
  resize: () => {},
}));

// 结算链里砸地/投石会播音效 → mock 掉（只验证逻辑，不验证听感）
vi.mock('../core/audio', () => ({
  sfx: new Proxy({}, { get: () => () => {} }),
}));

import { initEcs, clearWorld, Position, Collider, qEnemyRocks } from '../core/ecs';
import { spawnEnemy } from '../systems/enemy';
import { createPlayerState } from '../systems/player/createPlayerState';
import { getEnemyKind, stepEnemyBehavior, stepGorillaRocks } from '../Prefabs/Enemy';
import type { GorillaDef, GorillaState, StepInput } from '../Prefabs/Enemy';
import type { PlayerState } from '../types';

beforeEach(() => {
  initEcs();
  clearWorld();
});

function freshPlayer(): PlayerState {
  return createPlayerState(0, 0);
}

/** 生成一只大猩猩 + 独立构造的初始攻击状态（cd 就绪） */
function gorillaScene(x: number): { e: number; def: GorillaDef; st: GorillaState } {
  const e = spawnEnemy('gorilla', x, 4);
  const def = getEnemyKind('gorilla') as GorillaDef;
  const st: GorillaState = {
    dir: 1,
    homeX: x,
    mode: 'chase',
    grounded: true,
    walkT: 0,
    attack: { phase: 'melee', t: 0, cd: 0, aimX: 0, aimY: 0 },
  };
  return { e, def, st };
}

describe('大猩猩攻击结算（S3）', () => {
  const DT = 1 / 120;

  it('近战砸地：贴脸玩家 → 前摇走完 → 玩家扣血', () => {
    const { e, def, st } = gorillaScene(10);
    const p = freshPlayer();
    // 站到大猩猩脚底上方（大猩猩中心 4，碰撞箱高 3 → 脚底在 2.5）
    p.x = 10.4;
    p.y = Position.y[e] - Collider.h[e] / 2 + 0.6;
    p.inv = 0;
    const before = p.hp;

    const dx = p.x - Position.x[e];
    const dy = p.y - Position.y[e];
    const inp: StepInput = { e, dt: DT, target: p, dist2: dx * dx + dy * dy, players: [{ state: p }] };

    // 第一帧：贴近（melee.range 内）→ 发起近战前摇
    stepEnemyBehavior('gorilla', inp, st, def);
    expect(st.attack.phase).toBe('melee');
    expect(st.attack.t).toBeGreaterThan(0);
    expect(p.hp).toBe(before); // 前摇中尚未结算

    // 前摇走完 → 砸地结算
    stepEnemyBehavior('gorilla', { ...inp, dt: def.melee.windup + DT }, st, def);
    expect(p.hp).toBeLessThan(before);
  });

  it('远程投石：中距离 → 石头生成并飞行命中 → 玩家扣血', () => {
    const { e, def, st } = gorillaScene(10);
    const p = freshPlayer();
    p.x = 15; // 水平 5 格（rock.range=10 内，超出近战 2.4）
    p.y = Position.y[e] - Collider.h[e] / 2 + 0.6;
    p.inv = 0;
    const before = p.hp;

    const inp: StepInput = { e, dt: DT, target: p, dist2: 25, players: [{ state: p }] };

    // 发起投石 + 前摇走完 → 生成石头
    stepEnemyBehavior('gorilla', inp, st, def);
    expect(st.attack.phase).toBe('throw');
    expect(qEnemyRocks().length).toBe(0); // 前摇中还没有石头
    stepEnemyBehavior('gorilla', { ...inp, dt: def.rock.windup + DT }, st, def);
    expect(qEnemyRocks().length).toBe(1); // 前摇走完 → 石头抛出

    // 石头飞行直至命中（或寿命耗尽）
    let hit = false;
    for (let i = 0; i < 300 && !hit; i++) {
      stepGorillaRocks(DT, [{ state: p }]);
      if (p.hp < before) hit = true;
    }
    expect(hit).toBe(true);
    expect(p.hp).toBeLessThan(before);
  });
});