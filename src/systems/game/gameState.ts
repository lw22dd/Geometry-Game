/**
 * 游戏全局状态（singleton）—— 调度中枢持有。
 * 拆为独立模块以避免 systems 之间的循环依赖；
 * game/index、player、world、ui 均通过此模块读写共享状态。
 *
 * 物理模式（GameMode）已移至 ./mode.ts。
 */
import type { GameState } from '../../types';

/** 可变的游戏全局状态 */
export const gs: GameState = {
  time: 0,
  gt: 0,
  gotN: 0,
  deaths: 0,
  win: false,
  winTime: 0,
  started: false,
  screen: 'menu',
  scene: 'menu',
  toast: '',
  toastT: 0,
  flash: 0,
  shake: 0,
  hitstop: 0,
  cipherTotal: 0,
};