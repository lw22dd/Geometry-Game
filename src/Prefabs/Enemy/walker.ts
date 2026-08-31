/**
 * 行走兵预制体 —— 纯绘制（黑色填充正方形 + 白色外框 + 白色双眼）。
 * 无专属行为：接触伤害型，绘制只需共有字段。
 */
import { ctx } from '../../core/canvas';
import { sx, sy, view } from '../../core/camera';
import { gs } from '../../systems/game/gameState';
import type { DrawView, WalkerDef, WalkerState, StepInput, StepResult } from './types';

/** 行走兵初始状态（共享字段工厂） */
export function createWalkerState(x: number, dir: 1 | -1): WalkerState {
  return { dir, homeX: x, mode: 'patrol', grounded: false, walkT: 0 };
}

/** 行走兵专属行为：无专属动作（纯接触伤害型），不锁定移动，交给通用移动 */
export function stepWalker(_inp: StepInput, _st: WalkerState, _def: WalkerDef): StepResult {
  return {};
}

/** 行走兵绘制：黑色填充正方形 + 白色外框 */
export function drawWalker(v: DrawView, def: WalkerDef): void {
  const cx = sx(v.x);
  const cy = sy(v.y);
  const r = v.half * view.SZ;

  // 受击闪白（无敌帧内高频闪烁）
  let flash = 1;
  if (v.inv > 0) flash = Math.floor(gs.time * 20) % 2 === 0 ? 0.55 : 1;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(v.face, 1);

  // 身体：黑色填充正方形 + 白色外框
  ctx.shadowColor = def.glow;
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#000';
  ctx.strokeStyle = v.inv > 0 ? 'rgba(255,255,255,.9)' : '#fff';
  ctx.lineWidth = v.inv > 0 ? 2.4 : 1.6;
  ctx.globalAlpha = flash;
  ctx.beginPath();
  ctx.rect(-r, -r, r * 2, r * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 眼睛：位置与玩家一致（横排两只、居中偏上）
  ctx.fillStyle = '#fff';
  const ew = r * 0.17;
  const eh = r * 0.36;
  ctx.fillRect(r * 0.15 - ew / 2, -r * 0.3, ew, eh);
  ctx.fillRect(r * 0.55 - ew / 2, -r * 0.3, ew, eh);

  // 追击态：头顶警戒「!」
  if (v.mode === 'chase') {
    ctx.fillStyle = '#ff5a5a';
    ctx.font = `bold ${Math.round(r * 1.2)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, -r * 2.1);
  }

  // 血条（受伤时显示）
  if (v.hp < v.maxHp) {
    const bw = r * 1.6;
    const bh = Math.max(2, r * 0.24);
    ctx.fillStyle = 'rgba(10,6,20,.7)';
    ctx.fillRect(-bw / 2, -r * 1.7, bw, bh);
    const ratio = Math.max(0, v.hp / v.maxHp);
    ctx.fillStyle = ratio > 0.5 ? '#6aff8a' : ratio > 0.25 ? '#ffcf5a' : '#ff5a5a';
    ctx.fillRect(-bw / 2, -r * 1.7, bw * ratio, bh);
  }

  ctx.restore();
}
