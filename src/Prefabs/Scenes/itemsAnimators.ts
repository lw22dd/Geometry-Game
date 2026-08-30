/**
 * 场景道具动画控制器 —— 光球 / NOVA / 双跳票 / 钩锁的 AnimatorController 实现。
 *
 * 模块加载时自注册到注册表（副作用导入由 systems/animation 触发）。
 * 数据源为新 ECS：Collectible（SoA）+ Animator 状态（AoS）。
 *
 * 设计原则：
 *  - 保持与原绘制函数（items.ts）完全一致的视觉参数
 *  - 新增事件驱动的 collect 闪烁（光球）和 celebrate 脉冲（NOVA）
 *  - 纯 hover 的控制器（jumpBoost / hook）保持原样，只做数据源迁移
 */
import { gs } from '../../systems/game/gameState';
import { Collectible } from '../../core/ecs';
import type { AnimatorController, AnimOutput } from '../Animations/types';
import { registerAnimator } from '../Animations/registry';

/* ==================== 光球控制器 ==================== */

interface OrbAnimState {
  state: 'idle' | 'collect';
  stateTime: number;
  phase: number;
  prevCollected: boolean;
}

/** 创建光球动画状态（工厂装配 Animator 时预初始化 phase） */
export function createOrbAnimState(init?: Record<string, number>): OrbAnimState {
  return {
    state: 'idle',
    stateTime: 0,
    phase: init?.phase ?? 0,
    prevCollected: false,
  };
}

const orbController: AnimatorController = {
  id: 'orb',

  createState(init?: Record<string, number>): unknown {
    return createOrbAnimState(init);
  },

  step(state: unknown, entity: number, _dt: number): void {
    const s = state as OrbAnimState;
    const collected = Collectible.collected[entity] === 1;

    // 边沿检测：收集 → collect 状态
    if (!s.prevCollected && collected && s.state === 'idle') {
      s.state = 'collect';
      s.stateTime = 0;
    }

    // 更新记忆
    s.prevCollected = collected;
    s.stateTime += _dt;
  },

  getOutput(state: unknown, _entity: number): AnimOutput {
    const s = state as OrbAnimState;
    const t = gs.time;
    const phase = s.phase;

    // 公有参数：浮动 + 旋转（与旧 drawOrbs 完全一致）
    const offsetY = Math.sin(t * 2.6 + phase) * 0.18;
    const rotation = t * 1.8 + phase;

    if (s.state === 'collect') {
      // 收集闪烁：双闪 + 鼓胀 + 渐变消失
      const st = s.stateTime;
      const fade = Math.max(0, 1 - st / 0.4);
      const twinkle = 0.75 + 0.25 * Math.sin(st * 40);
      const alpha = twinkle * fade;
      const scaleX = 1 + 0.2 * Math.exp(-5 * st);

      return {
        scaleX, scaleY: 1, rotation,
        offsetX: 0, offsetY,
        alpha: alpha < 0.01 ? 0 : alpha,
        state: 'collect', stateTime: st,
      };
    }

    // idle
    return {
      scaleX: 1, scaleY: 1, rotation,
      offsetX: 0, offsetY,
      alpha: 1,
      state: 'idle', stateTime: s.stateTime,
    };
  },
};

/* ==================== NOVA 星控制器 ==================== */

interface NovaAnimState {
  state: 'idle' | 'celebrate';
  stateTime: number;
  prevWin: boolean;
}

function createNovaState(): NovaAnimState {
  return { state: 'idle', stateTime: 0, prevWin: false };
}

