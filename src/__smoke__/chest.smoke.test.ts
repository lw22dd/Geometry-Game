/**
 * 宝箱冒烟测试（霓虹宝箱）—— 40s 刷新周期可开启，打开掉落随机可拾取物。
 *
 * 验证契约：
 *  - 创建时 state=1（初始可开启），type 正确（0 武器 / 1 道具）；
 *  - 交互：玩家在触发区内 + 按 E → state=2（开启动画）+ 生成掉落物（qLoot +1）；
 *  - 开启动画结束后进入冷却（state=0）；冷却满 40s 刷新为可开启（state=1）；
 *  - 掉落物带 Collectible（可被现有拾取链路处理）+ Loot.lifetime 到期销毁。
 * 运行：npx vitest run src/__smoke__/chest.smoke.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { hasComponent } from 'bitecs';
import {
  world, initEcs, clearWorld, Chest, Loot, Position, Collider, Collectible, renderStyles, qChests, qLoot,
} from '../core/ecs';
import { createChest } from '../Prefabs/Scenes/sceneFactory';
import { stepChests, updateChestSystem, resetChestState } from '../systems/interactions/ChestSystem';
import { pointInCollider } from '../systems/level';

beforeEach(() => {
  initEcs();
  clearWorld();
  renderStyles.length = 0;
  resetChestState();
});

describe('宝箱（ChestSystem · 40s 刷新 + 交互开启 + 掉落）', () => {
  it('创建时 state=1（初始可开启）且 type 正确；宝箱为触发区（solid=0）', () => {
    const weapon = createChest(0, 0, 0);
    const prop = createChest(10, 0, 1);
    expect(Chest.type[weapon]).toBe(0);
    expect(Chest.type[prop]).toBe(1);
    expect(Chest.state[weapon]).toBe(1);
    expect(Chest.state[prop]).toBe(1);
    expect(Collider.solid[weapon]).toBe(0);
    expect(qChests()).toHaveLength(2);
  });

  it('玩家在触发区内 + 按 E → 开启（state=2）+ 掉落物生成（qLoot +1，带 Collectible）', () => {
    const e = createChest(0, 0, 0);
    // 触发区：Position(0,0) + Collider(2.2×2.0, oy=1.0) → 玩家点 (0, 0.5) 在区内
    expect(pointInCollider(e, 0, 0.5)).toBe(true);
    // 未按 E → 不开
    updateChestSystem(0, 0.5, false, false);
    expect(Chest.state[e]).toBe(1);
    // 靠近 + 按 E → 开启 + 掉落
    updateChestSystem(0, 0.5, true, false);
    expect(Chest.state[e]).toBe(2);
    expect(qLoot()).toHaveLength(1);
    const loot = qLoot()[0];
    expect(hasComponent(world, loot, Collectible)).toBe(true);
    // 掉落物在宝箱上方浮起
    expect(Position.y[loot]).toBeCloseTo(Position.y[e] + 1.0);
  });

  it('远离触发区按 E 不开启', () => {
    const e = createChest(0, 0, 0);
    updateChestSystem(100, 100, true, false);
    expect(Chest.state[e]).toBe(1);
    expect(qLoot()).toHaveLength(0);
  });

  it('开启动画结束 → 进入冷却（state=0）', () => {
    const e = createChest(0, 0, 0);
    updateChestSystem(0, 0.5, true, false);
    expect(Chest.state[e]).toBe(2);
    stepChests(2.0); // 超过 CHEST_OPEN_TIME(1.5)
    expect(Chest.state[e]).toBe(0);
  });

  it('冷却满 40s → 刷新为可开启（state=1）', () => {
    const e = createChest(0, 0, 0);
    // 打开 → 冷却
    updateChestSystem(0, 0.5, true, false);
    stepChests(2.0);
    expect(Chest.state[e]).toBe(0);
    // 冷却 40s → 重新可开启
    stepChests(40.0);
    expect(Chest.state[e]).toBe(1);
  });

  it('掉落物 Loot.lifetime 递减，到期自动销毁', () => {
    const e = createChest(0, 0, 0);
    updateChestSystem(0, 0.5, true, false);
    const loot = qLoot()[0];
    const t0 = Loot.lifetime[loot];
    expect(t0).toBeGreaterThan(0);
    stepChests(1);
    expect(Loot.lifetime[loot]).toBeLessThan(t0);
    // 步进足够久 → 实体销毁
    stepChests(t0);
    expect(qLoot()).toHaveLength(0);
    void e;
  });

  it('掉落物为可拾取物（带 Collectible），可被现有拾取链路处理', () => {
    const e = createChest(0, 0, 0);
    updateChestSystem(0, 0.5, true, false);
    const loot = qLoot()[0];
    expect(hasComponent(world, loot, Collectible)).toBe(true);
    void e;
  });
});
