/**
 * 契约层 —— 影响来源与玩家核心之间的唯一接口。
 *
 * 核心原则：任何影响来源（地刺/激光/弹簧/道具/收集物/终点/区域）不得直接读写玩家状态，
 * 更不得直接调用 player.die()。它只能向玩家投递一个"请求"（PlayerRequest），
 * 由本模块的结算管线（settlement）判断是否生效、如何生效 ——
 * 生死裁决权在玩家侧，不在来源侧。
 *
 * 例：地刺碰到玩家 → 只投递 KillRequest（"玩家碰到了危险物"），
 *    结算管线检查 无敌帧/已死 后决定是否真正致死。
 */
import type { PlayerState, StatModifier, Vector2 } from '../../types';
import { HIT_INV, HIT_IMPULSE_DUR } from '../../config/combat';
import { grantImpulse, grantJumpCharges, grantInv, killState, damageState, applyModifier, removeModifier } from './verbs';

/** 影响来源投递的契约请求（竞速子集；战斗扩展位注释标注） */
export type PlayerRequest =
  /** 请求致死（地刺/激光）。结算：无敌帧/已死免疫 */
  | { kind: 'KillRequest' }
  /** 请求外力（弹簧/击退/气流）：进 impulse 队列由运动系统消费 */
  | { kind: 'Impulse'; ax: number; ay: number; dur: number; instant?: boolean }
  /** 请求授予空中跳充能（双跳票快捷方式） */
  | { kind: 'GrantJumpCharges'; max: number }
  /** 请求应用数值修正（Modifier 管道：新道具改数值 = 投递此请求，玩家核心零改动） */
  | { kind: 'ApplyModifier'; mod: StatModifier }
  /**
   * 请求造成伤害（战斗）。结算：无敌帧 → 护盾格挡 → 扣血 → 归零致死。
   * knockback 为可选击退（转通用外力队列）。
   */
  | { kind: 'DamageRequest'; amount: number; source?: string; knockback?: Vector2 }
  // 战斗扩展位（启用时在此扩 union + 结算分支）：
  //   | { kind: 'TeleportRequest'; x: number; y: number }
  //   | { kind: 'EmitRequest'; name: string; data?: unknown }  // 纯表现钩子
  ;

/** 结算上下文 */
export interface EffectContext {
  /**
   * 致死应用回调：本地 = PlayerController.die()（含 deadT/计数/事件）；
   * 远程玩家（host 模拟）缺省 → killState（直接置死，与现状一致）。
   */
  onKill?: () => void;
  /**
   * 格挡应用回调：护盾被消耗格挡伤害后触发（本地 = 破盾特效/音效；
   * 远程 = 房主广播 fx，客机播放）。
   */
  onShieldBlock?: () => void;
  /**
   * 受击但未死回调（本地 = 受击粒子/音效/震屏；远程 = 房主广播 fx）。
   * 致死不走这里 —— 致死走 onKill，与競速期语义一致。
   */
  onDamaged?: () => void;
}

/** 护盾格挡后给予的短暂无敌时长（秒），防多帧连续判定 */
export const SHIELD_BLOCK_INV = 1.2;

/**
 * 结算入口 —— 影响来源唯一合法的"影响玩家"通道。
 * 来源只投递请求；本函数执行结算规则（免疫/状态检查）后经 verbs 写入玩家状态。
 */
export function applyEffect(p: PlayerState, fx: PlayerRequest, ctx?: EffectContext): void {
  switch (fx.kind) {
    case 'KillRequest': {
      // 结算：已死 / 无敌帧 → 免疫致死
      if (p.dead || p.inv > 0) return;
      // 结算：护盾格挡（次数性免疫，与无敌帧的时间性免疫互补）——
      // 消耗 1 格挡掉这次致死，并给短暂无敌防连续帧重复判定。护盾本体不写任何状态，
      // 全部由本结算管线经通用动词（removeModifier + grantInv）完成。
      if (p.shields > 0) {
        removeModifier(p, 'shields', 'shield');
        grantInv(p, SHIELD_BLOCK_INV);
        ctx?.onShieldBlock?.();
        return;
      }
      if (ctx?.onKill) ctx.onKill();
      else killState(p);
      break;
    }
    case 'DamageRequest': {
      // 结算：已死 / 无敌帧 → 免疫伤害。
      // 无敌帧是持续接触伤害（地刺走 stay 事件逐物理步触发）的节拍器 ——
      // 没有它，站在刺里会以 120Hz 扣血并在一帧内被刮死。
      if (p.dead || p.inv > 0) return;
      // 结算：护盾格挡（次数性免疫，与无敌帧的时间性免疫互补）。
      // 护盾本体不写任何状态，全部由本结算管线经通用动词完成。
      if (p.shields > 0) {
        removeModifier(p, 'shields', 'shield');
        grantInv(p, SHIELD_BLOCK_INV);
        ctx?.onShieldBlock?.();
        return;
      }
      damageState(p, fx.amount);
      // 击退：走通用外力队列（与弹簧 / 气流同通路），由运动系统消费
      if (fx.knockback) {
        grantImpulse(p, fx.knockback.x, fx.knockback.y, HIT_IMPULSE_DUR, true);
      }
      // 致死优先：归零的这次命中必须立即致死。
      // 若先 grantInv 再判死，die() 会以 inv>0 拒绝死亡 → 血量归零但永远不死
      // （无死亡特效 / 无复活，玩家卡死在 0 血）。
      if (p.hp <= 0) {
        if (ctx?.onKill) ctx.onKill();
        else killState(p);
        break;
      }
      // 非致死：受击无敌（给持续接触源一个结算节拍）+ 受击表现
      grantInv(p, HIT_INV);
      ctx?.onDamaged?.();
      break;
    }
    case 'Impulse':
      grantImpulse(p, fx.ax, fx.ay, fx.dur, fx.instant ?? false);
      break;
    case 'GrantJumpCharges':
      grantJumpCharges(p, fx.max);
      break;
    case 'ApplyModifier':
      applyModifier(p, fx.mod);
      break;
  }
}
