/**
 * 碰撞事件订阅 —— 将 collisionBus 事件映射为具体游戏逻辑。
 * 在游戏初始化时调用 initCollisionHooks() 注册所有 handler。
 *
 * 处理：
 *   enter:player:hazard      → 尖刺/激光致死
 *   enter:player:pickup      → 可拾取物（按 Collectible.kind 分发：光球/二段跳票/钩锁）
 *   enter:player:respawn     → 检查点进入（可交互标记）
 *   exit:player:respawn      → 检查点离开
 *   enter:player:goal        → 终点登顶
 */
import { world } from '../../core/ecs';
import { Position } from '../../components/physics/Position';
import { Collider } from '../../components/physics/Collider';
import { Timer } from '../../components/gameplay/Timer';
import { Hazard } from '../../components/gameplay/Hazard';
import { Collectible } from '../../components/gameplay/Collectible';
import { RespawnPoint } from '../../components/gameplay/RespawnPoint';
import { queryOneByTag, TAG_PLAYER } from '../../components/gameplay/tagHelpers';
import { Goal } from '../../components/gameplay/Goal';
import { collisionBus } from '../../core/collisionBus';
import { gs } from '../game/gameState';
import { playerController } from '../player';
import { FX } from '../../Prefabs/Fx';
import { spawnParticles } from '../particles';
import { sfx } from '../../core/audio';
import { cpPoint } from '../../config';
import { netBus } from '../../core/netBus';
import { room } from '../../net/room';
import { addItem } from '../items/backpack';
import { activateCheckpoint } from './RespawnPointSystem';
import { orbCount } from './ItemPickupSystem';

/** 是否已初始化 */
let _initialized = false;

/**
 * 注册所有碰撞事件处理器（幂等）。
 */
export function initCollisionHooks(): void {
  if (_initialized) return;
  _initialized = true;

  // ── 危险物（尖刺/激光）──
  // enter + stay 都订阅：stay 覆盖"激光在玩家区域内变亮"的情况
  const hazardHandler = ({ b }: { b: number }) => {
    // 激光有 Timer 组件，只在 on 时致死
    if (world.has(b, Timer)) {
      const t = world.get<Timer>(b, Timer);
      if (!t.on) return;
    }
    // 无敌帧保护
    if (playerController.getState().inv > 0 || playerController.isDead()) return;
    playerController.die();
  };
  collisionBus.on('enter:player:hazard', hazardHandler);
  collisionBus.on('stay:player:hazard', hazardHandler);

  // ── 可拾取物：通用 Collectible 组件，按 kind 分发 ──
  collisionBus.on('enter:player:pickup', ({ b, signals }) => {
    const col = world.get<Collectible>(b, Collectible);
    if (col.collected) return;

    switch (col.kind) {
      case 'orb': {
        // ── 光球收集（计数）──
        col.collected = true;
        gs.gotN++;
        const pos = world.get<Position>(b, Position);
        spawnParticles(FX.sparkle, pos.x, pos.y);
        sfx.orb();
        netBus.emit({ type: 'game:orb', count: gs.gotN, total: orbCount() });
        if (signals) signals.collected = true;
        if (gs.gotN === orbCount()) {
          gs.toast = '✦ 全部光球收集完成！';
          gs.toastT = 3;
          spawnParticles(FX.confetti, pos.x, pos.y);
          sfx.cp();
        }
        break;
      }
      case 'jumpBoost': {
        // ── 二段跳票（背包被动道具）──
        const s = playerController.getState();
        // 背包：入被动栏（满/已有则拾取不生效，实体保持未拾取可再次尝试）
        if (!addItem(s.backpack, 'doubleJump')) {
          gs.toast = '背包已满！';
          gs.toastT = 2;
          return;
        }
        col.collected = true;
        s.extraJumpsMax = 1; // 被动效果：获得一次二段跳能力
        s.extraJumps = s.extraJumpsMax;

        const pos = world.get<Position>(b, Position);
        spawnParticles(FX.sparkle, pos.x, pos.y);
        spawnParticles(FX.arrowBoost, pos.x, pos.y, 8);
        sfx.orb();
        netBus.emit({ type: 'game:jumpboost' });
        if (signals) signals.jumpBoostPicked = true;

        gs.toast = '二段跳票已装备！';
        gs.toastT = 2;
        break;
      }
      case 'hook': {
        // ── 钩锁（背包主动道具）──
        const s = playerController.getState();
        // 背包：入主动栏（满/已有则拾取不生效，实体保持未拾取可再次尝试）
        if (!addItem(s.backpack, 'hook')) {
          gs.toast = '背包已满！';
          gs.toastT = 2;
          return;
        }
        col.collected = true;
        // 主动装备：拾取后自动选中该槽位，便于立即使用
        s.selectedSlot = s.backpack.indexOf('hook');

        const pos = world.get<Position>(b, Position);
        spawnParticles(FX.sparkle, pos.x, pos.y);
        sfx.hookPickup();
        netBus.emit({ type: 'game:hookpickup' });
        if (signals) signals.hookPicked = true;

        gs.toast = '钩锁已装备！左键发射，长按锁定';
        gs.toastT = 2.5;
        break;
      }
    }
  });

  // ── 检查点：进入触发区 → 可交互（nearby），按 E 激活 ──
  collisionBus.on('enter:player:respawn', ({ b }) => {
    const rp = world.get<RespawnPoint>(b, RespawnPoint);
    if (rp.active) return;
    rp.nearby = true;
  });

  collisionBus.on('exit:player:respawn', ({ b }) => {
    const rp = world.get<RespawnPoint>(b, RespawnPoint);
    if (rp) rp.nearby = false;
  });

  // ── 终点（NOVA）──
  collisionBus.on('enter:player:goal', ({ b, signals }) => {
    const goal = world.get<Goal>(b, Goal);
    if (goal.triggered) return;

    goal.triggered = true;
    gs.win = true;
    gs.winTime = gs.gt;
    sfx.win();
    const px = playerController.getState().x;
    const py = playerController.getState().y;
    spawnParticles(FX.confetti, px, py);
    gs.shake = 0.5;
    netBus.emit({ type: 'game:win', time: gs.winTime, orbs: gs.gotN, total: orbCount(), x: px, y: py, playerId: room.playerId });
    if (signals) signals.goalReached = true;
  });
}

/**
 * 本地玩家按 E 交互：找最近的可交互检查点并激活。
 * 可在 keydown 回调中安全调用。
 */
export function tryInteractCheckpoint(): void {
  const player = queryOneByTag(TAG_PLAYER, Position, Collider);
  if (!player) return;
  const pp = world.get<Position>(player, Position);

  // 找 nearby && !active && 玩家点在碰撞体内的检查点（取最近）
  let best: number | null = null;
  let bestD = Infinity;
  for (const e of world.query(Position, Collider, RespawnPoint)) {
    const rp = world.get<RespawnPoint>(e, RespawnPoint);
    if (!rp.nearby || rp.active) continue;
    const pos = world.get<Position>(e, Position);
    const d = (pos.x - pp.x) ** 2 + (pos.y - pp.y) ** 2;
    if (d < bestD) { bestD = d; best = e as number; }
  }
  if (best === null) return;

  // 激活并设置本地复活点（cpPoint 由 activateCheckpoint 内部设置）
  if (activateCheckpoint(best)) {
    gs.toast = '◆ 检查点已激活';
    gs.toastT = 1.5;
  }
}

/** 重置碰撞事件处理器（用于重新加载时） */
export function resetCollisionHooks(): void {
  collisionBus.clear();
  _initialized = false;
}