/**
 * 模式选择场景 —— 创建联机房间时的玩法模式选择。
 * 仅「创建房间」路径进入；加入房间/单机 PVE 不经过此处（模式以房主为准）。
 *
 * 两种模式：
 *  - 普通模式（简单 PVE）：玩家协作收集道具武器、消灭敌人、破译全部密码机获胜。
 *  - 非对称对抗模式：1 名守关者（少方）布置敌人阻止，最多 4 名幸存者（多方）
 *    破译全部密码机求生；幸存者生命与复活耗尽则守关者获胜。
 */
import { ctx, VW, VH } from '../../core/canvas';
import { rr } from '../../core/math';
import type { GameModeKey } from '../../types';
import { UI_SCENE } from '../../core/uiComponent';
import type { UIWidget, UIScene } from '../../core/uiComponent';
import { drawBackdrop, drawHUDFrame, drawNeonTitle, drawDecoStar, ease } from '../uiAtmosphere';
import { tickLocal, drawGlassPanel, makeBackButton, resetHover } from './primitives';

/* ==================== 模式卡片 ==================== */

/** 模式描述数据 */
interface ModeMeta {
  key: GameModeKey;
  title: string;
  tag: string;
  desc: string[];
  accent: string;
  glow: string;
}

const MODE_META: ModeMeta[] = [
  {
    key: 'pve',
    title: '普通模式',
    tag: '简单 PVE',
    desc: [
      '玩家协作闯关：收集道具与武器，',
      '消灭敌人，破译全部密码机，',
      '抵达 NOVA 星取得胜利。',
    ],
    accent: 'rgba(140,230,255,.85)',
    glow: 'rgba(100,180,255,.5)',
  },
  {
    key: 'asym',
    title: '非对称对抗模式',
    tag: '1V多 · 守关者 vs 幸存者',
    desc: [
      '1 名守关者布置敌人阻止幸存者，',
      '最多 4 名幸存者破译密码机求生；',
      '幸存者生命与复活耗尽则守关者获胜。',
    ],
    accent: 'rgba(255,120,170,.9)',
    glow: 'rgba(255,90,150,.5)',
  },
];

/** 模式卡片（纯绘制 + 命中，样式对齐 prepare 的 Card） */
class ModeCard implements UIWidget {
  readonly id: string;
  readonly key: GameModeKey;
  visible = true;
  hover = false;
  focusable = false;
  focused = false;
  onClick?: () => void;
  x = 0;
  y = 0;
  w = 200;
  h = 120;

  private meta: ModeMeta;
  private enterDelay: number;

  constructor(meta: ModeMeta, enterDelay: number) {
    this.id = 'mode_' + meta.key;
    this.key = meta.key;
    this.meta = meta;
    this.enterDelay = enterDelay;
  }

  hit(lx: number, ly: number): boolean {
    return lx >= this.x && lx <= this.x + this.w && ly >= this.y && ly <= this.y + this.h;
  }

  draw(t: number): void {
    const en = ease((t - this.enterDelay) / .45);
    if (en <= 0) return;
    const m = this.meta;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    const scale = (1 + (this.hover ? 0.02 : 0)) * (0.96 + 0.04 * en);

    ctx.save();
    ctx.globalAlpha = en;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    // 卡片底板
    ctx.shadowColor = this.hover ? m.glow : 'rgba(80,60,200,.25)';
    ctx.shadowBlur = this.hover ? 26 : 12;
    rr(ctx, this.x, this.y, this.w, this.h, 16);
    ctx.fillStyle = this.hover ? 'rgba(30,20,70,.88)' : 'rgba(14,11,38,.82)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = this.hover ? m.accent : 'rgba(130,160,255,.35)';
    ctx.lineWidth = this.hover ? 2 : 1.5;
    ctx.stroke();

    // 顶部分类标签
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 13px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = m.accent;
    ctx.fillText(m.tag, cx, this.y + 34);

    // 主标题
    ctx.font = '800 30px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = '#eaf6ff';
    ctx.fillText(m.title, cx, this.y + 78);

    // 分隔线
    ctx.strokeStyle = 'rgba(130,160,255,.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x + 28, this.y + 104);
    ctx.lineTo(this.x + this.w - 28, this.y + 104);
    ctx.stroke();

    // 描述
    ctx.font = '500 15px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = 'rgba(175,195,255,.85)';
    m.desc.forEach((line, i) => {
      ctx.fillText(line, cx, this.y + 138 + i * 24);
    });

    // 悬停提示
    if (this.hover) {
      ctx.font = '600 14px "Segoe UI","Microsoft YaHei",Arial';
      ctx.fillStyle = '#7df9ff';
      ctx.fillText('点击创建房间', cx, this.y + this.h - 26);
    }
    ctx.restore();
  }
}

/* ==================== 场景构建 ==================== */

interface ModeSelectActions {
  /** 选中模式 → 进入创建房间（设置 prepare.gameMode 由调用方处理） */
  onSelect: (mode: GameModeKey) => void;
  /** 返回准备界面 */
  onBack: () => void;
}

const _modeTime = { t: 0, last: 0 };

export function buildModeSelectScene(a: ModeSelectActions): UIScene {
  const pw = 980, ph = 520;
  const px = VW / 2 - pw / 2, py = VH / 2 - ph / 2;

  const cards: ModeCard[] = MODE_META.map((m, i) => new ModeCard(m, 0.3 + i * 0.15));
  const cardW = 430, cardH = 380, gap = 40;
  cards.forEach((c, i) => {
    c.x = px + 60 + i * (cardW + gap);
    c.y = py + 120;
    c.w = cardW;
    c.h = cardH;
    c.onClick = () => a.onSelect(c.key);
  });

  const btnBack = makeBackButton('mode_back', a.onBack, { label: '← 返回', x: px + 22, y: py + 16, w: 130, h: 34 });

  function draw(_t: number): void {
    const tt = tickLocal(_modeTime);

    drawBackdrop(tt);
    drawHUDFrame(ease(tt / .5));

    ctx.save();
    const pe = ease(tt / .45);
    ctx.globalAlpha = pe;
    ctx.translate(0, (1 - pe) * 22);

    drawGlassPanel(px, py, pw, ph, 18, { shadowAlpha: 0.4, shadowBlur: 30 });

    // 色差标题
    drawNeonTitle(VW / 2, py + 70, '选择模式 · MODE', 34, tt, ease((tt - .1) / .55), 1.4);
    drawDecoStar(px + 60, py + 70, 6, tt * .8, 'rgba(140,246,255,.7)', 1, ease((tt - .3) / .4));
    drawDecoStar(px + pw - 60, py + 70, 6, -tt * .8, 'rgba(255,160,220,.7)', 1, ease((tt - .3) / .4));

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '500 14px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = 'rgba(150,180,255,.6)';
    ctx.fillText('选择联机房间的玩法模式（仅创建房间时可选）', VW / 2, py + 100);

    ctx.font = '500 12px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = 'rgba(160,180,255,.5)';
    ctx.fillText('点击模式卡片创建对应模式的房间 · ESC 返回', VW / 2, py + ph - 24);
    ctx.restore();
  }

  return {
    name: UI_SCENE.MODE_SELECT,
    widgets: [...cards, btnBack],
    draw,
    onEnter: () => { _modeTime.t = 0; _modeTime.last = 0; },
    onExit: () => resetHover(btnBack, ...cards),
  };
}
