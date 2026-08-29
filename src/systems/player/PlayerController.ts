/**
 * PlayerController —— 玩家实体生命周期 + 渲染只读视图持有者（A 路线）。
 *
 * 职责：
 *  - 持有渲染只读视图 this.state：每个物理步由 stepPlayer 的 scratch 镜像而来（mirrorFrom，
 *    零分配），步外事件路径修改视图后经 flush() 一次性写回组件。
 *  - 管理实体生命周期：ensurePlayerEntity / flush 出栈口。
 *  - die / respawn / resetToSpawn / 槽位 / 网络矫正等事件路径修改：改视图后立即写回组件
 *    （直写 ECS，不再有"防下帧 hydrate 覆盖"的散点补丁 —— hydrateFrom 已删除）。
 *  - 产出事件（PlayerEvent）经 emitEvent 派发，供 Game 层消费（更新 gs、sfx、粒子等）；
 *    该事件出口将在后续演进中并入 netBus（PlayerController 不再持有 onEvent 回调字段）。
 *
 * 不依赖：
 *  - 不直接读 keys 表（输入由 Game 提取后直接传给 stepPlayer）
 *  - 不直接写 gs（GameState）
 *  - 不直接调 sfx / spawnParticles
 *  - 不直接发 netBus
 */
import type { PlayerState, PlayerEvent, TrackState } from '../../types';
import { createPlayerState } from './createPlayerState';
import { recomputeStats } from '../effects';
import { cpPoint } from '../../config';
import { getPlayerEid, mirrorPlayerState, storePlayerComponents, syncFromEcs } from './playerEntity';
import { PlayerControl, Velocity } from '../../core/ecs';
import { trail } from '../particles';
import { netBus } from '../../core/netBus';

/* ==================== 事件类型（问题 4：并入 netBus 单一事件通道） ==================== */

export type { PlayerEvent } from '../../types';

/* ==================== Controller ==================== */

export class PlayerController {
  private state: PlayerState;
  private deathCount: number;

  constructor(spawnX: number, spawnY: number) {
    this.state = createPlayerState(spawnX, spawnY);
    this.deathCount = 0;
  }

  /* ==================== 只读访问 ==================== */

  getState(): PlayerState { return this.state; }
  isDead(): boolean { return this.state.dead; }
  getDeathCount(): number { return this.deathCount; }

  /* ==================== 视图同步（渲染只读视图） ==================== */

  /** 物理步后：scratch → 视图（零分配，复杂数组引用共享） */
  mirrorFrom(source: PlayerState): void {
    mirrorPlayerState(this.state, source);
  }

  /** 每渲染帧一次的派生视图刷新：组件真源 → 视图（独立引用） */
  refreshFromEcs(): void {
    const v = syncFromEcs(getPlayerEid());
    if (v) mirrorPlayerState(this.state, v);
  }

  /**
   * 步外修改统一出栈口：视图 → 组件（单点写回；实体未接线时为空操作）。
   * 网络矫正 / 事件路径（keydown、权威修正）修改视图后调用。
   */
  flush(): void {
    storePlayerComponents(getPlayerEid(), this.state);
  }

  /* ==================== 事件出口（问题 4：统一走 netBus） ==================== */

  /** 事件统一出口：die/respawn/Game 步进循环均经 netBus 派发（wirePlayerEvents / TriggerSystem 订阅） */
  emitEvent(event: PlayerEvent): void {
    netBus.emit(event);
  }

  /** 物理内坠落死亡登记（Game 在 died 边沿检测时调用）；返回累计死亡数 */
  registerDeath(): number {
    this.deathCount++;
    return this.deathCount;
  }

  /* ==================== 事件路径：直写组件（删除 hydrateFrom 后无"防覆盖补丁"） ==================== */

  /** 键盘事件快捷：设置跳跃缓冲 + 输入层按下标记（直写组件，无需 flush） */
  setJumpBuffer(value: number): void {
    this.state.jbuf = value;
    this.state.jumpFresh = true;
    const e = getPlayerEid();
    if (e >= 0) {
      PlayerControl.jbuf[e] = value;
      PlayerControl.jumpFresh[e] = 1;
    }
  }

