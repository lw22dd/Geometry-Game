/**
 * 背景音乐 —— 分层动态 BGM（纯代码合成，无外部资源）。
 *
 * 结构：4 层独立音量总线（bass / arp / pad / perc）汇入 core/audio 的 bgmBus，
 *       由状态机（menu / playing / tension / victory）控制各层的淡入淡出与织体密度。
 * 节奏：128 BPM，16 分音符为 1 步，16 步 = 1 小节，4 小节 = 1 段（和声进行循环）。
 * 调度：以 AudioContext 时钟前瞻 0.16s 排布事件（掉帧不影响节奏稳定性）。
 * 强度：完全自主 —— 乐句能量按小节位置自然起伏（渐强→回落），不读取任何玩家状态，
 *       玩家运动不再影响 BGM 的音色密度与旋律走向。
 * 乐理：A 自然小调，和声进行 i - VI - III - VII（Am - F - C - G）；
 *       bass / pad / arp 按「低音 ~A2 / 中音和声 ~A3 / 高音旋律 ~A4」分区，
 *       pad 为完整三和弦（根 / 三 / 五），arp 走含经过音的琶音轮廓（上行到八度再回落）。
 *
 * 从 core/audio.ts 拆出：本模块只依赖 audio 暴露的合成原语与 bgm 总线。
 */
import { AU, osc, noise, now } from './audio';
import { Settings } from './settings';

/** 音乐状态 */
export type MusicState = 'menu' | 'playing' | 'tension' | 'victory';

/** BPM（驱动全部节奏换算） */
const BPM = 128;
/** 前瞻窗口（秒）：每帧把未来这段时间的事件排完 */
const LOOKAHEAD = 0.16;
/** 每小节步数（16 分音符） */
const STEPS_PER_BAR = 16;
/** 每段小节数（和声进行长度） */
const BARS_PER_PHRASE = 4;

/** 调度时钟（对外暴露，供暂停恢复时重置） */
export const MUS = {
  /** 下一个待调度步的时间（AudioContext 秒） */
  next: 0,
  /** 当前步序号（0..63） */
  step: 0,
  /** 单步时长（秒） */
  dt: 60 / BPM / 4,
};

/** 自然小调音阶级数（半音偏移）：A B C D E F G */
const SCALE = [0, 2, 3, 5, 7, 8, 10];
/**
 * 主音 A2 = 110Hz。
 * 原先取 A1 = 55Hz，低于多数小型扬声器（笔记本/手机）的有效下限，
 * 低音声部实际听不见 → 律动与和声支撑断裂。上移到 A2 后低音才可闻。
 */
const ROOT = 110;

/** 和声进行（音阶级数索引，每段 4 小节）：i - VI - III - VII（Am - F - C - G） */
const CHORDS = [0, 5, 2, 6];

/** 各声部音区参考频率 —— 为每个和弦挑八度，保证声部分层不打架、低音可闻 */
const BASS_REF = 110; // 低音区 ~A2
const PAD_REF = 220;  // 中音区 ~A3（和声层）
const ARP_REF = 440;  // 高音区 ~A4（旋律层）

/** 级数 → 频率（deg 可越界，自动跨八度） */
function note(deg: number, oct: number): number {
  const i = ((deg % 7) + 7) % 7;
  const o = Math.floor(deg / 7) + oct;
  return ROOT * Math.pow(2, (SCALE[i] + o * 12) / 12);
}

/**
 * 为某声部挑选八度：使和弦根音在「半音距离」上最接近该声部参考音。
 * 用半音（对数）而非赫兹比较 —— 线性距离会把结果系统性偏向低八度。
 */
function octFor(deg: number, ref: number): number {
  const refSemi = Math.log2(ref / ROOT) * 12;
  const baseSemi = SCALE[((deg % 7) + 7) % 7];
  let best = 0;
  let bestD = Infinity;
  for (let oct = -2; oct <= 3; oct++) {
    const d = Math.abs(baseSemi + oct * 12 - refSemi);
    if (d < bestD) { bestD = d; best = oct; }
  }
  return best;
}

/**
 * 三和弦（根音 / 三音 / 五音）—— 音阶内三度叠置，
 * 自动得到正确的大/小三性质（i 小三、VI / III / VII 大三）。
 * 原实现只有根音 + 五音，缺三音 → 和声的大小调色彩无法分辨。
 */
function triad(deg: number, oct: number): number[] {
  return [0, 2, 4].map((t) => note(deg + t, oct));
}

/**
 * 琶音旋律轮廓（相对和弦根音的音阶偏移，8 个 8 分音符）：
 * 逐级上行到八度再回落，中间的 6（七音）作经过音 → 有起伏的旋律线；
 * 所有音都在自然小调音阶内，不产生和弦外音。
 */
const ARP_SHAPE = [0, 2, 4, 6, 7, 6, 4, 2];

/* ==================== 层总线 ==================== */

