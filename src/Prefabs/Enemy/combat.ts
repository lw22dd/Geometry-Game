/**
 * 敌人 → 玩家 共享战斗结算（Prefabs/Enemy 内部工具，供各预制体专属行为复用）。
 * 统一封装 dealDamage 的 onKill / onDamaged 样板（本地致死 vs 远端置死 + 受击特效/音效/震屏），
 * 避免 creeper 自爆 / gorilla 砸地与投石各自重复同一套回调。
 */
import type { PlayerState, Vector2 } from '../../types';
import { playerController } from '../../systems/player';
import { dealDamage } from '../../systems/combat/damage';
import { spawnParticles } from '../../systems/particles';
import { FX } from '../Fx';
import { sfx } from '../../core/audio';
import { gs } from '../../systems/game/gameState';
import { VIS, DEATH_VISUAL_T } from '../../config';
import { panOfX } from '../../core/camera';

export { panOfX };

/**
 * 敌人专属攻击结算玩家（自爆/砸地/投石共用）：
 * 统一走目标侧结算管线（无敌帧/护盾/致死），并附带受击表现与致死处理。
 */
export function damagePlayerFromEnemy(
  ps: PlayerState,
  amount: number,
  source: 'creeper' | 'gorilla',
  knockback: Vector2,
): void {
  const isLocal = ps === playerController.getState();
  dealDamage(ps, { amount, source, knockback }, {
    onKill: () => {
      if (isLocal) {
        playerController.die();
      } else {
        ps.dead = true;
        ps.deadT = DEATH_VISUAL_T;
      }
    },
    onDamaged: () => {
      spawnParticles(FX.hitSpark, ps.x, ps.y);
      if (isLocal) {
        sfx.hurt({ pan: panOfX(ps.x) });
        gs.shake = Math.max(gs.shake, VIS.screen.hurtShake);
      }
    },
  });
}
