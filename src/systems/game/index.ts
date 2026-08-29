/**
 * 调度中枢 —— 编排各系统，管理主循环。
 * 联机模式：房主跑完整物理 + 广播权威状态；客机发输入 + 本地预测 + 矫正。
 */
import { ctx, VW, VH, DPR, PPM } from '../../core/canvas';
import { updateCamera, sx, sy, view, cam } from '../../core/camera';
import { musicTick, MUS, sfx, AU } from '../../core/audio';
import { keys } from '../../core/input';
import { currentMap, PHYS, setupLevel, cpPoint } from '../../config';
import { gs } from './gameState';
import { getMode, setMode } from './gameMode';
import { prepare } from '../ui/prepare';
import { lobby } from '../ui/lobby';
import { playerController, stepControlArbiter, stepPlayer, getPlayerScratch, buildSolids } from '../player';
import { tickPlayer } from '../player/tick';
import { FX } from '../../Prefabs/Fx';
import { spawnParticles, stepParticles, trail } from '../particles';
import { updateMotion, updateLaserTimer, updateSpringPads, updateCollisionSystem, colliderWorldRect } from '../level';
import { stepAnimation } from '../animation';
import {
  drawParallax, drawGrid, drawBorder, drawDecos, drawSolids, drawFloor, drawMovers, drawSpringPads,
  drawCheckpoints, drawSpikes, drawLasers, drawOrbs, drawJumpBoosts, drawHookPickups, drawShieldPickups, drawSpeedPickups, drawNOVA,
  drawTrail, drawParticles, drawHints, drawTracks,
  drawMotes, stepMotes, drawFog, emitItemAmbient,
} from '../../Prefabs/Scenes';
import { drawPostFX, pfxPerf } from '../postfx';
import { drawPlayer, drawPlayerFor, stepPlayerAnimation, getSelectedCharacter, getCharacterById, DEFAULT_CHARACTER } from '../../Prefabs/Player';
import { drawHUD, drawMinimap } from '../ui/hud';
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
import {
  ensurePlayerEntity, getPlayerEid,
  storePlayerComponents, ensureRemotePlayerEntity, mirrorPlayerState,
} from '../player/playerEntity';
import type { FrameSignals, InputKeys, NetPlayerState, NetOrbState, NetItemState, RemotePlayer, ItemId } from '../../types';
import { hasComponent } from 'bitecs';
import { world, Position, PathMotion, Collider, Collectible, Orb, qOrbs, qCollectibles } from '../../core/ecs';
import { query } from 'bitecs';
import { clamp } from '../../core/math';
import {
  initCollisionHooks, updateRespawnPointSystem, orbCount, tryInteractCheckpoint, setCollisionSim,
} from '../interactions';
import { packTrack, unpackTrack } from '../../core/trackCodec';
import { mouse } from '../../core/mouse';
import { drawHookAim, drawHookRope, mouseAimDir, defaultAimDir } from '../items/hook';
import { itemToNet, netToItem, reconcileShield, reconcileSpeed } from '../items/backpack';
import { wireTriggerSystem } from '../effects/TriggerSystem';
import { stepAuraSystem, resetAuraState } from '../level/AuraSystem';

/* ==================== 轨道状态序列化（问题 10：统一走 core/trackCodec） ==================== */

/* ==================== 网络状态序号 ==================== */
let _netSeq = 0;
let _stateTick = 0; // 房主状态广播计数器（每 2 帧广播一次，降低带宽）
const STATE_INTERVAL = 2;

/** 客户端尚未上报输入时的兜底：空输入（静止），绝不读本机键盘 */
const IDLE_INPUT: InputKeys = {
  left: false, right: false, jump: false, sprint: false,
  interact: false, hook: false, aimX: 0, aimY: 0,
};

/** 远程玩家上一帧 interact 状态（用于检测"按下沿"） */
const remoteInteractPrev = new Map<number, boolean>();

/** 远程玩家上一帧 hook 按下状态（用于检测"按下沿"） */
const remoteHookPrev = new Map<number, boolean>();

/* ==================== 开始游戏 ==================== */

/**
 * 切图进场串联（单机/房主/客机共用）：
 * 清空旧 ECS 实体 → loadMap(id) → 重建实体 → 玩家复位 → gs 复位 → 相机复位。
 */
