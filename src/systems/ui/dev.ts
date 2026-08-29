/**
 * 开发者工具 —— 状态、FPS 统计、设置场景、坐标网格绘制、调试 HUD。
 */
import { ctx, VW, VH } from '../../core/canvas';
import { sx, sy, view } from '../../core/camera';
import { PPM } from '../../core/canvas';
import { Toggle, Button, UI_SCENE } from '../../core/uiComponent';
import type { UIScene } from '../../core/uiComponent';
import { playerController } from '../player';
import { drawMask, drawGlassPanel, drawTitle, resetHover } from './primitives';

/* ==================== 状态 ==================== */

const dev = {
  showGrid: false,
  showDebug: false,
};

/* ==================== FPS 统计（EMA） ==================== */

let _fps = 60;
let _lastFpsTime = 0;

/** 帧回调时调用，更新 FPS 平滑值 */
export function tickFPS(nowMs: number): void {
  if (_lastFpsTime === 0) { _lastFpsTime = nowMs; return; }
  const dt = (nowMs - _lastFpsTime) / 1000;
  _lastFpsTime = nowMs;
  if (dt < 1e-6) return;
  const inst = 1 / dt;
  _fps += (inst - _fps) * 0.08;
}

/** 当前 FPS（平滑值） */
function getFPS(): number {
  return _fps;
}

/* ==================== 坐标系网格绘制 ==================== */

const GRID = 5; // 每 5 格一条主线

/** 绘制开发者坐标网格（全场景覆盖，开关打开时由 renderGame 调用） */
export function drawDevGrid(): void {
  if (!dev.showGrid) return;

  const vw = VW / (PPM * view.zoom);
  const vh = VH / (PPM * view.zoom);
  const left = view.SL, right = view.SL + vw;
  const bot = view.SB, top = view.SB + vh;

  // 网格线（每 GRID=5 格一条，半透明细线）
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(140,220,255,.10)';
  ctx.beginPath();
  for (let x = Math.ceil(left / GRID) * GRID; x <= right; x += GRID) {
    ctx.moveTo(sx(x), sy(bot)); ctx.lineTo(sx(x), sy(top));
  }
  for (let y = Math.ceil(bot / GRID) * GRID; y <= top; y += GRID) {
    ctx.moveTo(sx(left), sy(y)); ctx.lineTo(sx(right), sy(y));
  }
  ctx.stroke();

  // 坐标轴（世界原点 (0,0) 向正方向延伸）
  const ox = 0, oy = 0;
  const axLen = Math.min(GRID * 6, Math.max(right, top)); // 轴长度
  const axEndX = Math.min(ox + axLen, right);
  const axEndY = Math.min(oy + axLen, top);

  ctx.lineWidth = 2.5;
  // X 轴（青色）
  ctx.strokeStyle = 'rgba(125,249,255,.6)';
  ctx.beginPath();
  ctx.moveTo(sx(ox), sy(oy));
  ctx.lineTo(sx(axEndX), sy(oy));
  ctx.stroke();
  if (axEndX > ox) {
    const axX = sx(axEndX), axY = sy(oy);
    ctx.beginPath();
    ctx.moveTo(axX, axY);
    ctx.lineTo(axX - 8, axY - 5);
    ctx.lineTo(axX - 8, axY + 5);
    ctx.closePath();
    ctx.fillStyle = 'rgba(125,249,255,.6)';
    ctx.fill();
  }

  // Y 轴（粉色）
  ctx.strokeStyle = 'rgba(255,138,216,.6)';
  ctx.beginPath();
  ctx.moveTo(sx(ox), sy(oy));
  ctx.lineTo(sx(ox), sy(axEndY));
  ctx.stroke();
  if (axEndY > oy) {
    const ayX = sx(ox), ayY = sy(axEndY);
    ctx.beginPath();
    ctx.moveTo(ayX, ayY);
    ctx.lineTo(ayX - 5, ayY + 8);
    ctx.lineTo(ayX + 5, ayY + 8);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,138,216,.6)';
    ctx.fill();
  }

  // 原点标签 (0,0)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = '600 12px "Segoe UI",Arial';
  ctx.fillStyle = 'rgba(200,220,255,.7)';
  ctx.fillText('(0,0)', sx(0), sy(0) - 4);

  // 刻度数字（世界坐标绝对值，锚定在轴线上）
  ctx.font = '500 10px "Segoe UI",Arial';
  ctx.fillStyle = 'rgba(180,200,255,.45)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let x = Math.ceil(left / GRID) * GRID; x <= right; x += GRID) {
    if (x === 0) continue;
    ctx.fillText('' + x, sx(x), sy(0) + 4);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let y = Math.ceil(bot / GRID) * GRID; y <= top; y += GRID) {
    if (y === 0) continue;
    ctx.fillText('' + y, sx(0) - 6, sy(y));
  }

  // 出生点标记 ❖
  const spx = sx(6), spy = sy(4);
  ctx.save();
  ctx.translate(spx, spy);
  ctx.fillStyle = 'rgba(125,249,255,.8)';
  ctx.strokeStyle = 'rgba(125,249,255,.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const d = 5;
  ctx.moveTo(0, -d); ctx.lineTo(d, 0);
  ctx.lineTo(0, d);  ctx.lineTo(-d, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = '500 10px "Segoe UI",Arial';
  ctx.fillStyle = 'rgba(125,249,255,.65)';
  ctx.fillText('出生点', spx, spy - 8);
}

