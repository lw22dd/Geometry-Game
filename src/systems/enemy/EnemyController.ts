/**
 * 敌人控制器（S3）—— 只做通用调度：目标选择 / 移动 / 重力 / 碰撞 / 掉头。
 * 每种敌人的专属行为（creeper 引爆、gorilla 近战/投石）由各自预制体
 * （Prefabs/Enemy/creeper.ts、gorilla.ts）的 step 自决，控制器只负责调用
 * stepEnemyBehavior 并把结果（hold = 停身）落到通用移动上。
 *
 * 每帧流水线（stepEnemy）：
 *   1. 通用 FSM：detectRange 内选最近存活玩家为 target
 *   2. 冰冻减速计时递减（通用，iceBomb 命中写入 st.slow）
 *   3. 专属行为：stepEnemyBehavior → 预制体 step（推进引爆/攻击、结算、生成实体），返回移动意向
 *   4. 模式 + 朝向：有目标 → chase 且朝玩家；失目标 → 回 patrol
 *   5. 水平移动：hold → 停身；否则按模式移速（追/巡 × 冰冻减速）推进 + walkT 动画相位
 *   6. 碰墙掉头 / 巡逻边界（仅非 hold，避免干扰结算位置）
 *   7. 重力 + 垂直碰撞（始终；引爆/攻击中同样保持贴地）
 *   8. 悬崖掉头（巡逻且在地面且前方无支撑）
 *
 * 状态真源在 EnemyBrain[eid].state（AoS，判别联合 EnemyState）；位置/生命/无敌走 SoA。
 * 接触伤害：敌人 → 玩家走 collisionBus（CollisionHooks enemy 分支）。
 * 死亡：房主判定 → netBus 广播 enemy:died → 各端粒子 / hitstop。
 */
import { addEntity, addComponent } from 'bitecs';
import type { PlayerState, EnemyKind } from '../../types';
import { world, Position, Velocity, Collider, Health, EnemyBrain, Team, qEnemies } from '../../core/ecs';
import {
  getEnemyKind, createEnemyState, stepEnemyBehavior, stepGorillaRocks, clearGorillaRocks,
} from '../../Prefabs/Enemy';
import type { EnemyState } from '../../Prefabs/Enemy';
import { getSolids } from '../player';
import { colliderWorldRect, aabbOverlap } from '../level';

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
  Collider.h[e] = def.height ?? def.half * 2;
  Collider.ox[e] = 0;
  Collider.oy[e] = 0;
  Collider.solid[e] = 0; // 触发型：不参与玩家物理推挤
  Health.hp[e] = def.hp;
  Health.max[e] = def.hp;
  Health.inv[e] = 0;

  // AoS 大脑：初始状态由种类预制体自决（判别联合 EnemyState）
  const state = createEnemyState(kind, x, Math.random() < 0.5 ? -1 : 1);
  EnemyBrain[e] = { kind, state };
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

/** 敌人底面 Y（worldRect 的 y = 底边） */
function enemyFootY(e: number): number {
  return colliderWorldRect(e).y;
}

/** 敌人前面（朝向 dir 侧）是否仍有地面支撑（悬崖检测：前方一小段内无固体顶面） */
function groundAhead(e: number, dir: 1 | -1): boolean {
  const r = colliderWorldRect(e);
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

/** 步进单个敌人：通用调度 + 轻量物理（重力 + 地面）；专属行为委托给预制体 */
function stepEnemy(e: number, dt: number, players: { state: PlayerState }[]): void {
  const brain = EnemyBrain[e];
  if (!brain) return;
  const kind = brain.kind as EnemyKind;
  const def = getEnemyKind(kind);
  const st = brain.state as EnemyState;

  /* ── 1. 通用 FSM：选择目标玩家（警戒 / 追击）── */
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

  /* ── 2. 冰冻减速计时递减（通用；冰冻炸弹命中写入 st.slow）── */
  if (st.slow && st.slow.t > 0) st.slow.t = Math.max(0, st.slow.t - dt);

  /* ── 3. 专属行为：预制体自决（推进引爆/攻击、结算伤害、生成实体），返回移动意向 ── */
  const res = stepEnemyBehavior(kind, { e, dt, target, dist2: bestD2, players }, st, def);

  /* ── 4. 模式 + 朝向（通用）── */
  if (target) {
    st.mode = 'chase';
    const dx = target.x - Position.x[e];
    if (Math.abs(dx) > 0.3) st.dir = dx > 0 ? 1 : -1;
  } else if (st.mode === 'chase') {
    st.mode = 'patrol';
  }

  /* ── 5. 水平移动（行为锁定 → 停身；冰冻减速按 slow.f 降速）── */
  if (res.hold) {
    Velocity.x[e] = 0;
  } else {
    const base = st.mode === 'chase' ? def.chaseSpeed : def.speed;
    const slowF = st.slow && st.slow.t > 0 ? st.slow.f : 1;
    const speed = base * slowF;
    Velocity.x[e] = st.dir * speed;
    Position.x[e] += Velocity.x[e] * dt;
    st.walkT += Math.abs(Velocity.x[e]) * dt * 6; // 动画相位随移动推进
  }

  /* ── 6. 撞墙掉头 + 巡逻边界（非锁定期间；越过顶面不算墙）── */
  if (!res.hold) {
    const r = colliderWorldRect(e);
    for (const s of getSolids()) {
      if (!aabbOverlap(r, s)) continue;
      if (Position.y[e] - Collider.h[e] / 2 >= s.top - 0.02) continue; // 站在上面，不算墙
      // 撞墙：推回 + 掉头
      if (st.dir > 0) Position.x[e] = s.x - Collider.w[e] / 2;
      else Position.x[e] = s.x + s.w + Collider.w[e] / 2;
      st.dir = st.dir > 0 ? -1 : 1;
      break;
    }
    if (st.mode === 'patrol') {
      if (Position.x[e] < st.homeX - def.patrolRange) st.dir = 1;
      else if (Position.x[e] > st.homeX + def.patrolRange) st.dir = -1;
    }
  }

  /* ── 7. 重力 + 垂直碰撞（始终；引爆/攻击锁定中也保持贴地）── */
  st.grounded = false;
  Velocity.y[e] -= 22 * dt;
  Position.y[e] += Velocity.y[e] * dt;
  const r2 = colliderWorldRect(e);
  for (const s of getSolids()) {
    if (!aabbOverlap(r2, s)) continue;
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
  // ── 8. 悬崖掉头：巡逻且在地面上且前方无支撑 → 转向 ──
  if (st.grounded && st.mode === 'patrol' && !groundAhead(e, st.dir)) {
    st.dir = st.dir > 0 ? -1 : 1;
  }
}

/* ==================== 石头转发（gorilla 投石专属弹道，身体在预制体自管） ==================== */

/** 步进全部敌人石头（固定物理步调用，放在 stepEnemies 之后）—— 转发 gorilla 预制体 */
export function stepEnemyRocks(dt: number, players: { state: PlayerState }[]): void {
  stepGorillaRocks(dt, players);
}

/** 清空全部敌人石头（切图重建用，applyLevel 调用）—— 转发 gorilla 预制体 */
export function clearEnemyRocks(): void {
  clearGorillaRocks();
}