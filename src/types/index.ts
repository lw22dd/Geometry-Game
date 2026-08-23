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
  /** 若属于移动平台，指向其数据 */
  plat?: Mover;
}

/** 移动平台 */
export interface Mover {
  x0: number;
  x: number;
  dx: number;
  y: number;
  w: number;
  h: number;
  range: number;
  spd: number;
  ph: number;
}

/** 尖刺 */
export interface Spike {
  x: number;
  y: number;
}

/** 激光栅栏 */
export interface Laser {
  x: number;
  y0: number;
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
  squash: number;
  dead: boolean;
  deadT: number;
  plat: Mover | null;
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

/** 游戏全局状态（game 系统持有） */
export interface GameState {
  time: number;
  gt: number;
  gotN: number;
  deaths: number;
  win: boolean;
  winTime: number;
  started: boolean;
  /** 当前画面：'menu' 开始菜单 / 'playing' 游戏中 */
  screen: 'menu' | 'playing';
  toast: string;
  toastT: number;
  flash: number;
  shake: number;
}

/** 关卡配置集合（config/level.ts 导出） */
export interface LevelConfig {
  name: string;
}

/** netBus 事件载荷 */
export type NetBusEvent =
  | { type: 'game:started' }
  | { type: 'game:checkpoint'; x: number; y: number }
  | { type: 'game:orb'; count: number; total: number }
  | { type: 'game:death'; deaths: number }
  | { type: 'game:win'; time: number; orbs: number; total: number };