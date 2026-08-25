/**
 * 组件 barrel 导出 —— 按职责域分组归档。
 * 每个组件模块同时导出 interface（类型）和 const（运行时 key）。
 *
 * ── 物理 / 运动（实体在世界中的空间与运动状态）──
 *   Position     世界坐标（格）
 *   Velocity     速度矢量（格/秒）
 *   Collider     碰撞盒
 *   PathMotion   路径运动（移动平台）
 *   Track        轨道运动（冲刺环）
 *   SpringPad     弹簧平台（弹射力 + 动画状态）
 *
 * ── 玩法 / 交互（决定实体的游戏语义）──
 *   Timer        计时（激光/限时机关）
 *   Hazard       危险物（尖刺/激光）
 *   Collectible  可收集（光球 / 二段跳票 / 钩锁，以 kind 区分）
 *   RespawnPoint 检查点
 *   Goal         终点（NOVA）
 *   Tags         多字符串标签（分类/分组；玩家 = 'player' 标签，见 tagHelpers）
 *
 * ── 表现 / 渲染（实体如何被绘制）──
 *   Renderable   渲染描述（绘制层）
 */
export { Position } from './physics/Position';
export { Velocity } from './physics/Velocity';
export { Collider } from './physics/Collider';
export { PathMotion } from './physics/PathMotion';
export { Track } from './physics/Track';
export { SpringPad } from './physics/SpringPad';

export { Timer } from './gameplay/Timer';
export { Hazard } from './gameplay/Hazard';
export { Collectible } from './gameplay/Collectible';
export { RespawnPoint } from './gameplay/RespawnPoint';
export { Goal } from './gameplay/Goal';
export { Tags } from './gameplay/Tags';

export { Renderable } from './render/Renderable';

// 标签工具函数（TAG_PLAYER / addTag / hasTag / removeTag / getTags / queryByTag / queryOneByTag）
export * from './gameplay/tagHelpers';