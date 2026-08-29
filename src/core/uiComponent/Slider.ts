/**
 * 滑块组件 —— 音量 / 强度等连续量调节，实现 UIWidget。
 *
 * 交互：点击轨道直接定位并进入拖拽 → 移动持续跟随 → 鼠标抬起结束拖拽。
 * 依赖 UIManager 的三路分发：handleClick（带坐标）/ handleMove（拖拽中回调 onDrag）/
 * handleRelease（全局 mouseup 结束拖拽），三者均由 core/uiComponent 底座提供。
 */
import { ctx } from '../canvas';
import { rr } from '../math';
import type { UIWidget } from './types';

export interface SliderOpts {
  id: string;
  label: string;
  x: number;
  y: number;
  /** 整行宽（含左侧标签） */
  w: number;
  h: number;
  /** 初值 0..1 */
  value?: number;
  /** 数值显示格式化（默认百分比） */
  format?: (v: number) => string;
  onChange?: (v: number) => void;
}

/** 标签区宽度（轨道从此处开始） */
const LABEL_W = 118;
/** 数值区宽度（轨道到此处结束） */
const VALUE_W = 54;

export class Slider implements UIWidget {
  readonly id: string;
  visible = true;
  hover = false;
  focusable = false;
  focused = false;
  /** 拖拽中（由 UIManager 的 handleMove / handleRelease 协作） */
  dragging = false;

  label: string;
  value: number;
  x: number;
  y: number;
  w: number;
  h: number;

  onPress?: (lx: number, ly: number) => void;
  onClick?: (lx?: number, ly?: number) => void;
  onDrag?: (lx: number, ly: number) => void;
  onRelease?: () => void;

  private onChange?: (v: number) => void;
  private format: (v: number) => string;
  /** 上一次提交的值（避免拖拽中同值重复回调） */
  private lastEmit: number;

  constructor(opts: SliderOpts) {
    this.id = opts.id;
    this.label = opts.label;
    this.x = opts.x;
    this.y = opts.y;
    this.w = opts.w;
    this.h = opts.h;
    this.value = Math.max(0, Math.min(1, opts.value ?? 0.5));
    this.lastEmit = this.value;
    this.onChange = opts.onChange;
    this.format = opts.format ?? ((v: number) => Math.round(v * 100) + '%');

    // 按下（mousedown）即定位并开始拖拽 —— 必须早于 mouseup，否则拖拽状态会残留
    this.onPress = (lx) => {
      this.setFromX(lx);
      this.dragging = true;
    };
    this.onDrag = (lx) => {
      if (this.dragging) this.setFromX(lx);
    };
    this.onRelease = () => {
      this.dragging = false;
    };
    // 兜底：没有 mousedown 通路时，单纯点击轨道也能定位（不进入拖拽）
    this.onClick = (lx) => {
      if (lx === undefined || this.dragging) return;
      this.setFromX(lx);
    };
  }

  /** 轨道几何（标签之后、数值之前） */
  private get trackX(): number {
    return this.x + LABEL_W;
  }

  private get trackW(): number {
    return Math.max(20, this.w - LABEL_W - VALUE_W);
  }

  /** 按屏幕 X 定位取值（轨道两端内 clamp） */
  private setFromX(lx: number): void {
    const t = (lx - this.trackX) / this.trackW;
    this.setValue(t < 0 ? 0 : t > 1 ? 1 : t);
  }

  /** 写入取值（外部同步设置面板状态用；变化时才回调） */
  setValue(v: number): void {
    const nv = v < 0 ? 0 : v > 1 ? 1 : v;
    this.value = nv;
    if (Math.abs(nv - this.lastEmit) > 0.001) {
      this.lastEmit = nv;
      this.onChange?.(nv);
    }
  }

  hit(lx: number, ly: number): boolean {
    // 命中范围比轨道略高一点，便于点击/拖拽
    return lx >= this.trackX - 8 && lx <= this.trackX + this.trackW + 8
        && ly >= this.y - 8 && ly <= this.y + this.h + 8;
  }

  draw(_t: number): void {
    const tx = this.trackX;
    const tw = this.trackW;
    const th = 6;
    const ty = this.y + (this.h - th) / 2;
    const active = this.hover || this.dragging;

    // 标签
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '600 17px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = active ? '#f2fbff' : '#d7e6ff';
    ctx.fillText(this.label, this.x, this.y + this.h / 2 + 1);

    // 轨道底
    ctx.save();
    ctx.shadowColor = active ? 'rgba(140,220,255,.35)' : 'rgba(0,0,0,0)';
    ctx.shadowBlur = active ? 8 : 0;
    rr(ctx, tx, ty, tw, th, th / 2);
    ctx.fillStyle = 'rgba(14,10,38,.85)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = active ? 'rgba(140,170,255,.5)' : 'rgba(120,140,220,.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 已填充段
    const fw = Math.max(0, tw * this.value);
    if (fw > 1) {
      rr(ctx, tx, ty, fw, th, th / 2);
      const fg = ctx.createLinearGradient(tx, 0, tx + tw, 0);
      fg.addColorStop(0, 'rgba(125,249,255,.9)');
      fg.addColorStop(1, 'rgba(160,140,255,.9)');
      ctx.fillStyle = fg;
      ctx.fill();
    }

    // 滑块
    const kr = this.dragging ? 8.5 : 7.5;
    const kx = tx + fw;
    const ky = ty + th / 2;
    ctx.shadowColor = '#7df9ff';
    ctx.shadowBlur = active ? 12 : 6;
    ctx.fillStyle = '#eaffff';
    ctx.beginPath();
    ctx.arc(kx, ky, kr, 0, 6.283);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // 数值
    ctx.textAlign = 'right';
    ctx.font = '600 15px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = active ? '#eaffff' : '#9fb4e8';
    ctx.fillText(this.format(this.value), this.x + this.w, this.y + this.h / 2 + 1);
    ctx.textAlign = 'left';
  }
}
