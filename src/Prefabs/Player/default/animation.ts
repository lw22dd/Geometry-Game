/**
 * 默认角色动画 FSM —— 接收玩家物理状态，推进状态机并合成输出参数。
 * 纯表现层：不读按键、不碰碰撞，只依赖 PlayerState 的物理事实 + 自身记忆 + 帧信号。
 */
import type { AnimOutput, FrameSignals, PlayerState } from '../../../types';
import { clamp } from '../../../core/math';
import { gs } from '../../../systems/game/state';
import { ANIM_TRANSITIONS, type AnimState } from './states';

export interface DefaultAnimState {
  /** 形变残留（- = 拉长，+ = 压扁），FSM 内衰减 */
  squash: number;
  /** 当前动画状态 */
  state: AnimState;
  /** 当前状态持续时长（秒） */
  stateTime: number;
  /** 落地冲击速度（>0，进入 land 时记录，用于压扁幅度） */
  impactSpeed: number;
  // ── 边沿检测记忆 ──
  previousGrounded: boolean;
  previousVy: number;
  previousDead: boolean;
  previousSprint: boolean;
  initialized: boolean;
}

export const createDefaultAnimState = (): DefaultAnimState => ({
  squash: 0,
  state: 'idle',
  stateTime: 0,
  impactSpeed: 0,
  previousGrounded: false,
  previousVy: 0,
  previousDead: false,
  previousSprint: false,
  initialized: false,
});

/** 步进动画状态机（物理步或渲染帧调用） */
export function stepDefaultAnimation(
  state: DefaultAnimState,
  player: PlayerState,
  dt: number,
  signals?: FrameSignals,
): void {
  if (!state.initialized) {
    // 首帧只做快照，不触发任何边沿
    state.previousGrounded = player.grounded;
    state.previousVy = player.vy;
    state.previousDead = player.dead;
    state.previousSprint = player.sprint;
    state.initialized = true;
    return;
  }

  // ── 边沿信号（从上一帧记忆推导，替代显式信号调用）──
  const jumped = state.previousGrounded && !player.grounded && player.vy > 0;
  const landed = !state.previousGrounded && player.grounded;
  const died = !state.previousDead && player.dead;
  const respawned = state.previousDead && !player.dead;
  const dashStarted = !state.previousSprint && player.sprint;
  if (landed) state.impactSpeed = Math.max(0, -state.previousVy);

  // ── 状态转换 ──
  state.stateTime += dt;
  const transitions = ANIM_TRANSITIONS[state.state];
  for (const t of transitions) {
    if (t.when({ player, stateTime: state.stateTime, jumped, landed, died, respawned, dashStarted, signals })) {
      state.state = t.to;
      state.stateTime = 0;
      // 进入特定状态时注入形变事件
      if (t.to === 'jumpRise') state.squash = -0.24;
      else if (t.to === 'land') state.squash = Math.min(0.42, state.impactSpeed * 0.028);
      else if (t.to === 'collectPulse') state.squash = -0.12;
      else if (t.to === 'bump') state.squash = 0.18;
      break;
    }
  }

  // ── 形变平滑恢复 ──
  state.squash *= Math.exp(-7 * dt);

  // ── 更新记忆 ──
  state.previousGrounded = player.grounded;
  state.previousVy = player.vy;
  state.previousDead = player.dead;
  state.previousSprint = player.sprint;
}

/** 从动画状态 + 当前物理状态合成输出参数（渲染帧调用） */
export function getDefaultOutput(
  state: DefaultAnimState,
  player: PlayerState,
): AnimOutput {
  const out: AnimOutput = {
    scaleX: 1, scaleY: 1, rotation: 0,
    offsetX: 0, offsetY: 0, alpha: 1,
    state: state.state, stateTime: state.stateTime,
  };

  const sq = state.squash;
  switch (state.state) {
    case 'idle': {
      // 呼吸
      const breathe = 0.02 * Math.sin(gs.time * 2);
      out.scaleX = 1 + sq + breathe;
      out.scaleY = 1 - sq - breathe;
      break;
    }
    case 'run': {
      // 奔跑上下浮动
      const bob = 0.03 * Math.sin(gs.time * 12);
      out.offsetY = bob;
      out.scaleX = 1 + sq;
      out.scaleY = 1 - sq;
      break;
    }
    case 'jumpRise':
    case 'jumpFall': {
      // 空中速度拉伸（同原视觉）
      const e = clamp(Math.abs(player.vy) * 0.012, 0, 0.2);
      out.scaleX = (1 + sq) * (1 - e * 0.4);
      out.scaleY = (1 - sq) * (1 + e * 0.5);
      break;
    }
    case 'land': {
      // 落地压扁，快速回弹
      const k = Math.exp(-5 * state.stateTime);
      out.scaleX = 1 + sq * k;
      out.scaleY = 1 - sq * k;
      break;
    }
    case 'dash': {
      // 冲刺横向拉伸
      out.scaleX = 1.2;
      out.scaleY = 0.9;
      break;
    }
    case 'collectPulse': {
      // 收集/检查点闪光：快速鼓胀 + alpha 脉冲
      const k = Math.exp(-6 * state.stateTime);
      out.scaleX = 1 + 0.1 * k;
      out.scaleY = 1 + 0.08 * k;
      out.alpha = 0.85 + 0.15 * Math.sin(state.stateTime * 40);
      break;
    }
    case 'bump': {
      // 撞墙抖动：快速横向挤压 + 恢复
      const k = Math.exp(-8 * state.stateTime);
      out.scaleX = 1 + sq * k;
      out.scaleY = 1 - sq * k;
      out.rotation = 0.12 * Math.sin(state.stateTime * 50) * k;
      break;
    }
    case 'celebrate': {
      // 终点庆祝：上下跳动 + 旋转摇摆
      const bob = 0.12 * Math.sin(state.stateTime * 18);
      out.offsetY = bob;
      out.rotation = 0.1 * Math.sin(state.stateTime * 9);
      // 轻微闪烁
      out.alpha = 0.9 + 0.1 * Math.sin(state.stateTime * 12);
      break;
    }
    case 'dead':
      out.alpha = 0;
      break;
    case 'respawn': {
      // 复活闪现
      out.alpha = 0.7 + 0.3 * Math.sin(state.stateTime * 20);
      break;
    }
  }

  return out;
}