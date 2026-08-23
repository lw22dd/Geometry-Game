/**
 * 游戏事件常量 + netBus 发射辅助。
 * 当前为留白桩，后续可扩展为 typed event 发射。
 */
import { netBus } from '../../core/netBus';
import type { NetBusEvent } from '../../types';

export const EV = {
  STARTED: 'game:started' as const,
  CHECKPOINT: 'game:checkpoint' as const,
  ORB: 'game:orb' as const,
  DEATH: 'game:death' as const,
  WIN: 'game:win' as const,
};

/** 发射游戏事件到 netBus（预留，当前未集成到 gameplay 中） */
export function emitGameEvent(evt: NetBusEvent): void {
  netBus.emit(evt);
}