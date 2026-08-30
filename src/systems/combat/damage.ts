/**
 * 战斗伤害统一入口 —— 武器 / 危险物 / 爆炸 / 接触伤害只认这一个函数。
 *
 * 设计要点：
 *  1. **目标多态**：`PlayerState`（走 applyEffect 契约层，享无敌帧 / 护盾 / Modifier
 *     全套结算）或实体 `eid`（走 `Health` 组件，服务敌人与可摧毁物）。
 *     调用方对「打的是谁」完全无感 —— 这是让武器代码只写一次的关键。
 *  2. **生死裁决权仍在目标侧**：本入口只投递与汇总结果，不绕过任何一方的结算规则。
 *     玩家侧的无敌帧 / 护盾判定照旧由 `applyEffect` 完成。
 *  3. **伤害权威**：联机下只有房主调用本函数；客机走乐观预测出表现，
 *     房主快照到达时被覆盖（与现有死亡权威同步同模式）。
 */
import { hasComponent } from 'bitecs';
import type { PlayerState, Vector2 } from '../../types';
import { world, Health, qHealth } from '../../core/ecs';
import { HIT_INV } from '../../config/combat';
import { applyEffect, type EffectContext } from '../effects';

/** 伤害描述（来源无关的纯数据） */
export interface DamageInfo {
  /** 伤害量 */
  amount: number;
  /** 来源标识（'spike' / 'laser' / 'ak' / 'grenade' ...；统计与表现分流用） */
  source?: string;
  /** 可选击退（转成外力队列，与弹簧 / 气流同通路） */
  knockback?: Vector2;
}

/**
 * 伤害目标：玩家状态（本地视图 / 远端 rp）或实体 eid（Health 组件持有者）。
 */
export type DamageTarget = PlayerState | number;

/** 伤害结算上下文（玩家回调见 EffectContext；实体回调见 onEntityKilled） */
export interface DamageContext extends EffectContext {
  /**
   * 实体目标被本次伤害击杀（仅 eid 目标触发）。
   * 事件广播 / 掉落 / 实体移除由调用方决定 —— 本层不擅自销毁实体。
   */
  onEntityKilled?: (eid: number) => void;
}

/** 伤害结算结果 */
export interface DamageResult {
  /** 是否实际生效（false = 被无敌帧免疫，或目标无效 / 已死） */
  applied: boolean;
  /** 本次伤害是否造成击杀 */
  killed: boolean;
  /** 目标剩余生命（未生效时为原值） */
  hpLeft: number;
}

const NO_EFFECT: DamageResult = { applied: false, killed: false, hpLeft: 0 };

/**
 * 造成伤害 —— 全项目唯一的伤害入口。
 * @param target 玩家状态或实体 eid
 */
export function dealDamage(
  target: DamageTarget,
  info: DamageInfo,
  ctx?: DamageContext,
): DamageResult {
  return typeof target === 'number'
    ? damageEntity(target, info, ctx)
    : damagePlayer(target, info, ctx);
}

/* ==================== 玩家目标 ==================== */

/**
 * 玩家侧伤害：把 DamageRequest 投进契约层，由其裁决无敌帧 / 护盾 / 致死，
 * 本函数只负责汇总结算结果（不含裁定逻辑）。
 */
function damagePlayer(
  p: PlayerState,
  info: DamageInfo,
  ctx?: DamageContext,
): DamageResult {
  const hpBefore = p.hp;
  const deadBefore = p.dead;
  let blocked = false;

  applyEffect(
    p,
    { kind: 'DamageRequest', amount: info.amount, source: info.source, knockback: info.knockback },
    {
      ...ctx,
      // 包装一层以识别"被护盾挡下"（hp 不变但伤害确实生效了）
      onShieldBlock: () => {
        blocked = true;
        ctx?.onShieldBlock?.();
      },
    },
  );

  const killed = !deadBefore && p.dead;
  return {
    applied: blocked || killed || p.hp < hpBefore,
    killed,
    hpLeft: p.hp,
  };
}

/* ==================== 实体目标（敌人 / 可摧毁物） ==================== */

/**
 * 实体侧伤害：直接结算 Health 组件。
 * 与玩家侧的语义对齐：无敌帧既免疫伤害，也为持续接触伤害提供结算节拍。
 */
function damageEntity(
  eid: number,
  info: DamageInfo,
  ctx?: DamageContext,
): DamageResult {
  if (!hasComponent(world, eid, Health)) return NO_EFFECT;

  const hp = Health.hp[eid] ?? 0;
  if (hp <= 0 || (Health.inv[eid] ?? 0) > 0) {
    return { applied: false, killed: false, hpLeft: hp };
  }

  const left = Math.max(0, hp - info.amount);
  Health.hp[eid] = left;
  Health.inv[eid] = HIT_INV;

  const killed = left <= 0;
  if (killed) ctx?.onEntityKilled?.(eid);
  return { applied: true, killed, hpLeft: left };
}

/**
 * 步进全部实体生命的无敌计时（持续接触伤害的节拍器）。
 * 由主循环在物理步内调用；玩家的 inv 衰减已由物理层处理，不在此列。
 */
export function stepHealthInv(dt: number): void {
  for (const eid of qHealth()) {
    const t = Health.inv[eid] ?? 0;
    if (t > 0) Health.inv[eid] = Math.max(0, t - dt);
  }
}