export function applyLevel(mapId: string): void {
  setupLevel(mapId);
  resetAuraState(); // 光环进出/周期状态随切图清空
  const sp = currentMap.playerSpawn;
  playerController.resetToSpawn(sp.x, sp.y);
  // 玩家 ECS 实体：setupLevel 已 clearWorld + initEcs，这里重建并同步出生点
  ensurePlayerEntity(room.playerId);
  playerController.flush(); // 初始化写回（实体新建，全字段落位）
  // gs 计数/计时复位
  gs.gt = 0;
  gs.gotN = 0;
  gs.deaths = 0;
  gs.win = false;
  gs.winTime = 0;
  gs.toast = '';
  gs.toastT = 0;
  // 相机复位到出生点（避免镜头从旧图边界缓移）
  cam.x = sp.x;
  cam.y = sp.y + 3;
  const vwp = VW / (PPM * view.zoom);
  const vhp = VH / (PPM * view.zoom);
  view.SL = cam.x - vwp / 2;
  view.SB = cam.y - vhp / 2;
}

/** 单机开始（准备界面确认后立即进场，用当前所选地图） */
export function startGame(): void {
  prepare.mode = 'prepare';
  applyLevel(prepare.mapId);
  gs.screen = 'playing';
  gs.scene = null; // 基础 UI 场景真源：游戏中无覆盖
  gs.started = true;
  if (isHost()) {
    // 房主模式下，重置远程玩家
    resetRemotes();
  }
}

/** 联机房主开始：广播所选地图（level 事件）→ 稍候本地进场 */
export function startMultiplayerGame(): void {
  if (!isHost()) return;
  net.sendHostEvent('level', { mapId: prepare.mapId });
  // 给客机留出「收到 level → 重建世界」的时间，避免双方世界不一致
  setTimeout(() => startGame(), 350);
}

/* ==================== 主循环 ==================== */

let last = performance.now();
let acc = 0;
const FDT = 1 / 120;

/* ==================== 渲染 alpha 插值（问题 8） ==================== */

/** 玩家上一物理批步前快照（渲染插值起点） */
let prevPx = 0, prevPy = 0;
/** 移动平台上一物理批步前世界位置快照（[x, top] × 实体数，模块级复用数组） */
let prevMovers: number[] = [];
/** 渲染插值视图（复用对象，避免每帧分配） */
let interpView: import('../../types').PlayerState | null = null;

