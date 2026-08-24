/**
 * 场景预制体 —— 轨道（玻璃管道）建模。v2
 * 视觉语言（对齐参考图）：
 *  ① 静态光晕外壳（霓虹结构，取代旧实心光晕）
 *  ② 近透明管身 + 内腔暗色 → 中空感
 *  ③ 两侧菲涅尔亮边（上亮下弱）+ 内壁折射细线
 *  ④ 顶部分段镜面高光条 + 端部圆点（呼吸，玻璃不整体闪烁）
 *  ⑤ 底部焦散细线
 *  ⑥ 周期箍环 + 底部梯形支座（参考图套环结构）
 *  ⑦ 内部中空流动虚线（能量芯，沿用旧版）
 * 偏移一律沿折线法线 → 直段/弧段圆柱着色一致；
 * 法线朝向取"趋近光源方向（左上）"投影，竖直段高光落在左侧，全局光照一致。
 * 绘制原语 neonGlassTube 面向路径折线，钩锁 / 滑索等管道类物件可直接复用。
 * 数据从 ECS World 查询（Position + Track），按 segments 采样绘制。
 * 所有数值走 theme.ts 令牌；动画一律 gs.time 正弦，待机节奏 = T.breathSpeed，
 * 多实例按世界坐标错相（与弹簧 r.x*0.6 同惯例）。
 */
import { ctx, VW } from '../../core/canvas';
import { sx, sy, view } from '../../core/camera';
import { world } from '../../core/ecs';
import { Position } from '../../components/physics/Position';
import { Track } from '../../components/physics/Track';
import type { PathSegment } from '../../types/path';
import { gs } from '../../systems/game/gameState';
import { T } from './theme';

/** 功能色：青 = 轨道/滑行路径（与渐变起点 196 近似，靠"细线 + 流动虚线"形态区分） */
const HUE_TRACK = 190;
/** 直轨引导线长度（格） */
const GUIDE_LEN = 12;
/** 主光源方向（指向光源，左上）：决定法线朝向 */
const LIGHT = { x: -0.31, y: -0.95 };

type Pt = { x: number; y: number };

