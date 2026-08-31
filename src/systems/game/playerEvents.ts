/**
 * 玩家事件订阅 —— wirePlayerEvents（问题 4：PlayerController 经 netBus 统一派发）。
 * 从原 game/index.ts 上帝模块拆出。
 */
import { netBus } from '../../core/netBus';
import { playerController } from '../player';
import { gs } from './gameState';
import { spawnParticles } from '../particles';
import { FX } from '../../Prefabs/Fx';
import { VIS } from '../../config';
import { sfx } from '../../core/audio';
import { panOfX } from '../../core/camera';
import { room } from '../../net/room';

let _playerEventsWired = false;

/** 订阅玩家事件（问题 4）：PlayerController 经 netBus 统一派发；fireTriggers 逻辑由 TriggerSystem 订阅 */
export function wirePlayerEvents(): void {
  if (_playerEventsWired) return;
  _playerEventsWired = true;
  netBus.on('player:*', (event) => {
    switch (event.type) {
      case 'player:died': {
        const dp = playerController.getState();
        gs.deaths = event.deaths;
        gs.shake = 1;
        gs.flash = 0.6;
        spawnParticles(FX.death, dp.x, dp.y);
        spawnParticles(FX.deathShock, dp.x, dp.y); // 冲击波：配合命中停顿强化爆开感
        gs.hitstop = VIS.screen.hitstopMax;
        netBus.emit({ type: 'fx:death', x: dp.x, y: dp.y, playerId: room.playerId });
        sfx.die({ pan: panOfX(dp.x) });
        netBus.emit({ type: 'game:death', deaths: event.deaths });
        break;
      }
      case 'player:jumped': {
        const jp = playerController.getState();
        sfx.jump({ pan: panOfX(jp.x) });
        break;
      }
      case 'player:springed': {
        const sps = playerController.getState();
        sfx.spring({ pan: panOfX(sps.x) });
        spawnParticles(FX.dust, sps.x, sps.y - sps.half, 8);
        spawnParticles(FX.springBurst, sps.x, sps.y - sps.half); // 美术升级 6：弹簧弹射火花
        gs.shake = Math.max(gs.shake, 0.25);
        gs.hitstop = Math.max(gs.hitstop, VIS.screen.hitstopMax * 0.4);
        break;
      }
      case 'player:dashed': {
        const dsp = playerController.getState();
        sfx.dash({ pan: panOfX(dsp.x) });
        spawnParticles(FX.dashStreak, dsp.x, dsp.y); // 冲刺拖尾火花
        break;
      }
      case 'player:landed':
        if (event.impact > 7.5) {
          const s = playerController.getState();
          spawnParticles(FX.dust, s.x, s.y - s.half, 6);
          sfx.land(event.impact * 0.02, { pan: panOfX(s.x) });
        }
        break;
      case 'player:respawned': {
        // 复活：上行短琶音（回归感）；trail 清理在 controller 内部
        const rp = playerController.getState();
        sfx.respawn({ pan: panOfX(rp.x) });
        break;
      }
      case 'player:doubleJumped': {
        const dj = playerController.getState();
        spawnParticles(FX.doubleJump, dj.x, dj.y - dj.half, 8);
        sfx.doubleJump({ pan: panOfX(dj.x) });
        break;
      }
    }
  });
}