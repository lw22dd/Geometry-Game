/**
 * 音频全局状态（叶子模块，无任何依赖）。
 *
 * 职责：单独承载 AU 单例，供两处共同读写：
 *  - core/audio.ts：引擎初始化/总线/合成原语（写 AU 字段）
 *  - Audio/utils.ts：音效播放函数（只读 AU.ctx / AU.sfxBus / AU.noise / AU.on）
 *
 * 存在理由：core/audio.ts import '../Audio'（AK 播放函数），而 Audio/utils.ts 需要
 * AU —— 若都从 core/audio 取会形成模块级循环依赖。把 AU 抽为叶子后，
 * Audio/utils → core/audioState（单向），循环断裂。
 */

/** 全局音频状态（向后兼容：ctx / on / master / noise 字段名保持不变） */
export const AU = {
  ctx: null as AudioContext | null,
  /** 总开关（= !Settings.muted，随设置同步） */
  on: true,
  /** 主总线增益节点 */
  master: null as GainNode | null,
  /** 白噪声缓冲（噪声类音效共用） */
  noise: null as AudioBuffer | null,
  /** 音效总线 */
  sfxBus: null as GainNode | null,
  /** 音乐总线 */
  bgmBus: null as GainNode | null,
  /** 限幅器（防叠加削波） */
  comp: null as DynamicsCompressorNode | null,
};
