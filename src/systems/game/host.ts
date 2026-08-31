/**
 * 房主权威模拟 + 玩家交互集线。
 *
 * - stepRemoteClients：房主逐客机模拟物理与 tick（远端实体统一 stepPlayer 入口）。
 * - stepHostClients：封装「逐客机模拟 + 每 2 帧广播权威状态」的节流。
 * - broadcastHostState / collect*States：构建并广播权威世界状态（玩家/光球/道具/密码机/宝箱）。
 * - runPlayerInteractions：本地 / 远端共用的统一玩家交互步（碰撞系统 + 检查点 + 密码机 + 宝箱 + 死亡边沿）。
 * - getLocalInputKeys：提取本地键盘 / 鼠标为 InputKeys 快照。
 *
 * 从原 game/index.ts 上帝模块拆出；模块级状态（网络序号 / 节流计数 / 远端边沿表）随迁至此。
 */
import type { FrameSignals, InputKeys, NetPlayerState, NetOrbState, NetItemState, NetCipherState, NetChestState, PlayerState } from '../../types';
import { hasComponent } from 'bitecs';
import { world, Collectible, Cipher, Chest, Loot, Orb, qOrbs, qCollectibles, qCiphers, qChests } from '../../core/ecs';
import { playerController, stepPlayer, getPlayerScratch } from '../player';
import { tickPlayer } from '../player/tick';
import { remotes, getClientInput } from '../player/remote';
import { ensureRemotePlayerEntity, mirrorPlayerState } from '../player/playerEntity';
import { net } from '../../net';
import { room } from '../../net/room';
import { netBus } from '../../core/netBus';
import { gs } from './gameState';
import { packTrack } from '../../core/trackCodec';
import { itemToNet } from '../items/backpack';
import { spawnParticles } from '../particles';
import { FX } from '../../Prefabs/Fx';
import { updateCollisionSystem } from '../level';
import { updateRespawnPointSystem, updateCipherSystem, updateChestSystem, setCollisionSim } from '../interactions';
import { mouse } from '../../core/mouse';
import { keys } from '../../core/input';
import { mouseAimDir, defaultAimDir } from '../items/hook';

/* ==================== 网络状态序号 ==================== */
let _netSeq = 0;
let _stateTick = 0; // 房主状态广播计数器（每 2 帧广播一次，降低带宽）
const STATE_INTERVAL = 2;

/** 客户端尚未上报输入时的兜底：空输入（静止），绝不读本机键盘 */
const IDLE_INPUT: InputKeys = {
  left: false, right: false, jump: false, sprint: false,
  interact: false, hook: false, fire: false, altFire: false, reload: false,
  aimX: 0, aimY: 0,
};

/** 远程玩家上一帧 interact 状态（用于检测"按下沿"） */
const remoteInteractPrev = new Map<number, boolean>();

/** 远程玩家上一帧 hook 按下状态（用于检测"按下沿"） */
const remoteHookPrev = new Map<number, boolean>();

/**
 * 统一玩家交互步（本地 / 远端共用）。统一顺序：
 *   碰撞系统（危险/收集/检查点/终点/道具）→ [远端]检查点坐标交互 + 死亡边沿广播
 *   → 密码机破译 → 宝箱开启。
 *
 * @param remoteOpts 远端模拟上下文（本地=undefined）：
 *   remoteId 远端玩家 id（碰撞钩子经 sim 上下文路由到 rp + 边沿表 + 死亡广播）
 *   wasDead 步骤前 rp.dead（死亡边沿基准）
 *   onCheckpoint 远端检查点激活回调（写入 rp.cpX/cpY）
 */
export function runPlayerInteractions(
  p: PlayerState,
  sig: FrameSignals,
  interact: boolean,
  dt: number,
  remoteOpts?: { remoteId: number; wasDead: boolean; onCheckpoint: (cp: { x: number; y: number }) => void },
): void {
  const isRemote = remoteOpts !== undefined;
  // 碰撞系统：本地直接作用于本地视图；远端经 sim 上下文路由到 rp（危险/收集/道具）
  if (isRemote) setCollisionSim({ p, remoteId: remoteOpts.remoteId });
  updateCollisionSystem(p, sig as Record<string, unknown>);
  if (isRemote) setCollisionSim(null);

  if (isRemote) {
    const { remoteId, wasDead, onCheckpoint } = remoteOpts;
    // 检查点激活（远端：坐标 + interact 按下沿；碰撞仅标记附近，不激活）
    const interactNow = interact;
    const interactPrev = remoteInteractPrev.get(remoteId) ?? false;
    remoteInteractPrev.set(remoteId, interactNow);
    const cp = interactNow && !interactPrev
      ? updateRespawnPointSystem(p.x, p.y, true)
      : updateRespawnPointSystem(p.x, p.y, false);
    if (cp) {
      onCheckpoint(cp);
      sig.checkpointHit = true;
    }
    // 死亡边沿（房主判定权威）：死亡特效 + 广播给客机（物理坠落/碰撞致死均覆盖）
    if (!wasDead && p.dead) {
      spawnParticles(FX.death, p.x, p.y);
      netBus.emit({ type: 'fx:death', x: p.x, y: p.y, playerId: remoteId });
    }
  }

  // 密码机 + 宝箱：本地=false（进度/状态经 host_state 权威同步）；远端=true（host 权威模拟）
  updateCipherSystem(p.x, p.y, interact, dt, isRemote);
  updateChestSystem(p.x, p.y, interact, isRemote);
}

