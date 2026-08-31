/**
 * 统一玩家 tick 管线（问题 2）—— 本地 / 远端共用同一入口，消灭 stepRemoteClients
 * 手抄的平行管线；差异由 ctx 回调注入。
 *
 * 顺序（与旧 controller.step 本地路径逐位一致）：
 *   stepPlayer（装载组件 → 共享物理引擎；死亡实体物理冻结，仅推进 deadT）
 *     → 坠落死亡边沿登记（ctx.onDiedEdge）
 *     → 死亡分支（wait=客机维持死亡视觉 / countdown=倒计时复活，早退不跑后续系统）
 *     → 交互（ctx.interactions：危险/收集/检查点/道具；碰撞致死在交互内由各自处理器结算）
 *     → 钩锁（stepActiveItem）→ buff 计时/reconcile → 动画 → 曳光(仅本地)
 *     → 控制权仲裁 + 写回组件（一次）
 *
 * 事件：二段跳/冲刺/着陆/弹射等反馈事件经 ctx.onEvent 派发（本地=wirePlayerEvents，
 * 远端=房主特效/广播，无特效则为空操作）。
 *
 * 注意：调用方在进入前完成「装载到工作副本」——
 *   本地：stepPlayer → mirrorFrom(scratch) 到渲染视图；
 *   远端：stepPlayer → mirrorPlayerState(rp, scratch)。
 * 死亡分支中的复活点来自 ctx.spawnX/Y（本地=cpPoint，远端=rp.cpX/cpY）。
 */
import type { FrameSignals, InputKeys, PlayerEvent, PlayerState } from '../../types';
import { DEATH_VISUAL_T, RESPAWN_OFFSET_Y, RESPAWN_INV } from '../../config/combat';
import { stepActiveItem } from '../items/activeItem';
import { stepWeapon } from '../combat';
import { stepBuffTimers } from '../effects';
import { reconcileShield, reconcileSpeed, itemDefBySource } from '../items/backpack';
import { stepPlayerAnimation } from '../../Prefabs/Player';
import { stepControlArbiter } from './controlArbiter';
import { storePlayerComponents } from './playerEntity';
import { trail } from '../particles';

/** tickPlayer 反馈事件（PlayerEvent 子集；生命周期类 player:died/player:respawned 由 onDiedEdge/onRespawn 负责） */
export type TickPlayerEvent =
  | { type: 'player:doubleJumped' }
  | { type: 'player:jumped' }
  | { type: 'player:dashed' }
  | { type: 'player:landed'; impact: number }
  | { type: 'player:springed' };

export interface TickPlayerCtx {
  dt: number;
  isLocal: boolean;
  hookEdge: boolean;
  aim: { x: number; y: number };
  sfx: boolean;
  /** 上一帧步后状态（边沿检测基准；本地=镜像前视图，远端=步骤前 rp） */
  prev: { dead: boolean; vy: number; sprint: boolean; grounded: boolean };
  /** 死亡处理方式：'wait'=客机维持死亡视觉等权威；'countdown'=倒计时复活 */
  deathMode: 'wait' | 'countdown';
  /** 复活点（countdown 模式用；尸位常态 Y 偏移 +1.2 由管线处理） */
  spawnX: number;
  spawnY: number;
  /** 交互步：危险/收集/检查点/道具（本地=碰撞系统；远端=碰撞版 sim + 检查点坐标交互） */
  interactions: (p: PlayerState, input: InputKeys, signals: FrameSignals) => void;
  /** 本帧坠落死亡边沿（p.deadT 已置 0.85；本地=登记死亡+事件，远端=无操作[特效在调用方]） */
  onDiedEdge: (p: PlayerState) => void;
  /** 复活（p 已复位到复活点；本地=清曳光+respawned 事件，远端=无操作） */
  onRespawn: (p: PlayerState) => void;
  /** buff 到期 UX（本地=失效 toast；远端=无操作） */
  onBuffExpired: (source: string) => void;
  /** 反馈事件（本地=wirePlayerEvents；远端=无操作） */
  onEvent: (e: TickPlayerEvent) => void;
}

