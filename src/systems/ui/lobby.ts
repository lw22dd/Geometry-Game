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
import { Button, TextInput, UI_SCENE, ui } from '../../core/uiComponent';
import type { UIWidget, UIScene } from '../../core/uiComponent';

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
};

/* ---------- 大厅动画计时 ---------- */
let _lobbyT = 0;
let _lobbyLast = 0;

const _ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
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
  const startGameClick = (): void => {
    if (room.role !== 'host' || !allReady()) return;
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

  // ---- 布局：每次绘制前计算位置 ----
  function layoutConnect(): void {
    const pw = 460, ph = 400;
    const px = VW / 2 - pw / 2, py = VH / 2 - ph / 2;
    const labelX = px + 40;
    let iy = py + 88;

    fields.name.x = labelX; fields.name.y = iy; iy += 64;
    fields.ip.x = labelX; fields.ip.y = iy; iy += 64;
    fields.port.x = labelX; fields.port.y = iy; iy += 64;

    // 状态行 + 按钮
    iy += 34;
    btnConnect.x = VW / 2 - 130; btnConnect.y = iy;
    btnBack.x = VW / 2 - 130; btnBack.y = iy + 66;

    // 创建模式隐藏 IP 字段
    fields.ip.visible = lobby.mode === 'join';
  }

  function layoutRoom(): void {
    const pw = 960, ph = 560;
    const px = VW / 2 - pw / 2, py = VH / 2 - ph / 2;

    // 角色卡片：右侧两列
    const cardW = 240, cardH = 170, gap = 18;
    charCards.forEach((c, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      c.x = px + 430 + col * (cardW + gap);
      c.y = py + 160 + row * (cardH + gap);
      c.w = cardW; c.h = cardH;
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
    btnReady.visible = true;
    btnLeave.visible = true;
    btnStart.visible = room.role === 'host';

    // 按钮文案
    const r = myReadyNow();
    btnReady.label = r ? '✓ 已准备（点击取消）' : '准备';
    btnStart.label = allReady() ? '▶ 开始游戏' : '▶ 开始游戏（等待全员准备）';
  }

  // ---- 背景绘制 ----
  function drawPanel(t: number): void {
    const nowMs = performance.now();
    if (_lobbyLast) _lobbyT += Math.min(0.05, (nowMs - _lobbyLast) / 1000);
    _lobbyLast = nowMs;
    const tt = _lobbyT;
    const en = _ease(tt / 0.3);
    if (en <= 0) return;

    if (lobby.inRoom) {
      layoutRoom();
      drawRoom(tt, en);
      return;
    }

    layoutConnect();
    const pw = 460, ph = 400;
    const px = VW / 2 - pw / 2, py = VH / 2 - ph / 2 + (1 - en) * 26;

    ctx.save();
    ctx.globalAlpha = en;

    // 半透明遮罩
    ctx.fillStyle = 'rgba(5,3,16,' + (0.8 * en) + ')';
    ctx.fillRect(0, 0, VW, VH);

    ctx.shadowColor = 'rgba(80,60,200,.45)';
    ctx.shadowBlur = 34;
    rr(ctx, px, py, pw, ph, 16);
    ctx.fillStyle = 'rgba(10,8,32,.88)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(130,160,255,.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 标题
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 26px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = '#bfe9ff';
    ctx.fillText(lobby.mode === 'create' ? '🏠 创建房间' : '🔗 加入房间', VW / 2, py + 48);

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

    ctx.fillStyle = 'rgba(5,3,16,' + (0.82 * en) + ')';
    ctx.fillRect(0, 0, VW, VH);

    ctx.shadowColor = 'rgba(80,60,200,.45)';
    ctx.shadowBlur = 34;
    rr(ctx, px, py, pw, ph, 18);
    ctx.fillStyle = 'rgba(10,8,32,.92)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(130,160,255,.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 标题
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 26px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = '#bfe9ff';
    ctx.fillText(room.role === 'host' ? '🏠 我的房间' : '🔗 已加入房间', VW / 2, py + 48);
    ctx.font = '500 12px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = 'rgba(150,180,255,.55)';
    ctx.fillText('房间中的玩家选择角色，点击「准备」；全部准备后房主可开始', VW / 2, py + 84);

    // 左：玩家列表
    const lx = px + 40, ly = py + 118;
    rr(ctx, lx, ly, 360, 350, 12);
    ctx.fillStyle = 'rgba(6,4,20,.6)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,150,255,.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.font = '700 16px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = '#8ff6ff';
    ctx.fillText('玩家列表（' + room.players.length + '）', lx + 18, ly + 28);

    room.players.forEach((p, i) => {
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

    // 右：选择角色
    ctx.font = '700 16px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = '#8ff6ff';
    ctx.textAlign = 'left';
    ctx.fillText('选择角色', px + 430, py + 128);
    ctx.font = '500 12px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = 'rgba(160,185,255,.55)';
    ctx.fillText('点击卡片选择，重新选择后需重新准备', px + 430, py + 148);

    // 全员未准备提示
    ctx.textAlign = 'left';
    ctx.font = '500 13px "Segoe UI","Microsoft YaHei",Arial';
    if (room.role === 'client') {
      ctx.fillStyle = 'rgba(190,205,255,.6)';
      ctx.fillText('等待房主开始游戏…', px + 40, py + ph - 108);
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
      ...charCards, btnReady, btnStart, btnLeave,
    ],
    draw: drawPanel,
    onEnter: () => {
      _lobbyT = 0; _lobbyLast = 0;
      lobby.status = '';
      if (lobby.inRoom) {
        // 房间阶段：初始化本地选择状态
        const me = room.players.find(p => p.id === room.playerId);
        lobby.myChar = me?.char ?? prepare.charId;
        lobby.myReady = me?.ready ?? false;
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
      btnConnect.hover = false;
      btnBack.hover = false;
      btnReady.hover = false;
      btnStart.hover = false;
      btnLeave.hover = false;
      for (const c of charCards) c.hover = false;
      const c = ctx.canvas;
      if (c) c.style.cursor = 'default';
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
    await net.connect(host, finalPort, name, prepare.charId);
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