/**
 * 组合根 —— 装配 core/netBus。
 * 唯一合法的 systems↔net 交界处：netBus 事件 → NetClient。
 */
import { netBus } from './core/netBus';
import { NetClient } from './net';

/** 全局网络客户端 */
export const netClient = new NetClient();

// 装配：netBus 事件转发给 NetClient（当前为桩，暂不影响游戏）
netBus.on(e => netClient.send(e));