/**
 * ItemVis —— 普通道具外观预制体（建模单一来源，与 WeaponVis 同层）。
 *
 * 集中所有背包道具（二段跳票 / 钩锁 / 护盾 / 加速 / AK / 手雷）的本体建模与图标，
 * 场景拾取物（Prefabs/Scenes/items）与 HUD 背包图标（systems/ui/hud）、图鉴、持枪
 * 统一从这里取形状 —— 新增道具 = 本文件加一个分支，场景与背包图标自动绑定生效。
 *
 * API 分层：
 *  - drawItemModel(id, r)：纯本体（原点绘制，r 为尺度单位；无发光阴影），
 *    供场景拾取物绘制（泛光 / 旋转 / bob 等特效由调用方控制）。
 *  - drawItemIcon(id, cx, cy, r)：带发光阴影的图标（HUD 背包栏 / 图鉴 / 持枪用）；
 *    武器转发 WeaponVis（武器建模单一来源不变）。
 *  - ITEM_ICON_R：HUD 槽位内每道具的视觉尺度表（新增道具漏配时回退 10）。
 */
import { ctx } from '../../core/canvas';
import type { ItemId } from '../../types';
import { drawWeaponModel, drawAKIcon, drawGrenadeIcon } from '../WeaponVis';

/* ==================== 本体形状（原点绘制；r 为尺度单位） ==================== */

/** 二段跳票本体：绿色上行箭头 + 顶光高光 */
function drawJumpTicketShape(r: number): void {
  ctx.fillStyle = '#59ff8f';
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.15);
  ctx.lineTo(r * 0.62, -r * 0.15);
  ctx.lineTo(r * 0.24, -r * 0.15);
  ctx.lineTo(r * 0.24, r);
  ctx.lineTo(-r * 0.24, r);
  ctx.lineTo(-r * 0.24, -r * 0.15);
  ctx.lineTo(-r * 0.62, -r * 0.15);
  ctx.closePath();
  ctx.fill();
  // 顶光竖线（对应"顶光"语法）
  ctx.fillStyle = 'rgba(230,255,240,.9)';
  ctx.fillRect(-r * 0.08, -r * 1.02, r * 0.16, r * 0.88);
}

/** 钩锁本体：金色钩形（钩杆 + 弯钩 + 倒刺 + 顶部圆头） */
function drawHookShape(r: number): void {
  ctx.strokeStyle = '#ffc04d';
  ctx.lineWidth = r * 0.36;
  ctx.lineCap = 'round';
  // 钩杆：竖直
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.15);
  ctx.lineTo(0, r * 0.35);
  ctx.stroke();
  // 弯钩：从杆尾向左弯回（钩口朝左）
  ctx.beginPath();
  ctx.arc(0, r * 0.35, r * 0.6, -Math.PI * 0.82, Math.PI * 1.02);
  ctx.stroke();
  // 倒刺（小三角箭头，指向钩住方向）
  ctx.fillStyle = '#ffd27a';
  ctx.beginPath();
  ctx.moveTo(0, r * 0.28);
  ctx.lineTo(-r * 0.5, r * 0.1);
  ctx.lineTo(0, -r * 0.05);
  ctx.closePath();
  ctx.fill();
  // 顶部圆头（发射端）
  ctx.fillStyle = '#ffe3ad';
  ctx.beginPath(); ctx.arc(0, -r * 1.15, r * 0.2, 0, 6.283); ctx.fill();
}

/** 护盾本体：蓝紫盾形（上圆 + 收尖下底 + V 型高光） */
function drawShieldShape(r: number): void {
  ctx.fillStyle = '#b3c7ff';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.75, Math.PI, 0);
  ctx.lineTo(r * 0.75, r * 0.45);
  ctx.lineTo(0, r * 0.95);
  ctx.lineTo(-r * 0.75, r * 0.45);
  ctx.closePath();
  ctx.fill();
  // V 型高光
  ctx.strokeStyle = 'rgba(235,240,255,.9)';
  ctx.lineWidth = r * 0.16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, -r * 0.2);
  ctx.lineTo(0, r * 0.25);
  ctx.lineTo(r * 0.3, -r * 0.2);
  ctx.stroke();
}

