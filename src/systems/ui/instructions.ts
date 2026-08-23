/**
 * 操作说明弹窗 —— 封面操作说明卡迁移至此。
 * 入口：菜单场景"🕹️ 操作说明"按钮。
 * 内容：键位说明（移动/跳跃/加速/物理/交互），返回按钮关闭。
 */
import { ctx, VW, VH } from '../../core/canvas';
import { rr } from '../../core/math';
import { Button, UI_SCENE } from '../../core/uiComponent';
import type { UIScene } from '../../core/uiComponent';

/* ==================== 弹窗状态 ==================== */

export const instructions = {
  open: false,
};

export function openInstructions(): void { instructions.open = true; }
export function closeInstructions(): void { instructions.open = false; }

/* ---------- 弹窗动画计时 ---------- */
let _instrT = 0;
let _instrLast = 0;

/* ==================== 键帽绘制（与旧菜单卡片同款） ==================== */

function _keycap(x: number, cy: number, label: string): number {
  ctx.font = '700 13px "Segoe UI",Arial';
  const tw = ctx.measureText(label).width;
  const w = tw + 18, h = 24, y = cy - h / 2;
  rr(ctx, x, y, w, h, 6);
  ctx.fillStyle = 'rgba(16,12,42,.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,190,255,.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = 'rgba(160,210,255,.14)';
  ctx.fillRect(x + 3, y + 2, w - 6, 3);          // 顶部高光
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.fillRect(x + 3, y + h - 3, w - 6, 2);      // 底部阴影
  ctx.fillStyle = '#dff4ff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, cy + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  return w;
}

function _keyRow(x: number, cy: number, label: string): void {
  const parts = label.split('/');
  let cx = x;
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) {
      ctx.font = '600 13px Arial';
      ctx.fillStyle = 'rgba(150,170,220,.75)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('/', cx + 7, cy + 1);
      cx += 16;
    }
    cx += _keycap(cx, cy, parts[i].trim()) + 8;
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/* ==================== 场景构建 ==================== */

const ROWS: [string, string][] = [
  ['A / D', '左右移动 · 7 m/s（SHIFT 加速 12）'],
  ['SPACE', '跳跃 · 长按约 3.2 格 / 轻点约 1 格'],
  ['SHIFT', '加速冲刺 · 霓虹曳光'],
  ['P', '切换 手感优化 / 经典物理（g=10）'],
  ['R / M', '返回出生点 / 音效开关'],
  ['ESC', '暂停 / 继续'],
  ['ENTER', '开始游戏'],
];

export interface InstructionsActions {
  onBack: () => void;
}

/** 构建操作说明弹窗场景 */
export function buildInstructionsScene(a: InstructionsActions): UIScene {
  const btnBack = new Button({
    id: 'instr_back',
    label: '← 返回',
    variant: 'plain',
    x: VW / 2 - 130, y: 0, w: 260, h: 46,
    onClick: a.onBack,
  });

  // 全部按键防盗：弹窗打开时消费所有按键（避免误触菜单的"任意键开始"）
  btnBack.onKey = (e: KeyboardEvent): boolean => {
    if (e.code === 'Escape') { a.onBack(); }
    return true;
  };

  function drawPanel(_t: number): void {
    // 本地动画计时（每次入场重播）
    const nowMs = performance.now();
    if (_instrLast) _instrT += Math.min(0.05, (nowMs - _instrLast) / 1000);
    _instrLast = nowMs;
    const tt = _instrT;

    // 入场动画
    const en = Math.min(1, tt / 0.3);
    if (en <= 0) return;
    const pw = 640, ph = 470;
    const px = VW / 2 - pw / 2, py = VH / 2 - ph / 2 + (1 - en) * 26;

    ctx.save();
    ctx.globalAlpha = en;

    // 半透明遮罩
    ctx.fillStyle = 'rgba(5,3,16,.8)';
    ctx.fillRect(0, 0, VW, VH);

    // 玻璃面板
    ctx.shadowColor = 'rgba(80,60,200,.45)';
    ctx.shadowBlur = 34;
    rr(ctx, px, py, pw, ph, 16);
    ctx.fillStyle = 'rgba(10,8,32,.9)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(130,160,255,.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const hg = ctx.createLinearGradient(0, py, 0, py + 20);
    hg.addColorStop(0, 'rgba(150,200,255,.12)');
    hg.addColorStop(1, 'rgba(150,200,255,0)');
    rr(ctx, px + 2, py + 2, pw - 4, 18, 14);
    ctx.fillStyle = hg;
    ctx.fill();

    // 左侧竖向荧光条
    ctx.fillStyle = 'rgba(140,246,255,.5)';
    ctx.fillRect(px + 26, py + 40, 2, ph - 74);

    // 标题
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 26px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = '#bfe9ff';
    ctx.fillText('🕹️ 操作说明', VW / 2, py + 46);

    // 键位行（逐行入场）
    ROWS.forEach((r, i) => {
      const re = _ease((tt - 0.18 - i * 0.06) / 0.35);
      if (re <= 0) return;
      const ry = py + 84 + i * 40;
      ctx.save();
      ctx.globalAlpha = en * re;
      ctx.translate((1 - re) * -16, 0);
      _keyRow(px + 48, ry, r[0]);
      ctx.font = '500 15px "Segoe UI","Microsoft YaHei",Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(205,220,255,.92)';
      ctx.fillText(r[1], px + 252, ry + 1);
      ctx.restore();
    });

    // 底部提示
    ctx.textAlign = 'center';
    ctx.font = '500 12px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = 'rgba(150,180,255,.45)';
    ctx.fillText('按 ESC 或「返回」关闭弹窗', VW / 2, py + ph - 22);

    ctx.restore();

    // 返回按钮定位
    btnBack.x = VW / 2 - 130;
    btnBack.y = py + ph - 84;
  }

  return {
    name: UI_SCENE.INSTRUCTIONS,
    widgets: [btnBack],
    draw: drawPanel,
    onEnter: () => {
      _instrT = 0;
      _instrLast = 0;
    },
    onExit: () => {
      btnBack.hover = false;
      const c = ctx.canvas;
      if (c) c.style.cursor = 'default';
    },
  };
}

const _ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);