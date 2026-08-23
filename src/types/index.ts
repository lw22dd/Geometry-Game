/**
 * 共享类型定义 —— 全项目统一在此声明跨模块类型。
 * 依赖规则：types/ 不得依赖任何其他模块。
 */

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
}

/** 平台携带引用 —— 只需每帧位移增量 dx */
export interface PlatRef {
  dx: number;
}

/** 移动平台生成数据（地图描述符使用） */
export interface MoverSpawnData {
  /** 起始 X（左缘） */
  x0: number;
  /** 底部 Y（格，y 轴向上） */
  y: number;
  w: number;
  h: number;
  /** 摆动范围（格） */
  range: number;
  spd: number;
  ph: number;
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

/** HUD 提示（x, y, 文案） */
export type Hint = [number, number, string];

/** 装饰方块（x, y, 尺寸, 旋转速度） */
export type Deco = [number, number, number, number];

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
  vx: number;
  vy: number;
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
}

/** 相机状态 */
export interface CameraState {
  x: number;
  y: number;
}

/** 曳光轨迹点 */
export interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

/** 粒子类型 */
export type ParticleKind = 'dot' | 'frag';

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
  /** 当前画面：'menu' 开始菜单 / 'playing' 游戏中 / 'paused' 暂停 */
  screen: 'menu' | 'playing' | 'paused';
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
    lasers: LaserSpawnData[];
    orbs: [number, number][];
    checkpoints: [number, number][];
    nova: { x: number; y: number };
  };
}

/** netBus 事件载荷 */
export type NetBusEvent =
  | { type: 'game:started' }
  | { type: 'game:checkpoint'; x: number; y: number }
  | { type: 'game:orb'; count: number; total: number }
  | { type: 'game:death'; deaths: number }
  | { type: 'game:win'; time: number; orbs: number; total: number }
  // ── 联机扩展 ──
  | { type: 'net:connected'; role: NetRole; playerId: number }
  | { type: 'net:playerJoined'; player: RemotePlayerInfo }
  | { type: 'net:playerLeft'; playerId: number }
  | { type: 'net:disconnected'; reason: string };

/* ==================== 联机类型 ==================== */

/** 角色：单机 / 房主 / 客机 */
export type NetRole = 'standalone' | 'host' | 'client';

/** 远程玩家摘要信息（房间列表） */
export interface RemotePlayerInfo {
  id: number;
  name: string;
}

/** 按键输入快照（网络传输格式） */
export interface InputKeys {
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
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
}

/** 光球权威状态 */
export interface NetOrbState {
  entityId: number;
  collected: boolean;
}

/** 房主权威状态消息 */
export interface NetHostState {
  seq: number;
  players: NetPlayerState[];
  orbs: NetOrbState[];
  gt: number;
  gotN: number;
  deaths: number;
  win: boolean;
}

/** 远程玩家（房主模拟权威状态 + 客机渲染，含 PlayerState 全字段） */
export interface RemotePlayer extends PlayerState {
  id: number;
  name: string;
  /** 该玩家激活的检查点（房主记录） */
  cpX: number;
  cpY: number;
}