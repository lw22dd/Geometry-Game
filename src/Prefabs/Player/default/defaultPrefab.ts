/**
 * 默认角色预制体 —— 「霓虹跑者」（发光圆球）的动画-建模组合。
 * 通过 PlayerPrefab 接口暴露给注册表，system 不直接依赖本模块。
 */
import type { PlayerPrefab } from '../types';
import type { FrameSignals, PlayerState } from '../../../types';
import {
  createDefaultAnimState,
  getDefaultOutput,
  stepDefaultAnimation,
  type DefaultAnimState,
} from './animation';
import { renderDefaultPlayer } from './render';

export const defaultPrefab: PlayerPrefab = {
  id: 'default',
  createState: (): DefaultAnimState => createDefaultAnimState(),
  step: (state: DefaultAnimState, player: PlayerState, dt: number, signals?: FrameSignals): void => {
    stepDefaultAnimation(state, player, dt, signals);
  },
  getOutput: (state: DefaultAnimState, player: PlayerState) =>
    getDefaultOutput(state, player),
  draw: (_state, player, output, style) => {
    renderDefaultPlayer(player, output, style);
  },
};