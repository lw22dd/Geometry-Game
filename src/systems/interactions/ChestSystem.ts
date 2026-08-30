/**
 * 宝箱系统 —— 40 秒刷新周期可开启的场景交互物（霓虹宝箱）。
 *
 * 状态机（Chest 组件 SoA）：
 *   state 0 = 冷却中：timer 累计，达到 CHEST_COOLDOWN 后转 state 1（可开启）。
 *   state 1 = 可开启：玩家在触发区内按 E → 转 state 2 + 掉落随机可拾取物。
 *   state 2 = 开启动画：timer 累计，达到开启动画时长后转 state 0（进入下一次冷却）。
 *
 * 宝箱种类（Chest.type）：
 *   0 = 武器宝箱（橙红）：掉落 AK / 手雷 拾取物。
 *   1 = 道具宝箱（蓝青）：掉落双跳票 / 钩锁 / 护盾 / 加速 / 重置箭头。
 *
 * 掉落物 = 现有拾取物实体（复用拾取/绘制/背包体系）+ Loot 组件：
 *   - 挂着 Collectible + 类型 tag，天然被 CollisionHooks 拾取、被 items.ts 绘制；
 *   - 外加 Loot.lifetime 倒计时，到期 removeEntity 自动销毁（避免地图实体堆积）。
 *
 * 网络：宝箱 state/timer 经 host_state 快照同步（NetChestState，同 Cipher）；
 * 掉落物实体在“打开动作发生端”本地创建（单机=本地；联机 host 模拟=host 端），
 * 拾取效果（背包/武器）经玩家状态同步，掉落物实体本身不进 NetItemState 快照。
 */
import { world, Position, Chest, Loot, qChests, qLoot } from '../../core/ecs';
import { addComponent, removeEntity } from 'bitecs';
import { pointInCollider } from '../level';
import { gs } from '../game/gameState';
import { FX } from '../../Prefabs/Fx';
import { spawnParticles } from '../particles';
import { sfx } from '../../core/audio';
import {
  createWeaponPickup, createJumpBoost, createHookPickup,
  createShieldPickup, createSpeedPickup, createRecallPickup,
} from '../../Prefabs/Scenes/sceneFactory';

/* ==================== 常量 ==================== */

/** 刷新周期：冷却结束 → 重新可开启（秒） */
export const CHEST_COOLDOWN = 40;
/** 开启动画时长（秒），动画结束后进入冷却 */
export const CHEST_OPEN_TIME = 1.5;
/** 掉落物存在时长（秒），到期自动销毁 */
const LOOT_LIFETIME = 20;

/** 武器宝箱掉落候选（kind = WeaponId） */
const WEAPON_LOOT = ['ak', 'grenade'] as const;
/** 道具宝箱掉落候选（工厂函数，返回值统一创建 hover 浮动拾取物） */
const ITEM_LOOT_FACTORIES = [
  createJumpBoost,
  createHookPickup,
  createShieldPickup,
  createSpeedPickup,
  createRecallPickup,
] as const;

/**
 * 掉落物类型确定性选择（种子 = 时间片 + 宝箱 eid）。
 * 两端（客机预测 / host 模拟）在同一时间片打开同一宝箱 → 得到同一掉落，
 * 避免 Math.random 导致两端不同步。
 */
function pickLootSlot(chestEid: number): number {
  const slot = Math.floor(gs.gt / CHEST_COOLDOWN) + chestEid;
  return slot < 0 ? -slot : slot;
}

/** 宝箱掉落：创建随机可拾取物实体（复用现有拾取物工厂）+ 挂 Loot 生命周期 */
function spawnLoot(chestEid: number): void {
  const isWeapon = Chest.type[chestEid] === 0;
  const x = Position.x[chestEid];
  const y = Position.y[chestEid] + 1.0; // 宝箱上方浮起
  const seed = pickLootSlot(chestEid);

  let loot: number;
  if (isWeapon) {
    const kind = WEAPON_LOOT[seed % WEAPON_LOOT.length];
    loot = createWeaponPickup(x, y, kind, 0);
  } else {
    const factory = ITEM_LOOT_FACTORIES[seed % ITEM_LOOT_FACTORIES.length];
    loot = factory(x, y, 0);
  }
  // 挂 Loot 生命周期标记（拾取走现有 Collectible 通道，这里只管自动销毁）
  addComponent(world, loot, Loot);
  Loot.type[loot] = isWeapon ? 0 : 1;
  Loot.lifetime[loot] = LOOT_LIFETIME;
  // 掉落物浮现光环（提示"有东西掉出来了"）
  spawnParticles(FX.lootPop, x, y);
}

