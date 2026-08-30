/**
 * S7 主动道具槽位 —— ActiveItemSystem。
 * 主循环不再硬编码具体道具（原 stepHookPlayer 调用），改为遍历玩家选中槽位
 * 对应的道具 onActivate。本地玩家与远端玩家（host 模拟）共用同一入口，逻辑去重。
 *
 * 用法：step 中调用 stepActiveItem(p, ctx)（本地用鼠标边沿/瞄准，远端用客机上报输入）。
 */
import type { PlayerState } from '../../types';
import { ITEMS } from './backpack';
import type { ActiveItemContext } from './backpack';
import './recall'; // 副作用注册：让重置箭头 onActivate 可用

/**
 * 步进一个玩家的主动道具（S7 槽位）。
 * @param p   玩家状态（本地或远端 host 模拟）
 * @param ctx 触发上下文：dt / hookEdge（发射边沿）/ aim（瞄准方向）
 */
export function stepActiveItem(p: PlayerState, ctx: ActiveItemContext): void {
  const id = p.backpack[p.selectedSlot];
  if (id === undefined) return;
  ITEMS[id]?.onActivate?.(p, ctx);
}
