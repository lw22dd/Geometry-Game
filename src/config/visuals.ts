import type { MapTheme, QualityTier } from '../types';

/** 画质档位（定义在 types，供 core/settings 与 config 共用；此处 re-export 兼容旧引用） */
export type { QualityTier };

/**
 * 视觉参数注册表 —— 后期特效 / 粒子 / 屏幕反馈 / 速度线的集中调参。
 * 与物理手感参数（physics.ts）分开维护：本文件只涉及"观感"，不涉及"手感"。
 * 消费者：systems/postfx（管线参数）、systems/particles（池上限与发射倍率）、
 *         systems/game（震屏与命中停顿）、Prefabs/Scenes/atmosphere（速度线）、
 *         core/settings（画质档位写回本表）。
 * 只依赖 types。
 *
 * 重要：VIS.postfx 与 systems/postfx 的 PFX 是**同一个对象引用**，
 * 档位切换必须原地写字段（applyQuality），禁止整体替换，否则外部持有的引用失效。
 */

/** 后期特效参数组 */
export interface PostFXTuning {
  /** 泛光总开关 */
  bloomOn: boolean;
  /** 泛光离屏分辨率比例 */
  bloomScale: number;
  /** 泛光叠加强度 */
  bloomAlpha: number;
  /** 泛光模糊半径（离屏像素） */
  bloomBlur: number;
  /** 亮部提取阈值（0..1，越高只有越亮的像素参与泛光，避免整体发灰） */
  bloomThreshold: number;
  /** 色散残影 */
  chromaOn: boolean;
  /** 色散偏移 px */
  chromaShift: number;
  /** 径向模糊（速度感）总开关 */
  radialOn: boolean;
  /** 径向模糊最大强度（0..1） */
  radialMax: number;
  /** 暗角 */
  vignetteOn: boolean;
  /** 暗角起始（短边比例） */
  vignetteInner: number;
  /** 暗角加深 */
  vignetteAlpha: number;
  /** CRT 扫描线 */
  scanOn: boolean;
  /** 扫描线间隔 px */
  scanGap: number;
  scanAlpha: number;
  /** 胶片颗粒 */
  grainOn: boolean;
  grainAlpha: number;
  /** 色调映射 / 分区调色 */
  tintOn: boolean;
  /** 调色叠加强度 */
  tintA: number;
}

/** 粒子预算 */
export interface ParticleTuning {
  /** 粒子池上限（超限从头剔除） */
  poolMax: number;
  /** 发射数量倍率（1 = 预设原值） */
  emitScale: number;
}

/** 屏幕反馈（震屏 + 命中停顿） */
export interface ScreenTuning {
  /** 震屏最大位移（逻辑像素，trauma=1 时） */
  shakeAmp: number;
  /** 震屏每秒衰减系数（指数衰减） */
  shakeDecay: number;
  /** 震屏噪声频率 */
  shakeFreq: number;
  /** 单次命中停顿上限（秒） */
  hitstopMax: number;
  /** 护盾格挡震屏强度（trauma 值，0..1；死亡=1，弹簧=0.25，格挡取中间） */
  shieldShake: number;
  /** 玩家受击（未死）震屏强度（trauma 值；死亡=1，受击略弱一档） */
  hurtShake: number;
}

/** 高速速度线 */
export interface SpeedLineTuning {
  /** 触发速度阈值（m/s） */
  speedThreshold: number;
  /** 线条数量 */
  count: number;
  /** 线条长度（逻辑像素） */
  len: number;
  /** 最大透明度 */
  alpha: number;
}

/** 视觉调参总表 */
export interface VisualTuning {
  postfx: PostFXTuning;
  particles: ParticleTuning;
  screen: ScreenTuning;
  speedLines: SpeedLineTuning;
}

/** 各档位的参数覆盖（缺省字段沿用 high 档） */
type QualityPreset = {
  postfx: Partial<PostFXTuning>;
  particles: Partial<ParticleTuning>;
};

