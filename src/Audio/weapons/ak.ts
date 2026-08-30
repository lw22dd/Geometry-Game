/**
 * AK 武器音效 —— 参考 zombie-world 模型：每个声音 = 原语组合（noiseHit / sweep），
 * 脉冲式"峰值起步 + 指数衰减"。

 * 迁移自 core/audio.ts 的 sfx.shot / reload / shotDry / weaponPickupAK（用户手调版），
 * 参数与层次完全保留：弹头激波 → 双正弦低频 → 枪口炸响 → 中频咬合 → 机匣共振 →
 * 枪机循环 → 尾音/回声/抛壳；音量微随机 r() 与时值抖动 j() 保留。
 */
import { gunBus, noiseHit, sweep } from '../utils';

/** 响度基准（与 core/audio.ts 的 PEAK 一致；vol 统一以 PEAK×系数 表达，好对照原表） */
const PK = 0.2;

/** 音量微随机 ±8%（保留原手调风格，让每枪不完全一样） */
const r = (v: number): number => v * (0.92 + Math.random() * 0.16);

/** 时值微抖动（保留原手调风格） */
const j = (ms: number): number => (ms / 1000) * (0.95 + Math.random() * 0.1);

/** 
 * AK 开火（深度拟真版）：
 * 7.62 弹道激波 / 物理气浪推力 / 火药爆燃低频 / 中频"野性"咬合 / 
 * 冲压件共振 / 暴力抛壳 / 沉重闭锁 / 尾音回声 
 */
export function playAKFire(pan?: number): void {
  const B = { pan, out: gunBus() ?? undefined };   // 爆燃层：全走饱和总线

  /* ① 弹头激波：拆成"2ms 全频瞬态 + 高频炸裂余辉"两层 —— 只有一层 hp2600 会又薄又尖 */
  noiseHit(.002, 'highpass', 600, .6, PK * r(1.15), undefined, B);
  noiseHit(.012, 'highpass', r(3000), 1, PK * r(.7), undefined, B);   // r 借用做±8%频率抖动

  /* ② 火药爆燃低频：0.17s/132→44 的纯音是"电影 sub drop"——砍到 ~75ms、终点抬高；
     第二条纯正弦换成低通噪声的"炮压"，去鼓机味 */
  sweep('sine', 210, 58, .075, PK * r(.95), B);
  noiseHit(.05, 'lowpass', 400, .8, PK * r(.55), undefined, B);

  /* ③ 枪口炸响：主段收紧（能量密度更像"炸"），轰鸣保留 */
  noiseHit(.032, 'highpass', 150, 1, PK * r(.6), undefined, B);
  noiseHit(.07, 'highpass', 55, 1, PK * r(.3), undefined, { ...B, delay: .003 });

  /* ③b AK 的"吠叫"：budda-budda 的本体在 ~1kHz，原来 .14 被埋了 ——
     提到主力音量 + 带通噪声补毛边（频率微抖，连发不重样） */
  noiseHit(.03, 'bandpass', r(950), 1.1, PK * r(.5), undefined, B);
  sweep('triangle', 1600, 900, .028, PK * r(.25), B);

  /* ④ 机匣/枪管共振：参数保留（过饱和后泛音更密，更"钢"） */
  sweep('triangle', 690, 620, .05, PK * r(.2), { ...B, delay: .003 });
  sweep('triangle', 1560, 1420, .03, PK * r(.09), { ...B, delay: .002 });

  /* ⑥ 尾音：也进饱和总线 —— 全自动时尾音交叠、被削成连片轰鸣（连发的"吼"） */
  noiseHit(.34, 'highpass', 280, 1, PK * r(.14), undefined, { ...B, delay: .004 });

  /* ⑤ 枪机循环：走干净总线 —— 饱和本质是压缩器，会把小信号抬高糊掉；机构声要"脆" */
  noiseHit(.02, 'highpass', 1900, 1, PK * r(.16), undefined, { delay: j(45), pan });
  sweep('square', 2300, 1500, .014, PK * r(.08), { lp: 5200, delay: j(45), pan });
  noiseHit(.026, 'highpass', 1100, 1, PK * r(.13), undefined, { delay: j(85), pan });
  sweep('square', 1300, 820, .018, PK * r(.07), { lp: 4000, delay: j(85), pan });

  /* 户外离散回声（室内场景删掉这三行） */
  noiseHit(.06, 'highpass', 480, 1, PK * r(.1), undefined, { delay: j(110), pan });
  noiseHit(.06, 'highpass', 650, 1, PK * r(.05), undefined, { delay: j(210), pan });
  noiseHit(.07, 'highpass', 850, 1, PK * r(.03), undefined, { delay: j(330), pan });

  /* 抛壳 tink */
  sweep('triangle', 3100, 2700, .04, PK * .03, { delay: .35, pan });
}


