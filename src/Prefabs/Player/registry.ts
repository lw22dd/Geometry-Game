/**
 * 玩家预制体注册表 —— 按 id 选择实体外观-动画组合。
 * system 通过 getPrefab() 获取预制体，不直接 import 具体实现。
 */
import type { PlayerPrefab } from './types';
import { defaultPrefab } from './default/defaultPrefab';

const registry = new Map<string, PlayerPrefab>();

/** 注册预制体（重复 id 覆盖） */
export function registerPrefab(prefab: PlayerPrefab): void {
  registry.set(prefab.id, prefab);
}

/** 按 id 获取预制体；未指定或未知时回退默认 */
export function getPrefab(id?: string): PlayerPrefab {
  return registry.get(id ?? 'default') ?? defaultPrefab;
}

/** 列出全部已注册预制体 */
export function getAllPrefabs(): PlayerPrefab[] {
  return [...registry.values()];
}

// ── 启动注册：默认预制体 ──
registerPrefab(defaultPrefab);