  /** 选中槽位（直写组件，无需 flush） */
  setSelectedSlot(slot: number): void {
    this.state.selectedSlot = slot;
    const e = getPlayerEid();
    if (e >= 0) PlayerControl.selectedSlot[e] = slot;
  }

  /** 垂直速度缩放（P 键切换物理模式用；直写组件，无需 flush） */
  scaleVerticalVelocity(ratio: number): void {
    this.state.velocity.y *= ratio;
    const e = getPlayerEid();
    if (e >= 0) Velocity.y[e] *= ratio;
  }

  /* ==================== 生命周期 ==================== */

  /** 死亡（视图 + 直写组件） */
  die(): void {
    if (this.state.dead || this.state.inv > 0) return;
    this.state.dead = true;
    this.state.deadT = 0.85;
    this.deathCount++;
    this.emitEvent({ type: 'player:died', deaths: this.deathCount });
    this.flush();
  }

  /** 复活（视图 + 直写组件） */
  respawn(): void {
    this.state.dead = false;
    this.state.x = cpPoint.x;
    this.state.y = cpPoint.y + 1.2;
    this.state.velocity.x = 0;
    this.state.velocity.y = 0;
    this.state.inv = 1.2;
    this.state.plat = null;
    this.state.impulses.length = 0;
    this.state.track = null;
    // 双跳为永久升级，复活保留 extraJumpsMax；但本次滞空期清零，着陆后刷新
    this.state.extraJumps = 0;
    trail.length = 0;
    this.emitEvent({ type: 'player:respawned' });
    this.flush();
  }

  /**
   * 切换关卡后的完整复位（换图用）——比 respawn 更彻底：
   * 位置/速度清零、死亡清除、双跳永久升级归零（换图必须重来）、清曳光。
   */
  resetToSpawn(x: number, y: number): void {
    this.state.dead = false;
    this.state.x = x;
    this.state.y = y;
    this.state.velocity.x = 0;
    this.state.velocity.y = 0;
    this.state.face = 1;
    this.state.grounded = false;
    this.state.coyote = 0;
    this.state.jbuf = 0;
    this.state.inv = 1.2;
    this.state.plat = null;
    this.state.impulses.length = 0;
    this.state.track = null;
    this.state.sprint = false;
    this.state.extraJumps = 0;
    this.state.extraJumpsMax = 0;
    // Modifier 管道：换图清零全部数值修正（双跳票为"本图收集"语义）
    this.state.modifiers = [];
    recomputeStats(this.state);
    // 换图重置背包（死亡保留；背包为"本图收集"语义）
    this.state.backpack = [];
    this.state.hookCd = 0;
    this.state.hookMissT = 0;
    this.state.selectedSlot = 0;
    trail.length = 0;
    this.flush(); // 实体未接线（切图 init 前）时为空操作；接线后由调用方在 ensurePlayerEntity 后补一次 init flush
  }

  /**
   * 客机专用：维持死亡视觉效果，不推进计时（等待房主权威复活）。
   */
  maintainDeathVisual(): void {
    this.state.deadT = 0.85;
  }

  /* ==================== 网络权威矫正 ==================== */

  /**
   * 用房主权威位置矫正本地预测（客机用）。
   * 偏差大于 0.5 格时硬矫正位置 + 速度。
   * 注意：调用方（net 'state' 处理）在批量矫正后统一 flush 写回组件。
   */
  applyCorrection(
    x: number, y: number, vx: number, vy: number,
    face: number, grounded: boolean,
    track?: TrackState | null,
  ): void {
    this.state.x = x;
    this.state.y = y;
    this.state.velocity.x = vx;
    this.state.velocity.y = vy;
    this.state.face = face;
    this.state.grounded = grounded;
    if (track !== undefined) this.state.track = track;
  }

  /**
   * 应用权威死亡状态（客机用）。调用方随后统一 flush 写回组件。
   * @param dead 房主认为玩家是否死亡
   */
  applyDeathAuthority(dead: boolean, x: number, y: number, inv: number): void {
    if (dead && !this.state.dead) {
      // 房主权威判定死亡
      this.state.dead = true;
      this.state.deadT = 0.85;
    } else if (!dead && this.state.dead) {
      // 房主已复活
      this.state.dead = false;
      this.state.x = x;
      this.state.y = y;
      this.state.inv = inv;
    }
  }
}