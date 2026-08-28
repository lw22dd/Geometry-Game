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

/**
 * 应用/替换一个数值修正（同 stat+source 幂等替换），然后重算派生属性。
 * @param mod 修正条目（如双跳票 → { stat:'jumpCharges', op:'set', value:1, source:'doubleJump' }）
 */
export function applyModifier(p: PlayerState, mod: StatModifier): void {
  const i = p.modifiers.findIndex(m => m.stat === mod.stat && m.source === mod.source);
  if (i >= 0) p.modifiers.splice(i, 1);
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
 * 重算玩家派生属性（当前仅 extraJumpsMax）。
 * 规则：同一 stat 的 set 修正取最大值；add 修正累加。
 * 语义保持旧 grantJumpCharges：上限增加时补充可用次数（拾取即用），上限减少时钳制。
 */
export function recomputeStats(p: PlayerState): void {
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
}

/** 直接标记死亡（纯状态；deadT/计数/事件由 PlayerController 或调用方处理） */
export function killState(p: PlayerState): void {
  p.dead = true;
}
