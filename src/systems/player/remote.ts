/**
 * 远程玩家管理 —— 联机模式下的其他玩家状态。
 * 房主视角：为每个客机维护权威模拟状态（+ 该客机的输入）。
 * 客机视角：维护从房主收到的其他玩家渲染状态。
 */
import type { RemotePlayer, InputKeys, PathSegment } from '../../types';
import { room } from '../../net/room';
import { unpackTrack } from '../../core/trackCodec';
import { createPlayerState } from './createPlayerState';
import { removeRemotePlayerEntity, removeAllRemotePlayerEntities } from './playerEntity';

/** 远程玩家表（playerId → RemotePlayer，含完整 PlayerState 模拟状态） */
export const remotes = new Map<number, RemotePlayer>();

/** 客机输入缓冲（房主用：playerId → 最新输入） */
const clientInputs = new Map<number, { seq: number; keys: InputKeys }>();

/** 客机序列号 → 最近收到的序列号（用于丢弃乱序/过期输入） */
const clientSeq = new Map<number, number>();

/** 重置远程玩家（断线/新会话） */
export function resetRemotes(): void {
  remotes.clear();
  clientInputs.clear();
  clientSeq.clear();
  // A 路线：远端实体表与 remotes 生命周期同步（clearWorld 后侧表已失效，清表防悬空）
  removeAllRemotePlayerEntities();
}

/**
 * 注册远程玩家（收到 player_joined 时调用）。
 * 同时初始化权威模拟状态。
 */
export function registerRemote(id: number, name: string): RemotePlayer {
  let rp = remotes.get(id);
  if (!rp) {
    rp = {
      // PlayerState 全字段（工厂统一初始化；远程玩家出生点与本地一致）
      ...createPlayerState(6, 5),
      id, name,
      // 检查点（默认出生点）
      cpX: 6, cpY: 4,
    };
    remotes.set(id, rp);
  }
  return rp;
}

/** 移除远程玩家（收到 player_left 时调用） */
export function removeRemote(id: number): void {
  remotes.delete(id);
  clientInputs.delete(id);
  clientSeq.delete(id);
  removeRemotePlayerEntity(id);
}

/** 更新远程玩家的输入（房主用：收到客机 input 消息时调用） */
export function setClientInput(playerId: number, seq: number, keys: InputKeys): void {
  const prev = clientSeq.get(playerId) ?? -1;
  if (seq <= prev) return; // 过期输入丢弃
  clientSeq.set(playerId, seq);
  clientInputs.set(playerId, { seq, keys });
}

/** 获取客机最新输入（无输入时返回 null） */
export function getClientInput(playerId: number): InputKeys | null {
  const c = clientInputs.get(playerId);
  return c ? c.keys : null;
}

/**
 * 用网络权威状态更新远程玩家渲染状态（客机用）。
 * 对状态中的"自己"（playerId === room.playerId）不做处理 —— 自己在 P 里预测。
 */
export interface NetPlayerTrackFields {
  playerId: number;
  x: number; y: number; vx: number; vy: number; face: number;
  grounded: boolean; dead: boolean; sprint: boolean;
  /** 水平移速倍率（1 = 常态，2 = 加速 buff） */
  speedMult: number;
  trackOn: boolean; trackDist: number; trackSpeed: number;
  trackEntry: number; trackExit: number;
  trackSegments: PathSegment[];
  trackZipline?: boolean;
}

export function applyNetPlayers(players: NetPlayerTrackFields[]): void {
  for (const ps of players) {
    if (ps.playerId === room.playerId) continue; // 自己是预测的
    let rp = remotes.get(ps.playerId);
    if (!rp) {
      rp = registerRemote(ps.playerId, '玩家' + ps.playerId);
    }
    rp.x = ps.x;
    rp.y = ps.y;
    rp.velocity.x = ps.vx;
    rp.velocity.y = ps.vy;
    rp.face = ps.face;
    rp.grounded = ps.grounded;
    rp.dead = ps.dead;
    rp.sprint = ps.sprint;
    // 加速倍率：房主模拟权威（加速光效随位置一起同步）
    rp.speedMult = ps.speedMult || 1;
    // 轨道状态（无则渲染为自由运动）；问题 10：重建逻辑统一走 core/trackCodec
    rp.track = unpackTrack(ps);
  }
}

/** 客机用：获取自己的权威位置（用于预测矫正） */
export function getSelfAuthority(players: { playerId: number; x: number; y: number }[]): { x: number; y: number } | null {
  for (const ps of players) {
    if (ps.playerId === room.playerId) {
      return { x: ps.x, y: ps.y };
    }
  }
  return null;
}