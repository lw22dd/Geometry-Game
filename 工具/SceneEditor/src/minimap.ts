/**
 * 小地图 DOM —— 视口右下角悬浮预览（参考工具/code (2).html）。
 *
 * 固定逻辑尺寸 220×120（CSS），按 devicePixelRatio 缩放 backing store。
 * 每帧绘制：背景/地图边界/几何体/对象锚点/出生点/视口框；
 * 点击小地图任意位置 → 视口跳转到对应世界坐标（保持当前缩放）。
 */
import type { EditorStore } from './store';
import { view, centerOn } from './camera';
import { VW, VH } from './canvas';

/** 小地图逻辑尺寸（CSS 像素） */
const MW = 220;
const MH = 120;

let lastDpr = 1;

/** 获取小地图画布（惰性，避免模块加载时 DOM 未就绪） */
function minimapCanvas(): HTMLCanvasElement | null {
  return document.getElementById('minimap') as HTMLCanvasElement | null;
}

function prepareCanvas(cv: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(MW * dpr) || cv.height !== Math.round(MH * dpr) || dpr !== lastDpr) {
    cv.width = Math.round(MW * dpr);
    cv.height = Math.round(MH * dpr);
    lastDpr = dpr;
  }
  const ctx = cv.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/** 世界坐标 → 小地图坐标（Y 翻转：世界 Y 向上） */
function toMini(wx: number, wy: number, mapW: number, mapH: number): { x: number; y: number } {
  return { x: (wx / mapW) * MW, y: MH - (wy / mapH) * MH };
}

export function drawMinimap(store: EditorStore): void {
  const cv = minimapCanvas();
  if (!cv) return;
  const ctx = prepareCanvas(cv);
  const map = store.map;
  if (!map || map.width <= 0 || map.height <= 0) {
    ctx.clearRect(0, 0, MW, MH);
    return;
  }

  ctx.clearRect(0, 0, MW, MH);

  // 深色底
  ctx.fillStyle = 'rgba(10, 8, 32, 0.8)';
  ctx.fillRect(0, 0, MW, MH);

  // 地图边界
  ctx.strokeStyle = 'rgba(120, 90, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, MW, MH);

  // MVMap 底盘可行走区（区域色）优先绘制
  for (const c of map.layers.floorCells ?? []) {
    const p = toMini(c.x, c.y + c.h, map.width, map.height);
    const w = (c.w / map.width) * MW;
    const h = (c.h / map.height) * MH;
    if (w < 0.1 || h < 0.1) continue;
    ctx.fillStyle = c.color;
    ctx.globalAlpha = 0.75;
    ctx.fillRect(p.x, p.y, w, h);
    ctx.globalAlpha = 1;
  }

  // 几何体（墙 / 障碍）
  ctx.fillStyle = 'rgba(120, 90, 255, 0.7)';
  for (const g of map.layers.geometry) {
    if (g.type !== 'rect') continue;
    const p = toMini(g.x, g.y + g.h, map.width, map.height);
    const w = (g.w / map.width) * MW;
    const h = (g.h / map.height) * MH;
    if (w < 0.1 || h < 0.1) continue;
    ctx.fillRect(p.x, p.y, w, h);
  }

  // 对象锚点
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  for (const o of map.layers.objects) {
    const pos = instanceAnchor(o);
    const p = toMini(pos.x, pos.y, map.width, map.height);
    ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
  }

  // 出生点
  const sp = toMini(map.playerSpawn.x, map.playerSpawn.y, map.width, map.height);
  ctx.fillStyle = 'cyan';
  ctx.fillRect(sp.x - 2, sp.y - 2, 4, 4);

  // 视口框
  const left = view.SL;
  const right = view.SL + VW / view.SZ;
  const bottom = view.SB;
  const top = view.SB + VH / view.SZ;
  const vl = toMini(left, bottom, map.width, map.height);
  const vr = toMini(right, top, map.width, map.height);
  ctx.strokeStyle = 'rgba(143, 246, 255, 0.9)';
  ctx.lineWidth = 1;
  ctx.strokeRect(vl.x, vl.y, Math.max(0.5, vr.x - vl.x), Math.max(0.5, vr.y - vl.y));
}

/** 实例锚点（与 mapTypes.instancePosition 一致，避免额外 import 循环） */
function instanceAnchor(o: any): { x: number; y: number } {
  switch (o.type) {
    case 'mover': return { x: o.x0 ?? o.x, y: o.y };
    case 'laser': return { x: o.x, y: o.y0 ?? o.y };
    default: return { x: o.x, y: o.y };
  }
}

/* ==================== 点击跳转 ==================== */

export function bindMinimapClick(): void {
  const cv = minimapCanvas();
  if (!cv) return;
  cv.addEventListener('mousedown', (e: MouseEvent) => {
    const store = currentStore;
    if (!store || store.map.width <= 0 || store.map.height <= 0) return;
    const rect = cv.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    const wx = fx * store.map.width;
    const wy = (1 - fy) * store.map.height;
    // 保持当前缩放跳转
    centerOn(wx, wy, view.SZ / 48);
  });
}

let currentStore: EditorStore | null = null;
export function bindMinimapStore(store: EditorStore): void {
  currentStore = store;
}