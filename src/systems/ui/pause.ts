/**
 * 暂停菜单 —— ESC 暂停界面（场景构建）。
 * 联机创建/加入房间按钮在此展示。
 * 通过 buildPauseScene() 构建场景，由 scenes.ts 组合根注册。
 */
import { ctx, VW, VH } from '../../core/canvas';
import { room } from '../../net/room';
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

/**
 * 构建暂停场景。
 */
export function buildPauseScene(a: PauseActions): UIScene {
  const btnW = 280, btnH = 48, btnX = VW / 2 - btnW / 2;
  let btnY = VH / 2 - 170 + 100;

  const pw = 440, px = VW / 2 - pw / 2, py = VH / 2 - 170;

  const mkButton = (id: string, label: string, y: number, onClick: () => void) =>
    new Button({ id, label, variant: 'plain', x: btnX, y, w: btnW, h: btnH, onClick });

  const btnResume = mkButton('pause_resume', '▶ 继续游戏', btnY, a.onResume);
  const btnDisconnect = mkButton('pause_disconnect', '✕ 断开连接', btnY + 60, a.onDisconnect);
  const btnDev = mkButton('pause_dev', '开发者设置', btnY + 120, a.onDevSettings);

  // 设置（音量 / 画质）—— 以叠层打开，返回时回到暂停界面
  const btnSettings = mkButton('pause_settings', '设置', btnY + 180, () => {
    ui.pushOverlay(UI_SCENE.SETTINGS);
  });

  // 左上角返回主菜单按钮（始终可见；联机中断开并复位房间）
  const btnMainMenu = mkButton('pause_mainmenu', '返回主菜单', py + 14, a.onReturnToMenu);
  btnMainMenu.x = px + 14;
  btnMainMenu.y = py + 14;
  btnMainMenu.w = 150;
  btnMainMenu.h = 34;

  // 右上角关闭按钮
  const closeBtn = new Button({
    id: 'pause_close',
    label: '',
    variant: 'icon',
    x: px + pw - 42, y: py + 14, w: 30, h: 30,
    onClick: a.onResume,
  });

  // 场景绘制：面板 + 联机状态 + 玩家列表（组件之外的装饰）
  function drawPanel(t: number): void {
    const tt = tickLocal(_pauseTime);
    const en = _ease(tt / 0.3);
    if (en <= 0) return;

    const pw = 440, ph = 340;
    const px = VW / 2 - pw / 2, py = VH / 2 - ph / 2 + (1 - en) * 30;

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

    // 玩家列表（联机时，按钮下方）
    if (room.connected) {
      const listY = py + 100 + 60 + 48; // 按钮下方（resume + disconnect 之后）
      ctx.textAlign = 'left';
      ctx.font = '500 14px "Segoe UI","Microsoft YaHei",Arial';
      ctx.fillStyle = 'rgba(180,200,255,.7)';
      ctx.fillText('在线玩家 (' + room.players.length + ')', btnX, listY);
      for (let i = 0; i < room.players.length; i++) {
        const p = room.players[i];
        ctx.fillStyle = p.id === room.playerId ? '#7df9ff' : 'rgba(200,220,255,.8)';
        ctx.fillText(
          (p.id === room.playerId ? '● ' : '○ ') + p.name,
          btnX + 20, listY + 24 + i * 22,
        );
      }
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

/** 组件可见性联动：联机时隐藏断开连接按钮？否——显示断开 */
export function syncPauseWidgets(scene: UIScene): void {
  const get = (id: string) => scene.widgets.find(w => w.id === id);
  const connected = room.connected;
  const btnDisconnect = get('pause_disconnect');
  if (btnDisconnect) btnDisconnect.visible = connected;

  // 开发者按钮：无创建/加入按钮后固定一行
  const btnDev = get('pause_dev');
  if (btnDev) {
    (btnDev as Button).y = VH / 2 - 170 + 100 + 120;
  }
}

const _ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);