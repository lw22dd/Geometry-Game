/**
 * 默认角色动画状态表 —— 状态枚举（复用 types 的 PlayerAnimState）与转换规则。
 * 纯数据：转换谓词只读 player 物理状态 + 边沿信号，不包含任何绘制逻辑。
 */
import type { FrameSignals, PlayerAnimState, PlayerState } from '../../../types';

export type AnimState = PlayerAnimState;

/** FSM 每帧的输入上下文 */
export interface AnimTransitionContext {
  player: PlayerState;
  /** 当前状态持续时长（秒） */
  stateTime: number;
  /** 本帧起跳（grounded → 空中 且 vy>0） */
  jumped: boolean;
  /** 本帧落地（空中 → grounded） */
  landed: boolean;
  /** 本帧开始死亡 */
  died: boolean;
  /** 本帧复活（dead → 非 dead） */
  respawned: boolean;
  /** 本帧开始冲刺 */
  dashStarted: boolean;
  /** 本帧碰撞/交互信号（由 system 发射） */
  signals?: FrameSignals;
}

export interface AnimTransition {
  to: AnimState;
  when: (ctx: AnimTransitionContext) => boolean;
}

const speed = (p: PlayerState): number => Math.abs(p.vx);

/** 状态转换表：每个源状态一组有序转换，首个命中生效 */
export const ANIM_TRANSITIONS: Record<AnimState, AnimTransition[]> = {
  idle: [
    { to: 'dead', when: (c) => c.died },
    { to: 'celebrate', when: (c) => !!c.signals?.goalReached },
    { to: 'collectPulse', when: (c) => !!(c.signals?.collected || c.signals?.checkpointHit) },
    { to: 'bump', when: (c) => !!c.signals?.wallBump },
    { to: 'dash', when: (c) => c.dashStarted },
    { to: 'jumpRise', when: (c) => c.jumped },
    { to: 'run', when: (c) => c.player.grounded && speed(c.player) > 0.5 },
  ],
  run: [
    { to: 'dead', when: (c) => c.died },
    { to: 'celebrate', when: (c) => !!c.signals?.goalReached },
    { to: 'collectPulse', when: (c) => !!(c.signals?.collected || c.signals?.checkpointHit) },
    { to: 'bump', when: (c) => !!c.signals?.wallBump },
    { to: 'dash', when: (c) => c.dashStarted },
    { to: 'jumpRise', when: (c) => c.jumped },
    { to: 'idle', when: (c) => c.player.grounded && speed(c.player) <= 0.5 },
  ],
  jumpRise: [
    { to: 'dead', when: (c) => c.died },
    { to: 'celebrate', when: (c) => !!c.signals?.goalReached },
    { to: 'collectPulse', when: (c) => !!(c.signals?.collected || c.signals?.checkpointHit) },
    { to: 'bump', when: (c) => !!c.signals?.wallBump },
    { to: 'land', when: (c) => c.landed },
    { to: 'jumpFall', when: (c) => c.player.vy <= 0 },
  ],
  jumpFall: [
    { to: 'dead', when: (c) => c.died },
    { to: 'celebrate', when: (c) => !!c.signals?.goalReached },
    { to: 'collectPulse', when: (c) => !!(c.signals?.collected || c.signals?.checkpointHit) },
    { to: 'bump', when: (c) => !!c.signals?.wallBump },
    { to: 'land', when: (c) => c.landed },
  ],
  land: [
    { to: 'dead', when: (c) => c.died },
    { to: 'celebrate', when: (c) => !!c.signals?.goalReached },
    { to: 'collectPulse', when: (c) => !!(c.signals?.collected || c.signals?.checkpointHit) },
    { to: 'bump', when: (c) => !!c.signals?.wallBump },
    {
      to: 'run',
      when: (c) => c.stateTime > 0.12 && c.player.grounded && speed(c.player) > 0.5,
    },
    {
      to: 'idle',
      when: (c) => c.stateTime > 0.12 && c.player.grounded && speed(c.player) <= 0.5,
    },
    { to: 'jumpFall', when: (c) => c.stateTime > 0.12 && !c.player.grounded },
  ],
  dash: [
    { to: 'dead', when: (c) => c.died },
    { to: 'celebrate', when: (c) => !!c.signals?.goalReached },
    { to: 'collectPulse', when: (c) => !!(c.signals?.collected || c.signals?.checkpointHit) },
    { to: 'bump', when: (c) => !!c.signals?.wallBump },
    {
      to: 'run',
      when: (c) => (c.stateTime > 0.25 || !c.player.sprint) && speed(c.player) > 0.5,
    },
    {
      to: 'idle',
      when: (c) => (c.stateTime > 0.25 || !c.player.sprint) && speed(c.player) <= 0.5,
    },
    { to: 'jumpFall', when: (c) => (c.stateTime > 0.25 || !c.player.sprint) && !c.player.grounded },
  ],
  collectPulse: [
    { to: 'dead', when: (c) => c.died },
    { to: 'celebrate', when: (c) => !!c.signals?.goalReached },
    { to: 'bump', when: (c) => !!c.signals?.wallBump },
    {
      to: 'run',
      when: (c) => c.stateTime > 0.35 && c.player.grounded && speed(c.player) > 0.5,
    },
    { to: 'idle', when: (c) => c.stateTime > 0.35 },
    { to: 'jumpFall', when: (c) => c.stateTime > 0.35 && !c.player.grounded },
  ],
  bump: [
    { to: 'dead', when: (c) => c.died },
    { to: 'celebrate', when: (c) => !!c.signals?.goalReached },
    {
      to: 'run',
      when: (c) => c.stateTime > 0.2 && c.player.grounded && speed(c.player) > 0.5,
    },
    { to: 'idle', when: (c) => c.stateTime > 0.2 },
    { to: 'jumpFall', when: (c) => c.stateTime > 0.2 && !c.player.grounded },
  ],
  celebrate: [
    { to: 'dead', when: (c) => c.died },
    { to: 'idle', when: (c) => c.stateTime > 1.2 },
  ],
  dead: [
    { to: 'respawn', when: (c) => c.respawned },
  ],
  respawn: [
    { to: 'dead', when: (c) => c.died },
    { to: 'idle', when: (c) => c.stateTime > 0.3 },
  ],
};