/** 步进所有客机玩家（房主用） */
function stepRemoteClients(dt: number): void {
  for (const [id, rp] of remotes) {
    // A 路线：远端玩家也拥有实体（混合范式消失），统一走 stepPlayer(eid) 入口
    if (rp.eid == null) rp.eid = ensureRemotePlayerEntity(rp.id);
    const input = getClientInput(id);
    // 远端选中槽位：客机上报告知（武器/主动道具"持有才可使用"判定需要）；未上报保持当前值
    if (input && input.slot !== undefined) rp.selectedSlot = input.slot;
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
        // 远端交互步：同 runPlayerInteractions，额外注入 sim 上下文（碰撞路由 rp + 检查点坐标交互 + 死亡广播）
        runPlayerInteractions(p, sig, input?.interact ?? false, dt, {
          remoteId: id,
          wasDead,
          onCheckpoint: (cp) => { rp.cpX = cp.x; rp.cpY = cp.y; },
        });
      },
      onDiedEdge: () => { /* 死亡特效/广播由 interactions 内死亡边沿统一处理 */ },
      onRespawn: () => { /* 远端复活无本地副作用 */ },
      onBuffExpired: () => { /* 远端 buff 到期无 toast */ },
      onEvent: () => { /* 远端无反馈音效/粒子 */ },
    });
  }
}

/**
 * 房主步进入口（每固定物理步调用）：逐客机模拟 + 节流广播。
 * 封装 spawnBoost 节奏不需要；纯粹封装 stepRemoteClients + _stateTick 节流。
 */
export function stepHostClients(dt: number): void {
  stepRemoteClients(dt);
  _stateTick++;
  if (_stateTick >= STATE_INTERVAL) {
    _stateTick = 0;
    broadcastHostState();
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
    hp: pS.hp,
    weapon: pS.weapon,
    ammo: pS.ammo,
    hasGrenade: pS.hasGrenade,
    reloadT: pS.reloadT,
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
      hp: rp.hp,
      weapon: rp.weapon,
      ammo: rp.ammo,
      hasGrenade: rp.hasGrenade,
      reloadT: rp.reloadT,
      hasPlat: false, platDx: 0,
      ...packTrack(rp.track),
      backpack: rp.backpack.map(itemToNet),
    });
  }

  // 光球状态 + 道具状态（jumpboost / hook collected）+ 宝箱状态（冷却/可开启）
  const orbs = collectOrbStates();
  const items = collectItemStates();
  const chests = collectChestStates();

  net.sendHostState(_netSeq, players, orbs, items, collectCipherStates(), chests, gs.gt, gs.gotN, gs.deaths, gs.win);
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
    // 宝箱掉落物：动态创建、entityId 两端不一致，不进快照（拾取效果经玩家状态同步）
    if (hasComponent(world, e, Loot)) continue;
    states.push({ entityId: e, collected: Collectible.collected[e] === 1 });
  }
  return states;
}

/** 收集密码机状态（破译进度 + 完成标记，供客机同步） */
function collectCipherStates(): NetCipherState[] {
  const states: NetCipherState[] = [];
  for (const e of qCiphers()) {
    states.push({ entityId: e, progress: Cipher.progress[e], done: Cipher.done[e] === 1 });
  }
  return states;
}

/** 收集宝箱状态（种类 + 状态机 state/timer，供客机同步显示） */
function collectChestStates(): NetChestState[] {
  const states: NetChestState[] = [];
  for (const e of qChests()) {
    states.push({ entityId: e, type: Chest.type[e], state: Chest.state[e], timer: Chest.timer[e] });
  }
  return states;
}

/** 提取本地按键为输入快照 */
export function getLocalInputKeys(): InputKeys {
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
    // S2：左右键开火。左键在「未装备钩锁」时是开火（装备钩锁时左键归钩锁，避免冲突）
    fire: mouse.down && !canHook,
    altFire: mouse.rDown,
    reload: keys.KeyR,
    hook: mouse.down && canHook,
    aimX: dir.x,
    aimY: dir.y,
    // 客机上报告知选中槽位（房主模拟远端时用"持有才可使用"判定武器/主动道具）
    slot: pState.selectedSlot,
  };
}