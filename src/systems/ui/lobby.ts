/**
 * 联机大厅 —— 创建/加入房间界面（场景构建，组件化）。
 * 两个阶段：
 *   1) 连接表单：昵称 / IP / 端口 + 连接按钮（create 隐藏 IP）。
 *   2) 房间内：玩家列表（昵称/角色/准备状态）+ 房间内选角 + 准备按钮 +
 *      房主"开始游戏"（全员准备后可用）。
 */
import { ctx, VW, VH } from '../../core/canvas';
import { rr } from '../../core/math';
import { room } from '../../net/room';
import { net } from '../../net';
import { resetRoom } from '../../net/room';
import { resetRemotes } from '../player/remote';
import { prepare } from './prepare';
import { CHARACTERS, getCharacterById, setSelectedCharacter } from '../../Prefabs/Player';
import type { CharacterStyle } from '../../Prefabs/Player';
import type { Faction } from '../../types';
import { KEEPER_SLOTS, SURVIVOR_SLOTS } from '../../types';
import { Button, TextInput, UI_SCENE, ui } from '../../core/uiComponent';
import type { UIWidget, UIScene } from '../../core/uiComponent';
import { tickLocal, ease, drawMask, drawGlassPanel, drawTitle, resetHover } from './primitives';

type LobbyMode = 'none' | 'create' | 'join';

/** 当前大厅状态（mode 由外部 controlling 显示/隐藏） */
export const lobby = {
  mode: 'none' as LobbyMode,
  status: '' as string,
  statusColor: '#bfe9ff',
  /** 已连接并处于房间界面 */
  inRoom: false,
  /** 本机准备状态缓存（房间列表 room.players 为准） */
  myReady: false,
  /** 本机所选角色 id（房间内选角） */
  myChar: '' as string,
  /** 本机阵营（非对称模式；red=少方蓝=多方，服务器仲裁为准） */
  myFaction: '' as Faction | '',
  /** 最近一次阵营请求（用于反馈"已申请，等待对手…"） */
  factionPending: false,
};

/* ---------- 大厅动画计时 ---------- */
const _lobbyTime = { t: 0, last: 0 };

const DEFAULT_NAME = '玩家' + Math.floor(Math.random() * 900 + 100);

interface LobbyActions {
  /** 房主点击「开始游戏」（全员准备后） */
  onStartGame: () => void;
  /** 返回暂停（关闭大厅） */
  onBack: () => void;
}

/** 房间内角色卡片（轻量 UIWidget，纯绘制 + 命中） */
class CharCard implements UIWidget {
  readonly id: string;
  visible = true;
  hover = false;
  focusable = false;
  focused = false;
  onClick?: () => void;
  x = 0;
  y = 0;
  w = 200;
  h = 140;

  private style: CharacterStyle;

  constructor(style: CharacterStyle) {
    this.id = 'lobby_char_' + style.id;
    this.style = style;
  }

  hit(lx: number, ly: number): boolean {
    return lx >= this.x && lx <= this.x + this.w && ly >= this.y && ly <= this.y + this.h;
  }

