/**
 * systems/animation —— 统一实体动画系统。
 *
 * 职责：
 *  - stepAnimation(dt)：每物理步遍历带 Animator 的实体，步进其 FSM。
 *  - 输出参数由绘制层在渲染帧经 getAnimOutput() 实时求值（保持 gs.time 连续动画）。
 *
 * 数据源：新 ECS（qAnimators = Position + Animator(AoS)）。
 */
import { qAnimators } from '../../core/ecs';
import { Animator } from '../../core/ecs';
import { getAnimator } from '../../Prefabs/Animations';

// ── 副作用导入：注册内建实体动画控制器（模块加载时 registerAnimator）──
import '../../Prefabs/Scenes/itemsAnimators';

/**
 * 步进所有带 Animator 的实体（物理子步调用）。
 * 只推进 FSM 状态（边沿检测 / 状态切换 / 计时）；
 * 绘制变换由渲染层读取 AnimOutput 实时合成。
 */
export function stepAnimation(dt: number): void {
  for (const e of qAnimators()) {
    const anim = Animator[e];
    const ctrl = getAnimator(anim.prefab);
    if (!anim.state) {
      // 工厂未预初始化 state 时惰性创建（防御路径）
      anim.state = ctrl.createState();
    }
    ctrl.step(anim.state, e, dt);
  }
}