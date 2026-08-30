/**
 * 游戏内 HUD —— 信息面板 / 小地图 / Toast / 胜利横幅。
 * 每帧由 renderGame() 调用，只读游戏状态与 ECS 世界，无副作用。
 */
import { ctx, VW, VH } from '../../core/canvas';
import { cam } from '../../core/camera';
import { rr } from '../../core/math';
import { currentMap } from '../../config';
import {
  world, Position, Collider, PathMotion, Timer, Hazard, Collectible, RespawnPoint, Goal, Orb,
} from '../../core/ecs';
import { query, hasComponent } from 'bitecs';
import { gs } from '../game/gameState';
import { playerController } from '../player';
import { colliderWorldRect } from '../level';
import { MAX_BACKPACK, type ItemId, type WeaponId, type PlayerState } from '../../types';
import { HOOK_COOLDOWN, WEAPONS } from '../../config';
import { orbCount } from '../interactions';
import { drawItemIcon, ITEM_ICON_R } from '../../Prefabs/ItemVis';

/* ==================== HUD ==================== */

/** 背包栏槽位尺寸（px；MAX_BACKPACK=10 格，整栏居中） */
const SLOT = 46;
const SLOT_GAP = 8;
const BAR_W = MAX_BACKPACK * SLOT + (MAX_BACKPACK - 1) * SLOT_GAP;
const BAR_X = (VW - BAR_W) / 2;
const BAR_Y = VH - 50; // 底部留 4px，选中态发光 ±3px 不再越出屏幕

/** 各道具槽位描边色（绑定表：新增道具加一行即可，图标自动随 ItemVis 生效） */
const SLOT_HUE: Record<ItemId, string> = {
  doubleJump: 'rgba(120,255,170,.9)',
  hook: 'rgba(255,190,90,.9)',
  shield: 'rgba(150,140,255,.95)',
  speed: 'rgba(90,225,255,.95)',
  recall: 'rgba(238,242,255,.95)',
  ak: 'rgba(255,180,90,.95)',
  grenade: 'rgba(150,255,140,.95)',
};

/** 背包栏（玩家自带 MAX_BACKPACK=10 格装备栏，屏幕最下方居中）；
 *  占用格图标由 Prefabs/ItemVis 绑定表绘制（道具 + 武器，与场景拾取物同形）。
 *  主动道具（钩锁/AK/手雷）需选中对应槽位（数字键 1-9/0 + 滚轮）才能使用，
 *  选中格高亮 + 键位数字提示（第 10 格 = 0）。钩锁格冷却中显示弧形遮罩。 */
export function drawHUD(): void {
  if (gs.screen !== 'playing') return;
  const p = playerController.getState();

  for (let i = 0; i < MAX_BACKPACK; i++) {
    const x = BAR_X + i * (SLOT + SLOT_GAP);
    const y = BAR_Y;
    const id: ItemId | null = p.backpack[i] ?? null;
    const selected = i === p.selectedSlot;
    const hue = id === null ? 'rgba(150,170,255,.25)' : SLOT_HUE[id];

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
      // 道具/武器图标（绑定表驱动：建模单一来源 = Prefabs/ItemVis，新增道具自动生效）
      const cx = x + SLOT / 2;
      const cy = y + SLOT / 2;
      drawItemIcon(id, cx, cy, ITEM_ICON_R[id]);

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
    }

    // 槽位数字键提示（1-9 / 0 代表第 10 格）
    ctx.save();
    ctx.font = '600 9px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = selected ? 'rgba(255,230,170,.95)' : 'rgba(170,190,255,.45)';
    ctx.fillText(i === MAX_BACKPACK - 1 ? '0' : String(i + 1), x + 8, y + 8);
    ctx.restore();
  }

  drawCombatHUD();
  drawWeaponHUD();
}

/* ==================== 战斗 HUD（S1/S2：HP 条 + 武器/弹药） ==================== */

