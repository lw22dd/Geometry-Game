/**
 * 音频系统 —— WebAudio 合成音效 + 低音循环。
 * 所有音效纯代码合成，无外部音频资源。
 */
export const AU = {
  ctx: null as AudioContext | null,
  on: true,
  master: null as GainNode | null,
  noise: null as AudioBuffer | null,
};

/** 初始化／恢复音频上下文 */
export function auInit(): void {
  if (AU.ctx) return;
  try {
    const C = window.AudioContext || (window as any).webkitAudioContext;
    AU.ctx = new C();
    AU.master = AU.ctx.createGain();
    AU.master.gain.value = 0.4;
    AU.master.connect(AU.ctx.destination);
    // 白噪声 buffer（用于噪声层音效）
    const n = (AU.ctx.sampleRate * 0.6) | 0;
    const b = AU.ctx.createBuffer(1, n, AU.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    AU.noise = b;
    MUS.next = AU.ctx.currentTime + 0.1;
  } catch (e) {
    // 音频不可用 —— 静默降级
  }
}

/** 合成振荡器音调 */
function tone(tp: OscillatorType, f0: number, f1: number | undefined, t: number, dur: number, vol: number, lp?: number): void {
  if (!AU.ctx || !AU.on) return;
  const c = AU.ctx;
  const o = c.createOscillator();
  o.type = tp;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== undefined && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  let last: AudioNode = g;
  if (lp) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lp;
    g.connect(f);
    last = f;
  }
  last.connect(AU.master!);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** 合成噪声 */
function nz(t: number, dur: number, vol: number, hp?: number): void {
  if (!AU.ctx || !AU.on) return;
  const c = AU.ctx;
  const s = c.createBufferSource();
  s.buffer = AU.noise;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const f = c.createBiquadFilter();
  f.type = hp ? 'highpass' : 'lowpass';
  f.frequency.value = hp || 900;
  s.connect(f);
  f.connect(g);
  g.connect(AU.master!);
  s.start(t);
  s.stop(t + dur + 0.02);
}

/** 当前音频上下文时间（秒） */
const now = () => (AU.ctx ? AU.ctx.currentTime : 0);

/** 音效表 */
export const sfx = {
  jump(): void { tone('triangle', 300, 620, now(), 0.13, 0.14); },
  dash(): void { tone('sawtooth', 220, 80, now(), 0.28, 0.09, 700); nz(now(), 0.25, 0.05, 1400); },
  land(v: number): void { tone('triangle', 150, 70, now(), 0.07, Math.min(0.16, v)); },
  orb(): void { tone('triangle', 880, 880, now(), 0.08, 0.16); tone('triangle', 1318.5, 1318.5, now() + 0.07, 0.14, 0.14); },
  /** 双跳光球拾取：上扬双音 */
  jumpBoost(): void { tone('triangle', 660, 990, now(), 0.1, 0.16); tone('triangle', 880, 1320, now() + 0.08, 0.16, 0.14); },
  /** 钩锁拾取：金属双音 */
  hookPickup(): void { tone('triangle', 660, 660, now(), 0.08, 0.15); tone('square', 880, 660, now() + 0.06, 0.12, 0.08, 2500); },
  /** 钩锁发射：快速上滑 + 短噪声（滑索收绳） */
  hook(): void { tone('sawtooth', 160, 480, now(), 0.12, 0.12, 1600); nz(now(), 0.08, 0.05, 1800); },
  /** 弹簧弹射：快速上滑 + 噪声 */
  spring(): void { tone('sine', 120, 720, now(), 0.22, 0.22); nz(now(), 0.12, 0.06, 1200); },
  cp(): void { [523.25, 659.25, 783.99].forEach((f, i) => tone('sine', f, f, now() + i * 0.05, 0.22, 0.11)); },
  die(): void { tone('sawtooth', 200, 42, now(), 0.5, 0.2, 800); nz(now(), 0.3, 0.12, 500); },
  win(): void { [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone('triangle', f, f, now() + i * 0.09, 0.3, 0.13)); },
};

/** 背景低音循环 */
export const MUS = {
  next: 0,
  step: 0,
  dt: 60 / 128 / 4,
};

const BASS = [55, 0, 0, 55, 0, 0, 65.41, 0, 55, 0, 0, 73.42, 0, 0, 82.41, 49];

/** 帧调用的音乐 tick（调度未来事件） */
export function musicTick(): void {
  if (!AU.ctx || !AU.on) return;
  const c = AU.ctx;
  while (MUS.next < c.currentTime + 0.16) {
    const s = MUS.step;
    const t = MUS.next;
    if (s % 4 === 0) tone('sine', 150, 40, t, 0.14, 0.4);
    if (s % 4 === 2) nz(t, 0.04, 0.07, 6500);
    if (BASS[s]) tone('sawtooth', BASS[s], BASS[s], t, 0.15, 0.09, 300);
    MUS.step = (s + 1) % 16;
    MUS.next += MUS.dt;
  }
}