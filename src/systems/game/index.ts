/**
 * 调度中枢 —— 编排各系统，管理主循环。
 * 联机模式：房主跑完整物理 + 广播权威状态；客机发输入 + 本地预测 + 矫正。
 */
import { ctx, VW, VH, DPR, PPM } from '../../core/canvas';
import { updateCamera, sx, sy, view } from '../../core/camera';
import { musicTick, MUS, sfx, AU } from '../../core/audio';
import { keys } from '../../core/input';
import { currentMap, PHYS } from '../../config';
import { gs } from './gameState';
import { getMode, setMode } from './gameMode';
import { playerController } from '../player';
import { stepPlayerGeneric } from '../player';
import { FX } from '../../Prefabs/Fx';
import { spawnParticles, stepParticles } from '../particles';
import { updateMotion, updateLaserTimer, updateSpringPads } from '../level';
import {
  drawParallax, drawGrid, drawBorder, drawDecos, drawSolids, drawMovers, drawSpringPads,
  drawCheckpoints, drawSpikes, drawLasers, drawOrbs, drawJumpBoosts, drawNOVA,
  drawTrail, drawParticles, drawHints, drawTracks,
} from '../../Prefabs/Scenes';
import { drawPlayer, drawPlayerFor, stepPlayerAnimation, characterStyleForId } from '../../Prefabs/Player';
import { drawHUD, drawMinimap } from '../ui';
import { syncUI } from '../ui/scenes';
import { ui } from '../../core/uiComponent';
import { drawDevGrid, drawDebugHUD, tickFPS } from '../ui/dev';
import { room, isHost, inSession } from '../../net/room';
import { net } from '../../net';
import { netBus } from '../../core/netBus';
import {
  remotes, resetRemotes, registerRemote, removeRemote,
  setClientInput, getClientInput, applyNetPlayers, getSelfAuthority,
} from '../player/remote';
import type { FrameSignals, InputKeys, NetPlayerState, NetOrbState, RemotePlayer, TrackState, PathSegment } from '../../types';
import { world } from '../../core/ecs';
import { Position } from '../../components/Position';
import { Collectible } from '../../components/Collectible';
import { initCollisionHooks, updateCollectSystem, updateRespawnPointSystem, updateJumpBoostSystem } from '../interactions';
import { buildCumulativeLengths, pathTotalLength } from '../../core/path';

/* ==================== 轨道状态序列化辅助 ==================== */

/** 将 TrackState 转为 NetPlayerState 的平铺字段 */
function packTrack(t: TrackState | null): {
  trackOn: boolean; trackDist: number; trackSpeed: number;
  trackEntry: number; trackExit: number; trackSegments: PathSegment[];
} {
  if (!t) return { trackOn: false, trackDist: 0, trackSpeed: 0, trackEntry: 0, trackExit: 0, trackSegments: [] };
  return { trackOn: true, trackDist: t.dist, trackSpeed: t.speed, trackEntry: t.entryDist, trackExit: t.exitDist, trackSegments: t.segments };
}

/** 从平铺字段重建 TrackState（仅 trackOn 时返回非 null） */
function unpackTrack(fields: ReturnType<typeof packTrack>): TrackState | null {
  if (!fields.trackOn) return null;
  const cl = buildCumulativeLengths(fields.trackSegments);
  return {
    segments: fields.trackSegments,
    cumulative: cl,
    dist: fields.trackDist,
    speed: fields.trackSpeed,
    totalLength: cl[cl.length - 1],
    entryDist: fields.trackEntry,
    exitDist: fields.trackExit,
  };
}

/* ==================== 网络状态序号 ==================== */
let _netSeq = 0;
let _stateTick = 0; // 房主状态广播计数器（每 2 帧广播一次，降低带宽）
const STATE_INTERVAL = 2;

/* ==================== 开始游戏 ==================== */

export function startGame(): void {
  gs.screen = 'playing';
  gs.started = true;
  if (isHost()) {
    // 房主模式下，重置远程玩家
    resetRemotes();
  }
}

/* ==================== 主循环 ==================== */

let last = performance.now();
let acc = 0;
const FDT = 1 / 120;

