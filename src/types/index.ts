/** 共享类型定义 —— 全项目统一在此声明跨模块类型。
 * 依赖规则：types/ 不得依赖任何其他模块（types 内部相互引用允许）。 */
export type { PathSegment } from './path';
import type { PathSegment } from './path';

/** 二维矢量（物理量统一用此接口，不拆 x/y 字段） */
export interface Vector2 {
  x: number;
  y: number;
}

/** 外力条目（弹簧/击退/气流通用）：ax/ay 加速度（格/秒²），t 剩余时长（秒） */
export interface Impulse {
  ax: number;
  ay: number;
  t: number;
}

/** 玩家属性 id（Modifier 管道目标属性；扩展位：jumpHeight / hookRange ...） */
export type StatId = 'jumpCharges' | 'shields' | 'moveSpeed';

/** 数值修正条目：目标属性 + 覆盖/累加 + 数值 + 来源（来源用于幂等替换） */
export interface StatModifier {
  stat: StatId;
  /** set = 覆盖式设值（多来源取最大值）；add = 累加 */
  op: 'set' | 'add';
  value: number;
  /** 来源标识（道具 id / 机制名），同 stat+source 重复投递时替换而非叠加 */
  source: string;
  /** 可选：有效时长（秒）。存在即"限时 buff"，由 stepBuffTimers 递减，到期自动失效 */
  dur?: number;
  /** 剩余时长（秒），由 stepBuffTimers 维护；未提供时起步取 dur（再拾取 = 重置计时） */
  t?: number;
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
  /** 钩锁是否可命中（仅静态几何 Rect 使用；undefined 视为可命中） */
  hookable?: boolean;
}

/** 平台携带引用 —— 每帧位移增量 dx（水平）/ dy（垂直） */
export interface PlatRef {
  dx: number;
  dy: number;
}

/**
 * MVMap 底盘可行走区（只读，游戏地板渲染用）。
 *
 * 语义（模式 A / 恶魔城）：色块 = 区域 = 可行走空间，不是墙。
 * 游戏据此绘制「格子化可行走带」（区域色）；碰撞体由 solids 承担。
 */
export interface FloorCell {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 区域色（hex，如 "#4c8dd8"） */
  color: string;
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

/** 道具 id（含武器：AK/手雷/霰弹枪/AWM/火箭筒/冰冻炸弹 作为背包主动道具，拾取占用背包格） */
export type ItemId = 'doubleJump' | 'hook' | 'shield' | 'speed' | 'recall' | 'ak' | 'grenade' | 'shotgun' | 'awm' | 'rocket' | 'iceBomb';

/**
 * 武器 id（独立体系，不强绑 Backpack 道具槽）。
 * 'none' = 未装备任何主武器（出生默认；武器为地图拾取物，非自带）。
 */
export type WeaponId = 'none' | 'ak' | 'grenade' | 'shotgun' | 'awm' | 'rocket' | 'iceBomb';

/** 敌人种类 id（S3；行走兵起步，苦力怕/大猩猩/精英/Boss 为扩展位） */
export type EnemyKind = 'walker' | 'creeper' | 'gorilla';

/** 画质档位（core/settings 与 config/visuals 共用；'auto' = 自适应降级） */
export type QualityTier = 'low' | 'medium' | 'high' | 'auto';

/** 道具类别：主动（玩家触发）/ 被动（拾取即生效常驻） */
export type ItemCategory = 'active' | 'passive';

/** 背包空格数量上限（含武器格；数字键 1-10 选择，滚轮循环切换） */
export const MAX_BACKPACK = 10;

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
  /** 额外跳跃最大次数（由 modifier 管道重算；0 = 未拾取） */
  extraJumpsMax: number;
  /** 护盾剩余格数（危险物命中时消耗 1 格挡掉致死，由结算管线写入） */
  shields: number;
  /** 护盾最大格数（由 modifier 管道重算；0 = 未激活） */
  shieldsMax: number;
  /** 当前生命值（战斗；0 = 死亡。扣血一律经 applyEffect 的 DamageRequest 结算） */
  hp: number;
  /** 生命上限（出生 = PLAYER_MAX_HP；后期可由 modifier 管道扩展） */
  maxHp: number;
  /** 水平移速倍率（由 modifier 管道重算；1 = 常态，2 = 加速 buff） */
  speedMult: number;
  /** 当前主武器（'none' = 未装备；武器为地图拾取物，非自带） */
  weapon: WeaponId;
  /** 弹匣内弹药 */
  ammo: number;
  /** 是否拥有手雷副武器（拾取手雷道具后 true；选中 grenade 槽位左键投掷） */
  hasGrenade: boolean;
  /** 换弹剩余时间（秒；>0 = 换弹中，期间不可开火） */
  reloadT: number;
  /** 开火冷却剩余时间（秒；由武器系统逐帧递减） */
  fireCd: number;
  /** 数值修正列表（Modifier 管道：影响来源投递，recomputeStats 重算 extraJumpsMax 等） */
  modifiers: StatModifier[];
  /** 上一物理步跳跃键是否按下（用于二段跳"新按下沿"检测：按下一次跳一次） */
  jumpWasDown: boolean;
  /** 输入层跳跃按下标记：由 keydown handler 写入，物理步消耗。
   *  不受帧间 timing 影响，确保松开→重按的二段跳永远可靠。 */
  jumpFresh: boolean;
  /** 外力队列（弹簧/击退/气流通用）：每帧由运动系统消费并递减 t */
  impulses: Impulse[];
  /** 轨道运动状态（null = 自由运动） */
  track: TrackState | null;
  /** 背包槽位（道具 id 列表，最多 5 格） */
  backpack: ItemId[];
  /** 钩锁冷却剩余时间（秒） */
  hookCd: number;
  /** 钩锁收回动画剩余时间（秒，>0 时绘制收回线） */
  hookMissT: number;
  /** 当前选中的背包槽位（0-9，用于主动道具/武器；数字键 1-10 与滚轮切换） */
  selectedSlot: number;
}

