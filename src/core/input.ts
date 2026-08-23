/**
 * 键盘输入 —— 维护按键状态表 keys。
 * 游戏逻辑通过回调（由 systems/game 注入）处理按键语义；
 * 本模块只负责「按了/松开」与浏览器默认行为拦截。
 */
import { auInit, AU } from './audio';

export const keys: Record<string, boolean> = {};

export type InputHandler = (e: KeyboardEvent) => void;
let handler: InputHandler = () => {};

/** 注册游戏按键处理器（仅一个） */
export function setInputHandler(h: InputHandler): void {
  handler = h;
}

export function initInput(): void {
  addEventListener('keydown', (e: KeyboardEvent) => {
    if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    // 首次交互时解锁 / 恢复音频上下文
    auInit();
    if (AU.ctx && AU.ctx.state === 'suspended') AU.ctx.resume();
    if (e.repeat) return;
    keys[e.code] = true;
    handler(e);
  });
  addEventListener('keyup', (e: KeyboardEvent) => {
    keys[e.code] = false;
  });
  addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
  });
}