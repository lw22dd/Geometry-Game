/**
 * 游戏全局状态（singleton）—— 调度中枢持有。
 * 拆为独立模块以避免 systems 之间的循环依赖；
 * game/index、player、world、ui 均通过此模块读写共享状态。
 */
import type { GameState } from '../../types';

type PhysicsKey = 'tuned' | 'classic';

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
  toast: '',
  toastT: 0,
  flash: 0,
  shake: 0,
};

/** 当前物理模式（通过 getter/setter 避免 ESM 只读绑定限制） */
let _mode: PhysicsKey = 'tuned';
export const getMode = (): PhysicsKey => _mode;
export const setMode = (m: PhysicsKey): void => { _mode = m; };