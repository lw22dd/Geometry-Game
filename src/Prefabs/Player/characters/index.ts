/**
 * 角色注册表 —— 汇总所有可选角色预制体 + 当前选择状态。
 * 选择界面、远端渲染均通过本表驱动（新增角色 = 注册新条目 + 选择生效）。
 */
import { defaultCharacter } from './default';
import { crimsonCharacter } from './crimson';
import type { CharacterStyle } from './default';

export { defaultCharacter } from './default';
export { crimsonCharacter } from './crimson';
export type { CharacterStyle } from './default';

/** 全部可用角色 */
export const CHARACTERS = [defaultCharacter, crimsonCharacter];

/** 默认角色 */
export const DEFAULT_CHARACTER = defaultCharacter;

/* ==================== 当前选择状态 ==================== */

let selectedCharacterId: string = DEFAULT_CHARACTER.id;

/** 设置当前所选角色（准备界面调用；未知 id 回退默认） */
export function setSelectedCharacter(id: string): void {
  selectedCharacterId = CHARACTERS.some(c => c.id === id) ? id : DEFAULT_CHARACTER.id;
}

/** 当前所选角色样式（本地玩家渲染用） */
export function getSelectedCharacter(): CharacterStyle {
  return CHARACTERS.find(c => c.id === selectedCharacterId) ?? DEFAULT_CHARACTER;
}

/** 按角色 id 取样式（远端玩家渲染用；未知回退默认） */
export function getCharacterById(id?: string): CharacterStyle {
  if (!id) return DEFAULT_CHARACTER;
  return CHARACTERS.find(c => c.id === id) ?? DEFAULT_CHARACTER;
}