const HIGH: QualityPreset = {
  postfx: {},
  particles: {},
};

const MEDIUM: QualityPreset = {
  postfx: {
    bloomOn: true, bloomScale: 0.2, bloomAlpha: 0.26, bloomBlur: 3,
    chromaOn: false, radialOn: false,
    grainOn: true, grainAlpha: 0.025,
    scanOn: true, tintOn: true,
  },
  particles: { poolMax: 280, emitScale: 0.8 },
};

const LOW: QualityPreset = {
  postfx: {
    bloomOn: true, bloomScale: 0.18, bloomAlpha: 0.22, bloomBlur: 2,
    chromaOn: false, radialOn: false,
    grainOn: false, scanOn: false, tintOn: false,
    vignetteOn: true, vignetteAlpha: 0.45,
  },
  particles: { poolMax: 140, emitScale: 0.55 },
};

const PRESETS: Record<Exclude<QualityTier, 'auto'>, QualityPreset> = {
  high: HIGH,
  medium: MEDIUM,
  low: LOW,
};

/** high 档的完整基线（切档时先回滚到此，再套用覆盖） */
const BASE: VisualTuning = {
  postfx: {
    bloomOn: true,
    bloomScale: 0.22,
    bloomAlpha: 0.28,
    bloomBlur: 4,
    bloomThreshold: 0.5,
    chromaOn: true,
    chromaShift: 1.2,
    radialOn: true,
    radialMax: 0.5,
    vignetteOn: true,
    vignetteInner: 0.45,
    vignetteAlpha: 0.5,
    scanOn: true,
    scanGap: 3,
    scanAlpha: 0.05,
    grainOn: true,
    grainAlpha: 0.03,
    tintOn: true,
    tintA: 0.16,
  },
  particles: {
    poolMax: 420,
    emitScale: 1,
  },
  screen: {
    shakeAmp: 16,
    shakeDecay: 3.6,
    shakeFreq: 22,
    hitstopMax: 0.12,
    shieldShake: 0.42,
    hurtShake: 0.85,
  },
  speedLines: {
    speedThreshold: 16,
    count: 10,
    len: 46,
    alpha: 0.3,
  },
};

/** 运行期视觉参数（唯一真源；systems/postfx 的 PFX 即本对象的 postfx 引用） */
export const VIS: VisualTuning = {
  postfx: { ...BASE.postfx },
  particles: { ...BASE.particles },
  screen: { ...BASE.screen },
  speedLines: { ...BASE.speedLines },
};

/**
 * 应用画质档位 —— 原地写回 VIS 字段（不替换对象引用）。
 * 'auto' 视为 high 基线，实际降级由 systems/postfx 的 pfxPerf 动态处理。
 */
export function applyQuality(tier: QualityTier): void {
  const preset = PRESETS[tier === 'auto' ? 'high' : tier];
  // 先回滚到 high 基线，再套用档位覆盖（保证未覆盖字段回到默认值）
  Object.assign(VIS.postfx, BASE.postfx);
  Object.assign(VIS.particles, BASE.particles);
  Object.assign(VIS.postfx, preset.postfx);
  Object.assign(VIS.particles, preset.particles);
}

/** 曳光轨迹寿命（秒） */
export const TLIFE = 0.5;

/**
 * 默认地图主题配色 —— 地图未声明 theme 时的回退值（沿用升级前的霓虹紫青调）。
 * 地图要换调子只需在 config/level 的地图定义里加 theme 字段。
 */
export const DEFAULT_MAP_THEME: MapTheme = {
  hueA: 196,
  hueB: 296,
  grid: '120,150,255',
  border: '150,120,255',
  fog: '90,70,180',
  accent: '125,249,255',
  far: ['96,140,255', '168,110,255'],
  mid: ['140,190,255', '190,130,255'],
};
