/**
 * 调度中枢 —— 编排各系统，管理主循环（帧循环 / step / 表现层步进 / 音乐调度）。
 *
 * 上帝模块已拆分（S 类拆分）：
 *   lifecycle.ts    进场流程（applyLevel / startGame / startMultiplayerGame）
 *   host.ts         房主权威模拟 + 玩家交互集线（stepHostClients / getLocalInputKeys / runPlayerInteractions）
 *   render.ts       渲染管线（render / snapshotRenderPrev）
 *   netEvents.ts    客机网络事件绑定（wireNetEvents）
 *   playerEvents.ts 玩家事件订阅（wirePlayerEvents）
 *   input.ts        输入回调（handleKeyDown / handleWheel）
 *
 * 联机模式：房主跑完整物理 + 广播权威状态；客机发输入 + 本地预测 + 矫正。
 */
import { gs } from './gameState';
import { playerController, stepPlayer, getPlayerScratch, buildSolids } from '../player';
import { getPlayerEid } from '../player/playerEntity';
import { tickPlayer } from '../player/tick';
import { stepParticles, trail } from '../particles';
import { updateMotion, updateLaserTimer, updateSpringPads } from '../level';
import { stepAuraSystem } from '../level/AuraSystem';
import { stepAnimation } from '../animation';
import { stepMotes, emitItemAmbient } from '../../Prefabs/Scenes';
import { pfxPerf } from '../postfx';
import { tickFPS } from '../ui/dev';
import { room, isHost, inSession } from '../../net/room';
import { net } from '../../net';
import { remotes } from '../player/remote';
import { stepEnemies, stepEnemyRocks } from '../enemy';
import { stepHealthInv, stepProjectiles, stepTracers } from '../combat';
import { stepChests } from '../interactions';
import { clamp } from '../../core/math';
import { musicTick, setMusicState } from '../../core/music';
import { initCollisionHooks } from '../interactions';
import { wireTriggerSystem } from '../effects/TriggerSystem';
import type { FrameSignals, PlayerState } from '../../types';
import { mouse } from '../../core/mouse';
import { getLocalInputKeys, stepHostClients, runPlayerInteractions } from './host';
import { render, snapshotRenderPrev } from './render';
import { wireNetEvents } from './netEvents';
import { wirePlayerEvents } from './playerEvents';
import { cpPoint } from '../../config';

/* ==================== 主循环 ==================== */

let last = performance.now();
let acc = 0;
const FDT = 1 / 120;

/**
 * 表现层步进 —— 场景实体动画 FSM + 粒子 / 曳光 / 浮尘 / 光球环境光尘。
 *
 * 与玩法逻辑分开的原因：命中停顿（hitstop）只冻结物理与玩法，
 * 表现层必须继续推进 —— 否则死亡爆裂生成的粒子会在生成点被定格成
 * 一团静止碎块（FX.death 无散布偏移，生成时坐标重合），完全看不出"爆开"。
 * gs.time 不参与任何物理计算（systems/player 内零引用），停顿期可照常推进。
 */
function stepPresentation(dt: number): void {
  // 实体动画 FSM 步进（场景道具 / 未来敌人 / NPC；输出在渲染帧由绘制层实时求值）
  stepAnimation(dt);
  // 粒子 + 曳光
  stepParticles(dt);
  stepMotes(dt);          // 美术升级 3：前景浮尘步进
  emitItemAmbient(dt);    // 美术升级 5：光球环境光尘
}