/** 曳光轨迹点 */
export interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

/** 粒子类型 */
export type ParticleKind = 'dot' | 'frag' | 'arrow' | 'streak' | 'ring' | 'shock';

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
  /** streak 专用：拖尾长度（世界米） */
  len?: number;
  /** ring / shock 专用：起始半径（世界米） */
  r0?: number;
  /** ring / shock 专用：结束半径（世界米） */
  r1?: number;
  /** ring / shock / streak 专用：描边线宽（逻辑像素） */
  lw?: number;
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
  /** 本帧拾取了道具（itemId；收敛字段 —— 加道具不再动本联合） */
  picked?: ItemId;
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
  /**
   * 基础 UI 场景真源（问题 3：单一场景真源）。
   * pause/dev/instructions 等叠层由 UIManager.overlays 栈管理；
   * ui.currentName = 栈顶叠层 ?? gs.scene（派生只读）。
   */
  scene: 'menu' | 'prepare' | 'mapSelect' | 'charSelect' | 'modeSelect' | 'lobby' | null;
  toast: string;
  toastT: number;
  flash: number;
  shake: number;
  /**
   * 命中停顿剩余时间（秒）。> 0 时主循环冻结物理推进、只跑渲染，
   * 用于强化死亡/破盾/弹射等瞬间的冲击感。联机房主会话下不启用。
   */
  hitstop: number;
  /**
   * 密码机世界状态（第五人格式破译机）。
   * - cipherTotal：当前地图密码机总数（由 config/level 装配写入，单一世界状态来源）。
   * - 已完成数量不在此维护，改为派生：cipherDoneCount() 扫描 ECS 实体（Cipher.done），
   *   单一数据源是密码机实体本身，避免权威态/计数双写不一致。
   */
  cipherTotal: number;
}

/**
 * 地图主题配色（纯观感数据）。
 * 只影响绘制：平台渐变色相、网格、边界、雾、视差层与功能强调色；
 * 不参与碰撞与任何玩法判定（碰撞真源仍是 solids）。
 */
