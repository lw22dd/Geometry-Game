/**
 * 玩家 ECS 实体桥接 —— 玩家实体 = 玩家状态的完整承载（SoA 单真相收敛，阶段 A）。
 *
 * 目标：ECS 组件层完整覆盖 PlayerState 全部字段，使玩家实体成为玩家状态的
 * 唯一权威存储；PlayerState 降级为"运行时工作副本 / 只读派生视图"。
 * 本阶段先锁定数据承载能力（syncToEcs 全字段镜像 + syncFromEcs 完整还原），
 * 物理引擎迁移（真源切换）为下一阶段，届时 syncFromEcs 成为物理输入、syncToEcs 成为物理输出。
 *
 * 桥是唯一同步点：
 *   物理步后 syncToEcs（PlayerState → ECS 全字段）
 *   读取侧 syncFromEcs（ECS → 派生 PlayerState 视图）
 *
 * 切图重建：setupLevel 内 clearWorld 会移除全部实体，applyLevel 调用方负责在
 * setupLevel 之后 ensurePlayerEntity() 重建。
 */
import { addEntity, addComponent } from 'bitecs';
import {
  world,
  Position, Velocity, Collider, Player, PlayerControl, PlayerInput,
  JumpCharges, ImpulseQueue, Backpack, PlayerTrackState, PlayerPlat,
  ITEM_DOUBLE_JUMP, ITEM_HOOK,
} from '../../core/ecs';
import { qLocalPlayer } from '../../core/ecs';
import type { ItemId, PlayerState, TrackState } from '../../types';

/** 本地玩家实体 eid（未创建 = -1） */
let playerEid = -1;

/** 查询当前本地玩家实体（无则 -1） */
export function getPlayerEid(): number {
  return playerEid;
}

/** 道具 id → 背包编码（与 Backpack 组件常量一致；0=doubleJump，1=hook） */
function itemToCode(id: ItemId): number {
  return id === 'hook' ? ITEM_HOOK : ITEM_DOUBLE_JUMP;
}

/** 背包编码 → 道具 id（未知编码防御为 doubleJump） */
function codeToItem(code: number): ItemId {
  return code === ITEM_HOOK ? 'hook' : 'doubleJump';
}

/**
 * 确保本地玩家实体存在（切图 clearWorld 后重建）。
 * 只建实体 + 初始化槽位；完整字段由调用方随后 syncToEcs 同步。
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
    // AoS 侧表槽位初始化
    ImpulseQueue[e] = [];
    Backpack[e] = [];
    PlayerTrackState[e] = null;
    PlayerPlat[e] = null;
    Collider.w[e] = 0.84; // half*2，供查询侧碰撞语义
    Collider.h[e] = 0.84;
  }
  return playerEid;
}

/**
 * PlayerState → 玩家实体（物理步后调用）。全字段镜像，玩家实体成为完整承载。
 * 复杂对象（track / plat / backpack / impulses）同步为 AoS 侧表。
 */
export function syncToEcs(p: PlayerState): void {
  const e = playerEid;
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

  // 契约组件：空中跳充能 / 外力队列
  JumpCharges.left[e] = p.extraJumps;
  JumpCharges.max[e] = p.extraJumpsMax;
  ImpulseQueue[e] = p.impulses;

  // 复杂对象侧表
  PlayerTrackState[e] = p.track;
  PlayerPlat[e] = p.plat;
  Backpack[e] = p.backpack.map(itemToCode);
}

/**
 * 玩家实体 → 派生 PlayerState 视图（读取侧用：渲染 / UI / 网络）。
 * 返回新对象；track/plat/backpack/impulses 均为独立引用（slice / 重建）。
 * 真源切换后：本函数成为物理引擎的输入视图来源。
 */
export function syncFromEcs(e: number = playerEid): PlayerState | null {
  if (e < 0) return null;

  const track = PlayerTrackState[e];
  const plat = PlayerPlat[e];
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
    plat,
    sprint: PlayerControl.sprint[e] === 1,
    wasSpr: PlayerControl.wasSpr[e] === 1,
    inv: PlayerControl.inv[e],
    extraJumps: JumpCharges.left[e],
    extraJumpsMax: JumpCharges.max[e],
    jumpWasDown: PlayerControl.jumpWasDown[e] === 1,
    jumpFresh: PlayerControl.jumpFresh[e] === 1,
    impulses: (ImpulseQueue[e] ?? []).slice(),
    track,
    backpack: (Backpack[e] ?? []).map(codeToItem),
    hookCd: PlayerControl.hookCd[e],
    hookMissT: PlayerControl.hookMissT[e],
    selectedSlot: PlayerControl.selectedSlot[e],
  };
}

/** 供测试/调试：实体是否已接线（避免依赖内部变量） */
export function isPlayerEntityMounted(): boolean {
  return qLocalPlayer().length > 0;
}
