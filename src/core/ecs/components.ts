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
import type { ItemId, PathSegment, StatModifier, TrackState } from '../../types';
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

/**
 * 生命值（敌人 / 可摧毁物）。玩家 HP 走 PlayerControl（玩家状态唯一权威 = PlayerState），
 * 本组件只服务非玩家实体，避免玩家的"状态真源"出现第二份。
 * inv = 受击后无敌剩余（秒），防持续接触伤害逐物理步结算。
 */
export const Health = {
  hp: [] as number[],
  max: [] as number[],
  inv: [] as number[],
};

/** 可收集物（collected 用 u8 标签，便于 bitECS SoA 序列化走网络） */
export const Collectible = { collected: u8([]) };

/** 可收集物类型 —— 按用户决策拆为独立 tag 组件（而非字符串 kind） */
export const Orb = {};
export const JumpBoost = {};
export const Hook = {};
export const ShieldPickup = {};
export const SpeedPickup = {};
export const RecallPickup = {};

/**
 * 武器拾取物（SoA：kind = weaponToCode 编码；拾取后装备主武器 / 获得手雷副武器）。
 * 武器与背包道具独立体系（不进 Backpack ITEMS 槽位）。
 */
export const WeaponPickup = { kind: [] as number[] };

/**
 * 密码机（第五人格式交互物）。
 * progress：破译进度 0-100（%）；done：1 = 已完成（进度满后锁定）。
 * 玩家靠近并持续按 E 破译；完成状态经 host_state 广播同步（同 orb）。
 */
export const Cipher = {
  progress: [] as number[],
  done: [] as number[],
};

/**
 * 宝箱（场景交互物）。
 * type：0 = 武器宝箱（橙红）/ 1 = 道具宝箱（蓝青）
 * state：0 = 冷却中 / 1 = 可开启 / 2 = 已开启（开启动画中）
 * timer：计时器（state0 累计到 CHEST_COOLDOWN 转可开启；state2 累计到开启动画时长转冷却）
 */
export const Chest = {
  type: [] as number[],
  state: [] as number[],
  timer: [] as number[],
};

/**
 * 掉落物（宝箱掉落的临时可拾取物；附加在现有拾取物实体上）。
 * type：0 = 武器掉落 / 1 = 道具掉落（保留语义，便于扩展/绘制）
 * lifetime：剩余存在时间（秒），到期由 ChestSystem 移除实体
 */
export const Loot = {
  type: [] as number[],
  lifetime: [] as number[],
};

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

/**
 * 光环（范围持续场，扩展占位）—— 进出/周期结算由 AuraSystem 处理。
 * radius 半径（格）/ tick 结算周期（秒，0=仅进出不周期）/ tickT 累计计时。
 * 效果配置（onEnter/onExit/onTick → PlayerRequest）由 AuraSystem 侧注册，
 * 保持组件层纯数据（"之后每个光环只是配置"）。
 */
export const Aura = { radius: [] as number[], tick: [] as number[], tickT: [] as number[] };

/** 可被钩锁命中（tag；需同时有 Position + Collider） */
export const Hookable = {};

/** 抛体（手雷等）：初速 + 重力 + 引信 + 爆炸参数（SoA，S2） */
export const Projectile = {
  vx: [] as number[],
  vy: [] as number[],
  /** 重力加速度（格/秒²，正值 = 向下加速） */
  gravity: [] as number[],
  /** 引信剩余时长（秒，<=0 爆炸） */
  fuse: [] as number[],
  /** 爆炸半径（格） */
  blastRadius: [] as number[],
  /** 爆炸伤害 */
  damage: [] as number[],
};

/* ==================== 表现 / 渲染 ==================== */

/** 可渲染：radius + styleId（索引 renderStyles 调色板） */
export const Renderable = { radius: [] as number[], styleId: [] as number[] };

/** 渲染样式调色板：styleId → 视觉参数（bodyGrad 三档渐变 + 发光色） */
export const renderStyles: { bodyGrad: [string, string, string]; glow: string }[] = [];

/** 动画状态（AoS）：prefab 控制器 key + 实体独立 FSM 状态 */
export const Animator = [] as { prefab: string; state: unknown }[];

/* ==================== 敌人（S3） ==================== */

