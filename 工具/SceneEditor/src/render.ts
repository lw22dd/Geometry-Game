/**
 * 编辑器渲染 —— 基础几何层（旋转矩形）、场景物品层、选中框/手柄、绘制预览。
 */
import { ctx, VW, VH, PPM } from './canvas';
import { view, sx, sy, screenToWorld, snapToGrid } from './camera';
import type { EditorStore } from './store';
import { getPrefabEntry, getEntryForInstance } from './registry';
import type { MapInstance, RectItem } from './mapTypes';
import {
  instancePosition, instanceHitBounds, hitTest,
  rectCenter, rectRad, rotatedRectBounds, hitTestRect,
  rectWorldCorners, rectTopCenter, placeInstanceAt,
} from './mapTypes';

/* ==================== 网格 ==================== */

export function renderGrid(): void {
  const left = view.SL, right = view.SL + VW / view.SZ;
  const bot = view.SB, top = view.SB + VH / view.SZ;

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

  ctx.strokeStyle = 'rgba(120,150,255,0.14)';
  ctx.beginPath();
  for (let x = Math.ceil(left / 5) * 5; x <= right; x += 5) {
    ctx.moveTo(sx(x), sy(bot)); ctx.lineTo(sx(x), sy(top));
  }
  for (let y = Math.ceil(bot / 5) * 5; y <= top; y += 5) {
    ctx.moveTo(sx(left), sy(y)); ctx.lineTo(sx(right), sy(y));
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(140,200,255,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx(0), sy(0)); ctx.lineTo(sx(10), sy(0));
  ctx.moveTo(sx(0), sy(0)); ctx.lineTo(sx(0), sy(10));
  ctx.stroke();
}

/* ==================== 工具 ==================== */

/** hex("#rrggbb") → "rgba(r,g,b,a)" */
function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ==================== MVMap 底盘可行走区视觉层（只读） ==================== */

/**
 * 渲染从 MVMap 导入的结构底盘：每块「可行走区」合并矩形按区域色平铺，
 * 内部叠加 1 米格线（MVMap 风格），作为只读背景层。
 *
 * 语义（模式 A / 恶魔城）：色块 = 区域 = 可行走空间，不是墙。
 * 可行走区之上叠加的实体（墙 / 平台 / 障碍）由 geometry 层提供。
 * 因此本层始终绘制在底层，geometry 叠加其上。
 */
export function renderFloor(store: EditorStore): void {
  const fc = store.map.layers.floorCells;
  const grid = store.map.layers.gridSize ?? 1;
  if (!fc || fc.length === 0) return;
  const vl = view.SL, vr = view.SL + VW / view.SZ;
  const vb = view.SB, vt = view.SB + VH / view.SZ;
  const sub = Math.max(0.5, grid); // 每格边长(米) → 格线间隔

  for (const c of fc) {
    if (c.x + c.w < vl || c.x > vr || c.y + c.h < vb || c.y > vt) continue;
    const px = sx(c.x), py = sy(c.y + c.h);
    const pw = c.w * view.SZ, ph = c.h * view.SZ;
    if (pw <= 0 || ph <= 0) continue;

    // 底色（半透明，柔和）
    ctx.fillStyle = hexToRgba(c.color, 0.24);
    ctx.fillRect(px, py, pw, ph);

    // 内部 1 米格线（清晰可见的「格子化」纹理）
    ctx.strokeStyle = hexToRgba(c.color, 0.45);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = c.x + sub; gx < c.x + c.w; gx += sub) {
      const gpx = sx(gx);
      ctx.moveTo(gpx, py); ctx.lineTo(gpx, py + ph);
    }
    for (let gy = c.y + sub; gy < c.y + c.h; gy += sub) {
      const gpy = sy(gy);
      ctx.moveTo(px, gpy); ctx.lineTo(px + pw, gpy);
    }
    ctx.stroke();

    // 外框
    ctx.strokeStyle = hexToRgba(c.color, 0.95);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px, py, pw, ph);
  }
}

/* ==================== 基础几何层渲染 ==================== */

/** 按世界角点绘制霓虹矩形（与 hitTestRect 同一世界约定，杜绝坐标系错位） */
function fillNeonRectCorner(r: RectItem): void {
  const c = rectCenter(r);
  const hue = 196 + 100 * Math.min(1, Math.max(0, c.x / 240 * 0.55 + c.y / 72 * 0.45));
  const pts = rectWorldCorners(r).map(p => [sx(p.x), sy(p.y)] as const);
  // 顺序：左下 → 右下 → 右上 → 左上

  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = 'rgba(15,11,42,.94)';
  ctx.fill();

  ctx.shadowColor = 'hsla(' + hue + ',100%,60%,.85)';
  ctx.shadowBlur = 12;
  ctx.strokeStyle = 'hsla(' + hue + ',95%,66%,.9)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 世界顶边（右上 ↔ 左上）亮线
  ctx.fillStyle = 'hsla(' + hue + ',100%,78%,.95)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(pts[2][0], pts[2][1]);
  ctx.lineTo(pts[3][0], pts[3][1]);
  ctx.stroke();
}

