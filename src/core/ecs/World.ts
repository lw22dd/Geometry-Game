/**
 * 实体注册表（World）—— 单例。
 * 管理实体创建/销毁、组件增删、按组件查询。
 *
 * 组件类型使用 string key（由各组件模块导出的常量标识）。
 *
 * 用法：
 *   const e = world.createEntity();
 *   world.add(e, Position, { x: 0, y: 0 });
 *   const pos = world.get<Position>(e, Position);
 *   for (const id of world.query(Position, Collectible)) { ... }
 */
import type { EntityId } from './Entity';

/** 组件类型标识（string + 泛型标记） */
export type ComponentType<T> = string & { __brand?: T };

/** 实体名 → 组件映射 */
type ComponentMap = Map<string, any>;

export class World {
  private nextId = 1;
  private entities = new Map<EntityId, ComponentMap>();
  /** 组件类型 → 拥有该组件的实体集合（加速查询） */
  private index = new Map<string, Set<EntityId>>();

  /** 创建一个新实体，返回唯一 ID */
  createEntity(): EntityId {
    const id = this.nextId++ as EntityId;
    this.entities.set(id, new Map());
    return id;
  }

  /** 为实体添加一个组件 */
  add<T>(entity: EntityId, type: ComponentType<T>, data: T): void {
    const map = this.entities.get(entity);
    if (!map) throw new Error(`Entity ${entity} does not exist`);
    const key = type as unknown as string;
    map.set(key, data);
    if (!this.index.has(key)) this.index.set(key, new Set());
    this.index.get(key)!.add(entity);
  }

  /** 获取实体上的组件数据 */
  get<T>(entity: EntityId, type: ComponentType<T>): T {
    const map = this.entities.get(entity);
    if (!map) throw new Error(`Entity ${entity} does not exist`);
    const key = type as unknown as string;
    const data = map.get(key);
    if (data === undefined) throw new Error(`Entity ${entity} has no ${key} component`);
    return data as T;
  }

  /** 检查实体是否拥有某组件 */
  has(entity: EntityId, type: ComponentType<any>): boolean {
    const map = this.entities.get(entity);
    const key = type as unknown as string;
    return map ? map.has(key) : false;
  }

  /** 移除实体上的一个组件 */
  remove(entity: EntityId, type: ComponentType<any>): void {
    const map = this.entities.get(entity);
    const key = type as unknown as string;
    if (map) map.delete(key);
    this.index.get(key)?.delete(entity);
  }

  /** 销毁实体（移除所有组件） */
  destroy(entity: EntityId): void {
    const map = this.entities.get(entity);
    if (map) {
      for (const key of map.keys()) {
        this.index.get(key)?.delete(entity);
      }
    }
    this.entities.delete(entity);
  }

  /** 清空整个世界（切图重建前调用；所有实体与查询索引一并销毁） */
  clear(): void {
    this.entities.clear();
    this.index.clear();
  }

  /** 查询拥有所有指定组件的实体列表 */
  query(...types: ComponentType<any>[]): EntityId[] {
    const keys = types.map(t => t as unknown as string);
    if (keys.length === 0) return [];
    // 从最少实体的组件类型开始遍历
    let best = keys[0];
    let bestSize = this.index.get(best)?.size ?? Infinity;
    for (let i = 1; i < keys.length; i++) {
      const sz = this.index.get(keys[i])?.size ?? Infinity;
      if (sz < bestSize) { best = keys[i]; bestSize = sz; }
    }
    const candidates = this.index.get(best);
    if (!candidates) return [];
    const rest = keys.filter(k => k !== best);
    return [...candidates].filter(e => {
      const map = this.entities.get(e);
      return map && rest.every(k => map.has(k));
    });
  }

  /** 查询第一个匹配的实体，未找到返回 null */
  queryOne(...types: ComponentType<any>[]): EntityId | null {
    const results = this.query(...types);
    return results.length > 0 ? results[0] : null;
  }

  /** 当前实体总数 */
  get count(): number {
    return this.entities.size;
  }
}

/** 全局单例 World 实例 */
export const world = new World();