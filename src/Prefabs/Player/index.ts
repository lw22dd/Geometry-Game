/**
 * 玩家预制体 —— PLAYER 绘制委托实现。
 * 纯绘制，不包含游戏逻辑；外观由 characters/ 角色样式驱动。
 */
import { P } from '../../systems/player';
import { DEFAULT_CHARACTER, type CharacterStyle } from './characters';
import { drawDefaultPlayer } from './default/defaultPrefab';

export { CHARACTERS, DEFAULT_CHARACTER } from './characters';
export type { CharacterStyle } from './characters';

/** 绘制默认玩家预制体。不同外形可在各自预制体内实现动画和绘制。 */
export function drawPlayer(style: CharacterStyle = DEFAULT_CHARACTER): void {
  drawDefaultPlayer(P, style);
}
