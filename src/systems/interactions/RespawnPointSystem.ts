/**
 * 复活点激活系统 —— 通过 Collider 触发区检测玩家靠近检查点。
 *
 * 两种入口：
 *  - activateCheckpoint(e)：激活指定检查点实体（本地按 E / 远程按 E 均调用）
 *  - updateRespawnPointSystem(tx, ty, interact)：坐标版（远程玩家，host 模拟），
 *    玩家按下 E（interact=true）时才激活，未按 E 仅返回 null（等待交互）。
 */
import { world, Position, Collider, RespawnPoint, qCheckpoints } from '../../core/ecs';
import type { EntityId } from '../../core/ecs';
import { cpPoint } from '../../config';
import { FX } from '../../Prefabs/Fx';
import { spawnParticles } from '../particles';
import { sfx } from '../../core/audio';
import { netBus } from '../../core/netBus';
import { pointInCollider } from '../level';

/**
 * 激活检查点（共享逻辑：本地/E 键/远程玩家共用）。
 * 绑定新检查点时自动解绑旧的——一个玩家一次只绑定一个复活点。
 * @param e 检查点实体
 * @param setCpPoint 是否写入全局 cpPoint（本地玩家 true；远程玩家 false，由调用方写自己的 cpX/cpY）
 * @returns 激活成功返回 {x, y}，否则 null
 */
export function activateCheckpoint(e: EntityId, setCpPoint = true): { x: number; y: number } | null {
  if (RespawnPoint.active[e]) return null;

  // 解绑其他所有已激活的检查点（一个玩家一次只能绑定一个）
  for (const other of qCheckpoints()) {
    if (other === e) continue;
    if (RespawnPoint.active[other]) {
      RespawnPoint.active[other] = 0;
      RespawnPoint.nearby[other] = 0;
    }
  }

  RespawnPoint.active[e] = 1;
  RespawnPoint.nearby[e] = 0;
  const px = Position.x[e], py = Position.y[e];
  if (setCpPoint) {
    cpPoint.x = px;
    cpPoint.y = py;
  }
  spawnParticles(FX.cp, px, py);
  sfx.cp();
  netBus.emit({ type: 'game:checkpoint', x: px, y: py });
  return { x: px, y: py };
}

/**
 * 远程玩家检查点交互检测（坐标版，host 模拟）。
 * @param tx 目标 X
 * @param ty 目标 Y
 * @param interact 玩家是否按下交互键（E）
 * @returns 本次激活的复活点坐标；未激活返回 null
 */
export function updateRespawnPointSystem(tx: number, ty: number, interact: boolean): { x: number; y: number } | null {
  for (const e of qCheckpoints()) {
    if (RespawnPoint.active[e]) continue;
    if (!pointInCollider(e, tx, ty)) continue;
    // 在触发区内但未按 E → 保持等待
    if (!interact) return null;
    // 远程玩家复活点由调用方写入自己的 cpX/cpY（不覆盖全局 cpPoint）
    return activateCheckpoint(e, false);
  }
  return null;
}