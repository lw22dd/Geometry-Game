/**
 * 玩家 ECS 实体桥接 —— 玩家实体 = 玩家状态的唯一权威存储（A 路线：物理真源）。
 *
 * A 路线契约：
 *  - 物理引擎走 eid 入口（player/index.ts 的 stepPlayer）：
 *      loadPlayerComponents（ECS → 模块级 scratch，零分配）
 *      → 物理引擎纯函数（冻结的 stepPlayerGeneric / stepPlayerByMode 行为）
 *      → storePlayerComponents（scratch → ECS，零分配）。
 *    每实体每物理步恰好一次装载 / 一次写回；跨帧影子状态与双写消失。
 *  - 复杂对象（impulses / track / plat / backpack / modifiers）以引用共享（物理原地变更，零拷贝）。
 *  - syncFromEcs 保留为渲染帧级的只读派生视图（独立引用，每次渲染帧一次）。
 *  - 远程玩家同样拥有实体（ensureRemotePlayerEntity），混合范式消失。
 *
 * 切图重建：setupLevel 内 clearWorld 会移除全部实体，applyLevel 调用方负责在
 * setupLevel 之后 ensurePlayerEntity() 重建；远端实体由 removeAllRemotePlayerEntities 清表。
 */
import { addEntity, addComponent, hasComponent, removeEntity } from 'bitecs';
import {
  world,
  Position, Velocity, Collider, Player, PlayerControl, PlayerInput,
  JumpCharges, ShieldCharges, ImpulseQueue, Backpack, PlayerTrackState, PlayerPlat,
  PlayerModifiers, ControlMode,
} from '../../core/ecs';
import { qLocalPlayer } from '../../core/ecs';
import type { PlayerState, TrackState, WeaponId } from '../../types';
import { PLAYER_MAX_HP } from '../../config/combat';
import { weaponFromCode, weaponToCode } from '../../config/weapons';

/* ═══════════ 字段映射表（单一事实源） ═══════════ */

/**
 * 玩家 ECS ↔ PlayerState 字段映射 —— 单一事实源。
 * loadPlayerComponents / storePlayerComponents / mirrorPlayerState / syncFromEcs
 * 四处由同一张表驱动：新增 PlayerState 字段只在此登记一行，杜绝四处平行手写漏改。
 *
 * - kind 缺省 = 标量数值：comp[prop][e] 直接读写（读侧可带 def 兜底）。
 * - kind 'bool'：ECS 存 0/1，PlayerState 为 boolean。
 * - kind 'weapon'：ECS 存 weaponToCode 编码，PlayerState 为 WeaponId。
 * - side 字段 = AoS 侧表引用（引用共享）：load 侧惰性建空数组（lazy），
 *   syncFromEcs 渲染视图侧拷副本保持独立（slice）。
 */
interface PlayerFieldSpec {
  /** PlayerState 字段路径（1-2 级；velocity.x 用 ['velocity','x']） */
  path: readonly [string] | readonly [string, string];
  /** SoA 标量：组件对象 + 属性名（kind 缺省 / 'bool' / 'weapon' 使用） */
  comp?: Record<string, number[]>;
  prop?: string;
  kind?: 'bool' | 'weapon';
  /** 读取兜底默认值（ECS 槽位未初始化时） */
  def?: number;
  /** AoS 侧表数组（引用字段使用；与 comp 二选一） */
  side?: unknown[];
  /** load 侧惰性初始化空数组（impulses / backpack / modifiers） */
  lazy?: boolean;
  /** syncFromEcs 渲染视图侧 slice 拷贝（impulses / backpack / modifiers） */
  slice?: boolean;
}