  draw(_t: number): void {
    const s = this.style;
    // 从房间列表推导当前选择（连接后 onEnter 不会重跑的兜底）
    const me = room.players.find(p => p.id === room.playerId);
    const myCharId = me?.char ?? lobby.myChar;
    const isSel = myCharId === s.id;
    const cx = this.x + this.w / 2;

    ctx.save();
    ctx.shadowColor = isSel ? s.glow : this.hover ? 'rgba(140,200,255,.4)' : 'rgba(80,60,200,.2)';
    ctx.shadowBlur = isSel ? 26 : this.hover ? 18 : 10;
    rr(ctx, this.x, this.y, this.w, this.h, 14);
    ctx.fillStyle = this.hover ? 'rgba(30,20,70,.85)' : 'rgba(14,11,38,.8)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = isSel ? 'rgba(140,230,255,.8)' : 'rgba(130,160,255,.32)';
    ctx.lineWidth = isSel ? 2 : 1.5;
    ctx.stroke();

    // 迷你角色预览
    const gx = cx, gy = this.y + 52, r = 20;
    const g = ctx.createRadialGradient(gx - r * 0.3, gy - r * 0.35, r * 0.15, gx, gy, r);
    g.addColorStop(0, s.bodyGrad[0]);
    g.addColorStop(0.55, s.bodyGrad[1]);
    g.addColorStop(1, s.bodyGrad[2]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(gx, gy, r, 0, 6.283);
    ctx.fill();
    ctx.strokeStyle = s.stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = s.eyeColor;
    ctx.fillRect(gx + r * s.eyeDX[0] - 2, gy - r * 0.3, 4, r * 0.34);
    ctx.fillRect(gx + r * s.eyeDX[1] - 2, gy - r * 0.3, 4, r * 0.34);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 15px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = '#eaf6ff';
    ctx.fillText(s.name, cx, this.y + this.h - 24);
    if (isSel) {
      ctx.font = '600 11px "Segoe UI","Microsoft YaHei",Arial';
      ctx.fillStyle = '#7df9ff';
      ctx.fillText('✓ 已选', cx, this.y + this.h - 8);
    }
    ctx.restore();
  }
}

/** 非对称模式阵营槽位元数据（红槽×1 少方 + 蓝槽×4 多方） */
export const FACTIONS: { faction: Faction; label: string; color: string; glow: string }[] = [
  { faction: 'keeper', label: '少方 · 守关者', color: '#ff6a7a', glow: 'rgba(255,90,120,.75)' },
  { faction: 'survivor', label: '多方 · 幸存者', color: '#5ab8ff', glow: 'rgba(90,170,255,.7)' },
];

/** 阵营槽位卡片（轻量 UIWidget，纯绘制 + 命中；点击选择阵营） */
class FactionCard implements UIWidget {
  readonly id: string;
  readonly faction: Faction;
  visible = true;
  hover = false;
  focusable = false;
  focused = false;
  onClick?: () => void;
  x = 0;
  y = 0;
  w = 200;
  h = 150;

  constructor(faction: Faction) {
    this.id = 'lobby_faction_' + faction;
    this.faction = faction;
  }

  hit(lx: number, ly: number): boolean {
    return lx >= this.x && lx <= this.x + this.w && ly >= this.y && ly <= this.y + this.h;
  }

