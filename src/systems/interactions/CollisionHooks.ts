/**
 * 碰撞事件订阅 —— 将 collisionBus 事件映射为具体游戏逻辑。
 * 在游戏初始化时调用 initCollisionHooks() 注册所有 handler。
 *
 * 处理：
 *   enter:player:hazard      → 尖刺/激光致死
 *   enter:player:collectible → 光球收集
 *   enter:player:respawn     → 检查点激活
 *   enter:player:goal        → 终点登顶
 */
import { world } from '../../core/ecs';
import { Position } from '../../components/Position';
import { Collider } from '../../components/Collider';
import { Timer } from '../../components/Timer';
import { Hazard } from '../../components/Hazard';
import { Collectible } from '../../components/Collectible';
import { JumpBoost } from '../../components/JumpBoost';
import { RespawnPoint } from '../../components/RespawnPoint';
import { Goal } from '../../components/Goal';
import { collisionBus } from '../../core/collisionBus';
import { gs } from '../game/gameState';
import { playerController } from '../player';
import { FX } from '../../Prefabs/Fx';
import { spawnParticles } from '../particles';
import { sfx } from '../../core/audio';
import { cpPoint } from '../../config';
import { netBus } from '../../core/netBus';

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

  // ── 光球收集 ──
  collisionBus.on('enter:player:collectible', ({ b, signals }) => {
    const col = world.get<Collectible>(b, Collectible);
    if (col.collected) return;

    col.collected = true;
    gs.gotN++;
    const pos = world.get<Position>(b, Position);
    spawnParticles(FX.sparkle, pos.x, pos.y);
    sfx.orb();
    netBus.emit({ type: 'game:orb', count: gs.gotN, total: world.query(Collectible).length });
    if (signals) signals.collected = true;

    if (gs.gotN === world.query(Collectible).length) {
      gs.toast = '✦ 全部光球收集完成！';
      gs.toastT = 3;
      spawnParticles(FX.confetti, pos.x, pos.y);
      sfx.cp();
    }
  });

  // ── 双跳光球 ──
  collisionBus.on('enter:player:jumpboost', ({ b, signals }) => {
    const jb = world.get<JumpBoost>(b, JumpBoost);
    if (jb.collected) return;
    jb.collected = true;

    const s = playerController.getState();
    s.extraJumpsMax = 1; // 获得一次二段跳能力
    s.extraJumps = s.extraJumpsMax;

    const pos = world.get<Position>(b, Position);
    spawnParticles(FX.sparkle, pos.x, pos.y);
    spawnParticles(FX.arrowBoost, pos.x, pos.y, 8);
    sfx.orb();
    netBus.emit({ type: 'game:jumpboost' });
    if (signals) signals.jumpBoostPicked = true;

    gs.toast = '⚡ 二段跳激活！';
    gs.toastT = 2;
  });

  // ── 检查点 ──
  collisionBus.on('enter:player:respawn', ({ b, signals }) => {
    const rp = world.get<RespawnPoint>(b, RespawnPoint);
    if (rp.active) return;

    rp.active = true;
    const pos = world.get<Position>(b, Position);
    cpPoint.x = pos.x;
    cpPoint.y = pos.y;
    spawnParticles(FX.cp, pos.x, pos.y);
    sfx.cp();
    netBus.emit({ type: 'game:checkpoint', x: pos.x, y: pos.y });
    if (signals) signals.checkpointHit = true;
  });

  // ── 终点（NOVA）──
  collisionBus.on('enter:player:goal', ({ b, signals }) => {
    const goal = world.get<Goal>(b, Goal);
    if (goal.triggered) return;

    goal.triggered = true;
    gs.win = true;
    gs.winTime = gs.gt;
    sfx.win();
    spawnParticles(FX.confetti, playerController.getState().x, playerController.getState().y);
    gs.shake = 0.5;
    netBus.emit({ type: 'game:win', time: gs.winTime, orbs: gs.gotN, total: world.query(Collectible).length });
    if (signals) signals.goalReached = true;
  });
}

/** 重置碰撞事件处理器（用于重新加载时） */
export function resetCollisionHooks(): void {
  collisionBus.clear();
  _initialized = false;
}