export function renderGeometry(store: EditorStore): void {
  const vl = view.SL, vr = view.SL + VW / view.SZ;
  const vb = view.SB, vt = view.SB + VH / view.SZ;
  for (const item of store.map.layers.geometry) {
    if (item.type !== 'rect') continue;
    // 旋转后 AABB 裁剪
    const b = rotatedRectBounds(item);
    if (b.x + b.w < vl || b.x > vr || b.y + b.h < vb || b.y > vt) continue;
    fillNeonRectCorner(item);
  }
}

/*==================== 对象层渲染 ==================== */

function renderOne(inst: MapInstance, time: number): void {
  const entry = getEntryForInstance(inst);
  const col = entry?.swatch || '#aaa';
  const sz = view.SZ;

  const pos = instancePosition(inst);
  const px = sx(pos.x), py = sy(pos.y);
  if (px < -200 || px > VW + 200 || py < -200 || py > VH + 200) return;

  const rotRad = (inst.rotation ?? 0) * Math.PI / 180;

  ctx.save();
  ctx.shadowColor = col + '66';
  ctx.shadowBlur = 8;

  if (rotRad !== 0) {
    // 对象旋转：绕锚点旋转。世界 Y 上、屏幕 Y 下 → 用 -rotRad 与 hitTest 一致
    ctx.translate(px, py);
    ctx.rotate(-rotRad);
    ctx.translate(-px, -py);
  }

  switch (inst.type) {
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
      const w = inst.w * sz, h = inst.h * sz;
      ctx.fillStyle = '#140e34';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
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
      ctx.fillStyle = col;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(sx(inst.x), sy(inst.y), 0.4 * sz, 0, Math.PI * 2);
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
      ctx.fillStyle = col + '44';
      ctx.fillRect(cx - 0.28 * sz, cy - 3.4 * sz, 0.56 * sz, 3.4 * sz);
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
      // 垂直（弹射力向上，宽>高）→ 上箭头；水平（弹射力向右，高>宽）→ 右箭头
      const horizontal = (inst as { toolId?: string }).toolId === 'springPadH' || inst.h > inst.w;
      const spx = sx(inst.x), spy = sy(inst.y + inst.h);
      const spw = inst.w * sz, sph = inst.h * sz;
      const mcx = spx + spw / 2, mcy = spy + sph / 2;
      ctx.fillStyle = '#142210';
      ctx.fillRect(spx, spy, spw, sph);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.strokeRect(spx, spy, spw, sph);
      ctx.strokeStyle = col;
      ctx.beginPath();
      if (horizontal) {
        // 指向右（弹射方向）
        const ax2 = spx + spw, ay = mcy;
        ctx.moveTo(ax2 - 0.3 * sz, ay + 0.2 * sz);
        ctx.lineTo(ax2, ay);
        ctx.lineTo(ax2 - 0.3 * sz, ay - 0.2 * sz);
      } else {
        // 指向上（弹射方向）
        ctx.moveTo(mcx, spy);
        ctx.lineTo(mcx, spy - 0.3 * sz);
        ctx.lineTo(mcx - 0.2 * sz, spy - 0.1 * sz);
        ctx.moveTo(mcx, spy - 0.3 * sz);
        ctx.lineTo(mcx + 0.2 * sz, spy - 0.1 * sz);
      }
      ctx.stroke();
      break;
    }
    case 'hookPickup': {
      const hx = sx(inst.x), hy = sy(inst.y);
      ctx.fillStyle = col;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(hx, hy, 0.4 * sz, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd27a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hx, hy + 0.4 * sz);
      ctx.lineTo(hx, hy - 0.3 * sz);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hx, hy - 0.3 * sz, 0.25 * sz, -Math.PI * 0.82, Math.PI * 1.02);
      ctx.stroke();
      break;
    }
    case 'shieldPickup': {
      // 蓝紫盾形 + V 型高光（与游戏内拾取物渲染一致）
      const hx = sx(inst.x), hy = sy(inst.y);
      ctx.save();
      ctx.translate(hx, hy);
      if (inst.rotation) ctx.rotate((inst.rotation * Math.PI) / 180);
      ctx.shadowColor = 'rgba(150,140,255,.9)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(0, 0, 0.5 * sz, Math.PI, 0);
      ctx.lineTo(0.5 * sz, 0.3 * sz);
      ctx.lineTo(0, 0.62 * sz);
      ctx.lineTo(-0.5 * sz, 0.3 * sz);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      // V 型高光
      ctx.strokeStyle = 'rgba(235,240,255,.9)';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-0.18 * sz, -0.12 * sz);
      ctx.lineTo(0, 0.16 * sz);
      ctx.lineTo(0.18 * sz, -0.12 * sz);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'track': {
      // 绘制轨道路径折线（预览简单线框 + 入口亮点）
      const pts: { x: number; y: number }[] = [];
      for (const seg of inst.segments) {
        if (seg.type === 'line') {
          pts.push({ x: sx(seg.x1), y: sy(seg.y1) });
          pts.push({ x: sx(seg.x2), y: sy(seg.y2) });
        } else {
          const steps = 20;
          for (let i = 0; i <= steps; i++) {
            const t = seg.startAngle + (seg.endAngle - seg.startAngle) * (i / steps);
            pts.push({ x: sx(seg.cx + Math.cos(t) * seg.radius), y: sy(seg.cy + Math.sin(t) * seg.radius) });
          }
        }
      }
      ctx.strokeStyle = col + '77';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
        else ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      // 入口亮点
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(sx(inst.x), sy(inst.y), 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }

  ctx.restore();
  ctx.shadowBlur = 0;
}

