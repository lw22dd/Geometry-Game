/**
 * 实体动画契约 —— 场景道具（光球/NOVA/双跳票/钩锁/未来敌人）的 FSM 接口。
 *
 * 控制器契约：每种动画预制体实现 AnimatorController 接口，含步进+输出合成。
 * 输出参数包：绘制层读取 scaleX/Y / rotation / offsetX/Y / alpha 等绘制。
 *
 * 与玩家动画并行：玩家用 Prefabs/Player 的独立 FSM + 类型系统；
 * 其他实体通过 Animator 组件（core/ecs）接入统一步进系统（systems/animation）。
 */
import type { EntityId } from '../../core/ecs';

/** 动画状态组件数据 —— 挂在实体上（Animator AoS 的存储结构） */
export interface AnimatorData {
  /** 控制器注册表 key，如 'orb' / 'nova' / 'jumpBoost' / 'hook' */
  prefab: string;
  /** 该实体的动画状态实例（由对应控制器的 createState 创建） */
  state: unknown;
}

/* ==================== 控制器契约 ==================== */

export interface AnimatorController {
  /** 预制体唯一 id（注册表 key），与 AnimatorData.prefab 对应 */
  id: string;
  /** 创建该实体独立的动画状态实例 */
  createState(init?: Record<string, number>): unknown;
  /**
   * 步进 FSM（物理步调用）。
   * 读取实体上的组件（Position / Collectible / Goal 等）做边沿检测，
   * 推进状态机，维护自身记忆。
   */
  step(state: unknown, entity: EntityId, dt: number): void;
  /**
   * 从状态合成输出参数包（渲染帧调用）。
   * 可读取 gs.time 做连续时间动画。
   */
  getOutput(state: unknown, entity: EntityId): AnimOutput;
}

/* ==================== 输出参数包 ==================== */

/**
 * 通用实体动画输出参数包。
 * 绘制层读取这些参数决定绘制时的变换与透明度。
 * 与玩家 AnimOutput（types/index.ts）独立，避免耦合玩家 FSM 类型。
 */
export interface AnimOutput {
  scaleX: number;
  scaleY: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  alpha: number;
  /** 当前 FSM 状态名（调试 / 绘制层按状态分支） */
  state: string;
  /** 当前状态持续时长（秒） */
  stateTime: number;
}

/** 创建默认输出（1:1 无变换完全不透明 idle） */
export function defaultEntityOutput(): AnimOutput {
  return {
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
    alpha: 1,
    state: 'idle',
    stateTime: 0,
  };
}
