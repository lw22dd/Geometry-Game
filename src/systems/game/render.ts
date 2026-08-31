/**
 * 渲染管线 —— render / renderGame / 震屏 / 远程玩家绘制 + 渲染 alpha 插值。
 * 从原 game/index.ts 上帝模块拆出。
 *
 * 插值 alpha 由主循环（index.ts）计算并传入（物理批步与帧间隔的比例），
 * 本模块只依赖上一物理批步快照（snapshotRenderPrev 维护在本模块）。
 */
import { ctx, VW, VH, DPR, PPM } from '../../core/canvas';
import { updateCamera, sx, sy, view } from '../../core/camera';
import { gs } from './gameState';
import { playerController } from '../player';
import { remotes } from '../player/remote';
import { room, isHost } from '../../net/room';
import { syncUI } from '../ui/scenes';
import { ui } from '../../core/uiComponent';
import { drawPostFX } from '../postfx';
import type { RemotePlayer, PlayerState } from '../../types';
import { hasComponent } from 'bitecs';
import { world, Position, Collider, PathMotion } from '../../core/ecs';
import { query } from 'bitecs';
import { clamp } from '../../core/math';
import { currentMap, VIS, DEFAULT_MAP_THEME, DEATH_VISUAL_T } from '../../config';
import {
  drawParallax, drawGrid, drawBorder, drawDecos, drawSolids, drawFloor, drawMovers, drawSpringPads,
  drawCheckpoints, drawSpikes, drawLasers, drawOrbs, drawJumpBoosts, drawHookPickups, drawShieldPickups, drawSpeedPickups, drawRecallPickups, drawWeaponPickups, drawCiphers, drawChests, drawNOVA,
  drawTrail, drawParticles, drawHints, drawTracks,
  drawMotes, drawFog,
} from '../../Prefabs/Scenes';
import { drawPlayer, drawPlayerFor, stepPlayerAnimation, getSelectedCharacter, getCharacterById, DEFAULT_CHARACTER } from '../../Prefabs/Player';
import { drawHUD, drawMinimap } from '../ui/hud';
import { drawDevGrid, drawDebugHUD } from '../ui/dev';
import { drawEnemies, drawEnemyRocks } from '../../Prefabs/Enemy';
import { drawProjectiles, drawTracers } from '../combat';
import { drawHookAim, drawWeaponAim, drawHookRope, mouseAimDir, defaultAimDir } from '../items/hook';
import { drawHeldItem } from '../items/hold';
import { colliderWorldRect } from '../level';
import { mouse } from '../../core/mouse';

/* ==================== 渲染 alpha 插值（问题 8） ==================== */

/** 玩家上一物理批步前快照（渲染插值起点） */
let prevPx = 0, prevPy = 0;
/** 移动平台上一物理批步前世界位置快照（[x, top] × 实体数，模块级复用数组） */
let prevMovers: number[] = [];
/** 渲染插值视图（复用对象，避免每帧分配） */
let interpView: import('../../types').PlayerState | null = null;

/** 物理批步前快照：记录玩家与移动平台的世界位置（帧渲染插值用） */
export function snapshotRenderPrev(): void {
  const ps = playerController.getState();
  prevPx = ps.x;
  prevPy = ps.y;
  let mi = 0;
  for (const e of query(world, [Position, Collider, PathMotion])) {
    const r = colliderWorldRect(e);
    if (mi + 2 > prevMovers.length) prevMovers.length = mi + 2;
    prevMovers[mi++] = r.x;
    prevMovers[mi++] = r.top;
  }
  prevMovers.length = mi;
}