interface Layers {
  bass: GainNode;
  arp: GainNode;
  pad: GainNode;
  perc: GainNode;
}

let layers: Layers | null = null;

/** 各状态下的层音量目标（0..1，与音色自带音量相乘） */
const MIX: Record<MusicState, Record<keyof Layers, number>> = {
  // 菜单：稀疏，只有铺底与稀疏琶音
  menu: { bass: 0.22, arp: 0.30, pad: 0.80, perc: 0.00 },
  // 游戏中：全层
  playing: { bass: 0.85, arp: 0.62, pad: 0.42, perc: 0.80 },
  // 紧张（死亡后）：抽掉打击，留低频与铺底
  tension: { bass: 0.55, arp: 0.16, pad: 0.70, perc: 0.12 },
  // 通关：明亮的上行织体
  victory: { bass: 0.70, arp: 1.00, pad: 0.90, perc: 0.90 },
};

let state: MusicState = 'menu';

/**
 * 乐句能量 —— BGM 完全自主的强度（0.45 → 1.0），
 * 按乐句（4 小节）内部小节位置渐强、段尾回落，形成"推进—呼吸"的循环。
 * 与玩家状态解耦：旋律密度只随乐句自身结构变化。
 */
function phraseEnergy(bar: number): number {
  const b = ((bar % BARS_PER_PHRASE) + BARS_PER_PHRASE) % BARS_PER_PHRASE;
  return 0.45 + 0.55 * (b / (BARS_PER_PHRASE - 1));
}

/** 层总线（惰性构建：首个音乐步前创建，音频不可用时返回 null） */
function ensureLayers(): Layers | null {
  if (layers) return layers;
  const c = AU.ctx;
  if (!c || !AU.bgmBus) return null;
  const mk = (): GainNode => {
    const g = c.createGain();
    g.gain.value = 0;
    g.connect(AU.bgmBus!);
    return g;
  };
  layers = { bass: mk(), arp: mk(), pad: mk(), perc: mk() };
  applyMix(0.8); // 首次淡入（略慢，避免开场突兀）
  return layers;
}

/** 把当前状态的层音量写入总线（指数趋近，tau = 时间常数） */
function applyMix(tau: number): void {
  if (!layers || !AU.ctx) return;
  const mix = MIX[state];
  const t = AU.ctx.currentTime;
  for (const k of ['bass', 'arp', 'pad', 'perc'] as (keyof Layers)[]) {
    try {
      layers[k].gain.setTargetAtTime(mix[k], t, tau);
    } catch {
      layers[k].gain.value = mix[k];
    }
  }
}

/** 切换音乐状态（同状态重复调用无副作用） */
export function setMusicState(s: MusicState): void {
  if (state === s) return;
  state = s;
  if (layers) applyMix(0.35);
}

/** 当前音乐状态 */
export function getMusicState(): MusicState {
  return state;
}

/**
 * 重置调度时钟 —— 暂停/长时间挂起后调用。
 * 不重置会导致 next 远落后于 currentTime，恢复瞬间集中触发一大串事件。
 */
export function resetMusicClock(): void {
  if (!AU.ctx) return;
  MUS.next = AU.ctx.currentTime + 0.05;
}

/* ==================== 各层发音 ==================== */

/**
 * 低音层：和弦根音（八度自动落到可闻低音区 ~87-131Hz），切分节奏 + 第 3 拍八度跳。
 * 低音走根音是标准做法：i-VI-III-VII 的根音进行 A-F-C-G。
 */
function playBass(t: number, bar: number, stepInBar: number): void {
  const root = CHORDS[bar % CHORDS.length];
  const intensity = phraseEnergy(bar);
  const pattern = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];
  if (!pattern[stepInBar]) return;
  // 第 3 拍做八度跳，增加律动（仍在低音区内，不跳出该声部）
  const deg = root + (stepInBar === 8 ? 7 : 0);
  const oct = octFor(root, BASS_REF);
  osc('sawtooth', note(deg, oct), {
    at: t, dur: 0.17, vol: 0.16, lp: 260 + intensity * 260, q: 1.1,
    attack: 0.006, decay: 0.06, sustain: 0.5, release: 0.09,
    detune: 8, bus: layers!.bass,
  });
}

/**
 * 旋律层：8 分音符演奏琶音轮廓（含经过音），落在高音区（~A4，约 349-523Hz），
 * 与中音和声层分离 → 形成「低音 / 和声 / 旋律」三层清晰织体。
 */
function playArp(t: number, bar: number, stepInBar: number): void {
  if (stepInBar % 2 !== 0) return; // 8 分音符：每 2 步一音，一小节 8 个音
  const intensity = phraseEnergy(bar);
  const root = CHORDS[bar % CHORDS.length];
  const oct = octFor(root, ARP_REF);
  const f = note(root + ARP_SHAPE[stepInBar / 2], oct);
  osc('triangle', f, {
    at: t, dur: 0.13, vol: 0.1 + intensity * 0.05, lp: 3200,
    attack: 0.004, decay: 0.04, sustain: 0.25, release: 0.08,
    detune: 6, bus: layers!.arp,
  });
}

