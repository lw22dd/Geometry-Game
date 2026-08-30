/**
 * material —— 材质绘制原语层（预制体·纯绘制）。
 *
 * 定位：与 theme.ts 同级的「绘制原语」层。theme 提供霓虹颜色/尺寸令牌与 neonBox（霓虹方盒），
 * material 在其之上提供**材质层**原语：金属板材 / 玻璃面板 / 霓虹灯带 / 铆钉 / 散热格栅 /
 * 接地光晕 / 警示斜纹。密码机、宝箱、武器的建模统一从这里取材质，避免各 draw 函数各自内联一份。
 *
 * 铁律：
 *  ① 颜色一律由 hue 推导（hsla），不引入第二套色彩体系 —— 保证与平台/轨道/弹簧完全同风格；
 *  ② 尺寸/透明度一律复用 T 令牌（topBarH / innerInset / bottomShade* / rim* / glass* / mat*）；
 *  ③ 光晕仍只有三档（glowStatic 12 / glowMovable 14 / glowFiring 16），本层不新增档位；
 *  ④ 按绘制面积做细节层 LOD：小尺寸（HUD 图标、远景道具）自动省略拉丝/格栅/铆钉等噪声细节；
 *  ⑤ 纯绘制：无状态、不读 ECS、不含游戏逻辑（与 Prefabs 层定位一致）。
 *
 * 性能：
 *  - shadowBlur 是 Canvas 2D 最贵的操作之一，本层只有 neonTube 与 metalPanel 的发光描边会设置，
 *    且设置后立即归零，绝不在循环内反复切换；
 *  - 铆钉 / 格栅按「先铺暗底 → 再统一上高光」两趟绘制，把 fillStyle 切换压到常数次。
 */
import { ctx } from '../../core/canvas';
import { T } from './theme';

/* ==================== 通用参数 ==================== */

/** 材质原语通用可选参数（颜色一律由 hue 推导） */
export interface MatOpts {
  /** 主色相（0-360） */
  hue?: number;
  /** 细节层总开关：false = 强制省略全部细节，true = 强制绘制（默认按面积自动） */
  detail?: boolean;
}

/** 细节层面积阈值（px²）：低于此值省略拉丝 / 格栅 / 铆钉等噪声细节 */
const DETAIL_AREA = 260;

/** 是否需要绘制细节层（LOD 判定） */
function wantDetail(w: number, h: number, o?: MatOpts): boolean {
  if (o?.detail !== undefined) return o.detail;
  return w * h >= DETAIL_AREA;
}

/* ==================== 金属板材 ==================== */

export interface MetalOpts extends MatOpts {
  /** 顶部渐变端色（覆盖默认金属底） */
  base?: string;
  /** 底部渐变端色（覆盖默认金属底） */
  baseDark?: string;
  /** 顶部高光条（默认 true） */
  topBar?: boolean;
  /** 发光描边档位：0 / undefined = 不发光（内层面板用），外壳传 T.glowStatic */
  glow?: number;
  /** 倒角宽度（px，默认 T.mat.bevelW；0 = 关闭） */
  bevel?: number;
  /** 内衬线（默认按面积自动） */
  liner?: boolean;
  /** 拉丝纹理（默认按面积自动） */
  brush?: boolean;
  /** 外侧冷光描边（默认 true；嵌套子面板可关掉避免描边叠描边） */
  rim?: boolean;
}

/**
 * 金属板材 —— 密码机机箱 / 宝箱包边 / 枪械机匣 的通用底材。
 * 绘制顺序（与 neonBox 同构，保证风格一致）：
 *   ① 上亮下暗渐变底 → ② 拉丝纹理 → ③ 底部内阴影 → ④ 内衬线
 *   → ⑤ 倒角（左上受光/右下背光）→ ⑥ 顶部高光条 → ⑦ 发光描边 → ⑧ 外侧冷光描边
 */