/** AK 换弹（用户手调五段逐层迁移）：弹匣扣释放 / 旧匣脱出 / 新匣拍入+弹簧振铃 / 拉机柄后拉 / 复进闭锁 */
export function playAKReload(pan?: number): void {
  /* ① 弹匣扣释放（短促高频 click） */
  sweep('square', 1200, 800, .035, PK * .2, { lp: 4200, pan });
  /* ② 旧弹匣脱出（干涩下滑：中频落下 + 空涩噪声） */
  sweep('sawtooth', 420, 180, .11, PK * .2, { lp: 1300, delay: .05, pan });
  noiseHit(.1, 'bandpass', 1800, 2, PK * .13, undefined, { delay: .05, pan });
  /* ③ 新弹匣拍入（实芯 clack：中频金属 + 低频实底 + 弹簧振铃） */
  sweep('square', 700, 340, .05, PK * .24, { lp: 3600, delay: .22, pan });
  noiseHit(.07, 'lowpass', 1200, 1, PK * .17, undefined, { delay: .22, pan });
  sweep('sine', 900, 500, .14, PK * .08, { delay: .24, pan });
  /* ④ 拉机柄后拉（滑砺 snick：高频上滑 + 细碎噪声） */
  sweep('sawtooth', 800, 1600, .05, PK * .12, { lp: 4000, delay: .36, pan });
  noiseHit(.055, 'highpass', 3000, 1, PK * .1, undefined, { delay: .36, pan });
  /* ⑤ 复进闭锁（AK 前冲 crunch：中频直落 + 金属脆响 + 机框噪声） */
  sweep('triangle', 500, 160, .08, PK * .3, { lp: 2000, delay: .41, pan });
  sweep('square', 1600, 700, .04, PK * .16, { lp: 5000, delay: .41, pan });
  noiseHit(.09, 'bandpass', 2200, 1.5, PK * .15, undefined, { delay: .41, pan });
}

/** AK 空膛：击锤空击的干涩"咔哒"（随后自动进入换弹） */
export function playAKDryfire(pan?: number): void {
  sweep('square', 900, 520, .035, PK * .18, { lp: 3600, pan });
  noiseHit(.03, 'highpass', 2000, 1, PK * .09, undefined, { pan });
}

/** AK 拾取（用户手调版逐层迁移）：弹匣拍入 / 卡笋锁定 / 拉柄到位 / 厚重确认 */
export function playAKPickup(pan?: number): void {
  /* 1) 弹匣拍入：低频坠感 + 拍击点 */
  sweep('sine', 132, 62, .12, PK * .42, { pan });
  sweep('triangle', 205, 118, .09, PK * .24, { lp: 1400, pan });
  sweep('square', 315, 176, .05, PK * .22, { lp: 2400, pan });
  noiseHit(.045, 'highpass', 1500, 1, PK * .15, undefined, { pan });
  /* 弹匣插入时的短摩擦感 */
  noiseHit(.055, 'highpass', 750, 1, PK * .07, undefined, { delay: .02, pan });
  /* 2) 卡笋/锁定：第二下更短更硬，避免糊成一声 */
  sweep('square', 252, 188, .035, PK * .16, { lp: 2000, delay: .038, pan });
  noiseHit(.03, 'highpass', 2300, 1, PK * .09, undefined, { delay: .038, pan });
  /* 3) 拉柄到位：金属摩擦 + 释放冲击 */
  noiseHit(.075, 'highpass', 2200, 1, PK * .15, undefined, { delay: .082, pan });
  sweep('square', 780, 470, .045, PK * .17, { lp: 3600, delay: .085, pan });
  /* 枪机复进/到位的低频冲击 */
  sweep('sine', 148, 84, .085, PK * .2, { delay: .108, pan });
  sweep('square', 430, 286, .05, PK * .19, { lp: 2600, delay: .112, pan });
  noiseHit(.04, 'highpass', 1300, 1, PK * .11, undefined, { delay: .112, pan });
  /* 4) 上扬确认：重心放在中频，高频只留一点金属泛音 */
  sweep('triangle', 640, 940, .19, PK * .32, { delay: .15, pan });
  sweep('triangle', 960, 1320, .14, PK * .12, { delay: .158, pan });
  sweep('sine', 1720, 1720, .17, PK * .08, { delay: .168, pan });
  noiseHit(.12, 'highpass', 3600, 1, PK * .045, undefined, { delay: .152, pan });
}