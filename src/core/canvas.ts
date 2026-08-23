/**
 * Canvas 挂载与 DPR 缩放。
 * 逻辑分辨率固定 1280×720，物理像素按 devicePixelRatio 缩放（上限 2）。
 */
export const cv = document.getElementById('c') as HTMLCanvasElement;
export const ctx = cv.getContext('2d')!;
export const VW = 1280; // 逻辑宽
export const VH = 720; // 逻辑高
export const PPM = 48; // 世界米 → 像素（pixels per meter）

export let DPR = 1;

/** 按窗口大小等比缩放画布（保持 16:9） */
export function resize(): void {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  cv.width = VW * DPR;
  cv.height = VH * DPR;
  const s = Math.min(innerWidth / VW, innerHeight / VH) * 0.98;
  cv.style.width = VW * s + 'px';
  cv.style.height = VH * s + 'px';
}

addEventListener('resize', resize);
resize();