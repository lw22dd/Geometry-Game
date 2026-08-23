/**
 * 数学 / RNG / 绘制工具 —— 无业务逻辑底座。
 * 只依赖 types（无）。
 */

/** 夹取到 [a,b] */
export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

/** 线性插值 */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** mulberry32 可种子 RNG（返回 [0,1) 生成函数） */
export function mulberry(a: number): () => number {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 圆角矩形路径（依赖调用方 ctx） */
export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 秒 → m:ss.s 格式化 */
export function fmt(t: number): string {
  const m = Math.floor(t / 60), s = t - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
}