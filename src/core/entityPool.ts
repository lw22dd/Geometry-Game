/**
 * 实体池 —— 持有类型化实体数组，提供遍历 / 排序接口。
 * 只依赖 types。
 */
export class EntityPool<T> {
  private items: T[] = [];

  constructor(items: T[] = []) {
    this.items = items;
  }

  /** 所有实体（只读视图） */
  get all(): T[] {
    return this.items;
  }

  /** 添加实体 */
  push(e: T): void {
    this.items.push(e);
  }

  /** 实体数量 */
  length(): number {
    return this.items.length;
  }

  /** 范围删除 */
  splice(start: number, count: number): void {
    this.items.splice(start, count);
  }

  /** 逐帧更新所有实体 */
  updateAll(dt: number, fn: (e: T, dt: number) => void): void {
    for (const e of this.items) fn(e, dt);
  }

  /** 绘制所有实体 */
  drawAll(fn: (e: T) => void): void {
    for (const e of this.items) fn(e);
  }

  /** 按深度排序返回副本（用于绘制排序） */
  depthList(depth: (e: T) => number): T[] {
    return [...this.items].sort((a, b) => depth(a) - depth(b));
  }
}