/** 共享类型定义 —— 全项目统一在此声明跨模块类型。
 * 依赖规则：types/ 不得依赖任何其他模块（types 内部相互引用允许）。 */
export type { PathSegment } from './path';
import type { PathSegment } from './path';

/** 二维矢量（物理量统一用此接口，不拆 x/y 字段） */
export interface Vector2 {
  x: number;
  y: number;
}

/** 矩形刚体（平台 / 移动平台 / 碰撞盒） */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 顶边世界 Y 坐标（= y + h） */
  top: number;
  /** 若属于移动平台，指向其运动组件（用于携带） */
  plat?: PlatRef;
  /** 若属于弹簧平台，指向其 ECS 实体 ID（用于弹射检测） */
  springPad?: number;
}

/** 平台携带引用 —— 每帧位移增量 dx（水平）/ dy（垂直） */
export interface PlatRef {
  dx: number;
  dy: number;
}

/** 移动平台生成数据（地图描述符使用） */
export interface MoverSpawnData {
  /** 起始 X（左缘） */
  x0: number;
  /** 底部 Y（格，y 轴向上） */
  y: number;
  w: number;
  h: number;
  /** 水平摆动范围（格，axis='x' 时生效） */
  range: number;
  spd: number;
  ph: number;
  /** 运动轴：'x' 水平往返（默认）/ 'y' 垂直升降（电梯） */
  axis?: 'x' | 'y';
  /** 垂直升降范围（格，axis='y' 时生效；以 y 为基线上下摆动） */
  yRange?: number;
}

/** 尖刺 */
export interface Spike {
  x: number;
  y: number;
}

/** 激光栅栏生成数据（地图描述符使用） */
export interface LaserSpawnData {
  x: number;
  /** 底部 Y（格） */
  y0: number;
  /** 高度（格） */
  len: number;
  ph: number;
}

/** 弹簧平台生成数据（地图描述符使用） */
export interface SpringPadSpawnData {
  /** 底座底部 X（左缘） */
  x: number;
  /** 底座底部 Y（格，y 轴向上） */
  y: number;
  w: number;
  h: number;
  /** 弹射力矢量（格/秒），朝右为正、朝上为正 */
  force: Vector2;
  /** 加速度持续时长（秒） */
  duration: number;
}

/** HUD 提示（x, y, 文案） */
type Hint = [number, number, string];

/** 装饰方块（x, y, 尺寸, 旋转速度） */
type Deco = [number, number, number, number];

/** 视差背景远层圆（mulberry 生成） */
export interface FarShape {
  x: number;
  y: number;
  r: number;
  c: string;
  a: number;
}

/** 视差背景中层形状（方 / 圆） */
export interface MidShape {
  x: number;
  y: number;
  s: number;
  sp: number;
  ph: number;
  t: number;
}

/** 轨道生成数据（地图描述符使用；轨道为可选实体生成项） */
export interface TrackSpawnData {
  /** 路径段数组（line / arc） */
  segments: PathSegment[];
  /** 入口距离（格，从路径起点算起） */
  entryDist: number;
  /** 出口距离（格） */
  exitDist: number;
  /** 捕获所需最小速度（m/s，默认 TRACK_MIN_SPEED=7） */
  speedThreshold?: number;
}

/** 轨道运动状态（玩家在路径上时） */
export interface TrackState {
  /** 路径段数组（定义曲线几何） */
  segments: PathSegment[];
  /** 已构造的累积长度数组 */
  cumulative: number[];
  /** 当前沿路径行驶距离（格） */
  dist: number;
  /** 沿路径线速度（m/s） */
  speed: number;
  /** 路径总长（格） */
  totalLength: number;
  /** 入口距离（格，捕获时从此处开始） */
  entryDist: number;
  /** 出口距离（格，到达后释放） */
  exitDist: number;
  /** 滑索（钩锁）模式：匀速沿线滑行，不受切向重力/摩擦/滚回影响 */
  zipline?: boolean;
}

/* ==================== 背包/道具 ==================== */

/** 道具 id */
export type ItemId = 'doubleJump' | 'hook';

/** 道具类别：主动（玩家触发）/ 被动（拾取即生效常驻） */
export type ItemCategory = 'active' | 'passive';

/** 背包空格数量上限 */
export const MAX_BACKPACK = 5;