/** 物理批步前快照：记录玩家与移动平台的世界位置（帧渲染插值用） */
function snapshotRenderPrev(): void {
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

/** 渲染插值系数：已用物理批步与帧间隔的比例（0..1） */
function renderAlpha(): number {
  return clamp(acc / FDT, 0, 1);
}

/** 插值绘制本地玩家（表现层；物理仍 120Hz 步进） */
function drawLocalPlayerInterpolated(alpha: number): void {
  const pS = playerController.getState();
  if (alpha >= 1 || gs.screen !== 'playing') {
    drawPlayer(pS, getSelectedCharacter());
    return;
  }
  const rv = interpView ?? (interpView = { ...pS });
  rv.x = prevPx + (pS.x - prevPx) * alpha;
  rv.y = prevPy + (pS.y - prevPy) * alpha;
  drawPlayer(rv, getSelectedCharacter());
}

/** 逐帧步进（固定时间步长 1/120s） */
function step(dt: number): void {
  // 1. 时间
  gs.time += dt;

  // 捕获鼠标按下沿（即使暂停/菜单中也推进，避免暂停点击恢复后误触）
  const hookEdge = mouse.down && !mouse.prevDown;
  mouse.prevDown = mouse.down;

  // 2. 关卡级系统（移动平台运动 / 弹簧动画 / 激光计时）
  updateMotion();
  updateSpringPads(dt);
  updateLaserTimer();

  // 2.5 光环系统（范围持续场，扩展占位；当前无地图光环 → 查询为空，零成本）
  // 本地 + 远端玩家统一进同一光环场（房主对远端同判定）
  const auraPlayers = [{ id: room.playerId, state: playerController.getState() }];
  for (const [id, rp] of remotes) {
    if (!rp.dead) auraPlayers.push({ id, state: rp });
  }
  stepAuraSystem(dt, auraPlayers);

  // 3. 实体动画 FSM 步进（场景道具 / 未来敌人 / NPC；输出在渲染帧由绘制层实时求值）
  stepAnimation(dt);

  // 4. 粒子 + 曳光
  stepParticles(dt);
  stepMotes(dt);          // 美术升级 3：前景浮尘步进
  emitItemAmbient(dt);    // 美术升级 5：光球环境光尘

  // 5. Toast 衰减
  if (gs.toastT > 0) gs.toastT -= dt;

  // 6. 暂停/菜单/大厅中不执行游戏逻辑
  if (gs.screen !== 'playing') return;

  // 7. 游戏计时 & 7.5 碰撞几何（问题 7：每物理步仅重建一次；物理入口 solidsPrebuilt=true 跳过）
  gs.gt += dt;
  buildSolids();

  // 8-10. A 路线：ECS 组件真源 → scratch → 共享物理引擎 → 渲染只读视图 → 统一 tick 管线。
  //      死亡实体物理冻结（stepPlayer 内部仅推进 deadT）；每物理步恰好一次装载/一次写回。
  const signals: FrameSignals = {};
  const inputKeys = getLocalInputKeys();
  const pvPrev = playerController.getState(); // 上一帧镜像 = 上一帧步后状态（边沿检测基准）

  stepPlayer(getPlayerEid(), inputKeys, dt, true, signals, true);
  playerController.mirrorFrom(getPlayerScratch()); // scratch → 视图（零分配）
  const pState = playerController.getState(); // 渲染只读视图 = tick 工作副本

  if (inSession() && !isHost()) {
    // 客机模式：发送输入 + 本地预测（随后被权威状态矫正）
    net.sendInput(inputKeys);
  }

  // 统一玩家 tick 管线（死亡登记/倒计时/交互=碰撞系统/钩锁/buff/动画/曳光/写回/仲裁）
  tickPlayer(pState, getPlayerEid(), inputKeys, signals, {
    dt,
    isLocal: true,
    hookEdge,
    aim: { x: inputKeys.aimX, y: inputKeys.aimY },
    sfx: true,
    prev: { dead: pvPrev.dead, vy: pvPrev.velocity.y, sprint: pvPrev.wasSpr, grounded: pvPrev.grounded },
    deathMode: inSession() && !isHost() ? 'wait' : 'countdown',
    spawnX: cpPoint.x,
    spawnY: cpPoint.y,
    interactions: (p, _input, sig) => {
      // 本地碰撞系统：危险/收集/检查点/终点经 collisionBus → CollisionHooks（作用于本地视图）
      updateCollisionSystem(p, sig as Record<string, boolean>);
    },
    onDiedEdge: () => {
      playerController.emitEvent({ type: 'player:died', deaths: playerController.registerDeath() });
    },
    onRespawn: () => {
      trail.length = 0;
      playerController.emitEvent({ type: 'player:respawned' });
    },
    onBuffExpired: (source) => {
      if (source === 'shield') { gs.toast = '护盾失效'; gs.toastT = 2; }
      if (source === 'speed') { gs.toast = '加速失效'; gs.toastT = 2; }
    },
    onEvent: (e) => {
      playerController.emitEvent(e);
    },
  });

  // 10. 房主模式：模拟所有客机物理 + 广播状态
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
    // A 路线：远端玩家也拥有实体（混合范式消失），统一走 stepPlayer(eid) 入口
    if (rp.eid == null) rp.eid = ensureRemotePlayerEntity(rp.id);
    const input = getClientInput(id);
    const signals: FrameSignals = {};
    const wasDead = rp.dead;
    const prevVy = rp.velocity.y;
    const prevSprint = rp.wasSpr;
    const wasGrounded = rp.grounded;
    // 客户端未上报输入（null）→ 兜底为空输入（静止），物理不依赖本机键盘
    stepPlayer(rp.eid, input ?? IDLE_INPUT, dt, false, signals, true);
    mirrorPlayerState(rp, getPlayerScratch()); // scratch → rp（零分配，保持 remotes Map 对象身份）

    // 钩锁按下沿（客机上报鼠标瞄准 + 左键按住状态；沿 = hold && !prev）
    const hookNow = input?.hook ?? false;
    const hookPrev = remoteHookPrev.get(id) ?? false;
    remoteHookPrev.set(id, hookNow);

    // 统一玩家 tick 管线（死亡倒计时/复活；交互=碰撞版 sim 路由到 rp + 检查点坐标交互）
    tickPlayer(rp, rp.eid, input ?? IDLE_INPUT, signals, {
      dt,
      isLocal: false,
      hookEdge: hookNow && !hookPrev,
      aim: { x: input?.aimX ?? 0, y: input?.aimY ?? 0 },
      sfx: false,
      prev: { dead: wasDead, vy: prevVy, sprint: prevSprint, grounded: wasGrounded },
      deathMode: 'countdown',
      spawnX: rp.cpX ?? 6,
      spawnY: rp.cpY ?? 4,
      interactions: (p, _inp, sig) => {
        // 碰撞版交互：远端同样走 collisionBus，钩子经 sim 上下文路由到 rp（危险/收集/道具）
        setCollisionSim({ p, remoteId: id });
        updateCollisionSystem(p, sig as Record<string, boolean>);
        setCollisionSim(null);
        // 检查点激活（远端：坐标 + interact 按下沿；碰撞仅标记附近，不激活）
        const interactNow = input?.interact ?? false;
        const interactPrev = remoteInteractPrev.get(id) ?? false;
        remoteInteractPrev.set(id, interactNow);
        const cp = interactNow && !interactPrev
          ? updateRespawnPointSystem(p.x, p.y, true)
          : updateRespawnPointSystem(p.x, p.y, false);
        if (cp) {
          rp.cpX = cp.x;
          rp.cpY = cp.y;
          sig.checkpointHit = true;
        }
        // 死亡边沿（房主判定权威）：死亡特效 + 广播给客机（物理坠落/碰撞致死均覆盖）
        if (!wasDead && p.dead) {
          spawnParticles(FX.death, p.x, p.y);
          netBus.emit({ type: 'fx:death', x: p.x, y: p.y, playerId: id });
        }
      },
      onDiedEdge: () => { /* 死亡特效/广播由 interactions 内死亡边沿统一处理 */ },
      onRespawn: () => { /* 远端复活无本地副作用 */ },
      onBuffExpired: () => { /* 远端 buff 到期无 toast */ },
      onEvent: () => { /* 远端无反馈音效/粒子 */ },
    });
  }
}

