/**
 * core —— 底座 barrel 导出。
 */
export * from './canvas';
export * from './math';
export * from './input';
export * from './audio';
export * from './camera';
export * from './netBus';
export { EntityPool } from './entityPool';
export { world, initEcs, clearWorld } from './ecs';
export type { EntityId } from './ecs';
