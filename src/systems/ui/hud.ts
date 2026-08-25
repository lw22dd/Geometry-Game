/**
 * 游戏内 HUD —— 信息面板 / 小地图 / Toast / 胜利横幅。
 * 每帧由 renderGame() 调用，只读游戏状态与 ECS 世界，无副作用。
 */
import { ctx, VW, VH } from '../../core/canvas';
import { cam } from '../../core/camera';
import { rr, fmt } from '../../core/math';
import { currentMap, PHYS } from '../../config';
import { world } from '../../core/ecs';
import { Position } from '../../components/physics/Position';
import { Collider } from '../../components/physics/Collider';
import { PathMotion } from '../../components/physics/PathMotion';
import { Timer } from '../../components/gameplay/Timer';
import { Hazard } from '../../components/gameplay/Hazard';
import { Collectible } from '../../components/gameplay/Collectible';
import { RespawnPoint } from '../../components/gameplay/RespawnPoint';
import { Goal } from '../../components/gameplay/Goal';
import { gs } from '../game/gameState';
import { getMode } from '../game/gameMode';
import { playerController } from '../player';
import { colliderWorldRect } from '../level';
import { MAX_BACKPACK, type ItemId } from '../../types';
import { HOOK_COOLDOWN } from '../../config';
import { orbCount } from '../interactions';

/** 光球总数（仅 kind === 'orb' 的可拾取物） */
const orbTotal = (): number => orbCount();

/* ==================== HUD ==================== */

/** 背包栏槽位尺寸（px） */
const SLOT = 46;
const SLOT_GAP = 8;
const BAR_W = 5 * SLOT + 4 * SLOT_GAP;
const BAR_X = (VW - BAR_W) / 2;
const BAR_Y = VH - 46;

/** 背包栏（玩家自带 5 格装备栏，屏幕最下方居中）；
 *  占用格显示道具图标：二段跳票 = 绿色上箭头（被动），钩锁 = 金色钩形（主动）。
 *  主动道具需选中对应槽位（数字键 1-5）才能使用，选中格高亮 + 键位数字提示。
 *  钩锁格在冷却中显示弧形遮罩。 */
