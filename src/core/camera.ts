/**
 * 相机 / 坐标换算 —— 维护世界→屏幕变换与镜头跟随。
 * 不依赖任何 systems / config，只依赖 types 与 core/math。
 * 地图边界由调用方传入（支持多地图）。
 */
import type { PlayerState, GameState } from '../types';
import { clamp, lerp } from './math';
import { VW, VH, PPM } from './canvas';

/** 相机世界坐标（物理解理空间，单位：格） */
export const cam = { x: 12, y: 12 };

/** 视口变换参数（由 updateCamera 逐帧更新） */
export const view = { zoom: 1, SL: 0, SB: 0, SZ: PPM };

/** 世界坐标 → 屏幕像素 X */
export const sx = (x: number): number => (x - view.SL) * view.SZ;

/** 世界坐标 → 屏幕像素 Y（Y 轴向上） */
export const sy = (y: number): number => VH - (y - view.SB) * view.SZ;

/** 更新相机（每帧在 render 中调用） */
export function updateCamera(
  dt: number,
  p: PlayerState,
  gs: GameState,
  mapW: number,
  mapH: number,
): void {
  // 速度前瞻 + 垂直偏移
  const tx = p.x + clamp(p.velocity.x * 0.45, -7, 7);
  const ty = p.y + 2.3 + clamp(p.velocity.y * 0.14, -3.5, 3.5);
  cam.x = lerp(cam.x, tx, 1 - Math.exp(-5.5 * dt));
  cam.y = lerp(cam.y, ty, 1 - Math.exp(-4.5 * dt));
  // 冲刺缩放
  const zt = (p.sprint && !p.dead) ? 0.92 : 1;
  view.zoom = lerp(view.zoom, zt, 1 - Math.exp(-4 * dt));
  // 震屏 / 闪光衰减
  gs.shake *= Math.exp(-5 * dt);
  gs.flash = Math.max(0, gs.flash - dt * 1.8);
  // 视口范围
  const vw = VW / (PPM * view.zoom);
  const vh = VH / (PPM * view.zoom);
  // 地图某维小于视口时：clamp(cam, 半视口, map-半视口) 会 a>b 退化，导致
  // 相机在两端逐帧交替（顶部/右缘重影）。此时改为固定在图中点（居中显示）。
  cam.x = vw >= mapW ? mapW / 2 : clamp(cam.x, vw / 2, mapW - vw / 2);
  cam.y = vh >= mapH ? mapH / 2 : clamp(cam.y, vh / 2, mapH - vh / 2);
  view.SZ = PPM * view.zoom;
  view.SL = cam.x - vw / 2 + (Math.random() - 0.5) * gs.shake * 0.5;
  view.SB = cam.y - vh / 2 + (Math.random() - 0.5) * gs.shake * 0.5;
}