/**
 * 暂停菜单 —— ESC 暂停界面（场景构建）。
 * 联机创建/加入房间按钮在此展示。
 * 通过 buildPauseScene() 构建场景，由 scenes.ts 组合根注册。
 *
 * 布局：左栏按钮列 + 右侧在线玩家子面板（联机时）。入场动画让按钮与面板同步上移。
 */
import { ctx, VW, VH } from '../../core/canvas';
import { room } from '../../net/room';
import { rr } from '../../core/math';
import { Button, ui, UI_SCENE } from '../../core/uiComponent';
import type { UIScene } from '../../core/uiComponent';
import { tickLocal, drawMask, drawGlassPanel, drawTitle, resetHover } from './primitives';

/** 暂停菜单动画计时 */
const _pauseTime = { t: 0, last: 0 };

interface PauseActions {
  onResume: () => void;
  onDisconnect: () => void;
  onDevSettings: () => void;
  onReturnToMenu: () => void;
}

/** 面板几何（px / pyBase 基准，入场动画只叠加垂直偏移） */
const pw = 580, ph = 380;
const px = VW / 2 - pw / 2;
const pyBase = VH / 2 - ph / 2;
const btnW = 250, btnH = 48;
const btnX = px + 36;

/**
 * 构建暂停场景。
 */
export function buildPauseScene(a: PauseActions): UIScene {
  const mkButton = (id: string, label: string, onClick: () => void) =>
    new Button({ id, label, variant: 'plain', x: btnX, y: 0, w: btnW, h: btnH, onClick });

  const btnResume = mkButton('pause_resume', '▶ 继续游戏', a.onResume);
  const btnDisconnect = mkButton('pause_disconnect', '✕ 断开连接', a.onDisconnect);
  const btnDev = mkButton('pause_dev', '开发者设置', a.onDevSettings);

  // 设置（音量 / 画质）—— 以叠层打开，返回时回到暂停界面
  const btnSettings = mkButton('pause_settings', '设置', () => {
    ui.pushOverlay(UI_SCENE.SETTINGS);
  });

  // 左上角返回主菜单按钮（始终可见；联机中断开并复位房间）
  const btnMainMenu = new Button({
    id: 'pause_mainmenu', label: '返回主菜单', variant: 'plain',
    x: px + 14, y: 0, w: 150, h: 34,
    onClick: a.onReturnToMenu,
  });

  // 右上角关闭按钮
  const closeBtn = new Button({
    id: 'pause_close',
    label: '',
    variant: 'icon',
    x: px + pw - 42, y: 0, w: 30, h: 30,
    onClick: a.onResume,
  });

  /** 组件定位（en = 入场进度；off = 面板上浮量，按钮跟随，避免"按钮先到、面板后滑"） */
  function layout(en: number): void {
    const off = (1 - en) * 30;
    const base = pyBase + off;
    let by = base + 96;
    btnResume.y = by; by += 60;
    btnDisconnect.y = by;
    if (btnDisconnect.visible) by += 60; // 离线时断开按钮隐藏，开发者设置自动上移补空
    btnDev.y = by; by += 60;
    btnSettings.y = by;

    btnMainMenu.y = base + 14;
    closeBtn.y = base + 14;
  }

  // 场景绘制：面板 + 联机状态 + 右侧玩家列表（组件之外的装饰）
  function drawPanel(t: number): void {
    const tt = tickLocal(_pauseTime);
    const en = _ease(tt / 0.3);
    if (en <= 0) return;

    const off = (1 - en) * 30;
    const py = pyBase + off;

    layout(en);

    ctx.save();
    ctx.globalAlpha = en;

    // 半透明遮罩
    drawMask(0.7 * en);

    drawGlassPanel(px, py, pw, ph, 16, { shadowAlpha: 0.4, shadowBlur: 30, fill: 'rgba(10,8,32,.85)', stroke: 'rgba(130,160,255,.4)' });

    // 标题
    drawTitle('暂停', py + 52, 28);

    // 联机状态
    if (room.connected) {
      ctx.font = '500 13px "Segoe UI","Microsoft YaHei",Arial';
      ctx.fillStyle = room.role === 'host' ? '#7df9ff' : '#8ff6ff';
      ctx.fillText(
        room.role === 'host' ? '◆ 房主模式' : '◇ 客机模式',
        VW / 2, py + 80,
      );
    }

    // 玩家列表（联机时，右侧独立子面板；带裁剪防止溢出）
    if (room.connected) {
      const listX = px + 318, listY = py + 96;
      const listW = pw - 318 - 24, listH = ph - 96 - 40;

      rr(ctx, listX, listY, listW, listH, 12);
      ctx.fillStyle = 'rgba(6,4,20,.6)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,150,255,.25)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.save();
      rr(ctx, listX + 1, listY + 1, listW - 2, listH - 2, 11);
      ctx.clip();

      ctx.textAlign = 'left';
      ctx.font = '700 14px "Segoe UI","Microsoft YaHei",Arial';
      ctx.fillStyle = '#8ff6ff';
      ctx.fillText('在线玩家 (' + room.players.length + ')', listX + 14, listY + 24);

      ctx.font = '500 14px "Segoe UI","Microsoft YaHei",Arial';
      for (let i = 0; i < room.players.length; i++) {
        const p = room.players[i];
        ctx.fillStyle = p.id === room.playerId ? '#7df9ff' : 'rgba(200,220,255,.8)';
        ctx.fillText(
          (p.id === room.playerId ? '● ' : '○ ') + p.name,
          listX + 16, listY + 48 + i * 24,
        );
      }
      ctx.restore();
    }

    ctx.restore();
  }

  return {
    name: UI_SCENE.PAUSE,
    widgets: [btnResume, btnDisconnect, closeBtn, btnDev, btnSettings, btnMainMenu],
    draw: drawPanel,
    onEnter: () => { _pauseTime.t = 0; _pauseTime.last = 0; },
    onExit: () => resetHover(btnResume, btnDisconnect, closeBtn, btnDev, btnSettings, btnMainMenu),
  };
}

/** 组件可见性联动：联机时显示断开连接按钮（离线自动隐藏） */
export function syncPauseWidgets(scene: UIScene): void {
  const get = (id: string) => scene.widgets.find(w => w.id === id);
  const connected = room.connected;
  const btnDisconnect = get('pause_disconnect');
  if (btnDisconnect) btnDisconnect.visible = connected;
}

const _ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