/* ==================== 调试 HUD ==================== */

/** 绘制调试 HUD（FPS + 坐标，左下角，开关打开时由 renderGame 调用） */
export function drawDebugHUD(): void {
  if (!dev.showDebug) return;

  const fps = getFPS();
  const pDev = playerController.getState();
  const wx = pDev.x, wy = pDev.y;
  const px = sx(wx), py = sy(wy);

  const x = 16, y = VH - 110;
  const lineH = 20;

  ctx.save();
  ctx.font = '600 13px "Consolas","Courier New",monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // 半透明背景
  ctx.fillStyle = 'rgba(8,6,26,.55)';
  ctx.fillRect(x - 4, y - 4, 220, lineH * 3 + 8);
  ctx.strokeStyle = 'rgba(130,160,255,.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 4, y - 4, 220, lineH * 3 + 8);

  ctx.fillStyle = '#8ff6ff';
  ctx.fillText('FPS: ' + fps.toFixed(1), x, y);

  ctx.fillStyle = '#cfe6ff';
  ctx.fillText('世界: (' + wx.toFixed(2) + ', ' + wy.toFixed(2) + ')', x, y + lineH);

  ctx.fillStyle = '#cfe6ff';
  ctx.fillText('屏幕: (' + px.toFixed(1) + ', ' + py.toFixed(1) + ')', x, y + lineH * 2);

  ctx.restore();
}

/* ==================== 开发者设置场景 ==================== */

interface DevActions {
  onBack: () => void;
}

/** 构建开发者设置场景 */
export function buildDevScene(a: DevActions): UIScene {
  const pw = 420, ph = 270;
  const px = VW / 2 - pw / 2, py = VH / 2 - ph / 2;
  const rowX = px + 32;
  let rowY = py + 80;

  const toggleGrid = new Toggle({
    id: 'dev_grid',
    label: '显示坐标系',
    checked: dev.showGrid,
    x: rowX, y: rowY, w: 360, h: 36,
    onChange: (v) => { dev.showGrid = v; },
  });
  rowY += 50;

  const toggleDebug = new Toggle({
    id: 'dev_debug',
    label: '显示调试信息（FPS / 坐标）',
    checked: dev.showDebug,
    x: rowX, y: rowY, w: 360, h: 36,
    onChange: (v) => { dev.showDebug = v; },
  });
  rowY += 60;

  const btnBack = new Button({
    id: 'dev_back',
    label: '← 返回',
    variant: 'plain',
    x: VW / 2 - 130, y: rowY, w: 260, h: 46,
    onClick: a.onBack,
  });

  function drawPanel(t: number): void {
    ctx.save();
    // 遮罩
    drawMask(0.7);

    drawGlassPanel(px, py, pw, ph, 16, { shadowAlpha: 0.4, shadowBlur: 30, fill: 'rgba(10,8,32,.88)', stroke: 'rgba(130,160,255,.4)' });

    drawTitle('开发者设置', py + 46, 24);

    // 同步 toggle 状态（checked 可能被外部修改）
    toggleGrid.checked = dev.showGrid;
    toggleDebug.checked = dev.showDebug;

    ctx.restore();
    void t;
  }

  return {
    name: UI_SCENE.DEV,
    widgets: [toggleGrid, toggleDebug, btnBack],
    draw: drawPanel,
    onEnter: () => {
      toggleGrid.checked = dev.showGrid;
      toggleDebug.checked = dev.showDebug;
    },
    onExit: () => resetHover(toggleGrid, toggleDebug, btnBack),
  };
}