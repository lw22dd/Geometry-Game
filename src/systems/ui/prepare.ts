/**
 * 准备界面 —— 开局选图选人（场景构建，组件化）。
 * 主准备页：选择地图 / 选择人物 两张卡片 + 开始游戏 / 创建房间 / 加入房间 / 返回主菜单。
 * 子页 mapSelect（地图卡片 + 缩略地形预览）、charSelect（角色卡片 + 迷你预览）。
 * 由 syncUI 按 prepare.mode 路由；Escape 逐级返回；卡片列表由 maps / CHARACTERS 动态驱动。
 * 升级：NEON ASCENT 氛围层 + 四角 HUD + 色差标题 + 错峰入场。
 */
import { ctx, VW, VH } from '../../core/canvas';
import { rr } from '../../core/math';
import { maps } from '../../config/level';
import { CHARACTERS, DEFAULT_CHARACTER, getCharacterById, setSelectedCharacter } from '../../Prefabs/Player';
import type { CharacterStyle } from '../../Prefabs/Player';
import type { MapDefinition } from '../../types';
import { Button, UI_SCENE } from '../../core/uiComponent';
import type { UIWidget, UIScene } from '../../core/uiComponent';
import { drawBackdrop, drawHUDFrame, drawNeonTitle, drawDecoStar, ease } from '../uiAtmosphere';

/* ==================== 准备流程状态 ==================== */

export const prepare = {
  mode: 'prepare' as 'prepare' | 'maps' | 'chars',
  mapId: maps[0].id,
  charId: DEFAULT_CHARACTER.id,
};

export function selectedMap(): MapDefinition {
  return maps.find(m => m.id === prepare.mapId) ?? maps[0];
}

function selectedChar(): CharacterStyle {
  return getCharacterById(prepare.charId);
}

/* ---------- 本地计时（独立于游戏时间，用于入场动画） ---------- */
let _prepT = 0, _prepLast = 0;

/* ==================== 卡片组件 ==================== */

class Card implements UIWidget {
  readonly id: string;
  visible = true;
  hover = false;
  focusable = false;
  focused = false;
  onClick?: () => void;
  x = 0;
  y = 0;
  w = 200;
  h = 120;

  private kind: 'map' | 'char';
  private getData: () => MapDefinition | CharacterStyle;
  private isSelected: () => boolean;
  private enterDelay = 0;

  constructor(opts: {
    id: string;
    kind: 'map' | 'char';
    getData: () => MapDefinition | CharacterStyle;
    isSelected: () => boolean;
    onClick?: () => void;
    enterDelay?: number;
  }) {
    this.id = opts.id;
    this.kind = opts.kind;
    this.getData = opts.getData;
    this.isSelected = opts.isSelected;
    this.onClick = opts.onClick;
    this.enterDelay = opts.enterDelay ?? 0;
  }

  hit(lx: number, ly: number): boolean {
    return lx >= this.x && lx <= this.x + this.w && ly >= this.y && ly <= this.y + this.h;
  }

