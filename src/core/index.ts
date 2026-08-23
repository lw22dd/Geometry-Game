/**
 * core —— 底座 barrel 导出。
 */
export * from './canvas';
export * from './math';
export * from './input';
export * from './audio';
export * from './camera';
export * from './netBus';
export { EntityPool } from './ecs/entityPool';
export { world, World } from './ecs/World';
export type { EntityId, ComponentType } from './ecs';