export function drawHUD(): void {
  if (gs.screen !== 'playing') return;
  const p = playerController.getState();

  for (let i = 0; i < MAX_BACKPACK; i++) {
    const x = BAR_X + i * (SLOT + SLOT_GAP);
    const y = BAR_Y;
    const id: ItemId | null = p.backpack[i] ?? null;
    const selected = i === p.selectedSlot;
    const active = id === 'hook';
    const hue = id === null ? 'rgba(150,170,255,.25)'
      : active ? 'rgba(255,190,90,.9)'
      : 'rgba(120,255,170,.9)';

    // 选中态发光底板
    if (selected) {
      rr(ctx, x - 3, y - 3, SLOT + 6, SLOT + 6, 10);
      ctx.fillStyle = 'rgba(255,220,150,.07)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,150,.55)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 槽底
    rr(ctx, x, y, SLOT, SLOT, 8);
    ctx.fillStyle = selected ? 'rgba(22,14,36,.72)' : 'rgba(8,6,26,.62)';
    ctx.fill();
    ctx.strokeStyle = selected ? 'rgba(255,220,150,1)' : hue;
    ctx.lineWidth = selected ? 2.4 : (id === null ? 1 : 1.6);
    ctx.stroke();

    if (id === null) {
      // 空格：浅色虚线内框
      ctx.save();
      ctx.strokeStyle = 'rgba(150,170,255,.18)';
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1;
      rr(ctx, x + 8, y + 8, SLOT - 16, SLOT - 16, 4);
      ctx.stroke();
      ctx.restore();
    } else {
      // 道具图标（居中 28×28 区域）
      const cx = x + SLOT / 2;
      const cy = y + SLOT / 2;
      if (id === 'doubleJump') {
        drawJumpTicketIcon(cx, cy);
      } else {
        drawHookIcon(cx, cy);
      }

      // 钩锁冷却：弧形遮罩 + 进度指示
      if (id === 'hook' && p.hookCd > 0) {
        const prog = 1 - p.hookCd / HOOK_COOLDOWN;
        ctx.save();
        ctx.fillStyle = 'rgba(8,6,26,.55)';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, SLOT / 2 - 2, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // 主动/被动角标（active ▶ / passive ◆）
      ctx.save();
      ctx.font = '700 10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = active ? 'rgba(255,190,90,.85)' : 'rgba(120,255,170,.8)';
      ctx.fillText(active ? '▶' : '◆', cx, y + SLOT - 9);
      ctx.restore();
    }

    // 槽位数字键提示（1-5）
    ctx.save();
    ctx.font = '600 9px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = selected ? 'rgba(255,230,170,.95)' : 'rgba(170,190,255,.45)';
    ctx.fillText(String(i + 1), x + 8, y + 8);
    ctx.restore();
  }
}

/** 二段跳票图标：绿色上箭头（与拾取物同形，缩小版） */
function drawJumpTicketIcon(cx: number, cy: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = 'rgba(120,255,170,.8)';
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#59ff8f';
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(5.5, -1.5);
  ctx.lineTo(2.2, -1.5);
  ctx.lineTo(2.2, 11);
  ctx.lineTo(-2.2, 11);
  ctx.lineTo(-2.2, -1.5);
  ctx.lineTo(-5.5, -1.5);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(230,255,240,.9)';
  ctx.fillRect(-0.7, -9.5, 1.4, 7);
  ctx.restore();
}

/** 钩锁图标：金色钩形（钩杆 + 弯钩 + 倒刺，缩小版） */
function drawHookIcon(cx: number, cy: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = 'rgba(255,180,70,.85)';
  ctx.shadowBlur = 6;
  ctx.strokeStyle = '#ffc04d';
  ctx.lineWidth = 3.6;
  ctx.lineCap = 'round';
  // 钩杆
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(0, 3);
  ctx.stroke();
  // 弯钩
  ctx.beginPath();
  ctx.arc(0, 3, 5.4, -Math.PI * 0.82, Math.PI * 1.02);
  ctx.stroke();
  // 倒刺
  ctx.fillStyle = '#ffd27a';
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(-4.6, 0.6);
  ctx.lineTo(0, -1.4);
  ctx.closePath();
  ctx.fill();
  // 顶部圆头
  ctx.fillStyle = '#ffe3ad';
  ctx.beginPath(); ctx.arc(0, -10, 2, 0, 6.283); ctx.fill();
  ctx.restore();
}

/* ==================== 小地图 ==================== */

/** 小地图 */
export function drawMinimap(vw: number, vh: number): void {
  const pMm = playerController.getState();
  const mmW = 252, k = mmW / currentMap.width, mmH = currentMap.height * k, pad = 10, mx = VW - mmW - 22, my = 46;
  rr(ctx, mx - pad, my - pad - 16, mmW + pad * 2, mmH + pad * 2 + 24, 9);
  ctx.fillStyle = 'rgba(8,6,26,.72)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,160,255,.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = '600 11px Arial';
  ctx.fillStyle = 'rgba(170,190,255,.8)';
  ctx.fillText('MAP · ' + currentMap.width + ' × ' + currentMap.height + ' · ' + (pMm.x | 0) + ',' + (pMm.y | 0), mx, my - 6);

  const X = (x: number) => mx + x * k;
  const Y = (y: number) => my + mmH - y * k;

  ctx.fillStyle = 'rgba(120,140,255,.4)';
  for (const r of currentMap.solids) ctx.fillRect(X(r.x), Y(r.top), Math.max(1, r.w * k), Math.max(1, r.h * k));
  for (const e of world.query(Position, Collider, PathMotion)) {
    const pos = world.get<Position>(e, Position);
    const col = world.get<Collider>(e, Collider);
    const r = colliderWorldRect(pos, col);
    ctx.fillStyle = 'rgba(160,200,255,.75)';
    ctx.fillRect(X(r.x), Y(r.top), Math.max(1.5, r.w * k), Math.max(1, r.h * k));
  }
  ctx.fillStyle = 'rgba(255,138,222,.9)';
  for (const e of world.query(Position, Collider, Hazard)) {
    if (world.has(e, Timer)) continue; // 激光由下方绘制
    const pos = world.get<Position>(e, Position);
    ctx.fillRect(X(pos.x + 0.5) - 1, Y(5) - 1, 2, 2);
  }
  for (const e of world.query(Position, Collider, Timer)) {
    const pos = world.get<Position>(e, Position);
    const col = world.get<Collider>(e, Collider);
    const r = colliderWorldRect(pos, col);
    ctx.fillStyle = 'rgba(255,90,160,.8)';
    ctx.fillRect(X(pos.x) - 0.5, Y(r.top), 1, r.h * k);
  }
  for (const e of world.query(Position, Collectible)) {
    const pos = world.get<Position>(e, Position);
    const col = world.get<Collectible>(e, Collectible);
    if (col.kind !== 'orb' || col.collected) continue;
    ctx.fillStyle = '#8ff6ff';
    ctx.beginPath(); ctx.arc(X(pos.x), Y(pos.y), 1.8, 0, 6.283); ctx.fill();
  }
  for (const e of world.query(Position, RespawnPoint)) {
    const pos = world.get<Position>(e, Position);
    const rp = world.get<RespawnPoint>(e, RespawnPoint);
    ctx.fillStyle = rp.active ? '#7df9ff' : 'rgba(150,150,255,.7)';
    ctx.fillRect(X(pos.x) - 1.5, Y(4) - 3, 3, 3);
  }
  ctx.fillStyle = '#ffd76b';
  ctx.save();
  const nova = world.queryOne(Position, Goal);
  if (nova) {
    const npos = world.get<Position>(nova, Position);
    ctx.translate(X(npos.x), Y(npos.y));
  }
  ctx.rotate(0.785);
  ctx.fillRect(-2.4, -2.4, 4.8, 4.8);
  ctx.restore();
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(X(pMm.x), Y(pMm.y), 2.6, 0, 6.283); ctx.fill();
  ctx.shadowBlur = 0;
  const cx = X(cam.x - vw / 2), cy = Y(cam.y + vh / 2), cw = vw * k, chh = vh * k;
  ctx.strokeStyle = '#ffb3f0';
  ctx.lineWidth = 1.4;
  ctx.shadowColor = '#ff8ad8';
  ctx.shadowBlur = 7;
  ctx.strokeRect(cx, cy, cw, chh);
  ctx.shadowBlur = 0;
}