const PLAYER_FIELDS: PlayerFieldSpec[] = [
  // 位置 / 速度
  { path: ['x'], comp: Position, prop: 'x' },
  { path: ['y'], comp: Position, prop: 'y' },
  { path: ['velocity', 'x'], comp: Velocity, prop: 'x' },
  { path: ['velocity', 'y'], comp: Velocity, prop: 'y' },
  // PlayerControl 标量
  { path: ['half'], comp: PlayerControl, prop: 'half' },
  { path: ['grounded'], comp: PlayerControl, prop: 'grounded', kind: 'bool' },
  { path: ['coyote'], comp: PlayerControl, prop: 'coyote' },
  { path: ['jbuf'], comp: PlayerControl, prop: 'jbuf' },
  { path: ['face'], comp: PlayerControl, prop: 'face' },
  { path: ['dead'], comp: PlayerControl, prop: 'dead', kind: 'bool' },
  { path: ['deadT'], comp: PlayerControl, prop: 'deadT' },
  { path: ['sprint'], comp: PlayerControl, prop: 'sprint', kind: 'bool' },
  { path: ['wasSpr'], comp: PlayerControl, prop: 'wasSpr', kind: 'bool' },
  { path: ['inv'], comp: PlayerControl, prop: 'inv' },
  { path: ['jumpWasDown'], comp: PlayerControl, prop: 'jumpWasDown', kind: 'bool' },
  { path: ['jumpFresh'], comp: PlayerControl, prop: 'jumpFresh', kind: 'bool' },
  { path: ['hookCd'], comp: PlayerControl, prop: 'hookCd' },
  { path: ['hookMissT'], comp: PlayerControl, prop: 'hookMissT' },
  { path: ['selectedSlot'], comp: PlayerControl, prop: 'selectedSlot' },
  { path: ['speedMult'], comp: PlayerControl, prop: 'speedMult', def: 1 },
  // 生命 / 武器（战斗投影）
  { path: ['hp'], comp: PlayerControl, prop: 'hp', def: PLAYER_MAX_HP },
  { path: ['maxHp'], comp: PlayerControl, prop: 'maxHp', def: PLAYER_MAX_HP },
  { path: ['weapon'], comp: PlayerControl, prop: 'weapon', kind: 'weapon' },
  { path: ['ammo'], comp: PlayerControl, prop: 'ammo', def: 0 },
  { path: ['hasGrenade'], comp: PlayerControl, prop: 'hasGrenade', kind: 'bool' },
  { path: ['reloadT'], comp: PlayerControl, prop: 'reloadT', def: 0 },
  { path: ['fireCd'], comp: PlayerControl, prop: 'fireCd', def: 0 },
  // 能力充能
  { path: ['extraJumps'], comp: JumpCharges, prop: 'left' },
  { path: ['extraJumpsMax'], comp: JumpCharges, prop: 'max' },
  { path: ['shields'], comp: ShieldCharges, prop: 'left' },
  { path: ['shieldsMax'], comp: ShieldCharges, prop: 'max' },
  // AoS 侧表引用（引用共享；复杂对象）
  { path: ['plat'], side: PlayerPlat },
  { path: ['impulses'], side: ImpulseQueue, lazy: true, slice: true },
  { path: ['track'], side: PlayerTrackState },
  { path: ['backpack'], side: Backpack, lazy: true, slice: true },
  { path: ['modifiers'], side: PlayerModifiers, lazy: true, slice: true },
];

/** 读 PlayerState 路径值（1-2 级；velocity.x 特例） */
function getPath(p: PlayerState, path: readonly [string] | readonly [string, string]): unknown {
  const rec = p as unknown as Record<string, unknown>;
  if (path.length === 1) return rec[path[0]];
  return (rec[path[0]] as Record<string, unknown>)[path[1]];
}

/** 写 PlayerState 路径值（1-2 级；velocity.x 特例） */
function setPath(p: PlayerState, path: readonly [string] | readonly [string, string], v: unknown): void {
  const rec = p as unknown as Record<string, unknown>;
  if (path.length === 1) rec[path[0]] = v;
  else (rec[path[0]] as Record<string, unknown>)[path[1]] = v;
}

/** ECS 槽位 → 标量值（bool/weapon/默认值转换） */
function readScalar(f: PlayerFieldSpec, e: number): unknown {
  const raw = f.comp![f.prop!][e];
  if (f.kind === 'bool') return raw === 1;
  if (f.kind === 'weapon') return weaponFromCode(raw);
  return raw ?? f.def;
}

/** 标量值 → ECS 槽位（bool/weapon 转换） */
function writeScalar(f: PlayerFieldSpec, e: number, v: unknown): void {
  if (f.kind === 'bool') { f.comp![f.prop!][e] = v ? 1 : 0; return; }
  if (f.kind === 'weapon') { f.comp![f.prop!][e] = weaponToCode(v as WeaponId); return; }
  f.comp![f.prop!][e] = v as number;
}

