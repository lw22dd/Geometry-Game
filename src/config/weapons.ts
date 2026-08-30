/**
 * 武器参数注册表 —— AK 射线 / 手雷抛体 的调参单一来源（S2）。
 *
 * 设计要点：
 *  - 武器是独立体系（不进 Backpack ITEMS 槽位，数字键 1-5 已占）。
 *  - 主武器 = 玩家状态 p.weapon（默认 ak），左键开火；手雷 = 选中 grenade 槽位后左键按下沿投掷。
 *  - 所有武器字段集中在此，系统只读此表，新增武器 = 加一行。
 * 只依赖 types。
 */
import type { Vector2, WeaponId } from '../types';

/** 抛体参数（hitscan 武器无此项） */
export interface ProjectileDef {
  /** 重力加速度（格/秒²，正值 = 向下加速） */
  gravity: number;
  /** 引信时长（秒） */
  fuse: number;
  /** 爆炸半径（格） */
  blastRadius: number;
  /** 初速（格/秒） */
  speed: number;
}

/** 武器定义 */
export interface WeaponDef {
  id: WeaponId;
  name: string;
  /** 命中方式：hitscan 瞬间命中射线 / projectile 抛体 */
  kind: 'hitscan' | 'projectile';
  /** 持有分类标签：gun = 枪械（持有靠玩家中心 + 放大）/ throwable = 投掷物（原手部持有） */
  category: 'gun' | 'throwable';
  /** 射速（发/秒） */
  rate: number;
  /** 散布（弧度，±半角） */
  spread: number;
  /** 单发伤害 */
  damage: number;
  /** 击退矢量（格/秒，转入通用外力队列） */
  knockback: Vector2;
  /** 弹匣容量 */
  ammo: number;
  /** 换弹时长（秒） */
  reloadTime: number;
  /** hitscan 射程（格） */
  range: number;
  /** 抛体参数（kind='projectile' 时提供） */
  projectile?: ProjectileDef;
}

/** 武器注册表（key = 可装备武器 id，排除 'none' 占位；与 types 的 WeaponId 一致） */
export const WEAPONS: Record<Exclude<WeaponId, 'none'>, WeaponDef> = {
  ak: {
    id: 'ak',
    name: 'AK',
    kind: 'hitscan',
    category: 'gun',
    rate: 8,
    spread: 0.035,
    damage: 14,
    knockback: { x: 2.5, y: 1 },
    ammo: 30,
    reloadTime: 1.2,
    range: 42,
  },
  grenade: {
    id: 'grenade',
    name: '手雷',
    kind: 'projectile',
    category: 'throwable',
    rate: 1.5,
    spread: 0.02,
    damage: 60,
    knockback: { x: 6, y: 3.5 },
    ammo: 3,
    reloadTime: 1.6,
    range: 22,
    projectile: {
      gravity: 22,
      fuse: 1.4,
      blastRadius: 3.2,
      speed: 14,
    },
  },
};

/** 武器 id → 数字编码（PlayerControl SoA 投影用；单一事实源 = WEAPONS 键序） */
export const WEAPON_IDS = Object.keys(WEAPONS) as Exclude<WeaponId, 'none'>[];

/** WeaponId → 数字编码（写入 PlayerControl.weapon；'none' = -1） */
export function weaponToCode(id: WeaponId): number {
  return WEAPON_IDS.indexOf(id as Exclude<WeaponId, 'none'>);
}

/** 数字编码 → WeaponId（越界 / 无武器回退 'none'，防御） */
export function weaponFromCode(c: number): WeaponId {
  return WEAPON_IDS[c] ?? 'none';
}