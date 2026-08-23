/**
 * 玩家实体注册 —— 将既有玩家状态 P 注册为 ECS 实体。
 * 关键：Position / Velocity 组件直接引用 P 对象本身，
 * 使所有既有代码（P.x、P.vy 等）无需修改即可继续工作。
 */
import { world } from '../../core/ecs';
import { Position } from '../../components/Position';
import { Velocity } from '../../components/Velocity';
import { PlayerTag } from '../../components/PlayerTag';
import { P } from '../../systems/player';

/** 玩家实体 ID（全局唯一） */
export const playerEntity: number = world.createEntity();

/** 注册玩家实体（幂等：重复调用不会重复创建） */
export function initPlayerEntity(): void {
  if (!world.has(playerEntity, PlayerTag)) {
    world.add(playerEntity, PlayerTag, {});
  }
  // P 对象本身作为组件数据 —— 物理系统继续直接读写 P
  world.add(playerEntity, Position, P);
  world.add(playerEntity, Velocity, P);
}