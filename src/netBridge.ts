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
    case 'game:death':
      net.sendHostEvent('death', { deaths: e.deaths });
      break;
    case 'game:checkpoint':
      net.sendHostEvent('checkpoint', { x: e.x, y: e.y });
      break;
    case 'game:win':
      net.sendHostEvent('win', { time: e.time, orbs: e.orbs, total: e.total });
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
net.on('disconnected', reason => netBus.emit({ type: 'net:disconnected', reason }));