/**
 * 磁铁道具动画控制器 —— 悬浮/摇摆（与双跳票/钩锁同款 hover 参数）。
 *
 * 模块加载时自注册到注册表（副作用导入由 systems/animation 触发；
 * 工厂经 createMagnetAnimState 预初始化 phase）。
 */
import { gs } from '../../systems/game/gameState';
import type { AnimatorController, AnimOutput } from './types';
import { registerAnimator } from './registry';

interface MagnetAnimState {
  state: 'idle';
  stateTime: number;
  phase: number;
}

/** 创建磁铁动画状态（工厂装配 Animator 时预初始化 phase） */
export function createMagnetAnimState(init?: Record<string, number>): MagnetAnimState {
  return { state: 'idle', stateTime: 0, phase: init?.phase ?? 0 };
}

const magnetController: AnimatorController = {
  id: 'magnet',

  createState(init?: Record<string, number>): unknown {
    return createMagnetAnimState(init);
  },

  step(state: unknown, _entity: number, _dt: number): void {
    const s = state as MagnetAnimState;
    s.stateTime += _dt;
  },

  getOutput(state: unknown, _entity: number): AnimOutput {
    const s = state as MagnetAnimState;
    const t = gs.time;
    const phase = s.phase;

    return {
      scaleX: 1, scaleY: 1,
      rotation: Math.sin(t * 2.2 + phase) * 0.18,   // 摇摆
      offsetX: 0,
      offsetY: Math.sin(t * 2.8 + phase) * 0.16,    // 浮动
      alpha: 1,
      state: 'idle', stateTime: s.stateTime,
    };
  },
};

registerAnimator(magnetController);