/** 逐帧步进（固定时间步长 1/120s） */
function step(dt: number): void {
  // 1. 时间
  gs.time += dt;

  // 2. 关卡级系统（移动平台运动 / 弹簧动画 / 激光计时）
  updateMotion();
  updateSpringPads(dt);
  updateLaserTimer();

  // 3. 粒子 + 曳光
  stepParticles(dt);

  // 4. Toast 衰减
  if (gs.toastT > 0) gs.toastT -= dt;

  // 5. 暂停/菜单/大厅中不执行游戏逻辑
  if (gs.screen !== 'playing') return;

  // 6. 游戏计时
  gs.gt += dt;

  // 7. 死亡计时 & 8. 玩家物理（PlayerController 管理）
  const pState = playerController.getState();
  if (pState.dead) {
    if (inSession() && !isHost()) {
      // 客机：死亡由房主权威裁决复活，本地保持死亡视觉等待
      playerController.maintainDeathVisual();
      return;
    }
    // 房主/单机：控制器内部倒计时死亡并复活
    playerController.step(dt, getMode(), true);
    return;
  }

  // 注入输入（单机/房主/客机统一从本地 keys 表提取）
  const inputKeys = getLocalInputKeys();
  playerController.setInput(inputKeys);

  if (inSession() && !isHost()) {
    // 客机模式：发送输入 + 本地预测（随后被权威状态矫正）
    net.sendInput(inputKeys);
  }

  // 物理 + 碰撞 + 动画（单机/房主/客机统一走 controller.step）
  playerController.step(dt, getMode(), true);

  // 持有双跳增益时：持续飘散小绿色箭头（玩家持有的可视化指示）
  spawnBoostArrows();

  // 9. 房主模式：模拟所有客机物理 + 广播状态
  if (isHost()) {
    stepRemoteClients(dt);
    _stateTick++;
    if (_stateTick >= STATE_INTERVAL) {
      _stateTick = 0;
      broadcastHostState();
    }
  }
}

/** 双跳增益持续粒子 —— 玩家持有 extraJumps 能力时，围绕身体周期飘散小绿箭头 */
function spawnBoostArrows(): void {
  const s = playerController.getState();
  if (s.dead || s.extraJumpsMax <= 0) return;
  // 每 0.2s 发射 1 枚（gs.time 固定步长递增，帧率无关）
  if (Math.floor(gs.time * 20) % 4 !== 0) return;
  const t = gs.time * 3;
  spawnParticles(
    FX.arrowBoost,
    s.x + Math.sin(t) * 0.5,
    s.y + 0.2 + Math.cos(t * 1.3) * 0.4,
    1,
  );
}

/** 步进所有客机玩家（房主用） */
function stepRemoteClients(dt: number): void {
  for (const [id, rp] of remotes) {
    // 死亡计时
    if (rp.dead) {
      rp.deadT -= dt;
      if (rp.deadT <= 0) {
        // 复活
        rp.dead = false;
        rp.x = rp.cpX ?? 6;
        rp.y = (rp.cpY ?? 4) + 1.2;
        rp.vx = 0;
        rp.vy = 0;
        rp.inv = 1.2;
        rp.plat = null;
        rp.track = null;
      }
      continue;
    }
    const input = getClientInput(id);
    const signals: FrameSignals = {};
    // checkHazards=true：远程玩家无 ECS 实体，危险物检测行内处理
    stepPlayerGeneric(rp, input, dt, false, signals, true);

    // 远程玩家收集光球检测（共享光球，任何人收集即计数）
    if (updateCollectSystem(rp.x, rp.y)) signals.collected = true;
    // 远程玩家检查点激活（记录该玩家个人复活点）
    const cp = updateRespawnPointSystem(rp.x, rp.y);
    if (cp) {
      rp.cpX = cp.x;
      rp.cpY = cp.y;
      signals.checkpointHit = true;
    }
    // 远程玩家双跳光球收集
    if (updateJumpBoostSystem(rp.x, rp.y)) {
      rp.extraJumpsMax = 1;
      rp.extraJumps = 1;
      signals.jumpBoostPicked = true;
    }

    stepPlayerAnimation(rp, dt, signals);
  }
}

