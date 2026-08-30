/**
 * Audio —— 音效播放函数（参考 zombie-world 模型：武器音效独立成文件）。
 *
 * 职责：只放「如何发声」的函数，不放游戏逻辑；游戏逻辑经 core/audio 的 sfx 表
 * 做薄分发调用到这里。core/audio 仍提供 ADSR 体系（osc / noise + envelope）与总线，
 * 本目录提供面向打击乐 / 机械声的脉冲模型原语（sweep / noiseHit）。
 */
export { sweep, noiseHit } from './utils';
export { playAKFire, playAKReload, playAKDryfire, playAKPickup } from './weapons/ak';