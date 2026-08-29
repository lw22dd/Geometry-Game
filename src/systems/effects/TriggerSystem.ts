/**
 * 触发系统（扩展占位）—— 事件/条件 → 投递请求。
 *
 * 事件总线（PlayerController 事件 / collisionBus / netBus）已具备；本系统提供
 * "订阅 + 条件 + 投递" 的统一注册表："之后每个触发只是订阅"。
 * 契约对齐：fire() 返回 PlayerRequest，统一经 applyEffect 结算投递，触发方不写玩家状态。
 * 战斗扩展：低血盾（事件=受击/血量变化）→ 加对应事件源即可；事件引爆（标记层数）同理。
 */
import { applyEffect, type PlayerRequest } from './index';
import type { PlayerState } from '../../types';

/** 触发定义 */
export interface TriggerDef {
  id: string;
  /** 事件名（与 PlayerEvent.type / netBus type 对齐的字符串） */
  event: string;
  /** 可选条件（不提供 = 恒真） */
  condition?: (p: PlayerState, payload: unknown) => boolean;
  /** 事件触发时投递的请求（可按 payload 生成；支持单个或数组） */
  fire: (p: PlayerState, payload: unknown) => PlayerRequest | PlayerRequest[];
}

const triggers: TriggerDef[] = [];

/** 注册触发（内容模块在 import 时注册；重复注册允许但建议用唯一 id） */
export function registerTrigger(def: TriggerDef): void {
  triggers.push(def);
}

/** 清除全部触发（测试用） */
export function resetTriggers(): void {
  triggers.length = 0;
}

/**
 * 按事件名派发：匹配的触发 → 条件满足 → 投递请求（applyEffect 唯一写入口）。
 * 由事件源（PlayerController.onEvent / collisionBus / netBus）调用。
 */
export function fireTriggers(event: string, p: PlayerState, payload?: unknown): void {
  for (const t of triggers) {
    if (t.event !== event) continue;
    if (t.condition && !t.condition(p, payload)) continue;
    const fx = t.fire(p, payload);
    const list = Array.isArray(fx) ? fx : [fx];
    for (const r of list) applyEffect(p, r);
  }
}
