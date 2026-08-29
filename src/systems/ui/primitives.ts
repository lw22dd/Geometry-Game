/**
 * UI 基础绘制原语 —— 问题 13：消灭 UI 层的重复样板。
 * 玻璃面板 / 半透明遮罩 / 标题排版 / 返回按钮 / 入场计时 / hover 复位。
 * 纯加法模块；各场景文件逐个灰度替换。
 */
import { ctx, VW, VH } from '../../core/canvas';
import { rr } from '../../core/math';
import { Button } from '../../core/uiComponent';
import type { UIWidget } from '../../core/uiComponent';
import { F } from './theme';

/** 缓出（入场动画统一缓动；等价于各文件局部的 _ease 副本） */
export const ease = (t: number): number => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** 本地动画计时器：performance.now 增量（上限 50ms/帧防切后台跳秒）。返回累计秒数。 */
export function tickLocal(s: { t: number; last: number }): number {
  const nowMs = performance.now();
  if (s.last) s.t += Math.min(0.05, (nowMs - s.last) / 1000);
  s.last = nowMs;
  return s.t;
}

/** 全屏半透明遮罩（面板底下的压暗层） */
export function drawMask(alpha: number): void {
  ctx.fillStyle = 'rgba(5,3,16,' + alpha + ')';
  ctx.fillRect(0, 0, VW, VH);
}

export interface GlassPanelOpts {
  /** 顶部高光条（默认 false） */
  highlight?: boolean;
  /** 面板填充（默认 'rgba(10,8,32,.92)'） */
  fill?: string;
  /** 描边（默认 'rgba(130,160,255,.45)'） */
  stroke?: string;
  /** 阴影颜色透明度（默认 .45） */
  shadowAlpha?: number;
  /** 阴影模糊半径（默认 34） */
  shadowBlur?: number;
}

/** 玻璃面板：阴影 + 深色圆角底 + 描边 +（可选）顶部高光条 */
export function drawGlassPanel(
  x: number, y: number, w: number, h: number, r: number, o: GlassPanelOpts = {},
): void {
  ctx.save();
  ctx.shadowColor = 'rgba(80,60,200,' + (o.shadowAlpha ?? 0.45) + ')';
  ctx.shadowBlur = o.shadowBlur ?? 34;
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = o.fill ?? 'rgba(10,8,32,.92)';
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = o.stroke ?? 'rgba(130,160,255,.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (o.highlight) {
    const hg = ctx.createLinearGradient(0, y, 0, y + 20);
    hg.addColorStop(0, 'rgba(150,200,255,.12)');
    hg.addColorStop(1, 'rgba(150,200,255,0)');
    rr(ctx, x + 2, y + 2, w - 4, 18, r - 2);
    ctx.fillStyle = hg;
    ctx.fill();
  }
  ctx.restore();
}

/** 居中主标题排版（与各场景标题统一：700 字重 + 标题青） */
export function drawTitle(text: string, y: number, fontSize = 26, color = '#bfe9ff'): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 ' + fontSize + 'px ' + F.UI;
  ctx.fillStyle = color;
  ctx.fillText(text, VW / 2, y);
}

/** 返回按钮（'← 返回' 样式的 plain Button） */
export function makeBackButton(
  id: string,
  onClick: () => void,
  o: { label?: string; x?: number; y?: number; w?: number; h?: number } = {},
): Button {
  return new Button({
    id,
    label: o.label ?? '← 返回',
    variant: 'plain',
    x: o.x ?? 24,
    y: o.y ?? 20,
    w: o.w ?? 100,
    h: o.h ?? 36,
    onClick,
  });
}

/** hover 复位 + 光标恢复（onExit 样板） */
export function resetHover(...widgets: UIWidget[]): void {
  for (const w of widgets) w.hover = false;
  const c = ctx.canvas;
  if (c) c.style.cursor = 'default';
}
