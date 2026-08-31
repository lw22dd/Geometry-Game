/**
 * 客机网络事件绑定 —— wireNetEvents + 权威状态应用（apply*States）。
 * 从原 game/index.ts 上帝模块拆出。
 */
import { net } from '../../net';
import { room, isHost } from '../../net/room';
import { playerController } from '../player';
import { applyNetPlayers, getSelfAuthority, registerRemote, removeRemote, resetRemotes, setClientInput } from '../player/remote';
import { unpackTrack } from '../../core/trackCodec';
import { reconcileShield, reconcileSpeed, netToItem, ITEMS } from '../items/backpack';
import { gs } from './gameState';
import { RESPAWN_INV } from '../../config/combat';
import { applyLevel } from './lifecycle';
import { lobby } from '../ui/lobby';
import { ui } from '../../core/uiComponent';
import { FX } from '../../Prefabs/Fx';
import { spawnParticles } from '../particles';
import { spawnShotTracer, spawnShotFeedback } from '../combat';
import { cipherDoneCount, orbCount } from '../interactions';
import { hasComponent } from 'bitecs';
import { world, Position, Collectible, Cipher, Chest, Orb, Loot } from '../../core/ecs';
import type { NetOrbState, NetItemState, NetCipherState, NetChestState, ItemId } from '../../types';

/** 客机 toast 提示（统一出口：net 'event' 各分支共用，不再逐个手写 gs.toast） */
function toast(text: string, t = 2): void {
  gs.toast = text;
  gs.toastT = t;
}

/* ==================== 权威状态应用（host → 客机） ==================== */

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

/**
 * 应用密码机权威状态（host → 客机）到本地 ECS + 世界统计。
 * 状态转变检测：某台密码机由未完成→完成时本地播放完成特效（客机侧表现）。
 */
function applyCipherStates(ciphers: NetCipherState[]): void {
  for (const cs of ciphers) {
    const e = cs.entityId;
    if (!hasComponent(world, e, Cipher)) continue;
    // 完成边沿：host 权威标记 done 而本地未完成 → 补特效（本地预测已完成时此处应已一致）
    const wasDone = Cipher.done[e] === 1;
    if (!wasDone && cs.done) {
      const px = Position.x[e], py = Position.y[e];
      spawnParticles(FX.cipherDone, px, py + 1.4);
    }
    Cipher.progress[e] = cs.progress;
    Cipher.done[e] = cs.done ? 1 : 0;
  }
  // 完成数不在此维护：由 cipherDoneCount() 派生（扫描 ECS Cipher.done），
  // 客机与 host 共用同一数据源，避免权威态/计数双写不一致。
}

/** 应用宝箱权威状态（host → 客机）到本地 ECS（状态机 state/timer 以 host 为准） */
function applyChestStates(chests: NetChestState[]): void {
  for (const cs of chests) {
    const e = cs.entityId;
    if (!hasComponent(world, e, Chest)) continue;
    Chest.type[e] = cs.type;
    Chest.state[e] = cs.state;
    Chest.timer[e] = cs.timer;
  }
}

/* ==================== 网络事件绑定（首次导入后由 startLoop 接线） ==================== */

// 注册网络事件处理器（首次导入时执行）
let _netWired = false;
export function wireNetEvents(): void {
  if (_netWired) return;
  _netWired = true;

  net.on('state', (seq, players, orbs, items, ciphers, chests, gt, gotN, deaths, win) => {
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
          playerController.applyDeathAuthority(false, selfPs.x, selfPs.y, RESPAWN_INV);
        }
        // 生命值权威同步（房主是伤害与复活的唯一权威，客机预测被覆盖）
        if (selfPs.hp !== undefined) pS.hp = selfPs.hp;
        // 武器/弹药权威同步（S2：房主是弹匣消耗/换弹权威，客机跟随）
        if (selfPs.weapon !== undefined) pS.weapon = selfPs.weapon;
        if (selfPs.ammo !== undefined) pS.ammo = selfPs.ammo;
        if (selfPs.hasGrenade !== undefined) pS.hasGrenade = selfPs.hasGrenade;
        if (selfPs.reloadT !== undefined) pS.reloadT = selfPs.reloadT;
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
    // 更新密码机状态（破译进度 + 完成标记）
    applyCipherStates(ciphers ?? []);
    // 更新宝箱状态（状态机 state/timer，权威为准）
    applyChestStates(chests ?? []);
  });

  net.on('event', (kind, data) => {
    if (room.role !== 'client') return;
    // 客机只处理事件，不重复触发逻辑
    const d = data as any;

    // ── 道具拾取：事件名由 ITEMS 条目派生（wire 名 = 'item:' + itemId）→ 单一 handler ──
    if (kind.startsWith('item:')) {
      const itemId = kind.slice('item:'.length) as ItemId;
      const def = ITEMS[itemId];
      if (def) toast('队友拾取了' + def.name);
      return;
    }

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
          ui.show(null); // 同 startGame：走唯一写入口，保持 UIManager 与真源同步
          gs.started = true;
        }
        break;
      }
      case 'orb':
        toast('光球 ' + d.count + ' / ' + d.total);
        break;
      case 'death':
        gs.deaths = d.deaths;
        toast('坠落 x' + gs.deaths);
        break;
      case 'checkpoint':
        toast('◆ 检查点', 1.5);
        break;
      // ── 密码机完成（第五人格式）：队友破译完成 → 客机补 toast + 完成特效 ──
      case 'cipher_done':
        toast('队友破译了密码机 ' + cipherDoneCount() + '/' + gs.cipherTotal, 2);
        break;
      // ── 宝箱开启：队友开启宝箱 → 客机补 toast + 开启特效 ──
      case 'chest_opened':
        if (typeof d?.x === 'number' && typeof d?.y === 'number') {
          spawnParticles(FX.chestOpen, d.x, d.y + 1.0);
          spawnParticles(FX.chestRing, d.x, d.y + 1.0);
        }
        toast('队友开启了宝箱' + (d?.chestType === 0 ? '！' : '！'), 2);
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
      // ── 敌人死亡（S3）：房主判定广播，客机播放死亡表现（木偶）──
      case 'enemy_died':
        if (typeof d.x === 'number' && typeof d.y === 'number') {
          spawnParticles(FX.enemyDeath, d.x, d.y);
        }
        break;
      // ── 开火反馈：房主广播（房主是开火模拟权威），客机补播曳光/火光/音效 ──
      case 'fx_shot':
        spawnShotTracer(d.mx, d.my, d.hitX, d.hitY);
        spawnShotFeedback(d.mx, d.my, d.hitX, d.hitY, !!d.hit);
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