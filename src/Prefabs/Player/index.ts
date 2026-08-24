/**
 * 玩家预制体 —— 统一出口：步进动画、绘制本地/远程玩家、角色样式注册。
 * system 只通过本模块的 API 与预制体体系交互。
 */
import type { FrameSignals, PlayerState } from '../../types';
import { getPrefab } from './registry';
import type { PlayerPrefab } from './types';
import { DEFAULT_CHARACTER, type CharacterStyle } from './characters';

export { CHARACTERS, DEFAULT_CHARACTER } from './characters';
export { setSelectedCharacter, getSelectedCharacter, getCharacterById } from './characters';
export type { CharacterStyle } from './characters';

// ── 每玩家动画状态（WeakMap 键为稳定对象：P 或 RemotePlayer）──
const animStates = new WeakMap<object, unknown>();

function getAnimState(player: object, prefab: PlayerPrefab): unknown {
  let s = animStates.get(player);
  if (!s) {
    s = prefab.createState();
    animStates.set(player, s);
  }
  return s;
}

/** 步进一个玩家的动画（物理步或渲染帧调用） */
export function stepPlayerAnimation(
  player: PlayerState,
  dt: number,
  signals?: FrameSignals,
  prefabId?: string,
): void {
  const prefab = getPrefab(prefabId);
  const state = getAnimState(player, prefab);
  prefab.step(state, player, dt, signals);
}

/** 绘制本地玩家 */
export function drawPlayer(player: PlayerState, style: CharacterStyle = DEFAULT_CHARACTER): void {
  const prefab = getPrefab();
  const state = getAnimState(player, prefab);
  const output = prefab.getOutput(state, player);
  prefab.draw(state, player, output, style);
}

/** 绘制任意玩家（远程玩家用） */
export function drawPlayerFor(
  player: PlayerState,
  style: CharacterStyle,
  prefabId?: string,
): void {
  if (player.dead) return;
  const prefab = getPrefab(prefabId);
  const state = getAnimState(player, prefab);
  const output = prefab.getOutput(state, player);
  prefab.draw(state, player, output, style);
}

/** 按玩家 ID 取颜色变体（替代原 drawRemotePlayer 中的硬编码颜色表） */
export function characterStyleForId(id: number): CharacterStyle {
  const colors = [
    { body: ['#ffffff', '#75ffb0', '#3ddb84'] as [string, string, string], glow: 'rgba(100,255,150,.9)', stroke: 'rgba(100,255,150,.55)' },
    { body: ['#ffffff', '#ffb075', '#ff8030'] as [string, string, string], glow: 'rgba(255,180,80,.9)', stroke: 'rgba(255,180,80,.55)' },
    { body: ['#ffffff', '#b075ff', '#8030ff'] as [string, string, string], glow: 'rgba(180,80,255,.9)', stroke: 'rgba(180,80,255,.55)' },
    { body: ['#ffffff', '#75d0ff', '#30a0ff'] as [string, string, string], glow: 'rgba(80,180,255,.9)', stroke: 'rgba(80,180,255,.55)' },
  ];
  const c = colors[id % colors.length];
  return {
    ...DEFAULT_CHARACTER,
    id: 'p' + id,
    bodyGrad: c.body,
    glow: c.glow,
    stroke: c.stroke,
  };
}