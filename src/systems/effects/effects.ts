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
import type { PlayerState } from '../../types';
import { grantImpulse, grantJumpCharges, killState } from './verbs';

/** 影响来源投递的契约请求（竞速子集；战斗扩展位注释标注） */
export type PlayerRequest =
  /** 请求致死（地刺/激光）。结算：无敌帧/已死免疫 */
  | { kind: 'KillRequest' }
  /** 请求外力（弹簧/击退/气流）：进 impulse 队列由运动系统消费 */
  | { kind: 'Impulse'; ax: number; ay: number; dur: number; instant?: boolean }
  /** 请求授予空中跳充能（双跳票） */
  | { kind: 'GrantJumpCharges'; max: number }
  // 战斗扩展位（启用时在此扩 union + 结算分支）：
  //   | { kind: 'DamageRequest'; amount: number }   // 需 HP 结算管线
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
}

/**
 * 结算入口 —— 影响来源唯一合法的"影响玩家"通道。
 * 来源只投递请求；本函数执行结算规则（免疫/状态检查）后经 verbs 写入玩家状态。
 */
export function applyEffect(p: PlayerState, fx: PlayerRequest, ctx?: EffectContext): void {
  switch (fx.kind) {
    case 'KillRequest': {
      // 结算：已死 / 无敌帧 → 免疫致死
      if (p.dead || p.inv > 0) return;
      if (ctx?.onKill) ctx.onKill();
      else killState(p);
      break;
    }
    case 'Impulse':
      grantImpulse(p, fx.ax, fx.ay, fx.dur, fx.instant ?? false);
      break;
    case 'GrantJumpCharges':
      grantJumpCharges(p, fx.max);
      break;
  }
}