/**
 * 敌人大脑（AoS，同 Animator 模式）：kind + 敌人独立 AI/物理状态。
 * 敌人状态真源在此侧表，不做玩家那套「SoA → scratch → 写回」搬运；
 * 仅被 HUD / 子弹查询的字段（位置/生命）走 SoA。
 */
export const EnemyBrain = [] as { kind: string; state: unknown }[];

/** 阵营标签（tag）：PvE 中敌我区分（敌人 = Team，玩家无此标签） */
export const Team = {};

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
  /** 水平移速倍率（默认 1；加速 buff 时 = 2） */
  speedMult: [] as number[],
  /** 当前所在轨道实体 eid（-1 = 自由运动） */
  trackEntity: [] as number[],
  /** 当前骑乘平台实体 eid（-1 = 无） */
  platEntity: [] as number[],
  /** 该玩家激活的检查点（复活点） */
  cpX: [] as number[],
  cpY: [] as number[],
  /** 当前生命值（战斗；PlayerState.hp 的 SoA 投影，状态真源仍在 PlayerState） */
  hp: [] as number[],
  /** 生命上限 */
  maxHp: [] as number[],
  /** 当前主武器（weaponToCode 编码，S2 投影；'none' = -1） */
  weapon: [] as number[],
  /** 弹匣内弹药（S2 投影） */
  ammo: [] as number[],
  /** 是否拥有手雷副武器（0/1；拾取手雷道具后 1；S2 投影） */
  hasGrenade: [] as number[],
  /** 换弹剩余时间（秒，>0 = 换弹中；S2 投影） */
  reloadT: [] as number[],
  /** 开火冷却剩余时间（秒；S2 投影） */
  fireCd: [] as number[],
};

/** 空中跳充能（双跳票等能力挂载点）：left 剩余次数 / max 上限 */
export const JumpCharges = { left: [] as number[], max: [] as number[] };

/** 护盾格挡次数（限时 buff 的 SoA 投影，对称 JumpCharges）：left 剩余格数 / max 上限 */
export const ShieldCharges = { left: [] as number[], max: [] as number[] };

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

/** 背包（AoS）：每玩家一项道具编码数组（编码唯一事实源 = items/backpack ITEMS 条目的 code；最多 5 格） */
export const Backpack = [] as ItemId[][];

/** 玩家在轨状态（AoS 侧表，key = 玩家实体 eid）：完整 TrackState 或 null */
export const PlayerTrackState = [] as (TrackState | null)[];

/** 玩家骑乘平台增量（AoS 侧表，key = 玩家实体 eid）：每帧位移 dx/dy；null = 未骑乘 */
export const PlayerPlat = [] as ({ dx: number; dy: number } | null)[];

/** 玩家数值修正（AoS 侧表，key = 玩家实体 eid）：Modifier 管道（stat+source 幂等） */
export const PlayerModifiers = [] as StatModifier[][];

/**
 * 玩家控制权（S3 仲裁结果，SoA）：每帧由 ControlArbiter 按优先级表写入，
 * MovementSystem 消费时按 mode 分支。值见 CONTROL_MODE_* 常量。
 * 默认 free=0；扩展位：ControlLock 类约束（冰冻/眩晕）经仲裁叠加更高优先级。
 */
export const ControlMode = { mode: [] as number[] };

/** 控制权枚举：优先级越高越靠后（仲裁取最高） */
export const CONTROL_MODE_FREE = 0;
export const CONTROL_MODE_TRACK = 1;
export const CONTROL_MODE_ZIPLINE = 2;
export const CONTROL_MODE_DEAD = 3;
/** 约束类控制权（眩晕/定身等，扩展位）：仲裁表插入更高优先级谓词后启用 */
export const CONTROL_MODE_CONSTRAINT = 4;

/* ==================== 注册表（供 query/observe 使用） ==================== */

/** 全部数值 SoA 组件的汇总数组（一次性 registerComponents 用） */
export const soaComponents = [
  Position, Velocity, Collider, PathMotion, SpringPad,
  Timer, Hazard, Health, Collectible, Cipher, Chest, Loot, RespawnPoint, Goal, Track, Aura,
  Projectile, WeaponPickup,
  Renderable, Player, PlayerControl, PlayerInput, JumpCharges, ShieldCharges, ControlMode,
];
