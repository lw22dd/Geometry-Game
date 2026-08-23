/**
 * 按钮组件 —— UIWidget 实现。
 * 三种变体（variant）：
 *   primary — 霓虹流光（菜单"开始游戏"风格）
 *   plain   — 简洁面板（暂停/大厅按钮风格）
 *   icon    — 圆形图标按钮（关闭 × 等）
 */
import { ctx, VW, VH } from '../canvas';
import { rr } from '../math';
import type { UIWidget } from './types';

export interface ButtonOpts {
  id: string;
  label: string;
  /** 按钮下方小字提示（如 ENTER ⏎） */
  subLabel?: string;
  variant?: 'primary' | 'plain' | 'icon';
  x: number;
  y: number;
  w: number;
  h: number;
  onClick?: () => void;
  onKey?: (e: KeyboardEvent) => boolean;
  /** 入场延迟（秒），-1 表示无入场动画 */
  enterDelay?: number;
}

export class Button implements UIWidget {
  readonly id: string;
  visible = true;
  hover = false;
  focusable = false;
  focused = false;
  onClick?: () => void;
  onKey?: (e: KeyboardEvent) => boolean;

  label: string;
  subLabel?: string;
  private variant: 'primary' | 'plain' | 'icon';
  x: number;
  y: number;
  w: number;
  h: number;
  private enterDelay: number;

  constructor(opts: ButtonOpts) {
    this.id = opts.id;
    this.label = opts.label;
    this.subLabel = opts.subLabel;
    this.variant = opts.variant ?? 'plain';
    this.x = opts.x;
    this.y = opts.y;
    this.w = opts.w;
    this.h = opts.h;
    this.onClick = opts.onClick;
    this.onKey = opts.onKey;
    this.enterDelay = opts.enterDelay ?? -1;
  }

  hit(lx: number, ly: number): boolean {
    return lx >= this.x && lx <= this.x + this.w &&
           ly >= this.y && ly <= this.y + this.h;
  }

  draw(t: number): void {
    const en = this.enterDelay < 0
      ? 1
      : this._ease((t - this.enterDelay) / 0.55);
    if (en <= 0) return;

    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    const scale = 1 + (this.hover ? 0.03 : 0);

    ctx.save();
    ctx.globalAlpha = Math.min(1, en);

    if (this.enterDelay >= 0) {
      ctx.translate(0, (1 - en) * 16);
    }

    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    if (this.variant === 'primary') {
      this._drawPrimary(ctx, t);
    } else if (this.variant === 'icon') {
      this._drawIcon(ctx);
    } else {
      this._drawPlain(ctx);
    }

    ctx.restore();
  }

  private _drawPrimary(ctx2: CanvasRenderingContext2D, t: number): void {
    const { x, y, w, h } = this;
    const pulse = 0.7 + 0.3 * Math.sin(t * 3);
    const hover = this.hover;

    ctx2.shadowColor = hover ? 'rgba(140,230,255,.9)' : 'rgba(100,180,255,' + (0.3 + 0.5 * pulse) + ')';
    ctx2.shadowBlur = hover ? 36 : 22;
    const g = ctx2.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(46,26,110,.95)');
    g.addColorStop(.5, 'rgba(22,12,60,.95)');
    g.addColorStop(1, 'rgba(14,8,40,.98)');
    rr(ctx2, x, y, w, h, 14);
    ctx2.fillStyle = g;
    ctx2.fill();
    ctx2.shadowBlur = 0;

    ctx2.strokeStyle = 'hsla(197,100%,' + (66 + 12 * pulse) + '%,' + (.75 + .25 * pulse) + ')';
    ctx2.lineWidth = 2;
    ctx2.stroke();
    rr(ctx2, x + 3, y + 3, w - 6, h - 6, 11);
    ctx2.strokeStyle = 'rgba(160,220,255,.25)';
    ctx2.lineWidth = 1;
    ctx2.stroke();
    const g2 = ctx2.createLinearGradient(0, y + 3, 0, y + 16);
    g2.addColorStop(0, 'rgba(180,230,255,.28)');
    g2.addColorStop(1, 'rgba(180,230,255,0)');
    rr(ctx2, x + 6, y + 4, w - 12, 12, 8);
    ctx2.fillStyle = g2;
    ctx2.fill();

    // 流光
    const q = (t % 2.8) / 2.8;
    if (q < 0.5) {
      const u = q / 0.5;
      const sx = x - 70 + u * (w + 140);
      ctx2.save();
      rr(ctx2, x, y, w, h, 14);
      ctx2.clip();
      const sg = ctx2.createLinearGradient(sx - 36, 0, sx + 36, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)');
      sg.addColorStop(.5, 'rgba(200,240,255,.16)');
      sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx2.fillStyle = sg;
      ctx2.fillRect(sx - 36, y, 72, h);
      ctx2.restore();
    }

    ctx2.textAlign = 'center';
    ctx2.textBaseline = 'middle';
    ctx2.font = '800 24px "Segoe UI","Microsoft YaHei",Arial';
    ctx2.shadowColor = 'rgba(140,200,255,.8)';
    ctx2.shadowBlur = 12;
    ctx2.fillStyle = '#f2fbff';
    ctx2.fillText(this.label, x + w / 2, y + h / 2 - 4);
    ctx2.shadowBlur = 0;
    if (this.subLabel) {
      ctx2.font = '600 11px "Segoe UI",Arial';
      ctx2.fillStyle = 'rgba(150,200,255,.55)';
      ctx2.fillText(this.subLabel, x + w / 2, y + h - 11);
    }
  }