  draw(t: number): void {
    void t;
    const meta = FACTIONS.find(f => f.faction === this.faction)!;
    const isKeeper = this.faction === 'keeper';
    const limit = isKeeper ? KEEPER_SLOTS : SURVIVOR_SLOTS;
    // 当前阵营占用玩家
    const members = room.players.filter(p => p.faction === this.faction);
    const occupied = members.length >= limit;
    const me = room.players.find(p => p.id === room.playerId);
    const isMine = me?.faction === this.faction;
    const cx = this.x + this.w / 2;

    ctx.save();
    ctx.shadowColor = isMine ? meta.glow : this.hover ? 'rgba(140,200,255,.4)' : 'rgba(80,60,200,.2)';
    ctx.shadowBlur = isMine ? 26 : this.hover ? 18 : 10;
    rr(ctx, this.x, this.y, this.w, this.h, 14);
    ctx.fillStyle = this.hover ? 'rgba(30,20,70,.85)' : 'rgba(14,11,38,.82)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = isMine ? meta.color : 'rgba(130,160,255,.35)';
    ctx.lineWidth = isMine ? 2 : 1.5;
    ctx.stroke();

    // 阵营名 + 占用数
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 17px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = isMine ? '#fff' : '#eaf6ff';
    ctx.fillText(meta.label, cx, this.y + 26);
    ctx.font = '500 13px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = occupied ? '#ffb0a0' : 'rgba(160,185,255,.75)';
    ctx.fillText(members.length + ' / ' + limit + (occupied && !isMine ? ' · 已满' : ''), cx, this.y + 50);

    // 成员列表（每人一行：名字 + 准备状态）
    ctx.textAlign = 'left';
    ctx.font = '500 13px "Segoe UI","Microsoft YaHei",Arial';
    members.forEach((m, i) => {
      const my = this.y + 76 + i * 24;
      if (my > this.y + this.h - 8) return;
      ctx.fillStyle = m.id === room.playerId ? '#7df9ff' : 'rgba(175,195,255,.85)';
      ctx.fillText(m.name, this.x + 18, my);
      ctx.textAlign = 'right';
      ctx.fillStyle = m.ready ? '#8ff6a0' : 'rgba(150,170,220,.45)';
      ctx.fillText(m.ready ? '✓' : '○', this.x + this.w - 18, my);
      ctx.textAlign = 'left';
    });

    // 底部提示：加入 / 我的阵营
    if (isMine) {
      ctx.font = '600 12px "Segoe UI","Microsoft YaHei",Arial';
      ctx.fillStyle = '#7df9ff';
      ctx.fillText('✓ 我的阵营（点击可换）', cx, this.y + this.h - 12);
    } else if (this.hover && !occupied) {
      ctx.font = '600 12px "Segoe UI","Microsoft YaHei",Arial';
      ctx.fillStyle = '#7df9ff';
      ctx.fillText('点击加入此阵营', cx, this.y + this.h - 12);
    } else if (occupied) {
      ctx.font = '500 11px "Segoe UI","Microsoft YaHei",Arial';
      ctx.fillStyle = 'rgba(255,180,160,.6)';
      ctx.fillText('此阵营已满', cx, this.y + this.h - 12);
    } else {
      ctx.font = '500 11px "Segoe UI","Microsoft YaHei",Arial';
      ctx.fillStyle = 'rgba(160,185,255,.55)';
      ctx.fillText('点击加入', cx, this.y + this.h - 12);
    }
    ctx.restore();
  }
}

/** 构建大厅场景。需要先调用 openCreateLobby / openJoinLobby 设置 mode。 */
export function buildLobbyScene(a: LobbyActions): UIScene {
  // ---- 输入框组件（连接阶段） ----
  const fields = {
    name: new TextInput({
      id: 'lobby_name', label: '昵称',
      value: DEFAULT_NAME, maxLen: 12,
      x: 0, y: 0, w: 380, h: 40,
    }),
    ip: new TextInput({
      id: 'lobby_ip', label: 'IP 地址',
      value: '127.0.0.1', maxLen: 15,
      x: 0, y: 0, w: 380, h: 40,
    }),
    port: new TextInput({
      id: 'lobby_port', label: '端口',
      value: '8810', maxLen: 5,
      x: 0, y: 0, w: 380, h: 40,
    }),
  };
  const order: (keyof typeof fields)[] = ['name', 'ip', 'port'];

  // Tab 切换焦点
  function tabTo(from: keyof typeof fields): void {
    const idx = order.indexOf(from);
    const next = order[(idx + 1) % order.length];
    fields[from].focused = false;
    if (next === 'ip' && lobby.mode === 'create') {
      // 创建模式无 IP 输入，直接到 port
      fields.name.focused = false;
      fields.port.focused = true;
      return;
    }
    fields[next].focused = true;
  }

  // 统一键盘包装：Tab 切换 / Enter 连接 / Escape 返回 / 默认字符输入
  const fieldValues = (): { name: string; ip: string; port: string } => ({
    name: fields.name.value,
    ip: fields.ip.value,
    port: fields.port.value,
  });
  const doConnect = (): void => {
    void connectLobby(fieldValues);
  };
  function wrapKey(field: keyof typeof fields): (e: KeyboardEvent) => boolean {
    return (e: KeyboardEvent) => {
      if (e.code === 'Tab') { e.preventDefault(); tabTo(field); return true; }
      if (e.code === 'Enter') { doConnect(); return true; }
      if (e.code === 'Escape') { a.onBack(); return true; }
      return fields[field].defaultKey(e);
    };
  }
  fields.name.onKey = wrapKey('name');
  fields.ip.onKey = wrapKey('ip');
  fields.port.onKey = wrapKey('port');

  // ---- 按钮组件（连接阶段） ----
  const btnConnect = new Button({
    id: 'lobby_connect',
    label: '✓ 加入',
    variant: 'plain',
    x: 0, y: 0, w: 260, h: 46,
    onClick: doConnect,
  });
  const btnBack = new Button({
    id: 'lobby_back',
    label: '← 返回',
    variant: 'plain',
    x: 0, y: 0, w: 260, h: 46,
    onClick: a.onBack,
  });

  // ---- 房间阶段：角色卡片 + 按钮 ----
  const charCards: CharCard[] = CHARACTERS.map(c => new CharCard(c));
  for (const c of charCards) {
    c.onClick = () => selectChar(c.id);
  }

  // 阵营卡片（非对称模式专用；红槽少方 + 蓝槽多方）
  const factionCards: FactionCard[] = FACTIONS.map(f => new FactionCard(f.faction));
  for (const fc of factionCards) {
    fc.onClick = () => selectFaction(fc);
  }

  const myReadyNow = (): boolean => {
    const p = room.players.find(x => x.id === room.playerId);
    return p?.ready ?? false;
  };
  const toggleReady = (): void => {
    net.sendReady(!myReadyNow());
  };
  const btnReady = new Button({
    id: 'lobby_ready',
    label: '准备',
    variant: 'plain',
    x: 0, y: 0, w: 230, h: 50,
    onClick: toggleReady,
    onKey: (e): boolean => e.code === 'Enter' ? (toggleReady(), true) : false,
  });
  const allReady = (): boolean => {
    if (room.players.length === 0) return false;
    return room.players.every(p => p.ready);
  };
  /** 非对称模式可否开始：至少 1 少方 + 1 多方 且全员已准备 */
  const canStartAsym = (): boolean => {
    if (!allReady()) return false;
    const k = room.players.filter(p => p.faction === 'keeper').length;
    const s = room.players.filter(p => p.faction === 'survivor').length;
    return k >= 1 && s >= 1;
  };
  const startGameClick = (): void => {
    if (room.role !== 'host') return;
    if (room.mode === 'asym' && !canStartAsym()) return;
    if (room.mode !== 'asym' && !allReady()) return;
    lobby.mode = 'none';
    lobby.inRoom = false;
    lobby.myReady = false;
    a.onStartGame();
  };
  const btnStart = new Button({
    id: 'lobby_start',
    label: '▶ 开始游戏',
    variant: 'primary',
    x: 0, y: 0, w: 260, h: 50,
    onClick: startGameClick,
    onKey: (e): boolean => e.code === 'Enter' ? (startGameClick(), true) : false,
  });
  const btnLeave = new Button({
    id: 'lobby_leave',
    label: '退出房间',
    variant: 'plain',
    x: 0, y: 0, w: 230, h: 50,
    onClick: () => leaveRoom(),
    onKey: (e): boolean => (e.code === 'Escape' || e.code === 'Enter') ? (leaveRoom(), true) : false,
  });

  // ---- 布局：每次绘制前计算位置（off = 面板入场位移，让组件与面板同步上滑） ----
  function layoutConnect(off = 0): void {
    const pw = 460, ph = 440;
    const px = VW / 2 - pw / 2, py = VH / 2 - ph / 2 + off;
    const labelX = px + 40;
    let iy = py + 84;

    fields.name.x = labelX; fields.name.y = iy; iy += 60;
    fields.ip.x = labelX; fields.ip.y = iy; iy += 60;
    fields.port.x = labelX; fields.port.y = iy;

    // 按钮列：输入框底部下方（状态行夹在中间），按钮间距 50px 防溢出面板
    btnConnect.x = VW / 2 - 130; btnConnect.y = iy + 96;
    btnBack.x = VW / 2 - 130; btnBack.y = iy + 146;

    // 创建模式隐藏 IP 字段
    fields.ip.visible = lobby.mode === 'join';

    // 连接阶段：隐藏房间阶段的角色卡与按钮（否则按默认 (0,0) 叠在屏幕左上角）
    for (const c of charCards) c.visible = false;
    for (const fc of factionCards) fc.visible = false;
    btnReady.visible = false;
    btnStart.visible = false;
    btnLeave.visible = false;
  }

  function layoutRoom(): void {
    const pw = 960, ph = 560;
    const px = VW / 2 - pw / 2, py = VH / 2 - ph / 2;
    const asym = room.mode === 'asym';

    // 角色卡片：右侧两列
    const cardW = 240, cardH = 170, gap = 18;
    charCards.forEach((c, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      c.x = px + 430 + col * (cardW + gap);
      c.y = py + 160 + row * (cardH + gap);
      c.w = cardW; c.h = cardH;
    });

    // 阵营卡片（非对称模式）：左侧纵向排列（红槽少方 + 蓝槽多方）
    const fw = 370, fh = 180, fgap = 16;
    factionCards.forEach((fc, i) => {
      fc.x = px + 40;
      fc.y = py + 118 + i * (fh + fgap);
      fc.w = fw; fc.h = fh;
    });

    // 底部按钮：准备 / 开始（房主）/ 退出
    btnReady.x = px + 40; btnReady.y = py + ph - 84;
    btnStart.x = VW / 2 - 130; btnStart.y = py + ph - 84;
    btnLeave.x = px + pw - 270; btnLeave.y = py + ph - 84;

    // 阶段显隐
    for (const f of Object.values(fields)) f.visible = false;
    btnConnect.visible = false;
    btnBack.visible = false;
    for (const c of charCards) c.visible = true;
    for (const fc of factionCards) fc.visible = asym;
    btnReady.visible = true;
    btnLeave.visible = true;
    btnStart.visible = room.role === 'host';

    // 按钮文案
    const r = myReadyNow();
    btnReady.label = r ? '✓ 已准备（点击取消）' : '准备';
    if (asym) {
      btnStart.label = canStartAsym() ? '▶ 开始游戏' : '▶ 开始游戏（等待中）';
    } else {
      btnStart.label = allReady() ? '▶ 开始游戏' : '▶ 开始游戏（等待中）';
    }
  }

  // ---- 背景绘制 ----
  function drawPanel(t: number): void {
    const tt = tickLocal(_lobbyTime);
    const en = ease(tt / 0.3);
    if (en <= 0) return;

    if (lobby.inRoom) {
      layoutRoom();
      drawRoom(tt, en);
      return;
    }

    const off = (1 - en) * 26;
    layoutConnect(off);
    const pw = 460, ph = 440;
    const px = VW / 2 - pw / 2, py = VH / 2 - ph / 2 + off;

    ctx.save();
    ctx.globalAlpha = en;

    // 半透明遮罩
    drawMask(0.8 * en);

    drawGlassPanel(px, py, pw, ph, 16, { fill: 'rgba(10,8,32,.88)' });

    // 标题
    drawTitle(lobby.mode === 'create' ? '🏠 创建房间' : '🔗 加入房间', py + 48, 26);

    // 状态行
    const btnH = 46;
    btnConnect.label = lobby.mode === 'create' ? '✓ 创建并进入' : '✓ 加入';
    if (lobby.status) {
      ctx.textAlign = 'center';
      ctx.font = '500 15px "Segoe UI","Microsoft YaHei",Arial';
      ctx.fillStyle = lobby.statusColor;
      ctx.fillText(lobby.status, VW / 2, btnConnect.y - btnH / 2 - 8);
    }

    // 底部提示
    ctx.textAlign = 'center';
    ctx.font = '500 12px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = 'rgba(150,180,255,.5)';
    if (lobby.mode === 'create') {
      ctx.fillText('房主本机需先启动 dash-server.exe（默认端口 8810）', VW / 2, py + ph - 24);
    } else {
      ctx.fillText('提示：输入房主的 IP 地址与端口（本机联机用 127.0.0.1）', VW / 2, py + ph - 24);
    }

    ctx.restore();
  }

  /** 房间界面绘制（玩家列表 + 我/房主徽标 + 状态提示） */
  function drawRoom(tt: number, en: number): void {
    const pw = 960, ph = 560;
    const px = VW / 2 - pw / 2, py = VH / 2 - ph / 2;

    ctx.save();
    ctx.globalAlpha = en;

    drawMask(0.82 * en);

    drawGlassPanel(px, py, pw, ph, 18);

    // 标题
    const asym = room.mode === 'asym';
    drawTitle(room.role === 'host' ? '🏠 我的房间' : '🔗 已加入房间', py + 48, 26);
    ctx.font = '500 12px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = asym ? 'rgba(255,150,190,.8)' : 'rgba(150,180,255,.55)';
    ctx.textAlign = 'center';
    ctx.fillText(
      asym
        ? '非对称对抗：1 名少方布置敌人，最多 4 名多方破译密码机求生'
        : '房间中的玩家选择角色，点击「准备」；全部准备后房主可开始',
      VW / 2, py + 84,
    );
    ctx.textAlign = 'left';

    // 左：玩家列表 / 阵营槽位（非对称模式；高度收缩，给底部状态提示留位；超出部分裁剪）
    const lx = px + 40, ly = py + 118;
    const listH = asym ? 376 : 320;
    rr(ctx, lx, ly, 360, listH, 12);
    ctx.fillStyle = 'rgba(6,4,20,.6)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,150,255,.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.save();
    rr(ctx, lx + 1, ly + 1, 358, listH - 2, 11);
    ctx.clip();

    ctx.textAlign = 'left';
    ctx.font = '700 16px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = '#8ff6ff';
    if (asym) {
      ctx.fillText('选择阵营', lx + 18, ly + 26);
      ctx.font = '500 11px "Segoe UI","Microsoft YaHei",Arial';
      ctx.fillStyle = 'rgba(160,185,255,.55)';
      ctx.fillText('红=少方 ×1 · 蓝=多方 ×4', lx + 18, ly + 46);
      // 阵营卡片由组件层绘制（widgets 中的 FactionCard），此处仅留面板背景
    } else {
      ctx.fillText('玩家列表（' + room.players.length + '）', lx + 18, ly + 28);
    }

    room.players.forEach((p, i) => {
      if (asym) return; // 非对称模式：玩家由阵营卡片展示，不重复绘制列表
      const ry = ly + 62 + i * 56;
      const isMe = p.id === room.playerId;
      const charName = p.char ? getCharacterById(p.char).name : '未选角';

      // 行底
      rr(ctx, lx + 12, ry - 14, 336, 44, 8);
      ctx.fillStyle = isMe ? 'rgba(60,90,200,.28)' : 'rgba(20,16,50,.4)';
      ctx.fill();

      // 名字 + 房主/自己徽标
      ctx.font = '600 15px "Segoe UI","Microsoft YaHei",Arial';
      ctx.fillStyle = '#eaf6ff';
      ctx.fillText(p.name, lx + 24, ry + 2);
      const tagX = lx + 24 + ctx.measureText(p.name).width + 8;
      ctx.font = '500 11px "Segoe UI","Microsoft YaHei",Arial';
      ctx.fillStyle = room.role === 'host' && p.id === room.playerId ? '#ffd76b' : p.id === room.playerId ? '#7df9ff' : 'rgba(160,185,255,.55)';
      ctx.fillText(p.id === room.playerId ? '· 我' : '', tagX, ry + 2);

      // 角色
      ctx.font = '500 12px "Segoe UI","Microsoft YaHei",Arial';
      ctx.fillStyle = 'rgba(160,185,255,.7)';
      ctx.fillText(charName, lx + 24, ry + 22);

      // 准备状态
      ctx.textAlign = 'right';
      ctx.font = '600 13px "Segoe UI","Microsoft YaHei",Arial';
      ctx.fillStyle = p.ready ? '#8ff6a0' : 'rgba(150,170,220,.45)';
      ctx.fillText(p.ready ? '✓ 已准备' : '○ 未准备', lx + 336, ry + 2);
      ctx.textAlign = 'left';
    });

    ctx.restore();

    // 右：选择角色
    ctx.font = '700 16px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = '#8ff6ff';
    ctx.textAlign = 'left';
    ctx.fillText('选择角色', px + 430, py + 128);
    ctx.font = '500 12px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = 'rgba(160,185,255,.55)';
    ctx.fillText('点击卡片选择，重新选择后需重新准备', px + 430, py + 148);

    // 全员未准备提示（非对称模式额外提示需要双方阵营）
    ctx.textAlign = 'left';
    ctx.font = '500 13px "Segoe UI","Microsoft YaHei",Arial';
    if (room.role === 'client') {
      ctx.fillStyle = 'rgba(190,205,255,.6)';
      ctx.fillText('等待房主开始游戏…', px + 40, py + ph - 108);
    } else if (asym) {
      const k = room.players.filter(p => p.faction === 'keeper').length;
      const s = room.players.filter(p => p.faction === 'survivor').length;
      if (k === 0 || s === 0) {
        ctx.fillStyle = 'rgba(255,190,120,.75)';
        ctx.fillText('需要至少 1 名少方 + 1 名多方（点击左侧阵营）', px + 40, py + ph - 108);
      } else if (!allReady()) {
        ctx.fillStyle = 'rgba(255,190,120,.75)';
        ctx.fillText('还有玩家未准备，无法开始', px + 40, py + ph - 108);
      } else {
        ctx.fillStyle = '#8ff6a0';
        ctx.fillText('双方阵营已就绪且全员准备，点击「开始游戏」', px + 40, py + ph - 108);
      }
    } else if (!allReady()) {
      ctx.fillStyle = 'rgba(255,190,120,.75)';
      ctx.fillText('还有玩家未准备，无法开始', px + 40, py + ph - 108);
    } else {
      ctx.fillStyle = '#8ff6a0';
      ctx.fillText('全员已准备，点击「开始游戏」', px + 40, py + ph - 108);
    }
    ctx.restore();
  }

  return {
    name: UI_SCENE.LOBBY,
    widgets: [
      fields.name, fields.ip, fields.port, btnConnect, btnBack,
      ...charCards, ...factionCards, btnReady, btnStart, btnLeave,
    ],
    draw: drawPanel,
    onEnter: () => {
      _lobbyTime.t = 0; _lobbyTime.last = 0;
      lobby.status = '';
      if (lobby.inRoom) {
        // 房间阶段：初始化本地选择状态
        const me = room.players.find(p => p.id === room.playerId);
        lobby.myChar = me?.char ?? prepare.charId;
        lobby.myReady = me?.ready ?? false;
        lobby.myFaction = me?.faction ?? '';
        layoutRoom();
        return;
      }
      // 连接阶段：聚焦第一个可用输入框
      fields.name.focused = true;
      fields.ip.focused = false;
      fields.port.focused = false;
      layoutConnect();
    },
    onExit: () => {
      for (const f of Object.values(fields)) f.focused = false;
      resetHover(btnConnect, btnBack, btnReady, btnStart, btnLeave, ...charCards, ...factionCards);
    },
  };
}

/* ==================== 房间内操作 ==================== */

/** 房间内选角：更新本地选择 → 上报服务器 → 若已准备则取消准备 */
function selectChar(charId: string): void {
  lobby.myChar = charId;
  prepare.charId = charId;
  setSelectedCharacter(charId);
  net.sendCharSelect(charId);
  if (myReady()) {
    lobby.myReady = false;
    net.sendReady(false);
  }
}

/**
 * 房间内选阵营（非对称模式）：
 * 点击阵营卡片 → 本地合并检查（已满则拒绝）→ 上报服务器仲裁 → 换阵营后重置准备。
 * 服务器为最终权威；客户端仅做前置提示。
 */
function selectFaction(fc: FactionCard): void {
  const me = room.players.find(p => p.id === room.playerId);
  if (me?.faction === fc.faction) return; // 已在同阵营，无需切换

  const isKeeper = fc.faction === 'keeper';
  const limit = isKeeper ? KEEPER_SLOTS : SURVIVOR_SLOTS;
  const members = room.players.filter(p => p.faction === fc.faction);
  if (members.length >= limit) {
    lobby.status = isKeeper ? '✕ 少方阵营已满' : '✕ 多方阵营已满（上限 4 人）';
    lobby.statusColor = '#ff8ab0';
    return;
  }
  // 换阵营：上报服务器（服务器仲裁并取消准备）
  lobby.status = '切换阵营中…';
  lobby.statusColor = '#bfe9ff';
  lobby.myFaction = fc.faction;
  net.sendFactionSelect(fc.faction);
  // 乐观取消准备（服务器仲裁成功后广播，届时以广播为准）
  lobby.myReady = false;
}

/** 本机是否已准备（以房间列表为准） */
function myReady(): boolean {
  const p = room.players.find(x => x.id === room.playerId);
  return p?.ready ?? false;
}

/** 退出房间：断开连接并复位，经 ui.show 唯一入口返回准备界面 */
function leaveRoom(): void {
  if (room.connected) {
    net.disconnect();
    resetRoom();
    resetRemotes();
  }
  lobby.inRoom = false;
  lobby.myReady = false;
  lobby.myFaction = '';
  lobby.factionPending = false;
  lobby.mode = 'none';
  ui.show('prepare');
}

/* ==================== 连接逻辑 ==================== */

/** 执行创建/加入（由 buildLobbyScene 内部闭包调用，直接读组件值） */
async function connectLobby(
  getValues: () => { name: string; ip: string; port: string },
): Promise<void> {
  if (lobby.mode === 'none') return;

  const vals = getValues();
  const name = vals.name.trim() || DEFAULT_NAME;
  const port = parseInt(vals.port, 10);
  const finalPort = isNaN(port) || port < 1 || port > 65535 ? 8810 : port;
  const host = lobby.mode === 'create' ? '127.0.0.1' : vals.ip.trim() || '127.0.0.1';

  lobby.status = lobby.mode === 'create' ? '正在连接本地服务器...' : '正在连接 ' + host + ':' + finalPort + ' ...';
  lobby.statusColor = '#bfe9ff';

  try {
    // 创建房间时把所选玩法模式一并上报（房主权威；客机 join 不传）
    const mode = lobby.mode === 'create' ? prepare.gameMode : undefined;
    await net.connect(host, finalPort, name, prepare.charId, mode);
    // 连接成功 → 进入房间界面（不再立即开始游戏）
    lobby.inRoom = true;
    lobby.myReady = false;
    lobby.myChar = prepare.charId;
    lobby.status = room.role === 'host'
      ? '✓ 房主已就绪'
      : '✓ 已加入 ' + host + ':' + finalPort;
    lobby.statusColor = room.role === 'host' ? '#7df9ff' : '#8ff6ff';
  } catch (e) {
    lobby.status = '✕ ' + (e instanceof Error ? e.message : '连接失败');
    lobby.statusColor = '#ff8ab0';
  }
}