/**
 * ECS 层 barrel 导出 —— bitECS（NateTheGreatt/bitECS 0.4.x）。
 * 这是替换旧 `core/ecs` 的根模块：世界 + 组件 + 查询。
 */
export { world, initEcs, clearWorld } from './World';
export type { W } from './queries';
export * from './components';
export * from './queries';

/** 实体 ID（bitECS 为 number；兼容旧类型别名） */
export type EntityId = number;