export function metalPanel(x: number, y: number, w: number, h: number, o: MetalOpts = {}): void {
  if (w <= 0 || h <= 0) return;
  const hue = o.hue ?? 220;
  const detail = wantDetail(w, h, o);

  // ① 底色：上亮下暗（低饱和金属灰，与 neonBox 的深空底色拉开层次但不跳色）
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, o.base ?? `hsla(${hue},26%,24%,.96)`);
  g.addColorStop(1, o.baseDark ?? `hsla(${hue},34%,11%,.97)`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  // ② 拉丝纹理（横向细纹，模拟金属研磨方向）
  if ((o.brush ?? detail) && h > 4) {
    ctx.fillStyle = `hsla(${hue},40%,82%,${T.mat.brushA})`;
    for (let yy = y + T.mat.brushGap * 0.5; yy < y + h - 1; yy += T.mat.brushGap) {
      ctx.fillRect(x + 1, yy, w - 2, 1);
    }
  }

  // ③ 底部内阴影（体积感：与顶部高光呼应，让板材有"厚度"而不是贴纸）
  if (h > 10) {
    const sh = Math.min(h * T.bottomShade, T.bottomShadeMax);
    const sg = ctx.createLinearGradient(0, y + h - sh, 0, y + h);
    sg.addColorStop(0, 'rgba(0,0,0,0)');
    sg.addColorStop(1, `rgba(0,0,0,${T.bottomShadeA})`);
    ctx.fillStyle = sg;
    ctx.fillRect(x + 1, y + h - sh, w - 2, sh);
  }

  // ④ 内衬线（小尺寸自动省略）
  if ((o.liner ?? detail) && w > 8 && h > 8) {
    ctx.strokeStyle = `hsla(${hue},90%,65%,${T.innerAlpha})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + T.innerInset, y + T.innerInset, w - T.innerInset * 2, h - T.innerInset * 2);
  }

  // ⑤ 倒角：左上受光 / 右下背光
  const bv = o.bevel ?? T.mat.bevelW;
  if (bv > 0 && w > 4 && h > 4) {
    ctx.fillStyle = 'rgba(255,255,255,.09)';
    ctx.fillRect(x, y, w, bv);
    ctx.fillRect(x, y, bv, h);
    ctx.fillStyle = 'rgba(0,0,0,.26)';
    ctx.fillRect(x, y + h - bv, w, bv);
    ctx.fillRect(x + w - bv, y, bv, h);
  }

  // ⑥ 顶部高光条
  if (o.topBar !== false) {
    ctx.fillStyle = `hsla(${hue},95%,80%,.9)`;
    ctx.fillRect(x, y, w, T.topBarH);
  }

  // ⑦ 发光描边（仅外壳；内层子面板默认关闭，避免全场发光糊成一片）
  if (o.glow) {
    ctx.shadowColor = `hsla(${hue},100%,58%,.85)`;
    ctx.shadowBlur = o.glow;
    ctx.strokeStyle = `hsla(${hue},95%,68%,.9)`;
    ctx.lineWidth = T.strokeW;
    ctx.strokeRect(x, y, w, h);
    ctx.shadowBlur = 0;
  }

  // ⑧ 外侧冷光描边（从暗背景中"拔"出来）
  if ((o.rim ?? true) && w > 5 && h > 5) {
    ctx.strokeStyle = `hsla(${hue},100%,${T.rimLight}%,${T.rimAlpha})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - T.rimOut, y - T.rimOut, w + T.rimOut * 2, h + T.rimOut * 2);
  }
}

/* ==================== 玻璃面板 ==================== */

export interface GlassOpts extends MatOpts {
  /** 整体透明度缩放（1 = 令牌设计值） */
  alpha?: number;
  /** 镜面高光条（默认按面积自动） */
  spec?: boolean;
}

/**
 * 玻璃观察窗 —— 内腔暗底 + 镜面高光条 + 菲涅尔上下亮边 + 内壁折射细线。
 * 复用 theme 的 glass* 令牌（与轨道玻璃管同一套光学错觉参数）。
 */
