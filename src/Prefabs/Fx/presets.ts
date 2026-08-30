/**
 * 特效预设表 —— 粒子特效发射参数（预制体化数据模板）。
 * 每个特效 = 一条纯数据，由 systems/particles 的 spawnParticles 统一发射。
 */
import type { ParticleKind } from '../../types';

/** 速度模式：radial = 圆周/随机方向；axis = 独立 vx/vy */
export type FxVel =
  | { mode: 'radial'; uniform: boolean; speed: [number, number]; vyBias?: number }
  | { mode: 'axis'; vx: [number, number]; vy: [number, number] };

/** 特效预设模板 */
export interface FxPreset {
  count: number;
  kind: ParticleKind;
  vel: FxVel;
  /** 初始位置散布（米，X 方向 ±） */
  spreadX?: number;
  gravity: number;
  life: [number, number];
  size: [number, number];
  /** 交替取色（i % colors.length） */
  colors: string[];
  /** frag 专用：旋转起始范围 / 角速度范围 */
  spin?: { start: [number, number]; rate: [number, number] };
  /** streak 专用：拖尾长度范围（世界米） */
  len?: [number, number];
  /** ring / shock 专用：起始半径范围（世界米） */
  r0?: [number, number];
  /** ring / shock 专用：结束半径范围（世界米） */
  r1?: [number, number];
  /** ring / shock / streak 专用：描边线宽（逻辑像素） */
  lw?: number;
}

