/**
 * 房间状态 —— 联机会话的全局状态单例。
 * 供 systems/ui（连接界面）、systems/game（主循环分支）读取。
 */
import type { NetRole, RemotePlayerInfo } from '../types';

interface RoomState {
  /** 角色：standalone 单机 / host 房主 / client 客机 */
  role: NetRole;
  /** 本机玩家 ID（服务器分配） */
  playerId: number;
  /** 本机玩家名 */
  name: string;
  /** 已连接服务器 */
  connected: boolean;
  /** 在线玩家列表（含自己） */
  players: RemotePlayerInfo[];
  /** 服务器地址（仅 UI 显示用） */
  host: string;
  port: number;
  /** 输入帧序号（客机 → 房主，房主回包比对外） */
  inputSeq: number;
}

export const room: RoomState = {
  role: 'standalone',
  playerId: -1,
  name: '玩家',
  connected: false,
  players: [],
  host: '',
  port: 8810,
  inputSeq: 0,
};

/** 重置为单机状态 */
export function resetRoom(): void {
  room.role = 'standalone';
  room.playerId = -1;
  room.connected = false;
  room.players = [];
  room.host = '';
  room.inputSeq = 0;
}

/** 我是房主？ */
export function isHost(): boolean {
  return room.role === 'host';
}

/** 当前处于联机会话 */
export function inSession(): boolean {
  return room.role === 'host' || room.role === 'client';
}