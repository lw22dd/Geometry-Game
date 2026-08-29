/**
 * 轨道状态编解码 —— TrackState ↔ 网络平铺字段。
 * 问题 10：原 game/index.ts 与 remote.ts 各有一份 unpackTrack，此处收敛为唯一实现。
 */
import { buildCumulativeLengths } from './path';
import type { PathSegment, TrackState } from '../types';

/** packTrack 的完整输出（与 NetPlayerState 的轨道字段对齐） */
export interface TrackFields {
  trackOn: boolean;
  trackDist: number;
  trackSpeed: number;
  trackEntry: number;
  trackExit: number;
  trackSegments: PathSegment[];
  trackZipline: boolean;
}

/** unpackTrack 的输入（远端字段 trackZipline 可能省略） */
export type TrackFieldsLike = Omit<TrackFields, 'trackZipline'> & { trackZipline?: boolean };

/** 将 TrackState 转为网络平铺字段（null = 轨道关闭） */
export function packTrack(t: TrackState | null): TrackFields {
  if (!t) {
    return { trackOn: false, trackDist: 0, trackSpeed: 0, trackEntry: 0, trackExit: 0, trackSegments: [], trackZipline: false };
  }
  return {
    trackOn: true,
    trackDist: t.dist,
    trackSpeed: t.speed,
    trackEntry: t.entryDist,
    trackExit: t.exitDist,
    trackSegments: t.segments,
    trackZipline: !!t.zipline,
  };
}

/** 从平铺字段重建 TrackState（仅 trackOn 时返回非 null） */
export function unpackTrack(fields: TrackFieldsLike): TrackState | null {
  if (!fields.trackOn) return null;
  const cl = buildCumulativeLengths(fields.trackSegments);
  return {
    segments: fields.trackSegments,
    cumulative: cl,
    dist: fields.trackDist,
    speed: fields.trackSpeed,
    totalLength: cl[cl.length - 1],
    entryDist: fields.trackEntry,
    exitDist: fields.trackExit,
    zipline: !!fields.trackZipline,
  };
}
