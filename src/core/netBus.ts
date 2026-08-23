/**
 * 事件总线 —— systems↔net 之间唯一合法的通信工具。
 * 当前为桩（预留），后续可扩展为 typed event emitter。
 */
import type { NetBusEvent } from '../types';

type Handler = (e: NetBusEvent) => void;
const handlers: Handler[] = [];

export const netBus = {
  /** 发射事件 */
  emit(e: NetBusEvent): void {
    for (const h of handlers) h(e);
  },
  /** 注册监听（返回移除函数） */
  on(h: Handler): () => void {
    handlers.push(h);
    return () => {
      const i = handlers.indexOf(h);
      if (i >= 0) handlers.splice(i, 1);
    };
  },
  /** 移除监听 */
  off(h: Handler): void {
    const i = handlers.indexOf(h);
    if (i >= 0) handlers.splice(i, 1);
  },
  /** 清空所有监听 */
  clear(): void {
    handlers.length = 0;
  },
};