  draw(t: number): void {
    const en = ease((t - this.enterDelay) / .45);
    if (en <= 0) return;
    const hover = this.hover;
    const sel = this.isSelected();
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    const scale = (1 + (hover ? 0.02 : 0) + (sel ? 0.01 : 0)) * (0.96 + 0.04 * en);

    ctx.save();
    ctx.globalAlpha = en;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    // 卡片底板
    ctx.shadowColor = sel ? 'rgba(140,230,255,.55)' : hover ? 'rgba(140,200,255,.35)' : 'rgba(80,60,200,.2)';
    ctx.shadowBlur = sel ? 24 : hover ? 16 : 10;
    rr(ctx, this.x, this.y, this.w, this.h, 14);
    ctx.fillStyle = hover ? 'rgba(30,20,70,.82)' : 'rgba(14,11,38,.78)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = sel ? 'rgba(140,230,255,.75)' : 'rgba(130,160,255,.32)';
    ctx.lineWidth = sel ? 2 : 1.5;
    ctx.stroke();

    if (this.kind === 'map') this.drawMap(ctx, this.getData() as MapDefinition);
    else this.drawChar(ctx, this.getData() as CharacterStyle);

    // 选中角标
    if (sel) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '600 13px "Segoe UI","Microsoft YaHei",Arial';
      ctx.fillStyle = '#7df9ff';
      ctx.fillText('✓ 当前选择', this.x + this.w / 2, this.y + this.h - 20);
    }
    ctx.restore();
  }

  /** 地图卡片：名称 + 尺寸 + 光球数 + 缩略地形 */
  private drawMap(c: CanvasRenderingContext2D, map: MapDefinition): void {
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.font = '700 20px "Segoe UI","Microsoft YaHei",Arial';
    c.fillStyle = '#eaf6ff';
    c.fillText(map.name, this.x + 22, this.y + 30);

    c.font = '500 13px "Segoe UI","Microsoft YaHei",Arial';
    c.fillStyle = 'rgba(160,185,255,.7)';
    c.fillText(
      map.width + ' × ' + map.height + '  ·  光球 ' + map.entitySpawners.orbs.length + ' 枚',
      this.x + 22, this.y + 56,
    );

    // 缩略地形（solids 缩放绘制，y 轴向上）
    const boxX = this.x + 22, boxY = this.y + 78;
    const boxW = this.w - 44, boxH = this.h - 108;
    const k = Math.min(boxW / map.width, boxH / map.height);
    const ox = boxX + (boxW - map.width * k) / 2;
    const oy = boxY + (boxH - map.height * k) / 2 + map.height * k;

    c.save();
    c.beginPath();
    rr(c, boxX, boxY, boxW, boxH, 8);
    c.clip();
    c.fillStyle = 'rgba(6,4,20,.6)';
    c.fillRect(boxX, boxY, boxW, boxH);
    c.fillStyle = 'rgba(120,140,255,.55)';
    for (const s of map.solids) {
      c.fillRect(ox + s.x * k, oy - (s.y + s.h) * k, Math.max(1, s.w * k), Math.max(1, s.h * k));
    }
    // 出生点
    c.fillStyle = '#7df9ff';
    c.beginPath();
    c.arc(ox + map.playerSpawn.x * k, oy - map.playerSpawn.y * k, 2.2, 0, 6.283);
    c.fill();
    c.restore();
    c.strokeStyle = 'rgba(120,150,255,.25)';
    c.lineWidth = 1;
    rr(c, boxX, boxY, boxW, boxH, 8);
    c.stroke();
  }

  /** 角色卡片：该角色配色的迷你玩家预览 + 名称 */
  private drawChar(c: CanvasRenderingContext2D, style: CharacterStyle): void {
    const gx = this.x + this.w / 2, gy = this.y + 92;
    const r = 26;

    c.save();
    c.shadowColor = style.glow;
    c.shadowBlur = 20;
    const g = c.createRadialGradient(gx - r * 0.3, gy - r * 0.35, r * 0.15, gx, gy, r);
    g.addColorStop(0, style.bodyGrad[0]);
    g.addColorStop(0.55, style.bodyGrad[1]);
    g.addColorStop(1, style.bodyGrad[2]);
    c.fillStyle = g;
    c.beginPath();
    c.arc(gx, gy, r, 0, 6.283);
    c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = style.stroke;
    c.lineWidth = 2;
    c.stroke();

    // 双眼
    const blink = (Math.floor(performance.now() / 3400) % 2) === 1;
    const ew = r * 0.17;
    const eh = blink ? 2 : r * 0.36;
    c.fillStyle = style.eyeColor;
    c.fillRect(gx + r * style.eyeDX[0] - ew / 2, gy - r * 0.3, ew, eh);
    c.fillRect(gx + r * style.eyeDX[1] - ew / 2, gy - r * 0.3, ew, eh);
    c.restore();

    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = '700 22px "Segoe UI","Microsoft YaHei",Arial';
    c.fillStyle = '#eaf6ff';
    c.fillText(style.name, this.x + this.w / 2, this.y + this.h - 48);
    c.font = '500 12px "Segoe UI",Arial';
    c.fillStyle = 'rgba(150,175,255,.55)';
    c.fillText(style.id, this.x + this.w / 2, this.y + this.h - 22);
  }
}

/* ==================== 主准备页 ==================== */

interface PrepareActions {
  onStart: () => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onBack: () => void;
}

