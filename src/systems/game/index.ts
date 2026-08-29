/**
 * 调度中枢 —— 编排各系统，管理主循环。
 * 联机模式：房主跑完整物理 + 广播权威状态；客机发输入 + 本地预测 + 矫正。
 */
import { ctx, VW, VH, DPR, PPM } from '../../core/canvas';
import { updateCamera, sx, sy, view, cam } from '../../core/camera';
import { musicTick, MUS, sfx, AU } from '../../core/audio';
import { keys } from '../../core/input';
import { currentMap, PHYS, setupLevel } from '../../config';
import { gs } from './gameState';
import { getMode, setMode } from './gameMode';
import { prepare } from '../ui/prepare';
import { lobby } from '../ui/lobby';
import { playerController, stepControlArbiter } from '../player';
import { stepPlayerByMode, resolveControlMode } from '../player';
import { FX } from '../../Prefabs/Fx';
import { spawnParticles, stepParticles } from '../particles';
import { updateMotion, updateLaserTimer, updateSpringPads } from '../level';
import { stepAnimation } from '../animation';
import {
  drawParallax, drawGrid, drawBorder, drawDecos, drawSolids, drawFloor, drawMovers, drawSpringPads,
  drawCheckpoints, drawSpikes, drawLasers, drawOrbs, drawJumpBoosts, drawHookPickups, drawShieldPickups, drawNOVA,
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
import { ensurePlayerEntity, syncToEcs, syncFromEcs, getPlayerEid } from '../player/playerEntity';
import type { FrameSignals, InputKeys, NetPlayerState, NetOrbState, NetItemState, RemotePlayer, TrackState, PathSegment, ItemId } from '../../types';
import { hasComponent } from 'bitecs';
import { world, Position, Collectible, Orb, qOrbs, qCollectibles } from '../../core/ecs';
import { initCollisionHooks, updateCollectSystem, updateRespawnPointSystem, updateItemPickupSystem, orbCount, tryInteractCheckpoint, checkHazardOverlap } from '../interactions';
import { buildCumulativeLengths, pathTotalLength } from '../../core/path';
import { mouse } from '../../core/mouse';
import { drawHookAim, drawHookRope, mouseAimDir, defaultAimDir } from '../items/hook';
import { addItem, ITEMS, itemToNet, netToItem, reconcileShield } from '../items/backpack';
import { stepActiveItem } from '../items/activeItem';
import { applyEffect, stepBuffTimers } from '../effects';
import { fireTriggers } from '../effects/TriggerSystem';
import { stepAuraSystem, resetAuraState } from '../level/AuraSystem';

/* ==================== 轨道状态序列化辅助 ==================== */

/** 将 TrackState 转为 NetPlayerState 的平铺字段 */
function packTrack(t: TrackState | null): {
  trackOn: boolean; trackDist: number; trackSpeed: number;
  trackEntry: number; trackExit: number; trackSegments: PathSegment[];
  trackZipline: boolean;
} {
  if (!t) return { trackOn: false, trackDist: 0, trackSpeed: 0, trackEntry: 0, trackExit: 0, trackSegments: [], trackZipline: false };
  return { trackOn: true, trackDist: t.dist, trackSpeed: t.speed, trackEntry: t.entryDist, trackExit: t.exitDist, trackSegments: t.segments, trackZipline: !!t.zipline };
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
    zipline: fields.trackZipline,
  };
}

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
  syncToEcs(playerController.getState());
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

  // 7. 游戏计时
  gs.gt += dt;

  // 8. 组件真源 → 工作副本（阶段 B：物理前从玩家实体加载）
  const view = syncFromEcs(getPlayerEid());
  if (view) playerController.hydrateFrom(view);

  // 9. 死亡计时 & 10. 玩家物理（PlayerController 管理）
  const pState = playerController.getState();
  if (pState.dead) {
    if (inSession() && !isHost()) {
      // 客机：死亡由房主权威裁决复活，本地保持死亡视觉等待
      playerController.maintainDeathVisual();
      syncToEcs(pState);
      stepControlArbiter(pState, getPlayerEid()); // S3：死亡分支也写 ControlMode（=DEAD）
      return;
    }
    // 房主/单机：控制器内部倒计时死亡并复活
    playerController.step(dt, getMode(), true);
    syncToEcs(pState);
    stepControlArbiter(pState, getPlayerEid()); // S3：结算后控制权（可能已复活）
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

  // 限时 buff 计时（护盾等）：到期自动失效（死亡分支已提前 return → 死亡期间计时暂停）
  const expired = stepBuffTimers(pState, dt);
  for (const ex of expired) {
    ITEMS[ex.source as ItemId]?.onExpire?.(pState);
    if (ex.source === 'shield') {
      gs.toast = '护盾失效';
      gs.toastT = 2;
    }
  }
  // 护盾一致性：格挡消耗 / 超时两条失效路径统一收尾（背包自动退出）
  reconcileShield(pState);

  // 7. 主动道具（S7 槽位 ActiveItemSystem）：按选中槽位派发（本地鼠标边沿/瞄准）
  //    必须在 syncToEcs 之前：钩锁写 track/hookCd 到副本，随步末统一写回组件
  stepActiveItem(pState, { dt, hookEdge, aim: { x: inputKeys.aimX, y: inputKeys.aimY }, sfx: true });

  // 工作副本 → 组件（阶段 B：物理步后写回，组件是唯一权威存储）
  syncToEcs(pState);

  // S3 控制权仲裁：从本帧物理结果推导控制权写入 ControlMode 组件。
  // 物理步之后调用 → mode 反映"结算后"状态；MovementSystem 未来在物理步内消费。
  stepControlArbiter(pState, getPlayerEid());

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
    // 死亡计时
    if (rp.dead) {
      rp.deadT -= dt;
      if (rp.deadT <= 0) {
        // 复活
        rp.dead = false;
        rp.x = rp.cpX ?? 6;
        rp.y = (rp.cpY ?? 4) + 1.2;
        rp.velocity.x = 0;
        rp.velocity.y = 0;
        rp.inv = 1.2;
        rp.plat = null;
        rp.track = null;
      }
      continue;
    }
    const input = getClientInput(id);
    const signals: FrameSignals = {};
    const wasDead = rp.dead;
    // 客户端未上报输入（null）→ 兜底为空输入（静止），物理不依赖本机键盘
    // S3 消费：与本地共用控制权仲裁 + 消费入口（远端同样走 stepPlayerByMode）
    stepPlayerByMode(rp, resolveControlMode(rp), input ?? IDLE_INPUT, dt, false, signals);

    // 远程玩家危险物：只投递 KillRequest，由结算管线裁决（与本地契约一致，不先判 inv）
    // 护盾格挡：房主是判定权威 → 本地破盾特效 + 广播给客机
    if (checkHazardOverlap(rp)) {
      applyEffect(rp, { kind: 'KillRequest' }, {
        onShieldBlock: () => {
          spawnParticles(FX.shieldBreak, rp.x, rp.y);
          netBus.emit({ type: 'fx:shieldbreak', x: rp.x, y: rp.y, playerId: id });
        },
      });
    }

    // 远程玩家死亡：房主判定权威 → 本地播放 + 广播给客机
    if (!wasDead && rp.dead) {
      spawnParticles(FX.death, rp.x, rp.y);
      netBus.emit({ type: 'fx:death', x: rp.x, y: rp.y, playerId: id });
    }

    // 远程玩家收集光球检测（共享光球，任何人收集即计数）
    if (updateCollectSystem(rp.x, rp.y)) signals.collected = true;
    // 远程玩家检查点交互（记录该玩家个人复活点）
    // 客机通过 InputKeys.interact 上报 E 键；房主检测"按下沿"（本帧按下、上帧未按）
    const interactNow = input?.interact ?? false;
    const interactPrev = remoteInteractPrev.get(id) ?? false;
    remoteInteractPrev.set(id, interactNow);
    const cp = interactNow && !interactPrev
      ? updateRespawnPointSystem(rp.x, rp.y, true)
      : updateRespawnPointSystem(rp.x, rp.y, false);
    if (cp) {
      rp.cpX = cp.x;
      rp.cpY = cp.y;
      signals.checkpointHit = true;
    }
    // 远程玩家双跳票收集（背包被动道具）
    if (updateItemPickupSystem(rp.x, rp.y, 'jumpBoost')) {
      addItem(rp.backpack, 'doubleJump');
      ITEMS['doubleJump'].onPickup?.(rp);
      signals.jumpBoostPicked = true;
    }
    // 远程玩家钩锁道具收集（背包主动道具）
    if (updateItemPickupSystem(rp.x, rp.y, 'hook')) {
      addItem(rp.backpack, 'hook');
      ITEMS['hook'].onPickup?.(rp);
      signals.hookPicked = true;
    }
    // 远程玩家护盾道具收集（背包被动道具 · 限时 buff）
    if (updateItemPickupSystem(rp.x, rp.y, 'shield')) {
      if (rp.shieldsMax === 0) addItem(rp.backpack, 'shield');
      ITEMS['shield'].onPickup?.(rp);
      signals.shieldPicked = true;
    }

    // 远程玩家钩锁（客机上报鼠标瞄准 + 左键按住状态；沿 = hold && !prev）
    // S7 槽位统一派发：与本地共用 ActiveItemSystem，逻辑去重
    const hookNow = input?.hook ?? false;
    const hookPrev = remoteHookPrev.get(id) ?? false;
    remoteHookPrev.set(id, hookNow);
    stepActiveItem(rp, {
      dt,
      hookEdge: hookNow && !hookPrev,
      aim: { x: input?.aimX ?? 0, y: input?.aimY ?? 0 },
      sfx: false,
    });

    // 限时 buff 计时（护盾等）：房主是计时权威，超时移除 → 背包权威同步给客机
    const rpExpired = stepBuffTimers(rp, dt);
    for (const ex of rpExpired) {
      if (ex.source === 'shield') ITEMS['shield'].onExpire?.(rp);
    }
    reconcileShield(rp);

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
    x: pS.x, y: pS.y, vx: pS.velocity.x, vy: pS.velocity.y,
    face: pS.face, grounded: pS.grounded, dead: pS.dead,
    sprint: pS.sprint, inv: pS.inv,
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
      }

      // 步外权威矫正：立即写回组件，防下帧 hydrateFrom 覆盖
      syncToEcs(pS);
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
  drawMovers();
  drawSpringPads();
  drawCheckpoints(pulse);
  drawSpikes();
  drawLasers();
  drawOrbs();
  drawJumpBoosts();
  drawHookPickups();
  drawShieldPickups();
  drawNOVA(pulse);
  drawTrail();
  drawParticles();

  // 钩锁瞄准预览（在玩家下方，半透明线）
  drawHookAim(pS);

  // 绘制所有玩家（本地 + 远程）
  drawPlayer(pS, getSelectedCharacter());
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
    // 触发系统：事件总线 → 条件 → 投递请求（扩展占位；无注册触发时零成本）
    fireTriggers(event.type, playerController.getState(), event);
    switch (event.type) {
      case 'died': {
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
      case 'jumped':
        sfx.jump();
        break;
      case 'springed': {
        const sps = playerController.getState();
        sfx.spring();
        spawnParticles(FX.dust, sps.x, sps.y - sps.half, 8);
        spawnParticles(FX.springBurst, sps.x, sps.y - sps.half); // 美术升级 6：弹簧弹射火花
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
      case 'doubleJumped': {
        const dj = playerController.getState();
        spawnParticles(FX.doubleJump, dj.x, dj.y - dj.half, 8);
        break;
      }
    }
  };
}

