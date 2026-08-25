/**
 * 钩锁系统 —— 主动道具"钩锁"的发射、滑索轨道构造与瞄准渲染。
 *
 * 玩法：拥有钩锁（背包 active 道具）时，鼠标方向引导钩锁发射方向
 * （非追踪鼠标坐标），左键发射一条长度 10 格（世界单位）的方向射线，
 * 命中墙面/平台后玩家沿该直线轨道匀速滑行（滑索式，不受切向重力/摩擦/滚回影响），
 * 到锚点自动脱离并保留切线方向速度；未命中则钩锁收回（短暂收回动画 + 收手冷却）。
 *
 * 主动道具语义：仅当钩锁所在的背包槽位被选中（数字键 1-5）时，左键才会发射。
 *
 * 轨道复用 TrackState + stepTrackMotion：构造单直线段、dist=0、speed=HOOK_SPEED、
 * zipline=true，物理引擎走滑索分支。
 *
 * 联机：本地玩家走本模块（预测），房主在 stepRemoteClients 中为远程玩家
 * 调用 fireHook（方向来自客机上报 aimX/aimY 单位向量），轨迹经轨道网络字段同步。
 */
import type { PlayerState, Rect, TrackState } from '../../types';
import type { PathSegment } from '../../types/path';
import { mouse } from '../../core/mouse';
import { ctx, VW, VH } from '../../core/canvas';
import { sx, sy, view } from '../../core/camera';
import { HOOK_MAX_RANGE, HOOK_SPEED, HOOK_COOLDOWN, HOOK_RETRACT_TIME } from '../../config';
import { hasItem } from './backpack';
import { getSolids } from '../player';
import { sfx } from '../../core/audio';

/** 钩锁最小作用距离（格）：点射脚下的地板不产生退化滑索 */
const HOOK_MIN_DIST = 1.4;

/* ==================== 方向计算 ==================== */

/**
 * 鼠标引导的发射方向（单位向量）：玩家 → 鼠标世界位置（仅方向，长度恒为 1）。
 * 鼠标未移动过时回退为面朝方向（水平）。
 */