/** 逐帧步进（固定时间步长 1/120s） */
function step(dt: number): void {
  // 1. 时间
  gs.time += dt;

  // 捕获鼠标按下沿（即使暂停/菜单中也推进，避免暂停点击恢复后误触）
  const hookEdge = mouse.down && !mouse.prevDown;
  mouse.prevDown = mouse.down;

  // 2. 关卡级系统（移动平台运动 / 弹簧动画 / 激光计时 / 宝箱状态机）
  updateMotion();
  updateSpringPads(dt);
  updateLaserTimer();
  stepChests(dt);

  // 2.5 光环系统（范围持续场，扩展占位；当前无地图光环 → 查询为空，零成本）
  // 本地 + 远端玩家统一进同一光环场（房主对远端同判定）
  const auraPlayers = [{ id: room.playerId, state: playerController.getState() }];
  for (const [id, rp] of remotes) {
    if (!rp.dead) auraPlayers.push({ id, state: rp });
  }
  stepAuraSystem(dt, auraPlayers);

  // 2.6 实体生命无敌计时（持续接触伤害的结算节拍；玩家 inv 衰减由物理层负责）。
  // 当前无敌人实体 → 查询为空，零成本。
  stepHealthInv(dt);

  // 3-4. 表现层（实体动画 FSM + 粒子 / 曳光 / 浮尘）
  stepPresentation(dt);

  // 5. Toast 衰减
  if (gs.toastT > 0) gs.toastT -= dt;

  // 6. 暂停/菜单/大厅中不执行游戏逻辑
  if (gs.screen !== 'playing') return;

  // 7. 游戏计时 & 7.5 碰撞几何（问题 7：每物理步仅重建一次；物理入口 solidsPrebuilt=true 跳过）
  gs.gt += dt;
  buildSolids();

  // 8-10. A 路线：ECS 组件真源 → scratch → 共享物理引擎 → 渲染只读视图 → 统一 tick 管线。
  //      死亡实体物理冻结（stepPlayer 内部仅推进 deadT）；每物理步恰好一次装载/一次写回。
  const signals: FrameSignals = {};
  const inputKeys = getLocalInputKeys();
  // 上一帧镜像 = 上一帧步后状态（边沿检测基准）。
  // 注意：必须在 stepPlayer/mirrorFrom 之前存成标量快照 —— getState() 返回视图对象
  // 引用，mirrorFrom 会原地改写它；若这里存引用，prev 会拿到"本帧"值，边沿全部失效
  // （坠落死亡不触发 onDiedEdge → 摔悬崖无死亡表现）。
  const pvPrev = playerController.getState();
  const prevDead = pvPrev.dead;
  const prevVy = pvPrev.velocity.y;
  const prevSprint = pvPrev.wasSpr;
  const prevGrounded = pvPrev.grounded;

  stepPlayer(getPlayerEid(), inputKeys, dt, true, signals, true);
  playerController.mirrorFrom(getPlayerScratch()); // scratch → 视图（零分配）
  const pState = playerController.getState(); // 渲染只读视图 = tick 工作副本

  if (inSession() && !isHost()) {
    // 客机模式：发送输入 + 本地预测（随后被权威状态矫正）
    net.sendInput(inputKeys);
  }

  // 统一玩家 tick 管线（死亡登记/倒计时/交互=碰撞系统/钩锁/buff/动画/曳光/写回/仲裁）
  tickPlayer(pState, getPlayerEid(), inputKeys, signals, {
    dt,
    isLocal: true,
    hookEdge,
    aim: { x: inputKeys.aimX, y: inputKeys.aimY },
    sfx: true,
    prev: { dead: prevDead, vy: prevVy, sprint: prevSprint, grounded: prevGrounded },
    deathMode: inSession() && !isHost() ? 'wait' : 'countdown',
    spawnX: cpPoint.x,
    spawnY: cpPoint.y,
    interactions: (p, _input, sig) => {
      // 本地交互步：碰撞系统（危险/收集/检查点/终点）+ 密码机 + 宝箱（与远端共用 runPlayerInteractions）
      runPlayerInteractions(p, sig, _input.interact, dt);
    },
    onDiedEdge: () => {
      playerController.emitEvent({ type: 'player:died', deaths: playerController.registerDeath() });
    },
    onRespawn: () => {
      trail.length = 0;
      playerController.emitEvent({ type: 'player:respawned' });
    },
    onBuffExpired: (source) => {
      if (source === 'shield') { gs.toast = '护盾失效'; gs.toastT = 2; }
      if (source === 'speed') { gs.toast = '加速失效'; gs.toastT = 2; }
    },
    onEvent: (e) => {
      playerController.emitEvent(e);
    },
  });

  // 9.5 敌人步进（S3）：只在房主/单机进程模拟，客机为接收事件的木偶。
  //     追击目标 = 本地玩家 + 房主模拟的远端玩家（存活）。
  if (room.role !== 'client') {
    const enemyPlayers: { state: PlayerState }[] = [{ state: playerController.getState() }];
    for (const [, rp] of remotes) {
      if (!rp.dead) enemyPlayers.push({ state: rp });
    }
    stepEnemies(dt, enemyPlayers);
    // 敌人石头（大猩猩投石）步进：抛物线 + 命中/落地判定
    stepEnemyRocks(dt, enemyPlayers);
    // 关键：玩家 hp 真源在 ECS PlayerControl（每物理步由 stepPlayer 装载派生视图）。
    // 敌人/自爆的伤害发生在 tickPlayer 写回（storePlayerComponents）之后，
    // 只改了渲染视图的 hp，若不写回，下一物理步会装载到旧血量把血"补回来"
    // （表现为大猩猩砸地/投石"扣血后立刻回满"，walker 因伤害在 tickPlayer 内部而无此坑）。
    // 这里把扣血后的视图一次性写回组件，保证伤害持久。
    playerController.flush();
  }

  // 9.6 抛体（手雷）步进：抛物线 + 引信 + 爆炸圆判定（放在 buildSolids 与
  //     敌人步进之后，命中检测用本帧世界几何）。敌人该进程内判定伤害；
  stepProjectiles(dt);
  stepTracers(dt);

  // 10. 房主模式：模拟所有客机物理 + 广播状态
  if (isHost()) {
    stepHostClients(dt);
  }
}

