/**
 * ECS 世界 —— 全局单例。
 * bitECS 的 world 只是一个上下文引用；组件为模块级全局存储（单世界足够）。
 * 切图重建用 clearWorld()（移除全部实体并保持 observers/queries 存活）。
 */
import { createWorld, getAllEntities, removeEntity, registerComponents } from 'bitecs';
import { soaComponents } from './components';

/** 全局 ECS 世界 */
export const world = createWorld({});

/** 一次性注册全部 SoA 组件（幂等；显式注册让 observer/query 更早生效） */
export function initEcs(): void {
  registerComponents(world, soaComponents);
}

/** 清空世界（切图重建前调用）：移除全部实体，保留组件定义与观察者 */
export function clearWorld(): void {
  for (const eid of getAllEntities(world)) {
    removeEntity(world, eid);
  }
}
