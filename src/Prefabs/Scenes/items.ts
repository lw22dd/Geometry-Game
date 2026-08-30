/**
 * 场景预制体 —— 收集品 / 终点建模。
 * 光球、检查点、NOVA 星、双跳票、钩锁道具。
 * 数据从新 ECS 查询（Position + Collider + Collectible/RespawnPoint/Goal + Renderable + Animator + 标签组件）。
 */
import { ctx, VW, VH } from '../../core/canvas';
import { sx, sy, view } from '../../core/camera';
import { Position, Collider, Collectible, RespawnPoint, Goal, Renderable, Animator, Orb, JumpBoost, Hook, ShieldPickup, SpeedPickup, RecallPickup, WeaponPickup, Cipher, Chest } from '../../core/ecs';
import { gs } from '../../systems/game/gameState';
import { colliderWorldRect } from '../../systems/level';
import { T } from './theme';
import { metalPanel, glassPanel, neonTube, rivets, vents, groundGlow, stripes, scanLine } from './material';
import { getAnimOutput } from '../Animations';
import { query } from 'bitecs';
import { world } from '../../core/ecs';
import { spawnParticles } from '../../systems/particles';
import { FX } from '../Fx';
import { weaponFromCode } from '../../config/weapons';
import { drawWeaponModel } from '../WeaponVis';
import { drawItemModel } from '../ItemVis';
import { CHEST_COOLDOWN, CHEST_OPEN_TIME } from '../../systems/interactions/ChestSystem';

