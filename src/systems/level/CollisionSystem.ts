/**
 * 碰撞系统 —— 统一 AABB 检测 + 事件分发。
 * 每帧检测玩家（由调用方传入 PlayerState）vs 新 ECS 世界中所有带 Collider 的实体，
 * 跟踪 enter/stay/exit 状态，通过 collisionBus 发射事件。
 *
 * 物理分辨率（平台推挤）由 stepPlayerGeneric 处理；本系统只负责触发事件。
 * 远程玩家（host 模拟）走坐标版交互系统（systems/interactions）。
 *
 * 接 PlayerState 入参而非依赖 PlayerController，避免 level → player 的循环依赖。
 */
import type { PlayerState, Rect } from '../../types';
import { Collectible, RespawnPoint, Goal, Timer, Hazard } from '../../core/ecs';
import { query, hasComponent } from 'bitecs';
import { world, Position as Pos, Collider as Col } from '../../core/ecs';
import { colliderWorldRect, aabbOverlap } from './OverlapUtils';
import { collisionBus } from '../../core/collisionBus';

type Signals = Record<string, boolean>;

/** 上一帧碰撞状态缓存（key = 实体 eid） */
let lastFrame = new Map<number, boolean>();

/**
 * 更新碰撞系统（本地玩家）。
 * @param p       玩家状态（提供位置 + half 用于 AABB）
 * @param signals 可选帧信号对象，碰撞处理器可写入
 */
export function updateCollisionSystem(p: PlayerState, signals?: Signals): void {
  const playerRect: Rect = {
    x: p.x - p.half,
    y: p.y - p.half,
    w: p.half * 2,
    h: p.half * 2,
    top: p.y + p.half,
  };

  const thisFrame = new Map<number, boolean>();

  for (const e of query(world, [Pos, Col])) {
    const otherRect = colliderWorldRect(e);
    const overlap = aabbOverlap(playerRect, otherRect);
    const was = lastFrame.get(e) ?? false;
    thisFrame.set(e, overlap);
    emitTransitions(e, overlap, was, signals);
  }

  lastFrame = thisFrame;
}

/** 根据 enter/exit 状态变化发射事件 */
function emitTransitions(
  e: number,
  overlap: boolean,
  was: boolean,
  signals?: Signals,
): void {
  if (overlap && !was) {
    const type = getEnterEventType(e);
    if (type) collisionBus.emit(type, { a: -1, b: e, signals });
  } else if (overlap && was) {
    // stay：仅危险物需要（激光可能进入区域后变 on，必须逐帧复查）
    if (isHazard(e)) collisionBus.emit('stay:player:hazard', { a: -1, b: e, signals });
  } else if (!overlap && was) {
    const type = getExitEventType(e);
    if (type) collisionBus.emit(type, { a: -1, b: e, signals });
  }
}

/** 根据实体组件决定 enter 事件类型 */
function getEnterEventType(e: number): string | null {
  if (isHazard(e)) return 'enter:player:hazard';
  if (isCollectible(e)) return 'enter:player:pickup';
  if (isRespawnPoint(e)) return 'enter:player:respawn';
  if (isGoal(e)) return 'enter:player:goal';
  return null;
}

/** 根据实体组件决定 exit 事件类型 */
function getExitEventType(e: number): string | null {
  if (isHazard(e)) return 'exit:player:hazard';
  if (isRespawnPoint(e)) return 'exit:player:respawn';
  return null;
}

/** 探测组件存在性：统一走 bitECS hasComponent（不可用字段 undefined 判断——
 * TypedArray（u8）槽位未写出 0，普通数组受 eid 复用残留影响，均不可靠） */
function isCollectible(e: number): boolean { return hasComponent(world, e, Collectible); }
function isHazard(e: number): boolean { return hasComponent(world, e, Hazard); }
function isRespawnPoint(e: number): boolean { return hasComponent(world, e, RespawnPoint); }
function isGoal(e: number): boolean { return hasComponent(world, e, Goal); }

/** 工具：探测激光（Hazard + Timer；用于 hazard handler 区分 on/off） */
export function isLaser(e: number): boolean {
  return hasComponent(world, e, Hazard) && hasComponent(world, e, Timer);
}