/** 插值绘制本地玩家（表现层；物理仍 120Hz 步进） */
function drawLocalPlayerInterpolated(alpha: number): void {
  const pS = playerController.getState();
  const localAim = mouse.used ? mouseAimDir(pS) : defaultAimDir(pS);
  if (alpha >= 1 || gs.screen !== 'playing') {
    drawPlayer(pS, getSelectedCharacter());
    drawHeldItem(pS, localAim);
    return;
  }
  // 死亡时不做插值：直接用真实状态（render 侧据此隐藏建模并让爆裂粒子接管）
  if (pS.dead) {
    drawPlayer(pS, getSelectedCharacter());
    return;
  }
  const rv = interpView ?? (interpView = { ...pS });
  // 关键：每帧以当前状态为准刷新副本，只把 x/y 换成插值位置。
  // 副本是首次展开时建立的，若只更新 x/y，dead / inv / shields / face 等字段
  // 会永远停留在建副本那一刻 —— 死亡后副本仍是 dead=false，建模会被继续画出来。
  Object.assign(rv, pS);
  rv.x = prevPx + (pS.x - prevPx) * alpha;
  rv.y = prevPy + (pS.y - prevPy) * alpha;
  drawPlayer(rv, getSelectedCharacter());
  drawHeldItem(rv, localAim);
}

/** 逐帧渲染 */
export function render(dt: number, alpha: number): void {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  // 1. 同步 UI 场景（menu/pause/lobby 由 UIManager 统一管理）
  syncUI();
  const uiTime = performance.now() / 1000;

  // 背景渐变（菜单与游戏共用）
  let gr = ctx.createLinearGradient(0, 0, 0, VH);
  gr.addColorStop(0, '#080517');
  gr.addColorStop(0.5, '#120a30');
  gr.addColorStop(1, '#1d0f45');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, VW, VH);

  // 菜单 / 准备流程 / 大厅 / 操作说明 / 设置：全屏 UI 场景，直接绘制（不渲染游戏）
  if (ui.currentName === 'menu' || ui.currentName === 'lobby'
      || ui.currentName === 'instructions'
      || ui.currentName === 'settings'
      || ui.currentName === 'prepare' || ui.currentName === 'mapSelect' || ui.currentName === 'charSelect'
      || ui.currentName === 'modeSelect') {
    ui.draw(uiTime);
    return;
  }

  // 游戏画面（playing / paused 都画底层游戏）
  renderGame(dt, alpha);

  // 暂停 / 开发者设置：叠加场景
  if (ui.currentName === 'pause' || ui.currentName === 'dev') {
    ui.draw(uiTime);
  }
}

/** 渲染游戏画面（暂停时复用） */
function renderGame(dt: number, alpha: number): void {
  const pS = playerController.getState();
  updateCamera(dt, pS, gs, currentMap.width, currentMap.height);

  const vw = VW / (PPM * view.zoom);
  const vh = VH / (PPM * view.zoom);

  const pulse = Math.exp(-((gs.time * 128 / 60) % 1) * 4.5);

  // （删除：原底部脉冲渐变 → Bloom 放大后成为全屏"闪光"，见 git 历史）

  // 震屏：只包裹世界层（视差 → 提示文字）。前景浮尘 / 底部雾 / 暗角 / HUD /
  // 后处理都在 restore 之后绘制，不参与抖动（避免 UI 与全屏叠加层跟着位移）。
  ctx.save();
  applyShake(dt);

  drawParallax();
  drawGrid(pulse);
  drawBorder();
  drawDecos();
  drawFloor();
  drawSolids();
  drawTracks();
  drawMovers(alpha, prevMovers); // 问题 8：移动平台 alpha 插值
  drawSpringPads();
  drawCheckpoints(pulse);
  drawSpikes();
  drawLasers();
  drawOrbs();
  drawJumpBoosts();
  drawHookPickups();
  drawShieldPickups();
  drawSpeedPickups();
  drawRecallPickups();
  drawWeaponPickups();
  drawNOVA(pulse);
  drawCiphers();
  drawChests();
  drawTrail();
  drawParticles();

  // 敌人（S3）：行走兵（在玩家之下绘制，作为地面单位）
  drawEnemies();
  // 武器曳光（S2）：AK 开火留痕
  drawTracers();

  // 钩锁瞄准预览（在玩家下方，半透明线）
  drawHookAim(pS);
  // 武器（AK / 手雷）鼠标准星
  drawWeaponAim(pS);

  // 绘制所有玩家（本地 alpha 插值 + 远程）
  drawLocalPlayerInterpolated(alpha);
  for (const [, rp] of remotes) {
    drawRemotePlayer(rp, dt);
  }

  // 手雷抛体（S2）：在玩家之上绘制，保证飞行可见
  drawProjectiles();
  // 敌人石头（大猩猩投石）：与手雷同层，飞行可见
  drawEnemyRocks();

  // 滑索绳索（在玩家上方，金色线）
  drawHookRope(pS);

  drawHints();

  ctx.restore(); // 结束震屏包裹区（世界层绘制完毕）

  // 美术升级 3：前景浮尘 + 底部雾（玩家之上、UI 之下）
  drawMotes();
  drawFog();

  // 开发者坐标网格（全场景覆盖）
  drawDevGrid();

  let vg = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.38, VW / 2, VH / 2, VH * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(3,0,14,.5)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, VW, VH);

  if (gs.flash > 0) {
    ctx.fillStyle = 'rgba(255,80,160,' + (gs.flash * 0.28) + ')';
    ctx.fillRect(0, 0, VW, VH);
  }

  if (pS.dead) {
    ctx.fillStyle = 'rgba(15,2,25,' + (0.4 * (1 - pS.deadT / DEATH_VISUAL_T)) + ')';
    ctx.fillRect(0, 0, VW, VH);
  }

  drawHUD();
  drawDebugHUD();
  drawMinimap(vw, vh);

  // ★ 后期特效管线（最后一层，覆盖全画布）：
  //   速度驱动径向模糊强度，地图主题强调色驱动分区调色
  drawPostFX({
    speed: clamp((Math.abs(pS.velocity.x) - 10) / 14, 0, 1),
    tint: (currentMap.theme ?? DEFAULT_MAP_THEME).accent,
  });
}

