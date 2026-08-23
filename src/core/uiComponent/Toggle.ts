/**
 * 开关组件 —— Toggle（Switch）实现 UIWidget。
 * 开关条 + 滑块，hover 高亮，点击切换。
 */
import { ctx } from '../canvas';
import { rr } from '../math';
import type { UIWidget } from './types';

export interface ToggleOpts {
  id: string;
  label: string;
  checked?: boolean;
  x: number;
  y: number;
  /** 行宽（含标签 + 开关） */
  w: number;
  /** 行高 */
  h: number;
  onChange?: (checked: boolean) => void;
}

export class Toggle implements UIWidget {
  readonly id: string;
  visible = true;
  hover = false;
  focusable = false;
  focused = false;
  onClick?: () => void;
  onKey?: (e: KeyboardEvent) => boolean;

  label: string;
  checked: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  private onChange?: (checked: boolean) => void;

  constructor(opts: ToggleOpts) {
    this.id = opts.id;
    this.label = opts.label;
    this.checked = opts.checked ?? false;
    this.x = opts.x;
    this.y = opts.y;
    this.w = opts.w;
    this.h = opts.h;
    this.onChange = opts.onChange;
    this.onClick = () => {
      this.checked = !this.checked;
      this.onChange?.(this.checked);
    };
  }

  hit(lx: number, ly: number): boolean {
    return lx >= this.x && lx <= this.x + this.w &&
           ly >= this.y && ly <= this.y + this.h;
  }

  draw(_t: number): void {
    const gap = 12;
    const switchW = 46, switchH = 24;
    const sx = this.x + this.w - switchW;
    const sy = this.y + (this.h - switchH) / 2;

    // 标签
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '600 17px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = this.hover ? '#f2fbff' : '#d7e6ff';
    ctx.fillText(this.label, this.x, this.y + this.h / 2 + 1);

    // 开关轨道
    ctx.save();
    ctx.shadowColor = this.hover ? 'rgba(140,220,255,.4)' : 'rgba(0,0,0,0)';
    ctx.shadowBlur = this.hover ? 8 : 0;
    rr(ctx, sx, sy, switchW, switchH, switchH / 2);
    ctx.fillStyle = this.checked ? 'rgba(60,80,150,.9)' : 'rgba(14,10,38,.85)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = this.checked
      ? 'rgba(125,249,255,.75)'
      : this.hover
        ? 'rgba(140,170,255,.5)'
        : 'rgba(120,140,220,.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 滑块
    const knobR = (switchH - 6) / 2;
    const kx = this.checked ? sx + switchW - knobR - 3 : sx + knobR + 3;
    const ky = sy + switchH / 2;
    ctx.shadowColor = this.checked ? '#7df9ff' : 'rgba(0,0,0,0)';
    ctx.shadowBlur = this.checked ? 8 : 0;
    ctx.fillStyle = this.checked ? '#eaffff' : '#8a96cc';
    ctx.beginPath();
    ctx.arc(kx, ky, knobR, 0, 6.283);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    void gap;
  }
}