/**
 * 道具图标 —— 统一 HUD 背包栏（固定小尺寸）与图鉴拾取物（按 r 缩放）两套绘制。
 * 所有函数只画"道具本体形状"：以 (cx, cy) 为中心，r 为尺度单位。
 * 调用方负责 bob / 旋转 / 光晕等拾取物特效（图鉴）或槽位适配（HUD）。
 *
 * 建模单一来源 = Prefabs/ItemVis（普通道具）/ Prefabs/WeaponVis（武器）：
 * 本模块仅保留具名转发，既有调用方（hud / hold / projectile）签名不变。
 * 新增道具不再在此画形状 —— 去 ItemVis 加分支即可。
 */
import { ctx } from '../../core/canvas';
import { drawItemIcon } from '../../Prefabs/ItemVis';

/** 光球（二段跳拾取物 / 菜单目标行同款） */
export function drawOrbIcon(cx: number, cy: number, t: number, r: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.4);
  g.addColorStop(0, 'rgba(140,246,255,.5)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r * 2.4, 0, 6.283); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowColor = '#8ff6ff'; ctx.shadowBlur = 10;
  ctx.fillStyle = '#eaffff';
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 0, 6.283); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 1.8);
  ctx.strokeStyle = 'rgba(160,250,255,.9)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
  ctx.restore();
  ctx.restore();
}

/* ==================== 道具图标（转发 ItemVis 单一来源） ==================== */

/** 二段跳票：绿色上箭头 */
export function drawJumpTicketIcon(cx: number, cy: number, r: number): void {
  drawItemIcon('doubleJump', cx, cy, r);
}

/** 钩锁道具：金色钩形 */
export function drawHookIcon(cx: number, cy: number, r: number): void {
  drawItemIcon('hook', cx, cy, r);
}

/** 护盾道具：蓝紫盾形 */
export function drawShieldIcon(cx: number, cy: number, r: number): void {
  drawItemIcon('shield', cx, cy, r);
}

/** 加速道具：青色双箭头 */
export function drawSpeedIcon(cx: number, cy: number, r: number): void {
  drawItemIcon('speed', cx, cy, r);
}

// 武器图标（AK / 手雷）单一来源 = Prefabs/WeaponVis；此处 re-export 保持既有调用方不变
export { drawAKIcon, drawGrenadeIcon, drawWeaponIcon } from '../../Prefabs/WeaponVis';
