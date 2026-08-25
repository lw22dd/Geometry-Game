/**
 * 可钩组件 —— 标记实体允许被钩锁命中的目标（能力组件，非分类标签）。
 *
 * 与 Hazard / Collectible / Goal 等一致，钩锁能力用独立组件显式声明，
 * 不再靠 PathMotion / SpringPad 组件"顺带代表可钩"。
 * 实体需同时拥有 Position + Collider 才会被钩锁射线检测到
 * （world.query(Position, Collider, Hookable)）。
 *
 * 当前为标记组件（空数据）；未来需要差异化锚点行为时在此扩展字段。
 *
 * @category 玩法/交互
 */
import type { ComponentType } from '../../core/ecs';

export interface Hookable {
  /**
   * 预留：锚点行为模式（默认 'offset' = 命中面外推安全距离，
   * 'surface' = 锚点贴面，需配合专用物理分支，避免埋入碰撞体）。
   */
  anchorMode?: 'offset' | 'surface';
}

export const Hookable = 'Hookable' as unknown as ComponentType<Hookable>;