/** 光球 */
export function drawOrbs(): void {
  for (const e of query(world, [Position, Collider, Collectible, Animator, Orb])) {
    if (Collectible.collected[e] === 1) continue;
    const ren = { radius: Renderable.radius[e] };
    const out = getAnimOutput(e);
    const px = sx(Position.x[e]);
    if (px < -60 || px > VW + 60) continue;
    const py = sy(Position.y[e] + out.offsetY);
    const r = ren.radius * view.SZ;

    // 外发光（受 alpha 影响）
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = out.alpha;
    const g = ctx.createRadialGradient(px, py, 0, px, py, r * 2.6);
    g.addColorStop(0, 'rgba(140,246,255,.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(px, py, r * 2.6, 0, 6.283); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // 核心
    ctx.fillStyle = '#eaffff';
    ctx.shadowColor = '#8ff6ff';
    ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(px, py, r * 0.55 * out.scaleX, 0, 6.283); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // 旋转方框（受 scaleX 鼓胀）
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(out.rotation);
    ctx.scale(out.scaleX, 1);
    ctx.strokeStyle = 'rgba(160,250,255,.85)';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
    ctx.restore();
  }
}

/** 检查点光柱 */
export function drawCheckpoints(p: number): void {
  for (const e of query(world, [Position, RespawnPoint, Renderable])) {
    const pos = { x: Position.x[e], y: Position.y[e] };
    const rp_active = RespawnPoint.active[e];
    const rp_nearby = RespawnPoint.nearby[e];
    const px = sx(Position.x[e]);
    if (px < -40 || px > VW + 40) continue;
    const py = sy(Position.y[e]);
    const g = ctx.createLinearGradient(0, py, 0, py - 6.5 * view.SZ);
    g.addColorStop(0, rp_active === 1 ? 'rgba(125,249,255,' + (0.28 + 0.2 * p) + ')' : 'rgba(140,130,255,.10)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(px - 0.28 * view.SZ, py - 6.5 * view.SZ, 0.56 * view.SZ, 6.5 * view.SZ);
    ctx.fillStyle = rp_active === 1 ? 'rgba(125,249,255,.9)' : 'rgba(140,130,255,.55)';
    ctx.shadowColor = rp_active === 1 ? '#7df9ff' : '#8a82ff';
    ctx.shadowBlur = rp_active === 1 ? 12 : 4;
    ctx.fillRect(px - 0.9 * view.SZ, sy(Position.y[e] + 0.3), 1.8 * view.SZ, 0.3 * view.SZ);
    ctx.shadowBlur = 0;

    // ── E 交互提示（未激活且玩家在附近时，贴近底座）──
    if (rp_active !== 1 && rp_nearby === 1) {
      const beat = 0.55 + 0.45 * Math.sin(gs.time * 5.5);
      const ey = py - 0.7 * view.SZ;
      const er = 0.5 * view.SZ * (1 + beat * 0.06);
      ctx.save();
      ctx.globalAlpha = 0.75 + 0.25 * beat;
      ctx.shadowColor = 'rgba(125,249,255,.6)';
      ctx.shadowBlur = 10;
      ctx.fillStyle = 'rgba(16,60,40,.85)';
      ctx.beginPath();
      ctx.arc(px, ey, er, 0, 6.283);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(200,255,240,.95)';
      ctx.font = '700 14px "Segoe UI",Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('E', px, ey + 1);
      ctx.restore();
    }
  }
}

/**
 * 沿折线等弧长采样 n 个点 —— 供 neonTube 沿任意轮廓（矩形 / 等距箱体六边轮廓）逐段点亮。
 * @param closed true = 首尾相连成闭合轮廓（默认）
 */
function polyPerimeter(path: readonly (readonly [number, number])[], n: number, closed = true): [number, number][] {
  const m = path.length;
  if (m < 2) return [];
  const segLen: number[] = [];
  let total = 0;
  for (let i = 0; i < m - 1; i++) {
    const L = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
    segLen.push(L);
    total += L;
  }
  if (closed) {
    const L = Math.hypot(path[0][0] - path[m - 1][0], path[0][1] - path[m - 1][1]);
    segLen.push(L);
    total += L;
  }
  if (total <= 0) return [];
  const segCount = segLen.length;
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    let d = (i / n) * total;
    let s = 0;
    while (s < segCount - 1 && d > segLen[s]) { d -= segLen[s]; s++; }
    const a = path[s];
    const b = path[(s + 1) % m];
    const t = segLen[s] > 0 ? d / segLen[s] : 0;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

/** 沿矩形周长等弧长采样 n 个点（顺时针，自左上角起） */
function rectPerimeter(x: number, y: number, w: number, h: number, n: number): [number, number][] {
  return polyPerimeter([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], n);
}

/**
 * 密码机（第五人格式破译机）—— 靠近 + 持续按 E 破译，进度满后转为已完成。
 *
 * 建模分层（自下而上；全部走 Prefabs/Scenes/material 材质原语 + theme 霓虹令牌）：
 *   接地光晕 → 梯形基座 → 金属机箱 → 玻璃观察窗（4 位密码轮 + 扫描线）
 *   → 散热格栅 → 状态铭牌 → 霓虹边框灯带（未完成态按进度逐段点亮）
 *   → 顶盖 + 状态指示灯 → 天线 + 信号灯 → 悬浮进度条
 *
 * 未完成：橙黄警示系（hue 40）—— 密码轮异速滚动、窗内扫描线往复、灯带随进度点亮；
 * 已完成：青绿安全系（hue 160）—— 轮组锁死定格、灯带整圈常亮、中心光核呼吸、天线信号波外扩。
 *
 * 视觉包围盒固定为 宽 1.15 × 高 1.7（世界米），与 sceneFactory 的 2.0×2.4 触发区对齐，勿改。
 */
export function drawCiphers(): void {
  for (const e of query(world, [Position, Collider, Cipher, Renderable, Animator])) {
    const out = getAnimOutput(e);
    const px = sx(Position.x[e]);
    if (px < -100 || px > VW + 100) continue;
    // 视觉尺寸（宽 1.15 × 高 1.7 的底座式破译机），碰撞触发区仍为 2.0×2.4（工厂设定）
    const S = view.SZ;
    const boxW = 1.15 * S;
    const boxH = 1.7 * S;
    const cx = px;
    const pyBottom = sy(Position.y[e] + out.offsetY);  // 底座（世界 y 小 = 屏幕下）
    const pyTop = pyBottom - boxH;                       // 机顶
    const isDone = Cipher.done[e] === 1;
    const progress = Cipher.progress[e];

    const hue = isDone ? 160 : 40;
    // 待机呼吸：全场景归一到 T.breathSpeed（不另起时间源，保证暂停 / 切图一致）
    const breath = 0.5 + 0.5 * Math.sin(gs.time * T.breathSpeed);

    // ① 接地光晕（lighter 混合，单次绘制）
    groundGlow(cx, pyBottom, boxW * 0.72, { hue, alpha: isDone ? 0.5 : 0.32 + 0.12 * breath });

    // ② 梯形基座（喇叭状，把机箱"钉"在地面上）
    const baseH = boxH * 0.10;
    const baseTopY = pyBottom - baseH;
    ctx.beginPath();
    ctx.moveTo(cx - boxW * 0.60, pyBottom);
    ctx.lineTo(cx - boxW * 0.46, baseTopY);
    ctx.lineTo(cx + boxW * 0.46, baseTopY);
    ctx.lineTo(cx + boxW * 0.60, pyBottom);
    ctx.closePath();
    const baseG = ctx.createLinearGradient(0, baseTopY, 0, pyBottom);
    baseG.addColorStop(0, `hsla(${hue},24%,20%,.97)`);
    baseG.addColorStop(1, `hsla(${hue},30%,8%,.98)`);
    ctx.fillStyle = baseG;
    ctx.fill();
    ctx.strokeStyle = `hsla(${hue},100%,${T.rimLight}%,${T.rimAlpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // ③ 机箱本体（金属板材：渐变底 + 拉丝 + 倒角 + 内衬线 + 顶部高光 + 冷光描边）
    const capH = boxH * 0.09;
    const chassisX = cx - boxW / 2;
    const chassisTop = pyTop + capH;
    const chassisH = (pyBottom - baseH * 0.5) - chassisTop;
    metalPanel(chassisX, chassisTop, boxW, chassisH, { hue, glow: T.glowStatic });

    // ④ 玻璃观察窗 + 4 位密码轮（破译机的"脸"）
    const pad = boxW * 0.09;
    const gapY = boxH * 0.035;
    const winX = chassisX + pad;
    const winY = chassisTop + pad;
    const winW = boxW - pad * 2;
    const winH = chassisH * 0.46;
    glassPanel(winX, winY, winW, winH, { hue: isDone ? 165 : 195 });

    const wheelPad = winW * 0.10;
    const wheelGap = Math.max(1, winW * 0.035);
    const WHEEL_N = 4;
    const wheelW = (winW - wheelPad * 2 - wheelGap * (WHEEL_N - 1)) / WHEEL_N;
    const wheelY = winY + winH * 0.16;
    const wheelH = winH * 0.46;
    if (wheelW >= 3 && wheelH >= 5) {
      for (let i = 0; i < WHEEL_N; i++) {
        const wx0 = winX + wheelPad + i * (wheelW + wheelGap);
        // 鼓身：暗底 + 上下卷轴阴影（模拟鼓面弧度）
        ctx.fillStyle = 'rgba(4,8,14,.92)';
        ctx.fillRect(wx0, wheelY, wheelW, wheelH);
        const drumG = ctx.createLinearGradient(0, wheelY, 0, wheelY + wheelH);
        drumG.addColorStop(0, 'rgba(0,0,0,.8)');
        drumG.addColorStop(0.5, 'rgba(255,255,255,.12)');
        drumG.addColorStop(1, 'rgba(0,0,0,.8)');
        ctx.fillStyle = drumG;
        ctx.fillRect(wx0, wheelY, wheelW, wheelH);
        // 读数基准亮带
        ctx.fillStyle = `hsla(${hue},100%,74%,${isDone ? 0.5 : 0.3})`;
        ctx.fillRect(wx0, wheelY + wheelH * 0.47, wheelW, Math.max(1, wheelH * 0.1));
        // 数字：未完成 → 各轮异速滚动；完成 → 由 eid 派生的稳定"密码"定格
        if (wheelW >= 5 && wheelH >= 9) {
          const digit = isDone
            ? (e * 7 + i * 13) % 10
            : Math.floor(gs.time * (5 + i * 1.7) + i * 3.1) % 10;
          ctx.fillStyle = isDone ? '#d7ffee' : `hsla(${hue},100%,90%,.95)`;
          ctx.font = `700 ${Math.round(wheelH * 0.58)}px "Segoe UI",Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(digit), wx0 + wheelW / 2, wheelY + wheelH * 0.5);
          ctx.textBaseline = 'alphabetic';
        }
      }
      // 破译中：窗内往复扫描线（gs.time 驱动，与 wheels 的滚动同语言）
      if (!isDone) scanLine(winX, winY, winW, winH, (gs.time * 0.85) % 1, { hue, alpha: 0.45 });
    }

    // ⑤ 散热格栅（竖向叶片，每片上缘受光）
    const ventY = winY + winH + gapY;
    const ventH = chassisH * 0.20;
    vents(winX, ventY, winW, ventH, { hue });

    // ⑥ 底部状态铭牌：未完成 = 橙黄警示斜纹；完成 = 青绿安全铭牌
    const stripY = ventY + ventH + gapY;
    const stripH = chassisTop + chassisH - pad - stripY;
    if (stripH > 2) {
      if (isDone) {
        metalPanel(winX, stripY, winW, stripH, { hue, topBar: false, bevel: 0, rim: false, detail: false });
        ctx.fillStyle = `hsla(${hue},100%,72%,.85)`;
        ctx.fillRect(winX + 2, stripY + stripH * 0.42, winW - 4, Math.max(1, stripH * 0.16));
      } else {
        ctx.fillStyle = `hsla(${hue},30%,12%,.95)`;
        ctx.fillRect(winX, stripY, winW, stripH);
        stripes(winX, stripY, winW, stripH, { hue, bw: Math.max(3, stripH * 0.9), alpha: 0.22 });
      }
      ctx.strokeStyle = `hsla(${hue},95%,70%,.35)`;
      ctx.lineWidth = 1;
      ctx.strokeRect(winX + 0.5, stripY + 0.5, winW - 1, stripH - 1);
    }

    // ⑦ 机箱铆钉（四角）
    rivets(chassisX, chassisTop, boxW, chassisH, { hue, r: Math.max(1.1, T.mat.rivetR * (S / 48)) });

    // ⑧ 霓虹边框灯带：完成 = 整圈常亮呼吸；未完成 = 暗底轨 + 按进度逐段点亮
    const ring = rectPerimeter(chassisX, chassisTop, boxW, chassisH, 44);
    if (isDone) {
      neonTube(ring, { hue, glow: T.glowMovable, closed: true, bright: 0.85 + 0.15 * breath });
    } else {
      neonTube(ring, { hue, glow: T.glowStatic, closed: true, bright: 0.26 });
      if (progress > 0) {
        const lit = Math.max(2, Math.round((progress / 100) * ring.length));
        neonTube(ring.slice(0, lit), { hue, glow: T.glowFiring, bright: 1 });
      }
    }

    // ⑨ 顶盖 + 两侧状态指示灯
    const capHW = boxW * 0.56;
    metalPanel(cx - capHW, pyTop, capHW * 2, capH, { hue, liner: false });
    const lampR = Math.max(1.2, 0.045 * S);
    for (let i = 0; i < 2; i++) {
      const lx = cx + (i === 0 ? -boxW * 0.36 : boxW * 0.36);
      // 未完成：左右交替闪烁；完成：常亮
      const on = isDone ? 1 : Math.max(0, Math.sin(gs.time * 5 - i * 1.9));
      ctx.fillStyle = `hsla(${hue},100%,${isDone ? 86 : 72}%,${0.22 + 0.78 * on})`;
      ctx.beginPath(); ctx.arc(lx, pyTop + capH * 0.5, lampR, 0, 6.283); ctx.fill();
    }

    // ⑩ 天线：金属凸台 + 渐变杆体 + 信号灯（完成态叠加三层信号波外扩）
    const antH = 0.34 * S;
    const antW = Math.max(1, 0.035 * S);
    ctx.fillStyle = `hsla(${hue},22%,34%,.95)`;
    ctx.fillRect(cx - antW * 2, pyTop - antW, antW * 4, antW * 1.6);
    const antG = ctx.createLinearGradient(cx - antW, 0, cx + antW, 0);
    antG.addColorStop(0, `hsla(${hue},20%,26%,1)`);
    antG.addColorStop(0.4, `hsla(${hue},25%,54%,1)`);
    antG.addColorStop(1, `hsla(${hue},20%,18%,1)`);
    ctx.fillStyle = antG;
    ctx.fillRect(cx - antW, pyTop - antH, antW * 2, antH);

    const lampY = pyTop - antH;
    const lampR2 = Math.max(1.6, 0.062 * S);
    const blink = isDone ? 1 : 0.3 + 0.7 * Math.max(0, Math.sin(gs.time * 3.4));
    ctx.fillStyle = `hsla(${hue},100%,${isDone ? 78 : 62}%,${0.35 + 0.65 * blink})`;
    ctx.beginPath(); ctx.arc(cx, lampY, lampR2, 0, 6.283); ctx.fill();
    ctx.fillStyle = `hsla(${hue},100%,92%,${blink})`;
    ctx.beginPath(); ctx.arc(cx, lampY, lampR2 * 0.45, 0, 6.283); ctx.fill();
    if (isDone) {
      ctx.strokeStyle = `hsla(${hue},100%,78%,.55)`;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        const t = (gs.time * 0.8 + i / 3) % 1;
        ctx.globalAlpha = (1 - t) * 0.5;
        ctx.beginPath();
        ctx.arc(cx, lampY, lampR2 + t * boxW * 0.62, -Math.PI * 0.82, -Math.PI * 0.18);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // ⑪ 悬浮进度条（未完成）/ 中心光核 + ✓（已完成）
    if (!isDone) {
      const barW = boxW * 1.14;
      const barH = Math.max(4, boxH * 0.055);
      const barX = cx - barW / 2;
      const barY = pyTop - antH - lampR2 - boxH * 0.09;
      // 底槽
      ctx.fillStyle = 'rgba(4,6,16,.82)';
      ctx.fillRect(barX, barY, barW, barH);
      // 刻度：每 25% 一格（对齐 CipherSystem 的里程碑音）
      if (barW > 24) {
        ctx.fillStyle = 'rgba(255,255,255,.22)';
        for (let i = 1; i < 4; i++) ctx.fillRect(barX + (barW * i) / 4, barY, 1, barH);
      }
      // 填充
      const fillW = Math.max(0, Math.min(barW, (progress / 100) * barW));
      if (fillW > 0.5) {
        const fillG = ctx.createLinearGradient(barX, barY, barX + barW, barY);
        fillG.addColorStop(0, `hsla(${hue},100%,52%,1)`);
        fillG.addColorStop(1, `hsla(${hue + 26},100%,64%,1)`);
        ctx.fillStyle = fillG;
        ctx.fillRect(barX, barY, fillW, barH);
      }
      ctx.strokeStyle = `hsla(${hue},100%,78%,.55)`;
      ctx.lineWidth = 1;
      ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);
      // 文案
      ctx.fillStyle = '#fff';
      ctx.font = `700 ${Math.max(9, Math.round(boxH * 0.14))}px "Segoe UI",Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(progress > 0 ? `${Math.floor(progress)}%` : 'HOLD E', cx, barY - 3);
    } else {
      // 完成：中心光核（常亮呼吸）+ ✓ 落款
      const coreY = chassisTop + chassisH * 0.5;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const coreG = ctx.createRadialGradient(cx, coreY, 0, cx, coreY, boxW * 0.5);
      coreG.addColorStop(0, `hsla(${hue},100%,72%,${0.42 + 0.14 * breath})`);
      coreG.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = coreG;
      ctx.beginPath(); ctx.arc(cx, coreY, boxW * 0.5, 0, 6.283); ctx.fill();
      ctx.restore();
      ctx.fillStyle = `rgba(220,255,235,${0.8 + 0.2 * breath})`;
      ctx.font = `700 ${Math.max(11, Math.round(boxH * 0.2))}px "Segoe UI",Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓', cx, ventY + ventH * 0.5);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

/**
 * 宝箱（霓虹宝箱）—— 40s 刷新周期可开启的场景交互物。
 *
 * 建模分层：接地光晕 → 等距三面箱体（顶面最亮 / 正面中 / 右侧面最暗）
 *   → 金属箍带 + 铆钉 + 四角护角 → 中央锁扣 + 类型宝石 → 拱形箱盖（绕后缘铰链开合）。
 *
 * 状态机（Chest.state / timer，与 ChestSystem 严格对齐）：
 *   0 冷却中：整体压暗 + 缠绕锁链 + 沿箱体轮廓逐段点亮的冷却进度 + 剩余秒数；
 *   1 可开启：呼吸辉光 + 宝石脉动 + 悬浮 E 提示 + 就绪旋转光圈；
 *   2 开启中：盖子 EaseOutCubic 绕铰链翻转（末端回弹）+ 箱内暗腔 + 光柱喷出 + 开箱闪光。
 *
 * 种类（Chest.type）：0 = 武器宝箱（橙红 hue 24，菱形刃纹宝石）；1 = 道具宝箱（蓝青 hue 190，环形宝石）。
 * 视觉包围盒沿用碰撞体（r.w × (r.top - r.y)），与 sceneFactory 的 2.2×2.0 触发区对齐，勿改。
 */
export function drawChests(): void {
  for (const e of query(world, [Position, Collider, Chest, Renderable])) {
    const r = colliderWorldRect(e);
    const px = sx(r.x + r.w / 2);
    if (px < -140 || px > VW + 140) continue;
    const pyBottom = sy(r.y);            // 底座（世界 y 小 = 屏幕下）
    const pyTop = sy(r.top);             // 顶
    const S = view.SZ;
    const boxW = r.w * S;
    const boxH = Math.max(12, (r.top - r.y) * S); // 机体高度（世界米 → px）
    const state = Chest.state[e];
    const isWeapon = Chest.type[e] === 0;
    const timer = Chest.timer[e];
    // 状态推导
    const isOpen = state === 2;
    const isReady = state === 1;
    const isCooling = state === 0;
    let anim = 0; // 开启动画 / 冷却进度 0..1
    if (isOpen) anim = Math.min(timer / CHEST_OPEN_TIME, 1);
    else if (isCooling) anim = Math.min(timer / CHEST_COOLDOWN, 1);

    const hue = isWeapon ? 24 : 190;
    // 待机呼吸：全场景归一到 T.breathSpeed
    const breath = 0.5 + 0.5 * Math.sin(gs.time * T.breathSpeed);

    /* ── 等距三面箱体几何 ── */
    const w = boxW * 0.30;            // 正面半宽
    const bh = boxH * 0.46;           // 箱体高（不含盖）
    const d = boxW * 0.11;            // 进深·水平偏移
    const dy = boxH * 0.13;           // 进深·垂直偏移
    const bodyTopY = pyBottom - bh;   // 正面上沿
    const lidH = boxH * 0.30;         // 拱顶高
    const promptY = pyTop + boxH * 0.055; // 箱盖上方的提示位（E / 倒计时共用）
    // 箱体外轮廓（6 点，顺时针自左下）：供霓虹描边与冷却进度沿轮廓点亮
    const silhouette: [number, number][] = [
      [px - w, pyBottom],
      [px - w, bodyTopY],
      [px - w + d, bodyTopY - dy],
      [px + w + d, bodyTopY - dy],
      [px + w + d, pyBottom - dy],
      [px + w, pyBottom],
    ];
    /** 箱口（顶面）四边形路径 */
    const mouthPath = (): void => {
      ctx.beginPath();
      ctx.moveTo(px - w, bodyTopY);
      ctx.lineTo(px - w + d, bodyTopY - dy);
      ctx.lineTo(px + w + d, bodyTopY - dy);
      ctx.lineTo(px + w, bodyTopY);
      ctx.closePath();
    };

    // ① 接地光晕
    groundGlow(px, pyBottom, boxW * 0.42, {
      hue, alpha: isReady ? 0.42 + 0.16 * breath : isOpen ? 0.6 : 0.16,
    });

    // ② 右侧面（最暗）
    ctx.beginPath();
    ctx.moveTo(px + w, bodyTopY);
    ctx.lineTo(px + w + d, bodyTopY - dy);
    ctx.lineTo(px + w + d, pyBottom - dy);
    ctx.lineTo(px + w, pyBottom);
    ctx.closePath();
    const sideG = ctx.createLinearGradient(0, bodyTopY - dy, 0, pyBottom);
    sideG.addColorStop(0, `hsla(${hue},34%,15%,.97)`);
    sideG.addColorStop(1, `hsla(${hue},34%,7%,.97)`);
    ctx.fillStyle = sideG;
    ctx.fill();

    // ③ 顶面（受天光，最亮）
    mouthPath();
    const topG = ctx.createLinearGradient(0, bodyTopY - dy, 0, bodyTopY);
    topG.addColorStop(0, `hsla(${hue},40%,27%,.97)`);
    topG.addColorStop(1, `hsla(${hue},40%,17%,.97)`);
    ctx.fillStyle = topG;
    ctx.fill();

    // ④ 开启时：箱口改为暗腔（能看到"箱体是空的"）+ 一圈金边
    if (isOpen) {
      ctx.save();
      mouthPath();
      ctx.clip();
      const innerG = ctx.createLinearGradient(0, bodyTopY - dy, 0, bodyTopY);
      innerG.addColorStop(0, `hsla(${hue},60%,7%,1)`);
      innerG.addColorStop(1, `hsla(${hue},85%,26%,1)`);
      ctx.fillStyle = innerG;
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = `hsla(${hue},100%,80%,.85)`;
      ctx.lineWidth = 1.5;
      mouthPath();
      ctx.stroke();
    }

    // ⑤ 正面（中明度金属板材：拉丝 + 倒角 + 底部内阴影 + 顶部高光）
    metalPanel(px - w, bodyTopY, w * 2, bh, {
      hue,
      base: `hsla(${hue},38%,21%,.97)`,
      baseDark: `hsla(${hue},36%,10%,.97)`,
      glow: isReady ? T.glowMovable : T.glowStatic,
      rim: false,
    });

    // ⑥ 金属箍带（两条竖向）+ 铆钉
    const bandW = Math.max(2, w * 0.17);
    for (let i = 0; i < 2; i++) {
      const bx = px + (i === 0 ? -w * 0.52 : w * 0.52) - bandW / 2;
      const bandG = ctx.createLinearGradient(bx, 0, bx + bandW, 0);
      bandG.addColorStop(0, `hsla(${hue},18%,24%,.95)`);
      bandG.addColorStop(0.35, `hsla(${hue},22%,50%,.95)`);
      bandG.addColorStop(1, `hsla(${hue},18%,16%,.95)`);
      ctx.fillStyle = bandG;
      ctx.fillRect(bx, bodyTopY, bandW, bh);
    }
    const rR = Math.max(1, T.mat.rivetR * 0.85 * (S / 48));
    for (let i = 0; i < 2; i++) {
      const bx = px + (i === 0 ? -w * 0.52 : w * 0.52);
      for (const ry of [bodyTopY + bh * 0.16, bodyTopY + bh * 0.84]) {
        ctx.fillStyle = `hsla(${hue},20%,34%,.95)`;
        ctx.beginPath(); ctx.arc(bx, ry, rR, 0, 6.283); ctx.fill();
        ctx.fillStyle = `hsla(${hue},25%,82%,.6)`;
        ctx.beginPath(); ctx.arc(bx - rR * 0.24, ry - rR * 0.24, rR * 0.5, 0, 6.283); ctx.fill();
      }
    }

    // ⑦ 四角护角（L 形金属包角）
    const cL = Math.max(3, w * 0.24);      // 护角边长
    const cT = Math.max(2, bh * 0.06);     // 护角厚度
    ctx.fillStyle = `hsla(${hue},20%,44%,.95)`;
    for (const sX of [-1, 1]) {
      for (const sY of [-1, 1]) {
        const cxx = px + sX * w;
        const cyy = sY === -1 ? bodyTopY : pyBottom;
        ctx.fillRect(cxx - (sX > 0 ? cL : 0), cyy - (sY > 0 ? cT : 0), cL, cT);
        ctx.fillRect(cxx - (sX > 0 ? cT : 0), cyy - (sY > 0 ? cL : 0), cT, cL);
      }
    }

    // ⑧ 中央锁扣 + 类型宝石（武器箱 = 菱形刃纹 / 道具箱 = 环形法纹）
    const lockW = Math.max(6, w * 0.46);
    const lockH = Math.max(5, bh * 0.26);
    const lockY = bodyTopY + bh * 0.16;
    metalPanel(px - lockW / 2, lockY, lockW, lockH, { hue, topBar: false, bevel: 1, rim: false, detail: false });
    const gemR = Math.min(lockW, lockH) * 0.34;
    const gemY = lockY + lockH * 0.5;
    const gemA = isCooling ? 0.3 : isReady ? 0.65 + 0.35 * breath : 0.9;
    ctx.fillStyle = `hsla(${hue},100%,${isCooling ? 46 : 70}%,${gemA})`;
    if (isWeapon) {
      ctx.beginPath();
      ctx.moveTo(px, gemY - gemR * 1.25);
      ctx.lineTo(px + gemR, gemY);
      ctx.lineTo(px, gemY + gemR * 1.25);
      ctx.lineTo(px - gemR, gemY);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(px, gemY, gemR, 0, 6.283); ctx.fill();
      ctx.fillStyle = `hsla(${hue},60%,12%,.9)`;
      ctx.beginPath(); ctx.arc(px, gemY, gemR * 0.5, 0, 6.283); ctx.fill();
    }

    // ⑨ 拱形箱盖：绕后缘铰链翻转（EaseOutCubic + 末端回弹）
    let lidRot = 0;
    let lidSink = 0;
    if (isOpen) {
      const p = Math.min(1, Math.max(0, anim));
      const ease = 1 - Math.pow(1 - p, 3);
      // 末端回弹：p>0.65 后叠加一段衰减正弦，模拟盖子撞到限位再弹回
      const over = p > 0.65 ? Math.sin(((p - 0.65) / 0.35) * Math.PI) * 0.1 * (1 - p) : 0;
      lidRot = ease * 0.62 + over;
    } else if (isCooling) {
      lidSink = Math.max(1, bh * 0.03); // 冷却中盖子微沉（锁死感）
    }
    ctx.save();
    ctx.translate(px - w + d, bodyTopY - dy + lidSink); // 铰链 = 后缘，局部原点取铰链左端
    ctx.rotate(-lidRot);
    /** 盖体轮廓（局部坐标）：半圆柱拱顶的前后缘 */
    const lidPath = (): void => {
      ctx.beginPath();
      ctx.moveTo(-d, dy);                                                            // 前-左
      ctx.lineTo(0, 0);                                                              // 后-左（铰链端）
      ctx.bezierCurveTo(w * 0.22 - d * 0.5, -lidH, w * 1.78 - d * 0.5, -lidH, w * 2, 0); // 拱背 → 后-右
      ctx.lineTo(w * 2 - d, dy);                                                     // 前-右
      ctx.quadraticCurveTo(w - d * 0.5, dy - lidH * 0.30, -d, dy);                   // 前缘微拱
      ctx.closePath();
    };
    lidPath();
    const lidG = ctx.createLinearGradient(0, -lidH, 0, dy);
    lidG.addColorStop(0, `hsla(${hue},42%,30%,.98)`);
    lidG.addColorStop(1, `hsla(${hue},38%,13%,.98)`);
    ctx.fillStyle = lidG;
    ctx.fill();
    ctx.strokeStyle = `hsla(${hue},95%,66%,.9)`;
    ctx.lineWidth = T.strokeW;
    ctx.stroke();
    // 拱背高光（沿拱顶的一条亮弧）
    ctx.strokeStyle = `hsla(${hue},100%,82%,.5)`;
    ctx.lineWidth = Math.max(1, lidH * 0.09);
    ctx.beginPath();
    ctx.moveTo(w * 0.18 - d * 0.5, -lidH * 0.62);
    ctx.quadraticCurveTo(w - d * 0.5, -lidH * 1.04, w * 1.82 - d * 0.5, -lidH * 0.62);
    ctx.stroke();
    // 盖箍（裁进盖体内，沿拱面斜向）
    ctx.save();
    lidPath();
    ctx.clip();
    ctx.strokeStyle = `hsla(${hue},22%,54%,.55)`;
    ctx.lineWidth = Math.max(1.5, w * 0.13);
    for (let i = 0; i < 2; i++) {
      const bx = -d + w * 2 * (i === 0 ? 0.32 : 0.68);
      ctx.beginPath();
      ctx.moveTo(bx, dy + 2);
      ctx.lineTo(bx + d * 0.5, -lidH - 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();

    // ⑩ 霓虹轮廓描边：冷却态改为沿轮廓逐段点亮的进度轨（替代原来的独立圆环）
    const sil = polyPerimeter(silhouette, 40);
    if (isCooling) {
      neonTube(sil, { hue, glow: T.glowStatic, closed: true, bright: 0.2 });
      const lit = Math.max(2, Math.round(anim * sil.length));
      neonTube(sil.slice(0, lit), { hue, glow: T.glowStatic, bright: 0.7 });
    } else {
      neonTube(sil, {
        hue, closed: true,
        glow: isReady ? T.glowMovable : T.glowFiring,
        bright: isReady ? 0.8 + 0.2 * breath : 1,
      });
    }

    // ⑪ 冷却：缠绕锁链 + 剩余秒数
    if (isCooling) {
      ctx.strokeStyle = 'rgba(172,182,204,.5)';
      ctx.lineWidth = Math.max(1.5, bh * 0.045);
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const ty = bodyTopY + bh * (0.56 + i * 0.16);
        ctx.beginPath();
        ctx.moveTo(px - w * 0.92, ty);
        ctx.quadraticCurveTo(px, ty + bh * 0.06, px + w * 0.92, ty);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
      const remain = Math.max(0, Math.ceil(CHEST_COOLDOWN - timer));
      ctx.fillStyle = 'rgba(226,232,255,.72)';
      ctx.font = `700 ${Math.max(9, Math.round(boxH * 0.12))}px "Segoe UI",Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(remain + 's', px, promptY);
    }

    // ⑫ 可开启：就绪旋转光圈 + 悬浮 E 提示
    if (isReady) {
      ctx.strokeStyle = 'rgba(255,255,255,.42)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, bodyTopY + bh * 0.5, w * 1.34, gs.time * 2, gs.time * 2 + Math.PI);
      ctx.stroke();
      const beat = 0.55 + 0.45 * Math.sin(gs.time * 5.5);
      const er = Math.max(7, boxH * 0.10);
      ctx.save();
      ctx.globalAlpha = 0.75 + 0.25 * beat;
      ctx.fillStyle = 'rgba(10,14,28,.9)';
      ctx.beginPath(); ctx.arc(px, promptY, er, 0, 6.283); ctx.fill();
      ctx.strokeStyle = `hsla(${hue},100%,72%,.9)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px, promptY, er, 0, 6.283); ctx.stroke();
      ctx.fillStyle = 'rgba(214,255,244,.98)';
      ctx.font = `700 ${Math.max(10, Math.round(er * 1.05))}px "Segoe UI",Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('E', px, promptY + 1);
      ctx.restore();
    }

    // ⑬ 开启：箱内光柱喷出 + 开箱闪光
    if (isOpen) {
      const beamH = boxH * 0.9;
      const beamY0 = bodyTopY - dy;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.moveTo(px - w * 0.52, beamY0);
      ctx.lineTo(px + w * 0.52, beamY0);
      ctx.lineTo(px + w * 0.78, beamY0 - beamH);
      ctx.lineTo(px - w * 0.78, beamY0 - beamH);
      ctx.closePath();
      const beamG = ctx.createLinearGradient(0, beamY0, 0, beamY0 - beamH);
      beamG.addColorStop(0, `hsla(${hue},100%,72%,${0.42 * (1 - anim * 0.55)})`);
      beamG.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = beamG;
      ctx.fill();
      ctx.restore();

      if (anim < 0.25) {
        const flash = 1 - anim / 0.25;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const fr = Math.max(1, boxW * 0.62 * flash);
        const fg = ctx.createRadialGradient(px, beamY0, 0, px, beamY0, fr);
        fg.addColorStop(0, `rgba(255,255,255,${0.85 * flash})`);
        fg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = fg;
        ctx.beginPath(); ctx.arc(px, beamY0, fr, 0, 6.283); ctx.fill();
        ctx.restore();
      }
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

/** NOVA 星（终点） */
export function drawNOVA(p: number): void {
  const e = query(world, [Position, Goal]).find(() => true);
  if (!e) return;
  const pos = { x: Position.x[e], y: Position.y[e] };
  const ren = { radius: Renderable.radius[e] };
  const out = getAnimOutput(e);
  const px = sx(Position.x[e]);
  if (px < -160 || px > VW + 160) return;
  const py = sy(Position.y[e]);
  const col = gs.win ? '255,220,140' : '190,140,255';
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, py, 0, sy(0));
  g.addColorStop(0, 'rgba(' + col + ',' + (0.34 + 0.2 * p) + ')');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(px - 0.42 * view.SZ, sy(0), 0.84 * view.SZ, py - sy(0));
  for (let i = 0; i < 2; i++) {
    const tt = ((gs.time * 0.6 + i * 0.5) % 1), rr = tt * 6 * view.SZ;
    ctx.strokeStyle = 'rgba(' + (gs.win ? '255,230,160' : '210,160,255') + ',' + ((1 - tt) * 0.45) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px, py, rr, 0, 6.283); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(out.rotation);
  ctx.shadowColor = gs.win ? '#ffd76b' : '#c07dff';
  ctx.shadowBlur = 22;
  const d = ren.radius * view.SZ * out.scaleX;
  // ★ 星体下方椭圆光池（"神圣"光池，叠加在光柱之上的地面光斑）
  ctx.save();
  ctx.translate(px, py + d * 1.1);
  ctx.scale(1, 0.28);
  const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, d * 2);
  pool.addColorStop(0, 'rgba(' + col + ',.30)');
  pool.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.arc(0, 0, d * 2, 0, 6.283);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = gs.win ? '#fff3cf' : '#f2e4ff';
  ctx.beginPath();
  ctx.moveTo(0, -d); ctx.lineTo(d, 0); ctx.lineTo(0, d); ctx.lineTo(-d, 0); ctx.closePath();
  ctx.fill();
  ctx.rotate(-gs.time * 1.9);
  ctx.strokeStyle = gs.win ? '#ffe9a8' : '#e3ccff';
  ctx.lineWidth = 2;
  ctx.strokeRect(-d * 0.5, -d * 0.5, d, d);
  ctx.restore();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.arc(px, py, 0.16 * view.SZ, 0, 6.283); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.font = '700 12px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(240,225,255,.85)';
  ctx.fillText('NOVA ★', px, py - d - 14);
  ctx.textAlign = 'left';
}

/** 双跳增益箭（绿色箭头 + 淡绿泛光圈，拾取后获得一次二段跳） */
export function drawJumpBoosts(): void {
  for (const e of query(world, [Position, Collider, Collectible, Renderable, Animator, JumpBoost])) {
    if (Collectible.collected[e] === 1) continue;
    const ren = { radius: Renderable.radius[e] };
    const out = getAnimOutput(e);
    const r = colliderWorldRect(e);
    const cx = sx(r.x + r.w / 2);
    const cy = sy(r.top + r.h / 2 + out.offsetY);
    const R = Renderable.radius[e] * view.SZ;

    // ① 淡绿泛光圈（外发光层）
    ctx.globalAlpha = out.alpha;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 2.4);
    g.addColorStop(0, 'rgba(120,255,170,.28)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R * 2.4, 0, 6.283); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // ② 道具本体（建模单一来源 = Prefabs/ItemVis，与背包图标同形）
    ctx.save();
    ctx.translate(cx, cy + R * 0.1);
    ctx.rotate(out.rotation);
    ctx.shadowColor = 'rgba(120,255,170,.9)';
    ctx.shadowBlur = T.glowMovable;
    drawItemModel('doubleJump', R);
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

/** 钩锁道具（金色钩形 + 淡金泛光圈，拾取后进入背包主动栏） */
export function drawHookPickups(): void {
  for (const e of query(world, [Position, Collider, Collectible, Renderable, Animator, Hook])) {
    if (Collectible.collected[e] === 1) continue;
    const ren = { radius: Renderable.radius[e] };
    const out = getAnimOutput(e);
    const r = colliderWorldRect(e);
    const cx = sx(r.x + r.w / 2);
    const cy = sy(r.top + r.h / 2 + out.offsetY);
    const R = Renderable.radius[e] * view.SZ;

    // ① 淡金泛光圈（外发光层）
    ctx.globalAlpha = out.alpha;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 2.4);
    g.addColorStop(0, 'rgba(255,190,90,.30)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R * 2.4, 0, 6.283); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // ② 道具本体（建模单一来源 = Prefabs/ItemVis，与背包图标同形）
    ctx.save();
    ctx.translate(cx, cy + R * 0.2);
    ctx.rotate(out.rotation);
    ctx.shadowColor = 'rgba(255,180,70,.9)';
    ctx.shadowBlur = T.glowMovable;
    drawItemModel('hook', R);
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

/** 护盾道具（蓝紫盾形 + 泛光圈，拾取获得限时护盾） */
export function drawShieldPickups(): void {
  for (const e of query(world, [Position, Collider, Collectible, Renderable, Animator, ShieldPickup])) {
    if (Collectible.collected[e] === 1) continue;
    const out = getAnimOutput(e);
    const r = colliderWorldRect(e);
    const cx = sx(r.x + r.w / 2);
    const cy = sy(r.top + r.h / 2 + out.offsetY);
    const R = Renderable.radius[e] * view.SZ;

    // ① 蓝紫泛光圈（外发光层）
    ctx.globalAlpha = out.alpha;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 2.4);
    g.addColorStop(0, 'rgba(150,140,255,.30)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R * 2.4, 0, 6.283); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // ② 道具本体（建模单一来源 = Prefabs/ItemVis，与背包图标同形）
    ctx.save();
    ctx.translate(cx, cy + R * 0.1);
    ctx.rotate(out.rotation);
    ctx.shadowColor = 'rgba(150,140,255,.9)';
    ctx.shadowBlur = T.glowMovable;
    drawItemModel('shield', R);
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

/** 加速道具（青白「》》」双箭头 + 泛光圈，拾取获得限时移速 ×2） */
export function drawSpeedPickups(): void {
  for (const e of query(world, [Position, Collider, Collectible, Renderable, Animator, SpeedPickup])) {
    if (Collectible.collected[e] === 1) continue;
    const out = getAnimOutput(e);
    const r = colliderWorldRect(e);
    const cx = sx(r.x + r.w / 2);
    const cy = sy(r.top + r.h / 2 + out.offsetY);
    const R = Renderable.radius[e] * view.SZ;

    // ① 青白泛光圈（外发光层）
    ctx.globalAlpha = out.alpha;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 2.4);
    g.addColorStop(0, 'rgba(140,246,255,.32)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R * 2.4, 0, 6.283); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // ② 道具本体（建模单一来源 = Prefabs/ItemVis，与背包图标同形）
    ctx.save();
    ctx.translate(cx, cy + R * 0.1);
    ctx.rotate(out.rotation);
    ctx.shadowColor = 'rgba(120,230,255,.9)';
    ctx.shadowBlur = T.glowMovable;
    drawItemModel('speed', R);
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

/** 重置箭头（白环 + 光圈，拾取获得主动道具：使用后回到绑定的检查点） */
export function drawRecallPickups(): void {
  for (const e of query(world, [Position, Collider, Collectible, Renderable, Animator, RecallPickup])) {
    if (Collectible.collected[e] === 1) continue;
    const out = getAnimOutput(e);
    const r = colliderWorldRect(e);
    const cx = sx(r.x + r.w / 2);
    const cy = sy(r.top + r.h / 2 + out.offsetY);
    const R = Renderable.radius[e] * view.SZ;

    // ① 白色泛光圈（外发光层）
    ctx.globalAlpha = out.alpha;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 2.4);
    g.addColorStop(0, 'rgba(238,242,255,.30)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R * 2.4, 0, 6.283); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // ② 道具本体（建模单一来源 = Prefabs/ItemVis，与背包图标同形）
    ctx.save();
    ctx.translate(cx, cy + R * 0.1);
    ctx.rotate(out.rotation);
    ctx.shadowColor = 'rgba(238,242,255,.9)';
    ctx.shadowBlur = T.glowMovable;
    drawItemModel('recall', R);
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

/* ==================== 武器拾取物（S2：AK / 手雷） ==================== */

/** 武器拾取物（橙金泛光圈 + 枪/雷本体，拾取装备对应武器） */
export function drawWeaponPickups(): void {
  for (const e of query(world, [Position, Collider, Collectible, Renderable, Animator, WeaponPickup])) {
    if (Collectible.collected[e] === 1) continue;
    const out = getAnimOutput(e);
    const r = colliderWorldRect(e);
    const cx = sx(r.x + r.w / 2);
    const cy = sy(r.top + r.h / 2 + out.offsetY);
    const R = Renderable.radius[e] * view.SZ;
    const kind = weaponFromCode(WeaponPickup.kind[e]);

    // ① 橙金泛光圈（外发光层）
    ctx.globalAlpha = out.alpha;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 2.4);
    g.addColorStop(0, 'rgba(255,180,90,.34)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R * 2.4, 0, 6.283); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.translate(cx, cy + R * 0.1);
    ctx.rotate(out.rotation);
    ctx.shadowColor = 'rgba(255,150,60,.9)';
    ctx.shadowBlur = T.glowMovable;
    // 建模单一来源 = Prefabs/WeaponVis
    drawWeaponModel(kind === 'grenade' ? 'grenade' : 'ak', R);
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

/**
 * 光球环境光尘 —— 每颗未收集光球每 0.5s 缓慢上浮一颗青白光尘。
 * 由 game step 每帧调用（与粒子步进同帧）。
 */
export function emitItemAmbient(dt: number): void {
  for (const e of query(world, [Position, Collectible, Orb])) {
    if (Collectible.collected[e] === 1) continue;
    const ph = Position.x[e] * 0.37 + Position.y[e] * 0.13;
    if ((gs.time + ph) % 0.5 < dt) {                       // 每光球每 0.5s 一颗
      spawnParticles(FX.orbAmbient, Position.x[e], Position.y[e], 1);
    }
  }
}