export function buildPrepareScene(a: PrepareActions): UIScene {
  const pw = 1000, ph = 600;
  const px = VW / 2 - pw / 2, py = VH / 2 - ph / 2;

  const cardMap = new Card({
    id: 'prepare_map_card', kind: 'map', getData: selectedMap, isSelected: () => true,
    onClick: () => { prepare.mode = 'maps'; }, enterDelay: 0.35,
  });
  const cardChar = new Card({
    id: 'prepare_char_card', kind: 'char', getData: selectedChar, isSelected: () => true,
    onClick: () => { prepare.mode = 'chars'; }, enterDelay: 0.45,
  });
  cardMap.x = px + 70; cardMap.y = py + 110; cardMap.w = 400; cardMap.h = 260;
  cardChar.x = px + 530; cardChar.y = py + 110; cardChar.w = 400; cardChar.h = 260;

  const btnStart = new Button({
    id: 'prepare_start', label: '▶ 开始游戏', variant: 'primary',
    x: VW / 2 - 150, y: py + 430, w: 300, h: 56, onClick: a.onStart, enterDelay: 0.6,
  });
  const btnCreate = new Button({
    id: 'prepare_create', label: '创建房间', variant: 'plain',
    x: VW / 2 - 265, y: py + 500, w: 250, h: 44, onClick: a.onCreateRoom, enterDelay: 0.7,
  });
  const btnJoin = new Button({
    id: 'prepare_join', label: '加入房间', variant: 'plain',
    x: VW / 2 + 15, y: py + 500, w: 250, h: 44, onClick: a.onJoinRoom, enterDelay: 0.75,
  });
  const btnBack = new Button({
    id: 'prepare_back', label: '← 返回主菜单', variant: 'plain',
    x: px + 22, y: py + 16, w: 160, h: 34, onClick: a.onBack,
  });

  function draw(_t: number): void {
    const nowMs = performance.now();
    if (_prepLast) _prepT += Math.min(.05, (nowMs - _prepLast) / 1000);
    _prepLast = nowMs;
    const tt = _prepT;

    // 1) 氛围层 + HUD
    drawBackdrop(tt);
    drawHUDFrame(ease(tt / .5));

    ctx.save();
    const pe = ease(tt / .45);
    ctx.globalAlpha = pe;
    ctx.translate(0, (1 - pe) * 22);

    // 面板底
    ctx.shadowColor = 'rgba(80,60,200,.45)'; ctx.shadowBlur = 34;
    rr(ctx, px, py, pw, ph, 18);
    ctx.fillStyle = 'rgba(10,8,32,.92)'; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(130,160,255,.45)'; ctx.lineWidth = 1.5; ctx.stroke();

    // 色差标题
    drawNeonTitle(VW / 2, py + 70, '准备 · PREPARE', 32, tt, ease((tt - .1) / .55), 1.4);
    drawDecoStar(px + 60, py + 70, 6, tt * .8, 'rgba(140,246,255,.7)', 1, ease((tt - .3) / .4));
    drawDecoStar(px + pw - 60, py + 70, 6, -tt * .8, 'rgba(255,160,220,.7)', 1, ease((tt - .3) / .4));

    ctx.font = '500 13px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = 'rgba(150,180,255,.6)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('点击卡片进入选择界面，选择后自动返回', VW / 2, py + 110);

    ctx.font = '500 12px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = 'rgba(160,180,255,.45)';
    ctx.fillText('开始游戏 = 立即用当前选择单机开局', VW / 2 - 140, py + ph - 24);
    ctx.fillText('创建/加入房间 = 以当前选择联机（房主选图广播）', VW / 2 + 140, py + ph - 24);
    ctx.restore();
  }

  return {
    name: UI_SCENE.PREPARE,
    widgets: [cardMap, cardChar, btnStart, btnCreate, btnJoin, btnBack],
    draw,
    onEnter: () => { _prepT = 0; _prepLast = 0; },
    onExit: () => {
      cardMap.hover = false; cardChar.hover = false;
      for (const b of [btnStart, btnCreate, btnJoin, btnBack]) b.hover = false;
      const c = ctx.canvas; if (c) c.style.cursor = 'default';
    },
  };
}

/* ==================== 选择子页 ==================== */

