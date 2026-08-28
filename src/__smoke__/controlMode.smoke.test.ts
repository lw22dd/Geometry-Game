/**
 * S3 控制权仲裁冒烟测试 —— 验证优先级表 + ControlMode 组件写入。
 * 优先级：dead > zipline > track > free（spring/sprint 为扩展位）。
 * 运行：npx vitest run src/__smoke__/controlMode.smoke.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { initEcs, clearWorld, ControlMode,
  CONTROL_MODE_FREE, CONTROL_MODE_TRACK, CONTROL_MODE_ZIPLINE, CONTROL_MODE_DEAD } from '../core/ecs';
import {
  resolveControlMode, writeControlMode, stepControlArbiter,
} from '../systems/player/controlArbiter';
import { ensurePlayerEntity } from '../systems/player/playerEntity';
import { createPlayerState } from '../systems/player/createPlayerState';
import type { PlayerState, TrackState } from '../types';

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
