/**
 * PlayerController —— 玩家控制类。
 *
 * 职责：
 *  - 持有 PlayerState（私有，不暴露写权限）
 *  - 消费外部输入（InputKeys）
 *  - 管理物理步进 + 动画步进
 *  - 管理 die / respawn 生命周期
 *  - 产出事件（PlayerEvent）供 Game 层消费（更新 gs、sfx、粒子等）
 *
 * 不依赖：
 *  - 不直接读 keys 表（输入由 Game 注入）
 *  - 不直接写 gs（GameState）
 *  - 不直接调 sfx / spawnParticles
 *  - 不直接发 netBus
 */
import type { FrameSignals, PlayerState, InputKeys, TrackState } from '../../types';
import type { PhysicsKey } from '../game/gameMode';
import { stepPlayerGeneric } from './index';
import { stepPlayerAnimation } from '../../Prefabs/Player';
import { updateCollisionSystem } from '../level';
import { trail } from '../particles';
import { cpPoint } from '../../config';

/* ==================== 事件类型 ==================== */

export type PlayerEvent =
  | { type: 'died'; deaths: number }
  | { type: 'respawned' }
  | { type: 'dashed' }
  | { type: 'jumped' }
  | { type: 'landed'; impact: number }
  | { type: 'springed' };

/* ==================== Controller ==================== */

export class PlayerController {
  private state: PlayerState;
  private input: InputKeys;
  private deathCount: number;

  /** 事件回调（Game 层注入，每帧内同步调用） */
  onEvent?: (event: PlayerEvent) => void;

  constructor(spawnX: number, spawnY: number) {
    this.state = {
      x: spawnX, y: spawnY, velocity: { x: 0, y: 0 }, half: 0.42,
      grounded: false, coyote: 0, jbuf: 0, face: 1,
      dead: false, deadT: 0, plat: null,
      sprint: false, wasSpr: false, inv: 0,
      extraJumps: 0, extraJumpsMax: 0,
      jumpWasDown: false, jumpFresh: false,
      springT: 0, springAcceleration: { x: 0, y: 0 },
      track: null,
    };
    this.input = { left: false, right: false, jump: false, sprint: false, interact: false };
    this.deathCount = 0;
  }

  /* ==================== 只读访问 ==================== */

  getState(): PlayerState { return this.state; }
  isDead(): boolean { return this.state.dead; }
  getDeathCount(): number { return this.deathCount; }

  /* ==================== 输入注入 ==================== */

  /** 每帧注入输入（Game 从 keys 表或网络包提取） */
  setInput(input: InputKeys): void {
    // 保存上一帧的 jump 状态用于边缘检测（帧间 key-up 也能正确反映）
    this.state.jumpWasDown = this.input.jump;
    this.input = input;
  }

  /** 键盘事件快捷：设置跳跃缓冲 + 输入层按下标记（keydown handler 调用） */
  setJumpBuffer(value: number): void {
    this.state.jbuf = value;
    this.state.jumpFresh = true;
  }

  /* ==================== 核心步进 ==================== */

  /**
   * 步进玩家（物理 + 碰撞 + 动画）。
   * 注意：死亡状态下也已处理计时和复活，返回前会 return。
   */
  step(dt: number, mode: PhysicsKey, isLocal: boolean): void {
    // ── 死亡计时 ──
    if (this.state.dead) {
      this.state.deadT -= dt;
      if (this.state.deadT <= 0) {
        this.respawn();
      }
      return;
    }

    // ── 物理步 ──
    // 快照前一帧状态用于边沿检测
    const prevSprint = this.state.wasSpr;
    const wasGrounded = this.state.grounded;
    const prevVy = this.state.velocity.y;
    const wasDead = this.state.dead;

    const signals: FrameSignals = {};
    stepPlayerGeneric(this.state, this.input, dt, isLocal, signals, false);

    // 物理步内坠落死亡（stepPlayerGeneric 只设 dead=true，缺 deadT/事件）
    if (this.state.dead && !wasDead) {
      this.state.deadT = 0.85;
      this.deathCount++;
      this.onEvent?.({ type: 'died', deaths: this.deathCount });
    }

    // ── 纯反馈事件（Game 层处理音效/粒子）──
    // 跳跃起始
    if (isLocal && this.state.velocity.y > 0 && prevVy <= 0) {
      this.onEvent?.({ type: 'jumped' });
    }
    // 冲刺起始
    if (isLocal && this.state.sprint && !prevSprint) {
      this.onEvent?.({ type: 'dashed' });
    }
    // 硬着陆
    if (isLocal && !wasGrounded && this.state.grounded && prevVy < 0) {
      this.onEvent?.({ type: 'landed', impact: -prevVy });
    }
    // 弹簧弹射
    if (isLocal && signals.spring) {
      this.onEvent?.({ type: 'springed' });
    }

    // ── 碰撞检测（事件分发 → CollisionHooks） ──
    updateCollisionSystem(signals as Record<string, boolean>);

    // ── 动画步进 ──
    stepPlayerAnimation(this.state, dt, signals);

    // ── 冲刺曳光 ──
    // 仅在本地玩家时推入曳光点（远程玩家由各自 controller 或 host 模拟处理）
    if (this.state.sprint && isLocal) {
      trail.push({ x: this.state.x - this.state.face * 0.12, y: this.state.y, age: 0 });
    }
  }

  /**
   * 客机专用：维持死亡视觉效果，不推进计时（等待房主权威复活）。
   */
  maintainDeathVisual(): void {
    this.state.deadT = 0.85;
  }

  /* ==================== 生命周期 ==================== */

  /** 死亡 */
  die(): void {
    if (this.state.dead || this.state.inv > 0) return;
    this.state.dead = true;
    this.state.deadT = 0.85;
    this.deathCount++;
    this.onEvent?.({ type: 'died', deaths: this.deathCount });
  }

  /** 复活 */
  respawn(): void {
    this.state.dead = false;
    this.state.x = cpPoint.x;
    this.state.y = cpPoint.y + 1.2;
    this.state.velocity.x = 0;
    this.state.velocity.y = 0;
    this.state.inv = 1.2;
    this.state.plat = null;
    this.state.springT = 0;
    this.state.springAcceleration.x = 0;
    this.state.springAcceleration.y = 0;
    this.state.track = null;
    // 双跳为永久升级，复活保留 extraJumpsMax；但本次滞空期清零，着陆后刷新
    this.state.extraJumps = 0;
    trail.length = 0;
    this.onEvent?.({ type: 'respawned' });
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
    this.state.springT = 0;
    this.state.springAcceleration.x = 0;
    this.state.springAcceleration.y = 0;
    this.state.track = null;
    this.state.sprint = false;
    this.state.extraJumps = 0;
    this.state.extraJumpsMax = 0;
    trail.length = 0;
  }

  /* ==================== 网络权威矫正 ==================== */

  /**
   * 用房主权威位置矫正本地预测（客机用）。
   * 偏差大于 0.5 格时硬矫正位置 + 速度。
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
   * 应用权威死亡状态（客机用）。
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