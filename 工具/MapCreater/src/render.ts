/**
 * 编辑器渲染 —— 网格、实例预览、选中高亮、放置预览。
 *
 * 当前使用编辑器自带的简化渲染（色块 + 图标），
 * 后续可引入游戏侧的渲染函数实现 WYSIWYG。
 */
import { ctx, VW, VH, PPM } from './canvas';
import { view, sx, sy, screenToWorld, snapToGrid } from './camera';
import type { EditorStore } from './store';
import { getPrefabEntry } from './registry';
import type { MapInstance } from './mapTypes';
import { instancePosition, instanceHitBounds, hitTest } from './mapTypes';

/* ==================== 网格 ==================== */

export function renderGrid(): void {
  const left = view.SL, right = view.SL + VW / view.SZ;
  const bot = view.SB, top = view.SB + VH / view.SZ;

  // 细网格（每 1 格）
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(120,150,255,0.06)';
  ctx.beginPath();
  for (let x = Math.ceil(left); x <= right; x += 1) {
    ctx.moveTo(sx(x), sy(bot)); ctx.lineTo(sx(x), sy(top));
  }
  for (let y = Math.ceil(bot); y <= top; y += 1) {
    ctx.moveTo(sx(left), sy(y)); ctx.lineTo(sx(right), sy(y));
  }
  ctx.stroke();

  // 粗网格（每 5 格）
  ctx.strokeStyle = 'rgba(120,150,255,0.14)';
  ctx.beginPath();
  for (let x = Math.ceil(left / 5) * 5; x <= right; x += 5) {
    ctx.moveTo(sx(x), sy(bot)); ctx.lineTo(sx(x), sy(top));
  }
  for (let y = Math.ceil(bot / 5) * 5; y <= top; y += 5) {
    ctx.moveTo(sx(left), sy(y)); ctx.lineTo(sx(right), sy(y));
  }
  ctx.stroke();

  // 坐标轴（原点）
  ctx.strokeStyle = 'rgba(140,200,255,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx(0), sy(0)); ctx.lineTo(sx(10), sy(0));
  ctx.moveTo(sx(0), sy(0)); ctx.lineTo(sx(0), sy(10));
  ctx.stroke();
}

/* ==================== 实例渲染 ==================== */