export interface MapTheme {
  /** 平台位置渐变色相起点 */
  hueA: number;
  /** 平台位置渐变色相终点 */
  hueB: number;
  /** 网格线颜色（'r,g,b'） */
  grid: string;
  /** 地图边界颜色（'r,g,b'） */
  border: string;
  /** 底部雾色（'r,g,b'） */
  fog: string;
  /** 功能强调色（危险物 / 收集品发光，'r,g,b'） */
  accent: string;
  /** 视差远层两色 */
  far: [string, string];
  /** 视差中层两色 */
  mid: [string, string];
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

  /**
   * 地图主题配色（可选）：缺省时回退 config/visuals 的 DEFAULT_MAP_THEME。
   * 只影响观感，不影响碰撞与任何玩法数据。
   */
  theme?: MapTheme;

  /**
   * ── MVMap 底盘可行走区视觉层（可选，只读）──
   * 由 MVMap 结构底盘导入生成：合并矩形 + 区域色，游戏据此绘制「格子化可行走带」。
   * 语义（模式 A）：色块 = 区域 = 可行走空间，不是墙。仅影响视觉；碰撞仍用 solids。
   */
  floor?: {
    cells: FloorCell[];
    /** 格边长（米），默认 1 */
    gridSize?: number;
  };

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
    /** 护盾道具坐标（可选；限时护盾：格挡一次或超时自动失效） */
    shields?: [number, number][];
    /** 加速道具坐标（可选；限时加速：速度 ×2，超时自动失效） */
    speeds?: [number, number][];
    /** 重置箭头坐标（可选；主动道具：使用后回到上一个绑定的检查点） */
    recalls?: [number, number][];
    /** 武器拾取物（可选；无 weapons 字段的地图玩家无武器，需先拾取） */
    weapons?: { kind: WeaponId; x: number; y: number }[];
    /** 密码机坐标（可选；第五人格式破译机：靠近 + 持续按 E 破译） */
    ciphers?: [number, number][];
    /** 宝箱坐标（可选；type 0=武器宝箱 1=道具宝箱；40s 刷新可开启，打开掉落随机拾取物） */
    chests?: { type: 0 | 1; x: number; y: number }[];
    checkpoints: [number, number][];
    nova: { x: number; y: number };
    /** 冲刺轨道（可选；无轨道的地图省略） */
    tracks?: TrackSpawnData[];
    /** 敌人出生点（可选；S3。kind = EnemyKind） */
    enemies?: { kind: EnemyKind; x: number; y: number }[];
  };
}

/** netBus 事件载荷 */
export type NetBusEvent =
  | { type: 'game:started' }
  | { type: 'game:checkpoint'; x: number; y: number }
  | { type: 'game:cipherDone'; x: number; y: number }
  | { type: 'game:chestOpened'; x: number; y: number; chestType: number }
  | { type: 'game:orb'; count: number; total: number }
  /** 道具拾取广播：网络事件名由 ITEMS 条目派生（wire 名 = 'item:' + item） */
  | { type: 'game:itemPicked'; item: ItemId }
  | { type: 'game:death'; deaths: number }
  | { type: 'game:win'; time: number; orbs: number; total: number; x: number; y: number; playerId: number }
  // ── 特效同步：死亡/护盾破碎特效由房主广播（房主是判定权威）──
  | { type: 'fx:death'; x: number; y: number; playerId: number }
  | { type: 'fx:shieldbreak'; x: number; y: number; playerId: number }
  /** 开火反馈：曳光/火光/音效由房主广播（房主是开火模拟权威），客机补播 */
  | { type: 'fx:shot'; mx: number; my: number; hitX: number; hitY: number; hit: boolean }
  // ── 联机扩展 ──
  | { type: 'net:connected'; role: NetRole; playerId: number }
  | { type: 'net:playerJoined'; player: RemotePlayerInfo }
  | { type: 'net:playerLeft'; playerId: number }
  | { type: 'net:playerUpdated'; player: RemotePlayerInfo }
  | { type: 'net:disconnected'; reason: string }
  // ── 战斗：敌人出生 / 死亡（S4 骨架：spawn/despawn 走事件流；快照流只同步存活敌人）──
  | { type: 'enemy:spawn'; kind: string; x: number; y: number }
  | { type: 'enemy:died'; x: number; y: number }
  // ── 玩家事件（问题 4：PlayerController 事件并入 netBus 单一事件通道）──
  | PlayerEvent;

