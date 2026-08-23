/**
 * 联机大厅 —— 创建/加入房间界面（场景构建，组件化）。
 * TextInput ×3（昵称/IP/端口）+ Button ×2（连接/返回）。
 */
import { ctx, VW, VH } from '../../core/canvas';
import { rr } from '../../core/math';
import { room } from '../../net/room';
import { net } from '../../net';
import { Button, TextInput, UI_SCENE } from '../../core/uiComponent';
import type { UIScene } from '../../core/uiComponent';

export type LobbyMode = 'none' | 'create' | 'join';

/** 当前大厅状态（mode 由外部 controlling 显示/隐藏） */
export const lobby = {
  mode: 'none' as LobbyMode,
  status: '' as string,
  statusColor: '#bfe9ff',
};

/* ---------- 大厅动画计时 ---------- */
let _lobbyT = 0;
let _lobbyLast = 0;

const _ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const DEFAULT_NAME = '玩家' + Math.floor(Math.random() * 900 + 100);

export interface LobbyActions {
  /** 连接成功后进入游戏（房主/客机都调用） */
  onEnterGame: () => void;
  /** 返回暂停（关闭大厅） */
  onBack: () => void;
}

/** 构建大厅场景。需要先调用 openCreateLobby / openJoinLobby 设置 mode。 */
export function buildLobbyScene(a: LobbyActions): UIScene {
  // ---- 输入框组件 ----
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
    void connectLobby(fieldValues, a.onEnterGame);
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

  // ---- 按钮组件 ----
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

  // ---- 布局：每次绘制前根据 mode 计算位置 ----
  function layout(): void {
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

  // ---- 背景绘制 ----
  function drawPanel(t: number): void {
    const nowMs = performance.now();
    if (_lobbyLast) _lobbyT += Math.min(0.05, (nowMs - _lobbyLast) / 1000);
    _lobbyLast = nowMs;
    const tt = _lobbyT;
    const en = _ease(tt / 0.3);
    if (en <= 0) return;

    layout();
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

  return {
    name: UI_SCENE.LOBBY,
    widgets: [fields.name, fields.ip, fields.port, btnConnect, btnBack],
    draw: drawPanel,
    onEnter: () => {
      _lobbyT = 0; _lobbyLast = 0;
      lobby.status = '';
      // 聚焦第一个可用输入框
      fields.name.focused = true;
      fields.ip.focused = false;
      fields.port.focused = false;
    },
    onExit: () => {
      for (const f of Object.values(fields)) f.focused = false;
      btnConnect.hover = false;
      btnBack.hover = false;
      const c = ctx.canvas;
      if (c) c.style.cursor = 'default';
    },
  };
}

/* ==================== 大厅状态控制 ==================== */

/** 打开创建房间界面 */
export function openCreateLobby(): void {
  lobby.mode = 'create';
}

/** 打开加入房间界面 */
export function openJoinLobby(): void {
  lobby.mode = 'join';
}

/** 关闭大厅 */
export function closeLobby(): void {
  lobby.mode = 'none';
}

/** 大厅是否打开 */
export function lobbyOpen(): boolean {
  return lobby.mode !== 'none';
}

/* ==================== 连接逻辑 ==================== */

/** 执行创建/加入（由 buildLobbyScene 内部闭包调用，直接读组件值） */
export async function connectLobby(
  getValues: () => { name: string; ip: string; port: string },
  onEnterGame?: () => void,
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
    await net.connect(host, finalPort, name);
    lobby.status = room.role === 'host'
      ? '✓ 房主已就绪'
      : '✓ 已加入 ' + host + ':' + finalPort;
    lobby.statusColor = room.role === 'host' ? '#7df9ff' : '#8ff6ff';

    if (onEnterGame) {
      setTimeout(() => onEnterGame(), 50);
    }
  } catch (e) {
    lobby.status = '✕ ' + (e instanceof Error ? e.message : '连接失败');
    lobby.statusColor = '#ff8ab0';
  }
}