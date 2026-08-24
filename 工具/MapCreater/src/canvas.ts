/**
 * 编辑器画布 —— 挂载 Canvas 2D 上下文，管理 DPR 缩放。
 *
 * 与游戏侧 `core/canvas.ts` 接口兼容（PPM/VW/VH/ctx/DPR/resize），
 * 以便后续无缝接入游戏渲染函数。
 */
export const cv = document.getElementById('c') as HTMLCanvasElement;
export const ctx = cv.getContext('2d')!;

/** 世界格 → 像素（与游戏一致） */
export const PPM = 48;

/** 画布逻辑尺寸（像素），随容器大小变化 */
export let VW = 0;
export let VH = 0;

/** 设备像素比（上限 2） */
export let DPR = 1;

/** 调整画布尺寸以匹配父容器 */
export function resizeCanvas(): void {
  const container = cv.parentElement!;
  const w = container.clientWidth;
  const h = container.clientHeight;
  DPR = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(w * DPR);
  cv.height = Math.round(h * DPR);
  VW = w;
  VH = h;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();