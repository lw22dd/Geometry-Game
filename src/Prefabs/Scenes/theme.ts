/**
 * 霓虹风格统一令牌 + 绘制原语
 * ① 三层结构：深空底色 → 内衬线(内缩3px/1px/低透明) → 发光描边(2px) + 顶部高光(2.2px)
 * ② 关卡几何用位置渐变色(hue2)，可交互道具用固定功能色
 * ③ 光晕只有三档：静态12 / 可动14 / 触发16
 * ④ 动画一律 gs.time 正弦驱动
 */
import { ctx } from '../../core/canvas';

export const T = {
  /* 底色 */
  body: 'rgba(15,11,42,.94)',        // 静态刚体
  bodyMovable: 'rgba(20,14,52,.95)', // 可动刚体（略亮一档，暗示"活物"）
  bodySoft: 'rgba(30,25,60,.95)',    // 次要部件（底座等）
  /* neonBox v2 体积感：底部渐变端色（上亮下暗 → 立体） */
  bodyDark: 'rgba(8,6,26,.96)',
  /* 描边 */
  strokeW: 2,
  innerInset: 3,
  innerAlpha: 0.12,
  /* 顶光 */
  topBarH: 2.2,
  /* 光晕三档 */
  glowStatic: 12,
  glowMovable: 14,
  glowFiring: 16,
  /* 轨迹线 */
  trailDash: [3, 7] as number[],
  trailColor: 'rgba(150,170,255,.25)',
  /* ── 线型元素（轨道 / 轨迹线共用） ── */
  /** 玻璃管外径（世界单位，绘制时 × view.SZ） */
  railW: 1,
  /** 亮芯虚线宽（世界单位） */
  railCoreW: 1.2,
  /** 虚线沿路径流动速度（屏幕 px/s） */
  dashFlow: 14,
  /* ── 玻璃管道（轨道）── */
  /** 折射底色：顶部/中部/底部透明度（玻璃光学错觉：中间薄、边缘厚） */
  glassTop: 0.10,
  glassMid: 0.04,
  glassBot: 0.16,
  /** 顶部镜面反光峰值透明度 */
  glassSpec: 0.30,
  /** 菲涅尔边缘高光透明度 */
  glassFresnel: 0.10,
  /** 内部中空虚线（能量芯）透明度 */
  glassCoreA: 0.30,
  /* ── 玻璃管道 v2（法线偏移结构）── */
  /** 内腔暗色透明度（中空感） */
  glassCavityA: 0.10,
  /** 菲涅尔亮边·上透明度 */
  glassEdgeTopA: 0.80,
  /** 菲涅尔亮边·下透明度 */
  glassEdgeBotA: 0.45,
  /** 内壁折射细线透明度 */
  glassRefrA: 0.15,
  /** 镜面高光条宽（tubeW 倍率） */
  streakW: 0.30,
  /** 高光条偏移（r 倍率） */
  streakOff: 0.55,
  /** 高光条长（tubeW 倍率，分段圆头） */
  streakOn: 2.8,
  /** 高光条间隔（tubeW 倍率） */
  streakGap: 1.8,
  /** 底部焦散细线透明度 */
  causticA: 0.35,
  /** 箍环间距（tubeW 倍率） */
  ringGap: 2,
  /** 箍环半宽（r 倍率） */
  ringLen: 0.22,
  /** 箍环单侧外扩（r 倍率） */
  ringOver: 0.18,
  /** 箍环体透明度 */
  ringBodyA: 0.22,
  /** 箍环亮边透明度 */
  ringEdgeA: 0.60,
  /** 底部支座高（r 倍率） */
  ringLug: 0.55,
  /* ── 动画节奏 ── */
  /** 待机呼吸/脉冲基准角速度（rad/s），全场景待机动画归一到此 */
  breathSpeed: 2.4,
};

/** 霓虹方盒 v2 —— 全场景统一绘制原语（静态平台/移动平台/弹簧顶板…）
 *  ① 底色上亮下暗线性渐变（体积感）→ ② 内衬线 → ③ 发光描边 + 顶光 → ④ 顶面内侧反光 */
export function neonBox(
  x: number, y: number, w: number, h: number, hue: number,
  o: { glow?: number; body?: string; bodyDark?: string } = {},
): void {
  // ① 底色：上亮下暗线性渐变（替代单色填充）
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, o.body ?? T.body);
  g.addColorStop(1, o.bodyDark ?? T.bodyDark);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // ② 内衬线（小尺寸自动省略）
  if (w > 8 && h > 8) {
    ctx.strokeStyle = `hsla(${hue},90%,65%,${T.innerAlpha})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + T.innerInset, y + T.innerInset, w - T.innerInset * 2, h - T.innerInset * 2);
  }
  // ③ 发光描边
  ctx.shadowColor = `hsla(${hue},100%,60%,.85)`;
  ctx.shadowBlur = o.glow ?? T.glowStatic;
  ctx.strokeStyle = `hsla(${hue},95%,66%,.9)`;
  ctx.lineWidth = T.strokeW;
  ctx.strokeRect(x, y, w, h);
  ctx.shadowBlur = 0;
  // ④ 顶部高光
  ctx.fillStyle = `hsla(${hue},100%,78%,.95)`;
  ctx.fillRect(x, y, w, T.topBarH);
  // ⑤ 顶面内侧反光渐变（大块才有，模拟霓虹灯管映在面板上）
  if (h > 16 && w > 12) {
    const rh = Math.min(h * 0.3, 22);
    const rg = ctx.createLinearGradient(0, y + T.topBarH, 0, y + T.topBarH + rh);
    rg.addColorStop(0, `hsla(${hue},100%,78%,.10)`);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x + 2, y + T.topBarH, w - 4, rh);
  }
}