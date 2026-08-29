/**
 * 道具图标 —— 问题 13：统一 HUD 背包栏（固定小尺寸）与图鉴拾取物（按 r 缩放）两套绘制。
 * 所有函数只画"道具本体形状"：以 (cx, cy) 为中心，r 为尺度单位。
 * 调用方负责 bob / 旋转 / 光晕等拾取物特效（图鉴）或槽位适配（HUD）。
 */
import { ctx } from '../../core/canvas';

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

/** 二段跳票：绿色上箭头 */
export function drawJumpTicketIcon(cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = 'rgba(120,255,170,.9)';
  ctx.shadowBlur = 8;
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
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(230,255,240,.9)';
  ctx.fillRect(-r * 0.08, -r * 1.02, r * 0.16, r * 0.88);
  ctx.restore();
}

/** 钩锁道具：金色钩形（钩杆 + 弯钩 + 倒刺 + 顶部圆头） */
export function drawHookIcon(cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = 'rgba(255,180,70,.9)';
  ctx.shadowBlur = 8;
  ctx.strokeStyle = '#ffc04d';
  ctx.lineWidth = r * 0.36;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.15);
  ctx.lineTo(0, r * 0.35);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, r * 0.35, r * 0.6, -Math.PI * 0.82, Math.PI * 1.02);
  ctx.stroke();
  ctx.fillStyle = '#ffd27a';
  ctx.beginPath();
  ctx.moveTo(0, r * 0.28);
  ctx.lineTo(-r * 0.5, r * 0.1);
  ctx.lineTo(0, -r * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffe3ad';
  ctx.beginPath(); ctx.arc(0, -r * 1.15, r * 0.2, 0, 6.283); ctx.fill();
  ctx.restore();
}

/** 护盾道具：蓝紫盾形（上圆 + 收尖下底 + V 型高光） */
export function drawShieldIcon(cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = 'rgba(150,140,255,.9)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#b3c7ff';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.75, Math.PI, 0);
  ctx.lineTo(r * 0.75, r * 0.45);
  ctx.lineTo(0, r * 0.95);
  ctx.lineTo(-r * 0.75, r * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(235,240,255,.9)';
  ctx.lineWidth = r * 0.16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, -r * 0.2);
  ctx.lineTo(0, r * 0.25);
  ctx.lineTo(r * 0.3, -r * 0.2);
  ctx.stroke();
  ctx.restore();
}

/** 加速道具：青色双箭头（左小右大两个 »） */
export function drawSpeedIcon(cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = 'rgba(120,230,255,.9)';
  ctx.shadowBlur = 8;
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
  ctx.shadowBlur = 0;
  ctx.restore();
}

/** 磁铁道具：红粉马蹄磁铁（横杆 + 双极柱 + 白色磁极端） */
export function drawMagnetIcon(cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = 'rgba(255,110,140,.9)';
  ctx.shadowBlur = 8;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#ff6a85';
  ctx.lineWidth = r * 0.46;
  // 横杆
  ctx.beginPath();
  ctx.moveTo(-r * 0.62, -r * 0.68);
  ctx.lineTo(r * 0.62, -r * 0.68);
  ctx.stroke();
  // 左极柱
  ctx.beginPath();
  ctx.moveTo(-r * 0.62, -r * 0.68);
  ctx.lineTo(-r * 0.62, r * 0.67);
  ctx.stroke();
  // 右极柱
  ctx.beginPath();
  ctx.moveTo(r * 0.62, -r * 0.68);
  ctx.lineTo(r * 0.62, r * 0.67);
  ctx.stroke();
  // 白色磁极端
  ctx.strokeStyle = '#ffd9e0';
  ctx.lineWidth = r * 0.2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.62, r * 0.67);
  ctx.lineTo(-r * 0.62, r * 0.56);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r * 0.62, r * 0.67);
  ctx.lineTo(r * 0.62, r * 0.56);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();
}
