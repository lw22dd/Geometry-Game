/**
 * 武器/敌人集成冒烟测试（S2/S3）—— 验证抛体/敌人接入后的核心行为。
 *
 * 覆盖：
 *  - 敌人实体生成（EnemyBrain/Team/Health 挂载 + 状态真源落位）
 *  - 敌人受击扣血（Health 管线）
 *  - AK hitscan：fire 输入消耗弹药 + 设置开火冷却
 *  - 换弹：R 按下沿进入 reloadT，期间不可开火，到期复位
 *  - 敌人死亡（killEnemy）移除实体
 *
 * 运行：npx vitest run src/__smoke__/combat2.smoke.test.ts
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// 武器/抛体/敌人模块链会经渲染层加载 canvas（其模块作用域访问 document）→ mock（同金测试）
vi.mock('../core/canvas', () => ({
  cv: {} as HTMLCanvasElement,
  ctx: {} as CanvasRenderingContext2D,
  VW: 1280,
  VH: 720,
  PPM: 48,
  DPR: 1,
  resize: () => {},
}));

import { initEcs, clearWorld, Position, Health, EnemyBrain, qEnemies, qProjectiles } from '../core/ecs';
import { spawnEnemy, killEnemy } from '../systems/enemy';
import { stepWeapon } from '../systems/combat/weapon';
import { dealDamage } from '../systems/combat/damage';
import { createPlayerState } from '../systems/player/createPlayerState';
import { getEnemyKind } from '../Prefabs/Enemy';
import { WEAPONS } from '../config/weapons';
import type { PlayerState, InputKeys } from '../types';

beforeEach(() => {
  initEcs();
  clearWorld();
});

/** 空输入快照 + fire/altFire/reload 默认关 */
function idleInput(over: Partial<InputKeys> = {}): InputKeys {
  return {
    left: false, right: false, jump: false, sprint: false,
    interact: false, hook: false, fire: false, altFire: false, reload: false,
    aimX: 1, aimY: 0,
    ...over,
  };
}

/** 最小玩家（工厂构造） */
function freshPlayer(): PlayerState {
  return createPlayerState(0, 0);
}

/** 装备 AK（模拟已拾取武器拾取物；武器为主动道具，须持有=选中 ak 槽位才可使用） */
function equipAK(p: PlayerState): PlayerState {
  p.weapon = 'ak';
  p.backpack = ['ak'];
  p.selectedSlot = 0;
  p.ammo = WEAPONS.ak.ammo;
  return p;
}

describe('敌人实体（S3）', () => {
  it('spawnEnemy 挂载 EnemyBrain/Team/Health，状态真源落位 EnemyBrain[eid]', () => {
    const e = spawnEnemy('walker', 10, 4);
    expect(qEnemies()).toContain(e);
    expect(EnemyBrain[e].kind).toBe('walker');
    const def = getEnemyKind('walker');
    expect(Health.hp[e]).toBe(def.hp);
    expect(Health.max[e]).toBe(def.hp);
    expect(Position.x[e]).toBe(10);
  });

  it('敌人受击扣 Health 且进入受击无敌（inv>0）', () => {
    const e = spawnEnemy('walker', 10, 4);
    const before = Health.hp[e];
    dealDamage(e, { amount: 20, source: 'test' });
    expect(Health.hp[e]).toBe(before - 20);
    expect(Health.inv[e]).toBeGreaterThan(0);
  });

  it('killEnemy 移除实体', () => {
    const e = spawnEnemy('walker', 10, 4);
    expect(qEnemies()).toContain(e);
    killEnemy(e);
    expect(qEnemies()).not.toContain(e);
  });
});

