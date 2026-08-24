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

/** 光球总数（ECS 实体数量） */
const orbTotal = (): number => world.query(Collectible).length;

/* ==================== HUD ==================== */

/** HUD 面板 */
export function drawHUD(): void {
  const pPl = playerController.getState();
  ctx.font = '600 15px "Segoe UI","Microsoft YaHei",Arial';
  rr(ctx, 16, 16, 232, 178, 10);
  ctx.fillStyle = 'rgba(10,8,30,.55)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(130,170,255,.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#8ff6ff';
  ctx.fillText('光球 ORBS  ' + gs.gotN + ' / ' + orbTotal(), 30, 42);
  ctx.fillStyle = '#cfe6ff';
  ctx.fillText('速度 SPEED  ' + Math.abs(pPl.velocity.x).toFixed(1) + ' m/s', 30, 63);
  ctx.fillStyle = '#cfe6ff';
  ctx.fillText('跳高 JUMP   3.2 格', 30, 84);
  ctx.fillStyle = '#c77dff';
  ctx.fillText('物理 PHYS   ' + PHYS[getMode()].name, 30, 105);
  ctx.fillStyle = pPl.sprint ? '#ffd27d' : '#7f89b8';
  ctx.fillText('加速 BOOST  ' + (pPl.sprint ? '曳光中' : '--'), 30, 126);
  ctx.fillStyle = '#cfe6ff';
  ctx.fillText('用时 TIME   ' + fmt(gs.win ? gs.winTime : gs.gt), 30, 147);
  ctx.fillStyle = '#ffb0d9';
  ctx.fillText('坠落 DEATH  ' + gs.deaths, 30, 168);

  ctx.font = '12px "Segoe UI","Microsoft YaHei",Arial';
  ctx.fillStyle = 'rgba(180,200,255,.55)';
  ctx.fillText(
    'A/D 移动 · SPACE 跳跃(长按更高) · SHIFT 加速曳光 · P 切换物理 · R 出生点 · M 音效',
    16, VH - 18,
  );

  if (gs.toastT > 0) {
    ctx.globalAlpha = Math.min(1, gs.toastT);
    ctx.textAlign = 'center';
    ctx.font = '600 18px "Segoe UI","Microsoft YaHei"';
    ctx.fillStyle = '#bfe9ff';
    ctx.fillText(gs.toast, VW / 2, VH - 64);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  if (gs.win) {
    const a = 0.8 + 0.2 * Math.sin(gs.time * 4);
    const bg = ctx.createLinearGradient(0, 84, 0, 190);
    bg.addColorStop(0, 'rgba(10,6,30,0)');
    bg.addColorStop(0.5, 'rgba(30,14,60,.75)');
    bg.addColorStop(1, 'rgba(10,6,30,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 84, VW, 106);
    ctx.textAlign = 'center';
    ctx.font = '800 32px Arial';
    ctx.fillStyle = 'rgba(255,233,168,' + a + ')';
    ctx.shadowColor = '#ffd76b';
    ctx.shadowBlur = 18;
    ctx.fillText('★ NOVA 星觉醒 · 登顶成功 ★', VW / 2, 128);
    ctx.shadowBlur = 0;
    ctx.font = '600 17px "Segoe UI","Microsoft YaHei"';
    ctx.fillStyle = 'rgba(230,240,255,.9)';
    ctx.fillText(
      '用时 ' + fmt(gs.winTime) + ' · 光球 ' + gs.gotN + ' / ' + orbTotal() +
      (gs.gotN === orbTotal() ? ' · PERFECT ✦' : ''),
      VW / 2, 158,
    );
    ctx.font = '500 14px "Segoe UI","Microsoft YaHei"';
    ctx.fillStyle = 'rgba(190,205,255,.7)';
    ctx.fillText(
      gs.gotN < orbTotal() ? '继续收集剩余光球 · 按 R 可返回检查点' : '完美收集！霓虹全记录 ✦',
      VW / 2, 182,
    );
    ctx.textAlign = 'left';
  }
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
    if (col.collected) continue;
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