/* ==================== 输入回调 ==================== */

/** 按键逻辑（由 core/input 的 keydown 回调调用） */
export function handleKeyDown(e: KeyboardEvent): void {
  // 准备流程（含两个选择子页）：ESC 逐级返回，Enter/Space 单机开始
  if (gs.screen === 'prepare') {
    if (prepare.mode === 'maps' || prepare.mode === 'chars') {
      if (e.code === 'Escape') prepare.mode = 'prepare';
      return;
    }
    if (e.code === 'Escape') {
      gs.screen = 'menu';
    } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') {
      startGame();
    }
    return;
  }

  // 菜单中：Enter / Space 进入准备界面（选图/选人）
  if (gs.screen === 'menu') {
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') {
      gs.screen = 'prepare';
      prepare.mode = 'prepare';
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
    syncToEcs(playerController.getState()); // 帧间写点：立即写回组件，防下帧 hydrate 覆盖
  }

  if (e.code === 'KeyR') {
    playerController.respawn();
    syncToEcs(playerController.getState());
  }

  // 数字键 1-5：选中背包槽位（主动道具装备栏）
  if (e.code >= 'Digit1' && e.code <= 'Digit5') {
    const slot = parseInt(e.code[5]) - 1; // 'Digit1' → 0
    playerController.getState().selectedSlot = slot;
    syncToEcs(playerController.getState());
    gs.toast = '装备栏 ' + (slot + 1);
    gs.toastT = 1.2;
  }

  // E 键：检查点交互（按 E 激活附近的可交互检查点）
  if (e.code === 'KeyE') tryInteractCheckpoint();

  if (e.code === 'KeyP') {
    const cur = getMode();
    const next = cur === 'tuned' ? 'classic' : 'tuned';
    const old = PHYS[cur], nw = PHYS[next];
    playerController.getState().velocity.y *= nw.JV / old.JV;
    syncToEcs(playerController.getState());
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