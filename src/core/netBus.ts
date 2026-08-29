/**
 * 事件总线 —— systems↔net 之间唯一合法的通信工具。
 * 支持两种订阅：
 *  - on(handler)：全量订阅
 *  - on(pattern, handler)：按类型或前缀订阅（'player:*' 通配匹配所有 'player:' 前缀事件）
 */
import type { NetBusEvent } from '../types';

type Handler = (e: NetBusEvent) => void;
interface Subscription {
  /** 类型模式；null = 全量订阅；'x:*' = 前缀通配 */
  pattern: string | null;
  fn: Handler;
}
const subs: Subscription[] = [];

function matches(e: NetBusEvent, pattern: string | null): boolean {
  if (pattern === null) return true;
  if (pattern.endsWith(':*')) return e.type.startsWith(pattern.slice(0, -1));
  return e.type === pattern;
}

export const netBus = {
  /** 发射事件 */
  emit(e: NetBusEvent): void {
    for (const s of subs) {
      if (matches(e, s.pattern)) s.fn(e);
    }
  },
  /** 注册监听（返回移除函数）：on(handler) 全量 或 on(pattern, handler) 按类型/前缀 */
  on(pattern: string | Handler, fn?: Handler): () => void {
    if (typeof pattern === 'function') {
      subs.push({ pattern: null, fn: pattern });
    } else {
      subs.push({ pattern, fn: fn! });
    }
    return () => {
      const i = subs.findIndex(s => s.fn === (typeof pattern === 'function' ? pattern : fn));
      if (i >= 0) subs.splice(i, 1);
    };
  },
  /** 移除监听（全量监听）/ 移除指定类型的监听 */
  off(h: Handler): void {
    const i = subs.findIndex(s => s.fn === h);
    if (i >= 0) subs.splice(i, 1);
  },
  /** 清空所有监听 */
  clear(): void {
    subs.length = 0;
  },
};