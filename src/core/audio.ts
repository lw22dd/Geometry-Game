/**
 * 音频系统 —— WebAudio 纯代码合成（无外部音频资源）。
 *
 * 节点图（常驻一次性构建）：
 *   source → [pan] → [filter] → gain(ADSR) → sfxBus ┐
 *                                          bgmBus ┴→ masterGain → compressor → destination
 *
 * 设计要点：
 * ① 分轨：sfx 与 bgm 各一条总线，音量由 core/settings 的三条滑杆独立控制；
 *     master 后接 DynamicsCompressor，防止多音效叠加削波。
 * ② 包络：所有发声走 osc()/noise() 的 ADSR 调度，杜绝硬切造成的爆音。
 * ③ 节流：同名音效最小间隔（gate），避免连续触发（如连跳、密集拾取）糊成一团。
 * ④ 声像：可选 pan（-1..1），2D 横版按事件在屏幕上的左右位置偏移，增强空间感。
 * ⑤ 回收：每个发声节点的 onended 主动 disconnect，长时间游玩不累积节点。
 *
 * 背景音乐调度已拆出至 core/music.ts（本模块只提供底层合成原语与总线）。
 */
import { Settings } from './settings';

/** 全局音频状态（向后兼容：ctx / on / master / noise 字段名保持不变） */
export const AU = {
  ctx: null as AudioContext | null,
  /** 总开关（= !Settings.muted，随设置同步） */
  on: true,
  /** 主总线增益节点 */
  master: null as GainNode | null,
  /** 白噪声缓冲（噪声类音效共用） */
  noise: null as AudioBuffer | null,
  /** 音效总线 */
  sfxBus: null as GainNode | null,
  /** 音乐总线 */
  bgmBus: null as GainNode | null,
  /** 限幅器（防叠加削波） */
  comp: null as DynamicsCompressorNode | null,
};

/** 音效可选参数：空间感与增益缩放 */
export interface SfxOpts {
  /** 声像：-1 全左 / 0 居中 / 1 全右 */
  pan?: number;
  /** 增益缩放（1 = 设计响度） */
  gain?: number;
}

/** 振荡器发声参数 */
export interface OscOpts {
  /** 起始时间（AudioContext 秒），缺省 = 当前时间 */
  at?: number;
  /** 总时长（秒，含 release） */
  dur: number;
  /** 峰值增益（线性，已做响度归一化） */
  vol?: number;
  /** 终止频率（扫掠目标）；不填 = 定频 */
  f1?: number;
  /** 扫掠曲线：exp（默认，指数更自然）/ lin */
  glide?: 'exp' | 'lin';
  /** 低通截止 Hz */
  lp?: number;
  /** 高通截止 Hz */
  hp?: number;
  /** 滤波器 Q */
  q?: number;
  /** 起音（秒） */
  attack?: number;
  /** 衰减（秒） */
  decay?: number;
  /** 延音电平（相对峰值 0..1） */
  sustain?: number;
  /** 释音（秒） */
  release?: number;
  /** 声像 -1..1 */
  pan?: number;
  /** 副振荡器失谐（cents，叠厚用），0 = 不叠加 */
  detune?: number;
  /** 输出总线，缺省 = 音效总线 */
  bus?: GainNode | null;
}

/** 噪声发声参数 */
export interface NoiseOpts {
  at?: number;
  dur: number;
  vol?: number;
  /** 高通截止 Hz（不填则用低通） */
  hp?: number;
  /** 低通截止 Hz */
  lp?: number;
  q?: number;
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
  pan?: number;
  bus?: GainNode | null;
}

/** 音效响度基准（线性峰值；master 与分轨音量在其之上再乘） */
const PEAK = 0.2;

/** 当前音频上下文时间（秒） */
export const now = (): number => (AU.ctx ? AU.ctx.currentTime : 0);

/** 增益平滑写入（20ms 时间常数，避免拖尾咔哒声） */
function rampTo(g: GainNode | null, v: number): void {
  if (!g || !AU.ctx) return;
  const t = AU.ctx.currentTime;
  try {
    g.gain.cancelScheduledValues(t);
    g.gain.setTargetAtTime(v, t, 0.02);
  } catch {
    g.gain.value = v;
  }
}

/** 把设置里的三条音量写回总线 */
export function applyVolumes(): void {
  const d = Settings.data;
  AU.on = !d.muted;
  rampTo(AU.master, d.muted ? 0 : d.master);
  rampTo(AU.sfxBus, d.sfx);
  rampTo(AU.bgmBus, d.bgm);
}