/** 构建权威状态并广播（房主用） */
function broadcastHostState(): void {
  _netSeq++;

  // 本地玩家
  const pS = playerController.getState();
  const players: NetPlayerState[] = [{
    playerId: room.playerId,
    x: pS.x, y: pS.y, vx: pS.velocity.x, vy: pS.velocity.y,
    face: pS.face, grounded: pS.grounded, dead: pS.dead,
    sprint: pS.sprint, inv: pS.inv,
    speedMult: pS.speedMult,
    hasPlat: pS.plat !== null, platDx: pS.plat ? pS.plat.dx : 0,
    ...packTrack(pS.track),
    backpack: pS.backpack.map(itemToNet),
  }];

  // 远程玩家
  for (const [id, rp] of remotes) {
    players.push({
      playerId: id,
      x: rp.x, y: rp.y, vx: rp.velocity.x, vy: rp.velocity.y,
      face: rp.face, grounded: rp.grounded, dead: rp.dead,
      sprint: rp.sprint, inv: rp.inv,
      speedMult: rp.speedMult,
      hasPlat: false, platDx: 0,
      ...packTrack(rp.track),
      backpack: rp.backpack.map(itemToNet),
    });
  }

  // 光球状态 + 道具状态（jumpboost / hook collected）
  const orbs = collectOrbStates();
  const items = collectItemStates();

  net.sendHostState(_netSeq, players, orbs, items, gs.gt, gs.gotN, gs.deaths, gs.win);
}

/** 收集光球状态（ECS 查询，仅 Orb tag） */
function collectOrbStates(): NetOrbState[] {
  const states: NetOrbState[] = [];
  for (const e of qOrbs()) {
    states.push({ entityId: e, collected: Collectible.collected[e] === 1 });
  }
  return states;
}

/** 收集道具状态（非 orb 的可拾取物 collected，供客机同步去重） */
function collectItemStates(): NetItemState[] {
  const states: NetItemState[] = [];
  for (const e of qCollectibles()) {
    if (hasComponent(world, e, Orb)) continue; // 光球走 orbs 通道
    states.push({ entityId: e, collected: Collectible.collected[e] === 1 });
  }
  return states;
}

