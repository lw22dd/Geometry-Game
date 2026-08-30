/**
 * 敌人控制器（S3）—— 对称 PlayerController：持有敌人状态真源（EnemyBrain AoS）+ 轻量专用物理 + 映射 ECS 实体。
 *
 * 架构对称但物理不对称（决策 3）：
 *  - 玩家用手感特化的 stepPlayerGeneric；敌人用本模块的轻量物理
 *    （重力 + 地面碰撞 + 撞墙/悬崖掉头），敌人不跳跃、不复用玩家物理引擎。
 *  - 敌人状态真源在 EnemyBrain[eid]（AoS，同 Animator 模式），
 *    不做玩家那套「SoA → scratch → 写回」搬运；仅位置/生命/无敌走 SoA（被 HUD / 子弹查询）。
 *
 * AI（行走兵 FSM）：patrol（巡逻）↔ chase（追击）。
 *  - 巡逻：围绕出生 homeX ± patrolRange 往复；撞墙 / 到巡逻边界 / 悬崖掉头。
 *  - 警戒：进入 detectRange 内最近玩家 → chase（朝玩家水平移动，不跳跃）。
 *  - 失目标：玩家超出 loseRange → 回巡逻。
 *
 * 接触伤害：敌人 → 玩家走 collisionBus（见 CollisionHooks enemy 分支）→ dealDamage。
 * 死亡：房主判定 → netBus 广播 enemy:died → 各端粒子 / hitstop。
 */
import { addEntity, addComponent } from 'bitecs';
import type { PlayerState, EnemyKind } from '../../types';
import {
  world, Position, Velocity, Collider, Health, EnemyBrain, Team, qEnemies,
} from '../../core/ecs';
import { getEnemyKind, type WalkerState } from '../../Prefabs/Enemy';
import { getSolids } from '../player';

/** 敌人生成数据（MapDefinition.entitySpawners.enemies 条目） */
export interface EnemySpawnData {
  kind: EnemyKind;
  x: number;
  y: number;
}

/* ==================== 生成 ==================== */

/**
 * 生成一个敌人实体。
 * @param kind 敌人种类（ENEMY_KINDS 键）
 * @param x 出生 X（格）
 * @param y 出生 Y（格）
 */
export function spawnEnemy(kind: EnemyKind, x: number, y: number): number {
  const def = getEnemyKind(kind);
  const e = addEntity(world);
  addComponent(world, e, Position);
  addComponent(world, e, Velocity);
  addComponent(world, e, Collider);
  addComponent(world, e, Health);
  addComponent(world, e, EnemyBrain);
  addComponent(world, e, Team);

  Position.x[e] = x;
  Position.y[e] = y;
  Velocity.x[e] = 0;
  Velocity.y[e] = 0;
  Collider.w[e] = def.half * 2;
  Collider.h[e] = def.half * 2;
  Collider.ox[e] = 0;
  Collider.oy[e] = 0;
  Collider.solid[e] = 0; // 触发型：不参与玩家物理推挤
  Health.hp[e] = def.hp;
  Health.max[e] = def.hp;
  Health.inv[e] = 0;

  // AoS 大脑：kind + 独立 AI/物理状态（状态真源）
  EnemyBrain[e] = {
    kind,
    state: {
      dir: Math.random() < 0.5 ? -1 : 1,
      homeX: x,
      mode: 'patrol',
      grounded: false,
      walkT: 0,
    } as WalkerState,
  };
  return e;
}

/* ==================== 步进 ==================== */

/**
 * 步进全部敌人（固定物理步调用；房主/单机进程模拟，客机为接收事件的木偶）。
 * @param dt 帧时间（秒）
 * @param players 所有存活玩家状态（本地 + 远端；用于警戒/追击目标选择）
 */
export function stepEnemies(dt: number, players: { state: PlayerState }[]): void {
  for (const e of qEnemies()) {
    stepEnemy(e, dt, players);
  }
}

/** 敌人 AABB（半宽碰撞箱，中心 = Position） */
function enemyRect(e: number): { x: number; y: number; top: number; w: number; h: number } {
  const half = Collider.w[e] / 2;
  const hh = Collider.h[e] / 2;
  return { x: Position.x[e] - half, y: Position.y[e] - hh, top: Position.y[e] + hh, w: half * 2, h: hh * 2 };
}