/** 初始化／恢复音频上下文（幂等） */
export function auInit(): void {
  if (AU.ctx) {
    if (AU.ctx.state === 'suspended') void AU.ctx.resume();
    return;
  }
  try {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const c = new C();
    AU.ctx = c;

    // 限幅器：多音效叠加时压住峰值
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 12;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.18;
    comp.connect(c.destination);

    const master = c.createGain();
    master.connect(comp);
    const sfx = c.createGain();
    sfx.connect(master);
    const bgm = c.createGain();
    bgm.connect(master);

    AU.comp = comp;
    AU.master = master;
    AU.sfxBus = sfx;
    AU.bgmBus = bgm;

    // 白噪声 buffer（1s，噪声类音效共用，循环随机偏移取段）
    const n = c.sampleRate | 0;
    const b = c.createBuffer(1, n, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    AU.noise = b;

    applyVolumes();
    // 音量/静音设置变更 → 实时写回总线（返回取消函数，此处无需取消）
    Settings.subscribe(() => applyVolumes());
  } catch {
    // 音频不可用 —— 静默降级（AU.ctx 保持 null，所有发声自动跳过）
  }
}

/* ==================== 底层合成原语 ==================== */

/** 构建「滤波 → 声像」链路，返回链路首节点（gain 之前） */
function buildChain(o: { lp?: number; hp?: number; q?: number; pan?: number }, nodes: AudioNode[]): AudioNode {
  const c = AU.ctx!;
  let head: AudioNode | null = null;
  if (o.lp || o.hp) {
    const f = c.createBiquadFilter();
    f.type = o.lp && o.hp ? 'bandpass' : o.lp ? 'lowpass' : 'highpass';
    f.frequency.value = o.lp ?? o.hp ?? 1000;
    f.Q.value = o.q ?? 0.8;
    nodes.push(f);
    head = f;
  }
  if (o.pan && typeof c.createStereoPanner === 'function') {
    const p = c.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, o.pan));
    nodes.push(p);
    if (head) head.connect(p);
    head = p;
  }
  return head ?? c.createGain();
}

/**
 * 写入 ADSR 包络到增益节点。
 * 保证 attack + decay + release ≤ dur，超长时按比例压缩各段。
 */
function envelope(g: GainNode, t: number, dur: number, peak: number, o: { attack?: number; decay?: number; sustain?: number; release?: number }): void {
  let a = o.attack ?? 0.006;
  const d = o.decay ?? dur * 0.25;
  const r = o.release ?? dur * 0.45;
  const s = o.sustain ?? 0.55;
  const total = a + d + r;
  if (total > dur) {
    const k = dur / total;
    a *= k;
  }
  const dK = d * (total > dur ? dur / total : 1);
  const rK = r * (total > dur ? dur / total : 1);
  const sus = Math.max(0.0001, peak * s);
  const end = t + dur;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(Math.max(0.0002, peak), t + a);
  if (dur > a + dK) {
    g.gain.exponentialRampToValueAtTime(sus, t + a + dK);
    g.gain.setValueAtTime(sus, Math.max(t + a + dK, end - rK));
  }
  g.gain.exponentialRampToValueAtTime(0.0001, end);
}

/** 发声结束后回收全部节点 */
function autoRelease(src: AudioScheduledSourceNode, nodes: AudioNode[]): void {
  src.onended = () => {
    for (const n of nodes) {
      try { n.disconnect(); } catch { /* 已断开 */ }
    }
    src.onended = null;
  };
}

/** 可否发声（上下文就绪 + 未静音） */
function canPlay(): boolean {
  return !!AU.ctx && !Settings.data.muted;
}