/** 音乐状态同步 —— 只按「场景级」状态切换（菜单 / 通关 / 死亡 / 游戏中）。 */
function syncMusic(): void {
  if (gs.screen !== 'playing') {
    setMusicState('menu');
    return;
  }
  if (gs.win) {
    setMusicState('victory');
    return;
  }
  setMusicState(playerController.getState().dead ? 'tension' : 'playing');
}

/** 帧回调 */
function frame(nowMs: number): void {
  requestAnimationFrame(frame);
  tickFPS(nowMs);
  pfxPerf(nowMs - last); // 后期特效自适应降级（美术升级 1）
  let dt = (nowMs - last) / 1000;
  last = nowMs;
  if (dt > 0.06) dt = 0.06;
  acc += dt;
  if (acc > 0.2) acc = 0.2;
  // 命中停顿：本帧冻结物理推进（不消耗 acc），只跑渲染 ——
  // 物理始终由整数个 FDT 步推进，确定性不受影响。
  // 联机房主会话下不启用，避免影响权威模拟与客机预测。
  if (gs.hitstop > 0 && !(inSession() && isHost())) {
    gs.hitstop = Math.max(0, gs.hitstop - dt);
    // 只冻结「物理与玩法逻辑」；表现层照常推进，
    // 否则死亡爆裂 / 破盾火花会在生成瞬间被定格，看不出爆开。
    gs.time += dt;
    stepPresentation(dt);
  } else {
    gs.hitstop = 0;
    // 问题 8：物理批步前快照（渲染 alpha 插值基准；仅表现层，不影响确定性物理）
    snapshotRenderPrev();
    let n = 0;
    while (acc >= FDT && n < 10) { step(FDT); acc -= FDT; n++; }
  }
  // 音乐调度（前瞻基于 AudioContext 时钟，掉帧不影响节奏）
  syncMusic();
  musicTick();
  render(dt, clamp(acc / FDT, 0, 1));
}

/** 启动主循环 */
export function startLoop(): void {
  wireNetEvents();
  // 注册碰撞事件处理器（幂等）
  initCollisionHooks();
  // 问题 4：玩家事件经 netBus 统一通道（wirePlayerEvents=gs/sfx/粒子；TriggerSystem=fireTriggers）
  wireTriggerSystem();
  wirePlayerEvents();
  requestAnimationFrame(frame);
}

// 对外 re-export（拆分后保持原 index.ts 的公共接口不变）：
export { applyLevel, startGame, startMultiplayerGame } from './lifecycle';
export { handleKeyDown, handleWheel } from './input';