/**
 * 震屏（trauma 模型）—— 屏幕空间位移 + 轻微 roll，只改写 ctx 变换。
 * trauma 平方映射：小抖动更细腻、大冲击更猛；双频正弦比纯随机更"有质感"。
 * 不涉及物理与相机世界坐标，确定性不受影响。
 */
function applyShake(dt: number): void {
  const s = gs.shake;
  if (s <= 0.002) {
    gs.shake = 0;
    return;
  }
  const cfg = VIS.screen;
  const trauma = s * s;
  const amp = trauma * cfg.shakeAmp;
  const t = gs.time * cfg.shakeFreq;
  ctx.translate(VW / 2 + Math.sin(t * 1.7) * amp, VH / 2 + Math.cos(t * 2.3) * amp * 0.7);
  ctx.rotate(Math.sin(t * 0.9) * trauma * 0.008);
  ctx.translate(-VW / 2, -VH / 2);
  gs.shake = s * Math.exp(-cfg.shakeDecay * dt);
}

/** 绘制远程玩家（走预制体通路；按房间信息里的角色 id 取样式，缺省回退按 playerId 配色变体） */
function drawRemotePlayer(rp: RemotePlayer, dt: number): void {
  if (rp.dead) return;
  // 客机端远程玩家无物理步，动画在渲染帧推进；房主端由 stepRemotePlayer 推进
  if (!isHost()) stepPlayerAnimation(rp, dt);
  // 房间握手带 char 时用该角色样式；客机端自己的 room.players 在加入时已同步
  const info = room.players.find(p => p.id === rp.id);
  // 使用玩家选择的角色样式；未选择时回退默认角色（不按 playerId 区分颜色）
  const style = info?.char ? getCharacterById(info.char) : DEFAULT_CHARACTER;
  drawPlayerFor(rp, style);
  drawHeldItem(rp);

  // 玩家 ID 标签
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '500 11px "Segoe UI",Arial';
  ctx.fillStyle = 'rgba(200,220,255,.8)';
  ctx.fillText('P' + rp.id, sx(rp.x), sy(rp.y + 0.9));
  ctx.restore();

  // 远程玩家滑索绳索（视觉同步）
  drawHookRope(rp);
}