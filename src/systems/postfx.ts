/**
 * 渲染管线 —— 后期特效（最后一层，主场景全部画完后调用一次）。
 * Bloom（1/4 分辨率离屏 + 自乘亮部提取）→ 色散 → 暗角 → 扫描线 → 颗粒。
 * pattern 惰性构建缓存；ctx.filter 不支持时自动降级；含自适应降级开关。
 */
import { ctx, VW, VH } from '../core/canvas';

export const PFX = {
  bloomOn: true,
  bloomScale: 0.22,     // 离屏分辨率比例
  bloomAlpha: 0.28,     // 泛光叠加强度（调低：整体画面偏亮）
  bloomBlur: 4,         // 模糊半径（离屏像素）
  chromaOn: true,       // 色散残影
  chromaShift: 1.2,     // 色散偏移 px
  vignetteOn: true,
  vignetteInner: 0.45,  // 暗角起始（短边比例）
  vignetteAlpha: 0.5,   // 暗角加深（压暗四周）
  scanOn: true,
  scanGap: 3,           // 扫描线间隔 px
  scanAlpha: 0.05,
  grainOn: true,
  grainAlpha: 0.03,
};

const FILTER_OK = typeof ctx.filter === 'string';

/** 泛光离屏画布（尺寸随主画布自适应） */
const bloomCv = document.createElement('canvas');
const bloomCtx = bloomCv.getContext('2d')!;

/** 扫描线 / 颗粒 pattern（惰性构建，零每帧分配） */
let scanPat: CanvasPattern | null = null;
let grainPat: CanvasPattern | null = null;

function ensurePatterns(): void {
  if (scanPat && grainPat) return;
  const s = document.createElement('canvas');
  s.width = 1; s.height = PFX.scanGap;
  const sc = s.getContext('2d')!;
  sc.fillStyle = 'rgba(0,0,0,' + PFX.scanAlpha + ')';
  sc.fillRect(0, 0, 1, 2);
  scanPat = ctx.createPattern(s, 'repeat');
  const n = document.createElement('canvas');
  n.width = n.height = 64;
  const nc = n.getContext('2d')!;
  const img = nc.createImageData(64, 64);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  nc.putImageData(img, 0, 0);
  grainPat = ctx.createPattern(n, 'repeat');
}

export function drawPostFX(): void {
  ensurePatterns();
  // ① 泛光：降采样 → 自乘提取亮部（平方曲线压暗中间调）→ 模糊 → lighter 叠回
  if (PFX.bloomOn) {
    const bw = Math.max(1, (VW * PFX.bloomScale) | 0);
    const bh = Math.max(1, (VH * PFX.bloomScale) | 0);
    if (bloomCv.width !== bw || bloomCv.height !== bh) { bloomCv.width = bw; bloomCv.height = bh; }
    bloomCtx.globalCompositeOperation = 'source-over';
    bloomCtx.clearRect(0, 0, bw, bh);
    bloomCtx.drawImage(ctx.canvas, 0, 0, bw, bh);
    bloomCtx.globalCompositeOperation = 'multiply';
    bloomCtx.drawImage(bloomCv, 0, 0);
    bloomCtx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = PFX.bloomAlpha;
    if (FILTER_OK) ctx.filter = 'blur(' + PFX.bloomBlur + 'px)';
    ctx.drawImage(bloomCv, 0, 0, VW, VH);
    if (PFX.chromaOn && FILTER_OK) {
      // 色散：色相偏移的左右残影（霓虹玻璃镜头感）
      ctx.globalAlpha = PFX.bloomAlpha * 0.3;
      ctx.filter = 'blur(' + PFX.bloomBlur + 'px) hue-rotate(22deg)';
      ctx.drawImage(bloomCv, PFX.chromaShift, 0, VW, VH);
      ctx.filter = 'blur(' + PFX.bloomBlur + 'px) hue-rotate(-22deg)';
      ctx.drawImage(bloomCv, -PFX.chromaShift, 0, VW, VH);
    }
    if (FILTER_OK) ctx.filter = 'none';
    ctx.restore();
  }
  // ② 暗角（聚焦画面中心）
  if (PFX.vignetteOn) {
    const g = ctx.createRadialGradient(
      VW / 2, VH / 2, Math.min(VW, VH) * PFX.vignetteInner,
      VW / 2, VH / 2, Math.max(VW, VH) * 0.72,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(5,2,18,' + PFX.vignetteAlpha + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
  }
  // ③ CRT 扫描线
  if (PFX.scanOn && scanPat) {
    ctx.fillStyle = scanPat;
    ctx.fillRect(0, 0, VW, VH);
  }
  // ④ 胶片颗粒（每帧随机偏移 → "活"的噪点）
  if (PFX.grainOn && grainPat) {
    ctx.save();
    ctx.globalAlpha = PFX.grainAlpha;
    ctx.globalCompositeOperation = 'overlay';
    ctx.translate(-((Math.random() * 64) | 0), -((Math.random() * 64) | 0));
    ctx.fillStyle = grainPat;
    ctx.fillRect(0, 0, VW + 64, VH + 64);
    ctx.restore();
  }
}

/** 自适应降级：传入每帧毫秒数，帧率不足时逐步关闭重特效 */
let ftAvg = 16;
export function pfxPerf(dtMs: number): void {
  ftAvg = ftAvg * 0.95 + dtMs * 0.05;
  if (ftAvg > 22) { PFX.chromaOn = false; PFX.bloomScale = 0.18; }
  if (ftAvg > 30) { PFX.grainOn = false; PFX.bloomOn = false; }
}
