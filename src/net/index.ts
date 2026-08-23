/**
 * 网络层 —— NetClient（真实 WebSocket 客户端）。
 * 房主 & 客机共用：
 *   - connect(host, port, name) → 连接 Go Server
 *   - 房主: sendHostState / sendHostEvent
 *   - 客机: sendInput
 * 事件通过 on() 订阅，不直接 import systems。
 */
import { room } from './room';
import type {
  InputKeys, NetOrbState, NetPlayerState, RemotePlayerInfo,
} from '../types';

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

/* ==================== 网络事件类型 ==================== */

export interface NetEvents {
  /** 连接成功，收到 room_info */
  connected: (role: 'host' | 'client', playerId: number, players: RemotePlayerInfo[]) => void;
  /** 新玩家加入 */
  playerJoined: (player: RemotePlayerInfo) => void;
  /** 玩家离开 */
  playerLeft: (playerId: number) => void;
  /** 收到房主权威状态（仅非房主） */
  state: (seq: number, players: NetPlayerState[], orbs: NetOrbState[], gt: number, gotN: number, deaths: number, win: boolean) => void;
  /** 收到房主事件 */
  event: (kind: string, data: unknown) => void;
  /** 收到客机输入（仅房主；含玩家来源 ID） */
  input: (playerId: number, seq: number, keys: InputKeys) => void;
  /** 连接关闭/断开 */
  disconnected: (reason: string) => void;
  /** 被踢 */
  kicked: () => void;
}

type Handler = (...args: any[]) => void;
const handlers: { [K in keyof NetEvents]?: Handler[] } = {};

function emit<K extends keyof NetEvents>(event: K, ...payload: Parameters<NetEvents[K]>): void {
  const h = handlers[event];
  if (h) for (const cb of h) cb(...payload);
}

/** 网络客户端（WebSocket 实现） */
export class NetClient {
  private ws: WebSocket | null = null;
  /** 主机地址（IP 或 localhost） */
  host = '';
  /** 端口 */
  port = 8810;

  /** 是否已连接 */
  get connected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /** 订阅网络事件（返回取消函数） */
  on<K extends keyof NetEvents>(event: K, cb: NetEvents[K]): () => void {
    if (!handlers[event]) handlers[event] = [];
    (handlers[event] as Handler[]).push(cb as unknown as Handler);
    return () => {
      const arr = handlers[event];
      if (arr) {
        const i = arr.indexOf(cb as unknown as Handler);
        if (i >= 0) arr.splice(i, 1);
      }
    };
  }

  /** 连接服务器，Promise 在收到 room_info 后 resolve */
  connect(host: string, port: number, name: string): Promise<void> {
    this.host = host;
    this.port = port;
    room.host = host;
    room.port = port;
    room.name = name;

    return new Promise((resolve, reject) => {
      session.connect();
      const url = `ws://${host}:${port}/ws?name=${encodeURIComponent(name)}`;
      const ws = new WebSocket(url);
      this.ws = ws;

      // 等 room_info 消息：首次房间信息到达即视为连接成功
      const onMessage = (e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'room_info') {
            cleanup();
            resolve();
          }
        } catch { /* ignore */ }
      };
      const cleanup = () => {
        ws.removeEventListener('message', onMessage);
      };

      ws.addEventListener('message', onMessage);
      ws.addEventListener('message', (e) => { this.handleMessage(e.data); });

      ws.addEventListener('close', () => {
        session.close();
        if (room.connected) {
          room.connected = false;
          emit('disconnected', '连接已断开');
        }
      });

      ws.addEventListener('error', () => {
        session.close();
        reject(new Error('无法连接到服务器'));
      });

      // 5 秒超时
      setTimeout(() => {
        if (session.state === 'connecting') {
          ws.close();
          reject(new Error('连接超时'));
        }
      }, 5000);
    });
  }

  /** 断开连接 */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    session.close();
    room.connected = false;
  }

  /** 发送 JSON 消息 */
  private sendJSON(obj: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  /* ==================== 客机 → 服务器 → 房主 ==================== */

  /** 客机发送本地输入（带序列号） */
  sendInput(keys: InputKeys): void {
    if (room.role !== 'client') return;
    room.inputSeq++;
    this.sendJSON({
      type: 'input',
      seq: room.inputSeq,
      keys,
    });
  }

  /* ==================== 房主 → 服务器 → 全部 ==================== */

  /** 房主发送权威状态广播 */
  sendHostState(
    seq: number, players: NetPlayerState[], orbs: NetOrbState[],
    gt: number, gotN: number, deaths: number, win: boolean,
  ): void {
    if (room.role !== 'host') return;
    this.sendJSON({
      type: 'host_state', seq, players, orbs, gt, gotN, deaths, win,
    });
  }

  /** 房主发送事件通知 */
  sendHostEvent(kind: string, data: unknown): void {
    if (room.role !== 'host') return;
    this.sendJSON({ type: 'host_event', kind, data });
  }

  /** 房主踢人 */
  kick(playerId: number): void {
    if (room.role !== 'host') return;
    this.sendJSON({ type: 'kick', playerId });
  }

  /* ==================== 消息分发 ==================== */

  private handleMessage(raw: string): void {
    let msg: any;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'room_info':
        room.role = msg.role;
        room.playerId = msg.playerId;
        room.players = msg.players;
        room.connected = true;
        session.ready();
        emit('connected', msg.role, msg.playerId, msg.players);
        break;

      case 'player_joined':
        if (!room.players.some((p: any) => p.id === msg.player.id)) {
          room.players.push(msg.player);
        }
        emit('playerJoined', msg.player);
        break;

      case 'player_left':
        room.players = room.players.filter(p => p.id !== msg.playerId);
        emit('playerLeft', msg.playerId);
        break;

      case 'input':
        // 客机输入 → 转给房主主循环
        emit('input', msg.playerId, msg.seq, msg.keys);
        break;

      case 'state':
        emit('state', msg.seq, msg.players, msg.orbs, msg.gt, msg.gotN, msg.deaths, msg.win);
        break;

      case 'event':
        emit('event', msg.kind, msg.data);
        break;

      case 'kicked':
        emit('kicked');
        break;
    }
  }
}

/** 全局唯一客户端实例 */
export const net = new NetClient();