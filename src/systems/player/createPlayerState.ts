/**
 * PlayerState 初始化工厂 —— 全项目唯一的状态构造入口。
 *
 * 背景：PlayerState 字面量此前在 PlayerController 构造函数与 remote.registerRemote
 * 各复制一份（加 ECS 实体接线后将是第三份），新增字段必须同步改多处、容易漏。
 * 本工厂收敛全部默认值，任何新字段只在工厂增加一处。
 *
 * 约定：
 *  - 工厂只产生"最小初始状态"（出生默认值）；生命周期字段（cpX/cpY、玩家 id 等
 *    扩展字段）由调用方在返回对象上补充。
 *  - 物理行为冻结测试（physics.golden.test.ts）维护独立的 freshPlayer()，不得引用本工厂
 *    —— 金测试冻结的是行为而非实现。
 *  - 出生点语义：本地与远程均以 (x,y) 传入；出生"嵌地推挤"行为见金测试 S0，属真实怪癖。
 *
 * @param x 出生 X（格）
 * @param y 出生 Y（格）
 */
import type { PlayerState } from '../../types';

export function createPlayerState(x: number, y: number): PlayerState {
  return {
    x, y,
    velocity: { x: 0, y: 0 },
    half: 0.42,
    grounded: false, coyote: 0, jbuf: 0, face: 1,
    dead: false, deadT: 0, plat: null,
    sprint: false, wasSpr: false, inv: 0,
    extraJumps: 0, extraJumpsMax: 0,
    shields: 0, shieldsMax: 0,
    speedMult: 1,
    modifiers: [],
    jumpWasDown: false, jumpFresh: false,
    impulses: [],
    track: null,
    backpack: [],
    hookCd: 0, hookMissT: 0, selectedSlot: 0,
  };
}