/* ==================== 全局步进（game step 每物理步调用一次） ==================== */

/** 上一帧各宝箱 state（就绪边沿检测：冷却结束 → 重新可开启时播就绪反馈） */
const prevState = new Map<number, number>();

/** 切图时清空宝箱就绪边沿表（实体 eid 失效） */
export function resetChestState(): void {
  prevState.clear();
}

/**
 * 步进所有宝箱状态机 + 掉落物生命周期。
 * 注意：全局只调用一次（不按玩家数叠加），保证冷却计时跨端一致。
 */
export function stepChests(dt: number): void {
  for (const e of qChests()) {
    const s = Chest.state[e];
    if (s === 0) {
      // 冷却中 → 计时满转可开启
      Chest.timer[e] += dt;
      if (Chest.timer[e] >= CHEST_COOLDOWN) {
        Chest.timer[e] = 0;
        Chest.state[e] = 1;
        // 就绪边沿（0→1）：刷新可开启反馈（粒子 + 音效）
        spawnParticles(FX.chestReady, Position.x[e], Position.y[e] + 1.0);
        sfx.chestReady({ pan: 0 });
      }
    } else if (s === 2) {
      // 开启动画 → 动画结束进入冷却
      Chest.timer[e] += dt;
      if (Chest.timer[e] >= CHEST_OPEN_TIME) {
        Chest.timer[e] = 0;
        Chest.state[e] = 0;
      }
    }
    prevState.set(e, Chest.state[e]);
  }
  // 掉落物生命周期递减，到期销毁
  for (const e of qLoot()) {
    Loot.lifetime[e] -= dt;
    if (Loot.lifetime[e] <= 0) removeEntity(world, e);
  }
}

/* ==================== 玩家交互（本地 + host 模拟远端共用） ==================== */

/**
 * 宝箱交互检测：玩家在可开启宝箱触发区内 + 按 E → 开启并掉落。
 * @param tx,ty 玩家坐标
 * @param interact 交互键（E）是否按下 / 按住
 * @param isRemote 是否远端玩家（host 模拟；远端不播本地 toast/音效）
 */
export function updateChestSystem(tx: number, ty: number, interact: boolean, isRemote: boolean): void {
  // ① 冷却中的宝箱：玩家在触发区内按 E → 拒绝音（节流由 sfx.chestLocked 内部 gate 负责）
  if (interact && !isRemote) {
    for (const e of qChests()) {
      if (Chest.state[e] !== 0) continue;
      if (!pointInCollider(e, tx, ty)) continue;
      sfx.chestLocked({ pan: Math.max(-1, Math.min(1, (Position.x[e] - tx) * 0.3)) });
      break; // 一帧最多一次拒绝反馈
    }
  }

  // ② 可开启的宝箱：按 E → 开启
  for (const e of qChests()) {
    if (Chest.state[e] !== 1) continue;
    if (!pointInCollider(e, tx, ty) || !interact) continue;

    // 开启：转开启动画 + 掉落 + 特效
    Chest.state[e] = 2;
    Chest.timer[e] = 0;
    spawnLoot(e);

    const px = Position.x[e], py = Position.y[e];
    // 锁扣崩开 → 箱内光柱 → 沿地面外扩的扬尘（与音效三段分层同节奏）
    spawnParticles(FX.chestUnlock, px, py + 1.0);
    spawnParticles(FX.chestOpen, px, py + 1.0);
    spawnParticles(FX.chestBeam, px, py + 1.2);
    spawnParticles(FX.chestDust, px, py + 0.3);
    spawnParticles(FX.chestRing, px, py + 1.0);
    if (!isRemote) {
      sfx.chestOpen({ pan: Math.max(-1, Math.min(1, (px - tx) * 0.3)) });
      gs.toast = Chest.type[e] === 0 ? '✦ 武器宝箱开启！' : '✦ 道具宝箱开启！';
      gs.toastT = 1.6;
    }
    return; // 一帧只开启一个宝箱（避免按住 E 连开多个）
  }
}