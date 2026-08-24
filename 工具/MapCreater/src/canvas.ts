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

/**
 * 调整画布尺寸以匹配父容器。
 *
 * 同时写入 位图尺寸（cv.width/height × DPR）与 CSS 盒尺寸（cv.style.width/height），
 * 并同步逻辑尺寸 VW/VH。三者恒等（CSS 盒 = VW/VH = 位图/DPR）是 `mouseXY`
 * 点击坐标与渲染坐标严格 1:1 对齐的前提 —— 任何一处失控（如仅凭样式表
 * `width:100%;height:100%` 让替换元素按固有宽高比自缩放，或窗口尺寸竞态），
 * 都会造成 X/Y 两个方向比例不同的点击偏移（点不上、要点上方/侧方才中）。
 */
export function resizeCanvas(): void {
  const container = cv.parentElement!;
  const w = container.clientWidth;
  const h = container.clientHeight;
  DPR = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(w * DPR);
  cv.height = Math.round(h * DPR);
  // 强制 CSS 盒 = 逻辑盒（覆盖 #viewport canvas 的 100%/100% 规则），杜绝宽高比自适配
  cv.style.width = w + 'px';
  cv.style.height = h + 'px';
  VW = w;
  VH = h;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();