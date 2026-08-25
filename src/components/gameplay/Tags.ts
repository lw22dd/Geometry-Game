/**
 * 通用标签组件 —— 给实体打上多个自定义字符串标签。
 *
 * 标签用于分类/分组/筛选，不替代功能组件（Hazard / Collectible / Goal 等）。
 * 可选：只有需要标签化的实体才添加此组件。
 *
 * 玩家使用 `Tags { values: ['player'] }`（常量 TAG_PLAYER 见 tagHelpers）。
 *
 * 标签约定（建议）：
 *   - 统一小写字母 + 连字符/冒号，例如 "enemy"、"faction:red"
 *   - 不包含空字符串
 *   - 不包含重复项
 *   - 标签不携带运行时数据；如需状态/数据，请使用专用组件
 *
 * @category 玩法/交互
 */
import type { ComponentType } from '../../core/ecs';

export interface Tags {
  /** 标签列表（可为空）；不包含重复项，大小写敏感 */
  values: string[];
}

export const Tags = 'Tags' as unknown as ComponentType<Tags>;