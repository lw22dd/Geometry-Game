/**
 * 文本输入框组件 —— TextInput 实现 UIWidget。
 * 支持焦点、光标闪烁、hover 高亮。
 */
import { ctx } from '../canvas';
import { rr } from '../math';
import type { UIWidget } from './types';

export interface TextInputOpts {
  id: string;
  /** 字段标签（显示在输入框上方） */
  label: string;
  /** 初始值 */
  value?: string;
  /** 最大字符数 */
  maxLen?: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 字符/退格/Tab 同层切换：onKey 返回 true 表示消费 */
  onKey?: (e: KeyboardEvent) => boolean;
}

export class TextInput implements UIWidget {
  readonly id: string;
  visible = true;
  hover = false;
  focusable = true;
  focused = false;
  onClick?: () => void;
  onKey?: (e: KeyboardEvent) => boolean;

  label: string;
  value: string;
  maxLen: number;
  x: number;
  y: number;
  w: number;
  h: number;

  constructor(opts: TextInputOpts) {
    this.id = opts.id;
    this.label = opts.label;
    this.value = opts.value ?? '';
    this.maxLen = opts.maxLen ?? 15;
    this.x = opts.x;
    this.y = opts.y;
    this.w = opts.w;
    this.h = opts.h;
    this.onKey = opts.onKey ?? ((e) => this.defaultKey(e));
  }

  hit(lx: number, ly: number): boolean {
    return lx >= this.x && lx <= this.x + this.w &&
           ly >= this.y - this.h / 2 && ly <= this.y + this.h / 2;
  }

  draw(_t: number): void {
    const fy = this.y - this.h / 2;

    // 标签
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '600 13px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = 'rgba(180,200,255,.7)';
    ctx.fillText(this.label, this.x, this.y - this.h / 2 - 12);

    // 输入框
    ctx.save();
    ctx.shadowColor = this.focused ? 'rgba(140,200,255,.35)' : 'rgba(0,0,0,0)';
    ctx.shadowBlur = this.focused ? 10 : 0;
    rr(ctx, this.x, fy, this.w, this.h, 8);
    ctx.fillStyle = this.focused ? 'rgba(26,18,60,.85)' : 'rgba(16,12,42,.8)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = this.focused
      ? 'rgba(140,200,255,.65)'
      : this.hover
        ? 'rgba(130,160,255,.5)'
        : 'rgba(130,160,255,.25)';
    ctx.lineWidth = this.focused ? 1.8 : 1;
    ctx.stroke();

    // 光标闪烁
    const blink = Math.floor(performance.now() / 500) % 2 === 0;
    ctx.font = '500 16px "Consolas","Courier New",monospace';
    ctx.fillStyle = '#dff4ff';
    const text = this.value + (this.focused && blink ? '▌' : '');
    ctx.fillText(text, this.x + 14, this.y + 1);
    ctx.restore();
  }

  /** 默认字符输入（公开，供自定义 onKey 包装后调用） */
  defaultKey(e: KeyboardEvent): boolean {
    const single = e.key.length === 1;
    if (single || e.code === 'Backspace') {
      if (e.code === 'Backspace') {
        this.value = this.value.slice(0, -1);
      } else {
        if (this.value.length < this.maxLen) this.value += e.key;
      }
      return true;
    }
    return false;
  }
}