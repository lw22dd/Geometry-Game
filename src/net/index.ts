/**
 * 网络层 —— NetClient + session 状态机。
 * 当前为桩（预留）：真实实现将经 WebSocket 连接。
 * 只通过 core/netBus 与 systems 通信，绝不直接 import systems。
 */
import type { NetBusEvent } from '../types';

export type SessionState = 'idle' | 'connecting' | 'ready' | 'closed';

/** session 状态机 */
export const session = {
  state: 'idle' as SessionState,

  connect(): void {
    this.state = 'connecting';
  },

  ready(): void {
    this.state = 'ready';
  },

  close(): void {
    this.state = 'closed';
  },
};

/** 网络客户端（桩实现） */
export class NetClient {
  connected = false;

  connect(): void {
    this.connected = true;
    session.connect();
  }

  disconnect(): void {
    this.connected = false;
    session.close();
  }

  /** 经 netBus 收到的事件 → 发送到服务端（桩：暂不发送） */
  send(_evt: NetBusEvent): void {
    // TODO: 实际协议发送
  }
}