/** 绘制所有轨道实体 */
export function drawTracks(): void {
  for (const e of world.query(Position, Track)) {
    const tr = world.get<Track>(e, Track);

    // 视口裁剪：按整条轨道包围盒（直段 + 弧段）
    const b = trackBounds(tr);
    if (sx(b.maxX) < -80 || sx(b.minX) > VW + 80) continue;

    // 相位按世界坐标错开（多轨道/多实例不同步）
    const ph = tr.entryX * 0.6;

    // 玻璃管道：管身静止，仅顶部镜面呼吸（玻璃不该整体闪烁）
    neonGlassTube(buildTubePoints(tr), HUE_TRACK, {
      pulse: T.glassSpec * (0.7 + 0.3 * Math.sin(gs.time * T.breathSpeed + ph)),
    });

    // ── 入口标记：待机呼吸光环 + 触发档亮核（沿用）──
    const entryX = sx(tr.entryX);
    const entryY = sy(tr.entryY);
    const dotR = 0.16 * view.SZ;
    const breath = 0.10 + 0.08 * Math.sin(gs.time * T.breathSpeed + ph);
    ctx.fillStyle = `hsla(${HUE_TRACK},100%,70%,${breath.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(entryX, entryY, dotR * 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.shadowColor = `hsla(${HUE_TRACK},100%,60%,1)`;
    ctx.shadowBlur = T.glowFiring;
    ctx.fillStyle = `hsla(${HUE_TRACK},100%,92%,.95)`;
    ctx.beginPath();
    ctx.arc(entryX, entryY, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** 引导线 + 各路径段 → 连续屏幕折线（neonGlassTube 的输入） */
function buildTubePoints(tr: Track): Pt[] {
  const pts: Pt[] = [{ x: sx(tr.entryX - GUIDE_LEN), y: sy(tr.entryY) }];
  const push = (x: number, y: number): void => {
    const last = pts[pts.length - 1];
    if (last.x === x && last.y === y) return; // 去除衔接重复点
    pts.push({ x, y });
  };
  push(sx(tr.entryX), sy(tr.entryY));
  for (const seg of tr.segments) {
    if (seg.type === 'line') {
      push(sx(seg.x1), sy(seg.y1));
      push(sx(seg.x2), sy(seg.y2));
    } else {
      const steps = 32;
      for (let i = 0; i <= steps; i++) {
        const t = seg.startAngle + (seg.endAngle - seg.startAngle) * (i / steps);
        push(
          sx(seg.cx + Math.cos(t) * seg.radius),
          sy(seg.cy + Math.sin(t) * seg.radius),
        );
      }
    }
  }
  return pts;
}

/**
 * 玻璃管道绘制原语（面向路径折线，管道类物件通用）。
 * 层次：光晕壳 → 管身/内腔 → 菲涅尔亮边 → 镜面高光条 → 焦散 → 箍环 → 能量芯。
 * 所有结构线沿每点法线偏移（直段/弧段圆柱着色一致）。
 * @param pts 屏幕坐标折线（管道中轴线）
 * @param hue 功能色
 */
export function neonGlassTube(
  pts: Pt[],
  hue: number,
  o: { pulse?: number; tubeW?: number; coreW?: number } = {},
): void {
  if (pts.length < 2) return;
  const tubeW = o.tubeW ?? T.railW * view.SZ;     // 玻璃管外径（px）
  const coreW = o.coreW ?? T.railCoreW * view.SZ; // 内芯虚线宽（px）
  const pulse = o.pulse ?? 0.25;
  const r = tubeW / 2;

  const nrm = computeNormals(pts);
  const cum = cumulative(pts);
  const total = cum[cum.length - 1];

  ctx.save();
  ctx.lineCap = 'butt'; // 出入口平整切面直线（不圆头）
  ctx.lineJoin = 'round';

  /** 沿法线偏移后的折线 path */
  const trace = (off: number): void => {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const x = pts[i].x + nrm[i].x * off;
      const y = pts[i].y + nrm[i].y * off;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  };

  // ① 静态光晕外壳（霓虹结构外壳，取代旧 14px 实心光晕）
  ctx.shadowColor = `hsla(${hue},100%,60%,.85)`;
  ctx.shadowBlur = T.glowStatic;
  ctx.strokeStyle = `hsla(${hue},100%,90%,.18)`;
  ctx.lineWidth = tubeW + 6;
  trace(0);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ② 近透明管身 + 内腔暗色（中空光学感，本体 ≤0.16）
  ctx.strokeStyle = `hsla(${hue},85%,60%,${T.glassMid.toFixed(2)})`;
  ctx.lineWidth = tubeW;
  trace(0);
  ctx.stroke();
  ctx.strokeStyle = `hsla(${hue},90%,34%,${T.glassCavityA.toFixed(2)})`;
  ctx.lineWidth = tubeW * 0.62;
  trace(0);
  ctx.stroke();

  // ③ 菲涅尔亮边（上亮下弱）+ 内壁折射细线
  ctx.strokeStyle = `hsla(${hue},100%,92%,${T.glassEdgeTopA.toFixed(2)})`;
  ctx.lineWidth = 2;
  trace(r - 1);
  ctx.stroke();
  ctx.strokeStyle = `hsla(${hue},100%,88%,${T.glassEdgeBotA.toFixed(2)})`;
  ctx.lineWidth = 1.5;
  trace(-(r - 1));
  ctx.stroke();
  ctx.strokeStyle = `hsla(${hue},90%,80%,${T.glassRefrA.toFixed(2)})`;
  ctx.lineWidth = 1;
  trace(-r * 0.35);
  ctx.stroke();

  // ④ 顶部分段镜面高光条 + 端部圆点（呼吸；round cap → 圆头光条，玻璃不整体闪）
  if (pulse > 0.01) {
    const cycle = (T.streakOn + T.streakGap) * tubeW;
    ctx.lineCap = 'round'; // 仅高光条圆头（管身两端仍为平整切面）
    ctx.strokeStyle = `rgba(255,255,255,${pulse.toFixed(3)})`;
    ctx.lineWidth = tubeW * T.streakW;
    ctx.setLineDash([T.streakOn * tubeW, T.streakGap * tubeW]);
    trace(r * T.streakOff);
    ctx.stroke();
    // 高光条尾端小圆点（参考图的镜面光斑）
    ctx.strokeStyle = `rgba(255,255,255,${(pulse * 0.9).toFixed(3)})`;
    ctx.lineWidth = tubeW * 0.16;
    ctx.setLineDash([0.01, cycle - 0.01]);
    ctx.lineDashOffset = -T.streakOn * tubeW * 1.15;
    trace(r * T.streakOff);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }

  // ⑤ 底部焦散细线
  ctx.strokeStyle = `hsla(${hue},100%,85%,${T.causticA.toFixed(2)})`;
  ctx.lineWidth = 1.5;
  trace(-r * 0.62);
  ctx.stroke();

  // ⑥ 周期箍环 + 底部支座
  const gap = tubeW * T.ringGap;
  for (let s = gap * 0.6; s < total; s += gap) {
    drawCollar(frameAt(pts, cum, s), r, hue);
  }

 

  ctx.restore();
}

/**
 * 箍环：半透明套环 + 亮边 + 底部梯形支座（对应参考图套环结构）。
 * 沿路径法线为"上"/"下"，法线朝向光源 ⇒ 底 = -n。
 */
function drawCollar(
  f: { p: Pt; d: Pt; n: Pt },
  r: number,
  hue: number,
): void {
  const { p, d, n } = f;
  const L = r * T.ringLen * 2;        // 沿管方向宽度
  const R = r * (1 + T.ringOver);     // 外半径
  const hx = (d.x * L) / 2;
  const hy = (d.y * L) / 2;

  // 套环体（butt cap → 垂直于路径的矩形带）
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.shadowColor = `hsla(${hue},100%,60%,.6)`;
  ctx.shadowBlur = T.glowStatic * 0.6;
  ctx.strokeStyle = `hsla(${hue},80%,80%,${T.ringBodyA.toFixed(2)})`;
  ctx.lineWidth = R * 2;
  ctx.beginPath();
  ctx.moveTo(p.x - hx, p.y - hy);
  ctx.lineTo(p.x + hx, p.y + hy);
  ctx.stroke();
  ctx.shadowBlur = 0;

  const line = (x1: number, y1: number, x2: number, y2: number): void => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  // 环两端亮边
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = `hsla(${hue},100%,92%,${T.ringEdgeA.toFixed(2)})`;
  for (const sgn of [1, -1]) {
    const cx = p.x + hx * sgn;
    const cy = p.y + hy * sgn;
    line(cx + n.x * R, cy + n.y * R, cx - n.x * R, cy - n.y * R);
  }
  // 环顶/底外缘亮边（顶亮底弱）
  for (const sgn of [1, -1]) {
    ctx.strokeStyle = `hsla(${hue},100%,92%,${(T.ringEdgeA * (sgn === 1 ? 1 : 0.55)).toFixed(2)})`;
    line(
      p.x - hx + n.x * R * sgn, p.y - hy + n.y * R * sgn,
      p.x + hx + n.x * R * sgn, p.y + hy + n.y * R * sgn,
    );
  }

 


  ctx.restore();
}

// ── 几何工具 ──

/** 法线朝向光源（左上），保证全局光照一致：竖直段高光在左，水平段在上 */
function orient(n: Pt): void {
  if (n.x * LIGHT.x + n.y * LIGHT.y < 0) {
    n.x = -n.x;
    n.y = -n.y;
  }
}

function computeNormals(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const n = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
    orient(n);
    out.push(n);
  }
  return out;
}

function cumulative(pts: Pt[]): number[] {
  const c = [0];
  for (let i = 1; i < pts.length; i++) {
    c.push(c[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  return c;
}

/** 弧长 s 处的点 / 切向 / 法向 */
function frameAt(pts: Pt[], cum: number[], s: number): { p: Pt; d: Pt; n: Pt } {
  let i = 1;
  while (i < cum.length - 1 && cum[i] < s) i++;
  const segLen = cum[i] - cum[i - 1] || 1;
  const t = (s - cum[i - 1]) / segLen;
  const a = pts[i - 1];
  const b = pts[i];
  const d = { x: (b.x - a.x) / segLen, y: (b.y - a.y) / segLen };
  const n = { x: -d.y, y: d.x };
  orient(n);
  return { p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, d, n };
}

/** 整条轨道 + 引导线的世界包围盒（X 方向，用于视口裁剪） */
function trackBounds(tr: Track): { minX: number; maxX: number } {
  let minX = tr.entryX - GUIDE_LEN;
  let maxX = tr.entryX;
  for (const seg of tr.segments) {
    if (seg.type === 'line') {
      minX = Math.min(minX, seg.x1, seg.x2);
      maxX = Math.max(maxX, seg.x1, seg.x2);
    } else {
      minX = Math.min(minX, seg.cx - seg.radius);
      maxX = Math.max(maxX, seg.cx + seg.radius);
    }
  }
  return { minX, maxX };
}