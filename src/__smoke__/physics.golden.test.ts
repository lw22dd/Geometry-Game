/**
 * 物理金测试（golden baseline）—— 冻结 stepPlayerGeneric 的逐帧行为。
 *
 * 用途：玩家物理重构（ECS 接线 / MoveMode 仲裁 / 手感数据化）期间的回归护栏。
 *       任何重构只要让这些轨迹发生变化，本测试立刻变红。
 *
 * 基线语义：
 *  - 固定步长 1/120s（与生产主循环一致）、tuned 物理模式、真实地图 neon-ascent 几何。
 *  - 物理由 stepPlayerGeneric 单帧驱动，输入永远显式传入（不依赖全局 keys）。
 *  - 场景可直接"传送/构造"玩家状态，因为物理是纯函数、无副作用。
 *  - 金测试冻结"当前真实行为"，包括已知怪癖（如 S0 出生嵌地推挤），
 *    修改这些行为必须是有意的，且同步更新 GOLDEN 基线。
 *  - 若 neon-ascent 地图几何被修改且影响到本测试所用坐标（出生点/弹簧/轨道），
 *    需在理解变化原因后同步更新基线（而非静默修改代码）。
 *
 * 环境：node（vitest 默认）。物理模块链会经渲染层加载 core/canvas（其模块作用域
 * 访问 document）→ 本文件 mock 掉 canvas；金测试本身不触达任何渲染/表现代码。
 *
 * 运行：npx vitest run src/__smoke__/physics.golden.test.ts
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';

vi.mock('../core/canvas', () => ({
  cv: {} as HTMLCanvasElement,
  ctx: {} as CanvasRenderingContext2D,
  VW: 1280,
  VH: 720,
  PPM: 48,
  DPR: 1,
  resize: () => {},
}));

import type { PlayerState, InputKeys, FrameSignals, PathSegment } from '../types';
import { stepPlayerGeneric } from '../systems/player';
import { setupLevel } from '../config';
import { setMode } from '../systems/game/gameMode';
import { buildCumulativeLengths } from '../core/path';

const DT = 1 / 120;

const idleKeys = (): InputKeys => ({
  left: false, right: false, jump: false, sprint: false,
  interact: false, hook: false, aimX: 0, aimY: 0,
});

const makeKeys = (o: Partial<InputKeys> = {}): InputKeys => ({ ...idleKeys(), ...o });

/** 与生产 PlayerController 构造完全一致的最小初始状态（金测试独立维护，勿引用生产工厂） */
function freshPlayer(x = 6, y = 4): PlayerState {
  return {
    x, y,
    velocity: { x: 0, y: 0 },
    half: 0.42,
    grounded: false, coyote: 0, jbuf: 0, face: 1,
    dead: false, deadT: 0, plat: null,
    sprint: false, wasSpr: false, inv: 0,
    extraJumps: 0, extraJumpsMax: 0,
    jumpWasDown: false, jumpFresh: false,
    impulses: [],
    track: null,
    backpack: [],
    hookCd: 0, hookMissT: 0, selectedSlot: 0,
  };
}

const r6 = (n: number): number => Math.round(n * 1e6) / 1e6;

interface Snapshot {
  x: number; y: number; vx: number; vy: number;
  /** grounded 1/0 */
  g: number;
  /** sprint 1/0 */
  s: number;
  /** 轨道行驶距离（不在轨 = -1） */
  d: number;
}

function snap(p: PlayerState): Snapshot {
  return {
    x: r6(p.x), y: r6(p.y),
    vx: r6(p.velocity.x), vy: r6(p.velocity.y),
    g: p.grounded ? 1 : 0,
    s: p.sprint ? 1 : 0,
    d: p.track ? r6(p.track.dist) : -1,
  };
}

interface Frame {
  s: Snapshot;
  sig: FrameSignals;
}

