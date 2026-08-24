/**
 * 编辑器视口 —— 世界 ↔ 屏幕坐标变换，平移/缩放。
 *
 * 使用与游戏一致的 SL/SB/SZ 模型（view.SL = 左边缘世界坐标，
 * view.SB = 底边缘世界坐标，view.SZ = 像素/格），
 * 以便后续复用游戏渲染函数。
 */
import { PPM, VH, VW } from './canvas';

/** 视口变换参数 */
export const view = {
  /** 左边缘世界坐标（格） */
  SL: 0,
  /** 底边缘世界坐标（格，Y 向上） */
  SB: 0,
  /** 缩放因子（像素/格） */
  SZ: PPM,
};

/** 世界坐标 X → 屏幕像素 X */
export const sx = (x: number): number => (x - view.SL) * view.SZ;

/** 世界坐标 Y → 屏幕像素 Y（Y 轴向上 → 屏幕 Y 向下翻转） */
export const sy = (y: number): number => VH - (y - view.SB) * view.SZ;

/** 屏幕像素 → 世界坐标 */
export function screenToWorld(mx: number, my: number): { x: number; y: number } {
  return {
    x: view.SL + mx / view.SZ,
    y: view.SB + (VH - my) / view.SZ,
  };
}

/** 将视口中心置于世界坐标 (wx, wy)，保持指定缩放 */
export function centerOn(wx: number, wy: number, zoom = 1): void {
  view.SZ = PPM * zoom;
  view.SL = wx - VW / (2 * view.SZ);
  view.SB = wy - VH / (2 * view.SZ);
}

/** 以屏幕像素 (mx, my) 为中心放大/缩小 */
export function zoomAt(mx: number, my: number, factor: number): void {
  const w = screenToWorld(mx, my);
  view.SZ = Math.max(4, Math.min(200, view.SZ * factor));
  view.SL = w.x - mx / view.SZ;
  view.SB = w.y - (VH - my) / view.SZ;
}

/** 平移（像素增量） */
export function pan(dxPx: number, dyPx: number): void {
  view.SL -= dxPx / view.SZ;
  view.SB += dyPx / view.SZ;
}

/** 将世界坐标对齐到网格 */
export function snapToGrid(v: number, grid: number): number {
  return Math.round(v / grid) * grid;
}