/**
 * 统一玩家 tick 管线。前置：物理已装载到工作副本 p（本地=视图，远端=rp），
 * signals 由调用方创建并传入（stepPlayer 已消费填充）。
 */
export function tickPlayer(
  p: PlayerState,
  eid: number,
  input: InputKeys,
  signals: FrameSignals,
  ctx: TickPlayerCtx,
): void {
  const wasDead = ctx.prev.dead;
  const wasGrounded = ctx.prev.grounded;
  const prevVy = ctx.prev.vy;
  const prevSprint = ctx.prev.sprint;

  // ── 本帧物理内坠落死亡边沿：登记死亡（死亡帧仍走完整管线，与旧 controller.step 一致）──
  let diedThisFrame = false;
  if (p.dead && !wasDead) {
    p.deadT = DEATH_VISUAL_T;
    ctx.onDiedEdge(p);
    diedThisFrame = true;
  }

  // ── 死亡分支（上帧已死）：物理冻结（stepPlayer 内已推进 deadT），不跑后续系统 ──
  if (p.dead && !diedThisFrame) {
    if (ctx.deathMode === 'wait') {
      // 客机：维持死亡视觉，等待房主权威复活
      p.deadT = DEATH_VISUAL_T;
    } else if (p.deadT <= 0) {
      // 房主/单机/远端：到点复活
      p.dead = false;
      p.x = ctx.spawnX;
      p.y = ctx.spawnY + RESPAWN_OFFSET_Y;
      p.velocity.x = 0;
      p.velocity.y = 0;
      p.inv = RESPAWN_INV;
      p.plat = null;
      p.track = null;
      p.impulses.length = 0;
      p.extraJumps = 0;
      // 复活满血（死亡的唯一恢复点在此；与位置/曳光复位同批，保证状态一致）
      p.hp = p.maxHp;
      ctx.onRespawn(p);
    }
    stepControlArbiter(p, eid);
    storePlayerComponents(eid, p);
    return;
  }

  // ── 反馈事件（边沿；与原 controller.step 内条件一致：仅本地）──
  if (ctx.isLocal) {
    if (signals.doubleJump) ctx.onEvent({ type: 'player:doubleJumped' });
    if (p.velocity.y > 0 && prevVy <= 0) ctx.onEvent({ type: 'player:jumped' });
    if (p.sprint && !prevSprint) ctx.onEvent({ type: 'player:dashed' });
    if (!wasGrounded && p.grounded && prevVy < 0) {
      ctx.onEvent({ type: 'player:landed', impact: -prevVy });
    }
    if (signals.spring) ctx.onEvent({ type: 'player:springed' });
  }

  // ── 交互：危险/收集/检查点/道具（碰撞致死的登记由各自处理器负责：本地=die()，远端=sim onKill）──
  ctx.interactions(p, input, signals);

  // ── 钩锁（主动道具）──
  stepActiveItem(p, {
    dt: ctx.dt,
    hookEdge: ctx.hookEdge,
    aim: ctx.aim,
    sfx: ctx.sfx,
  });

  // ── 武器（S2：AK 射线 / 手雷；本地 + 房主模拟远端共用同一步进）──
  stepWeapon(p, input, { dt: ctx.dt, aim: ctx.aim, isLocal: ctx.isLocal });

  // ── 限时 buff 计时 + 一致性收尾 ──
  const expired = stepBuffTimers(p, ctx.dt);
  for (const ex of expired) {
    // 问题 12：经 itemDefBySource 类型安全窄化（未知来源 = undefined），无断言
    itemDefBySource(ex.source)?.onExpire?.(p);
    ctx.onBuffExpired(ex.source);
  }
  reconcileShield(p);
  reconcileSpeed(p);

  // ── 动画步进 ──
  stepPlayerAnimation(p, ctx.dt, signals);

  // ── 冲刺曳光（仅本地玩家）──
  if (ctx.isLocal && p.sprint) {
    trail.push({ x: p.x - p.face * 0.12, y: p.y, age: 0 });
  }

  // ── 控制权仲裁 + 写回组件（本地=视图，远端=rp，两者均指向实体）──
  stepControlArbiter(p, eid);
  storePlayerComponents(eid, p);
}