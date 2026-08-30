/**
 * 玩家动词层 —— 玩家核心允许被修改的通用操作（只写 PlayerState 通用字段）。
 *
 * 影响来源不得直接调用本层；必须经 applyEffect 结算入口投递请求后，
 * 由本层按结算结果写入玩家状态。本层只认识"通用动词"，不认识任何具体道具/机制。
 *
 * Modifier 管道：影响来源投递 ApplyModifier 请求 → applyModifier 幂等落表 →
 * recomputeStats 重算派生属性（extraJumpsMax 等）。新增"改数值的道具"=
 * 注册表条目投递 modifier，玩家核心零改动。
 */
import type { PlayerState, StatId, StatModifier } from '../../types';

/** 追加一个外力到 impulse 队列（弹簧/击退/气流共用） */
export function grantImpulse(
  p: PlayerState,
  ax: number,
  ay: number,
  dur: number,
  instant = false,
): void {
  if (instant) {
    // 瞬间冲量：水平弹簧需克服水平阻尼，直接给足速度
    p.velocity.x += ax;
    p.velocity.y += ay;
  }
  p.impulses.push({ ax, ay, t: dur });
}

/**
 * 消费 impulse 队列（自由物理步内调用，位置与原 springT 块一致）。
 * 施加加速度并递减剩余时长；时长耗尽移除。
 */
export function consumeImpulses(p: PlayerState, dt: number): void {
  const list = p.impulses;
  for (let i = list.length - 1; i >= 0; i--) {
    const imp = list[i];
    p.velocity.x += imp.ax * dt;
    p.velocity.y += imp.ay * dt;
    imp.t -= dt;
    if (imp.t <= 0) list.splice(i, 1);
  }
}

/** 仅递减 impulse 计时、不施力（约束态：轨道/滑索内，与原 springT 衰减语义一致） */
export function decayImpulses(p: PlayerState, dt: number): void {
  const list = p.impulses;
  for (let i = list.length - 1; i >= 0; i--) {
    list[i].t -= dt;
    if (list[i].t <= 0) list.splice(i, 1);
  }
}

/** 授予空中跳充能（双跳票） */
export function grantJumpCharges(p: PlayerState, max: number): void {
  p.extraJumpsMax = max;
  p.extraJumps = max;
}

/** 授予无敌时间（护盾格挡/复活通用；衰减已由物理层处理，此处只写字段） */
export function grantInv(p: PlayerState, seconds: number): void {
  p.inv = Math.max(p.inv, seconds);
}

/**
 * 应用/替换一个数值修正（同 stat+source 幂等替换），然后重算派生属性。
 * @param mod 修正条目（如双跳票 → { stat:'jumpCharges', op:'set', value:1, source:'doubleJump' }）
 */
export function applyModifier(p: PlayerState, mod: StatModifier): void {
  const i = p.modifiers.findIndex(m => m.stat === mod.stat && m.source === mod.source);
  if (i >= 0) p.modifiers.splice(i, 1);
  // 限时 buff：未显式提供剩余时长时按有效时长起步（同键替换 = 重置计时）
  if (mod.dur !== undefined && mod.t === undefined) mod.t = mod.dur;
  p.modifiers.push(mod);
  recomputeStats(p);
}

/** 移除某个来源的修正，然后重算（道具移除/机制结束用） */
export function removeModifier(p: PlayerState, stat: StatId, source: string): void {
  const before = p.modifiers.length;
  p.modifiers = p.modifiers.filter(m => !(m.stat === stat && m.source === source));
  if (p.modifiers.length !== before) recomputeStats(p);
}

/**
 * 重算玩家派生属性（extraJumpsMax / shieldsMax / speedMult）。
 * 规则：同一 stat 的 set 修正取最大值；add 修正累加。
 * 语义与旧 grantJumpCharges 一致：上限增加时补充可用次数（拾取即用），上限减少时钳制。
 */
export function recomputeStats(p: PlayerState): void {
  // ── jumpCharges → extraJumpsMax ──
  let jumps = 0;
  for (const m of p.modifiers) {
    if (m.stat !== 'jumpCharges') continue;
    jumps = m.op === 'set' ? Math.max(jumps, m.value) : jumps + m.value;
  }
  const oldMax = p.extraJumpsMax;
  if (jumps > oldMax) {
    // 上限提升 → 补充差额可用次数（双跳票拾取立即生效）
    p.extraJumps += jumps - oldMax;
  }
  p.extraJumpsMax = jumps;
  if (p.extraJumps > p.extraJumpsMax) p.extraJumps = p.extraJumpsMax;

  // ── shields → shieldsMax（护盾格挡次数；set 取最大，add 累加）──
  let shields = 0;
  for (const m of p.modifiers) {
    if (m.stat !== 'shields') continue;
    shields = m.op === 'set' ? Math.max(shields, m.value) : shields + m.value;
  }
  const oldShieldsMax = p.shieldsMax;
  if (shields > oldShieldsMax) {
    // 上限提升 → 补充差额格数（护盾拾取立即生效）
    p.shields += shields - oldShieldsMax;
  }
  p.shieldsMax = shields;
  if (p.shields > p.shieldsMax) p.shields = p.shieldsMax;

  // ── moveSpeed → speedMult（水平移速倍率；set 取最大，add 累加；默认 1）──
  let speed = 1;
  for (const m of p.modifiers) {
    if (m.stat !== 'moveSpeed') continue;
    speed = m.op === 'set' ? Math.max(speed, m.value) : speed + m.value;
  }
  p.speedMult = Math.max(0, speed);
}

/**
 * 限时 buff 计时步进 —— 递减带 dur 的 modifier 剩余时长，到期移除并重算。
 * @returns 本帧到期移除的修正来源列表（调用方据此做表现：toast / 粒子等）
 */
export function stepBuffTimers(p: PlayerState, dt: number): { stat: StatId; source: string }[] {
  const expired: { stat: StatId; source: string }[] = [];
  for (const m of p.modifiers) {
    if (m.dur === undefined) continue;
    m.t = (m.t ?? m.dur) - dt;
    if (m.t <= 0) expired.push({ stat: m.stat, source: m.source });
  }
  for (const ex of expired) {
    removeModifier(p, ex.stat, ex.source);
  }
  return expired;
}

/**
 * 扣除生命值（纯扣减，不判死）。
 * 致死裁决归结算管线（effects.applyEffect）—— 与 killState 的分工同競速期的
 * 「来源只投递请求、生死裁决权在玩家侧」一致。
 * @returns 实际扣除量（已被 0 下限钳制前的请求量；供调用方做表现强度）
 */
export function damageState(p: PlayerState, amount: number): number {
  const before = p.hp;
  p.hp = Math.max(0, p.hp - amount);
  return before - p.hp;
}

/** 直接标记死亡（纯状态；deadT/计数/事件由 PlayerController 或调用方处理） */
export function killState(p: PlayerState): void {
  p.dead = true;
}
