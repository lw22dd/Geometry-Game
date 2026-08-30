/**
 * 密码机系统（第五人格式破译机）—— 靠近 + 持续按 E 破译。
 * 坐标版（本地 / 远端共用；host 权威模拟远端玩家）。
 *
 * 数据模型（单一数据源）：
 *   - 密码机是共享世界对象，权威状态即 ECS 中的 Cipher 实体（progress / done）。
 *   - 房主（host）对本地玩家与所有远端玩家分别调用 updateCipherSystem 累加进度，
 *     是进度的唯一权威；客机本地仅做预测性渲染，最终由 host_state 覆盖。
 *   - 世界统计派生自 ECS：cipherCount()=总数；cipherDoneCount()=已完成数。
 *     （不再用 gs.cipherDone 计数器，避免权威态与计数双写不一致。）
 *
 * 数据流：
 *   - 本地玩家：game/step 的 tick 管线调用 updateCipherSystem(p.x, p.y, interact, dt, false)
 *   - 远端玩家：game/stepRemoteClients 调用 updateCipherSystem(p.x, p.y, interact, dt, true)
 *   - Cipher 状态经 host_state 广播同步给客机。
 */
import { Position, Cipher, qCiphers } from '../../core/ecs';
import { pointInCollider } from '../level';
import { gs } from '../game/gameState';
import { FX } from '../../Prefabs/Fx';
import { spawnParticles } from '../particles';
import { sfx, loopTone, type LoopHandle } from '../../core/audio';
import { netBus } from '../../core/netBus';

/** 破译速度：每秒进度（%） */
const CIPHER_DECODE_SPEED = 18.0;

/** 破译火花节流：每累计 progress 增加 SPARK_STEP 发射一次 */
const SPARK_STEP = 6;
/** 上一发射火花时的进度快照（key = 实体 eid，破译期间自增） */
const lastSpark = new Map<number, number>();

/** 里程碑阈值（%）—— 与绘制层进度条上的刻度（每 25% 一格）对齐 */
const MILESTONES = [25, 50, 75];

/** 破译循环音句柄（key = 实体 eid）：按下 E 起音，松手 / 完成 / 切图收音 */
const decodeLoops = new Map<number, LoopHandle>();
/** 里程碑快照（key = 实体 eid）：已触发到的最高档 0..3 */
const milestones = new Map<number, number>();

/** 停掉某台密码机的破译循环音（幂等） */
function stopDecodeLoop(e: number): void {
  const loop = decodeLoops.get(e);
  if (loop) {
    if (!loop.stopped) loop.stop();
    decodeLoops.delete(e);
  }
}

/** 世界 X 相对玩家 X 的声像（-1..1） */
const panOf = (px: number, tx: number): number => Math.max(-1, Math.min(1, (px - tx) * 0.3));

/** 当前地图密码机总数（世界状态；装配时由 config/level 写入 gs.cipherTotal） */
export function cipherCount(): number {
  return qCiphers().length;
}

/** 已破译密码机数量（世界状态，派生自 ECS 实体，单一数据源） */
export function cipherDoneCount(): number {
  let n = 0;
  for (const e of qCiphers()) if (Cipher.done[e]) n++;
  return n;
}

/**
 * 步进密码机破译。
 * @param tx,ty 玩家坐标
 * @param interact 交互键（E）是否按住
 * @param dt 固定步长（秒）
 * @param isRemote 是否远端玩家（host 模拟；远端不播本地 toast/音效）
 */
export function updateCipherSystem(tx: number, ty: number, interact: boolean, dt: number, isRemote: boolean): void {
  for (const e of qCiphers()) {
    // 本机是否正在破译这台机器（触发区内 + 按住 E + 未完成）
    const decoding = !Cipher.done[e] && interact && pointInCollider(e, tx, ty);
    const pan = panOf(Position.x[e], tx);

    // ── 破译循环音生命周期（仅本地玩家；远端沿用既有约定不播本地音）──
    if (!isRemote) {
      if (decoding) {
        const loop = decodeLoops.get(e);
        if (!loop || loop.stopped) {
          // 起音：低频锯齿 + 低通，随进度升调 / 开滤波 / 提增益
          decodeLoops.set(e, loopTone({ f0: 92, type: 'sawtooth', lp: 520, vol: 0.03, pan, attack: 0.06 }));
          sfx.cipherStart({ pan });
        } else {
          loop.setParam(Cipher.progress[e] / 100);
        }
      } else {
        const loop = decodeLoops.get(e);
        if (loop && !loop.stopped) {
          // 松手 / 走开 → 收音 + 中断音（已完成由完成音接管，不播中断）
          loop.stop();
          decodeLoops.delete(e);
          if (!Cipher.done[e] && Cipher.progress[e] > 0) sfx.cipherAbort({ pan });
        }
      }
    }

    if (!decoding) continue;

    Cipher.progress[e] += CIPHER_DECODE_SPEED * dt;

    // 破译中反馈：周期火花 + 窗内扫描光点 + 机械咔哒（节流），远端不播
    if (!isRemote) {
      const last = lastSpark.get(e) ?? 0;
      if (Cipher.progress[e] - last >= SPARK_STEP) {
        lastSpark.set(e, Cipher.progress[e]);
        spawnParticles(FX.cipherSparks, Position.x[e], Position.y[e] + 1.2);
        spawnParticles(FX.cipherScan, Position.x[e], Position.y[e] + 1.0);
        sfx.cipherTick({ pan });
      }
      // 里程碑：25 / 50 / 75% 各一次，音高随阶段递增
      const reached = milestones.get(e) ?? 0;
      if (reached < MILESTONES.length && Cipher.progress[e] >= MILESTONES[reached]) {
        milestones.set(e, reached + 1);
        sfx.cipherMilestone(reached + 1, { pan });
      }
    }

    // 进度满：破译完成（状态转换纯函数：每实体仅进入一次，done 后由循环顶部跳过）
    if (Cipher.progress[e] >= 100) {
      Cipher.progress[e] = 100;
      Cipher.done[e] = 1;
      const px = Position.x[e], py = Position.y[e];
      spawnParticles(FX.cipherDone, px, py + 1.4);
      spawnParticles(FX.cipherSteam, px, py + 2.0);
      if (!isRemote) {
        stopDecodeLoop(e); // 完成音接管，先收掉持续音
        sfx.cipherDone({ pan });
        gs.toast = '✦ 密码机破译完成！ ' + cipherDoneCount() + '/' + gs.cipherTotal;
        gs.toastT = 2.5;
        netBus.emit({ type: 'game:cipherDone', x: px, y: py });
      }
    }
  }
}

/**
 * 切图 / 重开时清空全部破译运行时状态（实体 eid 失效）：
 * 节流表 + 里程碑表 + **全部常驻循环音**（漏掉会残留持续发声的节点）。
 */
export function resetCipherSpark(): void {
  for (const e of [...decodeLoops.keys()]) stopDecodeLoop(e);
  decodeLoops.clear();
  milestones.clear();
  lastSpark.clear();
}