/** 本地玩家实体 eid（未创建 = -1） */
let playerEid = -1;

/** 远端玩家实体表（rpId → eid），与 remotes Map 生命周期一致 */
const remoteEids = new Map<number, number>();

/** 查询当前本地玩家实体（无则 -1） */
export function getPlayerEid(): number {
  return playerEid;
}

/**
 * 确保本地玩家实体存在（切图 clearWorld 后重建）。
 * 只建实体 + 初始化槽位；完整字段由调用方随后 storePlayerComponents / syncToEcs 同步。
 * @param playerId 房间玩家 id（写入 Player 组件）
 */
export function ensurePlayerEntity(playerId: number): number {
  const existing = qLocalPlayer();
  if (existing.length > 0) {
    playerEid = existing[0];
  } else {
    const e = addEntity(world);
    playerEid = e;
    addComponent(world, e, Position);
    addComponent(world, e, Velocity);
    addComponent(world, e, Collider);
    addComponent(world, e, Player);
    Player.playerId[e] = playerId;
    Player.local[e] = 1;
    addComponent(world, e, PlayerControl);
    addComponent(world, e, PlayerInput);
    addComponent(world, e, JumpCharges);
    addComponent(world, e, ShieldCharges);
    addComponent(world, e, ControlMode);
    ControlMode.mode[e] = 0; // S3 仲裁初始值 = free
    // 生命值槽位初始化（真实值由随后 storePlayerComponents 覆盖）
    PlayerControl.hp[e] = PLAYER_MAX_HP;
    PlayerControl.maxHp[e] = PLAYER_MAX_HP;
    // 武器为地图拾取物：出生无主武器（'none' → -1）且无手雷
    PlayerControl.weapon[e] = weaponToCode('none');
    PlayerControl.ammo[e] = 0;
    PlayerControl.hasGrenade[e] = 0;
    PlayerControl.reloadT[e] = 0;
    PlayerControl.fireCd[e] = 0;
    // AoS 侧表槽位初始化
    ImpulseQueue[e] = [];
    Backpack[e] = [];
    PlayerTrackState[e] = null;
    PlayerPlat[e] = null;
    PlayerModifiers[e] = [];
    Collider.w[e] = 0.84; // half*2，供查询侧碰撞语义
    Collider.h[e] = 0.84;
  }
  return playerEid;
}

/* ═══════════ A 路线：非分配装载 / 写回（物理真源同步点） ═══════════ */

/**
 * ECS 组件 → out PlayerState（非分配）。标量整字段拷贝；复杂对象
 * （impulses / track / plat / backpack / modifiers）以引用共享，物理原地变更后
 * storePlayerComponents 写回同一引用，零分配。
 * @param out 模块级复用工作副本（scratch / 渲染视图镜像目标）
 */
export function loadPlayerComponents(e: number, out: PlayerState): void {
  for (let i = 0; i < PLAYER_FIELDS.length; i++) {
    const f = PLAYER_FIELDS[i];
    if (f.side) {
      // 复杂对象：引用共享（惰性建空数组写回侧表，物理原地变更天然落位）
      let v = f.side[e];
      if (v === undefined && f.lazy) v = f.side[e] = [];
      setPath(out, f.path, v);
    } else {
      setPath(out, f.path, readScalar(f, e));
    }
  }
}

/**
 * PlayerState → ECS 组件（非分配）。与 loadPlayerComponents 严格对称：
 * 复杂对象引用直接写回侧表（物理原地变更的结果天然落位）。
 */
export function storePlayerComponents(e: number, p: PlayerState): void {
  if (e < 0) return;
  for (let i = 0; i < PLAYER_FIELDS.length; i++) {
    const f = PLAYER_FIELDS[i];
    const v = getPath(p, f.path);
    if (f.side) f.side[e] = v;
    else writeScalar(f, e, v);
  }
}

/**
 * 原地镜像源 → 目标（非分配）：步后处理/渲染视图/远端 rp 共享的零分配拷贝。
 * 复杂对象引用共享（目标数组与源指向同一数组）。
 */