/** 战斗面板：左上角 HP 条 + 当前武器名 + 弹药/换弹进度。纯只读，观感层。 */
function drawCombatHUD(): void {
  const p = playerController.getState();
  const px = 18;
  const py = 20;

  // HP 条
  const bw = 200;
  const bh = 12;
  ctx.save();
  rr(ctx, px, py, bw, bh, 6);
  ctx.fillStyle = 'rgba(8,6,26,.62)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,120,160,.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const ratio = Math.max(0, Math.min(1, p.hp / p.maxHp));
  if (ratio > 0) {
    const grad = ctx.createLinearGradient(px, 0, px + bw, 0);
    grad.addColorStop(0, ratio > 0.5 ? '#6aff8a' : ratio > 0.25 ? '#ffcf5a' : '#ff5a5a');
    grad.addColorStop(1, ratio > 0.5 ? '#2fd66a' : ratio > 0.25 ? '#ff9a3d' : '#d62f4f');
    ctx.fillStyle = grad;
    rr(ctx, px + 2, py + 2, (bw - 4) * ratio, bh - 4, 4);
    ctx.fill();
  }
  ctx.font = '600 10px Arial';
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  ctx.fillText(String(Math.ceil(p.hp)) + ' / ' + p.maxHp, px + bw + 10, py + bh / 2 + 1);
  ctx.restore();

}

/** 当前武器参数（单一事实源 = config/weapons；'none' 回退 ak，调用方仅在 weapon!=='none' 时使用） */
function currentWeapon(p: { weapon: string }): { ammo: number; reloadTime: number } {
  if (p.weapon === 'none') return WEAPONS.ak;
  return WEAPONS[p.weapon as Exclude<WeaponId, 'none'>] ?? WEAPONS.ak;
}

/** 当前武器弹匣容量（HUD 只读） */
function getMagSize(p: { weapon: string }): number {
  return currentWeapon(p).ammo;
}

/** 当前武器换弹时长（HUD 只读） */
function getReloadTime(p: { weapon: string }): number {
  return currentWeapon(p).reloadTime;
}

/* ==================== 武器弹药 HUD（S2：持有后右下角显示弹药） ==================== */

/** 当前"持有"的武器（与 stepWeapon 门控一致：选中对应武器槽位 + 已拥有；null = 未持有武器） */
function heldWeapon(p: PlayerState): 'ak' | 'grenade' | null {
  const sel = p.backpack[p.selectedSlot];
  if (sel === 'ak' && p.weapon === 'ak') return 'ak';
  if (sel === 'grenade' && p.hasGrenade) return 'grenade';
  return null;
}

