/**
 * 暂停菜单 —— ESC 暂停界面（场景构建）。
 * 联机创建/加入房间按钮在此展示。
 * 通过 buildPauseScene() 构建场景，由 scenes.ts 组合根注册。
 */
import { ctx, VW, VH } from '../../core/canvas';
import { rr } from '../../core/math';
import { room } from '../../net/room';
import { Button, UI_SCENE } from '../../core/uiComponent';
import type { UIScene } from '../../core/uiComponent';

/** 暂停菜单动画计时 */
let _pauseT = 0;
let _pauseLast = 0;

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
    const nowMs = performance.now();
    if (_pauseLast) _pauseT += Math.min(0.05, (nowMs - _pauseLast) / 1000);
    _pauseLast = nowMs;
    const tt = _pauseT;
    const en = _ease(tt / 0.3);
    if (en <= 0) return;

    const pw = 440, ph = 340;
    const px = VW / 2 - pw / 2, py = VH / 2 - ph / 2 + (1 - en) * 30;

    ctx.save();
    ctx.globalAlpha = en;

    // 半透明遮罩
    ctx.fillStyle = 'rgba(5,3,16,' + (0.7 * en) + ')';
    ctx.fillRect(0, 0, VW, VH);

    ctx.shadowColor = 'rgba(80,60,200,.4)';
    ctx.shadowBlur = 30;
    rr(ctx, px, py, pw, ph, 16);
    ctx.fillStyle = 'rgba(10,8,32,.85)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(130,160,255,.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 标题
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 28px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = '#bfe9ff';
    ctx.fillText('暂停', VW / 2, py + 52);

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
    widgets: [btnResume, btnDisconnect, closeBtn, btnDev, btnMainMenu],
    draw: drawPanel,
    onEnter: () => { _pauseT = 0; _pauseLast = 0; },
    onExit: () => {
      for (const w of [btnResume, btnDisconnect, closeBtn, btnDev, btnMainMenu]) w.hover = false;
      const c = ctx.canvas;
      if (c) c.style.cursor = 'default';
    },
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