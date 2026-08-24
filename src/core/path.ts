/**
 * 路径几何计算 —— 纯函数，无 ECS、无副作用。
 * 输入 PathSegment + 归一化参数 t∈[0,1]，输出位置/切线/弧长/重力分量。
 *
 * 所有函数接收 segments 数组 + 总弧长 + 累积距离 dist，
 * 内部自动查找 dist 落在哪个段上并插值。
 */
import type { PathSegment } from '../types/path';

/* ==================== 单段计算 ==================== */

/** 单段上位置（t∈[0,1]） */
export function segPosition(seg: PathSegment, t: number): { x: number; y: number } {
  switch (seg.type) {
    case 'line': {
      return {
        x: seg.x1 + (seg.x2 - seg.x1) * t,
        y: seg.y1 + (seg.y2 - seg.y1) * t,
      };
    }
    case 'arc': {
      const theta = seg.startAngle + (seg.endAngle - seg.startAngle) * t;
      return {
        x: seg.cx + Math.cos(theta) * seg.radius,
        y: seg.cy + Math.sin(theta) * seg.radius,
      };
    }
  }
}

/** 单段上切线单位向量（t∈[0,1]） */
export function segTangent(seg: PathSegment, t: number): { x: number; y: number } {
  switch (seg.type) {
    case 'line': {
      const dx = seg.x2 - seg.x1;
      const dy = seg.y2 - seg.y1;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      return { x: dx / len, y: dy / len };
    }
    case 'arc': {
      const theta = seg.startAngle + (seg.endAngle - seg.startAngle) * t;
      const tx = -Math.sin(theta) * seg.dir;
      const ty = Math.cos(theta) * seg.dir;
      const len = Math.sqrt(tx * tx + ty * ty) || 1;
      return { x: tx / len, y: ty / len };
    }
  }
}

/** 单段弧长 */
export function segLength(seg: PathSegment): number {
  switch (seg.type) {
    case 'line': {
      const dx = seg.x2 - seg.x1;
      const dy = seg.y2 - seg.y1;
      return Math.sqrt(dx * dx + dy * dy);
    }
    case 'arc': {
      const sweep = Math.abs(seg.endAngle - seg.startAngle);
      return seg.radius * sweep;
    }
  }
}

/** 重力在单段切线方向的分量（标量，正 = 加速，负 = 减速） */
export function segGravityTangent(seg: PathSegment, t: number, G: number): number {
  const tan = segTangent(seg, t);
  // 重力 (0, -G) 点乘切线方向
  return -G * tan.y;
}

/* ==================== 多段（复合路径） ==================== */

/** 累积长度数组：为每个段计算 [0, L0, L0+L1, L0+L1+L2, ...] */
export function buildCumulativeLengths(segs: PathSegment[]): number[] {
  const cl = [0];
  for (const s of segs) cl.push(cl[cl.length - 1] + segLength(s));
  return cl;
}

/** 根据累积距离 dist 找到所在段索引及段内 t */
export function locateSegment(segs: PathSegment[], cl: number[], dist: number): { idx: number; t: number } {
  const total = cl[cl.length - 1];
  if (total <= 0) return { idx: 0, t: 0 };
  // 夹紧
  const d = Math.max(0, Math.min(dist, total));
  // 找段
  for (let i = 0; i < segs.length; i++) {
    if (d >= cl[i] && d <= cl[i + 1]) {
      const segLen = cl[i + 1] - cl[i];
      return { idx: i, t: segLen > 0 ? (d - cl[i]) / segLen : 0 };
    }
  }
  return { idx: segs.length - 1, t: 1 };
}

/** 多段路径上位置 */
export function pathPosition(segs: PathSegment[], cl: number[], dist: number): { x: number; y: number } {
  const { idx, t } = locateSegment(segs, cl, dist);
  return segPosition(segs[idx], t);
}

/** 多段路径上切线 */
export function pathTangent(segs: PathSegment[], cl: number[], dist: number): { x: number; y: number } {
  const { idx, t } = locateSegment(segs, cl, dist);
  return segTangent(segs[idx], t);
}

/** 多段路径上重力切线分量 */
export function pathGravityTangent(segs: PathSegment[], cl: number[], dist: number, G: number): number {
  const { idx, t } = locateSegment(segs, cl, dist);
  return segGravityTangent(segs[idx], t, G);
}

/** 多段路径总长 */
export function pathTotalLength(segs: PathSegment[]): number {
  return segs.reduce((s, seg) => s + segLength(seg), 0);
}