export function mouseAimDir(p: PlayerState): { x: number; y: number } {
  if (!mouse.used) return { x: p.face, y: 0 };
  const wx = view.SL + mouse.x / view.SZ;
  const wy = view.SB + (VH - mouse.y) / view.SZ;
  const dx = wx - p.x;
  const dy = wy - p.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/** 默认发射方向（面朝方向） */
export function defaultAimDir(p: PlayerState): { x: number; y: number } {
  return { x: p.face, y: 0 };
}

/* ==================== 射线检测 ==================== */

/** 线段-矩形最近交点参数 t∈[0,1]（slab 法）；无交点/null/起点在矩形内返回 null */
function segRectT(
  ox: number, oy: number, ux: number, uy: number, r: Rect,
): number | null {
  let tmin = 0;
  let tmax = 1;

  // X slab [r.x, r.x + r.w]
  if (Math.abs(ux) < 1e-9) {
    if (ox < r.x || ox > r.x + r.w) return null;
  } else {
    let t1 = (r.x - ox) / ux;
    let t2 = (r.x + r.w - ox) / ux;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }

  // Y slab [r.y, r.top]（top = y + h）
  if (Math.abs(uy) < 1e-9) {
    if (oy < r.y || oy > r.top) return null;
  } else {
    let t1 = (r.y - oy) / uy;
    let t2 = (r.top - oy) / uy;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }

  // 起点已在矩形内部（tmin=0）→ 本段命中无意义
  if (tmin <= 0) return null;
  return tmin;
}

/**
 * 钩锁方向射线：从 (ox,oy) 沿方向 (dirX,dirY) 发射，长度 maxLen 格，
 * 命中最近的固体（平台/墙壁）返回锚点世界坐标；否则 null。
 */
export function raycastHook(
  ox: number, oy: number, dirX: number, dirY: number, maxLen: number,
): { x: number; y: number } | null {
  const dLen = Math.hypot(dirX, dirY);
  if (dLen < 1e-4) return null;
  const ux = (dirX / dLen) * maxLen;
  const uy = (dirY / dLen) * maxLen;

  let bestT: number | null = null;
  for (const r of getSolids()) {
    const t = segRectT(ox, oy, ux, uy, r);
    if (t === null) continue;
    if (bestT === null || t < bestT) bestT = t;
  }
  if (bestT === null) return null;
  const hit = { x: ox + ux * bestT, y: oy + uy * bestT };
  const hitDist = Math.hypot(hit.x - ox, hit.y - oy);
  if (hitDist < HOOK_MIN_DIST) return null;
  return hit;
}

/* ==================== 发射 ==================== */

/**
 * 发射钩锁（方向版）：
 *  - 命中：构造滑索 TrackState 写入 p.track（物理引擎接管），启动常规冷却。
 *  - 未命中：钩锁收回（HOOK_RETRACT_TIME 内不可再射，显示收回动画），无轨道。
 * 远程玩家（房主模拟）复用此函数（playSfx=false，避免房主端替远程玩家出声）。
 * @returns true = 成功命中并发射
 */
export function fireHook(
  p: PlayerState,
  dirX: number, dirY: number,
  playSfx = true,
): boolean {
  const hit = raycastHook(p.x, p.y, dirX, dirY, HOOK_MAX_RANGE);
  if (!hit) {
    // 未命中：收回动画 + 短暂冷却
    p.hookMissT = HOOK_RETRACT_TIME;
    p.hookCd = HOOK_RETRACT_TIME;
    return false;
  }

  const seg: PathSegment = {
    type: 'line',
    x1: p.x,
    y1: p.y,
    x2: hit.x,
    y2: hit.y,
  };
  const len = Math.hypot(hit.x - p.x, hit.y - p.y);
  if (len < HOOK_MIN_DIST) {
    p.hookMissT = HOOK_RETRACT_TIME;
    p.hookCd = HOOK_RETRACT_TIME;
    return false;
  }

  p.track = {
    segments: [seg],
    cumulative: [0, len],
    dist: 0,
    speed: HOOK_SPEED,
    totalLength: len,
    entryDist: 0,
    exitDist: len,
    zipline: true,
  } as TrackState;
  p.grounded = false;
  p.plat = null;
  p.jbuf = 0;
  p.hookCd = HOOK_COOLDOWN;
  p.hookMissT = 0; // 清除收回动画
  if (playSfx) sfx.hook();
  return true;
}

/**
 * 本地玩家钩锁帧逻辑（game step 在物理步之后调用）：
 * 冷却递减 + 左键按下沿 → 发射（方向 = 鼠标引导方向 / 默认面朝方向）。
 * 仅当钩锁槽位被选中（active 装备语义）时发射。
 * @param hookEdge 本帧捕获的左键按下沿（mouse.down && !mouse.prevDown）
 */
export function stepHookPlayer(dt: number, p: PlayerState, hookEdge: boolean): void {
  p.hookCd = Math.max(0, p.hookCd - dt);
  p.hookMissT = Math.max(0, p.hookMissT - dt);
  if (p.dead || p.track || !hasItem(p.backpack, 'hook')) return;
  // 主动装备：必须选中钩锁所在槽位才能使用
  if (p.backpack[p.selectedSlot] !== 'hook') return;
  if (!hookEdge) return;

  const dir = mouse.used ? mouseAimDir(p) : defaultAimDir(p);
  fireHook(p, dir.x, dir.y);
}

/* ==================== 渲染 ==================== */

/** 游标时刻（供预览/收回复用） */
const t = (): number => performance.now() / 1000;

/** 描一段发光直线 */
function glowLine(x1: number, y1: number, x2: number, y2: number, color: string, width: number, alpha: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/**
 * 瞄准指示（游戏中、拥有钩锁、未死亡、未在轨且槽位选中时绘制）：
 * 只显示鼠标准星（屏幕位置）+ 命中锚点菱形；无虚线引导线。
 */
export function drawHookAim(p: PlayerState): void {
  if (p.dead || p.track || !hasItem(p.backpack, 'hook')) return;
  if (p.backpack[p.selectedSlot] !== 'hook') return;
  const dir = mouse.used ? mouseAimDir(p) : defaultAimDir(p);
  const hit = (p.dead || p.track) ? null : raycastHook(p.x, p.y, dir.x, dir.y, HOOK_MAX_RANGE);

  // 命中锚点菱形（命中时）
  if (hit) {
    const hx = sx(hit.x), hy = sy(hit.y);
    ctx.save();
    ctx.fillStyle = '#ffd27a';
    ctx.shadowColor = '#ffb347';
    ctx.shadowBlur = 8;
    const d = 5;
    ctx.beginPath();
    ctx.moveTo(hx, hy - d);
    ctx.lineTo(hx + d, hy);
    ctx.lineTo(hx, hy + d);
    ctx.lineTo(hx - d, hy);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 鼠标准星（屏幕位置，呼吸）
  const mx = mouse.x, my = mouse.y;
  const beat = 0.5 + 0.5 * Math.sin(t() * 6);
  ctx.save();
  ctx.strokeStyle = hit ? 'rgba(255,200,110,.9)' : 'rgba(255,120,120,.8)';
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.75 + 0.25 * beat;
  const rr = 9;
  ctx.beginPath();
  ctx.moveTo(mx - rr - 4, my); ctx.lineTo(mx - rr, my);
  ctx.moveTo(mx + rr, my); ctx.lineTo(mx + rr + 4, my);
  ctx.moveTo(mx, my - rr - 4); ctx.lineTo(mx, my - rr);
  ctx.moveTo(mx, my + rr); ctx.lineTo(mx, my + rr + 4);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(mx, my, rr, 0, 6.283); ctx.stroke();
  ctx.restore();
}

/** 滑索绳索渲染：玩家当前位置 → 锚点（段末点）的金色细线 + 锚点小钩 */
export function drawHookRope(p: PlayerState): void {
  const tk = p.track;
  if (tk && tk.zipline && tk.segments.length > 0) {
    // 滑索轨道的唯一段必为直线（fireHook 构造），取锚点 = 段末点
    const seg = tk.segments[0] as PathSegment & { x1: number; y1: number; x2: number; y2: number };
    const px = sx(p.x), py = sy(p.y);
    const hx = sx(seg.x2), hy = sy(seg.y2);
    glowLine(px, py, hx, hy, 'rgba(255,200,110,.9)', 2, 1);
    // 锚点钩
    ctx.save();
    ctx.fillStyle = '#ffcf8a';
    ctx.shadowColor = '#ffb347';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(hx, hy, 4, 0, 6.283);
    ctx.fill();
    ctx.restore();
    return;
  }

  // 未命中收回动画：钩锁沿发射方向缩回（hookMissT > 0 时绘制）
  if (!tk && p.hookMissT > 0 && !p.dead) {
    const dir = mouse.used ? mouseAimDir(p) : defaultAimDir(p);
    const prog = 1 - p.hookMissT / HOOK_RETRACT_TIME; // 0→1
    const len = HOOK_MAX_RANGE * (1 - prog);
    const ex = p.x + dir.x * len;
    const ey = p.y + dir.y * len;
    const px = sx(p.x), py = sy(p.y);
    glowLine(px, py, sx(ex), sy(ey), 'rgba(255,200,110,.6)', 2, 0.8 - prog * 0.6);
  }
}