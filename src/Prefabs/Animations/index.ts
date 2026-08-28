/**
 * Prefabs/Animations —— 实体动画预制体统一出口。
 *
 * 提供：
 *  - 注册表 API（registerAnimator / getAnimator）—— system 与控制器经此交互
 *  - getAnimOutput(e) —— 绘制层辅助：实时求值某实体当前动画输出参数
 *
 * 数据源为新 ECS：Animator（AoS：{prefab, state}）。
 */
import { Animator } from '../../core/ecs';
import { defaultEntityOutput, type AnimOutput } from './types';
import { getAnimator } from './registry';

export { registerAnimator, getAnimator, getAllAnimators } from './registry';
export type { AnimatorController, AnimOutput, AnimatorData } from './types';
export { defaultEntityOutput } from './types';

/**
 * 求值实体当前动画输出（渲染帧调用）。
 * 读取 Animator 组件（AoS）→ 找控制器 → getOutput 实时合成（支持 gs.time 连续动画）。
 */
export function getAnimOutput(e: number): AnimOutput {
  const anim = Animator[e];
  if (!anim) return defaultEntityOutput();
  const ctrl = getAnimator(anim.prefab);
  if (!anim.state) {
    // 防御：工厂未预初始化 state 时惰性创建
    anim.state = ctrl.createState();
  }
  return ctrl.getOutput(anim.state, e);
}
