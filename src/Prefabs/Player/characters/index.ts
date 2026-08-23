/**
 * 角色注册表 —— 汇总所有可选角色预制体。
 */
import { defaultCharacter } from './default';

export { defaultCharacter } from './default';
export type { CharacterStyle } from './default';

/** 全部可用角色 */
export const CHARACTERS = [defaultCharacter];

/** 默认角色 */
export const DEFAULT_CHARACTER = defaultCharacter;