/**
 * 和声层：完整三和弦（根 / 三 / 五）长音，落在中音区（~A3，约 175-392Hz）。
 * 三音决定大小调性质 —— 原实现只有根音 + 五音，和声色彩无法分辨。
 */
function playPad(t: number, bar: number): void {
  const root = CHORDS[bar % CHORDS.length];
  const intensity = phraseEnergy(bar);
  const dur = MUS.dt * STEPS_PER_BAR * 0.98;
  const freqs = triad(root, octFor(root, PAD_REF));
  // ① 根音（最厚）
  osc('sawtooth', freqs[0], {
    at: t, dur, vol: 0.055, lp: 620 + intensity * 400,
    attack: dur * 0.28, decay: dur * 0.2, sustain: 0.7, release: dur * 0.4,
    detune: 11, bus: layers!.pad,
  });
  // ② 三音（决定大 / 小性质）
  osc('sawtooth', freqs[1], {
    at: t, dur, vol: 0.045, lp: 900,
    attack: dur * 0.3, decay: dur * 0.2, sustain: 0.65, release: dur * 0.4,
    detune: -9, bus: layers!.pad,
  });
  // ③ 五音（最薄，垫底）
  osc('sawtooth', freqs[2], {
    at: t, dur, vol: 0.035, lp: 1100,
    attack: dur * 0.32, decay: dur * 0.2, sustain: 0.6, release: dur * 0.4,
    detune: 7, bus: layers!.pad,
  });
}

/** 打击层：底鼓 + 闭合镲（音量与出现率随强度） */
function playPerc(t: number, stepInBar: number, bar: number): void {
  const intensity = phraseEnergy(bar);
  // 底鼓：每拍
  if (stepInBar % 4 === 0) {
    osc('sine', 130, {
      at: t, dur: 0.19, vol: 0.22, f1: 44, glide: 'exp',
      attack: 0.002, decay: 0.06, sustain: 0.2, release: 0.12,
      bus: layers!.perc,
    });
  }
  // 闭合镲：8 分反拍；乐句能量越高越密（加入 16 分点缀）
  const onEighth = stepInBar % 2 === 1;
  const onSixteenth = intensity > 0.65 && stepInBar % 2 === 0 && stepInBar % 4 !== 0;
  if (onEighth || onSixteenth) {
    noise({
      at: t, dur: 0.035, vol: (onSixteenth ? 0.03 : 0.05) * (0.5 + intensity * 0.5),
      hp: 7200, attack: 0.001, release: 0.03, bus: layers!.perc,
    });
  }
  // 军鼓：第 3 拍
  if (stepInBar === 8) {
    noise({
      at: t, dur: 0.13, vol: 0.09 * (0.5 + intensity * 0.5), lp: 2600,
      attack: 0.002, decay: 0.05, sustain: 0.2, release: 0.08, bus: layers!.perc,
    });
  }
}

/* ==================== 调度 ==================== */

/**
 * 帧调用的音乐 tick —— 以 AudioContext 时钟前瞻排布事件。
 * 静音或未初始化时只推进时钟，不发声（解除静音后立即接上，不会补播积压事件）。
 */
export function musicTick(): void {
  if (!AU.ctx || !layers) {
    if (!AU.ctx) return;
    if (!ensureLayers()) return;
  }
  const c = AU.ctx!;
  const L = layers!;

  // 静音 / 音量归零：保持时钟同步但不发声
  if (Settings.isSilent('bgm')) {
    if (MUS.next < c.currentTime) MUS.next = c.currentTime + 0.05;
    return;
  }

  // 时钟严重落后（页面切后台 / 长时间挂起）：直接对齐，避免瞬间爆发
  if (MUS.next < c.currentTime - 0.5) MUS.next = c.currentTime + 0.03;

  let guard = 0;
  while (MUS.next < c.currentTime + LOOKAHEAD && guard++ < 64) {
    const step = MUS.step;
    const bar = Math.floor(step / STEPS_PER_BAR) % BARS_PER_PHRASE;
    const stepInBar = step % STEPS_PER_BAR;
    const t = MUS.next;

    playBass(t, bar, stepInBar);
    if (state !== 'tension' || stepInBar % 4 === 0) playArp(t, bar, stepInBar);
    if (stepInBar === 0) playPad(t, bar);
    if (state !== 'menu') playPerc(t, stepInBar, bar);

    MUS.step = (step + 1) % (STEPS_PER_BAR * BARS_PER_PHRASE);
    MUS.next += MUS.dt;
  }
}

/** 供外部查询：音乐是否已在运行（层总线已建立） */
export function musicReady(): boolean {
  return layers !== null;
}

/** 初始化时钟（auInit 之后调用一次即可；未调用时首个 tick 会自对齐） */
export function initMusicClock(): void {
  resetMusicClock();
  void now();
}
