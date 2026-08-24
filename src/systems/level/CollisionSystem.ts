/**
 * 碰撞系统 —— 统一 AABB 检测 + 事件分发。
 * 每帧检测玩家实体 vs 所有其他 Collider 实体，跟踪 enter/stay/exit 状态，
 * 通过 collisionBus 发射事件。
 *
 * 物理分辨率（平台推挤）不由本系统处理，保留在 stepPlayerGeneric 中。
 * 本系统只处理触发事件（危险物/收集/检查点/终点）。
 *
 * 仅服务本地玩家（有 ECS 实体）。
 * 远程玩家（host 模拟，无 ECS 实体）：
 *   - 危险物检测由 stepPlayerGeneric 的 checkHazards 参数行内处理
 *   - 收集/检查点/终点由 game/index 的坐标版交互系统处理
 */
import { world } from '../../core/ecs';
import type { EntityId } from '../../core/ecs/Entity';
import { Position } from '../../components/physics/Position';
import { Collider } from '../../components/physics/Collider';
import { Hazard } from '../../components/gameplay/Hazard';
import { Collectible } from '../../components/gameplay/Collectible';
import { JumpBoost } from '../../components/gameplay/JumpBoost';
import { RespawnPoint } from '../../components/gameplay/RespawnPoint';
import { Goal } from '../../components/gameplay/Goal';
import { PlayerTag } from '../../components/gameplay/PlayerTag';
import { colliderWorldRect, aabbOverlap } from './OverlapUtils';
import { collisionBus } from '../../core/collisionBus';

/** 上一帧的碰撞状态缓存（key = "playerId-entityId"） */
let lastFrame = new Map<string, boolean>();

/**
 * 更新碰撞系统（本地玩家）。
 * 检测玩家 vs 所有其他 Collider 实体，发射 enter/exit 事件。
 * @param signals 可选帧信号对象，碰撞处理器可写入
 */
export function updateCollisionSystem(signals?: Record<string, boolean>): void {
  const players = world.query(PlayerTag, Position, Collider);
  if (players.length === 0) return;

  const playerEntity = players[0];
  const thisFrame = new Map<string, boolean>();

  const playerPos = world.get<Position>(playerEntity, Position);
  const playerCol = world.get<Collider>(playerEntity, Collider);
  const playerRect = colliderWorldRect(playerPos, playerCol);

  for (const e of world.query(Position, Collider)) {
    if (e === playerEntity || players.includes(e)) continue;

    const otherRect = colliderWorldRect(
      world.get<Position>(e, Position),
      world.get<Collider>(e, Collider),
    );

    const overlap = aabbOverlap(playerRect, otherRect);
    const key = `${playerEntity}-${e}`;
    const was = lastFrame.get(key) ?? false;
    thisFrame.set(key, overlap);

    emitTransitions(playerEntity, e, overlap, was, signals);
  }

  lastFrame = thisFrame;
}

/** 根据 enter/exit 状态变化发射事件 */
function emitTransitions(
  a: EntityId,
  b: EntityId,
  overlap: boolean,
  was: boolean,
  signals?: Record<string, boolean>,
): void {
  if (overlap && !was) {
    const type = getEnterEventType(b);
    if (type) collisionBus.emit(type, { a, b, signals });
  } else if (overlap && was) {
    // stay：仅危险物需要（激光可能进入区域后变 on，必须逐帧复查）
    if (world.has(b, Hazard)) collisionBus.emit('stay:player:hazard', { a, b, signals });
  } else if (!overlap && was) {
    const type = getExitEventType(b);
    if (type) collisionBus.emit(type, { a, b, signals });
  }
}

/** 根据实体组件决定 enter 事件类型 */
function getEnterEventType(e: EntityId): string | null {
  if (world.has(e, Hazard)) return 'enter:player:hazard';
  if (world.has(e, Collectible)) return 'enter:player:collectible';
  if (world.has(e, JumpBoost)) return 'enter:player:jumpboost';
  if (world.has(e, RespawnPoint)) return 'enter:player:respawn';
  if (world.has(e, Goal)) return 'enter:player:goal';
  return null;
}

/** 根据实体组件决定 exit 事件类型 */
function getExitEventType(e: EntityId): string | null {
  if (world.has(e, Hazard)) return 'exit:player:hazard';
  if (world.has(e, RespawnPoint)) return 'exit:player:respawn';
  return null;
}