const novaController: AnimatorController = {
  id: 'nova',

  createState(): unknown {
    return createNovaState();
  },

  step(state: unknown, _entity: number, _dt: number): void {
    const s = state as NovaAnimState;
    if (!s.prevWin && gs.win && s.state === 'idle') {
      s.state = 'celebrate';
      s.stateTime = 0;
    }
    s.prevWin = gs.win;
    s.stateTime += _dt;
  },

  getOutput(state: unknown, _entity: number): AnimOutput {
    const s = state as NovaAnimState;
    const t = gs.time;

    if (s.state === 'celebrate') {
      const st = s.stateTime;
      return {
        scaleX: 1 + 0.12 * Math.sin(st * 10),
        scaleY: 1 + 0.12 * Math.sin(st * 10),
        rotation: t * 1.8,        // 加速旋转
        offsetX: 0, offsetY: 0,
        alpha: 0.95 + 0.05 * Math.sin(st * 8),
        state: 'celebrate', stateTime: st,
      };
    }

    // idle
    return {
      scaleX: 1, scaleY: 1,
      rotation: t * 0.9,          // 与原 rotSpeed=0.9 一致
      offsetX: 0, offsetY: 0,
      alpha: 1,
      state: 'idle', stateTime: s.stateTime,
    };
  },
};

/* ==================== 双跳票控制器 ==================== */

interface HoverAnimState {
  state: 'idle';
  stateTime: number;
  phase: number;
}

/** 创建 hover 类动画状态（双跳票 / 钩锁共用；工厂预初始化 phase） */
export function createHoverAnimState(init?: Record<string, number>): HoverAnimState {
  return { state: 'idle', stateTime: 0, phase: init?.phase ?? 0 };
}

const jumpBoostController: AnimatorController = {
  id: 'jumpBoost',

  createState(init?: Record<string, number>): unknown {
    return createHoverAnimState(init);
  },

  step(state: unknown, _entity: number, _dt: number): void {
    const s = state as HoverAnimState;
    s.stateTime += _dt;
  },

  getOutput(state: unknown, _entity: number): AnimOutput {
    const s = state as HoverAnimState;
    const t = gs.time;
    const phase = s.phase;

    return {
      scaleX: 1, scaleY: 1,
      rotation: Math.sin(t * 2.2 + phase) * 0.18,   // 摇摆，与原 drawJumpBoosts 一致
      offsetX: 0,
      offsetY: Math.sin(t * 2.8 + phase) * 0.16,    // 浮动，与原一致
      alpha: 1,
      state: 'idle', stateTime: s.stateTime,
    };
  },
};

/* ==================== 钩锁道具控制器 ==================== （参数同双跳票） */

const hookController: AnimatorController = {
  id: 'hook',

  createState(init?: Record<string, number>): unknown {
    return createHoverAnimState(init);
  },

  step(state: unknown, _entity: number, _dt: number): void {
    const s = state as HoverAnimState;
    s.stateTime += _dt;
  },

  getOutput(state: unknown, _entity: number): AnimOutput {
    const s = state as HoverAnimState;
    const t = gs.time;
    const phase = s.phase;

    return {
      scaleX: 1, scaleY: 1,
      rotation: Math.sin(t * 2.2 + phase) * 0.18,   // 摇摆，与原 drawHookPickups 一致
      offsetX: 0,
      offsetY: Math.sin(t * 2.8 + phase) * 0.16,    // 浮动，与原一致
      alpha: 1,
      state: 'idle', stateTime: s.stateTime,
    };
  },
};

/* ==================== 密码机控制器 ==================== （破译机呼吸/待机，进度由绘制层直读 Cipher.progress） */

interface CipherAnimState {
  state: 'idle';
  stateTime: number;
}

export function createCipherAnimState(): CipherAnimState {
  return { state: 'idle', stateTime: 0 };
}

const cipherController: AnimatorController = {
  id: 'cipher',

  createState(): unknown {
    return createCipherAnimState();
  },

  step(state: unknown, _entity: number, _dt: number): void {
    const s = state as CipherAnimState;
    s.stateTime += _dt;
  },

  getOutput(state: unknown, _entity: number): AnimOutput {
    const s = state as CipherAnimState;
    const t = gs.time;
    return {
      scaleX: 1, scaleY: 1,
      rotation: 0,
      offsetX: 0,
      offsetY: Math.sin(t * 1.6) * 0.06,   // 轻微呼吸浮动
      alpha: 1,
      state: 'idle', stateTime: s.stateTime,
    };
  },
};

/* ==================== 注册（副作用） ==================== */

registerAnimator(orbController);
registerAnimator(novaController);
registerAnimator(jumpBoostController);
registerAnimator(hookController);
registerAnimator(cipherController);