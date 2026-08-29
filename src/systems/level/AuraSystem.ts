/**
 * 光环系统（扩展占位）—— 范围持续场：按进出 / 周期向范围内玩家投递请求。
 *
 * 契约对齐：效果一律经 applyEffect 结算投递（PlayerRequest），光环本身不写玩家状态。
 * 配置驱动："之后每个光环只是配置" —— 用 setAuraFx 注册 onEnter/onExit/onTick 三个
 * 请求即可，任何新光环（毒雾/治愈/减速/弹跳场）都不需要改本系统。
 * 战斗扩展：毒雾 DPS / 治愈回血 = onTick 换成 DamageRequest / HealRequest（扩 union），
 * 本系统零改动。
 */
import { Position, Aura, qAuras } from '../../core/ecs';
import { applyEffect, type PlayerRequest } from '../effects';
import type { PlayerState } from '../../types';

/** 光环效果配置：进/出/周期各自投递的请求 */
export interface AuraFxDef {
  onEnter?: PlayerRequest;
  onExit?: PlayerRequest;
  onTick?: PlayerRequest;
}

/** 光环效果配置（key = 光环实体 eid；由关卡/工厂注册） */
const auraFx = new Map<number, AuraFxDef>();

/** 进出状态（key = `${playerId}:${eid}`；上一帧是否在范围内 → 触发 enter/exit） */
const inside = new Map<string, boolean>();

/** 周期累计计时（key = `${playerId}:${eid}`） */
const tickLeft = new Map<string, number>();

/** 注册光环效果配置（创建光环实体后调用） */
export function setAuraFx(eid: number, def: AuraFxDef): void {
  auraFx.set(eid, def);
}

/** 清除全部光环注册/进出/计时（切图重建用，由 applyLevel 调用） */
export function resetAuraState(): void {
  auraFx.clear();
  inside.clear();
  tickLeft.clear();
}

/** 玩家坐标是否在光环半径内（圆心 = Position，无视高度） */
function inAura(eid: number, p: PlayerState): boolean {
  const dx = p.x - Position.x[eid];
  const dy = p.y - Position.y[eid];
  const r = Aura.radius[eid];
  return dx * dx + dy * dy <= r * r;
}

/**
 * 光环系统步进 —— 对每个光环 × 每个玩家做进出检测与周期结算。
 * @param dt 帧时间（秒）
 * @param players 受光环影响的玩家（本地 + 远端；key 用 playerId 区分）
 */
export function stepAuraSystem(dt: number, players: { id: number; state: PlayerState }[]): void {
  for (const e of qAuras()) {
    const def = auraFx.get(e);
    if (!def) continue;
    const tickPeriod = Aura.tick[e];
    for (const pl of players) {
      if (pl.state.dead) continue;
      const key = `${pl.id}:${e}`;
      const wasIn = inside.get(key) ?? false;
      const isIn = inAura(e, pl.state);
      if (isIn && !wasIn) {
        if (def.onEnter) applyEffect(pl.state, def.onEnter);
      } else if (!isIn && wasIn) {
        if (def.onExit) applyEffect(pl.state, def.onExit);
      }
      inside.set(key, isIn);

      // 周期结算（在范围内且 tick > 0）
      if (isIn && tickPeriod > 0) {
        let tl = (tickLeft.get(key) ?? 0) + dt;
        while (tl >= tickPeriod) {
          tl -= tickPeriod;
          if (def.onTick) applyEffect(pl.state, def.onTick);
        }
        tickLeft.set(key, tl);
      } else {
        tickLeft.delete(key);
      }
    }
  }
}
