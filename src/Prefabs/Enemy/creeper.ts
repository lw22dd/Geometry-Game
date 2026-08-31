/**
 * 苦力怕预制体 —— 纯绘制（两格高模型：头正方形 + 身体竖直长方形 + 四只短矩形块脚）。
 * 头/身叠加确定性像素纹理（无闪烁）；经典苦力怕脸（方眼 + 皱眉嘴）；
 * 侧视站姿：前脚前伸、后脚后倾；行走时四脚对角小碎步（微摆 + 微抬）；引爆膨胀闪白。
 */
import { ctx } from '../../core/canvas';
import { sx, sy, view } from '../../core/camera';
import { gs } from '../../systems/game/gameState';
import { removeEntity } from 'bitecs';
import { world, Position } from '../../core/ecs';
import { spawnParticles } from '../../systems/particles';
import { FX } from '../Fx';
import { sfx } from '../../core/audio';
import { VIS } from '../../config';
import type { CreeperDef, CreeperState, DrawView, StepInput, StepResult } from './types';
import { createWalkerState } from './walker';
import { damagePlayerFromEnemy, panOfX } from './combat';
import { hitFlashAlpha, drawAlert, drawHealthBar } from './drawShared';
/**
 * 苦力怕绘制：
 * 横板游戏 2.5D 斜侧视。
 *
 * 视觉方向：
 *   - 正脸朝向屏幕，完整显示经典苦力怕脸
 *   - 局部 +x 表示面朝方向
 *   - 通过右侧面、顶部面、身体侧面和错位脚体现 2.5D
 *
 * 坐标：
 *   - 碰撞箱中心为局部坐标原点
 *   - y 轴向上
 *   - 1 格 = S 像素
 */
