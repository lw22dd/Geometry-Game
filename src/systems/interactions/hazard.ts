/**
 * 危险物重叠检测 —— 只负责"报告玩家碰到了危险物"，不裁决生死。
 * 生死裁决统一经契约层：applyEffect(playerState, { kind: 'KillRequest' })。
 *
 * 本地玩家走 CollisionSystem 事件路径（enter:player:hazard → CollisionHooks 投递请求）；
 * 远程玩家（host 模拟，无 ECS 实体）用本函数逐帧检测，投递同一契约请求。
 */
import { hasComponent } from 'bitecs';
import { world, Timer, qHazards, qLasers } from '../../core/ecs';
import { colliderWorldRect, aabbOverlap } from '../level';
import type { PlayerState } from '../../types';

/** 玩家是否与任一危险物重叠（尖刺 或 激活中的激光） */
export function checkHazardOverlap(p: PlayerState): boolean {
  if (p.dead) return false;
  const rect = {
    x: p.x - p.half,
    y: p.y - p.half,
    w: p.half * 2,
    h: p.half * 2,
    top: p.y + p.half,
  };

  // 尖刺（ECS 实体：Position + Collider + Hazard，无 Timer）
  for (const e of qHazards()) {
    if (hasComponent(world, e, Timer)) continue; // 激光带 Timer，下方处理
    if (aabbOverlap(rect, colliderWorldRect(e))) return true;
  }
  // 激光（ECS 实体：Position + Collider + Timer + Hazard，仅 on 时致死）
  for (const e of qLasers()) {
    if (!Timer.on[e]) continue;
    if (aabbOverlap(rect, colliderWorldRect(e))) return true;
  }
  return false;
}