/** 振荡器发声（ADSR + 可选扫掠 / 滤波 / 声像 / 副振荡器叠厚） */
export function osc(type: OscillatorType, f0: number, o: OscOpts): void {
  if (!AU.ctx || !canPlay()) return;
  const c = AU.ctx;
  const t = o.at ?? c.currentTime;
  const dur = Math.max(0.02, o.dur);
  const peak = (o.vol ?? PEAK) * (o.bus === AU.bgmBus ? 1 : 1);
  const nodes: AudioNode[] = [];

  const g = c.createGain();
  nodes.push(g);
  envelope(g, t, dur, peak, o);

  const chainHead = buildChain(o, nodes);
  nodes.push(chainHead);
  chainHead.connect(g);
  g.connect(o.bus ?? AU.sfxBus ?? c.destination);

  const o1 = c.createOscillator();
  o1.type = type;
  o1.frequency.setValueAtTime(Math.max(20, f0), t);
  if (o.f1 !== undefined && o.f1 !== f0) {
    const f1 = Math.max(20, o.f1);
    if (o.glide === 'lin') o1.frequency.linearRampToValueAtTime(f1, t + dur);
    else o1.frequency.exponentialRampToValueAtTime(f1, t + dur);
  }
  o1.connect(chainHead);
  nodes.push(o1);

  // 副振荡器（微失谐叠厚）
  let o2: OscillatorNode | null = null;
  if (o.detune) {
    o2 = c.createOscillator();
    o2.type = type;
    o2.frequency.setValueAtTime(Math.max(20, f0), t);
    o2.detune.value = o.detune;
    if (o.f1 !== undefined && o.f1 !== f0) {
      const f1 = Math.max(20, o.f1);
      if (o.glide === 'lin') o2.frequency.linearRampToValueAtTime(f1, t + dur);
      else o2.frequency.exponentialRampToValueAtTime(f1, t + dur);
    }
    o2.connect(chainHead);
    nodes.push(o2);
  }

  const stopAt = t + dur + 0.03;
  o1.start(t);
  o1.stop(stopAt);
  autoRelease(o1, nodes);
  if (o2) { o2.start(t); o2.stop(stopAt); }
}

/** 噪声发声（ADSR + 可选滤波 / 声像） */
export function noise(o: NoiseOpts): void {
  if (!AU.ctx || !canPlay() || !AU.noise) return;
  const c = AU.ctx;
  const t = o.at ?? c.currentTime;
  const dur = Math.max(0.02, o.dur);
  const nodes: AudioNode[] = [];

  const g = c.createGain();
  nodes.push(g);
  envelope(g, t, dur, o.vol ?? PEAK * 0.5, o);

  const chainHead = buildChain(o, nodes);
  nodes.push(chainHead);
  chainHead.connect(g);
  g.connect(o.bus ?? AU.sfxBus ?? c.destination);

  const s = c.createBufferSource();
  s.buffer = AU.noise;
  // 随机起点取段，避免每次噪声完全一致
  const off = Math.random() * Math.max(0, AU.noise.duration - dur - 0.05);
  s.connect(chainHead);
  nodes.push(s);
  s.start(t, off, dur + 0.02);
  autoRelease(s, nodes);
}

/* ==================== 节流 ==================== */

/** 各音效最小触发间隔（秒）；未列出的不节流 */
const MIN_GAP: Record<string, number> = {
  jump: 0.03,
  doubleJump: 0.03,
  land: 0.04,
  orb: 0.03,
  dash: 0.05,
  uiHover: 0.04,
  uiClick: 0.03,
  laserWarn: 0.25,
  shot: 0.09,
  hit: 0.03,
  hurt: 0.05,
  explosion: 0.12,
};

const lastAt = new Map<string, number>();

/** 节流判定：间隔不足返回 true（本次应丢弃） */
function gate(key: string): boolean {
  const gap = MIN_GAP[key];
  if (!gap) return false;
  const t = now();
  const last = lastAt.get(key);
  if (last !== undefined && t - last < gap) return true;
  lastAt.set(key, t);
  return false;
}

/* ==================== 音效表 ==================== */

/** 音效播放时的统一缩放（含调用方 gain 与静音短路） */
function scale(opts?: SfxOpts): number | null {
  if (!canPlay()) return null;
  return opts?.gain ?? 1;
}

/**
 * 音效表 —— 全部为代码合成，无外部资源。
 * 约定：所有方法接受可选 SfxOpts（声像 / 增益），调用方可按屏幕位置传 pan。
 */