/** 提取本地按键为输入快照 */
function getLocalInputKeys(): InputKeys {
  const pState = playerController.getState();
  // 钩锁方向 = 鼠标引导单位向量（非世界坐标），未移动过鼠标时回退面朝方向
  const dir = mouse.used ? mouseAimDir(pState) : defaultAimDir(pState);
  // 主动装备：仅选中钩锁槽位且装备了钩锁时，上报**左键按住状态**（房主据此刻
  // 滑索到站锁定/脱钩；房主端用 hold && !prev 还原发射沿）
  const canHook = pState.backpack[pState.selectedSlot] === 'hook';
  return {
    left: keys.ArrowLeft || keys.KeyA,
    right: keys.ArrowRight || keys.KeyD,
    jump: keys.Space || keys.KeyW || keys.ArrowUp,
    sprint: keys.ShiftLeft || keys.ShiftRight,
    interact: keys.KeyE,
    hook: mouse.down && canHook,
    aimX: dir.x,
    aimY: dir.y,
  };
}

/* ==================== 客机网络事件绑定 ==================== */

// 注册网络事件处理器（首次导入时执行）
let _netWired = false;
function wireNetEvents(): void {
  if (_netWired) return;
  _netWired = true;

  net.on('state', (seq, players, orbs, items, gt, gotN, deaths, win) => {
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
          selfPs?.vx ?? pS.velocity.x,
          selfPs?.vy ?? pS.velocity.y,
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
          playerController.applyDeathAuthority(true, selfPs.x, selfPs.y, pS.inv);
        } else if (!selfPs.dead && playerController.isDead()) {
          playerController.applyDeathAuthority(false, selfPs.x, selfPs.y, 1.2);
        }
        // 背包权威同步（替换本地预测，与 extraJumpsMax 同模式）
        if (selfPs.backpack) {
          pS.backpack = selfPs.backpack.map(netToItem);
        }
        // 护盾一致性：房主超时移除护盾 → 本地盾能力随之清除（背包为权威）
        reconcileShield(pS);
        // 加速一致性：房主超时移除加速 → 本地速度倍率随之清除（背包为权威）
        reconcileSpeed(pS);
      }

      // 步外权威矫正：立即写回组件（ECS 真源；hydrateFrom 已删除，写入即权威）
      playerController.flush();
    }

    // 更新全局状态（权威）
    gs.gt = gt;
    gs.gotN = gotN;
    gs.deaths = deaths;
    gs.win = win;
    if (win && !gs.winTime) gs.winTime = gt;

    // 更新光球状态
    applyOrbStates(orbs);
    // 更新道具状态（jumpboost / hook 实体 collected）
    applyItemStates(items ?? []);
  });

  net.on('event', (kind, data) => {
    if (room.role !== 'client') return;
    // 客机只处理事件，不重复触发逻辑
    const d = data as any;
    switch (kind) {
      case 'level': {
        // 房主选择的关卡：重建本地世界（仅本地玩家）→ 进入游戏
        const mapId = d?.mapId;
        if (typeof mapId === 'string') {
          // 退出房间阶段
          lobby.mode = 'none';
          lobby.inRoom = false;
          lobby.myReady = false;
          applyLevel(mapId);
          gs.screen = 'playing';
          gs.scene = null; // 基础 UI 场景真源：游戏中无覆盖
          gs.started = true;
        }
        break;
      }
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
        gs.toast = '双跳激活！';
        gs.toastT = 2;
        break;
      case 'hookpickup':
        gs.toast = '队友拾取了钩锁';
        gs.toastT = 2;
        break;
      case 'shieldpickup':
        gs.toast = '队友拾取了护盾';
        gs.toastT = 2;
        break;
      case 'speedpickup':
        gs.toast = '队友拾取了加速';
        gs.toastT = 2;
        break;
      case 'win':
        gs.win = true;
        gs.winTime = d.time;
        // 客机在非自己获胜时播放庆祝特效
        if (d.playerId !== room.playerId && d.x != null && d.y != null) {
          spawnParticles(FX.confetti, d.x, d.y);
        }
        break;
      // ── 死亡特效：房主广播（房主是死亡判定权威）──
      case 'fx_death':
        // 自己的死亡已在本地播放，不再重复
        if (d.playerId === room.playerId) break;
        spawnParticles(FX.death, d.x, d.y);
        break;
      // ── 护盾破碎特效：房主广播（房主是格挡判定权威）──
      case 'fx_shieldbreak':
        // 自己的破盾已在本地播放，不再重复
        if (d.playerId === room.playerId) break;
        spawnParticles(FX.shieldBreak, d.x, d.y);
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

/** 应用光球权威状态到本地 ECS + 本地特效（状态转变检测） */
function applyOrbStates(orbs: NetOrbState[]): void {
  for (const os of orbs) {
    const e = os.entityId;
    if (!hasComponent(world, e, Orb)) continue;
    if (Collectible.collected[e] !== (os.collected ? 1 : 0)) {
      Collectible.collected[e] = os.collected ? 1 : 0;
      if (os.collected) {
        gs.gotN++;
        // 本地播放光球收集特效（状态转变检测，无需网络广播）
        spawnParticles(FX.sparkle, Position.x[e], Position.y[e]);
        // 全收集庆祝
        if (gs.gotN === orbCount()) {
          spawnParticles(FX.confetti, Position.x[e], Position.y[e]);
        }
      }
    }
  }
}

/** 应用道具权威状态（非 orb 可拾取物 collected）到本地 ECS */
function applyItemStates(items: NetItemState[]): void {
  for (const is of items) {
    const e = is.entityId;
    if (!hasComponent(world, e, Collectible)) continue;
    if (hasComponent(world, e, Orb)) continue;
    if (Collectible.collected[e] !== (is.collected ? 1 : 0)) {
      Collectible.collected[e] = is.collected ? 1 : 0;
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

  // 菜单 / 准备流程 / 大厅 / 图鉴 / 操作说明：全屏 UI 场景，直接绘制（不渲染游戏）
  if (ui.currentName === 'menu' || ui.currentName === 'lobby'
      || ui.currentName === 'gallery' || ui.currentName === 'instructions'
      || ui.currentName === 'prepare' || ui.currentName === 'mapSelect' || ui.currentName === 'charSelect') {
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

  // （删除：原底部脉冲渐变 → Bloom 放大后成为全屏"闪光"，见 git 历史）

  drawParallax();
  drawGrid(pulse);
  drawBorder();
  drawDecos();
  drawFloor();
  drawSolids();
  drawTracks();
  drawMovers(renderAlpha(), prevMovers); // 问题 8：移动平台 alpha 插值
  drawSpringPads();
  drawCheckpoints(pulse);
  drawSpikes();
  drawLasers();
  drawOrbs();
  drawJumpBoosts();
  drawHookPickups();
  drawShieldPickups();
  drawSpeedPickups();
  drawNOVA(pulse);
  drawTrail();
  drawParticles();

  // 钩锁瞄准预览（在玩家下方，半透明线）
  drawHookAim(pS);

  // 绘制所有玩家（本地 alpha 插值 + 远程）
  drawLocalPlayerInterpolated(renderAlpha());
  for (const [, rp] of remotes) {
    drawRemotePlayer(rp, dt);
  }

  // 滑索绳索（在玩家上方，金色线）
  drawHookRope(pS);

  drawHints();

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
    ctx.fillStyle = 'rgba(15,2,25,' + (0.4 * (1 - pS.deadT / 0.85)) + ')';
    ctx.fillRect(0, 0, VW, VH);
  }

  drawHUD();
  drawDebugHUD();
  drawMinimap(vw, vh);

  // ★ 美术升级 1：后期特效管线（最后一层，覆盖全画布）
  drawPostFX();
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

/* ==================== 帧回调 ==================== */

function frame(nowMs: number): void {
  requestAnimationFrame(frame);
  tickFPS(nowMs);
  pfxPerf(nowMs - last); // 后期特效自适应降级（美术升级 1）
  let dt = (nowMs - last) / 1000;
  last = nowMs;
  if (dt > 0.06) dt = 0.06;
  acc += dt;
  if (acc > 0.2) acc = 0.2;
  // 问题 8：物理批步前快照（渲染 alpha 插值基准；仅表现层，不影响确定性物理）
  snapshotRenderPrev();
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
  // 问题 4：玩家事件经 netBus 统一通道（wirePlayerEvents=gs/sfx/粒子；TriggerSystem=fireTriggers）
  wireTriggerSystem();
  wirePlayerEvents();
  requestAnimationFrame(frame);
}

let _playerEventsWired = false;
/** 订阅玩家事件（问题 4）：PlayerController 经 netBus 统一派发；fireTriggers 逻辑由 TriggerSystem 订阅 */
function wirePlayerEvents(): void {
  if (_playerEventsWired) return;
  _playerEventsWired = true;
  netBus.on('player:*', (event) => {
    switch (event.type) {
      case 'player:died': {
        const dp = playerController.getState();
        gs.deaths = event.deaths;
        gs.shake = 1;
        gs.flash = 0.6;
        spawnParticles(FX.death, dp.x, dp.y);
        netBus.emit({ type: 'fx:death', x: dp.x, y: dp.y, playerId: room.playerId });
        sfx.die();
        netBus.emit({ type: 'game:death', deaths: event.deaths });
        break;
      }
      case 'player:jumped':
        sfx.jump();
        break;
      case 'player:springed': {
        const sps = playerController.getState();
        sfx.spring();
        spawnParticles(FX.dust, sps.x, sps.y - sps.half, 8);
        spawnParticles(FX.springBurst, sps.x, sps.y - sps.half); // 美术升级 6：弹簧弹射火花
        gs.shake = Math.max(gs.shake, 0.25);
        break;
      }
      case 'player:dashed':
        sfx.dash();
        break;
      case 'player:landed':
        if (event.impact > 7.5) {
          const s = playerController.getState();
          spawnParticles(FX.dust, s.x, s.y - s.half, 6);
          sfx.land(event.impact * 0.02);
        }
        break;
      case 'player:respawned':
        // 复活无全局副作用（trail 清理在 controller 内部）
        break;
      case 'player:doubleJumped': {
        const dj = playerController.getState();
        spawnParticles(FX.doubleJump, dj.x, dj.y - dj.half, 8);
        break;
      }
    }
  });
}

/* ==================== 输入回调 ==================== */

/** 按键逻辑（由 core/input 的 keydown 回调调用） */
export function handleKeyDown(e: KeyboardEvent): void {
  // 准备流程（含两个选择子页）：ESC 逐级返回，Enter/Space 单机开始（场景经 ui.show 唯一入口）
  if (gs.screen === 'prepare') {
    if (prepare.mode === 'maps' || prepare.mode === 'chars') {
      if (e.code === 'Escape') {
        prepare.mode = 'prepare';
        ui.show('prepare');
      }
      return;
    }
    if (e.code === 'Escape') {
      ui.show('menu');
    } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') {
      startGame();
    }
    return;
  }

  // 菜单中：Enter / Space 进入准备界面（选图/选人）
  if (gs.screen === 'menu') {
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') {
      prepare.mode = 'prepare';
      ui.show('prepare');
    }
    return;
  }

  // 暂停中：ESC 或 Enter 继续（弹出 pause 叠层 → 回游戏）
  if (gs.screen === 'paused') {
    if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') {
      ui.show(null);
    }
    return;
  }

  // ESC → 暂停（叠层：push pause）
  if (e.code === 'Escape') {
    ui.show('pause');
    return;
  }

  // 游戏中操作
  if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
    // 直写组件（setJumpBuffer 内部），不再需要"防下帧 hydrate 覆盖"补丁
    playerController.setJumpBuffer(PHYS[getMode()].jb);
  }

  if (e.code === 'KeyR') {
    playerController.respawn(); // respawn 内部已直写组件
  }

  // 数字键 1-5：选中背包槽位（主动道具装备栏）
  if (e.code >= 'Digit1' && e.code <= 'Digit5') {
    const slot = parseInt(e.code[5]) - 1; // 'Digit1' → 0
    playerController.setSelectedSlot(slot); // 直写组件
    gs.toast = '装备栏 ' + (slot + 1);
    gs.toastT = 1.2;
  }

  // E 键：检查点交互（按 E 激活附近的可交互检查点）
  if (e.code === 'KeyE') tryInteractCheckpoint();

  if (e.code === 'KeyP') {
    const cur = getMode();
    const next = cur === 'tuned' ? 'classic' : 'tuned';
    const old = PHYS[cur], nw = PHYS[next];
    playerController.scaleVerticalVelocity(nw.JV / old.JV); // 直写组件
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