/** 双物理模式参数 */
export interface PhysicsMode {
  G: number;
  JV: number;
  MF: number;
  coy: number;
  jb: number;
  air: number;
  name: string;
}

/** 玩家状态 */
export interface PlayerState {
  x: number;
  y: number;
  /** 速度矢量（格/秒），value.x 朝右为正、value.y 朝上为正 */
  velocity: Vector2;
  half: number;
  grounded: boolean;
  coyote: number;
  jbuf: number;
  face: number;
  dead: boolean;
  deadT: number;
  plat: PlatRef | null;
  sprint: boolean;
  wasSpr: boolean;
  inv: number;
  /** 剩余额外跳跃次数（当前滞空期内可用；每次着陆刷新为 extraJumpsMax） */
  extraJumps: number;
  /** 额外跳跃最大次数（双跳光球永久升级，拾取后 = 1；0 = 未拾取） */
  extraJumpsMax: number;
  /** 上一物理步跳跃键是否按下（用于二段跳"新按下沿"检测：按下一次跳一次） */
  jumpWasDown: boolean;
  /** 输入层跳跃按下标记：由 keydown handler 写入，物理步消耗。
   *  不受帧间 timing 影响，确保松开→重按的二段跳永远可靠。 */
  jumpFresh: boolean;
  /** 弹簧加速剩余时长（秒，>0 时每帧施加 springAcceleration 加速度） */
  springT: number;
  /** 弹簧加速度矢量（格/秒²），持续加速方向 */
  springAcceleration: Vector2;
  /** 轨道运动状态（null = 自由运动） */
  track: TrackState | null;
  /** 背包槽位（道具 id 列表，最多 5 格） */
  backpack: ItemId[];
  /** 钩锁冷却剩余时间（秒） */
  hookCd: number;
  /** 钩锁收回动画剩余时间（秒，>0 时绘制收回线） */
  hookMissT: number;
  /** 当前选中的背包槽位（0-4，用于主动道具） */
  selectedSlot: number;
}

/** 曳光轨迹点 */
export interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

/** 粒子类型 */
export type ParticleKind = 'dot' | 'frag' | 'arrow';

/** 粒子 */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  grav: number;
  size: number;
  col: string;
  type: ParticleKind;
  rot: number;
  vr: number;
}

/** 玩家动画状态（预制体 FSM 输出） */
export type PlayerAnimState =
  | 'idle' | 'run' | 'jumpRise' | 'jumpFall' | 'land' | 'dash'
  | 'collectPulse' | 'bump' | 'celebrate' | 'dead' | 'respawn';

/** 动画输出参数包（预制体 FSM 每帧计算） */
export interface AnimOutput {
  scaleX: number;
  scaleY: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  alpha: number;
  state: PlayerAnimState;
  stateTime: number;
}

/**
 * 玩家动画帧信号 —— 一次性碰撞/交互事件（system 检测到后发射给预制体 FSM）。
 * 仅存在于当前物理子步内，不持久化。
 */
export interface FrameSignals {
  /** 本帧收集了光球 */
  collected?: boolean;
  /** 本帧激活了检查点 */
  checkpointHit?: boolean;
  /** 本帧到达终点 */
  goalReached?: boolean;
  /** 本帧撞墙（水平碰撞且速度较大） */
  wallBump?: boolean;
  /** 本帧拾取了双跳光球 */
  jumpBoostPicked?: boolean;
  /** 本帧拾取了钩锁道具 */
  hookPicked?: boolean;
  /** 本帧触发了弹簧平台 */
  spring?: boolean;
  /** 本帧使用了空中二段跳 */
  doubleJump?: boolean;
  /** 本帧进入轨道 */
  trackEntered?: boolean;
  /** 本帧通过出口离开轨道 */
  trackExited?: boolean;
  /** 本帧向心力不足脱落 */
  trackDetached?: boolean;
  /** 本帧速度耗尽滚回 */
  trackRollback?: boolean;
}

/** 游戏全局状态（game 系统持有） */
export interface GameState {
  time: number;
  gt: number;
  gotN: number;
  deaths: number;
  win: boolean;
  winTime: number;
  started: boolean;
  /** 当前画面：'menu' 开始菜单 / 'prepare' 准备界面(选图/选人) / 'playing' 游戏中 / 'paused' 暂停 */
  screen: 'menu' | 'prepare' | 'playing' | 'paused';
  toast: string;
  toastT: number;
  flash: number;
  shake: number;
}