/** 特效预设注册表 */
export const FX: Record<string, FxPreset> = {
  /** 死亡爆裂：16 碎片，随机方向，青/紫，旋转 */
  death: {
    count: 16,
    kind: 'frag',
    vel: { mode: 'radial', uniform: false, speed: [4, 13], vyBias: 3 },
    gravity: 22,
    life: [0.7, 1.1],
    size: [0.14, 0.26],
    colors: ['#7de8ff', '#c77dff'],
    spin: { start: [0, 3], rate: [-7, 7] },
  },

  /** 落地尘土：小幅上抛，青灰 dot */
  dust: {
    count: 6,
    kind: 'dot',
    vel: { mode: 'axis', vx: [-1.5, 1.5], vy: [0, 2] },
    spreadX: 0.3,
    gravity: 5,
    life: [0.35, 0.35],
    size: [0.08, 0.08],
    colors: ['#9fb8ff'],
  },

  /** 收集闪光：14 射线均匀扩散，白/青交替 */
  sparkle: {
    count: 14,
    kind: 'dot',
    vel: { mode: 'radial', uniform: true, speed: [3.5, 3.5] },
    gravity: 0,
    life: [0.5, 0.5],
    size: [0.09, 0.09],
    colors: ['#ffffff', '#8ff6ff'],
  },

  /** 检查点光柱：x 散布上升，青色 dot */
  cp: {
    count: 10,
    kind: 'dot',
    vel: { mode: 'axis', vx: [0, 0], vy: [2, 5] },
    spreadX: 0.7,
    gravity: 0,
    life: [0.8, 0.8],
    size: [0.08, 0.08],
    colors: ['#7df9ff'],
  },

  /** 通关彩带：80 碎片随机方向，四色交替，旋转 */
  confetti: {
    count: 80,
    kind: 'frag',
    vel: { mode: 'radial', uniform: false, speed: [3, 11], vyBias: 4 },
    gravity: 12,
    life: [1.2, 1.2],
    size: [0.12, 0.12],
    colors: ['#7de8ff', '#c77dff', '#ff8ad8', '#ffffff'],
    spin: { start: [0, 3], rate: [-5, 5] },
  },

  /** 双跳增益环绕：小绿色箭头持续飘散 */
  arrowBoost: {
    count: 2,
    kind: 'arrow',
    vel: { mode: 'radial', uniform: false, speed: [0.3, 1.0], vyBias: 0.5 },
    gravity: 0,
    life: [0.8, 1.4],
    size: [0.08, 0.12],
    colors: ['#66ff99', '#33cc66', '#99ffbb'],
  },

  /** 二段跳触发：玩家下方绿色粒子上扬（参考落地尘土，绿色版） */
  doubleJump: {
    count: 8,
    kind: 'dot',
    vel: { mode: 'axis', vx: [-1.6, 1.6], vy: [0.5, 2.2] },
    spreadX: 0.3,
    gravity: 5,
    life: [0.35, 0.5],
    size: [0.08, 0.12],
    colors: ['#66ff99', '#33cc66', '#99ffbb'],
  },

  /** 护盾破碎：蓝紫碎片环（危险物命中格挡时爆开） */
  shieldBreak: {
    count: 14,
    kind: 'frag',
    vel: { mode: 'radial', uniform: false, speed: [3, 9] },
    gravity: 10,
    life: [0.45, 0.7],
    size: [0.1, 0.18],
    colors: ['#b3c7ff', '#7d6bff', '#ffffff'],
    spin: { start: [0, 3], rate: [-6, 6] },
  },

  /** 加速拾取：青白横向冲刺射线（沿 ±X 扩散，冲刺感） */
  speedBoost: {
    count: 12,
    kind: 'dot',
    vel: { mode: 'axis', vx: [-7, 7], vy: [-1.2, 1.2] },
    gravity: 0,
    life: [0.4, 0.6],
    size: [0.07, 0.1],
    colors: ['#8ff6ff', '#ffffff', '#59d4ff'],
  },

  /** 光球环境光尘：单颗缓慢上浮，青白（emitItemAmbient 每 0.5s 发 1 颗） */
  orbAmbient: {
    count: 1,
    kind: 'dot',
    vel: { mode: 'radial', uniform: false, speed: [0.15, 0.4] },
    gravity: -0.8,
    life: [1.0, 1.6],
    size: [0.04, 0.07],
    colors: ['#bfffff', '#8ff6ff'],
  },

  /** 弹簧弹射火花：绿色上喷（弹簧 firing 时于顶板中心发射一次） */
  springBurst: {
    count: 10,
    kind: 'dot',
    vel: { mode: 'axis', vx: [-2.2, 2.2], vy: [5, 10] },
    spreadX: 0.3,
    gravity: 16,
    life: [0.35, 0.6],
    size: [0.05, 0.09],
    colors: ['#7dffb0', '#c8ffe0', '#59ff8f'],
  },

  /** 激光命中火花：品红碎屑（接触瞬间发射） */
  laserHit: {
    count: 12,
    kind: 'frag',
    vel: { mode: 'radial', uniform: false, speed: [3, 8], vyBias: 2 },
    gravity: 14,
    life: [0.4, 0.7],
    size: [0.08, 0.14],
    colors: ['#ff8ad8', '#ffffff', '#ff5fc8'],
    spin: { start: [0, 3], rate: [-8, 8] },
  },

  /** NOVA 通关脉冲：24 颗金色射线均匀扩散（win 触发时发射一次） */
  novaPulse: {
    count: 24,
    kind: 'dot',
    vel: { mode: 'radial', uniform: true, speed: [4, 4] },
    gravity: 0,
    life: [0.7, 0.7],
    size: [0.07, 0.07],
    colors: ['#ffe9a8', '#fff3cf', '#ffffff'],
  },

  /* ── 美术升级：冲击类特效（配合命中停顿使用）── */

  /** 死亡冲击波：外扩描边圆（与 death 碎片同时发射，强化爆开感） */
  deathShock: {
    count: 1,
    kind: 'shock',
    vel: { mode: 'axis', vx: [0, 0], vy: [0, 0] },
    gravity: 0,
    life: [0.42, 0.42],
    size: [0.1, 0.1],
    colors: ['#ff6ad5', '#7de8ff'],
    r0: [0.3, 0.3],
    r1: [3.6, 4.4],
    lw: 3,
  },

  /** 破盾环：快速外扩的蓝白光圈 */
  shieldRing: {
    count: 1,
    kind: 'ring',
    vel: { mode: 'axis', vx: [0, 0], vy: [0, 0] },
    gravity: 0,
    life: [0.38, 0.38],
    size: [0.1, 0.1],
    colors: ['#b3c7ff', '#ffffff'],
    r0: [0.2, 0.2],
    r1: [2.4, 2.9],
    lw: 2.5,
  },

  /** 冲刺火花：沿速度方向的短拖尾（发射时按玩家朝向给 vx 符号） */
  dashStreak: {
    count: 8,
    kind: 'streak',
    vel: { mode: 'axis', vx: [-9, 9], vy: [-1.5, 1.5] },
    gravity: 0,
    life: [0.18, 0.32],
    size: [0.05, 0.09],
    colors: ['#8ff6ff', '#ffffff', '#59d4ff'],
    len: [0.5, 1.1],
    lw: 2,
  },

  /* ── 战斗特效（S2/S3）── */

  /** 枪口火光：短促黄白射线（AK 开火帧发射） */
  muzzleFlash: {
    count: 6,
    kind: 'dot',
    vel: { mode: 'axis', vx: [-1.5, 1.5], vy: [-0.5, 4] },
    spreadX: 0.12,
    gravity: 0,
    life: [0.08, 0.16],
    size: [0.07, 0.13],
    colors: ['#fff3cf', '#ffcf5a', '#ffffff'],
  },

  /** 命中火花：黄白碎片（hitscan 命中敌人时） */
  hitSpark: {
    count: 6,
    kind: 'frag',
    vel: { mode: 'radial', uniform: false, speed: [2, 6] },
    gravity: 12,
    life: [0.2, 0.4],
    size: [0.06, 0.12],
    colors: ['#fff3cf', '#ffb347', '#ffffff'],
    spin: { start: [0, 3], rate: [-9, 9] },
  },

  /** 武器拾取闪光：橙金碎片 + 上行光点（拾取 AK / 手雷时） */
  weaponSpark: {
    count: 10,
    kind: 'frag',
    vel: { mode: 'radial', uniform: false, speed: [3, 7], vyBias: 3 },
    gravity: 14,
    life: [0.35, 0.6],
    size: [0.07, 0.14],
    colors: ['#ffcf5a', '#ff7a3d', '#fff3cf', '#ffffff'],
    spin: { start: [0, 3], rate: [-10, 10] },
  },

  /** 手雷爆炸：橙红碎片 + 上升火舌 */
  grenadeBoom: {
    count: 20,
    kind: 'frag',
    vel: { mode: 'radial', uniform: false, speed: [4, 11], vyBias: 3 },
    gravity: 16,
    life: [0.4, 0.7],
    size: [0.1, 0.22],
    colors: ['#ffb347', '#ff6a3d', '#ffe9a8', '#ffffff'],
    spin: { start: [0, 3], rate: [-8, 8] },
  },

  /** 手雷爆炸冲击环：外扩描边圆（爆炸瞬间，强化范围感） */
  grenadeShock: {
    count: 1,
    kind: 'shock',
    vel: { mode: 'axis', vx: [0, 0], vy: [0, 0] },
    gravity: 0,
    life: [0.35, 0.35],
    size: [0.1, 0.1],
    colors: ['#ffb347', '#ffffff'],
    r0: [0.3, 0.3],
    r1: [2.8, 3.4],
    lw: 3,
  },

  /** 敌人死亡：红紫爆裂 + 冲击环 */
  enemyDeath: {
    count: 14,
    kind: 'frag',
    vel: { mode: 'radial', uniform: false, speed: [3, 9], vyBias: 2 },
    gravity: 12,
    life: [0.45, 0.75],
    size: [0.1, 0.2],
    colors: ['#ff6a6a', '#c77dff', '#ff9ad8', '#ffffff'],
    spin: { start: [0, 3], rate: [-7, 7] },
  },
};