/** AABB 重叠（纯数学） */
function overlap(
  a: { x: number; y: number; top: number; w: number; h: number },
  b: { x: number; y: number; top: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.top && a.top > b.y;
}

/** 敌人前面（朝向 dir 侧）是否仍有地面支撑（悬崖检测：前方一小段内无固体顶面） */
function groundAhead(e: number, dir: 1 | -1): boolean {
  const r = enemyRect(e);
  const half = Collider.w[e] / 2;
  const probeX = Position.x[e] + dir * (half + 0.15);
  const footY = r.y; // 敌人底边 Y
  for (const s of getSolids()) {
    if (probeX >= s.x && probeX <= s.x + s.w) {
      // 地面顶面在脚底附近（落差 ≤ 0.6 视为可落脚）
      const top = s.top;
      if (top >= footY - 0.01 && top <= footY + 0.6) return true;
    }
  }
  return false;
}

/** 步进单个敌人：轻量物理（重力 + 地面）+ 行走兵 FSM */
function stepEnemy(e: number, dt: number, players: { state: PlayerState }[]): void {
  const brain = EnemyBrain[e];
  if (!brain) return;
  const def = getEnemyKind(brain.kind as EnemyKind);
  const st = brain.state as WalkerState;

  /* ── FSM：选择目标玩家（警戒/追击）── */
  let target: PlayerState | null = null;
  let bestD2 = def.detectRange * def.detectRange;
  for (const pl of players) {
    if (pl.state.dead) continue;
    const dx = pl.state.x - Position.x[e];
    const dy = pl.state.y - Position.y[e];
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      target = pl.state;
    }
  }

  const wasChase = st.mode === 'chase';
  if (target) {
    // 有目标 → 追击（朝玩家水平移动）
    st.mode = 'chase';
    const dx = target.x - Position.x[e];
    if (Math.abs(dx) > 0.3) st.dir = dx > 0 ? 1 : -1;
  } else if (wasChase) {
    // 失目标 → 回巡逻
    st.mode = 'patrol';
  }

  /* ── 水平移动 ── */
  const speed = st.mode === 'chase' ? def.chaseSpeed : def.speed;
  Velocity.x[e] = st.dir * speed;
  Position.x[e] += Velocity.x[e] * dt;
  st.walkT += Math.abs(Velocity.x[e]) * dt * 6; // 动画相位随移动推进

  // 撞墙掉头（水平碰撞；越过顶面不算墙）
  const r = enemyRect(e);
  const solids = getSolids();
  for (const s of solids) {
    if (!overlap(r, s)) continue;
    if (Position.y[e] - Collider.h[e] / 2 >= s.top - 0.02) continue; // 站在上面，不算墙
    // 撞墙：推回 + 掉头
    if (st.dir > 0) Position.x[e] = s.x - Collider.w[e] / 2;
    else Position.x[e] = s.x + s.w + Collider.w[e] / 2;
    st.dir = st.dir > 0 ? -1 : 1;
    break;
  }

  // 巡逻边界掉头
  if (st.mode === 'patrol') {
    if (Position.x[e] < st.homeX - def.patrolRange) st.dir = 1;
    else if (Position.x[e] > st.homeX + def.patrolRange) st.dir = -1;
  }

  /* ── 重力 + 垂直碰撞（始终受重力，防止站在空中边缘 / 被打下平台；敌人不跳）── */
  st.grounded = false;
  Velocity.y[e] -= 22 * dt;
  Position.y[e] += Velocity.y[e] * dt;
  const r2 = enemyRect(e);
  for (const s of solids) {
    if (!overlap(r2, s)) continue;
    if (Velocity.y[e] <= 0) {
      Position.y[e] = s.top + Collider.h[e] / 2;
      Velocity.y[e] = 0;
      st.grounded = true;
    } else {
      Position.y[e] = s.y - Collider.h[e] / 2;
      Velocity.y[e] = 0;
    }
    break;
  }
  // 悬崖掉头：巡逻且在地面上且前方无支撑 → 转向
  if (st.grounded && st.mode === 'patrol' && !groundAhead(e, st.dir)) {
    st.dir = st.dir > 0 ? -1 : 1;
  }
}