/** 构建权威状态并广播（房主用） */
function broadcastHostState(): void {
  _netSeq++;

  // 本地玩家
  const pS = playerController.getState();
  const players: NetPlayerState[] = [{
    playerId: room.playerId,
    x: pS.x, y: pS.y, vx: pS.vx, vy: pS.vy,
    face: pS.face, grounded: pS.grounded, dead: pS.dead,
    sprint: pS.sprint, inv: pS.inv,
    hasPlat: pS.plat !== null, platDx: pS.plat ? pS.plat.dx : 0,
    ...packTrack(pS.track),
  }];

  // 远程玩家
  for (const [id, rp] of remotes) {
    players.push({
      playerId: id,
      x: rp.x, y: rp.y, vx: rp.vx, vy: rp.vy,
      face: rp.face, grounded: rp.grounded, dead: rp.dead,
      sprint: rp.sprint, inv: rp.inv,
      hasPlat: false, platDx: 0,
      ...packTrack(rp.track),
    });
  }

  // 光球状态
  const orbs = collectOrbStates();

  net.sendHostState(_netSeq, players, orbs, gs.gt, gs.gotN, gs.deaths, gs.win);
}

/** 收集光球状态（ECS 查询） */
function collectOrbStates(): NetOrbState[] {
  const states: NetOrbState[] = [];
  for (const e of world.query(Position, Collectible)) {
    const col = world.get<{ collected: boolean }>(e, Collectible);
    states.push({ entityId: e as number, collected: col.collected });
  }
  return states;
}

/** 提取本地按键为输入快照 */
function getLocalInputKeys(): InputKeys {
  return {
    left: keys.ArrowLeft || keys.KeyA,
    right: keys.ArrowRight || keys.KeyD,
    jump: keys.Space || keys.KeyW || keys.ArrowUp,
    sprint: keys.ShiftLeft || keys.ShiftRight,
  };
}

/* ==================== 客机网络事件绑定 ==================== */

// 注册网络事件处理器（首次导入时执行）
let _netWired = false;
function wireNetEvents(): void {
  if (_netWired) return;
  _netWired = true;

  net.on('state', (seq, players, orbs, gt, gotN, deaths, win) => {
    if (room.role !== 'client') return;

    // 更新远程玩家渲染位置
    applyNetPlayers(players);

    // 客机：找自己的权威状态
    const self = getSelfAuthority(players);
    if (self) {
      const pS = playerController.getState();
      const dx = pS.x - self.x;
      const dy = pS.y - self.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0.5) {
        // 硬矫正：偏差大于 0.5 格
        const selfPs = players.find(p => p.playerId === room.playerId);
        playerController.applyCorrection(
          self.x, self.y,
          selfPs?.vx ?? pS.vx,
          selfPs?.vy ?? pS.vy,
          selfPs?.face ?? pS.face,
          selfPs?.grounded ?? pS.grounded,
          selfPs ? unpackTrack(selfPs) : undefined,
        );
      }
      // 偏差小于 0.5 格：保持本地预测，不做矫正（手感优先）
      // 轨道状态差异（如房主已捕获/已释放而客机未同步）：无条件跟随权威
      else {
        const selfPs = players.find(p => p.playerId === room.playerId);
        if (selfPs) {
          const hostTrack = unpackTrack(selfPs);
          if (hostTrack === null && pS.track !== null) {
            // 房主已离开轨道 → 本地解除（位置由下帧矫正兜底）
            pS.track = null;
          } else if (hostTrack !== null) {
            // 房主在轨 → 本地若已捕获则同步 θ/速度，若未捕获则直接接管
            pS.track = hostTrack;
            pS.grounded = false;
          }
        }
      }

      // 死亡同步（权威为准）
      const selfPs = players.find(p => p.playerId === room.playerId);
      if (selfPs) {
        if (selfPs.dead && !playerController.isDead()) {
          // 房主权威判定死亡 → 本地播放死亡
          playerController.applyDeathAuthority(true, selfPs.x, selfPs.y, pS.inv);
        } else if (!selfPs.dead && playerController.isDead()) {
          // 房主已复活 → 本地复位
          playerController.applyDeathAuthority(false, selfPs.x, selfPs.y, 1.2);
        }
      }
    }

    // 更新全局状态（权威）
    gs.gt = gt;
    gs.gotN = gotN;
    gs.deaths = deaths;
    gs.win = win;
    if (win && !gs.winTime) gs.winTime = gt;

    // 更新光球状态
    applyOrbStates(orbs);
  });

  net.on('event', (kind, data) => {
    if (room.role !== 'client') return;
    // 客机只处理事件，不重复触发逻辑
    const d = data as any;
    switch (kind) {
      case 'orb':
        gs.toast = '光球 ' + d.count + ' / ' + d.total;
        gs.toastT = 2;
        break;
      case 'death':
        gs.deaths = d.deaths;
        gs.toast = '坠落 x' + gs.deaths;
        gs.toastT = 2;
        break;
      case 'checkpoint':
        gs.toast = '◆ 检查点';
        gs.toastT = 1.5;
        break;
      case 'jumpboost':
        gs.toast = '⚡ 双跳激活！';
        gs.toastT = 2;
        break;
      case 'win':
        gs.win = true;
        gs.winTime = d.time;
        break;
    }
  });

  net.on('connected', (role, playerId, players) => {
    if (role === 'host') {
      // 房主：初始化远程玩家列表
      for (const p of players) {
        if (p.id !== playerId) {
          registerRemote(p.id, p.name);
        }
      }
    }
  });

  net.on('playerJoined', (player) => {
    if (isHost()) {
      registerRemote(player.id, player.name);
    } else {
      // 客机也注册，用于渲染
      registerRemote(player.id, player.name);
    }
  });

  net.on('playerLeft', (playerId) => {
    removeRemote(playerId);
  });

  net.on('disconnected', (reason) => {
    gs.toast = '网络断开: ' + reason;
    gs.toastT = 3;
    resetRemotes();
  });

  net.on('input', (playerId, seq, keys) => {
    if (isHost()) {
      setClientInput(playerId, seq, keys);
    }
  });
}