/** 右下角武器弹药面板：仅"持有"武器（选中武器槽位）时显示；AK 弹匣/换弹，手雷数量 */
function drawWeaponHUD(): void {
  const p = playerController.getState();
  const kind = heldWeapon(p);
  if (kind === null) return;

  const w = 170, h = 54;
  const x = VW - w - 18; // 右下角（背包栏右侧空档）
  const y = VH - h - 58;

  ctx.save();
  // 底板
  rr(ctx, x, y, w, h, 10);
  ctx.fillStyle = 'rgba(8,6,26,.68)';
  ctx.fill();
  ctx.strokeStyle = kind === 'ak' ? 'rgba(255,180,90,.7)' : 'rgba(150,255,140,.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 武器图标（建模单一来源 = ItemVis/WeaponVis）
  drawItemIcon(kind, x + 26, y + h / 2, kind === 'ak' ? 12 : 9);

  // 武器名
  ctx.font = '700 14px "Segoe UI",Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(220,235,255,.95)';
  ctx.fillText(kind === 'ak' ? 'AK' : '手雷', x + 52, y + 15);

  if (kind === 'ak') {
    if (p.reloadT > 0) {
      // 换弹中：进度条
      ctx.font = '600 11px "Segoe UI",Arial';
      ctx.fillStyle = '#ffcf5a';
      ctx.fillText('换弹…', x + 52, y + 32);
      const relMax = Math.max(1, getReloadTime(p));
      const prog = 1 - p.reloadT / relMax;
      rr(ctx, x + 96, y + 26, 62, 6, 3);
      ctx.fillStyle = 'rgba(8,6,26,.6)';
      ctx.fill();
      if (prog > 0) {
        ctx.fillStyle = '#ffcf5a';
        rr(ctx, x + 96, y + 26, 62 * prog, 6, 3);
        ctx.fill();
      }
    } else {
      // 弹药数字 + 弹匣小格
      ctx.font = '700 18px "Segoe UI",Arial';
      ctx.fillStyle = 'rgba(255,233,168,.98)';
      ctx.fillText(String(p.ammo), x + 52, y + 33);
      ctx.font = '600 11px "Segoe UI",Arial';
      ctx.fillStyle = 'rgba(190,205,235,.55)';
      ctx.fillText('/ ' + getMagSize(p), x + 56 + ctx.measureText(String(p.ammo)).width + 4, y + 33);
      const slots = 10, sw = 4, gap = 3;
      const filled = Math.round((p.ammo / Math.max(1, getMagSize(p))) * slots);
      for (let i = 0; i < slots; i++) {
        ctx.fillStyle = i < filled ? '#ffe9a8' : 'rgba(255,233,168,.18)';
        ctx.fillRect(x + 52 + i * (sw + gap), y + 42, sw, 6);
      }
    }
  } else {
    // 手雷数量（拥有 = 1 颗投掷物）
    ctx.font = '700 18px "Segoe UI",Arial';
    ctx.fillStyle = 'rgba(140,255,170,.98)';
    ctx.fillText('× 1', x + 52, y + h / 2);
  }
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
  for (const e of qMoverEntities()) {
    const r = colliderWorldRect(e);
    ctx.fillStyle = 'rgba(160,200,255,.75)';
    ctx.fillRect(X(r.x), Y(r.top), Math.max(1.5, r.w * k), Math.max(1, r.h * k));
  }
  ctx.fillStyle = 'rgba(255,138,222,.9)';
  for (const e of qHazardEntities()) {
    if (hasComponent(world, e, Timer)) continue; // 激光由下方绘制
    ctx.fillRect(X(Position.x[e] + 0.5) - 1, Y(5) - 1, 2, 2);
  }
  for (const e of qLaserEntities()) {
    const r = colliderWorldRect(e);
    ctx.fillStyle = 'rgba(255,90,160,.8)';
    ctx.fillRect(X(Position.x[e]) - 0.5, Y(r.top), 1, r.h * k);
  }
  for (const e of qOrbEntities()) {
    if (Collectible.collected[e]) continue;
    ctx.fillStyle = '#8ff6ff';
    ctx.beginPath(); ctx.arc(X(Position.x[e]), Y(Position.y[e]), 1.8, 0, 6.283); ctx.fill();
  }
  for (const e of qCheckpointEntities()) {
    ctx.fillStyle = RespawnPoint.active[e] ? '#7df9ff' : 'rgba(150,150,255,.7)';
    ctx.fillRect(X(Position.x[e]) - 1.5, Y(4) - 3, 3, 3);
  }
  ctx.fillStyle = '#ffd76b';
  ctx.save();
  const nova = qNovaEntity();
  if (nova !== -1) {
    ctx.translate(X(Position.x[nova]), Y(Position.y[nova]));
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

/* ==================== 小地图 ECS 查询（内联，避免依赖 queries 未导出的组合） ==================== */

function qMoverEntities(): number[] { return queryEntities([Position, Collider, PathMotion]); }
function qHazardEntities(): number[] { return queryEntities([Position, Collider, Hazard]); }
function qLaserEntities(): number[] { return queryEntities([Position, Collider, Timer]); }
function qOrbEntities(): number[] { return queryEntities([Position, Collectible, Orb]); }
function qCheckpointEntities(): number[] { return queryEntities([Position, RespawnPoint]); }
function qNovaEntity(): number { return queryEntities([Position, Goal])[0] ?? -1; }

// 问题 9：小地图 query 结果使用模块级复用数组（每帧查询后清空，避免整数组丢弃分配）
const _queryScratch: number[] = [];
function queryEntities(terms: any[]): number[] {
  _queryScratch.length = 0;
  for (const e of query(world, terms)) _queryScratch.push(e as number);
  return _queryScratch;
}