describe('武器（S2）', () => {
  const DT = 1 / 120;

  it('fire 输入：消耗弹药 + 设置开火冷却（rate 节流）', () => {
    const p = equipAK(freshPlayer());
    expect(p.ammo).toBe(WEAPONS.ak.ammo);
    const ammoBefore = p.ammo;
    stepWeapon(p, idleInput({ fire: true }), { dt: DT, aim: { x: 1, y: 0 }, isLocal: false });
    expect(p.ammo).toBe(ammoBefore - 1);
    expect(p.fireCd).toBeCloseTo(1 / WEAPONS.ak.rate, 6);
  });

  it('开火冷却内不重复开火（保持 ammo 不变）', () => {
    const p = equipAK(freshPlayer());
    // 首击
    stepWeapon(p, idleInput({ fire: true }), { dt: DT, aim: { x: 1, y: 0 }, isLocal: false });
    const afterFirst = p.ammo;
    // 冷却未过 → 同帧再开火不消耗
    stepWeapon(p, idleInput({ fire: true }), { dt: DT, aim: { x: 1, y: 0 }, isLocal: false });
    expect(p.ammo).toBe(afterFirst);
    expect(p.fireCd).toBeGreaterThan(0);
  });

  it('换弹：R 按下沿进入 reloadT，期间开火被阻止', () => {
    const p = equipAK(freshPlayer());
    // 先清空弹匣再换弹（R 需要 ammo < 弹匣容量）
    p.ammo = 0;
    stepWeapon(p, idleInput({ reload: false }), { dt: DT, aim: { x: 1, y: 0 }, isLocal: false });
    stepWeapon(p, idleInput({ reload: true }), { dt: DT, aim: { x: 1, y: 0 }, isLocal: false });
    expect(p.reloadT).toBe(WEAPONS.ak.reloadTime);
    // 换弹中开火无效
    const ammoDuring = p.ammo;
    stepWeapon(p, idleInput({ fire: true }), { dt: DT, aim: { x: 1, y: 0 }, isLocal: false });
    expect(p.ammo).toBe(ammoDuring);
  });

  it('空膛自动换弹（fire 时 ammo=0 → reloadT 被设置）', () => {
    const p = equipAK(freshPlayer());
    p.ammo = 0;
    stepWeapon(p, idleInput({ fire: true }), { dt: DT, aim: { x: 1, y: 0 }, isLocal: false });
    expect(p.reloadT).toBe(WEAPONS.ak.reloadTime);
  });

  it('换弹完成：reloadT 归零时弹匣补满', () => {
    const p = equipAK(freshPlayer());
    p.ammo = 0;
    // 初始化 prevInput（reload: false）
    stepWeapon(p, idleInput({ reload: false }), { dt: DT, aim: { x: 1, y: 0 }, isLocal: false });
    // 触发换弹（reload 按下沿）
    stepWeapon(p, idleInput({ reload: true }), { dt: DT, aim: { x: 1, y: 0 }, isLocal: false });
    expect(p.reloadT).toBe(WEAPONS.ak.reloadTime);
    // 步进超过 reloadTime 时长（1.2s / (1/120) = 144 步，多跑保险）
    for (let i = 0; i < 200; i++) {
      stepWeapon(p, idleInput({ reload: false }), { dt: DT, aim: { x: 1, y: 0 }, isLocal: false });
    }
    expect(p.reloadT).toBe(0);
    expect(p.ammo).toBe(WEAPONS.ak.ammo);
  });

  it('无武器：出生默认 none，开火/换弹/手雷均无效', () => {
    const p = freshPlayer();
    expect(p.weapon).toBe('none');
    expect(p.hasGrenade).toBe(false);
    expect(p.ammo).toBe(0);
    // 开火无效（无弹药消耗）
    stepWeapon(p, idleInput({ fire: true }), { dt: DT, aim: { x: 1, y: 0 }, isLocal: false });
    expect(p.ammo).toBe(0);
    expect(p.fireCd).toBe(0);
    // 换弹无效
    stepWeapon(p, idleInput({ reload: false }), { dt: DT, aim: { x: 1, y: 0 }, isLocal: false });
    stepWeapon(p, idleInput({ reload: true }), { dt: DT, aim: { x: 1, y: 0 }, isLocal: false });
    expect(p.reloadT).toBe(0);
    // 左键手雷无效（未拾取手雷）
    stepWeapon(p, idleInput({ fire: false }), { dt: DT, aim: { x: 1, y: 0 }, isLocal: false });
    stepWeapon(p, idleInput({ fire: true }), { dt: DT, aim: { x: 1, y: 0 }, isLocal: false });
    expect(p.ammo).toBe(0);
  });

  it('手雷：持有（选中 grenade 槽位）+ hasGrenade 门控左键投掷', () => {
    const p = freshPlayer();
    // 未拾取手雷：左键按下沿无抛体生成
    stepWeapon(p, idleInput({ fire: false }), { dt: DT, aim: { x: 1, y: 0 }, isLocal: false });
    stepWeapon(p, idleInput({ fire: true }), { dt: DT, aim: { x: 1, y: 0 }, isLocal: false });
    expect(qProjectiles().length).toBe(0);
    // 拾取手雷（入背包 + 选中该槽位）后：左键按下沿生成抛体
    p.backpack = ['grenade'];
    p.selectedSlot = 0;
    p.hasGrenade = true;
    const before = qProjectiles().length;
    stepWeapon(p, idleInput({ fire: false }), { dt: DT, aim: { x: 1, y: 0 }, isLocal: false });
    stepWeapon(p, idleInput({ fire: true }), { dt: DT, aim: { x: 1, y: 0 }, isLocal: false });
    expect(qProjectiles().length).toBe(before + 1);
    // 已拾取但未选中手雷槽位（持有语义）→ 左键无效
    p.backpack = ['grenade'];
    p.selectedSlot = 5;
    stepWeapon(p, idleInput({ fire: false }), { dt: DT, aim: { x: 1, y: 0 }, isLocal: false });
    stepWeapon(p, idleInput({ fire: true }), { dt: DT, aim: { x: 1, y: 0 }, isLocal: false });
    expect(qProjectiles().length).toBe(before + 1);
  });
});