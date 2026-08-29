/**
 * 碰撞事件订阅 —— 将 collisionBus 事件映射为具体游戏逻辑。
 * 在游戏初始化时调用 initCollisionHooks() 注册所有 handler。
 *
 * 处理：
 *   enter:player:hazard      → 尖刺/激光致死
 *   enter:player:pickup      → 可拾取物（按 tag 组件分发：Orb / JumpBoost / Hook）
 *   enter:player:respawn     → 检查点进入（可交互标记）
 *   exit:player:respawn      → 检查点离开
 *   enter:player:goal        → 终点登顶
 */
import { hasComponent } from 'bitecs';
import { world, Position, Collider, Timer, Hazard, Collectible, RespawnPoint, Goal, Orb, JumpBoost, Hook, ShieldPickup, qCheckpoints } from '../../core/ecs';
import { collisionBus } from '../../core/collisionBus';
import { gs } from '../game/gameState';
import { playerController } from '../player';
import { FX } from '../../Prefabs/Fx';
import { spawnParticles } from '../particles';
import { sfx } from '../../core/audio';
import { netBus } from '../../core/netBus';
import { room } from '../../net/room';
import { addItem, ITEMS } from '../items/backpack';
import { activateCheckpoint } from './RespawnPointSystem';
import { orbCount } from './ItemPickupSystem';
import { applyEffect } from '../effects';

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
  // 契约：地刺/激光只投递 KillRequest，由结算管线裁决（无敌帧/已死免疫），不直接 die()
  const hazardHandler = ({ b }: { b: number }) => {
    // 激光有 Timer 组件，只在 on 时致死
    if (hasComponent(world, b, Timer)) {
      if (!Timer.on[b]) return;
    }
    const ps = playerController.getState();
    applyEffect(ps, { kind: 'KillRequest' }, {
      onKill: () => {
        // 美术升级 6：激光命中火花（仅激光；尖刺保持现有死亡爆裂）
        if (hasComponent(world, b, Timer)) spawnParticles(FX.laserHit, ps.x, ps.y);
        playerController.die();
      },
      // 护盾格挡：破盾特效/音效（本地玩家；联机房主对远端破盾由 stepRemoteClients 广播）
      onShieldBlock: () => {
        spawnParticles(FX.shieldBreak, ps.x, ps.y);
        sfx.shieldBreak();
      },
    });
  };
  collisionBus.on('enter:player:hazard', hazardHandler);
  collisionBus.on('stay:player:hazard', hazardHandler);

  // ── 可拾取物：通用 Collectible 组件 + 类型 tag（Orb/JumpBoost/Hook）分发 ──
  collisionBus.on('enter:player:pickup', ({ b, signals }) => {
    if (Collectible.collected[b]) return;

    // ── 光球收集（计数）──
    if (hasComponent(world, b, Orb)) {
      Collectible.collected[b] = 1;
      gs.gotN++;
      const pos = { x: Position.x[b], y: Position.y[b] };
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
      return;
    }

    // ── 二段跳票（背包被动道具）──
    if (hasComponent(world, b, JumpBoost)) {
      const s = playerController.getState();
      // 背包：入被动栏（满/已有则拾取不生效，实体保持未拾取可再次尝试）
      if (!addItem(s.backpack, 'doubleJump')) {
        gs.toast = '背包已满！';
        gs.toastT = 2;
        return;
      }
      Collectible.collected[b] = 1;
      // 被动效果经道具 onPickup → 契约层（GrantJumpCharges），不直写 extraJumpsMax
      ITEMS['doubleJump'].onPickup?.(s);

      const pos = { x: Position.x[b], y: Position.y[b] };
      spawnParticles(FX.sparkle, pos.x, pos.y);
      spawnParticles(FX.arrowBoost, pos.x, pos.y, 8);
      sfx.orb();
      netBus.emit({ type: 'game:jumpboost' });
      if (signals) signals.jumpBoostPicked = true;

      gs.toast = '二段跳票已装备！';
      gs.toastT = 2;
      return;
    }

    // ── 钩锁（背包主动道具）──
    if (hasComponent(world, b, Hook)) {
      const s = playerController.getState();
      // 背包：入主动栏（满/已有则拾取不生效，实体保持未拾取可再次尝试）
      if (!addItem(s.backpack, 'hook')) {
        gs.toast = '背包已满！';
        gs.toastT = 2;
        return;
      }
      Collectible.collected[b] = 1;
      // 主动装备：拾取后自动选中该槽位（道具 onPickup 负责），便于立即使用
      ITEMS['hook'].onPickup?.(s);

      const pos = { x: Position.x[b], y: Position.y[b] };
      spawnParticles(FX.sparkle, pos.x, pos.y);
      sfx.hookPickup();
      netBus.emit({ type: 'game:hookpickup' });
      if (signals) signals.hookPicked = true;

      gs.toast = '钩锁已装备！左键发射，长按锁定';
      gs.toastT = 2.5;
      return;
    }

    // ── 护盾（背包被动道具 · 限时 buff）──
    if (hasComponent(world, b, ShieldPickup)) {
      const s = playerController.getState();
      // 未激活时才占背包格（已有盾 = 拾取只刷新计时，不重复占格）
      if (s.shieldsMax === 0 && !addItem(s.backpack, 'shield')) {
        gs.toast = '背包已满！';
        gs.toastT = 2;
        return;
      }
      Collectible.collected[b] = 1;
      // 被动效果经道具 onPickup → 契约层（ApplyModifier shields 限时 buff），不直写 shieldsMax
      ITEMS['shield'].onPickup?.(s);

      const pos = { x: Position.x[b], y: Position.y[b] };
      spawnParticles(FX.sparkle, pos.x, pos.y);
      sfx.shieldPickup();
      netBus.emit({ type: 'game:shieldpickup' });
      if (signals) signals.shieldPicked = true;

      gs.toast = '护盾已装备！危险物命中将格挡一次';
      gs.toastT = 2.5;
      return;
    }
  });

  // ── 检查点：进入触发区 → 可交互（nearby），按 E 激活 ──
  collisionBus.on('enter:player:respawn', ({ b }) => {
    if (RespawnPoint.active[b]) return;
    RespawnPoint.nearby[b] = 1;
  });

  collisionBus.on('exit:player:respawn', ({ b }) => {
    if (hasComponent(world, b, RespawnPoint)) RespawnPoint.nearby[b] = 0;
  });

  // ── 终点（NOVA）──
  collisionBus.on('enter:player:goal', ({ b, signals }) => {
    if (Goal.triggered[b]) return;

    Goal.triggered[b] = 1;
    gs.win = true;
    gs.winTime = gs.gt;
    sfx.win();
    const px = playerController.getState().x;
    const py = playerController.getState().y;
    spawnParticles(FX.confetti, px, py);
    spawnParticles(FX.novaPulse, px, py); // 美术升级 6：NOVA 通关金色脉冲
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
  const pp = playerController.getState();

  // 找 nearby && !active && 玩家点在碰撞体内的检查点（取最近）
  let best: number | null = null;
  let bestD = Infinity;
  for (const e of qCheckpoints()) {
    if (!RespawnPoint.nearby[e] || RespawnPoint.active[e]) continue;
    const d = (Position.x[e] - pp.x) ** 2 + (Position.y[e] - pp.y) ** 2;
    if (d < bestD) { bestD = d; best = e; }
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