export function mirrorPlayerState(target: PlayerState, source: PlayerState): void {
  for (let i = 0; i < PLAYER_FIELDS.length; i++) {
    const f = PLAYER_FIELDS[i];
    setPath(target, f.path, getPath(source, f.path));
  }
}

/* ═══════════ 保留接口（网络 / UI / 测试读写侧） ═══════════ */

/**
 * PlayerState → 玩家实体（保留接口：网络矫正 / 事件路径 / 初始化写点）。
 * 内部委托 storePlayerComponents，行为同旧 syncToEcs（全字段镜像）。
 */
export function syncToEcs(p: PlayerState): void {
  storePlayerComponents(playerEid, p);
}

/**
 * 玩家实体 → 派生 PlayerState 视图（渲染 / UI / 网络读取侧）。
 * 返回新对象；track/plat 直接引用、impulses/backpack/modifiers 独立 slice，
 * 仅作只读派生视图，不参与物理真源。
 */
export function syncFromEcs(e: number = playerEid): PlayerState | null {
  if (e < 0) return null;
  // 骨架：仅需保证嵌套对象存在（velocity），其余字段由字段表逐项覆盖
  const out = { velocity: { x: 0, y: 0 } } as PlayerState;
  for (let i = 0; i < PLAYER_FIELDS.length; i++) {
    const f = PLAYER_FIELDS[i];
    if (f.side) {
      // 渲染视图：slice 字段拷副本保持独立，非 slice（plat/track）直接引用
      const v = f.side[e] as unknown[] | undefined;
      setPath(out, f.path, f.slice ? (v ?? []).slice() : v);
    } else {
      setPath(out, f.path, readScalar(f, e));
    }
  }
  return out;
}

/* ═══════════ 远程玩家实体（A 路线：统一物理真源） ═══════════ */

/**
 * 确保远端玩家实体存在（远端玩家同样拥有实体，混合范式消失）。
 * @param playerId 远端房间玩家 id（写入 Player 组件，local=0）
 */
export function ensureRemotePlayerEntity(playerId: number): number {
  const existing = remoteEids.get(playerId);
  if (existing !== undefined && hasComponent(world, existing, Player)) {
    return existing;
  }
  const e = addEntity(world);
  remoteEids.set(playerId, e);
  addComponent(world, e, Position);
  addComponent(world, e, Velocity);
  addComponent(world, e, Collider);
  addComponent(world, e, Player);
  Player.playerId[e] = playerId;
  Player.local[e] = 0;
  addComponent(world, e, PlayerControl);
  addComponent(world, e, PlayerInput);
  addComponent(world, e, JumpCharges);
  addComponent(world, e, ShieldCharges);
  addComponent(world, e, ControlMode);
  ControlMode.mode[e] = 0;
  PlayerControl.hp[e] = PLAYER_MAX_HP;
  PlayerControl.maxHp[e] = PLAYER_MAX_HP;
  // 武器为地图拾取物：远端玩家出生同样无主武器（'none' → -1）且无手雷
  PlayerControl.weapon[e] = weaponToCode('none');
  PlayerControl.ammo[e] = 0;
  PlayerControl.hasGrenade[e] = 0;
  PlayerControl.reloadT[e] = 0;
  PlayerControl.fireCd[e] = 0;
  Collider.w[e] = 0.84;
  Collider.h[e] = 0.84;
  ImpulseQueue[e] = [];
  Backpack[e] = [];
  PlayerTrackState[e] = null;
  PlayerPlat[e] = null;
  PlayerModifiers[e] = [];
  return e;
}

/** 移除单个远端玩家实体（玩家离开 / 断线清理） */
export function removeRemotePlayerEntity(playerId: number): void {
  const e = remoteEids.get(playerId);
  if (e !== undefined) {
    if (hasComponent(world, e, Player)) removeEntity(world, e);
    remoteEids.delete(playerId);
  }
}

/** 清空全部远端玩家实体（切图 clearWorld / 重置联机后与 remotes 表同步） */
export function removeAllRemotePlayerEntities(): void {
  for (const [id, e] of remoteEids) {
    if (hasComponent(world, e, Player)) removeEntity(world, e);
  }
  remoteEids.clear();
}

/**
 * 供测试/调试：实体是否已接线（避免依赖内部变量）
 */
export function isPlayerEntityMounted(): boolean {
  return qLocalPlayer().length > 0;
}