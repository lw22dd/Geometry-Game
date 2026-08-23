/**
 * 实体注册表（World）—— 单例。
 * 管理实体创建/销毁、组件增删、按组件查询。
 *
 * 用法：
 *   const e = world.createEntity();
 *   world.add(e, Position, { x: 0, y: 0 });
 *   const pos = world.get<Position>(e, Position);
 *   for (const id of world.query(Position, Collectible)) { ... }
 */
import type { EntityId } from './Entity';

/** 组件类型标记（用构造函数/接口引用作键） */
export type ComponentType<T> = abstract new (...args: any[]) => T;

/** 实体名 → 组件映射 */
type ComponentMap = Map<ComponentType<any>, any>;

export class World {
  private nextId = 1;
  private entities = new Map<EntityId, ComponentMap>();
  /** 组件类型 → 拥有该组件的实体集合（加速查询） */
  private index = new Map<ComponentType<any>, Set<EntityId>>();

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
    map.set(type, data);
    if (!this.index.has(type)) this.index.set(type, new Set());
    this.index.get(type)!.add(entity);
  }

  /** 获取实体上的组件数据 */
  get<T>(entity: EntityId, type: ComponentType<T>): T {
    const map = this.entities.get(entity);
    if (!map) throw new Error(`Entity ${entity} does not exist`);
    const data = map.get(type);
    if (data === undefined) throw new Error(`Entity ${entity} has no ${type.name} component`);
    return data as T;
  }

  /** 检查实体是否拥有某组件 */
  has(entity: EntityId, type: ComponentType<any>): boolean {
    const map = this.entities.get(entity);
    return map ? map.has(type) : false;
  }

  /** 移除实体上的一个组件 */
  remove(entity: EntityId, type: ComponentType<any>): void {
    const map = this.entities.get(entity);
    if (map) map.delete(type);
    this.index.get(type)?.delete(entity);
  }

  /** 销毁实体（移除所有组件） */
  destroy(entity: EntityId): void {
    const map = this.entities.get(entity);
    if (map) {
      for (const type of map.keys()) {
        this.index.get(type)?.delete(entity);
      }
    }
    this.entities.delete(entity);
  }

  /** 查询拥有所有指定组件的实体列表 */
  query(...types: ComponentType<any>[]): EntityId[] {
    if (types.length === 0) return [];
    // 从最少实体的组件类型开始遍历
    let best = types[0];
    let bestSize = this.index.get(best)?.size ?? Infinity;
    for (let i = 1; i < types.length; i++) {
      const sz = this.index.get(types[i])?.size ?? Infinity;
      if (sz < bestSize) { best = types[i]; bestSize = sz; }
    }
    const candidates = this.index.get(best);
    if (!candidates) return [];
    const rest = types.filter(t => t !== best);
    return [...candidates].filter(e =>
      rest.every(t => this.entities.get(e)?.has(t))
    );
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