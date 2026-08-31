/**
 * 玩家持有物品的通用表现 —— 在玩家"手部"位置绘制当前选中槽位的持有物。
 *
 * 通用持有语义（本地与远程玩家共用同一入口）：
 *  当前选中槽位（p.backpack[p.selectedSlot]）决定的持有物：
 *   - 'ak' → 持枪（AK 步枪图标）
 *   - 'grenade' → 手持手雷
 *   - 'hook' → 手持钩锁
 *   - 被动道具 / 空格 → 无持有物
 * 与钩锁/AK/手雷"选中槽位才能使用"的主动道具语义一致。
 *
 * 纯表现层：只读 PlayerState，绘制 canvas，无副作用、不写状态。
 * 调用方（systems/game 渲染）在 drawPlayer / drawPlayerFor 之后追加本绘制。
 *
 * 朝向：本地玩家传 aim（枪口旋转到鼠标方向）；远程玩家不传 → 按 face 水平朝向。
 */
import { ctx } from '../../core/canvas';
import { sx, sy, view } from '../../core/camera';
import type { ItemId, PlayerState, Vector2 } from '../../types';
import { drawWeaponIcon, drawGrenadeIcon } from '../../Prefabs/WeaponVis';
import { drawHookIcon } from '../ui/icons';
import { WEAPONS } from '../../config/weapons';

/** 持有物可见标识（由选中槽位的道具决定） */
export type HeldItemVisual = 'ak' | 'grenade' | 'shotgun' | 'awm' | 'rocket' | 'iceBomb' | 'hook';

/** 判定玩家当前持有的可见物品（null = 无持有物） */
export function heldItemVisual(p: PlayerState): HeldItemVisual | null {
  const sel: ItemId | undefined = p.backpack[p.selectedSlot];
  if (sel === 'ak') return 'ak';
  if (sel === 'grenade') return 'grenade';
  if (sel === 'shotgun') return 'shotgun';
  if (sel === 'awm') return 'awm';
  if (sel === 'rocket') return 'rocket';
  if (sel === 'iceBomb') return 'iceBomb';
  if (sel === 'hook') return 'hook';
  return null;
}

/**
 * 是否为枪械类持有物 —— 按 WEAPONS 配置的 category 标签判定。
 * （新加枪械只要在 WEAPONS 里标 category: 'gun'，即自动获得枪械持有方式。）
 */
function isGunVisual(vis: HeldItemVisual): boolean {
  if (vis === 'hook') return false;
  return WEAPONS[vis].category === 'gun';
}

/** 在玩家手部位置绘制持有物品图标（世界坐标 → 屏幕；aim 传入时枪口旋转到瞄准方向） */
export function drawHeldItem(p: PlayerState, aim?: Vector2): void {
  const vis = heldItemVisual(p);
  if (!vis || p.dead) return;

  const px = sx(p.x);
  const py = sy(p.y);
  const r = Math.max(10, 0.46 * view.SZ); // 玩家身体半径（px）
  const baseSize = Math.max(9, r * 0.62);  // 常规道具持有尺度
  // 方向：本地=鼠标瞄准（旋转枪口），远程=面朝方向（水平）
  const dir = aim ?? { x: p.face, y: 0 };
  // aim 为世界坐标（y 向上），画布 y 向下 —— 取 -dir.y 转成屏幕角，避免枪口上下颠倒
  const ang = Math.atan2(-dir.y, dir.x);

  ctx.save();
  if (isGunVisual(vis)) {
    // 枪械类（category === 'gun'）：相对其他道具更靠近玩家中心（略偏身前，但非正中心），且放大
    const ax = px + Math.cos(ang) * r * 0.55;
    const ay = py + Math.sin(ang) * r * 0.35;
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    drawWeaponIcon(0, 0, Math.max(12, r * 0.7), vis);
  } else {
    // 其他道具：原手部持有位
    const hx = px + Math.cos(ang) * r * 1.3;
    const hy = py + r * 0.18 + Math.sin(ang) * r * 0.7;
    ctx.translate(hx, hy);
    ctx.rotate(ang);
    if (vis === 'grenade') drawGrenadeIcon(0, 0, baseSize);
    else if (vis === 'hook') drawHookIcon(0, 0, baseSize);
    else drawWeaponIcon(0, 0, baseSize, vis); // 火箭筒 / 冰冻炸弹等投掷/抛体类
  }
  ctx.restore();
}