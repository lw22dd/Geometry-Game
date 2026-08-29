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
import type { PlayerState, TrackState } from '../../types';

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
  out.x = Position.x[e];
  out.y = Position.y[e];
  out.velocity.x = Velocity.x[e];
  out.velocity.y = Velocity.y[e];
  out.half = PlayerControl.half[e];
  out.grounded = PlayerControl.grounded[e] === 1;
  out.coyote = PlayerControl.coyote[e];
  out.jbuf = PlayerControl.jbuf[e];
  out.face = PlayerControl.face[e];
  out.dead = PlayerControl.dead[e] === 1;
  out.deadT = PlayerControl.deadT[e];
  out.plat = PlayerPlat[e];
  out.sprint = PlayerControl.sprint[e] === 1;
  out.wasSpr = PlayerControl.wasSpr[e] === 1;
  out.inv = PlayerControl.inv[e];
  out.extraJumps = JumpCharges.left[e];
  out.extraJumpsMax = JumpCharges.max[e];
  out.shields = ShieldCharges.left[e];
  out.shieldsMax = ShieldCharges.max[e];
  out.jumpWasDown = PlayerControl.jumpWasDown[e] === 1;
  out.jumpFresh = PlayerControl.jumpFresh[e] === 1;
  out.impulses = ImpulseQueue[e] ?? (ImpulseQueue[e] = []);
  out.track = PlayerTrackState[e];
  out.backpack = Backpack[e] ?? (Backpack[e] = []);
  out.modifiers = PlayerModifiers[e] ?? (PlayerModifiers[e] = []);
  out.hookCd = PlayerControl.hookCd[e];
  out.hookMissT = PlayerControl.hookMissT[e];
  out.selectedSlot = PlayerControl.selectedSlot[e];
  out.speedMult = PlayerControl.speedMult[e] ?? 1;
}

/**
 * PlayerState → ECS 组件（非分配）。与 loadPlayerComponents 严格对称：
 * 复杂对象引用直接写回侧表（物理原地变更的结果天然落位）。
 */
export function storePlayerComponents(e: number, p: PlayerState): void {
  if (e < 0) return;
  Position.x[e] = p.x;
  Position.y[e] = p.y;
  Velocity.x[e] = p.velocity.x;
  Velocity.y[e] = p.velocity.y;
  PlayerControl.half[e] = p.half;
  PlayerControl.grounded[e] = p.grounded ? 1 : 0;
  PlayerControl.coyote[e] = p.coyote;
  PlayerControl.jbuf[e] = p.jbuf;
  PlayerControl.face[e] = p.face;
  PlayerControl.dead[e] = p.dead ? 1 : 0;
  PlayerControl.deadT[e] = p.deadT;
  PlayerControl.sprint[e] = p.sprint ? 1 : 0;
  PlayerControl.wasSpr[e] = p.wasSpr ? 1 : 0;
  PlayerControl.inv[e] = p.inv;
  PlayerControl.jumpWasDown[e] = p.jumpWasDown ? 1 : 0;
  PlayerControl.jumpFresh[e] = p.jumpFresh ? 1 : 0;
  PlayerControl.hookCd[e] = p.hookCd;
  PlayerControl.hookMissT[e] = p.hookMissT;
  PlayerControl.selectedSlot[e] = p.selectedSlot;
  PlayerControl.speedMult[e] = p.speedMult;
  JumpCharges.left[e] = p.extraJumps;
  JumpCharges.max[e] = p.extraJumpsMax;
  ShieldCharges.left[e] = p.shields;
  ShieldCharges.max[e] = p.shieldsMax;
  ImpulseQueue[e] = p.impulses;
  PlayerTrackState[e] = p.track;
  PlayerPlat[e] = p.plat;
  Backpack[e] = p.backpack;
  PlayerModifiers[e] = p.modifiers;
}

/**
 * 原地镜像源 → 目标（非分配）：步后处理/渲染视图/远端 rp 共享的零分配拷贝。
 * 复杂对象引用共享（目标数组与源指向同一数组）。
 */
export function mirrorPlayerState(target: PlayerState, source: PlayerState): void {
  target.x = source.x;
  target.y = source.y;
  target.velocity.x = source.velocity.x;
  target.velocity.y = source.velocity.y;
  target.half = source.half;
  target.grounded = source.grounded;
  target.coyote = source.coyote;
  target.jbuf = source.jbuf;
  target.face = source.face;
  target.dead = source.dead;
  target.deadT = source.deadT;
  target.plat = source.plat;
  target.sprint = source.sprint;
  target.wasSpr = source.wasSpr;
  target.inv = source.inv;
  target.extraJumps = source.extraJumps;
  target.extraJumpsMax = source.extraJumpsMax;
  target.shields = source.shields;
  target.shieldsMax = source.shieldsMax;
  target.jumpWasDown = source.jumpWasDown;
  target.jumpFresh = source.jumpFresh;
  target.impulses = source.impulses;
  target.track = source.track;
  target.backpack = source.backpack;
  target.modifiers = source.modifiers;
  target.hookCd = source.hookCd;
  target.hookMissT = source.hookMissT;
  target.selectedSlot = source.selectedSlot;
  target.speedMult = source.speedMult;
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
 * 返回新对象；track/plat/backpack/impulses 均为独立引用（slice / 重建），
 * 仅作只读派生视图，不参与物理真源。
 */
export function syncFromEcs(e: number = playerEid): PlayerState | null {
  if (e < 0) return null;
  return {
    x: Position.x[e],
    y: Position.y[e],
    velocity: { x: Velocity.x[e], y: Velocity.y[e] },
    half: PlayerControl.half[e],
    grounded: PlayerControl.grounded[e] === 1,
    coyote: PlayerControl.coyote[e],
    jbuf: PlayerControl.jbuf[e],
    face: PlayerControl.face[e],
    dead: PlayerControl.dead[e] === 1,
    deadT: PlayerControl.deadT[e],
    plat: PlayerPlat[e],
    sprint: PlayerControl.sprint[e] === 1,
    wasSpr: PlayerControl.wasSpr[e] === 1,
    inv: PlayerControl.inv[e],
    extraJumps: JumpCharges.left[e],
    extraJumpsMax: JumpCharges.max[e],
    shields: ShieldCharges.left[e],
    shieldsMax: ShieldCharges.max[e],
    jumpWasDown: PlayerControl.jumpWasDown[e] === 1,
    jumpFresh: PlayerControl.jumpFresh[e] === 1,
    impulses: (ImpulseQueue[e] ?? []).slice(),
    track: PlayerTrackState[e],
    backpack: (Backpack[e] ?? []).slice(),
    modifiers: (PlayerModifiers[e] ?? []).slice(),
    hookCd: PlayerControl.hookCd[e],
    hookMissT: PlayerControl.hookMissT[e],
    selectedSlot: PlayerControl.selectedSlot[e],
    speedMult: PlayerControl.speedMult[e] ?? 1,
  };
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