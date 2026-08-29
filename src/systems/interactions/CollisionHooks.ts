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
import { world, Position, Collider, Timer, Hazard, Collectible, RespawnPoint, Goal, Orb, JumpBoost, Hook, ShieldPickup, SpeedPickup, MagnetPickup, qCheckpoints } from '../../core/ecs';
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
import type { ItemId, PlayerState } from '../../types';

/* ==================== 道具拾取规则表（问题 12：四段同构拾取样板收敛） ==================== */

interface PickupRule {
  /** ECS tag 组件（判定拾取物类型） */
  tag: typeof Orb;
  /** 背包道具 id（入背包 + ITEMS 注册表索引；广播/信号/网络事件名均由 item 派生） */
  item: ItemId;
  /** 额外守卫：返回 true 才尝试占背包格（已有激活能力时拾取只刷新计时，不重复占格） */
  guard?: (s: PlayerState) => boolean;
  /** 本地专属额外粒子（通用 sparkle 之外的差异化特效） */
  fx?: (x: number, y: number) => void;
  /** 本地音效 */
  sfx?: () => void;
  /** 本地提示文案 */
  toast: string;
  toastT: number;
}

/**
 * 道具拾取规则表 —— 新增道具只需在此加一行。
 * 不重复抄写：帧信号 = signals.picked(item)，广播 = game:itemPicked{item}，
 * 网络事件名由 netBridge 派生（'item:' + item，经 ITEMS 找到名称），不再有第二份字面量。
 */
const PICKUP_RULES: PickupRule[] = [
  {
    tag: JumpBoost,
    item: 'doubleJump',
    fx: (x, y) => spawnParticles(FX.arrowBoost, x, y, 8),
    sfx: () => sfx.orb(),
    toast: '二段跳票已装备！',
    toastT: 2,
  },
  {
    tag: Hook,
    item: 'hook',
    sfx: () => sfx.hookPickup(),
    toast: '钩锁已装备！左键发射，长按锁定',
    toastT: 2.5,
  },
  {
    tag: ShieldPickup,
    item: 'shield',
    guard: (s) => s.shieldsMax === 0,
    sfx: () => sfx.shieldPickup(),
    toast: '护盾已装备！危险物命中将格挡一次',
    toastT: 2.5,
  },
  {
    tag: SpeedPickup,
    item: 'speed',
    guard: (s) => s.speedMult <= 1,
    fx: (x, y) => spawnParticles(FX.speedBoost, x, y, 6),
    sfx: () => sfx.speedPickup(),
    toast: '极速冲刺！移速 ×2',
    toastT: 2.5,
  },
  {
    tag: MagnetPickup,
    item: 'magnet',
    fx: (x, y) => spawnParticles(FX.magnetBurst, x, y),
    sfx: () => sfx.magnet(),
    toast: '磁铁已装备！自动吸引附近光球',
    toastT: 2.5,
  },
];

/** 是否已初始化 */
let _initialized = false;

/* ==================== 碰撞模拟目标（问题 2：远程玩家碰撞化路由） ==================== */

/**
 * 碰撞事件针对的目标玩家。默认作用于本地玩家（playerController 视图）；
 * 远程玩家步进时由 tick 管线注入 { p: rp, remoteId }，步进后置 null。
 */
export interface CollisionSimTarget {
  p: PlayerState;
  /** 远端玩家 id（本地=undefined） */
  remoteId?: number;
}
let simTarget: CollisionSimTarget | null = null;

/** 设置/清除碰撞模拟目标（远端玩家步进前后调用） */
export function setCollisionSim(target: CollisionSimTarget | null): void {
  simTarget = target;
}

/** 当前碰撞目标状态（远端=rp；本地=PlayerController 视图） */
function targetState(): PlayerState {
  return simTarget?.p ?? playerController.getState();
}

/** 是否处于远端模拟（副作用路由：远端不走本地 gs/sfx/toast） */
function isRemote(): boolean {
  return simTarget?.remoteId !== undefined;
}

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
    const ps = targetState();
    applyEffect(ps, { kind: 'KillRequest' }, {
      onKill: () => {
        // 美术升级 6：激光命中火花（仅激光；尖刺保持现有死亡爆裂）
        if (hasComponent(world, b, Timer)) spawnParticles(FX.laserHit, ps.x, ps.y);
        if (isRemote()) {
          // 远端死亡：房主权威直接置死（死亡特效/广播由 tick 死亡边沿处理）
          ps.dead = true;
          ps.deadT = 0.85;
        } else {
          playerController.die();
        }
      },
      // 护盾格挡：破盾特效；本地补音效，远端广播给客机
      onShieldBlock: () => {
        spawnParticles(FX.shieldBreak, ps.x, ps.y);
        if (isRemote()) {
          if (simTarget) netBus.emit({ type: 'fx:shieldbreak', x: ps.x, y: ps.y, playerId: simTarget.remoteId as number });
        } else {
          sfx.shieldBreak();
        }
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

    // ── 道具拾取（背包道具：二段跳票/钩锁/护盾/加速；问题 12：规则表驱动）──
    for (const rule of PICKUP_RULES) {
      if (!hasComponent(world, b, rule.tag)) continue;
      const s = targetState();
      // 守卫（护盾/加速：已有激活能力时拾取只刷新计时，不重复占格）+ 背包放入
      // （满/已有则拾取不生效，实体保持未拾取可再次尝试）
      if ((rule.guard ? rule.guard(s) : true) && !addItem(s.backpack, rule.item)) {
        if (!isRemote()) { gs.toast = '背包已满！'; gs.toastT = 2; }
        return;
      }
      Collectible.collected[b] = 1;
      // 效果经道具 onPickup → 契约层（GrantJumpCharges / ApplyModifier 限时 buff），不直写字段
      ITEMS[rule.item].onPickup?.(s);

      if (!isRemote()) {
        const pos = { x: Position.x[b], y: Position.y[b] };
        spawnParticles(FX.sparkle, pos.x, pos.y);
        rule.fx?.(pos.x, pos.y);
        rule.sfx?.();
        netBus.emit({ type: 'game:itemPicked', item: rule.item });
        gs.toast = rule.toast;
        gs.toastT = rule.toastT;
      }
      // 帧信号收敛字段：picked = itemId（加道具不再动 FrameSignals 联合）
      if (signals) signals.picked = rule.item;
      return;
    }
  });

  // ── 检查点：进入触发区 → 可交互（nearby），按 E 激活 ──
  // 远端玩家不标记 nearby（本地 E 交互不受远端站位影响）
  collisionBus.on('enter:player:respawn', ({ b }) => {
    if (isRemote()) return;
    if (RespawnPoint.active[b]) return;
    RespawnPoint.nearby[b] = 1;
  });

  collisionBus.on('exit:player:respawn', ({ b }) => {
    if (isRemote()) return;
    if (hasComponent(world, b, RespawnPoint)) RespawnPoint.nearby[b] = 0;
  });

  // ── 终点（NOVA）──
  // 远端玩家不触发通关（仅本地玩家登顶判定胜利）
  collisionBus.on('enter:player:goal', ({ b, signals }) => {
    if (isRemote()) return;
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