function renderOne(inst: MapInstance, h: number, time: number): void {
  const entry = getPrefabEntry(inst.type);
  const col = entry?.swatch || '#aaa';
  const sz = view.SZ;

  // 视口裁剪
  const pos = instancePosition(inst);
  const px = sx(pos.x), py = sy(pos.y);
  if (px < -200 || px > VW + 200 || py < -200 || py > VH + 200) return;

  ctx.save();
  ctx.shadowColor = col + '66';
  ctx.shadowBlur = 8;

  switch (inst.type) {
    case 'solid': {
      const x = sx(inst.x), y = sy(inst.y + inst.h);
      const w = inst.w * sz, hh = inst.h * sz;
      ctx.fillStyle = '#0f0b2a';
      ctx.fillRect(x, y, w, hh);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, hh);
      ctx.fillStyle = col;
      ctx.fillRect(x, y, w, 2);
      break;
    }
    case 'spike': {
      ctx.fillStyle = col;
      const x = sx(inst.x), y = sy(inst.y);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + sz, y);
      ctx.lineTo(x + sz * 0.5, sy(inst.y + 1));
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'deco': {
      const cpx = sx(inst.x), cpy = sy(inst.y);
      const r = inst.size * sz * 0.5;
      ctx.save();
      ctx.translate(cpx, cpy);
      ctx.rotate(time * inst.rotSpeed);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-r, -r, r * 2, r * 2);
      ctx.restore();
      break;
    }
    case 'hint': {
      ctx.font = `${Math.round(0.5 * sz)}px "Segoe UI","Microsoft YaHei",Arial`;
      ctx.fillStyle = col + '88';
      ctx.textAlign = 'center';
      ctx.fillText(inst.text, sx(inst.x), sy(inst.y));
      ctx.textAlign = 'left';
      break;
    }
    case 'mover': {
      const x = sx(inst.x0), y = sy(inst.y + inst.h);
      const w = inst.w * sz, hh = inst.h * sz;
      ctx.fillStyle = '#140e34';
      ctx.fillRect(x, y, w, hh);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, hh);
      // 轨迹线
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = 'rgba(150,170,255,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx(inst.x0), sy(inst.y + inst.h / 2));
      ctx.lineTo(sx(inst.x0 + inst.range + inst.w), sy(inst.y + inst.h / 2));
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    }
    case 'laser': {
      const lx = sx(inst.x), ly = sy(inst.y0 + inst.len);
      const lw = inst.len * sz;
      ctx.fillStyle = col + '44';
      ctx.fillRect(lx - 0.3 * sz, ly, 0.6 * sz, lw);
      ctx.fillStyle = col;
      ctx.fillRect(lx - 0.3 * sz, ly - 0.2 * sz, 0.6 * sz, 0.3 * sz);
      ctx.fillRect(lx - 0.3 * sz, ly + lw - 0.1 * sz, 0.6 * sz, 0.3 * sz);
      break;
    }
    case 'orb': {
      const ox = sx(inst.x), oy = sy(inst.y);
      ctx.fillStyle = col;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(ox, oy, 0.4 * sz, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'jumpBoost': {
      const jx = sx(inst.x), jy = sy(inst.y);
      ctx.fillStyle = col;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(jx, jy, 0.45 * sz, 0, Math.PI * 2);
      ctx.fill();
      // 上箭头标记
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(jx, jy + 0.3 * sz);
      ctx.lineTo(jx, jy - 0.3 * sz);
      ctx.lineTo(jx - 0.15 * sz, jy - 0.1 * sz);
      ctx.moveTo(jx, jy - 0.3 * sz);
      ctx.lineTo(jx + 0.15 * sz, jy - 0.1 * sz);
      ctx.stroke();
      break;
    }
    case 'checkpoint': {
      const cx = sx(inst.x), cy = sy(inst.y);
      ctx.fillStyle = col;
      ctx.fillRect(cx - 0.9 * sz, cy, 1.8 * sz, 0.3 * sz);
      // 光柱
      ctx.fillStyle = col + '44';
      ctx.fillRect(cx - 0.28 * sz, cy - 6.5 * sz, 0.56 * sz, 6.5 * sz);
      break;
    }
    case 'nova': {
      const nx = sx(inst.x), ny = sy(inst.y);
      const d = 0.72 * sz;
      ctx.fillStyle = col;
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.moveTo(nx, ny - d);
      ctx.lineTo(nx + d, ny);
      ctx.lineTo(nx, ny + d);
      ctx.lineTo(nx - d, ny);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'springPad': {
      const spx = sx(inst.x), spy = sy(inst.y + inst.h);
      const spw = inst.w * sz, sph = inst.h * sz;
      ctx.fillStyle = '#142210';
      ctx.fillRect(spx, spy, spw, sph);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.strokeRect(spx, spy, spw, sph);
      // 上箭头
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(spx + spw / 2, spy + sph);
      ctx.lineTo(spx + spw / 2, spy - 0.3 * sz);
      ctx.lineTo(spx + spw / 2 - 0.2 * sz, spy - 0.1 * sz);
      ctx.moveTo(spx + spw / 2, spy - 0.3 * sz);
      ctx.lineTo(spx + spw / 2 + 0.2 * sz, spy - 0.1 * sz);
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
  ctx.shadowBlur = 0;
  void time;
  void h;
}

export function renderInstances(store: EditorStore, time: number): void {
  for (const inst of store.map.instances) {
    renderOne(inst, 0, time);
  }
}

/* ==================== 选中高亮 ==================== */

/** 绘制矩形框（共享逻辑：选中/悬停/幽灵都用它） */
function drawHitBox(b: { x: number; y: number; w: number; h: number }, style: string, lineWidth: number, dash: number[]): void {
  const x = sx(b.x), y = sy(b.y + b.h);
  const w = b.w * view.SZ, h = b.h * view.SZ;
  ctx.save();
  ctx.setLineDash(dash);
  ctx.strokeStyle = style;
  ctx.lineWidth = lineWidth;
  ctx.shadowColor = style;
  ctx.shadowBlur = 6;
  ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
  ctx.setLineDash([]);
  ctx.restore();
}

export function renderSelection(store: EditorStore): void {
  if (store.selection.length === 0) return;
  for (const idx of store.selection) {
    const inst = store.map.instances[idx];
    if (!inst) continue;
    drawHitBox(instanceHitBounds(inst), '#8ff6ff', 2, [4, 4]);
  }
}

/** 悬停高亮：显示鼠标下方实例的命中区域（与点击判定一致） */
export function renderHover(store: EditorStore, mx: number, my: number): void {
  if (store.tool) return; // 放置模式下不显示悬停选中
  for (let i = store.map.instances.length - 1; i >= 0; i--) {
    if (store.selection.includes(i)) continue; // 已选中的不重复高亮
    if (hitTest(store.map.instances[i], mx, my)) {
      drawHitBox(instanceHitBounds(store.map.instances[i]), 'rgba(143,246,255,0.45)', 1.5, [2, 3]);
      return;
    }
  }
}

/* ==================== 出生点 ==================== */

export function renderSpawn(store: EditorStore): void {
  if (!store.map) return;
  const { x, y } = store.map.playerSpawn;
  const px = sx(x), py = sy(y);
  const isSelected = store.isSpawnSelected();

  // 点击区域光晕
  ctx.save();
  ctx.beginPath();
  ctx.arc(px, py, 14, 0, Math.PI * 2);
  ctx.fillStyle = isSelected ? 'rgba(125,249,255,0.15)' : 'rgba(125,249,255,0.06)';
  ctx.fill();
  if (isSelected) {
    ctx.strokeStyle = 'rgba(125,249,255,0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();

  ctx.save();
  ctx.translate(px, py);
  ctx.fillStyle = isSelected ? 'rgba(125,249,255,0.9)' : 'rgba(125,249,255,0.7)';
  ctx.strokeStyle = isSelected ? 'rgba(125,249,255,0.8)' : 'rgba(125,249,255,0.5)';
  ctx.lineWidth = 1.5;
  const d = isSelected ? 6 : 5;
  ctx.beginPath();
  ctx.moveTo(0, -d); ctx.lineTo(d, 0);
  ctx.lineTo(0, d);  ctx.lineTo(-d, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.font = '10px Arial';
  ctx.fillStyle = isSelected ? 'rgba(125,249,255,0.9)' : 'rgba(125,249,255,0.6)';
  ctx.textAlign = 'center';
  ctx.fillText('出生点', px, py - 10);
  ctx.textAlign = 'left';
}

/* ==================== 放置预览（幽灵） ==================== */

export function renderGhost(store: EditorStore, mx: number, my: number): void {
  if (!store.tool) return;
  const entry = getPrefabEntry(store.tool);
  if (!entry) return;
  const inst = entry.defaults();
  // 将鼠标位置对齐到网格
  const wx = snapToGrid(mx, store.snap);
  const wy = snapToGrid(my, store.snap);
  // 设置实例位置
  if (inst.type === 'mover') inst.x0 = wx;
  else if (inst.type === 'laser') { inst.x = wx; inst.y0 = wy; }
  else { inst.x = wx; inst.y = wy; }

  ctx.save();
  ctx.globalAlpha = 0.5;
  renderOne(inst, 0, 0);
  // 命中区域（与点击判定一致）
  drawHitBox(instanceHitBounds(inst), 'rgba(255,255,255,0.5)', 1.5, [3, 3]);
  ctx.restore();
}

/* ==================== 地图边框 ==================== */

export function renderMapBounds(store: EditorStore): void {
  if (!store.map) return;
  const { width, height } = store.map;
  ctx.save();
  ctx.strokeStyle = 'rgba(150,120,255,0.5)';
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(120,90,255,0.6)';
  ctx.shadowBlur = 12;
  ctx.strokeRect(sx(0), sy(height), width * view.SZ, height * view.SZ);
  ctx.restore();
}

/* ==================== 状态栏 ==================== */

export function updateStatusBar(store: EditorStore): void {
  const el = document.getElementById('statusBar')!;
  const parts: string[] = [];
  parts.push(`实例数: ${store.map.instances.length}`);
  parts.push(`尺寸: ${store.map.width}×${store.map.height}`);
  if (store.tool) {
    const entry = getPrefabEntry(store.tool);
    parts.push(`工具: ${entry?.name || store.tool}`);
  }
  parts.push(`吸附: ${store.snap}`);
  el.textContent = parts.join(' · ');
}