/**
 * 敌人共享契约（S3）—— 基础配置 + 判别联合 + 判别状态 + 行为契约 + 绘制入参。
 *
 * 架构约定（杜绝「一个接口装全部」）：
 *  - `EnemyBaseDef` 只放所有敌人共有的字段（移动/警戒/接触伤害/配色）；
 *  - 每种敌人的专属行为配置独立成接口，用 `id` 字面量判别联合收窄：
 *      `def.id === 'creeper'` → TS 自动收窄出 `def.fuse`（引爆配置）
 *      `def.id === 'gorilla'` → TS 自动收窄出 `def.melee` / `def.rock`
 *  - AoS 状态同理：共有字段放 `EnemySharedState`，专属字段并入各自的判别状态
 *    （`CreeperState.fuse` / `GorillaState.attack`），按 `EnemyBrain.kind` 收窄。
 *  - 行为由预制体自决：控制器喂 `StepInput`（通用准备：目标/距离），
 *    专属 `step` 返回 `StepResult`（移动意向）并自行完成状态推进与结算。
 *
 * 新增敌人种类 = 三步：
 *   1. 本文件加 `XxxDef extends EnemyBaseDef`（id 字面量判别）+ 判别状态，并入联合
 *   2. kinds.ts 的 `ENEMY_KINDS` 加一条数据
 *   3. 新建 `xxx.ts`：纯绘制 + 专属 `step` 行为，kinds.ts 分发
 */
import type { EnemyKind, PlayerState } from '../../types';

/* ==================== 配置（判别联合） ==================== */

/** 所有敌人共有的视觉/数值配置 */
export interface EnemyBaseDef {
  id: EnemyKind;
  name: string;
  /** 碰撞半宽（格） */
  half: number;
  /** 最大生命 */
  hp: number;
  /** 巡逻移速（格/秒） */
  speed: number;
  /** 追击移速（格/秒） */
  chaseSpeed: number;
  /** 巡逻范围半径（围绕 homeX，格） */
  patrolRange: number;
  /** 警戒距离（格）：进入后转向玩家 */
  detectRange: number;
  /** 追击距离（格）：超过则回到巡逻 */
  loseRange: number;
  /** 接触伤害（撞到玩家单次扣血；0 = 无接触伤害，靠专属行为） */
  contactDamage: number;
  /** 主体色（bodyGrad 三档渐变） */
  bodyGrad: [string, string, string];
  /** 发光色 */
  glow: string;
  /** 碰撞箱总高（格）；默认 half*2 */
  height?: number;
}

/** 行走兵：无专属行为（纯接触伤害型） */
export interface WalkerDef extends EnemyBaseDef {
  id: 'walker';
}

/** 苦力怕引爆配置（自爆型专属） */
export interface CreeperFuseDef {
  /** 引爆触发距离（格）：玩家进入后开始倒计时 */
  range: number;
  /** 引爆延迟（秒） */
  time: number;
  /** 爆炸半径（格） */
  blastRadius: number;
  /** 爆炸伤害 */
  blastDamage: number;
}

/** 苦力怕：自爆型敌人 */
export interface CreeperDef extends EnemyBaseDef {
  id: 'creeper';
  /** 引爆/爆炸专属配置 */
  fuse: CreeperFuseDef;
}

/** 大猩猩近战砸地配置 */
export interface GorillaMeleeDef {
  /** 攻击距离（格，以碰撞中心计） */
  range: number;
  /** 单次伤害 */
  damage: number;
  /** 前摇（秒）：手臂旋转蓄力 */
  windup: number;
  /** 冷却（秒） */
  cooldown: number;
}

/** 大猩猩投石配置 */
export interface GorillaRockDef {
  /** 攻击距离（格） */
  range: number;
  /** 单次伤害 */
  damage: number;
  /** 前摇（秒）：高举手臂蓄力 */
  windup: number;
  /** 冷却（秒） */
  cooldown: number;
  /** 石头重力（格/秒²，向下为正） */
  gravity: number;
  /** 投石初速（格/秒，决定飞行时间） */
  speed: number;
  /** 石头碰撞半径（格） */
  radius: number;
}

