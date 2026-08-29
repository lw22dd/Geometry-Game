/**
 * 碰撞事件总线 —— 发布/订阅模式。
 * CollisionSystem 检测到碰撞后 emit 事件，业务系统通过 on 订阅。
 *
 * 事件类型约定（字符串）：
 *   'enter:player:hazard'      玩家进入危险物（尖刺/激光）
 *   'stay:player:hazard'       玩家持续在危险物中
 *   'exit:player:hazard'       玩家离开危险物
 *   'enter:player:collectible' 玩家进入光球
 *   'enter:player:respawn'     玩家进入检查点
 *   'enter:player:goal'        玩家到达终点
 */
import type { EntityId } from './ecs';

export interface CollisionEvent {
  /** 碰撞主体（通常是玩家） */
  a: EntityId;
  /** 碰撞客体（危险物/光球/检查点/终点） */
  b: EntityId;
  /**
   * 可选帧信号（供动画 FSM 消费，由调用方传入）。
   * 值为 unknown：既有布尔位外，signals.picked 承载 ItemId（字符串）——加道具不再动事件字面量。
   */
  signals?: Record<string, unknown>;
}

type Handler = (ev: CollisionEvent) => void;

export class CollisionBus {
  private handlers = new Map<string, Set<Handler>>();

  /** 订阅碰撞事件 */
  on(type: string, handler: Handler): void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
  }

  /** 取消订阅 */
  off(type: string, handler: Handler): void {
    this.handlers.get(type)?.delete(handler);
  }

  /** 发布碰撞事件 */
  emit(type: string, ev: CollisionEvent): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const h of set) h(ev);
  }

  /** 清除某类型的所有订阅 */
  clear(type?: string): void {
    if (type) this.handlers.delete(type);
    else this.handlers.clear();
  }
}

/** 全局单例 */
export const collisionBus = new CollisionBus();