/**
 * 密码机冒烟测试（第五人格式破译机）—— 靠近 + 持续按 E 破译，进度满转完成。
 *
 * 验证契约：
 *  - 破译中 progress 随 dt 线性增长，未交互/未靠近不增长；
 *  - 进度达 100% 后 done=1（从未完成转已完成）；
 *  - 世界状态：cipherTotal 由装配写入；cipherDoneCount() 由 ECS（Cipher.done）派生。
 * 运行：npx vitest run src/__smoke__/cipher.smoke.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { initEcs, clearWorld, Cipher, Position, Collider, qCiphers } from '../core/ecs';
import { createCipherMachine } from '../Prefabs/Scenes/sceneFactory';
import { updateCipherSystem, resetCipherSpark, cipherDoneCount } from '../systems/interactions/CipherSystem';
import { pointInCollider } from '../systems/level';

beforeEach(() => {
  initEcs();
  clearWorld();
  resetCipherSpark();
});

describe('密码机（CipherSystem · 靠近 + 按住 E 破译）', () => {
  it('玩家靠近且按住 E 时 progress 增长，未靠近/未按 E 不增长', () => {
    const e = createCipherMachine(0, 0);
    // 靠近：玩家点落在触发区内
    expect(pointInCollider(e, 0, 0.5)).toBe(true);
    // 未按 E → 不增长
    updateCipherSystem(0, 0.5, false, 1, false);
    expect(Cipher.progress[e]).toBe(0);
    // 靠近 + 按住 E → 增长（1s = CIPHER_DECODE_SPEED ≈ 18）
    updateCipherSystem(0, 0.5, true, 1, false);
    expect(Cipher.progress[e]).toBeGreaterThan(0);
    // 远离 → 不增长
    updateCipherSystem(100, 100, true, 1, false);
    expect(Cipher.progress[e]).toBeCloseTo(Cipher.progress[e], 6);
  });

  it('进度满 100% → done=1（未完成转完成）', () => {
    const e = createCipherMachine(0, 0);
    expect(Cipher.done[e]).toBe(0);
    // 连续按住 E：累计 6s（18/s → 108% > 100%）
    updateCipherSystem(0, 0.5, true, 1, false);
    updateCipherSystem(0, 0.5, true, 1, false);
    updateCipherSystem(0, 0.5, true, 1, false);
    updateCipherSystem(0, 0.5, true, 1, false);
    updateCipherSystem(0, 0.5, true, 1, false);
    updateCipherSystem(0, 0.5, true, 1, false);
    expect(Cipher.progress[e]).toBe(100);
    expect(Cipher.done[e]).toBe(1);
  });

  it('完成后再按 E 不重复累加（done 锁定）', () => {
    const e = createCipherMachine(0, 0);
    for (let i = 0; i < 10; i++) updateCipherSystem(0, 0.5, true, 1, false);
    const locked = Cipher.progress[e];
    updateCipherSystem(0, 0.5, true, 1, false);
    expect(Cipher.progress[e]).toBe(locked);
  });

  it('世界状态：cipherTotal 由装配写入，cipherDoneCount 派生自 ECS', () => {
    const a = createCipherMachine(0, 0);
    const b = createCipherMachine(10, 0);
    expect(qCiphers()).toHaveLength(2);
    expect(cipherDoneCount()).toBe(0);
    // 完成一台 → 派生计数 +1（单一数据源 = ECS Cipher.done）
    for (let i = 0; i < 10; i++) updateCipherSystem(0, 0.5, true, 1, false);
    expect(Cipher.done[a]).toBe(1);
    expect(Cipher.done[b]).toBe(0);
    expect(cipherDoneCount()).toBe(1);
    // 两台都完成 → 派生计数 = 2
    for (let i = 0; i < 10; i++) updateCipherSystem(10, 0.5, true, 1, false);
    expect(Cipher.done[b]).toBe(1);
    expect(cipherDoneCount()).toBe(2);
  });

  it('密码机为触发区（Collider solid=0，不阻挡玩家）', () => {
    const e = createCipherMachine(0, 0);
    expect(Collider.solid[e]).toBe(0);
    expect(Position.x[e]).toBe(0);
  });
});