/**
 * 玩家生命周期 / 反馈事件（PlayerController → netBus 统一通道；'player:*' 前缀）。
 * TriggerSystem 与 wirePlayerEvents 均订阅 netBus 消费。
 */
export type PlayerEvent =
  | { type: 'player:died'; deaths: number }
  | { type: 'player:respawned' }
  | { type: 'player:jumped' }
  | { type: 'player:dashed' }
  | { type: 'player:landed'; impact: number }
  | { type: 'player:springed' }
  | { type: 'player:doubleJumped' };

/* ==================== 联机类型 ==================== */

/** 角色：单机 / 房主 / 客机 */
export type NetRole = 'standalone' | 'host' | 'client';

/** 联机游戏模式：'pve' 普通模式（简单 PVE）/ 'asym' 非对称对抗 */
export type GameModeKey = 'pve' | 'asym';

/** 阵营：'keeper' 少方（守关者，1 人）/ 'survivor' 多方（幸存者，上限 4 人） */
export type Faction = 'keeper' | 'survivor';

/** 非对称模式槽位常量（红槽 1 + 蓝槽 4） */
export const KEEPER_SLOTS = 1;
export const SURVIVOR_SLOTS = 4;

/** 远程玩家摘要信息（房间列表） */
export interface RemotePlayerInfo {
  id: number;
  name: string;
  /** 所选角色预制体 id（房间内选人/握手时上报） */
  char?: string;
  /** 是否已准备（房间流程） */
  ready?: boolean;
  /** 阵营（非对称模式：房主创建房间时选定；客机加入时同步） */
  faction?: Faction;
}

/** 按键输入快照（网络传输格式） */
export interface InputKeys {
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  /** 交互键（E）：按下时 true，用于检查点等可交互物 */
  interact: boolean;
  /** 钩锁按住状态（键盘 Q；房主端用 hold && !prev 还原发射沿） */
  hook: boolean;
  /** 开火（左键按住状态；auto 武器边沿由消费方还原） */
  fire: boolean;
  /** 副武器（右键按住状态；手雷投掷沿由消费方还原） */
  altFire: boolean;
  /** 换弹（R 键按住状态；按下沿由消费方还原） */
  reload: boolean;
  /** 鼠标瞄准世界坐标 X（格） */
  aimX: number;
  /** 鼠标瞄准世界坐标 Y（格） */
  aimY: number;
  /** 当前选中的背包槽位（0-9；客机上报告知房主，用于主动道具/武器"持有才可使用"判定） */
  slot?: number;
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
  /** 水平移速倍率（1 = 常态，2 = 加速 buff；用于客机渲染远程玩家加速光效） */
  speedMult: number;
  /** 当前主武器（房主权威） */
  weapon: WeaponId;
  /** 弹匣内弹药（房主权威；客机换弹表现跟随此值） */
  ammo: number;
  /** 是否拥有手雷副武器（房主权威） */
  hasGrenade: boolean;
  /** 换弹剩余时间（秒；房主权威） */
  reloadT: number;
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
  /** 当前生命值（房主权威；客机的伤害与复活一律跟随此值，不自行结算） */
  hp: number;
  /** 背包道具（数字编码：单一事实源 = items/backpack ITEMS 条目的 code 字段） */
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

/** 密码机权威状态（host → 客机；破译进度 + 完成标记同步） */
export interface NetCipherState {
  entityId: number;
  progress: number;
  done: boolean;
}

/** 宝箱权威状态（host → 客机；状态机 state/timer 同步） */
export interface NetChestState {
  entityId: number;
  type: number;
  state: number;
  timer: number;
}

/** 远程玩家（房主模拟权威状态 + 客机渲染，含 PlayerState 全字段） */
export interface RemotePlayer extends PlayerState {
  id: number;
  name: string;
  /** 该玩家激活的检查点（房主记录） */
  cpX: number;
  cpY: number;
  /** A 路线：远端玩家实体 eid（房主模拟用，未接线 = undefined） */
  eid?: number;
}