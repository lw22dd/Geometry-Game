/**
 * 组合根 —— 装配 core/netBus 与网络层。
 * 唯一合法的 systems↔net 交界处：netBus 事件 → 网络发送。
 * 联机装配：net 事件 → netBus（供 systems 订阅）。
 */
import { netBus } from './core/netBus';
import { net } from './net';
import { room } from './net/room';

export { net } from './net';
export { room } from './net/room';

// 装配：netBus 事件转发给网络层（单机事件 → 房主广播事件）
netBus.on(e => {
  const r = room;
  if (r.role !== 'host') return; // 只有房主广播游戏事件

  switch (e.type) {
    case 'game:orb':
      net.sendHostEvent('orb', { count: e.count, total: e.total });
      break;
    // ── 道具拾取：网络事件名由 ITEMS 条目派生（wire 名 = 'item:' + item）──
    // 加道具只写 ITEMS 一行，此处与客机 handler 均不新增分支
    case 'game:itemPicked':
      net.sendHostEvent('item:' + e.item, {});
      break;
    case 'game:death':
      net.sendHostEvent('death', { deaths: e.deaths });
      break;
    case 'game:checkpoint':
      net.sendHostEvent('checkpoint', { x: e.x, y: e.y });
      break;
    case 'game:win':
      net.sendHostEvent('win', { time: e.time, orbs: e.orbs, total: e.total, x: e.x, y: e.y, playerId: e.playerId });
      break;
    // ── 密码机完成（第五人格式）：房主权威 → 广播给客机 toast ──
    case 'game:cipherDone':
      net.sendHostEvent('cipher_done', { x: e.x, y: e.y });
      break;
    // ── 宝箱开启：房主权威 → 广播给客机（队友开启提示）──
    case 'game:chestOpened':
      net.sendHostEvent('chest_opened', { x: e.x, y: e.y, chestType: e.chestType });
      break;
    // ── 死亡特效：房主是死亡判定权威，广播给客机播放 ──
    case 'fx:death':
      net.sendHostEvent('fx_death', { x: e.x, y: e.y, playerId: e.playerId });
      break;
    // ── 护盾破碎特效：房主是格挡判定权威，广播给客机播放 ──
    case 'fx:shieldbreak':
      net.sendHostEvent('fx_shieldbreak', { x: e.x, y: e.y, playerId: e.playerId });
      break;
    // ── 开火反馈：房主是开火模拟权威，广播给客机补播（曳光/火光/音效）──
    case 'fx:shot':
      net.sendHostEvent('fx_shot', { mx: e.mx, my: e.my, hitX: e.hitX, hitY: e.hitY, hit: e.hit });
      break;
    // ── 敌人死亡（S3）：房主判定 → 广播 enemy_died → 客机播放死亡表现 ──
    case 'enemy:died':
      net.sendHostEvent('enemy_died', { x: e.x, y: e.y });
      break;
  }
});

// 网络事件 → netBus（供 systems/ui 与 systems/game 订阅）
net.on('connected', (role, playerId, players) => {
  netBus.emit({ type: 'net:connected', role, playerId });
  void players;
});

net.on('playerJoined', p => netBus.emit({ type: 'net:playerJoined', player: p }));
net.on('playerLeft', id => netBus.emit({ type: 'net:playerLeft', playerId: id }));
net.on('playerUpdated', p => netBus.emit({ type: 'net:playerUpdated', player: p }));
net.on('disconnected', reason => netBus.emit({ type: 'net:disconnected', reason }));