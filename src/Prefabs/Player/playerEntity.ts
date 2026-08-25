/**
 * 玩家实体注册 —— 将既有玩家状态 P 注册为 ECS 实体。
 * 关键：Position / Velocity 组件直接引用 P 对象本身，
 * 使所有既有代码（P.x、P.velocity 等）无需修改即可继续工作。
 *
 * 实体采用懒创建：world.clear()（切图重建）后再次调用可重建玩家实体，
 * 保证 setupLevel 的「清空世界 → 重建」链路可用。
 */
import { world } from '../../core/ecs';
import type { EntityId } from '../../core/ecs/Entity';
import { Position } from '../../components/physics/Position';
import { Velocity } from '../../components/physics/Velocity';
import { Collider } from '../../components/physics/Collider';
import { addTag, hasTag, TAG_PLAYER } from '../../components/gameplay/tagHelpers';
import { playerController } from '../../systems/player';

/** 玩家实体 ID（全局唯一；未注册时为 null） */
let playerEntity: EntityId | null = null;

/** 注册玩家实体（幂等：重复调用不会重复创建；实体被清空后可重建） */
export function initPlayerEntity(): void {
  if (playerEntity !== null && hasTag(playerEntity, TAG_PLAYER)) {
    return;
  }
  playerEntity = world.createEntity();
  addTag(playerEntity, TAG_PLAYER);
  // P 对象本身作为组件数据 —— 物理系统继续直接读写 P
  const pState = playerController.getState();
  world.add(playerEntity, Position, pState);
  world.add(playerEntity, Velocity, pState);
  // 玩家碰撞箱 0.84×0.84（half=0.42 → 2*0.42），solid=false（触发区）
  world.add(playerEntity, Collider, { w: 0.84, h: 0.84, solid: false });
}

/** 获取玩家实体 ID（须在 initPlayerEntity 之后调用） */
export function getPlayerEntity(): number {
  if (playerEntity === null) throw new Error('Player entity not initialized');
  return playerEntity;
}