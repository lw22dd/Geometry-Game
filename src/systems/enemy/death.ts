/**
 * 敌人死亡（S3）—— 房主判定 → 表现 + 广播。
 *
 * 由 damage 管线 onEntityKilled 回调触发（AK 命中 / 手雷爆炸击杀）。
 * 职责：死亡粒子 + 音效 + 震屏（各端本地播放）+ netBus 广播 enemy:died
 * （房主 → 客机播放死亡表现；S4 骨架：广播实现已定义，客机为接收事件木偶）。
 * 实体移除由本模块负责（调用方只把 eid 交进来）。
 */
import { hasComponent, removeEntity } from 'bitecs';
import { world, Position, EnemyBrain } from '../../core/ecs';
import { netBus } from '../../core/netBus';
import { spawnParticles } from '../particles';
import { FX } from '../../Prefabs/Fx';
import { sfx } from '../../core/audio';
import { gs } from '../game/gameState';
import { VIS } from '../../config';
import { panOfX } from '../../core/camera';

/** 击杀一个敌人（幂等：非敌人实体 / 已移除静默跳过） */
export function killEnemy(eid: number): void {
  if (!hasComponent(world, eid, EnemyBrain)) return;
  const x = Position.x[eid];
  const y = Position.y[eid];

  // 本地表现（各端播放；客机端由 enemy:died 事件触发）
  spawnParticles(FX.enemyDeath, x, y);
  sfx.enemyDie({ pan: panOfX(x) });
  gs.shake = Math.max(gs.shake, VIS.screen.shieldShake * 0.5);

  // 广播（netBridge 转发 host → 客机）
  netBus.emit({ type: 'enemy:died', x, y });

  removeEntity(world, eid);
}