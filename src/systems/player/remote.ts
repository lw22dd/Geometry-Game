/**
 * 远程玩家管理 —— 联机模式下的其他玩家状态。
 * 房主视角：为每个客机维护权威模拟状态（+ 该客机的输入）。
 * 客机视角：维护从房主收到的其他玩家渲染状态。
 */
import type { RemotePlayer, InputKeys, PathSegment } from '../../types';
import { room } from '../../net/room';
import { buildCumulativeLengths } from '../../core/path';

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
}

/**
 * 注册远程玩家（收到 player_joined 时调用）。
 * 同时初始化权威模拟状态。
 */
export function registerRemote(id: number, name: string): RemotePlayer {
  let rp = remotes.get(id);
  if (!rp) {
    rp = {
      id, name,
      // PlayerState 全字段
      x: 6, y: 5, vx: 0, vy: 0, half: 0.42,
      grounded: false, coyote: 0, jbuf: 0, face: 1,
      dead: false, deadT: 0, plat: null,
      sprint: false, wasSpr: false, inv: 0,
      extraJumps: 0, extraJumpsMax: 0,
      jumpWasDown: false,
      springT: 0, springX: 0, springY: 0,
      track: null,
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
  trackOn: boolean; trackDist: number; trackSpeed: number;
  trackEntry: number; trackExit: number;
  trackSegments: PathSegment[];
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
    rp.vx = ps.vx;
    rp.vy = ps.vy;
    rp.face = ps.face;
    rp.grounded = ps.grounded;
    rp.dead = ps.dead;
    rp.sprint = ps.sprint;
    // 轨道状态（无则渲染为自由运动）
    if (ps.trackOn) {
      const cl = buildCumulativeLengths(ps.trackSegments);
      rp.track = {
        segments: ps.trackSegments,
        cumulative: cl,
        dist: ps.trackDist,
        speed: ps.trackSpeed,
        totalLength: cl[cl.length - 1],
        entryDist: ps.trackEntry,
        exitDist: ps.trackExit,
      };
    } else {
      rp.track = null;
    }
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