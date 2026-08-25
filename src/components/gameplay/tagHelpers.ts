/**
 * 标签工具函数 —— Tags 组件的增删查 + 按标签查询。
 * 不引入全局管理器/索引，仅操作 ECS World 上的 Tags 组件。
 *
 * 用法：
 *   addTag(entity, 'enemy');
 *   hasTag(entity, 'boss');            // boolean
 *   removeTag(entity, 'boss');
 *   getTags(entity);                    // string[]
 *   queryByTag('enemy', Position);      // EntityId[]（可追加组件类型过滤）
 *   queryOneByTag('player', Position);  // EntityId | null
 *
 * @category 玩法/交互
 */
import { world } from '../../core/ecs';
import type { EntityId } from '../../core/ecs/Entity';
import type { ComponentType } from '../../core/ecs';
import { Tags } from './Tags';

/** 玩家标签名（原 PlayerTag 组件语义，现统一为 Tags 上的 'player' 标签） */
export const TAG_PLAYER = 'player';

/** 确保实体拥有 Tags 组件并返回其引用 */
function ensureTags(entity: EntityId): Tags {
  if (!world.has(entity, Tags)) {
    world.add(entity, Tags, { values: [] });
  }
  return world.get<Tags>(entity, Tags);
}

/**
 * 为实体添加一个标签（自动创建 Tags 组件）。
 * 重复标签不会重复添加；空字符串被忽略。
 */
export function addTag(entity: EntityId, tag: string): void {
  if (!tag) return;
  const t = ensureTags(entity);
  if (!t.values.includes(tag)) {
    t.values.push(tag);
  }
}

/**
 * 检查实体是否拥有指定标签。
 * 实体没有 Tags 组件时返回 false。
 */
export function hasTag(entity: EntityId, tag: string): boolean {
  return world.has(entity, Tags) && world.get<Tags>(entity, Tags).values.includes(tag);
}

/**
 * 移除实体上的一个标签（所有同名项）。
 * 如果移除后标签列表为空，Tags 组件仍然保留。
 */
export function removeTag(entity: EntityId, tag: string): void {
  if (!world.has(entity, Tags)) return;
  const t = world.get<Tags>(entity, Tags);
  t.values = t.values.filter(v => v !== tag);
}

/**
 * 获取实体上的所有标签（返回副本，修改不影响组件数据）。
 * 实体没有 Tags 组件时返回空数组。
 */
export function getTags(entity: EntityId): string[] {
  return world.has(entity, Tags) ? [...world.get<Tags>(entity, Tags).values] : [];
}

/**
 * 查询拥有指定标签（且拥有所有额外组件类型）的实体列表。
 * 内部为手动过滤，无反向索引；标签实体数量为游戏循环量级，可忽略开销。
 */
export function queryByTag(tag: string, ...types: ComponentType<any>[]): EntityId[] {
  return world.query(Tags, ...types).filter(e => hasTag(e, tag));
}

/** 查询第一个拥有指定标签（且拥有所有额外组件类型）的实体；未找到返回 null */
export function queryOneByTag(tag: string, ...types: ComponentType<any>[]): EntityId | null {
  const results = queryByTag(tag, ...types);
  return results.length > 0 ? results[0] : null;
}