/**
 * 战斗参数注册表 —— 生命 / 受击 / 伤害调参的单一来源。
 *
 * 只依赖 types。S1 只含生命与受击常量；武器参数见 ./weapons.ts（S2）。
 *
 * 设计要点：受击无敌（HIT_INV）不是"手感糖"，而是持续接触型伤害
 * （地刺 / 激光走 stay 事件逐物理步触发）的必需品 —— 没有它，站在刺里
 * 会以 120Hz 扣血并在一帧内死亡。
 */

/** 玩家生命上限 */
export const PLAYER_MAX_HP = 100;

/**
 * 受击后无敌时长（秒）。
 * 持续接触伤害（地刺）下表现为"每 0.6 秒掉一次血"的节拍，而非逐帧刮骨。
 */
export const HIT_INV = 0.6;

/** 受击击退冲量的持续时长（秒） */
export const HIT_IMPULSE_DUR = 0.18;

/** 尖刺单次伤害（三下致死） */
export const SPIKE_DAMAGE = 34;

/** 激光单次伤害（三下致死） */
export const LASER_DAMAGE = 34;

/** 敌人接触伤害（行走兵撞到玩家单次扣血；节拍由玩家受击无敌 HIT_INV 控制） */
export const ENEMY_CONTACT_DAMAGE = 12;
