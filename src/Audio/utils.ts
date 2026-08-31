/**
 * Audio/utils —— 基础合成原语（zombie-world 同款模型：单次冲击 + 指数衰减）。
 *
 * 与 core/audio 的分工：
 *  - core/audio 提供总线（AU.sfxBus）、白噪声缓冲（AU.noise）与 ADSR 体系；
 *  - 本模块只 tap AU 的公开状态，**不 import core/audio 的私有函数**（避免循环依赖），
 *    自实现两个面向打击乐 / 机械声的原语。
 *
 * 模型差异（对比 core/audio 的 osc / noise + ADSR）：
 *  - ADSR 分 attack / decay / sustain / release 四段，适合持续音与"起音柔"的音色；
 *  - sweep / noiseHit 是「峰值起步 + 指数衰减」的一次性冲击，天然贴合枪声、弹匣、
 *    机械咔哒这类能量瞬间注入、再按指数自然衰掉的声音。
 *    写法也更紧凑：一个打击 = 一行原语。
 *
 * 约定（沿用项目音频铁律）：
 *  - 每个发声节点 onended 主动 disconnect，长时间游玩不累积节点；
 *  - 支持 delay（相对当前时刻延迟，秒），用于叠放"错开"的机械层次；
 *  - 支持 pan（-1..1）声像，挂 sfxBus，遵循 2D 横版"按事件左右位置"的空间感约定。
 */
import { AU } from '../core/audioState';

/** 可否发声（上下文就绪且未静音；AU.on 由 settings 的 muted 同步） */
function canPlay(): boolean {
  return !!AU.ctx && AU.on;
}

/** 发声结束后回收全部节点（与 core/audio 的 autoRelease 同约定） */
function release(src: AudioScheduledSourceNode, nodes: AudioNode[]): void {
  src.onended = () => {
    for (const n of nodes) {
      try { n.disconnect(); } catch { /* 已断开 */ }
    }
    src.onended = null;
  };
}

/**
 * 扫频冲击：振荡器从 f0 指数扫到 f1，峰值起步 + 指数衰减。
 * （原版签名对齐 zombie-world 的 sweep；额外支持滤波 / pan / delay）
 * @param type  波形：sine / triangle / square / sawtooth
 * @param f0    起始频率（Hz）
 * @param f1    终止频率（Hz）
 * @param dur   时长（秒）
 * @param vol   峰值增益（线性）
 * @param o.lp    低通截止（Hz）—— 可选，给振荡器塑形（如高频方波过 lp 后变"闷响"）
 * @param o.delay 延迟（秒，相对当前时刻），默认 0 —— 用于叠放错开的机械层次
 * @param o.pan   声像 -1..1
 */
export function sweep(
  type: OscillatorType,
  f0: number,
  f1: number,
  dur: number,
  vol: number,
  o: { lp?: number; delay?: number; pan?: number } = {},
): void {
  if (!canPlay()) return;
  const c = AU.ctx!;
  const t = c.currentTime + (o.delay ?? 0);
  const d = Math.max(0.02, dur);
  const peak = Math.max(0.0002, vol);
  const nodes: AudioNode[] = [];

  const g = c.createGain();
  nodes.push(g);
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + d);

  // 链路：src → [lp] → [pan] → gain → bus
  let input: AudioNode = g;
  if (o.lp) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.lp;
    f.Q.value = 0.8;
    nodes.push(f);
    f.connect(input);
    input = f;
  }
  if (o.pan && typeof c.createStereoPanner === 'function') {
    const p = c.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, o.pan));
    nodes.push(p);
    p.connect(input);
    input = p;
  }

  const src = c.createOscillator();
  src.type = type;
  src.frequency.setValueAtTime(Math.max(20, f0), t);
  src.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + d);
  src.connect(input);

  g.connect(AU.sfxBus ?? c.destination);
  nodes.push(src);
  src.start(t);
  src.stop(t + d + 0.02);
  release(src, nodes);
}

/**
 * 噪声打击：滤波噪声一次冲击 + 指数衰减。
 * （原版签名对齐 zombie-world 的 noiseHit：比特位参数直接透传到 BiquadFilter）
 * @param dur    时长（秒）
 * @param ftype  滤波器类型：lowpass / highpass / bandpass ...
 * @param freq   滤波器中心频率（Hz）
 * @param q      滤波器 Q 值（bandpass 的"尖利度"，越大越脆）
 * @param vol    峰值增益（线性）
 * @param fEnd   可选：滤波器频率指数扫到 fEnd（给"闷—亮"或"亮—闷"的运动感）
 * @param o.delay 延迟（秒，相对当前时刻），默认 0
 * @param o.pan   声像 -1..1
 */
export function noiseHit(
  dur: number,
  ftype: BiquadFilterType,
  freq: number,
  q: number,
  vol: number,
  fEnd?: number,
  o: { delay?: number; pan?: number } = {},
): void {
  if (!canPlay() || !AU.noise) return;
  const c = AU.ctx!;
  const t = c.currentTime + (o.delay ?? 0);
  const d = Math.max(0.02, dur);
  const peak = Math.max(0.0002, vol);
  const nodes: AudioNode[] = [];

  const f = c.createBiquadFilter();
  f.type = ftype;
  f.Q.value = Math.max(0, q || 1);
  f.frequency.setValueAtTime(freq, t);
  if (fEnd) f.frequency.exponentialRampToValueAtTime(Math.max(20, fEnd), t + d);
  nodes.push(f);

  let tail: AudioNode = f;
  if (o.pan && typeof c.createStereoPanner === 'function') {
    const p = c.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, o.pan));
    nodes.push(p);
    f.connect(p);
    tail = p;
  }

  const g = c.createGain();
  nodes.push(g);
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + d);
  tail.connect(g);
  g.connect(AU.sfxBus ?? c.destination);

  const src = c.createBufferSource();
  src.buffer = AU.noise;
  // 随机起点取段，避免每次噪声完全一致
  const off = Math.random() * Math.max(0, AU.noise.duration - d - 0.05);
  src.connect(f);
  nodes.push(src);
  src.start(t, off, d + 0.02);
  release(src, nodes);
}

/* ---------------- 枪声饱和总线 ---------------- */

/** tanh 软饱和曲线：k 控制膝的软硬；模块级缓存，所有 WaveShaper 共用 */
const SAT_CURVE = (() => {
  const n = 2048, k = 2.2, norm = Math.tanh(k);
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = Math.tanh(k * ((i / (n - 1)) * 2 - 1)) / norm;
  return c;
})();

let gunSatBus: GainNode | null = null;

/**
 * 枪声总线：各爆燃层先在这里线性叠加 → 故意推过载 → tanh 软削波 → 回电平。
 * 懒建一次全游戏共用：连发时后一枪的爆音会"碾过"前一枪的尾音，与过载录音一致。
 * 注意：若 AU.ctx 会销毁重建，需同步置空 gunSatBus。
 */
export function gunBus(): AudioNode | null {
  if (!canPlay()) return null;
  if (gunSatBus) return gunSatBus;
  const c = AU.ctx!;
  const drive = c.createGain(); drive.gain.value = 2.0;   // 推入饱和区的深度
  const sat = c.createWaveShaper(); sat.curve = SAT_CURVE; sat.oversample = '4x';
  const trim = c.createGain(); trim.gain.value = 0.5;     // 削波后的总响度闸
  drive.connect(sat); sat.connect(trim); trim.connect(AU.sfxBus ?? c.destination);
  return (gunSatBus = drive);
}
