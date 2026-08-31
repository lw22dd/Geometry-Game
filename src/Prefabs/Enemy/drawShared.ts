/**
 * 敌人共享绘制小工具 —— 受击闪白 / 警戒符号 / 血条。
 * 供 walker / creeper / gorilla 三个预制体共用，消除逐字重复。
 */
import { ctx } from '../../core/canvas';
import { gs } from '../../systems/game/gameState';

/** 受击闪白：无敌帧内高频闪烁的透明度（1 = 不闪） */
export function hitFlashAlpha(inv: number): number {
  return inv > 0 ? (Math.floor(gs.time * 20) % 2 === 0 ? 0.55 : 1) : 1;
}

/** 头顶警戒「!」符号（x, y = 屏幕坐标，size = 字号 px） */
export function drawAlert(x: number, y: number, size: number, color: string): void {
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(size)}px Arial`;
  ctx.textAlign = 'center';
  ctx.fillText('!', x, y);
}

/**
 * 敌人血条（受伤时显示）。
 * @param cx 中心 X（屏幕 px）
 * @param topY 顶边 Y（屏幕 px，向下为正）
 * @param w 总宽 / h 高
 * @param alpha 全局透明度（受击闪白等）
 */
export function drawHealthBar(cx: number, topY: number, w: number, h: number, hp: number, maxHp: number, alpha: number): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(10,6,20,.7)';
  ctx.fillRect(cx - w / 2, topY, w, h);
  const ratio = Math.max(0, hp / maxHp);
  ctx.fillStyle = ratio > 0.5 ? '#6aff8a' : ratio > 0.25 ? '#ffcf5a' : '#ff5a5a';
  ctx.fillRect(cx - w / 2, topY, w * ratio, h);
}