  private _drawPlain(ctx2: CanvasRenderingContext2D): void {
    const { x, y, w, h } = this;
    const hover = this.hover;

    ctx2.shadowColor = hover ? 'rgba(140,200,255,.5)' : 'rgba(80,60,200,.2)';
    ctx2.shadowBlur = hover ? 20 : 10;
    rr(ctx2, x, y, w, h, 10);
    ctx2.fillStyle = hover ? 'rgba(30,20,70,.8)' : 'rgba(16,12,40,.6)';
    ctx2.fill();
    ctx2.shadowBlur = 0;
    ctx2.strokeStyle = hover ? 'rgba(140,200,255,.6)' : 'rgba(130,160,255,.3)';
    ctx2.lineWidth = 1.5;
    ctx2.stroke();

    ctx2.textAlign = 'center';
    ctx2.textBaseline = 'middle';
    ctx2.font = '600 18px "Segoe UI","Microsoft YaHei",Arial';
    ctx2.fillStyle = hover ? '#f2fbff' : '#bfe9ff';
    ctx2.fillText(this.label, x + w / 2, y + h / 2 + 1);
  }

  /** 圆形图标按钮（关闭 × 等） */
  private _drawIcon(ctx2: CanvasRenderingContext2D): void {
    const { x, y, w, h } = this;
    const hover = this.hover;
    const cx = x + w / 2, cy = y + h / 2;
    const r = Math.min(w, h) / 2;

    const scale = hover ? 1.1 : 1;
    ctx2.save();
    ctx2.translate(cx, cy);
    ctx2.scale(scale, scale);
    ctx2.translate(-cx, -cy);

    // 圆形底 + 描边
    ctx2.shadowColor = hover ? 'rgba(255,120,170,.6)' : 'rgba(120,90,220,.25)';
    ctx2.shadowBlur = hover ? 18 : 8;
    ctx2.fillStyle = hover ? 'rgba(48,20,60,.85)' : 'rgba(16,12,40,.6)';
    ctx2.beginPath();
    ctx2.arc(cx, cy, r, 0, 6.283);
    ctx2.fill();
    ctx2.shadowBlur = 0;
    ctx2.strokeStyle = hover ? 'rgba(255,140,190,.7)' : 'rgba(140,150,255,.35)';
    ctx2.lineWidth = 1.5;
    ctx2.stroke();

    // ✕ 图标（两条线，比字体更精致）
    const s = r * 0.42;
    ctx2.strokeStyle = hover ? '#ffd0e6' : '#c8d2ff';
    ctx2.lineWidth = 2;
    ctx2.lineCap = 'round';
    ctx2.beginPath();
    ctx2.moveTo(cx - s, cy - s);
    ctx2.lineTo(cx + s, cy + s);
    ctx2.moveTo(cx + s, cy - s);
    ctx2.lineTo(cx - s, cy + s);
    ctx2.stroke();

    ctx2.restore();
  }

  private _ease(t: number): number {
    return 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
  }
}