/**
 * 渲染管线 —— 后期特效（最后一层，主场景全部画完后调用一次）。
 * 泛光（阈值化亮部提取）→ 径向模糊 → 分区调色 → 暗角 → 扫描线 → 颗粒。
 *
 * 参数真源：config/visuals 的 VIS.postfx（本文件的 PFX 与其**同一对象引用**，
 * 画质档位切换是原地改字段，任何地方都不得整体替换该对象）。
 * pattern 惰性构建缓存；ctx.filter 不支持时自动降级；含自适应降级开关（仅 auto 档生效）。
 */
import { ctx, VW, VH, DPR } from '../core/canvas';
import { VIS, applyQuality } from '../config';
import { Settings } from '../core/settings';

/** 后期特效参数（= VIS.postfx 引用） */
export const PFX = VIS.postfx;

// 画质档位应用：设置变更（含启动 load）经 Settings 通知本模块原地写回 VIS。
// subscribe 立即推送一次当前值，覆盖「load 早于本模块导入」的时序。
Settings.subscribe((d) => applyQuality(d.quality));

/** 单帧后期输入（由 game/index 渲染时提供） */
export interface PostFXFrame {
  /** 速度归一化 0..1（驱动径向模糊强度） */
  speed?: number;
  /** 分区调色主色（'r,g,b' 字符串，取自地图主题）；不传则跳过调色 */
  tint?: string;
}

const FILTER_OK = typeof ctx.filter === 'string';

/** 泛光离屏画布（尺寸随主画布自适应） */
const bloomCv = document.createElement('canvas');
const bloomCtx = bloomCv.getContext('2d')!;

/** 径向模糊离屏画布（半分辨率，本就模糊无需全分辨率） */
const radialCv = document.createElement('canvas');
const radialCtx = radialCv.getContext('2d')!;

/** 扫描线 / 颗粒 / 调色 pattern 与渐变（惰性构建，零每帧分配） */
let scanPat: CanvasPattern | null = null;
let grainPat: CanvasPattern | null = null;
let tintGrad: CanvasGradient | null = null;
let tintKey = '';

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

/** 分区调色渐变（按 尺寸 + 颜色 + 强度 缓存，避免每帧重建） */
function ensureTint(rgb: string): CanvasGradient | null {
  const key = VW + 'x' + VH + '@' + DPR + '|' + rgb + '|' + PFX.tintA.toFixed(2);
  if (tintGrad && tintKey === key) return tintGrad;
  tintKey = key;
  const g = ctx.createLinearGradient(0, 0, VW * 0.35, VH);
  g.addColorStop(0, 'rgba(' + rgb + ',.55)');
  g.addColorStop(0.5, 'rgba(90,60,190,.25)');
  g.addColorStop(1, 'rgba(10,4,32,.5)');
  tintGrad = g;
  return g;
}

/** ① 径向模糊 —— 以画面中心为锚多次递减缩放叠加，制造高速冲刺的拉伸感 */
function drawRadial(speed: number): void {
  const amt = Math.min(PFX.radialMax, Math.max(0, speed) * PFX.radialMax);
  if (amt < 0.03) return;
  const rw = Math.max(1, (VW * 0.5) | 0);
  const rh = Math.max(1, (VH * 0.5) | 0);
  if (radialCv.width !== rw || radialCv.height !== rh) { radialCv.width = rw; radialCv.height = rh; }
  radialCtx.clearRect(0, 0, rw, rh);
  radialCtx.drawImage(ctx.canvas, 0, 0, rw, rh);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const steps = 4;
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    const s = 1 + amt * k * 0.05;
    ctx.globalAlpha = amt * 0.10 * (1 - k * 0.5);
    ctx.drawImage(radialCv, (VW - VW * s) / 2, (VH - VH * s) / 2, VW * s, VH * s);
  }
  ctx.restore();
}

/**
 * ② 泛光 —— 降采样 → 阈值化亮部提取（自乘 gamma 曲线压暗中间调，
 * 阈值越高自乘次数越多、暗部压制越狠）→ 模糊 → lighter 叠回 + 色散残影
 */
function drawBloom(): void {
  const bw = Math.max(1, (VW * PFX.bloomScale) | 0);
  const bh = Math.max(1, (VH * PFX.bloomScale) | 0);
  if (bloomCv.width !== bw || bloomCv.height !== bh) { bloomCv.width = bw; bloomCv.height = bh; }
  bloomCtx.globalCompositeOperation = 'source-over';
  bloomCtx.clearRect(0, 0, bw, bh);
  bloomCtx.drawImage(ctx.canvas, 0, 0, bw, bh);
  // 阈值化：自乘（gamma 2 / gamma 4）→ 中间调与暗部快速趋零，只留亮部
  bloomCtx.globalCompositeOperation = 'multiply';
  const passes = PFX.bloomThreshold > 0.45 ? 2 : 1;
  for (let i = 0; i < passes; i++) bloomCtx.drawImage(bloomCv, 0, 0);
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

/** ③ 分区调色 / 色调映射 —— overlay 叠一层地图主题渐变，统一画面调子 */
function drawTint(rgb: string): void {
  const g = ensureTint(rgb);
  if (!g) return;
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = PFX.tintA;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VW, VH);
  ctx.restore();
}

/**
 * 主后期入口 —— 由 game/index 在世界层与 HUD 全部绘制完成后调用一次。
 * 总开关关闭时零开销直接返回（低配 / 用户手动关闭）。
 */
export function drawPostFX(frame: PostFXFrame = {}): void {
  if (!Settings.data.postfxOn) return;
  ensurePatterns();

  if (PFX.radialOn) drawRadial(frame.speed ?? 0);
  if (PFX.bloomOn) drawBloom();
  if (PFX.tintOn && frame.tint) drawTint(frame.tint);

  // ④ 暗角（聚焦画面中心）
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
  // ⑤ CRT 扫描线
  if (PFX.scanOn && scanPat) {
    ctx.fillStyle = scanPat;
    ctx.fillRect(0, 0, VW, VH);
  }
  // ⑥ 胶片颗粒（每帧随机偏移 → "活"的噪点）
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

/**
 * 自适应降级：传入每帧毫秒数，帧率不足时逐步关闭重特效。
 * 仅在画质档位为 'auto' 时生效 —— 手动档位尊重用户选择，不被覆盖；
 * 帧率回落后自动恢复基线（原有实现一旦降级不会回升）。
 */
let ftAvg = 16;
let downgraded = false;
export function pfxPerf(dtMs: number): void {
  if (Settings.data.quality !== 'auto') {
    downgraded = false;
    return;
  }
  ftAvg = ftAvg * 0.95 + dtMs * 0.05;
  if (ftAvg > 30) {
    downgraded = true;
    PFX.chromaOn = false;
    PFX.radialOn = false;
    PFX.grainOn = false;
    PFX.bloomScale = 0.18;
  } else if (ftAvg > 22) {
    downgraded = true;
    PFX.chromaOn = false;
    PFX.radialOn = false;
    PFX.bloomScale = 0.18;
  } else if (ftAvg < 17 && downgraded) {
    downgraded = false;
    applyQuality('auto'); // 恢复 high 基线（原地写字段，引用不变）
  }
}
