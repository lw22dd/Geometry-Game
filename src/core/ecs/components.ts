/**
 * bitECS 组件层 —— 新 ECS 的全部组件存储。
 *
 * 设计约定：
 *  - 纯数值字段用 SoA（结构体数组）：`const Position = { x: [], y: [] }`，
 *    访问形如 `Position.x[eid]`。
 *  - 每个实体持有复杂对象（动画状态 / 路径几何 / 背包）用 AoS（对象数组）：
 *    访问形如 `Animator[eid] = { prefab, state }`。bitECS 允许任意 JS 引用作组件。
 *  - 布尔/枚举字段统一用 0/1 数值（ui8 语义）。
 *  - 标签组件 = 空对象 `{}`（仅表示"实体拥有该组件"），如 Orb / Hookable / Player。
 *
 * 本文件只定义数据，不含任何系统逻辑。
 */
import type { PathSegment, TrackState } from '../../types';
import { u8 } from 'bitecs/serialization';

/* ==================== 物理 / 运动 ==================== */

/** 世界坐标（格，y 轴向上） */
export const Position = { x: [] as number[], y: [] as number[] };

/** 速度矢量（格/秒，x 朝右为正、y 朝上为正） */
export const Velocity = { x: [] as number[], y: [] as number[] };

/** 碰撞箱：中心 = Position + (ox,oy)，尺寸 w×h；solid=1 实体 / 0 触发区 */
export const Collider = {
  w: [] as number[],
  h: [] as number[],
  ox: [] as number[],
  oy: [] as number[],
  solid: [] as number[],
};

/** 路径运动（移动平台）：正弦往返，dx/dy 为本帧位移增量（平台携带用） */
export const PathMotion = {
  x0: [] as number[],
  range: [] as number[],
  spd: [] as number[],
  ph: [] as number[],
  dx: [] as number[],
  /** 0=x 水平往返 / 1=y 垂直升降 */
  axis: [] as number[],
  y0: [] as number[],
  yRange: [] as number[],
  dy: [] as number[],
};

/** 弹簧平台：弹射力矢量 + 冷却/动画状态 */
export const SpringPad = {
  fx: [] as number[],
  fy: [] as number[],
  duration: [] as number[],
  cooldown: [] as number[],
  animTimer: [] as number[],
  firing: [] as number[],
};

/* ==================== 玩法 / 交互 ==================== */

/** 周期计时（激光）：on 由 LaserTimerSystem 每帧更新 */
export const Timer = {
  period: [] as number[],
  onDur: [] as number[],
  ph: [] as number[],
  on: [] as number[],
};

/** 危险物（尖刺/激光） */
export const Hazard = { damage: [] as number[] };

/** 可收集物（collected 用 u8 标签，便于 bitECS SoA 序列化走网络） */
export const Collectible = { collected: u8([]) };

/** 可收集物类型 —— 按用户决策拆为独立 tag 组件（而非字符串 kind） */
export const Orb = {};
export const JumpBoost = {};
export const Hook = {};

/** 检查点 */
export const RespawnPoint = { active: [] as number[], nearby: [] as number[] };

/** 终点（NOVA） */
export const Goal = { triggered: [] as number[] };

/** 冲刺轨道（数值字段）；路径段几何存 AoS 侧表 TrackGeom */
export const Track = {
  entryDist: [] as number[],
  exitDist: [] as number[],
  speedThreshold: [] as number[],
  entryX: [] as number[],
  entryY: [] as number[],
};
/** 轨道路径段几何（AoS 侧表，key = 轨道实体 eid） */
export const TrackGeom = [] as { segments: PathSegment[] }[];

/** 可被钩锁命中（tag；需同时有 Position + Collider） */
export const Hookable = {};

/* ==================== 表现 / 渲染 ==================== */

/** 可渲染：radius + styleId（索引 renderStyles 调色板） */
export const Renderable = { radius: [] as number[], styleId: [] as number[] };

/** 渲染样式调色板：styleId → 视觉参数（bodyGrad 三档渐变 + 发光色） */
export const renderStyles: { bodyGrad: [string, string, string]; glow: string }[] = [];

/** 动画状态（AoS）：prefab 控制器 key + 实体独立 FSM 状态 */
export const Animator = [] as { prefab: string; state: unknown }[];

/* ==================== 玩家 ==================== */

/** 玩家身份：playerId（房间号）+ local（1=本地玩家，0=远程/房主模拟） */
export const Player = { playerId: [] as number[], local: [] as number[] };

/** 玩家物理控制态（PlayerState 中所有纯数值字段的 SoA 拆分） */
export const PlayerControl = {
  half: [] as number[],
  grounded: [] as number[],
  coyote: [] as number[],
  jbuf: [] as number[],
  face: [] as number[],
  dead: [] as number[],
  deadT: [] as number[],
  sprint: [] as number[],
  wasSpr: [] as number[],
  inv: [] as number[],
  jumpWasDown: [] as number[],
  jumpFresh: [] as number[],
  hookCd: [] as number[],
  hookMissT: [] as number[],
  selectedSlot: [] as number[],
  /** 当前所在轨道实体 eid（-1 = 自由运动） */
  trackEntity: [] as number[],
  /** 当前骑乘平台实体 eid（-1 = 无） */
  platEntity: [] as number[],
  /** 该玩家激活的检查点（复活点） */
  cpX: [] as number[],
  cpY: [] as number[],
};

/** 空中跳充能（双跳票等能力挂载点）：left 剩余次数 / max 上限 */
export const JumpCharges = { left: [] as number[], max: [] as number[] };

/** 外力队列（AoS 侧表，key = 玩家实体 eid）：弹簧/击退/气流通用 */
export const ImpulseQueue = [] as { ax: number; ay: number; t: number }[][];

/** 玩家输入（InputKeys 全数值，可直接 SoA） */
export const PlayerInput = {
  left: [] as number[],
  right: [] as number[],
  jump: [] as number[],
  sprint: [] as number[],
  interact: [] as number[],
  hook: [] as number[],
  aimX: [] as number[],
  aimY: [] as number[],
};

/** 背包（AoS）：每玩家一项道具编码数组（0=doubleJump，1=hook；最多 5 格） */
export const Backpack = [] as number[][];

/** 玩家在轨状态（AoS 侧表，key = 玩家实体 eid）：完整 TrackState 或 null */
export const PlayerTrackState = [] as (TrackState | null)[];

/** 玩家骑乘平台增量（AoS 侧表，key = 玩家实体 eid）：每帧位移 dx/dy；null = 未骑乘 */
export const PlayerPlat = [] as ({ dx: number; dy: number } | null)[];

/** 道具编码常量（Backpack 数组元素） */
export const ITEM_DOUBLE_JUMP = 0;
export const ITEM_HOOK = 1;

/* ==================== 注册表（供 query/observe 使用） ==================== */

/** 全部数值 SoA 组件的汇总数组（一次性 registerComponents 用） */
export const soaComponents = [
  Position, Velocity, Collider, PathMotion, SpringPad,
  Timer, Hazard, Collectible, RespawnPoint, Goal, Track,
  Renderable, Player, PlayerControl, PlayerInput, JumpCharges,
];
