/**
 * 重置箭头 —— 主动道具 onActivate 注册。
 *
 * 玩法：拥有重置箭头（背包 active 道具）且选中该槽位时，左键使用
 * （与钩锁共用 ctx.hookEdge 左键按下沿），立即传送到「上一个绑定的检查点」。
 *
 * 检查点绑定：
 *  - 本地玩家：全局 cpPoint（activateCheckpoint 写入）。
 *  - 远端玩家（host 模拟）：rp 为 RemotePlayer，扩展了 cpX/cpY。
 *  统一用 (p as RemotePlayer).cpX/cpY ?? cpPoint 读取，两端共用同一实现。
 *
 * 复位语义与 respawn 对齐：清速度/平台/轨道/外力，并给短暂无敌帧，
 * 避免传送后立即被危险物判定致死。
 */
import type { RemotePlayer, PlayerState } from '../../types';
import { cpPoint } from '../../config';
import { ITEMS, type ActiveItemContext } from './backpack';
import { sfx } from '../../core/audio';

/** 重置箭头主动触发：选中该槽位 + 左键按下沿 → 回到绑定的检查点 */
function recallActivate(p: PlayerState, ctx: ActiveItemContext): void {
  // 主动语义：必须选中本道具所在槽位才能使用（与钩锁一致）
  if (p.backpack[p.selectedSlot] !== 'recall') return;
  // 触发：左键按下沿（本地=鼠标沿，远端=客机上报 input）
  if (!ctx.hookEdge) return;
  // 死亡时不传送
  if (p.dead) return;

  // 检查点坐标：远端 rp 携带 cpX/cpY；本地回退全局 cpPoint
  const rp = p as RemotePlayer;
  const tx = typeof rp.cpX === 'number' ? rp.cpX : cpPoint.x;
  const ty = typeof rp.cpY === 'number' ? rp.cpY : cpPoint.y;

  // 传送复位（清速度/平台/轨道/外力；无敌帧防传送贴脸危险判定）
  p.x = tx;
  p.y = ty + 1.2;
  p.velocity.x = 0;
  p.velocity.y = 0;
  p.inv = 1.2;
  p.plat = null;
  p.track = null;
  p.impulses.length = 0;
  // 回到检查点视为落地：清空滞空跳跃次数，着陆系统会按 grounded 恢复
  p.extraJumps = 0;

  if (ctx.sfx !== false) sfx.cp();
}

/** 注册重置箭头主动道具（模块加载时生效；activeItem 按选中槽位调用） */
ITEMS['recall'].onActivate = recallActivate;