/**
 * 双跳光球收集系统（坐标版）—— 用于远程玩家（host 模拟）检测 JumpBoost 收集。
 * 本地玩家通过 CollisionSystem + CollisionHooks 处理。
 */
import { world } from '../../core/ecs';
import { Position } from '../../components/physics/Position';
import { Collider } from '../../components/physics/Collider';
import { JumpBoost } from '../../components/gameplay/JumpBoost';
import { pointInCollider } from '../level';

/**
 * 检测远程玩家是否与双跳光球重叠。
 * @returns true = 本次拾取（调用方据此给远程玩家设置 extraJumpsMax = 1）
 */
export function updateJumpBoostSystem(tx: number, ty: number): boolean {
  for (const e of world.query(Position, Collider, JumpBoost)) {
    const jb = world.get<JumpBoost>(e, JumpBoost);
    if (jb.collected) continue;
    if (!pointInCollider(e, tx, ty)) continue;
    jb.collected = true;
    return true;
  }
  return false;
}