/**
 * S3 控制权仲裁冒烟测试 —— 验证优先级表 + ControlMode 组件写入。
 * 优先级：dead > zipline > track > free（spring/sprint 为扩展位）。
 * 运行：npx vitest run src/__smoke__/controlMode.smoke.test.ts
 */
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

// 物理模块链会经渲染层加载 core/canvas（其模块作用域访问 document）→ mock（同金测试）
vi.mock('../core/canvas', () => ({
  cv: {} as HTMLCanvasElement,
  ctx: {} as CanvasRenderingContext2D,
  VW: 1280,
  VH: 720,
  PPM: 48,
  DPR: 1,
  resize: () => {},
}));

import { initEcs, clearWorld, ControlMode,
  CONTROL_MODE_FREE, CONTROL_MODE_TRACK, CONTROL_MODE_ZIPLINE, CONTROL_MODE_DEAD, CONTROL_MODE_CONSTRAINT } from '../core/ecs';
import {
  resolveControlMode, writeControlMode, stepControlArbiter,
} from '../systems/player/controlArbiter';
import { stepPlayerGeneric, stepPlayerByMode } from '../systems/player';
import { ensurePlayerEntity } from '../systems/player/playerEntity';
import { createPlayerState } from '../systems/player/createPlayerState';
import { setupLevel } from '../config';
import { setMode } from '../systems/game/gameMode';
import type { PlayerState, TrackState, InputKeys } from '../types';

/** 最小轨道状态（普通轨道） */
function makeTrack(): TrackState {
  return {
    segments: [{ type: 'line', x1: 0, y1: 0, x2: 10, y2: 0 }],
    cumulative: [0, 10],
    dist: 1,
    speed: 5,
    totalLength: 10,
    entryDist: 0,
    exitDist: 10,
  };
}

beforeEach(() => {
  initEcs();
  clearWorld();
});

describe('resolveControlMode 优先级表', () => {
  it('自由状态 → FREE', () => {
    const p = createPlayerState(0, 0);
    expect(resolveControlMode(p)).toBe(CONTROL_MODE_FREE);
  });

  it('普通轨道（非滑索）→ TRACK', () => {
    const p = createPlayerState(0, 0);
    p.track = makeTrack();
    expect(resolveControlMode(p)).toBe(CONTROL_MODE_TRACK);
  });

  it('滑索轨道 → ZIPLINE（压过 TRACK）', () => {
    const p = createPlayerState(0, 0);
    p.track = { ...makeTrack(), zipline: true };
    expect(resolveControlMode(p)).toBe(CONTROL_MODE_ZIPLINE);
  });

  it('死亡压过一切（含在轨）→ DEAD', () => {
    const p = createPlayerState(0, 0);
    p.track = { ...makeTrack(), zipline: true };
    p.dead = true;
    expect(resolveControlMode(p)).toBe(CONTROL_MODE_DEAD);
  });
});

describe('stepControlArbiter 写 ControlMode 组件', () => {
  it('玩家实体上仲裁结果写入组件槽位', () => {
    const eid = ensurePlayerEntity(1);
    const p: PlayerState = createPlayerState(0, 0);
    expect(ControlMode.mode[eid]).toBe(CONTROL_MODE_FREE); // 挂载初始值

    stepControlArbiter(p, eid);
    expect(ControlMode.mode[eid]).toBe(CONTROL_MODE_FREE);

    p.track = makeTrack();
    stepControlArbiter(p, eid);
    expect(ControlMode.mode[eid]).toBe(CONTROL_MODE_TRACK);

    p.dead = true;
    stepControlArbiter(p, eid);
    expect(ControlMode.mode[eid]).toBe(CONTROL_MODE_DEAD);
  });

  it('writeControlMode 对未接线 eid 静默跳过（不抛错）', () => {
    expect(() => writeControlMode(-1, CONTROL_MODE_DEAD)).not.toThrow();
  });
});

describe('S3 消费侧：stepPlayerByMode 分派（MovementSystem 读 ControlMode）', () => {
  const DT = 1 / 120;
  const idle = (): InputKeys => ({ left: false, right: false, jump: false, sprint: false, interact: false, hook: false, aimX: 0, aimY: 0 });

  beforeAll(() => {
    setMode('tuned');
    setupLevel('neon-ascent');
  });

  it('TRACK → 轨道分派（沿路径前进，不施加自由重力）', () => {
    const p = createPlayerState(0, 0);
    p.track = makeTrack(); // 直线 (0,0)→(10,0)，dist=1 speed=5
    const d0 = p.track.dist;
    stepPlayerByMode(p, CONTROL_MODE_TRACK, idle(), DT, false);
    expect(p.track.dist).toBeGreaterThan(d0);
    expect(p.velocity.y).toBe(0); // 在轨不走自由物理
  });

  it('ZIPLINE → 滑索匀速前进（忽略切向重力/摩擦）', () => {
    const p = createPlayerState(0, 0);
    p.track = { ...makeTrack(), zipline: true, speed: 5 };
    stepPlayerByMode(p, CONTROL_MODE_ZIPLINE, idle(), DT, false);
    expect(p.track.dist).toBeCloseTo(1 + 5 * DT, 10);
  });

  it('DEAD → 无物理（位置/速度原样保留，交生命周期处理）', () => {
    const p = createPlayerState(6, 5);
    p.velocity.x = 3;
    const x = p.x, y = p.y, vx = p.velocity.x;
    stepPlayerByMode(p, CONTROL_MODE_DEAD, idle(), DT, false);
    expect(p.x).toBe(x);
    expect(p.y).toBe(y);
    expect(p.velocity.x).toBe(vx);
  });

  it('CONSTRAINT（眩晕/定身扩展位）→ 冻结：跳过自由输入积分，仅衰减计时', () => {
    const p = createPlayerState(6, 5);
    p.velocity.x = 3;
    p.inv = 1;
    const x = p.x, y = p.y, vx = p.velocity.x, vy = p.velocity.y;
    stepPlayerByMode(p, CONTROL_MODE_CONSTRAINT, idle(), DT, false);
    expect(p.x).toBe(x);
    expect(p.y).toBe(y);
    expect(p.velocity.x).toBe(vx);
    expect(p.velocity.y).toBe(vy);
    expect(p.inv).toBeCloseTo(1 - DT, 10); // 计时仍衰减
  });

  it('FREE → 与 stepPlayerGeneric 逐位一致（行为保持，金测试护栏）', () => {
    const a = createPlayerState(6, 5);
    const b = createPlayerState(6, 5);
    const input = idle();
    stepPlayerGeneric(a, input, DT, false);
    stepPlayerByMode(b, resolveControlMode(b), input, DT, false);
    expect(b.x).toBe(a.x);
    expect(b.y).toBe(a.y);
    expect(b.velocity.x).toBe(a.velocity.x);
    expect(b.velocity.y).toBe(a.velocity.y);
    expect(b.grounded).toBe(a.grounded);
  });
});