/** 逐帧步进玩家，记录每帧快照 + 物理信号 */
function runAll(p: PlayerState, inputFor: (frame: number) => InputKeys, steps: number): Frame[] {
  const frames: Frame[] = [];
  for (let i = 0; i < steps; i++) {
    const sig: FrameSignals = {};
    stepPlayerGeneric(p, inputFor(i), DT, false, sig);
    frames.push({ s: snap(p), sig });
  }
  return frames;
}

/** 按采样间隔抽取快照（保留最后一帧） */
function sampleEvery(frames: Frame[], every: number): Snapshot[] {
  const out: Snapshot[] = [];
  frames.forEach((f, i) => {
    if (i % every === 0 || i === frames.length - 1) out.push(f.s);
  });
  return out;
}

/**
 * 金基线记录 —— 2025 年 6 月于当前生产代码上捕获，禁止无意识修改。
 * 任何"物理手感有意变更"必须同步更新本表（并审查全部受影响场景）。
 * 数值为 6 位小数舍入后的确定性输出（同引擎 V8 位级可复现）。
 */
const GOLDEN = {
  /** 从 (6,5) 下落 70 帧，每 5 帧采样：~10 帧落定，之后静止 */
  S1: [
    { x: 6, y: 4.995722, vx: 0, vy: -0.513333, g: 0, s: 0, d: -1 },
    { x: 6, y: 4.910167, vx: 0, vy: -3.08, g: 0, s: 0, d: -1 },
    { x: 6, y: 4.717667, vx: 0, vy: -5.646667, g: 0, s: 0, d: -1 },
    { x: 6, y: 4.42, vx: 0, vy: 0, g: 1, s: 0, d: -1 },
    { x: 6, y: 4.42, vx: 0, vy: 0, g: 1, s: 0, d: -1 },
    { x: 6, y: 4.42, vx: 0, vy: 0, g: 1, s: 0, d: -1 },
    { x: 6, y: 4.42, vx: 0, vy: 0, g: 1, s: 0, d: -1 },
    { x: 6, y: 4.42, vx: 0, vy: 0, g: 1, s: 0, d: -1 },
    { x: 6, y: 4.42, vx: 0, vy: 0, g: 1, s: 0, d: -1 },
    { x: 6, y: 4.42, vx: 0, vy: 0, g: 1, s: 0, d: -1 },
    { x: 6, y: 4.42, vx: 0, vy: 0, g: 1, s: 0, d: -1 },
    { x: 6, y: 4.42, vx: 0, vy: 0, g: 1, s: 0, d: -1 },
    { x: 6, y: 4.42, vx: 0, vy: 0, g: 1, s: 0, d: -1 },
    { x: 6, y: 4.42, vx: 0, vy: 0, g: 1, s: 0, d: -1 },
    { x: 6, y: 4.42, vx: 0, vy: 0, g: 1, s: 0, d: -1 },
  ],
  /** 落定后按住右 120 帧，每 5 帧采样：~10 帧加速到 7，之后匀速 */
  S2: [
    { x: 6.00625, y: 4.42, vx: 0.75, vy: 0, g: 1, s: 0, d: -1 },
    { x: 6.13125, y: 4.42, vx: 4.5, vy: 0, g: 1, s: 0, d: -1 },
    { x: 6.397917, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 6.689583, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 6.98125, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 7.272917, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 7.564583, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 7.85625, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 8.147917, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 8.439583, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 8.73125, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 9.022917, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 9.314583, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 9.60625, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 9.897917, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 10.189583, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 10.48125, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 10.772917, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 11.064583, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 11.35625, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 11.647917, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 11.939583, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 12.23125, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 12.522917, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 12.75625, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
  ],
  /** 落定后按住右+冲刺 120 帧：~15 帧加速到 12，之后匀速 */
  S3: [
    { x: 6.00625, y: 4.42, vx: 0.75, vy: 0, g: 1, s: 1, d: -1 },
    { x: 6.13125, y: 4.42, vx: 4.5, vy: 0, g: 1, s: 1, d: -1 },
    { x: 6.4125, y: 4.42, vx: 8.25, vy: 0, g: 1, s: 1, d: -1 },
    { x: 6.85, y: 4.42, vx: 12, vy: 0, g: 1, s: 1, d: -1 },
    { x: 7.35, y: 4.42, vx: 12, vy: 0, g: 1, s: 1, d: -1 },
    { x: 7.85, y: 4.42, vx: 12, vy: 0, g: 1, s: 1, d: -1 },
    { x: 8.35, y: 4.42, vx: 12, vy: 0, g: 1, s: 1, d: -1 },
    { x: 8.85, y: 4.42, vx: 12, vy: 0, g: 1, s: 1, d: -1 },
    { x: 9.35, y: 4.42, vx: 12, vy: 0, g: 1, s: 1, d: -1 },
    { x: 9.85, y: 4.42, vx: 12, vy: 0, g: 1, s: 1, d: -1 },
    { x: 10.35, y: 4.42, vx: 12, vy: 0, g: 1, s: 1, d: -1 },
    { x: 10.85, y: 4.42, vx: 12, vy: 0, g: 1, s: 1, d: -1 },
    { x: 11.35, y: 4.42, vx: 12, vy: 0, g: 1, s: 1, d: -1 },
    { x: 11.85, y: 4.42, vx: 12, vy: 0, g: 1, s: 1, d: -1 },
    { x: 12.35, y: 4.42, vx: 12, vy: 0, g: 1, s: 1, d: -1 },
    { x: 12.85, y: 4.42, vx: 12, vy: 0, g: 1, s: 1, d: -1 },
    { x: 13.35, y: 4.42, vx: 12, vy: 0, g: 1, s: 1, d: -1 },
    { x: 13.85, y: 4.42, vx: 12, vy: 0, g: 1, s: 1, d: -1 },
    { x: 14.35, y: 4.42, vx: 12, vy: 0, g: 1, s: 1, d: -1 },
    { x: 14.85, y: 4.42, vx: 12, vy: 0, g: 1, s: 1, d: -1 },
    { x: 15.35, y: 4.42, vx: 12, vy: 0, g: 1, s: 1, d: -1 },
    { x: 15.85, y: 4.42, vx: 12, vy: 0, g: 1, s: 1, d: -1 },
    { x: 16.35, y: 4.42, vx: 12, vy: 0, g: 1, s: 1, d: -1 },
    { x: 16.85, y: 4.42, vx: 12, vy: 0, g: 1, s: 1, d: -1 },
    { x: 17.25, y: 4.42, vx: 12, vy: 0, g: 1, s: 1, d: -1 },
  ],
  /** 落定后点按跳跃+右行 150 帧：~45 帧完成一个跳跃弧线，之后落地继续走 */
  S4: [
    { x: 6.00625, y: 4.52961, vx: 0.75, vy: 13.153227, g: 0, s: 0, d: -1 },
    { x: 6.084375, y: 5.001828, vx: 2.625, vy: 10.119894, g: 0, s: 0, d: -1 },
    { x: 6.240625, y: 5.347657, vx: 4.5, vy: 7.08656, g: 0, s: 0, d: -1 },
    { x: 6.475, y: 5.567097, vx: 6.375, vy: 4.053227, g: 0, s: 0, d: -1 },
    { x: 6.764583, y: 5.660148, vx: 7, vy: 1.019894, g: 0, s: 0, d: -1 },
    { x: 7.05625, y: 5.631477, vx: 7, vy: -1.73344, g: 0, s: 0, d: -1 },
    { x: 7.347917, y: 5.495084, vx: 7, vy: -4.300106, g: 0, s: 0, d: -1 },
    { x: 7.639583, y: 5.251746, vx: 7, vy: -6.866773, g: 0, s: 0, d: -1 },
    { x: 7.93125, y: 4.901464, vx: 7, vy: -9.43344, g: 0, s: 0, d: -1 },
    { x: 8.222917, y: 4.444237, vx: 7, vy: -12.000106, g: 0, s: 0, d: -1 },
    { x: 8.514583, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 8.80625, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 9.097917, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 9.389583, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 9.68125, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 9.972917, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 10.264583, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 10.55625, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 10.847917, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 11.139583, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 11.43125, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 11.722917, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 12.014583, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 12.30625, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 12.597917, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 12.889583, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 13.18125, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 13.472917, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 13.764583, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 14.05625, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
    { x: 14.289583, y: 4.42, vx: 7, vy: 0, g: 1, s: 0, d: -1 },
  ],
  /** 二段跳票在身：一段跳（帧0）+ 空中二段跳（帧20）60 帧 */
  S5: [
    { x: 6, y: 4.52961, vx: 0, vy: 13.153227, g: 0, s: 0, d: -1 },
    { x: 6, y: 5.001828, vx: 0, vy: 10.119894, g: 0, s: 0, d: -1 },
    { x: 6, y: 5.347657, vx: 0, vy: 7.08656, g: 0, s: 0, d: -1 },
    { x: 6, y: 5.567097, vx: 0, vy: 4.053227, g: 0, s: 0, d: -1 },
    { x: 6, y: 5.761259, vx: 0, vy: 13.153227, g: 0, s: 0, d: -1 },
    { x: 6, y: 6.233477, vx: 0, vy: 10.119894, g: 0, s: 0, d: -1 },
    { x: 6, y: 6.579306, vx: 0, vy: 7.08656, g: 0, s: 0, d: -1 },
    { x: 6, y: 6.798746, vx: 0, vy: 4.053227, g: 0, s: 0, d: -1 },
    { x: 6, y: 6.891797, vx: 0, vy: 1.019894, g: 0, s: 0, d: -1 },
    { x: 6, y: 6.863126, vx: 0, vy: -1.73344, g: 0, s: 0, d: -1 },
    { x: 6, y: 6.726733, vx: 0, vy: -4.300106, g: 0, s: 0, d: -1 },
    { x: 6, y: 6.483395, vx: 0, vy: -6.866773, g: 0, s: 0, d: -1 },
    { x: 6, y: 6.211725, vx: 0, vy: -8.920106, g: 0, s: 0, d: -1 },
  ],
  /** 站上垂直弹簧（x100..102.5, y4..6）30 帧：vy 0.8→6.4 线性爬升 */
  S6: [
    { x: 101.25, y: 6.42, vx: 0, vy: 0.8, g: 1, s: 0, d: -1 },
    { x: 101.25, y: 6.429667, vx: 0, vy: 1.38, g: 0, s: 0, d: -1 },
    { x: 101.25, y: 6.453833, vx: 0, vy: 1.96, g: 0, s: 0, d: -1 },
    { x: 101.25, y: 6.4925, vx: 0, vy: 2.54, g: 0, s: 0, d: -1 },
    { x: 101.25, y: 6.545667, vx: 0, vy: 3.12, g: 0, s: 0, d: -1 },
    { x: 101.25, y: 6.613333, vx: 0, vy: 3.7, g: 0, s: 0, d: -1 },
    { x: 101.25, y: 6.6955, vx: 0, vy: 4.28, g: 0, s: 0, d: -1 },
    { x: 101.25, y: 6.792167, vx: 0, vy: 4.86, g: 0, s: 0, d: -1 },
    { x: 101.25, y: 6.903333, vx: 0, vy: 5.44, g: 0, s: 0, d: -1 },
    { x: 101.25, y: 7.029, vx: 0, vy: 6.02, g: 0, s: 0, d: -1 },
    { x: 101.25, y: 7.120833, vx: 0, vy: 6.406667, g: 0, s: 0, d: -1 },
  ],
  /** vx=8 接近轨道入口(130,4.42) 60 帧：帧0 捕获，直线段 dist 0→3.69 */
  S7: [
    { x: 130, y: 4.42, vx: 7.625, vy: 0, g: 0, s: 0, d: 0 },
    { x: 130.317232, y: 4.42, vx: 7.625, vy: 0, g: 0, s: 0, d: 0.317232 },
    { x: 130.633672, y: 4.42, vx: 7.625, vy: 0, g: 0, s: 0, d: 0.633672 },
    { x: 130.949321, y: 4.42, vx: 7.625, vy: 0, g: 0, s: 0, d: 0.949321 },
    { x: 131.264183, y: 4.42, vx: 7.625, vy: 0, g: 0, s: 0, d: 1.264183 },
    { x: 131.578257, y: 4.42, vx: 7.625, vy: 0, g: 0, s: 0, d: 1.578257 },
    { x: 131.891548, y: 4.42, vx: 7.625, vy: 0, g: 0, s: 0, d: 1.891548 },
    { x: 132.204056, y: 4.42, vx: 7.625, vy: 0, g: 0, s: 0, d: 2.204056 },
    { x: 132.515783, y: 4.42, vx: 7.625, vy: 0, g: 0, s: 0, d: 2.515783 },
    { x: 132.826732, y: 4.42, vx: 7.625, vy: 0, g: 0, s: 0, d: 2.826732 },
    { x: 133.136904, y: 4.42, vx: 7.625, vy: 0, g: 0, s: 0, d: 3.136904 },
    { x: 133.446302, y: 4.42, vx: 7.625, vy: 0, g: 0, s: 0, d: 3.446302 },
    { x: 133.693264, y: 4.42, vx: 7.625, vy: 0, g: 0, s: 0, d: 3.693264 },
  ],
  /** 手动构造 zipline（速 20，长 20）150 帧：120 帧到站释放，随后落地滚停 */
  S8: [
    { x: 0.166667, y: 5, vx: 0, vy: 0, g: 0, s: 0, d: 0.166667 },
    { x: 1.833333, y: 5, vx: 0, vy: 0, g: 0, s: 0, d: 1.833333 },
    { x: 3.5, y: 5, vx: 0, vy: 0, g: 0, s: 0, d: 3.5 },
    { x: 5.166667, y: 5, vx: 0, vy: 0, g: 0, s: 0, d: 5.166667 },
    { x: 6.833333, y: 5, vx: 0, vy: 0, g: 0, s: 0, d: 6.833333 },
    { x: 8.5, y: 5, vx: 0, vy: 0, g: 0, s: 0, d: 8.5 },
    { x: 10.166667, y: 5, vx: 0, vy: 0, g: 0, s: 0, d: 10.166667 },
    { x: 11.833333, y: 5, vx: 0, vy: 0, g: 0, s: 0, d: 11.833333 },
    { x: 13.5, y: 5, vx: 0, vy: 0, g: 0, s: 0, d: 13.5 },
    { x: 15.166667, y: 5, vx: 0, vy: 0, g: 0, s: 0, d: 15.166667 },
    { x: 16.833333, y: 5, vx: 0, vy: 0, g: 0, s: 0, d: 16.833333 },
    { x: 18.5, y: 5, vx: 0, vy: 0, g: 0, s: 0, d: 18.5 },
    { x: 20.163542, y: 4.995722, vx: 19.625, vy: -0.513333, g: 0, s: 0, d: -1 },
    { x: 21.627083, y: 4.717667, vx: 15.875, vy: -5.646667, g: 0, s: 0, d: -1 },
    { x: 22.7, y: 4.42, vx: 9, vy: 0, g: 1, s: 0, d: -1 },
    { x: 23, y: 4.42, vx: 0, vy: 0, g: 1, s: 0, d: -1 },
  ],
};

beforeAll(() => {
  setMode('tuned');
});

/* ==================== 场景 ==================== */

describe('S0 出生点嵌地行为（真实怪癖，有意冻结）', () => {
  it('出生点(6,4)嵌地：第 1 帧水平推挤至 x=0.42 + 吸附 y=4.42', () => {
    setupLevel('neon-ascent');
    const p = freshPlayer(6, 4); // playerSpawn = (6,4)，中心嵌入地面 R(0,0,58,4) 顶
    const frames = runAll(p, () => idleKeys(), 5);
    // 水平碰撞（vx=0 时推到最近边缘）→ 底板左端 0 → clamp 到 half=0.42
    expect(frames[0].s).toEqual({ x: 0.42, y: 4.42, vx: 0, vy: 0, g: 1, s: 0, d: -1 });
    // 之后稳定（落地状态：底边恰贴地顶，不再被推挤）
    expect(sampleEvery(frames.slice(1), 1).every(f => f.x === 0.42 && f.y === 4.42 && f.g === 1)).toBe(true);
  });
});

describe('S1 从空中落定与静止', () => {
  it('出生点上方(6,5)下落 → 40 帧内吸附到地面顶(4.42)，之后无漂移', () => {
    setupLevel('neon-ascent');
    const p = freshPlayer(6, 5); // 起点在地面顶上方（真实 resetToSpawn 的语义起点）
    const frames = runAll(p, () => idleKeys(), 70);
    const traj = sampleEvery(frames, 5);
    // 确定性轨迹与基线逐帧一致（含落定瞬间的每次重力子步）
    expect(traj).toEqual(GOLDEN.S1);
    expect(frames[40].s).toEqual({ x: 6, y: 4.42, vx: 0, vy: 0, g: 1, s: 0, d: -1 }); // 已落定
  });
});

describe('S2 平地行走', () => {
  it('按住右 120 帧：全程贴地，vx 收敛到 RUN(7)，x 单调递增', () => {
    setupLevel('neon-ascent');
    const p = freshPlayer(6, 5);
    runAll(p, () => idleKeys(), 40); // 落定
    const frames = runAll(p, () => makeKeys({ right: true }), 120);
    const traj = sampleEvery(frames, 5);
    expect(traj).toEqual(GOLDEN.S2);
    expect(traj.every(f => f.g === 1 && f.y === 4.42)).toBe(true);
    expect(frames[119].s.vx).toBeCloseTo(7, 5);
  });

  it('按住右+冲刺 120 帧：vx 收敛到 SPRINT(12)，水平位移更快', () => {
    setupLevel('neon-ascent');
    const p = freshPlayer(6, 5);
    runAll(p, () => idleKeys(), 40); // 落定
    const frames = runAll(p, () => makeKeys({ right: true, sprint: true }), 120);
    const traj = sampleEvery(frames, 5);
    expect(traj).toEqual(GOLDEN.S3);
    expect(traj.every(f => f.g === 1 && f.y === 4.42)).toBe(true);
    expect(frames[119].s.vx).toBeCloseTo(12, 5);
    expect(frames[119].s.x).toBeGreaterThan(13); // 位移 ≈ 11.2 > 行走 1s 的 7
  });
});

describe('S3 跳跃弧线', () => {
  it('落定后点按跳跃 + 持续右行：起跳 → 滞空 → 落地', () => {
    setupLevel('neon-ascent');
    const p = freshPlayer(6, 5);
    runAll(p, () => idleKeys(), 40); // 落定
    const frames = runAll(p, (i) => makeKeys({ right: true, jump: i === 0 }), 150);
    const traj = sampleEvery(frames, 5);
    expect(traj).toEqual(GOLDEN.S4);
    expect(frames[0].s.g).toBe(0);          // 跳跃帧后已离地
    expect(frames[0].s.vy).toBeGreaterThan(10);
    expect(frames[149].s.g).toBe(1);        // 落地
    expect(frames[149].s.y).toBe(4.42);
  });
});

describe('S4 二段跳（空中再跳）', () => {
  it('一段跳后空中按下跳跃边沿 → doubleJump 信号 + 再次抬升 + 次数消耗', () => {
    setupLevel('neon-ascent');
    const p = freshPlayer(6, 5);
    p.extraJumps = 1;
    p.extraJumpsMax = 1;
    runAll(p, () => idleKeys(), 40); // 落定（落定刷新 extraJumps = extraJumpsMax）
    const frames = runAll(p, (i) => makeKeys({ jump: i === 0 || i === 20 }), 60);
    const traj = sampleEvery(frames, 5);
    expect(traj).toEqual(GOLDEN.S5);
    expect(frames[0].s.g).toBe(0);               // 一段跳离地
    expect(frames[20].sig.doubleJump).toBe(true); // 空中第 20 帧二次按下 → 二段跳
    expect(frames[21].s.vy).toBeGreaterThan(0);   // 再次抬升
    expect(p.extraJumps).toBe(0);                 // 次数已消耗
  });
});

describe('S5 弹簧平台', () => {
  it('站在弹射台上 → spring 信号 + vy 持续抬升', () => {
    setupLevel('neon-ascent');
    // 地图垂直弹簧（x=100..102.5, y=4..6, top=6，默认 VERTICAL_SPRING w2.5×h2 force(0,96) dur 0.3）
    // 站立中心 = top + half = 6.42（底边恰贴弹簧顶 → 水平推挤被跳过）
    const p = freshPlayer(101.25, 6.42);
    const frames = runAll(p, () => idleKeys(), 30);
    const traj = sampleEvery(frames, 3);
    expect(traj).toEqual(GOLDEN.S6);
    expect(frames[0].sig.spring).toBe(true);
    expect(frames[0].s.vy).toBeGreaterThan(0);
    expect(frames[29].s.vy).toBeGreaterThan(4);   // 净加速度为正
  });
});

describe('S6 轨道捕获与滑行', () => {
  it('高速接近入口 → 捕获（trackEntered）→ 沿直线段滑动', () => {
    setupLevel('neon-ascent');
    // 轨道：直线 (130,4.42)→(140,4.42) + 右半圆弧；入口 (130,4.42)，speedThreshold=0
    const p = freshPlayer(129.5, 4.42);
    p.velocity.x = 8;
    const frames = runAll(p, () => idleKeys(), 60);
    const traj = sampleEvery(frames, 5);
    expect(traj).toEqual(GOLDEN.S7);
    expect(frames[0].sig.trackEntered).toBe(true);
    expect(p.track).not.toBeNull();
    expect(frames[59].s.d).toBeGreaterThan(2.5);  // 仍在直线段（dist<10）前进
    expect(frames[59].s.d).toBeLessThan(10);
    expect(frames[59].s.g).toBe(0);
  });
});

describe('S7 坠落死亡', () => {
  it('y < -8 → dead 标记置位', () => {
    setupLevel('neon-ascent');
    const p = freshPlayer(6, -10);
    const frames = runAll(p, () => idleKeys(), 1);
    expect(p.dead).toBe(true);
    expect(frames[0].s.y).toBeLessThan(-8);
  });
});

describe('S8 滑索（zipline 轨道）', () => {
  it('匀速滑行 120 帧到站 → 释放为切线速度', () => {
    setupLevel('neon-ascent');
    const p = freshPlayer(6, 4);
    const segs: PathSegment[] = [{ type: 'line', x1: 0, y1: 5, x2: 20, y2: 5 }];
    const cl = buildCumulativeLengths(segs);
    p.track = {
      segments: segs, cumulative: cl, dist: 0, speed: 20,
      totalLength: cl[cl.length - 1], entryDist: 0, exitDist: 20, zipline: true,
    };
    const frames = runAll(p, () => idleKeys(), 150);
    const traj = sampleEvery(frames, 10);
    expect(traj).toEqual(GOLDEN.S8);
    // 匀速：60 帧前进 10 格
    expect(frames[59].s.d).toBeCloseTo(10, 5);
    // 120 帧到站（释放瞬间的帧快照）→ trackExited + 切线速度 20
    expect(frames[119].sig.trackExited).toBe(true);
    expect(frames[119].s.vx).toBeCloseTo(20, 5);
    expect(frames[119].s.x).toBe(20);
    expect(frames[119].s.y).toBe(5);
    // 释放后 track 清空
    expect(p.track).toBeNull();
  });
});