export function glassPanel(x: number, y: number, w: number, h: number, o: GlassOpts = {}): void {
  if (w <= 0 || h <= 0) return;
  const hue = o.hue ?? 190;
  const a = o.alpha ?? 1;

  // ① 内腔暗底（比金属更暗，让窗内发光元件"浮"起来）
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, `hsla(${hue},70%,9%,${0.88 * a})`);
  g.addColorStop(1, `hsla(${hue},80%,5%,${0.94 * a})`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  // ② 镜面高光条（顶部斜向反光；复用 streak 令牌的宽/偏参数）
  if ((o.spec ?? (w * h >= DETAIL_AREA)) && h > 6) {
    const sh = Math.max(2, h * T.streakW);
    const sy = y + h * T.streakOff * 0.34;
    const sg = ctx.createLinearGradient(0, sy, 0, sy + sh);
    sg.addColorStop(0, `hsla(${hue},100%,88%,0)`);
    sg.addColorStop(0.5, `hsla(${hue},100%,90%,${T.glassSpec * a})`);
    sg.addColorStop(1, `hsla(${hue},100%,88%,0)`);
    ctx.fillStyle = sg;
    ctx.fillRect(x + 1, sy, w - 2, sh);
  }

  // ③ 菲涅尔亮边（上强下弱）
  ctx.fillStyle = `hsla(${hue},100%,82%,${T.glassEdgeTopA * a})`;
  ctx.fillRect(x, y, w, 1);
  ctx.fillStyle = `hsla(${hue},100%,62%,${T.glassEdgeBotA * a})`;
  ctx.fillRect(x, y + h - 1, w, 1);

  // ④ 内壁折射细线
  ctx.strokeStyle = `hsla(${hue},95%,72%,${T.glassRefrA * a})`;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

/* ==================== 霓虹灯带 ==================== */

export interface TubeOpts extends MatOpts {
  /** 亮芯线宽（px，默认 1.6） */
  lw?: number;
  /** 闭合路径（默认 false） */
  closed?: boolean;
  /** 光晕档位（默认 T.glowStatic） */
  glow?: number;
  /** 亮度缩放（0..1，用于呼吸/呼吸灯调制） */
  bright?: number;
}

/** 折线点（[x, y] 数组；调用方可用字面量数组） */
export type TubePoint = readonly [number, number];

/**
 * 霓虹灯带 —— 沿折线的「外冷晕 + 内亮芯」双描边。
 * 全物品每帧建议只调用 1-2 次（shadowBlur 开销大）。
 */
export function neonTube(pts: readonly TubePoint[], o: TubeOpts = {}): void {
  if (pts.length < 2) return;
  const hue = o.hue ?? 40;
  const lw = o.lw ?? T.mat.tubeW;
  const b = o.bright ?? 1;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (o.closed) ctx.closePath();
  // ① 外冷晕（粗描边 + shadowBlur）
  ctx.shadowColor = `hsla(${hue},100%,55%,${0.9 * b})`;
  ctx.shadowBlur = o.glow ?? T.glowStatic;
  ctx.strokeStyle = `hsla(${hue},100%,58%,${0.34 * b})`;
  ctx.lineWidth = lw * 2.4;
  ctx.stroke();
  ctx.shadowBlur = 0;
  // ② 内亮芯
  ctx.strokeStyle = `hsla(${hue},100%,88%,${0.95 * b})`;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.restore();
}

/* ==================== 铆钉阵列 ==================== */

export interface RivetOpts extends MatOpts {
  /** 距面板边缘内缩（px，默认 T.mat.rivetInset） */
  inset?: number;
  /** 铆钉半径（px，默认 T.mat.rivetR） */
  r?: number;
  /** 每条横向边上的铆钉数（默认 2 = 仅四角） */
  perEdge?: number;
  /** 只画顶边（默认 false = 顶边 + 底边） */
  topOnly?: boolean;
}

/** 铆钉阵列 —— 沿面板上下边缘等距排布（默认 2 颗/边 = 四角） */
export function rivets(x: number, y: number, w: number, h: number, o: RivetOpts = {}): void {
  const r = o.r ?? T.mat.rivetR;
  if (r < 0.9 || w < r * 4 || h < r * 4) return;
  const hue = o.hue ?? 220;
  const inset = Math.min(o.inset ?? T.mat.rivetInset, w / 2 - r, h / 2 - r);
  if (inset < r) return;
  const n = Math.max(2, Math.min(6, o.perEdge ?? 2));

  const px: number[] = [];
  const py: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const cx = x + inset + (w - inset * 2) * t;
    px.push(cx, cx);
    py.push(y + inset, y + h - inset);
    if (o.topOnly) { px.pop(); py.pop(); px.push(cx); py.push(y + inset); }
  }

  // 三趟绘制（暗底 → 上左高光 → 下右暗边），把 fillStyle 切换压到 3 次
  ctx.fillStyle = `hsla(${hue},18%,30%,.95)`;
  for (let i = 0; i < px.length; i++) { ctx.beginPath(); ctx.arc(px[i], py[i], r, 0, 6.283); ctx.fill(); }
  ctx.fillStyle = `hsla(${hue},25%,80%,.7)`;
  for (let i = 0; i < px.length; i++) { ctx.beginPath(); ctx.arc(px[i] - r * 0.22, py[i] - r * 0.22, r * 0.5, 0, 6.283); ctx.fill(); }
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  for (let i = 0; i < px.length; i++) { ctx.beginPath(); ctx.arc(px[i] + r * 0.2, py[i] + r * 0.2, r * 0.42, 0, 6.283); ctx.fill(); }
}

/* ==================== 散热格栅 ==================== */

export interface VentOpts extends MatOpts {
  /** 叶片条数（默认按跨度自动，约每 4px 一条） */
  bars?: number;
  /** 横向排布（默认 false = 竖向叶片） */
  horizontal?: boolean;
  /** 凹槽暗底透明度 */
  slotA?: number;
}