/** 应用光球权威状态到本地 ECS */
function applyOrbStates(orbs: NetOrbState[]): void {
  for (const os of orbs) {
    const e = os.entityId as any;
    if (world.has(e, Collectible)) {
      const col = world.get<{ collected: boolean }>(e, Collectible);
      if (col.collected !== os.collected) {
        col.collected = os.collected;
        if (os.collected) gs.gotN++;
      }
    }
  }
}

/* ==================== 渲染 ==================== */

/** 逐帧渲染 */
function render(dt: number): void {
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

  // 菜单 / 大厅 / 图鉴 / 操作说明：全屏 UI 场景，直接绘制（不渲染游戏）
  if (ui.currentName === 'menu' || ui.currentName === 'lobby'
      || ui.currentName === 'gallery' || ui.currentName === 'instructions') {
    ui.draw(uiTime);
    return;
  }

  // 游戏画面（playing / paused 都画底层游戏）
  renderGame(dt);

  // 暂停 / 开发者设置：叠加场景
  if (ui.currentName === 'pause' || ui.currentName === 'dev') {
    ui.draw(uiTime);
  }
}

/** 渲染游戏画面（暂停时复用） */
function renderGame(dt: number): void {
  const pS = playerController.getState();
  updateCamera(dt, pS, gs, currentMap.width, currentMap.height);

  const vw = VW / (PPM * view.zoom);
  const vh = VH / (PPM * view.zoom);

  const pulse = Math.exp(-((gs.time * 128 / 60) % 1) * 4.5);

  ctx.globalCompositeOperation = 'lighter';
  let bg = ctx.createRadialGradient(VW / 2, VH * 1.05, 50, VW / 2, VH * 1.05, VH * 0.95);
  bg.addColorStop(0, 'rgba(120,70,255,' + (0.16 + 0.14 * pulse) + ')');
  bg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, VW, VH);
  ctx.globalCompositeOperation = 'source-over';

  drawParallax();
  drawGrid(pulse);
  drawBorder();
  drawDecos();
  drawSolids();
  drawTracks();
  drawMovers();
  drawSpringPads();
  drawCheckpoints(pulse);
  drawSpikes();
  drawLasers();
  drawOrbs();
  drawJumpBoosts();
  drawNOVA(pulse);
  drawTrail();
  drawParticles();

  // 绘制所有玩家（本地 + 远程）
  drawPlayer(pS);
  for (const [, rp] of remotes) {
    drawRemotePlayer(rp, dt);
  }

  drawHints();

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
    ctx.fillStyle = 'rgba(15,2,25,' + (0.4 * (1 - pS.deadT / 0.85)) + ')';
    ctx.fillRect(0, 0, VW, VH);
  }

  drawHUD();
  drawDebugHUD();
  drawMinimap(vw, vh);
}