/** 地图描述符 —— 静态几何 + 实体生成描述（config/level.ts 注册表项） */
export interface MapDefinition {
  id: string;
  name: string;
  width: number;
  height: number;
  /** 玩家出生点（也是初始复活点） */
  playerSpawn: { x: number; y: number };

  /** ── 静态几何（非 ECS，纯数据）── */
  solids: Rect[];
  spikes: Spike[];
  decos: Deco[];
  hints: Hint[];

  /** ── 实体生成描述（ECS 实体工厂使用）── */
  entitySpawners: {
    movers: MoverSpawnData[];
    springPads: SpringPadSpawnData[];
    lasers: LaserSpawnData[];
    orbs: [number, number][];
    /** 双跳光球坐标 */
    jumpBoosts: [number, number][];
    /** 钩锁道具坐标（可选；无钩锁的地图省略） */
    hooks?: [number, number][];
    checkpoints: [number, number][];
    nova: { x: number; y: number };
    /** 冲刺轨道（可选；无轨道的地图省略） */
    tracks?: TrackSpawnData[];
  };
}

/** netBus 事件载荷 */
export type NetBusEvent =
  | { type: 'game:started' }
  | { type: 'game:checkpoint'; x: number; y: number }
  | { type: 'game:orb'; count: number; total: number }
  | { type: 'game:jumpboost' }
  | { type: 'game:hookpickup' }
  | { type: 'game:death'; deaths: number }
  | { type: 'game:win'; time: number; orbs: number; total: number; x: number; y: number; playerId: number }
  // ── 特效同步：死亡特效由房主广播（房主是死亡判定权威）──
  | { type: 'fx:death'; x: number; y: number; playerId: number }
  // ── 联机扩展 ──
  | { type: 'net:connected'; role: NetRole; playerId: number }
  | { type: 'net:playerJoined'; player: RemotePlayerInfo }
  | { type: 'net:playerLeft'; playerId: number }
  | { type: 'net:playerUpdated'; player: RemotePlayerInfo }
  | { type: 'net:disconnected'; reason: string };

/* ==================== 联机类型 ==================== */

/** 角色：单机 / 房主 / 客机 */
export type NetRole = 'standalone' | 'host' | 'client';

/** 远程玩家摘要信息（房间列表） */
export interface RemotePlayerInfo {
  id: number;
  name: string;
  /** 所选角色预制体 id（房间内选人/握手时上报） */
  char?: string;
  /** 是否已准备（房间流程） */
  ready?: boolean;
}

/** 按键输入快照（网络传输格式） */
export interface InputKeys {
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  /** 交互键（E）：按下时 true，用于检查点等可交互物 */
  interact: boolean;
  /** 钩锁左键按住状态（true = 按住中；房主端用 hold && !prev 还原发射沿） */
  hook: boolean;
  /** 鼠标瞄准世界坐标 X（格） */
  aimX: number;
  /** 鼠标瞄准世界坐标 Y（格） */
  aimY: number;
}

/** 玩家权威状态（房主 → 客机） */
export interface NetPlayerState {
  playerId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  face: number;
  grounded: boolean;
  dead: boolean;
  sprint: boolean;
  inv: number;
  hasPlat: boolean;
  platDx: number;
  /** 轨道运动状态 */
  trackOn: boolean;
  /** 滑索（钩锁）轨道标记 */
  trackZipline: boolean;
  /** 沿路径行驶距离（格） */
  trackDist: number;
  trackSpeed: number;
  /** 入口距离（格） */
  trackEntry: number;
  /** 出口距离（格） */
  trackExit: number;
  /** 路径段定义（客户端由此重建 TrackState） */
  trackSegments: PathSegment[];
  /** 背包道具（数字编码：0=doubleJump, 1=hook） */
  backpack: number[];
}

/** 光球权威状态 */
export interface NetOrbState {
  entityId: number;
  collected: boolean;
}

/** 道具权威状态（jumpboost / hook 实体 collected 同步） */
export interface NetItemState {
  entityId: number;
  collected: boolean;
}

/** 远程玩家（房主模拟权威状态 + 客机渲染，含 PlayerState 全字段） */
export interface RemotePlayer extends PlayerState {
  id: number;
  name: string;
  /** 该玩家激活的检查点（房主记录） */
  cpX: number;
  cpY: number;
}