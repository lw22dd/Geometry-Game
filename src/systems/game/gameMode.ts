/**
 * 游戏模式（GameMode）—— 与 GameState 分离的独立模块。
 * 双物理模式：tuned（调优）/ classic（经典）。
 */
export type PhysicsKey = 'tuned' | 'classic';

let _mode: PhysicsKey = 'tuned';

export const getMode = (): PhysicsKey => _mode;
export const setMode = (m: PhysicsKey): void => { _mode = m; };
