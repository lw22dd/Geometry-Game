/**
 * 实体动画控制器注册表 —— 按 id 选择动画-表现组合。
 * system 通过 getAnimator() 获取控制器，不直接 import 具体实现。
 * 模式与 Prefabs/Player/registry.ts 一致。
 */
import type { AnimatorController } from './types';

const registry = new Map<string, AnimatorController>();

/** 注册控制器（重复 id 覆盖） */
export function registerAnimator(controller: AnimatorController): void {
  registry.set(controller.id, controller);
}

/** 按 id 获取控制器；未找到时抛出（挂 Animator 前必须注册） */
export function getAnimator(id: string): AnimatorController {
  const ctrl = registry.get(id);
  if (!ctrl) throw new Error('Unknown animator: ' + id);
  return ctrl;
}

/** 列出全部已注册控制器 */
export function getAllAnimators(): AnimatorController[] {
  return [...registry.values()];
}