/** 散热格栅 —— 凹槽暗底 + 等距叶片（每片上缘受光），竖向为默认 */
export function vents(x: number, y: number, w: number, h: number, o: VentOpts = {}): void {
  if (w < 5 || h < 5) return;
  const hue = o.hue ?? 220;
  const horiz = o.horizontal ?? false;
  const span = horiz ? h : w;
  const n = Math.max(1, o.bars ?? Math.floor(span / 4));
  if (n < 1) return;

  // ① 凹槽暗底
  ctx.fillStyle = `hsla(${hue},40%,6%,${o.slotA ?? 0.72})`;
  ctx.fillRect(x, y, w, h);

  // ② 叶片几何（一次算好，两趟绘制复用）
  const step = span / n;
  const bar = Math.max(1, step * T.mat.ventDuty);
  const off = (step - bar) * 0.5;
  const bx: number[] = [];
  const by: number[] = [];
  const bw: number[] = [];
  const bh: number[] = [];
  for (let i = 0; i < n; i++) {
    if (horiz) { bx.push(x); by.push(y + i * step + off); bw.push(w); bh.push(bar); }
    else { bx.push(x + i * step + off); by.push(y); bw.push(bar); bh.push(h); }
  }
  // 叶片本体
  ctx.fillStyle = `hsla(${hue},22%,32%,.9)`;
  for (let i = 0; i < n; i++) ctx.fillRect(bx[i], by[i], bw[i], bh[i]);
  // 叶片上缘受光
  ctx.fillStyle = `hsla(${hue},45%,74%,.26)`;
  for (let i = 0; i < n; i++) {
    if (horiz) ctx.fillRect(bx[i], by[i], bw[i], Math.min(1, bar * 0.5));
    else ctx.fillRect(bx[i], by[i], Math.min(1, bar * 0.5), bh[i]);
  }
}

/* ==================== 接地光晕 ==================== */

export interface GlowOpts extends MatOpts {
  /** 纵向半径（默认 = rx * T.mat.glowFlatten，压扁成接地椭圆） */
  ry?: number;
  /** 峰值透明度（默认 0.55） */
  alpha?: number;
}

/**
 * 接地光晕 —— 单次 lighter 混合的压扁椭圆。
 * 密码机 / 宝箱原先各内联了一份，抽到此处统一（DRY）。
 */
export function groundGlow(cx: number, cy: number, rx: number, o: GlowOpts = {}): void {
  if (rx <= 0.5) return;
  const hue = o.hue ?? 40;
  const ry = o.ry ?? rx * T.mat.glowFlatten;
  const a = o.alpha ?? 0.55;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `hsla(${hue},100%,58%,${a})`);
  g.addColorStop(0.55, `hsla(${hue},100%,50%,${a * 0.28})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, 6.283);
  ctx.fill();
  ctx.restore();
}

/* ==================== 警示斜纹 ==================== */

export interface StripeOpts extends MatOpts {
  /** 条纹宽度（px，默认 6） */
  bw?: number;
  /** 峰值透明度（默认 0.2） */
  alpha?: number;
}

/** 45° 警示斜纹（自带 clip，调用方无需额外裁剪） */
export function stripes(x: number, y: number, w: number, h: number, o: StripeOpts = {}): void {
  if (w <= 0 || h <= 0) return;
  const hue = o.hue ?? 40;
  const bw = Math.max(2, o.bw ?? 6);
  const a = o.alpha ?? 0.2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = `hsla(${hue},95%,58%,${a})`;
  const n = Math.ceil((w + h) / bw) + 1;
  for (let i = 0; i < n; i += 2) {
    const px = x - h + i * bw;
    ctx.beginPath();
    ctx.moveTo(px, y + h);
    ctx.lineTo(px + h, y);
    ctx.lineTo(px + h + bw, y);
    ctx.lineTo(px + bw, y + h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/* ==================== 面板内扫描线 ==================== */

/**
 * 玻璃窗内的往复扫描线（破译中反馈）。
 * @param p 0..1 扫描进度（0 = 顶，1 = 底）
 */
export function scanLine(x: number, y: number, w: number, h: number, p: number, o: MatOpts & { alpha?: number } = {}): void {
  if (w <= 0 || h <= 2) return;
  const hue = o.hue ?? 40;
  const a = o.alpha ?? 0.5;
  const sy = y + Math.max(0, Math.min(1, p)) * (h - 2) + 1;
  const g = ctx.createLinearGradient(0, sy - 3, 0, sy + 3);
  g.addColorStop(0, `hsla(${hue},100%,75%,0)`);
  g.addColorStop(0.5, `hsla(${hue},100%,82%,${a})`);
  g.addColorStop(1, `hsla(${hue},100%,75%,0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x + 1, sy - 3, w - 2, 6);
}