/** 绘制远程玩家（走预制体通路，按 ID 取颜色变体；客机端渲染帧步进动画） */
function drawRemotePlayer(rp: RemotePlayer, dt: number): void {
  if (rp.dead) return;
  // 客机端远程玩家无物理步，动画在渲染帧推进；房主端由 stepRemotePlayer 推进
  if (!isHost()) stepPlayerAnimation(rp, dt);
  drawPlayerFor(rp, characterStyleForId(rp.id));

  // 玩家 ID 标签
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '500 11px "Segoe UI",Arial';
  ctx.fillStyle = 'rgba(200,220,255,.8)';
  ctx.fillText('P' + rp.id, sx(rp.x), sy(rp.y + 0.9));
  ctx.restore();
}

/* ==================== 帧回调 ==================== */

function frame(nowMs: number): void {
  requestAnimationFrame(frame);
  tickFPS(nowMs);
  let dt = (nowMs - last) / 1000;
  last = nowMs;
  if (dt > 0.06) dt = 0.06;
  acc += dt;
  if (acc > 0.2) acc = 0.2;
  let n = 0;
  while (acc >= FDT && n < 10) { step(FDT); acc -= FDT; n++; }
  musicTick();
  render(dt);
}

/** 启动主循环 */
export function startLoop(): void {
  wireNetEvents();
  // 注册碰撞事件处理器（幂等）
  initCollisionHooks();
  // 订阅 PlayerController 事件（玩家生命周期 → gs / sfx / 粒子 / 网络）
  wirePlayerEvents();
  requestAnimationFrame(frame);
}

/** 订阅 PlayerController 事件（幂等） */
function wirePlayerEvents(): void {
  playerController.onEvent = (event) => {
    switch (event.type) {
      case 'died':
        gs.deaths = event.deaths;
        gs.shake = 1;
        gs.flash = 0.6;
        spawnParticles(FX.death, playerController.getState().x, playerController.getState().y);
        sfx.die();
        netBus.emit({ type: 'game:death', deaths: event.deaths });
        break;
      case 'jumped':
        sfx.jump();
        break;
      case 'springed': {
        const sps = playerController.getState();
        sfx.spring();
        spawnParticles(FX.dust, sps.x, sps.y - sps.half, 8);
        gs.shake = Math.max(gs.shake, 0.25);
        break;
      }
      case 'dashed':
        sfx.dash();
        break;
      case 'landed':
        if (event.impact > 7.5) {
          const s = playerController.getState();
          spawnParticles(FX.dust, s.x, s.y - s.half, 6);
          sfx.land(event.impact * 0.02);
        }
        break;
      case 'respawned':
        // 复活无全局副作用（trail 清理在 controller 内部）
        break;
    }
  };
}

/* ==================== 输入回调 ==================== */

/** 按键逻辑（由 core/input 的 keydown 回调调用） */
export function handleKeyDown(e: KeyboardEvent): void {
  // 菜单中：Enter / Space 开始游戏
  if (gs.screen === 'menu') {
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') {
      startGame();
    }
    return;
  }

  // 暂停中：ESC 或 Enter 继续
  if (gs.screen === 'paused') {
    if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') {
      gs.screen = 'playing';
    }
    return;
  }

  // ESC → 暂停（syncUI 自动切换场景到 pause）
  if (e.code === 'Escape') {
    gs.screen = 'paused';
    return;
  }

  // 游戏中操作
  if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
    playerController.setJumpBuffer(PHYS[getMode()].jb);
  }

  if (e.code === 'KeyR') playerController.respawn();

  if (e.code === 'KeyP') {
    const cur = getMode();
    const next = cur === 'tuned' ? 'classic' : 'tuned';
    const old = PHYS[cur], nw = PHYS[next];
    playerController.getState().vy *= nw.JV / old.JV;
    setMode(next);
    gs.toast = '物理 · ' + nw.name;
    gs.toastT = 2;
  }

  if (e.code === 'KeyM') {
    AU.on = !AU.on;
    gs.toast = AU.on ? '♪ 音效：开' : '♪ 音效：关';
    gs.toastT = 2;
    if (AU.on && AU.ctx) MUS.next = AU.ctx.currentTime + 0.05;
  }
}