export function drawCreeper(v: DrawView, def: CreeperDef): void {
  const cx = sx(v.x);
  const cy = sy(v.y);
  const S = view.SZ;

  const flash = hitFlashAlpha(v.inv);

  /**
   * 引爆态判定。
   *
   * fuse 生成即常驻（t = 0 表示未引爆），因此必须判断 t > 0，
   * 只有真正进入倒计时（即将爆炸）才膨胀 / 闪白 / 白色辉光。
   */
  const fuseT = v.fuse ? v.fuse.t : 0;
  const fusing = fuseT > 0;

  /**
   * 引爆进度：t 从 fuse.time → 0，用于膨胀与闪白频率。
   */
  const charge = fusing
    ? Math.max(0, Math.min(1, 1 - fuseT / def.fuse.time))
    : 0;

  const scale = 1 + charge * 0.35;

  /**
   * 越接近爆炸闪得越快：
   *   倒计时前半段慢闪，后半段急闪。
   */
  const flashHz = fusing
    ? 8 + charge * 22
    : 18;

  const flashWhite = fusing && Math.floor(gs.time * flashHz) % 2 === 0;

  /**
   * 正面绿色渐变。
   */
  const frontGrad = ctx.createLinearGradient(
    -S * 0.5,
    -S,
    S * 0.5,
    S,
  );

  if (flashWhite) {
    frontGrad.addColorStop(0, '#ffffff');
    frontGrad.addColorStop(1, '#eaffef');
  } else {
    frontGrad.addColorStop(0, def.bodyGrad[0]);
    frontGrad.addColorStop(0.5, def.bodyGrad[1]);
    frontGrad.addColorStop(1, def.bodyGrad[2]);
  }

  /**
   * 2.5D 侧面和顶面颜色。
   */
  const sideColor = flashWhite
    ? '#ffffff'
    : def.bodyGrad[2];

  const topColor = flashWhite
    ? '#ffffff'
    : def.bodyGrad[0];

  const outlineColor = flashWhite
    ? '#ffffff'
    : '#092414';

  ctx.save();
  ctx.translate(cx, cy);

  /**
   * 镜像整个角色。
   *
   * v.face > 0：
   *   右侧面可见，角色面朝右。
   *
   * v.face < 0：
   *   左右镜像，角色面朝左。
   */
  ctx.scale(v.face * scale, scale);

  ctx.globalAlpha = flash;
  ctx.shadowColor = fusing && !flashWhite
    ? '#ffffff'
    : def.glow;
  ctx.shadowBlur = 12;

  /**
   * 确定性像素纹理。
   */
  const pix = (i: number, j: number): number => {
    let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  /**
   * 给平面绘制确定性像素纹理。
   */
  const texRect = (
    x0: number,
    y0: number,
    w: number,
    h: number,
    alpha = 1,
  ): void => {
    if (flashWhite) return;

    const cell = 0.1;

    const i0 = Math.floor(x0 / cell + 0.001);
    const i1 = Math.ceil((x0 + w) / cell - 0.001);

    const j0 = Math.floor(y0 / cell + 0.001);
    const j1 = Math.ceil((y0 + h) / cell - 0.001);

    for (let i = i0; i < i1; i++) {
      for (let j = j0; j < j1; j++) {
        const r = pix(i, j);

        if (r < 0.45) continue;

        ctx.fillStyle = r < 0.72
          ? `rgba(6,80,30,${0.22 * alpha})`
          : `rgba(240,255,220,${0.16 * alpha})`;

        ctx.fillRect(
          i * cell * S,
          -(j + 1) * cell * S,
          cell * S,
          cell * S,
        );
      }
    }
  };

  /**
   * 绘制多边形。
   */
  const polygon = (
    points: Array<[number, number]>,
    fillStyle: string | CanvasGradient,
    strokeStyle = outlineColor,
    lineWidth = 1.5,
  ): void => {
    ctx.fillStyle = fillStyle;
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;

    ctx.beginPath();

    points.forEach(([x, y], index) => {
      if (index === 0) {
        ctx.moveTo(x * S, -y * S);
      } else {
        ctx.lineTo(x * S, -y * S);
      }
    });

    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  /**
   * 2.5D 参数。
   *
   * depthX：
   *   侧面向面朝方向延伸的深度。
   *
   * depthY：
   *   顶面向后上方的视觉偏移。
   *
   * 这里不绘制真正的三维投影，而是使用横板游戏中常见的
   * 正面 + 侧面 + 顶面拼接方式。
   */
  const depthX = 0.18;
  const depthY = 0.10;

  /**
   * 身体尺寸。
   */
  const bodyX0 = -0.17;
  const bodyX1 = 0.17;
  const bodyY0 = -0.80;
  const bodyY1 = 0.05;

  /**
   * 头部尺寸。
   */
  const headX0 = -0.40;
  const headX1 = 0.40;
  const headY0 = 0.05;
  const headY1 = 0.85;

  /**
   * -------------------------
   * 四只脚建模
   * -------------------------
   *
   * 苦力怕是四足：
   *   - 沿面朝方向（±x）分前后两排：前脚 +x、后脚 −x
   *   - 沿深度方向分远近两侧：远侧脚压暗并沿深度后移做透视
   *
   * 每只脚是一个紧凑小方块（宽高相等），脚底贴碰撞箱底（−1.0），
   * 厚度侧面朝向面朝方向 —— 这是模型上最明确的朝向指示。
   */
  const FOOT_TOP = -0.76;
  const FOOT_BOTTOM = -1.00;
  const FOOT_W = 0.24;

  /** 前脚 / 后脚在面朝方向上的中心偏移（+x = 面朝方向） */
  const FOOT_FX = 0.13;
  const FOOT_BX = -0.13;

  /** 远侧脚的透视偏移：沿深度方向（+x、+y）后移 */
  const FAR_DX = depthX * 0.55;
  const FAR_DY = depthY * 0.55;

  /** 行走摆动：沿面朝方向前后微摆（对角步态由 phase 错开 π） */
  const shuf = (phase: number): number => Math.sin(v.walkT + phase) * 0.05;

  /** 抬脚：抬起相离地，落地相贴地（保证任何时刻都有脚支撑） */
  const lift = (phase: number): number => Math.max(0, Math.cos(v.walkT + phase)) * 0.05;

  /**
   * 绘制一只脚：小方块正面 + 面朝方向的厚度侧面（2.5D）。
   *
   * @param fx 脚中心 x（已含摆动量）
   * @param dy 抬脚偏移（向上为正）
   * @param far 是否为远侧脚（压暗 + 沿深度后移）
   */
  const drawFoot = (fx: number, dy: number, far: boolean): void => {
    const x0 = fx - FOOT_W / 2;
    const x1 = fx + FOOT_W / 2;
    const top = FOOT_TOP + dy;
    const bot = FOOT_BOTTOM + dy;

    /** 厚度：沿面朝方向（+x）与上方（+y）延伸，远侧脚偏移更大以拉开层次 */
    const dx = far ? FAR_DX : depthX * 0.45;
    const dyy = far ? FAR_DY : depthY * 0.45;
    const fill = far ? sideColor : frontGrad;

    ctx.globalAlpha = flash * (far ? 0.75 : 1);
    ctx.fillStyle = fill;
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = far ? 1.3 : 1.5;

    // 脚主体：正面方块 + 面朝方向厚度侧面（六边形一笔画出）
    polygon(
      [
        [x0, top],
        [x1, top],
        [x1 + dx, top + dyy],
        [x1 + dx, bot + dyy],
        [x1, bot],
        [x0, bot],
      ],
      fill,
      outlineColor,
      far ? 1.3 : 1.5,
    );

    // 脚底接地暗带（强化"踩实"的落地感）
    if (!flashWhite) {
      ctx.fillStyle = 'rgba(0,55,20,.32)';
      ctx.fillRect(x0 * S, -(bot + 0.05) * S, FOOT_W * S, 0.05 * S);
    }
  };

  /**
   * 远侧两只脚：先绘制（会被身体与近侧脚遮挡），压暗 + 透视后移。
   * 对角步态：远后脚 ≡ 近前脚相位（0），远前脚 ≡ 近后脚相位（π）。
   */
  drawFoot(FOOT_BX + FAR_DX + shuf(0), lift(0) + FAR_DY, true);
  drawFoot(FOOT_FX + FAR_DX + shuf(Math.PI), lift(Math.PI) + FAR_DY, true);

  /**
   * -------------------------
   * 身体 2.5D 结构
   * -------------------------
   *
   * 绘制顺序：
   *   1. 身体侧面
   *   2. 身体顶面
   *   3. 身体正面
   *
   * 这样头部和身体都能看出朝向方向的厚度。
   */

  /**
   * 身体侧面。
   */
  polygon(
    [
      [bodyX1, bodyY0],
      [bodyX1 + depthX, bodyY0 + depthY],
      [bodyX1 + depthX, bodyY1 + depthY],
      [bodyX1, bodyY1],
    ],
    sideColor,
    outlineColor,
    1.5,
  );

  /**
   * 身体顶面。
   */
  polygon(
    [
      [bodyX0, bodyY1],
      [bodyX1, bodyY1],
      [bodyX1 + depthX, bodyY1 + depthY],
      [bodyX0 + depthX, bodyY1 + depthY],
    ],
    topColor,
    outlineColor,
    1.5,
  );

  /**
   * 身体正面。
   */
  ctx.globalAlpha = flash;
  ctx.fillStyle = frontGrad;
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 1.6;

  ctx.beginPath();
  ctx.rect(
    bodyX0 * S,
    -bodyY1 * S,
    (bodyX1 - bodyX0) * S,
    (bodyY1 - bodyY0) * S,
  );
  ctx.fill();
  ctx.stroke();

  texRect(
    bodyX0,
    bodyY0,
    bodyX1 - bodyX0,
    bodyY1 - bodyY0,
    1,
  );

  /**
   * 身体侧面增加几块大色块，强化立体侧面。
   */
  if (!flashWhite) {
    ctx.fillStyle = 'rgba(0,55,20,.16)';

    ctx.fillRect(
      bodyX1 * S,
      -(bodyY0 + 0.28) * S,
      depthX * S,
      0.20 * S,
    );

    ctx.fillRect(
      (bodyX1 + 0.03) * S,
      -(bodyY0 + 0.62) * S,
      depthX * S,
      0.12 * S,
    );
  }

  /**
   * -------------------------
   * 头部 2.5D 结构
   * -------------------------
   */

  /**
   * 头部侧面。
   */
  polygon(
    [
      [headX1, headY0],
      [headX1 + depthX, headY0 + depthY],
      [headX1 + depthX, headY1 + depthY],
      [headX1, headY1],
    ],
    sideColor,
    outlineColor,
    1.8,
  );

  /**
   * 头部顶部。
   */
  polygon(
    [
      [headX0, headY1],
      [headX1, headY1],
      [headX1 + depthX, headY1 + depthY],
      [headX0 + depthX, headY1 + depthY],
    ],
    topColor,
    outlineColor,
    1.8,
  );

  /**
   * 头部正面。
   */
  ctx.globalAlpha = flash;
  ctx.fillStyle = frontGrad;
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 1.8;

  ctx.beginPath();
  ctx.rect(
    headX0 * S,
    -headY1 * S,
    (headX1 - headX0) * S,
    (headY1 - headY0) * S,
  );
  ctx.fill();
  ctx.stroke();

  texRect(
    headX0,
    headY0,
    headX1 - headX0,
    headY1 - headY0,
    1,
  );

  /**
   * 头部侧面纹理。
   */
  if (!flashWhite) {
    ctx.fillStyle = 'rgba(0,55,20,.18)';

    ctx.fillRect(
      headX1 * S,
      -(headY0 + 0.22) * S,
      depthX * S,
      0.16 * S,
    );

    ctx.fillRect(
      (headX1 + 0.04) * S,
      -(headY0 + 0.52) * S,
      depthX * S,
      0.18 * S,
    );

    ctx.fillStyle = 'rgba(240,255,220,.10)';

    ctx.fillRect(
      (headX1 + 0.02) * S,
      -(headY0 + 0.68) * S,
      depthX * S,
      0.08 * S,
    );
  }

  /**
   * -------------------------
   * 近侧腿
   * -------------------------
   */

  /**
   * 近侧两只脚：最后绘制（压住身体底部），亮色、无透视偏移。
   * 对角步态：近后脚 ≡ 远前脚相位（π），近前脚 ≡ 远后脚相位（0）。
   */
  drawFoot(FOOT_BX + shuf(Math.PI), lift(Math.PI), false);
  drawFoot(FOOT_FX + shuf(0), lift(0), false);

  /**
   * 近前脚顶高光：给最靠近观察者的一只加亮边，拉开前后层次。
   */
  if (!flashWhite) {
    const fx = FOOT_FX + shuf(0);
    const dy = lift(0);

    ctx.globalAlpha = flash;
    ctx.fillStyle = 'rgba(240,255,220,.14)';
    ctx.fillRect(
      (fx - FOOT_W / 2 + 0.03) * S,
      -(FOOT_TOP + dy - 0.03) * S,
      (FOOT_W - 0.06) * S,
      0.03 * S,
    );
  }

  /**
   * -------------------------
   * 正脸
   * -------------------------
   *
   * 保留完整正面苦力怕脸。
   * 由于头部右侧面已经向外延伸，视觉上会同时有：
   *   - 正脸识别度
   *   - 面朝方向
   *   - 2.5D 厚度
   */

  ctx.globalAlpha = flash;
  ctx.fillStyle = flashWhite
    ? '#0f2a18'
    : '#063015';

  /**
   * 眼睛。
   */
  const eyeW = 0.14;
  const eyeH = 0.14;
  const eyeY = 0.62;

  ctx.fillRect(
    (-0.20 - eyeW / 2) * S,
    -(eyeY + eyeH / 2) * S,
    eyeW * S,
    eyeH * S,
  );

  ctx.fillRect(
    (0.20 - eyeW / 2) * S,
    -(eyeY + eyeH / 2) * S,
    eyeW * S,
    eyeH * S,
  );

  /**
   * 苦力怕经典嘴部：
   *   中央竖块
   *   中间横条
   *   两侧下垂块
   */
  ctx.fillRect(
    -0.09 * S,
    -0.60 * S,
    0.18 * S,
    0.20 * S,
  );

  ctx.fillRect(
    -0.18 * S,
    -0.42 * S,
    0.36 * S,
    0.16 * S,
  );

  ctx.fillRect(
    -0.18 * S,
    -0.26 * S,
    0.10 * S,
    0.10 * S,
  );

  ctx.fillRect(
    0.08 * S,
    -0.26 * S,
    0.10 * S,
    0.10 * S,
  );

  /**
   * 头顶警戒符号。
   */
  if (fusing || v.mode === 'chase') {
    drawAlert(0, -S * 1.35, S * 0.55, flashWhite ? '#ffffff' : '#ff5a5a');
  }

  /**
   * 血条。
   */
  if (v.hp < v.maxHp) {
    drawHealthBar(0, -S * 1.6, S * 1.2, Math.max(2, S * 0.18), v.hp, v.maxHp, flash);
  }

  ctx.restore();
}


/* ==================== 行为：引爆 + 自爆（专属，控制器只调用） ==================== */

/** 苦力怕初始状态（生成即挂 fuse，fuse.t = 0 表示未引爆） */
export function createCreeperState(x: number, dir: 1 | -1): CreeperState {
  return { ...createWalkerState(x, dir), fuse: { t: 0 } };
}

/**
 * 苦力怕专属 step：贴近玩家 → 启动引爆倒计时（不可取消）→ 计时归零自爆。
 * 引爆中 / 启动瞬间都返回 hold（停身），仅保留通用重力贴合地面。
 */
export function stepCreeper(inp: StepInput, st: CreeperState, def: CreeperDef): StepResult {
  // 引爆倒计时：归零 → 自爆
  if (st.fuse.t > 0) {
    st.fuse.t -= inp.dt;
    if (st.fuse.t <= 0) explodeCreeper(inp, def);
    return { hold: true };
  }
  // 目标贴近引爆范围 → 启动倒计时（fuse.time 秒后自爆），面向玩家
  if (inp.target && inp.dist2 <= def.fuse.range * def.fuse.range) {
    st.fuse.t = def.fuse.time;
    st.mode = 'chase';
    st.dir = inp.target.x > Position.x[inp.e] ? 1 : -1;
    return { hold: true };
  }
  return {};
}

/**
 * 自爆结算：爆炸圆内玩家伤害 + 击退；特效/音效/震屏（表现层）+ 移除自身。
 * 伤害走 damagePlayerFromEnemy（目标侧结算管线：无敌帧/护盾/致死）。
 */
function explodeCreeper(inp: StepInput, def: CreeperDef): void {
  const x = Position.x[inp.e];
  const y = Position.y[inp.e];
  const radius = def.fuse.blastRadius;
  const dmg = def.fuse.blastDamage;

  spawnParticles(FX.creeperBoom, x, y);
  spawnParticles(FX.creeperShock, x, y);
  sfx.explosion({ pan: panOfX(x) });
  gs.shake = Math.max(gs.shake, VIS.screen.hurtShake * 0.9);

  for (const pl of inp.players) {
    const ps = pl.state;
    if (ps.dead) continue;
    const dx = ps.x - x;
    const dy = ps.y - y;
    if (dx * dx + dy * dy > radius * radius) continue;
    damagePlayerFromEnemy(ps, dmg, 'creeper', { x: Math.sign(dx) * 6, y: 3 });
  }

  removeEntity(world, inp.e);
}
