/**
 * 玩家绘制委托注册表 —— PLAYER_DEF。
 * 实际建模位于 `Prefabs/Player/`（含 characters/ 角色样式）。
 * 本文件仅作转发：让 systems 层通过稳定的 defs 入口取绘制委托。
 */
export { drawPlayer, CHARACTERS, DEFAULT_CHARACTER } from '../../Prefabs/Player';
export type { CharacterStyle } from '../../Prefabs/Player/characters';