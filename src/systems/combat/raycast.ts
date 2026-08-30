/**
 * 公共射线检测 —— segRectT + raycastWorld（S2）。
 *
 * 从 items/hook.ts 抽出通用射线检测：任何「沿方向发射线段、命中最近矩形」的
 * 需求（钩锁 / AK 命中 / 抛体探测）都走这里，不再复制 slab 算法。
 * 纯函数，只依赖 types 的 Rect。
 */
import type { Rect } from '../../types';

/** 命中面 */
export type RayFace = 'left' | 'right' | 'bottom' | 'top';

/** 线段-矩形最近交点参数 t∈[0,1]（slab 法）；无交点/null/起点在矩形内返回 null */
export function segRectT(
  ox: number, oy: number, ux: number, uy: number, r: Rect,
): { t: number; face: RayFace } | null {
  let tmin = 0;
  let tmax = 1;
  let hitFace: RayFace | null = null;

  // X slab [r.x, r.x + r.w]
  if (Math.abs(ux) < 1e-9) {
    if (ox < r.x || ox > r.x + r.w) return null;
  } else {
    let t1 = (r.x - ox) / ux;
    let t2 = (r.x + r.w - ox) / ux;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }

  // Y slab [r.y, r.top]（top = y + h）
  if (Math.abs(uy) < 1e-9) {
    if (oy < r.y || oy > r.top) return null;
  } else {
    let t1 = (r.y - oy) / uy;
    let t2 = (r.top - oy) / uy;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
    // 记录 tmin 前的值，用于判断哪个 slab 产生入口
    const prevTmin = tmin;
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
    // 如果 Y slab 的入口 t1 决定了新的 tmin，则命中面为 bottom 或 top
    if (tmin === t1 && t1 > prevTmin) {
      // uy > 0 → 射线向上 → 入口在 bottom 面 (y = r.y)
      // uy < 0 → 射线向下 → 入口在 top 面 (y = r.top)
      hitFace = (uy > 0) ? 'bottom' : 'top';
    }
  }

  // 如果尚未确定面，则入口来自 X slab（或垂直射线）
  if (hitFace === null) {
    if (ux > 0) hitFace = 'left';
    else if (ux < 0) hitFace = 'right';
    else hitFace = 'bottom'; // 纯垂直射线，无法确定 X 方向，默认 bottom（安全兜底）
  }

  // 起点已在矩形内部（tmin=0）→ 本段命中无意义
  if (tmin <= 0) return null;
  return { t: tmin, face: hitFace };
}

/** 射线命中结果 */
export interface RayHit {
  /** 命中参数 t∈[0,1]（相对 maxLen） */
  t: number;
  /** 命中世界坐标 X */
  x: number;
  /** 命中世界坐标 Y */
  y: number;
  face: RayFace;
}

/**
 * 从 (ox,oy) 沿方向 (dirX,dirY) 发射，长度 maxLen 格，
 * 命中 rects 中最近的矩形返回命中点；否则 null。
 * @param rects 参与判定的矩形列表（世界固体 / 敌人碰撞箱等）
 */
export function raycastWorld(
  ox: number, oy: number, dirX: number, dirY: number, maxLen: number,
  rects: readonly Rect[],
): RayHit | null {
  const dLen = Math.hypot(dirX, dirY);
  if (dLen < 1e-4) return null;
  const ux = (dirX / dLen) * maxLen;
  const uy = (dirY / dLen) * maxLen;

  let best: { t: number; face: RayFace } | null = null;
  for (const r of rects) {
    const result = segRectT(ox, oy, ux, uy, r);
    if (result === null) continue;
    if (best === null || result.t < best.t) best = result;
  }
  if (best === null) return null;
  return { t: best.t, x: ox + ux * best.t, y: oy + uy * best.t, face: best.face };
}