/** 大猩猩：近战 + 远程投石混合型 */
export interface GorillaDef extends EnemyBaseDef {
  id: 'gorilla';
  /** 近战砸地配置 */
  melee: GorillaMeleeDef;
  /** 远程投石配置 */
  rock: GorillaRockDef;
}

/** 敌人配置判别联合：按 `id` 收窄访问专属行为配置 */
export type EnemyKindDef = WalkerDef | CreeperDef | GorillaDef;

/* ==================== AoS 状态（按种类分组的专属状态） ==================== */

/** 冰冻减速状态（iceBomb 命中写入，EnemyController 消费） */
export interface SlowState {
  /** 减速剩余时长（秒） */
  t: number;
  /** 减速倍率（<1 = 减速；如 0.8 = 减速 20%） */
  f: number;
}

/** 苦力怕引爆状态 */
export interface CreeperFuseState {
  /** 引爆倒计时（秒，>0 = 正在引爆） */
  t: number;
}

/** 大猩猩攻击状态（近战/投石共用一套攻击计时） */
export interface GorillaAttackState {
  /** 当前攻击类型 */
  phase: 'melee' | 'throw';
  /** 攻击倒计时（秒，>0 = 攻击中；前摇走完即结算） */
  t: number;
  /** 攻击冷却（秒，>0 = 冷却中） */
  cd: number;
  /** 投石锁定瞄准点（启动攻击瞬间锁定的玩家位置） */
  aimX: number;
  aimY: number;
}

/** 敌人共享 AI 状态（所有种类共有字段，AoS 侧表 EnemyBrain[eid].state） */
export interface EnemySharedState {
  /** 巡逻模式朝向（±1） */
  dir: 1 | -1;
  /** 巡逻中心 X（格） */
  homeX: number;
  /** 当前模式：'patrol' | 'chase' */
  mode: 'patrol' | 'chase';
  /** 是否在地面（重力的地面碰撞结果） */
  grounded: boolean;
  /** 动画计时（腿摆相位） */
  walkT: number;
  /** 冰冻减速（kind 无关，iceBomb 命中写入） */
  slow?: SlowState;
}

/** 行走兵状态：无专属字段（纯接触伤害型） */
export interface WalkerState extends EnemySharedState {}

/** 苦力怕状态：强制携带引爆状态 */
export interface CreeperState extends EnemySharedState {
  /** 引爆状态（生成即初始化） */
  fuse: CreeperFuseState;
}

/** 大猩猩状态：强制携带攻击状态 */
export interface GorillaState extends EnemySharedState {
  /** 攻击状态（近战/投石共用一套计时） */
  attack: GorillaAttackState;
}

/** 敌人状态判别联合：按 EnemyBrain.kind 收窄访问专属字段 */
export type EnemyState = WalkerState | CreeperState | GorillaState;

/* ==================== 绘制入参 ==================== */

/** 敌人实体可视化状态（纯绘制层只读此结构，不直接读 AI 状态字段） */
export interface DrawView {
  x: number; y: number;
  half: number;
  face: number;
  grounded: boolean;
  mode: 'patrol' | 'chase';
  walkT: number;
  inv: number;
  hp: number; maxHp: number;
  /** 冰冻减速（null = 正常） */
  slow: SlowState | null;
  /** 苦力怕引爆（null = 未引爆） */
  fuse: CreeperFuseState | null;
  /** 大猩猩攻击（null = 未攻击） */
  attack: GorillaAttackState | null;
}

/* ==================== 行为契约（专属 step 的入参 / 出参） ==================== */

/** 行为 step 入参：控制器已完成的通用准备（目标选择等），专属行为只消费与决策 */
export interface StepInput {
  /** 实体 id */
  e: number;
  /** 帧时间（秒） */
  dt: number;
  /** 最近存活玩家（已处于 detectRange 内；null = 无目标） */
  target: PlayerState | null;
  /** 与目标中心距离²（target 非空时有效） */
  dist2: number;
  /** 全部存活玩家（专属结算用：自爆全范围判定 / 近战范围判定） */
  players: { state: PlayerState }[];
}

/** 行为 step 出参：通知控制器本帧的移动意向 */
export interface StepResult {
  /** true = 停身（不水平移动；如引爆中 / 攻击锁定） */
  hold?: boolean;
}