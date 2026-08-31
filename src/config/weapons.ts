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
  /** 直射类抛体最大飞行距离（格）——超过即消失（火箭筒等直线弹道）；缺省 0 = 不受距离限制（手雷靠引信） */
  maxRange?: number;
  /** 爆炸施加给敌人的减速倍率（<1 = 减速；如 0.8 = 减速 20%）。缺省 1 = 无减速 */
  slowFactor?: number;
  /** 减速持续时长（秒，slowFactor < 1 时生效） */
  slowDur?: number;
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
  /** 单发弹丸数（hitscan 霰弹：一次喷射多颗，各自独立散布/命中；缺省 1 = 单发） */
  pellets?: number;
  /** hitscan 穿透数（>0 = 子弹可穿透 hitPierce 个敌人后消失；AWM）。缺省 0 = 命中最近即止 */
  hitPierce?: number;
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
  shotgun: {
    id: 'shotgun',
    name: '霰弹枪',
    kind: 'hitscan',
    category: 'gun',
    rate: 1.4,
    spread: 0.32,
    damage: 7,
    knockback: { x: 4, y: 1.5 },
    ammo: 6,
    reloadTime: 1.8,
    range: 16,
    pellets: 8,
  },
  awm: {
    id: 'awm',
    name: 'AWM',
    kind: 'hitscan',
    category: 'gun',
    rate: 1.2,
    spread: 0.004,
    damage: 90,
    knockback: { x: 6, y: 2 },
    ammo: 5,
    reloadTime: 2.2,
    range: 60,
    hitPierce: 3,
  },
  rocket: {
    id: 'rocket',
    name: '火箭筒',
    kind: 'projectile',
    category: 'throwable',
    rate: 0.7,
    spread: 0.01,
    damage: 75,
    knockback: { x: 6, y: 4 },
    ammo: 2,
    reloadTime: 2.4,
    range: 36,
    projectile: {
      gravity: 0,      // 直线弹道（火箭筒，无下坠）
      fuse: 2.5,       // 保险时长（兜底，正常靠 maxRange 消失）
      blastRadius: 3.5,
      speed: 26,
      maxRange: 36,    // 超过射程即消失（通用逻辑：超出范围子弹消失）
    },
  },
  iceBomb: {
    id: 'iceBomb',
    name: '冰冻炸弹',
    kind: 'projectile',
    category: 'throwable',
    rate: 1.2,
    spread: 0.02,
    damage: 50,
    knockback: { x: 5, y: 3 },
    ammo: 3,
    reloadTime: 1.5,
    range: 22,
    projectile: {
      gravity: 22,       // 与手雷一致的抛物线
      fuse: 1.4,
      blastRadius: 3.2,
      speed: 14,
      slowFactor: 0.8,   // 减速 20%
      slowDur: 3,        // 持续 3 秒
    },
  },
};

/** 武器 id → 数字编码（PlayerControl SoA 投影用；单一事实源 = WEAPONS 键序） */
export const WEAPON_IDS = Object.keys(WEAPONS) as Exclude<WeaponId, 'none'>[];

/** 字符串是否为武器 id（'none' 占位除外） */
export function isWeaponId(id: string): id is Exclude<WeaponId, 'none'> {
  return (WEAPON_IDS as readonly string[]).includes(id);
}

/** WeaponId → 数字编码（写入 PlayerControl.weapon；'none' = -1） */
export function weaponToCode(id: WeaponId): number {
  return WEAPON_IDS.indexOf(id as Exclude<WeaponId, 'none'>);
}

/** 数字编码 → WeaponId（越界 / 无武器回退 'none'，防御） */
export function weaponFromCode(c: number): WeaponId {
  return WEAPON_IDS[c] ?? 'none';
}