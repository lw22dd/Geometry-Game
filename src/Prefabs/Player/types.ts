/**
 * 玩家预制体接口 —— 每种外观一个组合（动画 FSM + 绘制）。
 * system 只面向此接口调用，不关心具体预制体内部实现。
 */
import type { AnimOutput, FrameSignals, PlayerState } from '../../types';
import type { CharacterStyle } from './characters';

export interface PlayerPrefab {
  /** 预制体唯一 id（注册表 key） */
  id: string;
  /** 创建该玩家独立的动画状态实例 */
  createState(): unknown;
  /** 步进动画状态（物理步或渲染帧调用；player 为最新物理状态；signals 为本帧碰撞/交互事件） */
  step(state: unknown, player: PlayerState, dt: number, signals?: FrameSignals): void;
  /** 从动画状态 + 当前物理状态合成输出参数 */
  getOutput(state: unknown, player: PlayerState): AnimOutput;
  /** 纯绘制：只按输出参数与角色样式画 */
  draw(state: unknown, player: PlayerState, output: AnimOutput, style: CharacterStyle): void;
}