/** 重置箭头本体：白环 + 顺时针指向箭头（回到绑定的检查点） */
function drawRecallShape(r: number): void {
  const lw = r * 0.3;
  ctx.strokeStyle = '#eef2ff';
  ctx.fillStyle = '#eef2ff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // 圆环（开口朝上，箭头从中伸出指示回转）
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.58, -Math.PI * 0.55, Math.PI * 2 - Math.PI * 0.55, false);
  ctx.stroke();
  // 箭头（上侧开口处，指向顺时针回卷方向）
  ctx.save();
  ctx.rotate(-Math.PI * 0.55);
  ctx.translate(r * 0.58, 0);
  ctx.rotate(-Math.PI / 2);
  ctx.lineWidth = lw * 0.9;
  ctx.beginPath();
  ctx.moveTo(-r * 0.34, 0);
  ctx.lineTo(r * 0.12, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r * 0.22, -r * 0.3);
  ctx.lineTo(r * 0.52, 0);
  ctx.lineTo(r * 0.22, r * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** 加速本体：青白「》》」双箭头（左小右大，冲刺感） */
function drawSpeedShape(r: number): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // 后箭头（左小）
  ctx.strokeStyle = '#8ff6ff';
  ctx.lineWidth = r * 0.34;
  ctx.beginPath();
  ctx.moveTo(-r * 0.82, -r * 0.78);
  ctx.lineTo(-r * 0.05, 0);
  ctx.lineTo(-r * 0.82, r * 0.78);
  ctx.stroke();
  // 前箭头（右大）
  ctx.strokeStyle = '#eaffff';
  ctx.beginPath();
  ctx.moveTo(-r * 0.18, -r * 0.78);
  ctx.lineTo(r * 0.6, 0);
  ctx.lineTo(-r * 0.18, r * 0.78);
  ctx.stroke();
}

/**
 * 道具本体建模（按 ItemId 分发；原点绘制；未知 id 不绘制）。
 * 武器（ak/grenade）转发 WeaponVis —— 武器建模单一来源保持不变。
 */
export function drawItemModel(id: ItemId, r: number): void {
  switch (id) {
    case 'doubleJump': drawJumpTicketShape(r); break;
    case 'hook': drawHookShape(r); break;
    case 'shield': drawShieldShape(r); break;
    case 'speed': drawSpeedShape(r); break;
    case 'recall': drawRecallShape(r); break;
    case 'ak': drawWeaponModel('ak', r); break;
    case 'grenade': drawWeaponModel('grenade', r); break;
  }
}

/* ==================== 图标（带发光；HUD / 图鉴 / 持枪统一出口） ==================== */

/** 各道具图标发光色（HUD 图标 / 图鉴共用；新增道具加一行） */
const ITEM_GLOW: Record<ItemId, string> = {
  doubleJump: 'rgba(120,255,170,.9)',
  hook: 'rgba(255,180,70,.9)',
  shield: 'rgba(150,140,255,.9)',
  speed: 'rgba(120,230,255,.9)',
  recall: 'rgba(238,242,255,.95)',
  ak: 'rgba(255,150,60,.9)',
  grenade: 'rgba(150,255,140,.9)',
};

/** HUD 槽位内每道具的图标尺度（px；按道具视觉体积微调；漏配回退 10） */
export const ITEM_ICON_R: Record<ItemId, number> = {
  doubleJump: 10,
  hook: 10,
  shield: 10,
  speed: 13,
  recall: 11,
  ak: 10,
  grenade: 8,
};

/** 道具图标统一出口（按 ItemId 分发；武器走 WeaponVis 专属发光/倾角） */
export function drawItemIcon(id: ItemId, cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  if (id === 'ak' || id === 'grenade') {
    (id === 'ak' ? drawAKIcon : drawGrenadeIcon)(0, 0, r);
    ctx.restore();
    return;
  }
  ctx.shadowColor = ITEM_GLOW[id];
  ctx.shadowBlur = 8;
  drawItemModel(id, r);
  ctx.shadowBlur = 0;
  ctx.restore();
}