function buildSelectScene(kind: 'maps' | 'chars', onBack: () => void): UIScene {
  const pw = 1000, ph = 640;
  const px = VW / 2 - pw / 2, py = VH / 2 - ph / 2;
  const items = kind === 'maps' ? maps : CHARACTERS;
  const title = kind === 'maps' ? '选择地图' : '选择人物';
  const subtitle = kind === 'maps'
    ? '当前地图二「水晶洞窟 · 对称迷城」已就绪'
    : '已预留多种人物 · 当前两支：霓虹跑者 / 绯红冲刺者';

  const cardW = 430, cardH = 330, gapX = 30, gapY = 30;
  const cards: Card[] = [];
  const widgets: UIWidget[] = [];

  items.forEach((item, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const card = new Card({
      id: kind + '_' + (item as any).id,
      kind: kind === 'maps' ? 'map' : 'char',
      getData: () => (kind === 'maps' ? item as MapDefinition : item as CharacterStyle),
      isSelected: () => (kind === 'maps'
        ? (item as MapDefinition).id === prepare.mapId
        : (item as CharacterStyle).id === prepare.charId),
      onClick: () => {
        if (kind === 'maps') {
          prepare.mapId = (item as MapDefinition).id;
        } else {
          prepare.charId = (item as CharacterStyle).id;
          setSelectedCharacter(prepare.charId);
        }
        onBack();
      },
      enterDelay: 0.3 + i * 0.12, // 错峰入场
    });
    card.x = px + 70 + col * (cardW + gapX);
    card.y = py + 140 + row * (cardH + gapY);
    card.w = cardW; card.h = cardH;
    cards.push(card);
    widgets.push(card);
  });

  const btnBack = new Button({
    id: kind + '_back', label: '← 返回', variant: 'plain',
    x: px + 22, y: py + 16, w: 130, h: 34, onClick: onBack,
  });
  widgets.push(btnBack);

  function draw(_t: number): void {
    const nowMs = performance.now();
    if (_prepLast) _prepT += Math.min(.05, (nowMs - _prepLast) / 1000);
    _prepLast = nowMs;
    const tt = _prepT;

    // 1) 氛围层 + HUD
    drawBackdrop(tt);
    drawHUDFrame(ease(tt / .5));

    ctx.save();
    const pe = ease(tt / .45);
    ctx.globalAlpha = pe;
    ctx.translate(0, (1 - pe) * 22);

    ctx.shadowColor = 'rgba(80,60,200,.4)'; ctx.shadowBlur = 30;
    rr(ctx, px, py, pw, ph, 18);
    ctx.fillStyle = 'rgba(10,8,32,.92)'; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(130,160,255,.45)'; ctx.lineWidth = 1.5; ctx.stroke();

    // 色差标题
    drawNeonTitle(VW / 2, py + 80, title, 36, tt, ease((tt - .1) / .55), 1.4);
    drawDecoStar(px + 60, py + 80, 6, tt * .8, 'rgba(140,246,255,.7)', 1, ease((tt - .3) / .4));
    drawDecoStar(px + pw - 60, py + 80, 6, -tt * .8, 'rgba(255,160,220,.7)', 1, ease((tt - .3) / .4));

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '500 13px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = 'rgba(150,180,255,.55)';
    ctx.fillText(subtitle, VW / 2, py + 112);

    ctx.font = '500 12px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = 'rgba(160,180,255,.45)';
    ctx.fillText('点击卡片选中并返回 · ESC 返回上级', VW / 2, py + ph - 24);
    ctx.restore();
  }

  return {
    name: kind === 'maps' ? UI_SCENE.MAP_SELECT : UI_SCENE.CHAR_SELECT,
    widgets,
    draw,
    onEnter: () => { _prepT = 0; _prepLast = 0; },
    onExit: () => {
      for (const c of cards) c.hover = false;
      btnBack.hover = false;
      const cv = ctx.canvas;
      if (cv) cv.style.cursor = 'default';
    },
  };
}

export function buildMapSelectScene(onBack: () => void): UIScene {
  return buildSelectScene('maps', onBack);
}

export function buildCharSelectScene(onBack: () => void): UIScene {
  return buildSelectScene('chars', onBack);
}