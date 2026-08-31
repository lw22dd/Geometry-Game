/**
 * 钩锁系统 —— 主动道具"钩锁"的发射、绳索物理与瞄准渲染。
 *
 * 玩法：拥有钩锁（背包 active 道具）时，鼠标方向引导钩锁发射方向
 * （非追踪鼠标坐标），左键发射一条长度 10 格（世界单位）的方向射线，
 * 命中墙面/平台后玩家沿直线轨道匀速滑向锚点**安全位置**（自碰撞面外推
 * 玩家半径 + 余量，避免嵌入碰撞体被推挤到左右边缘），到站后：
 *   - 长按左键 → 锁定在锚点（拉住不动，绳索持续可见）
 *   - 松开左键 → 脱钩自由下坠
 * 未命中则钩锁收回（短暂收回动画 + 收手冷却）。
 *
 * 主动道具语义：仅当钩锁所在的背包槽位被选中（数字键 1-5）时，左键才会发射。
 *
 * 轨道复用 TrackState + stepTrackMotion：构造单直线段、dist=0、speed=HOOK_SPEED、
 * zipline=true，物理引擎走滑索分支；锁定期间 p.track 保持非空，逐帧重设玩家位置。
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
import { hasItem, ITEMS, type ActiveItemContext } from './backpack';
import { getHookTargets } from '../player';
import { sfx } from '../../core/audio';
import { WEAPONS } from '../../config/weapons';
import { raycastWorld, segRectT, type RayFace } from '../combat/raycast';

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

/**
 * 钩锁方向射线：从 (ox,oy) 沿方向 (dirX,dirY) 发射，长度 maxLen 格，
 * 命中最近的固体（平台/墙壁）返回锚点世界坐标及命中面；否则 null。
 * 几何复用公共 raycastWorld（systems/combat/raycast.ts）。
 */
export function raycastHook(
  ox: number, oy: number, dirX: number, dirY: number, maxLen: number,
): { x: number; y: number; face: RayFace } | null {
  const hit = raycastWorld(ox, oy, dirX, dirY, maxLen, getHookTargets());
  if (!hit) return null;
  const hitDist = Math.hypot(hit.x - ox, hit.y - oy);
  if (hitDist < HOOK_MIN_DIST) return null;
  return hit;
}

/* ==================== 发射 ==================== */

/** 释放用安全距离：锚点自命中面外推（玩家半径 + 余量），使玩家不嵌入碰撞体 */
const HOOK_SAFE_OFFSET = 0.5; // p.half(0.42) + 0.08 余量

/**
 * 钩锁命中面 → 安全锚点（自命中面沿法线外推，保证玩家 AABB 不重叠固体、
 * 脱钩/锁定时不被碰撞推挤到左右边缘）。
 * @param hit 射线命中点（世界坐标，位于固体表面）
 * @returns 安全锚点世界坐标
 */
export function hookSafeAnchor(
  hit: { x: number; y: number; face: 'left' | 'right' | 'bottom' | 'top' },
): { x: number; y: number } {
  switch (hit.face) {
    case 'left':   return { x: hit.x - HOOK_SAFE_OFFSET, y: hit.y };
    case 'right':  return { x: hit.x + HOOK_SAFE_OFFSET, y: hit.y };
    case 'bottom': return { x: hit.x, y: hit.y - HOOK_SAFE_OFFSET }; // 面朝下 → 外推下方
    case 'top':    return { x: hit.x, y: hit.y + HOOK_SAFE_OFFSET }; // 面朝上 → 外推上方
  }
}

/**
 * 发射钩锁（方向版）：
 *  - 命中：构造滑索 TrackState 写入 p.track（物理引擎接管），启动常规冷却。
 *    锚点取安全位置（见 hookSafeAnchor），玩家沿直线滑向锚点；
 *    到达后长按左键则锁定（拉住不动），松开左键脱钩下坠。
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

  // 锚点外推：底面/顶面/侧面一律取碰撞面外安全位置，杜绝"嵌进墙里被推挤到边缘"
  const anchor = hookSafeAnchor(hit);

  const seg: PathSegment = {
    type: 'line',
    x1: p.x,
    y1: p.y,
    x2: anchor.x,
    y2: anchor.y,
  };
  const len = Math.hypot(anchor.x - p.x, anchor.y - p.y);
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
 * 钩锁主动道具 onActivate（S7 槽位 ActiveItemSystem 调用；本地/远端共用）。
 * 冷却递减 + 左键按下沿 → 发射。内部自行判断选中槽位/冷却/状态。
 * @param ctx.hookEdge 本帧左键按下沿（本地=鼠标边沿；远端=input.hook 沿）
 * @param ctx.aim      发射方向（本地=鼠标引导；远端=客机上报 aim）
 */
function hookActivate(p: PlayerState, ctx: ActiveItemContext): void {
  p.hookCd = Math.max(0, p.hookCd - ctx.dt);
  p.hookMissT = Math.max(0, p.hookMissT - ctx.dt);
  if (p.dead || p.track || !hasItem(p.backpack, 'hook')) return;
  // 冷却中不可发射
  if (p.hookCd > 0) return;
  // 主动装备：必须选中钩锁所在槽位才能使用
  if (p.backpack[p.selectedSlot] !== 'hook') return;
  if (!ctx.hookEdge) return;
  fireHook(p, ctx.aim.x, ctx.aim.y, ctx.sfx !== false);
}

/** 注册钩锁主动道具（模块加载时生效；替代主循环硬编码 stepHookPlayer 调用） */
ITEMS['hook'].onActivate = hookActivate;

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
 * 鼠标准星（屏幕位置，呼吸；颜色可定制）——钩锁/武器瞄准共用。
 */
export function drawCrosshair(color: string = 'rgba(255,120,120,.8)'): void {
  const mx = mouse.x, my = mouse.y;
  const beat = 0.5 + 0.5 * Math.sin(t() * 6);
  ctx.save();
  ctx.strokeStyle = color;
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

/**
 * 武器瞄准准星：鼠标已引导且选中武器槽时绘制鼠标准星。
 * 覆盖全部武器（AK / 霰弹枪 / AWM / 手雷 / 火箭筒 / 冰冻炸弹）；
 * 钩锁有自己的 drawHookAim（含命中锚点菱形），此处只服务武器类瞄准。
 */
export function drawWeaponAim(p: PlayerState): void {
  if (p.dead || p.track || !mouse.used) return;
  const sel = p.backpack[p.selectedSlot];
  if (sel !== undefined && sel in WEAPONS) drawCrosshair('rgba(255,200,110,.85)');
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
  drawCrosshair(hit ? 'rgba(255,200,110,.9)' : 'rgba(255,120,120,.8)');
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