export const sfx = {
  /** 跳跃：低频起跳 + 上滑三角波 */
  jump(opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null || gate('jump')) return;
    const t = now();
    osc('triangle', 240, { at: t, dur: 0.15, vol: PEAK * 0.7 * k, f1: 560, attack: 0.004, decay: 0.05, sustain: 0.35, release: 0.09, pan: opts?.pan });
    osc('sine', 120, { at: t, dur: 0.12, vol: PEAK * 0.45 * k, f1: 220, lp: 900, pan: opts?.pan });
  },

  /** 二段跳：比一段跳更高更亮，带失谐叠厚 */
  doubleJump(opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null || gate('doubleJump')) return;
    const t = now();
    osc('triangle', 420, { at: t, dur: 0.16, vol: PEAK * 0.7 * k, f1: 880, attack: 0.004, decay: 0.05, sustain: 0.3, release: 0.1, detune: 9, pan: opts?.pan });
    noise({ at: t, dur: 0.09, vol: PEAK * 0.16 * k, hp: 2600, pan: opts?.pan });
  },

  /** 冲刺：锯齿下扫 + 高通噪声（气流感） */
  dash(opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null || gate('dash')) return;
    const t = now();
    osc('sawtooth', 280, { at: t, dur: 0.28, vol: PEAK * 0.55 * k, f1: 90, lp: 1400, attack: 0.006, decay: 0.1, sustain: 0.45, release: 0.16, pan: opts?.pan });
    noise({ at: t, dur: 0.24, vol: PEAK * 0.28 * k, hp: 1500, attack: 0.008, release: 0.16, pan: opts?.pan });
  },

  /** 落地：闷响 + 冲击噪声，音量随冲击速度 */
  land(v: number, opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null || gate('land')) return;
    const t = now();
    const amp = Math.min(1, v);
    osc('triangle', 140, { at: t, dur: 0.11, vol: PEAK * 0.8 * amp * k, f1: 62, lp: 700, attack: 0.003, decay: 0.04, sustain: 0.25, release: 0.07, pan: opts?.pan });
    if (amp > 0.25) noise({ at: t, dur: 0.08, vol: PEAK * 0.22 * amp * k, lp: 1200, pan: opts?.pan });
  },

  /** 光球收集：清脆双音（880 → 1318.5） */
  orb(opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null || gate('orb')) return;
    const t = now();
    osc('triangle', 880, { at: t, dur: 0.09, vol: PEAK * 0.75 * k, attack: 0.003, decay: 0.03, sustain: 0.4, release: 0.06, pan: opts?.pan });
    osc('triangle', 1318.5, { at: t + 0.06, dur: 0.16, vol: PEAK * 0.6 * k, attack: 0.003, decay: 0.05, sustain: 0.35, release: 0.1, pan: opts?.pan });
  },

  /** 双跳票拾取：上扬双音 */
  jumpBoost(opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null) return;
    const t = now();
    osc('triangle', 660, { at: t, dur: 0.12, vol: PEAK * 0.7 * k, f1: 990, attack: 0.004, decay: 0.05, sustain: 0.4, release: 0.08, pan: opts?.pan });
    osc('triangle', 880, { at: t + 0.07, dur: 0.16, vol: PEAK * 0.6 * k, f1: 1320, detune: 8, pan: opts?.pan });
  },

  /** 钩锁拾取：金属双音（三角 + 方波带低通） */
  hookPickup(opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null) return;
    const t = now();
    osc('triangle', 660, { at: t, dur: 0.1, vol: PEAK * 0.7 * k, attack: 0.003, decay: 0.04, sustain: 0.35, release: 0.06, pan: opts?.pan });
    osc('square', 880, { at: t + 0.05, dur: 0.13, vol: PEAK * 0.32 * k, f1: 660, lp: 2600, pan: opts?.pan });
  },

  /** 护盾拾取：柔和上扬低频双音 */
  shieldPickup(opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null) return;
    const t = now();
    osc('sine', 440, { at: t, dur: 0.15, vol: PEAK * 0.65 * k, f1: 660, detune: 6, pan: opts?.pan });
    osc('sine', 660, { at: t + 0.08, dur: 0.18, vol: PEAK * 0.55 * k, f1: 880, detune: 6, pan: opts?.pan });
  },

  /** 武器拾取：金属上滑双音 + 短噪声（装弹感） */
  weaponPickup(opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null) return;
    const t = now();
    osc('square', 520, { at: t, dur: 0.1, vol: PEAK * 0.4 * k, f1: 780, lp: 2400, attack: 0.003, decay: 0.04, sustain: 0.3, release: 0.06, pan: opts?.pan });
    osc('triangle', 780, { at: t + 0.07, dur: 0.16, vol: PEAK * 0.55 * k, f1: 1170, pan: opts?.pan });
    noise({ at: t, dur: 0.08, vol: PEAK * 0.18 * k, hp: 2000, pan: opts?.pan });
  },

  /** 加速拾取：快速上滑 + 短噪声（冲刺感） */
  speedPickup(opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null) return;
    const t = now();
    osc('sawtooth', 320, { at: t, dur: 0.14, vol: PEAK * 0.5 * k, f1: 980, lp: 2800, pan: opts?.pan });
    osc('square', 520, { at: t + 0.05, dur: 0.14, vol: PEAK * 0.25 * k, f1: 1240, lp: 3200, pan: opts?.pan });
    noise({ at: t, dur: 0.1, vol: PEAK * 0.2 * k, hp: 1600, pan: opts?.pan });
  },

  /** 护盾破碎：快速下坠锯齿 + 碎裂噪声 */
  shieldBreak(opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null) return;
    const t = now();
    osc('sawtooth', 620, { at: t, dur: 0.26, vol: PEAK * 0.6 * k, f1: 120, lp: 1800, attack: 0.003, decay: 0.08, sustain: 0.3, release: 0.16, pan: opts?.pan });
    noise({ at: t, dur: 0.18, vol: PEAK * 0.3 * k, hp: 1100, pan: opts?.pan });
  },

  /** 磁铁拾取：低频磁吸双音 */
  magnet(opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null) return;
    const t = now();
    osc('sine', 200, { at: t, dur: 0.18, vol: PEAK * 0.7 * k, f1: 320, detune: 7, pan: opts?.pan });
    osc('sine', 150, { at: t + 0.08, dur: 0.22, vol: PEAK * 0.5 * k, f1: 220, pan: opts?.pan });
  },

  /** 钩锁发射：快速上滑 + 短噪声（滑索收绳） */
  hook(opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null) return;
    const t = now();
    osc('sawtooth', 160, { at: t, dur: 0.14, vol: PEAK * 0.55 * k, f1: 480, lp: 1600, pan: opts?.pan });
    noise({ at: t, dur: 0.09, vol: PEAK * 0.2 * k, hp: 1800, pan: opts?.pan });
  },

  /** 弹簧弹射：快速上滑 + 噪声（弹性十足） */
  spring(opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null) return;
    const t = now();
    osc('sine', 120, { at: t, dur: 0.24, vol: PEAK * 0.85 * k, f1: 720, attack: 0.004, decay: 0.08, sustain: 0.4, release: 0.14, pan: opts?.pan });
    osc('triangle', 240, { at: t + 0.02, dur: 0.2, vol: PEAK * 0.3 * k, f1: 960, pan: opts?.pan });
    noise({ at: t, dur: 0.12, vol: PEAK * 0.22 * k, hp: 1200, pan: opts?.pan });
  },

  /** 检查点 / 集齐：C-E-G 三音琶音 */
  cp(opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null) return;
    const t = now();
    [523.25, 659.25, 783.99].forEach((f, i) => {
      osc('sine', f, { at: t + i * 0.055, dur: 0.24, vol: PEAK * 0.5 * k, detune: 5, pan: opts?.pan });
    });
  },

  /** 死亡：下坠 + 低频噪声（沉重） */
  die(opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null) return;
    const t = now();
    osc('sawtooth', 200, { at: t, dur: 0.5, vol: PEAK * 0.75 * k, f1: 42, lp: 800, attack: 0.005, decay: 0.15, sustain: 0.4, release: 0.3, pan: opts?.pan });
    noise({ at: t, dur: 0.32, vol: PEAK * 0.35 * k, lp: 500, pan: opts?.pan });
  },

  /** 复活：上行短琶音（回归感） */
  respawn(opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null) return;
    const t = now();
    [392, 523.25, 659.25].forEach((f, i) => {
      osc('triangle', f, { at: t + i * 0.05, dur: 0.2, vol: PEAK * 0.4 * k, attack: 0.004, release: 0.14, pan: opts?.pan });
    });
  },

  /** 通关：五音上行琶音 + 高频闪光 */
  win(opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null) return;
    const t = now();
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      osc('triangle', f, { at: t + i * 0.09, dur: 0.32, vol: PEAK * 0.55 * k, detune: 6, pan: opts?.pan });
    });
    noise({ at: t + 0.36, dur: 0.3, vol: PEAK * 0.14 * k, hp: 4200, release: 0.2, pan: opts?.pan });
  },

  /** 激光预警：短促脉冲（节流 250ms，避免密集刷屏） */
  laserWarn(opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null || gate('laserWarn')) return;
    const t = now();
    osc('square', 1200, { at: t, dur: 0.07, vol: PEAK * 0.22 * k, lp: 3000, attack: 0.002, release: 0.05, pan: opts?.pan });
  },

  /** 界面悬停：极轻的高频点击 */
  uiHover(opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null || gate('uiHover')) return;
    osc('sine', 1400, { at: now(), dur: 0.045, vol: PEAK * 0.1 * k, attack: 0.002, release: 0.035, pan: opts?.pan });
  },

  /** 界面点击：确认音（双音） */
  uiClick(opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null || gate('uiClick')) return;
    const t = now();
    osc('triangle', 740, { at: t, dur: 0.07, vol: PEAK * 0.3 * k, attack: 0.002, release: 0.05, pan: opts?.pan });
    osc('triangle', 1108, { at: t + 0.045, dur: 0.11, vol: PEAK * 0.22 * k, attack: 0.002, release: 0.08, pan: opts?.pan });
  },

  /* ── 战斗音效（S2/S3）── */

  /** AK 开火：短促噪声爆音 + 低频冲击 */
  shot(opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null || gate('shot')) return;
    const t = now();
    noise({ at: t, dur: 0.09, vol: PEAK * 0.55 * k, hp: 900, lp: 3800, attack: 0.002, release: 0.07, pan: opts?.pan });
    osc('square', 180, { at: t, dur: 0.07, vol: PEAK * 0.3 * k, f1: 60, lp: 900, attack: 0.002, release: 0.05, pan: opts?.pan });
  },

  /** 命中反馈：清脆短促高频（hitscan 命中敌人时） */
  hit(opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null || gate('hit')) return;
    const t = now();
    osc('triangle', 1400, { at: t, dur: 0.06, vol: PEAK * 0.35 * k, f1: 600, attack: 0.002, release: 0.04, pan: opts?.pan });
  },

  /** 玩家受击（未死）：下坠中频 + 冲击噪声（比死亡轻，比命中重） */
  hurt(opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null || gate('hurt')) return;
    const t = now();
    osc('sawtooth', 420, { at: t, dur: 0.18, vol: PEAK * 0.55 * k, f1: 100, lp: 1100, attack: 0.003, decay: 0.06, sustain: 0.35, release: 0.12, pan: opts?.pan });
    noise({ at: t, dur: 0.12, vol: PEAK * 0.3 * k, hp: 700, lp: 2400, pan: opts?.pan });
  },

  /** 换弹：金属两段咔嗒 */
  reload(opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null) return;
    const t = now();
    osc('square', 400, { at: t, dur: 0.05, vol: PEAK * 0.22 * k, lp: 2200, attack: 0.002, release: 0.03, pan: opts?.pan });
    osc('square', 520, { at: t + 0.14, dur: 0.05, vol: PEAK * 0.2 * k, lp: 2400, attack: 0.002, release: 0.03, pan: opts?.pan });
  },

  /** 手雷投掷：短促上滑 */
  grenadeThrow(opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null) return;
    const t = now();
    osc('triangle', 240, { at: t, dur: 0.12, vol: PEAK * 0.3 * k, f1: 480, lp: 1600, attack: 0.003, release: 0.08, pan: opts?.pan });
  },

  /** 手雷爆炸：低频重击 + 碎裂噪声 */
  explosion(opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null || gate('explosion')) return;
    const t = now();
    noise({ at: t, dur: 0.4, vol: PEAK * 0.7 * k, lp: 1200, attack: 0.003, decay: 0.15, sustain: 0.3, release: 0.22, pan: opts?.pan });
    osc('sawtooth', 160, { at: t, dur: 0.35, vol: PEAK * 0.5 * k, f1: 38, lp: 500, attack: 0.004, release: 0.3, pan: opts?.pan });
  },

  /** 敌人死亡：急促下坠（与死亡爆裂粒子同步） */
  enemyDie(opts?: SfxOpts): void {
    const k = scale(opts);
    if (k === null) return;
    const t = now();
    osc('square', 420, { at: t, dur: 0.2, vol: PEAK * 0.3 * k, f1: 80, lp: 1400, attack: 0.003, release: 0.16, pan: opts?.pan });
    noise({ at: t, dur: 0.12, vol: PEAK * 0.2 * k, hp: 800, pan: opts?.pan });
  },
};