export function renderObjects(store: EditorStore, time: number): void {
  for (const inst of store.map.layers.objects) {
    renderOne(inst, time);
  }
}

/* ==================== 选中高亮 ==================== */

/** 绘制旋转矩形的选中框 + 角手柄 + 旋转手柄（基于世界角点，与 hitTest 一致） */
function renderRectSelection(r: RectItem): void {
  const pts = rectWorldCorners(r).map(p => [sx(p.x), sy(p.y)] as const);
  const top = rectTopCenter(r);
  const tpx = sx(top.x), tpy = sy(top.y);

  // 虚线外框（沿角点绘制）
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#8ff6ff';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#8ff6ff';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;

  // 4 个角手柄
  ctx.fillStyle = '#8ff6ff';
  ctx.strokeStyle = '#0a0820';
  ctx.lineWidth = 1.5;
  for (const [px, py] of pts) {
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // 旋转手柄（顶部中心上方）
  const rhY = tpy - 16;
  ctx.beginPath();
  ctx.arc(tpx, rhY, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd700';
  ctx.fill();
  ctx.strokeStyle = '#0a0820';
  ctx.stroke();
  // 连接杆
  ctx.beginPath();
  ctx.moveTo(tpx, tpy);
  ctx.lineTo(tpx, rhY);
  ctx.strokeStyle = 'rgba(255,215,0,.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}

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
  for (const sel of store.selection) {
    if (sel.layer === 'geometry') {
      const item = store.map.layers.geometry[sel.index];
      if (item && item.type === 'rect') renderRectSelection(item);
    } else if (sel.layer === 'objects') {
      const inst = store.map.layers.objects[sel.index];
      if (inst) drawHitBox(instanceHitBounds(inst), '#8ff6ff', 2, [4, 4]);
    }
  }
}

/** 悬停高亮：鼠标下方几何或对象（与点击判定一致） */
export function renderHover(store: EditorStore, mx: number, my: number): void {
  if (store.mode === 'objects' && !store.objTool) return;

  // 对象在上：先测对象，再测几何
  for (let i = store.map.layers.objects.length - 1; i >= 0; i--) {
    const inst = store.map.layers.objects[i];
    if (hitTest(inst, mx, my)) {
      drawHitBox(instanceHitBounds(inst), 'rgba(143,246,255,0.45)', 1.5, [2, 3]);
      return;
    }
  }
  for (let i = store.map.layers.geometry.length - 1; i >= 0; i--) {
    const item = store.map.layers.geometry[i];
    if (item.type === 'rect' && hitTestRect(item, mx, my)) {
      drawHitBox(rotatedRectBounds(item), 'rgba(143,246,255,0.45)', 1.5, [2, 3]);
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

/* ==================== 对象放置预览 ==================== */

export function renderGhost(store: EditorStore, mx: number, my: number): void {
  if (!store.objTool) return;
  const entry = getPrefabEntry(store.objTool);
  if (!entry) return;
  const inst = entry.defaults();
  const wx = snapToGrid(mx, store.snap);
  const wy = snapToGrid(my, store.snap);
  placeInstanceAt(inst, wx, wy);

  ctx.save();
  ctx.globalAlpha = 0.5;
  renderOne(inst, 0);
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

/** 更新底部状态栏分项：模式/工具、缩放、对象计数（#statusInfo / #statusZoom / #statusObjCount） */
export function updateStatusBar(store: EditorStore): void {
  const infoEl = document.getElementById('statusInfo');
  if (infoEl) {
    let info = '就绪';
    if (store.mode === 'geometry') {
      info = '基础几何 · 选择/移动';
    } else {
      const entry = store.objTool ? getPrefabEntry(store.objTool) : null;
      info = `场景物品${entry ? ' · ' + entry.name : ' · 选择'}`;
    }
    infoEl.textContent = info;
  }

  const zoomEl = document.getElementById('statusZoom');
  if (zoomEl) {
    zoomEl.textContent = `缩放: ${Math.round((view.SZ / 48) * 100)}%`;
  }

  const countEl = document.getElementById('statusObjCount');
  if (countEl) {
    countEl.textContent = `几何: ${store.map.layers.geometry.length} | 对象: ${store.map.layers.objects.length} | ${store.map.width}×${store.map.height}`;
  }
}

/** 更新状态栏鼠标世界坐标（#statusMouse） */
export function updateMouseStatus(wx: number, wy: number): void {
  const el = document.getElementById('statusMouse');
  if (!el) return;
  el.textContent = `X: ${wx.toFixed(1)}, Y: ${wy.toFixed(1)}`;
}