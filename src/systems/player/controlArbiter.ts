/**
 * S3 控制权仲裁（ControlArbiter）
 *
 * 每帧从玩家状态**事实**推导"当前谁持有控制权"，写入 ControlMode 组件（SoA）。
 * 优先级表（从高到低）：`dead > zipline > track > [spring > sprint] > free`。
 *
 * 落地情况：
 *  - DEAD / ZIPLINE / TRACK / FREE 四档已由现有 PlayerState 事实实体化；
 *  - SPRING / SPRINT 为扩展位：它们是"部分接管"语义（冲刺只是提速、弹簧只是冲量，
 *    玩家仍保有自由控制），当前实现不产生独立档位。当 ControlLock 类约束
 *    （冰冻/眩晕/强制冲刺等）引入时，在 PRIORITY 表插入更高优先级谓词即可，
 *    MovementSystem 只读仲裁结果，零改动 —— 这就是"新机制不冲突"在控制层的入口。
 *
 * 纯函数：不读写任何模块全局可变状态；eid 由调用方（game/index.ts step()）传入。
 * 仲裁写点在物理步之后：此时 pState 已含本帧物理结果，ControlMode 反映"结算后"控制权。
 */
import type { PlayerState } from '../../types';
import {
  ControlMode,
  CONTROL_MODE_FREE,
  CONTROL_MODE_TRACK,
  CONTROL_MODE_ZIPLINE,
  CONTROL_MODE_DEAD,
} from '../../core/ecs';

/** 优先级表条目：active 谓词读 PlayerState 事实，数组顺序即优先级（前高后低） */
interface PriorityEntry {
  mode: number;
  active: (p: PlayerState) => boolean;
}

/** S3 优先级表（已落地 4 档；spring/sprint 扩展位见文件头注释） */
const PRIORITY: PriorityEntry[] = [
  { mode: CONTROL_MODE_DEAD, active: (p) => p.dead },
  { mode: CONTROL_MODE_ZIPLINE, active: (p) => !!p.track?.zipline },
  { mode: CONTROL_MODE_TRACK, active: (p) => !!p.track },
  // 扩展位（ControlLock 类约束引入时启用，例如强制冲刺/冰冻）：
  // { mode: CONTROL_MODE_SPRING, active: (p) => isSpringing(p) },
  // { mode: CONTROL_MODE_SPRINT, active: (p) => p.sprint },
];

/** 纯函数：按优先级表推导当前控制权（free 兜底，永不抛错） */
export function resolveControlMode(p: PlayerState): number {
  for (const entry of PRIORITY) {
    if (entry.active(p)) return entry.mode;
  }
  return CONTROL_MODE_FREE;
}

/** 写 ControlMode 组件（eid < 0 = 玩家实体未接线，静默跳过） */
export function writeControlMode(eid: number, mode: number): void {
  if (eid < 0) return;
  ControlMode.mode[eid] = mode;
}

/**
 * S3 系统入口：解析 + 写组件，返回最终 mode（供消费侧直接读，避免二次解析）。
 * MovementSystem 未来在物理步内按返回/组件值分支。
 */
export function stepControlArbiter(p: PlayerState, eid: number): number {
  const mode = resolveControlMode(p);
  writeControlMode(eid, mode);
  return mode;
}
