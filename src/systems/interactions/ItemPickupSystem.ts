/**
 * 可拾取物计数 helper —— 光球总数（"全部光球"判定复用）。
 *
 * （原坐标版检测链 updateItemPickupSystem + CollectibleKind 已删除：
 *   远程玩家已走碰撞路由（game/stepRemoteClients 经 setCollisionSim → CollisionSystem
 *   → enter:player:pickup → CollisionHooks），这条 if-else 查询链无调用点。）
 */
import { qOrbs } from '../../core/ecs';

/** 当前地图光球总数（仅 Orb tag） */
export function orbCount(): number {
  return qOrbs().length;
}