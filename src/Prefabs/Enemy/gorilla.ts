/**
 * 大猩猩预制体 —— 纯绘制（3 格高模型：宽大上身 + 粗壮手臂 + 窄小下身 + 小头）。
 * 白色外框；行走（手臂/腿交替摆动）；攻击动画（近战旋转手臂砸地 / 远程高举投石）。
 * 附带投石本体绘制（drawEnemyRock，gorilla 专属表现）。
 */
import { addEntity, addComponent, removeEntity, hasComponent } from 'bitecs';
import { ctx } from '../../core/canvas';
import { sx, sy, view } from '../../core/camera';
import { gs } from '../../systems/game/gameState';
import { world, Position, Collider, EnemyRock, qEnemyRocks } from '../../core/ecs';
import { getSolids } from '../../systems/player';
import { spawnParticles } from '../../systems/particles';
import { FX } from '../Fx';
import { sfx } from '../../core/audio';
import { VIS } from '../../config';
import type { PlayerState } from '../../types';
import type { DrawView, GorillaDef, GorillaState, StepInput, StepResult } from './types';
import { createWalkerState } from './walker';
import { damagePlayerFromEnemy, panOfX } from './combat';
import { hitFlashAlpha, drawAlert, drawHealthBar } from './drawShared';
/**
 * 大猩猩绘制：横板游戏 2.5D 斜侧视。
 *
 * 视觉结构：
 *   - 黑色主体填充
 *   - 白色外框
 *   - 正面主体仍然可见
 *   - 面朝方向的一侧面和顶部面可见
 *   - 前后手臂、前后腿有明显的远近层次
 *   - v.face 控制面朝左或面朝右
 *
 * 坐标：
 *   - 中心点为碰撞箱中心
 *   - y 轴向上
 *   - 局部 +x 为面朝方向
 */
export function drawGorilla(
  v: DrawView,
  def: GorillaDef,
): void {
  const cx = sx(v.x);
  const cy = sy(v.y);
  const S = view.SZ;

  const flash = hitFlashAlpha(v.inv);

  const atk = v.attack?.phase ?? null;
  const atkT = v.attack?.t ?? 0;

  const meleeWindup = def.melee.windup;

  const meleeProg =
    atk === 'melee' && meleeWindup > 0
      ? Math.max(
          0,
          Math.min(1, 1 - atkT / meleeWindup),
        )
      : 0;

  const throwProg =
    atk === 'throw' && def.rock.windup > 0
      ? Math.max(
          0,
          Math.min(1, 1 - atkT / def.rock.windup),
        )
      : 0;

  /**
   * 黑色内部填充。
   *
   * 如果 def.bodyGrad 用于兼容其他敌人颜色，
   * 可以把这里改成 def.bodyGrad[1]。
   */
  const blackGrad = ctx.createLinearGradient(
    -S * 0.7,
    -S * 1.5,
    S * 0.7,
    S * 1.5,
  );

  blackGrad.addColorStop(0, '#24262b');
  blackGrad.addColorStop(0.45, '#111318');
  blackGrad.addColorStop(1, '#050608');

  const hitFlash = flash < 1;

  const stroke = hitFlash
    ? 'rgba(255,255,255,.92)'
    : '#ffffff';

  const lineWidth = v.inv > 0 ? 2.5 : 1.8;

  /**
   * 2.5D 深度参数。
   *
   * dX：朝面朝方向延伸的侧面宽度。
   * dY：顶部面的纵向投影高度。
   */
  const dX = 0.18;
  const dY = 0.11;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(v.face, 1);

  ctx.globalAlpha = flash;
  ctx.shadowColor = def.glow;
  ctx.shadowBlur = 16;

  ctx.fillStyle = blackGrad;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';

  /**
   * 绘制局部坐标矩形。
   */
  const box = (
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string | CanvasGradient = blackGrad,
    strokeStyle = stroke,
    width = lineWidth,
  ): void => {
    ctx.fillStyle = fill;
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = width;

    ctx.beginPath();
    ctx.rect(
      x * S,
      -(y + h) * S,
      w * S,
      h * S,
    );
    ctx.fill();
    ctx.stroke();
  };

  /**
   * 绘制局部多边形。
   */
  const poly = (
    points: Array<[number, number]>,
    fill: string | CanvasGradient = blackGrad,
    strokeStyle = stroke,
    width = lineWidth,
  ): void => {
    ctx.fillStyle = fill;
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = width;

    ctx.beginPath();

    points.forEach(([x, y], i) => {
      const px = x * S;
      const py = -y * S;

      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    });

    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  /**
   * 绘制 2.5D 立方体。
   *
   * 正面：
   *   x0 ~ x1
   *
   * 侧面：
   *   从 x1 向面朝方向延伸 dX
   *
   * 顶面：
   *   向后上方偏移 dY
   */
  const prism = (
    x0: number,
    y0: number,
    w: number,
    h: number,
    options?: {
      side?: boolean;
      top?: boolean;
      sideFill?: string;
      topFill?: string;
      frontFill?: string | CanvasGradient;
      width?: number;
    },
  ): void => {
    const x1 = x0 + w;
    const y1 = y0 + h;

    const side = options?.side ?? true;
    const top = options?.top ?? true;

    const sideFill = options?.sideFill ?? '#08090b';
    const topFill = options?.topFill ?? '#303238';
    const frontFill = options?.frontFill ?? blackGrad;
    const width = options?.width ?? lineWidth;

    /**
     * 侧面。
     */
    if (side) {
      poly(
        [
          [x1, y0],
          [x1 + dX, y0 + dY],
          [x1 + dX, y1 + dY],
          [x1, y1],
        ],
        sideFill,
        stroke,
        width,
      );
    }

    /**
     * 顶面。
     */
    if (top) {
      poly(
        [
          [x0, y1],
          [x1, y1],
          [x1 + dX, y1 + dY],
          [x0 + dX, y1 + dY],
        ],
        topFill,
        stroke,
        width,
      );
    }

    /**
     * 正面。
     */
    box(
      x0,
      y0,
      w,
      h,
      frontFill,
      stroke,
      width,
    );
  };

  /**
   * 行走动画。
   */
  const walk = Math.sin(v.walkT);

  /**
   * 手臂角度。
   *
   * 局部旋转约定：
   *   0：手臂向下
   *   正值：向前摆动
   */
  let armAngBack: number;
  let armAngFront: number;

  if (atk === 'melee') {
    const a = meleeProg;

    armAngBack =
      -Math.PI * 0.4 -
      a * Math.PI * 2.3;

    armAngFront =
      Math.PI / 2 -
      Math.PI * 2 * a +
      Math.sin(a * Math.PI) * 0.5;
  } else if (atk === 'throw') {
    const b = throwProg;

    armAngBack =
      -Math.PI * 0.7 +
      b * Math.PI * 0.4;

    armAngFront =
      -Math.PI * 1.15 +
      b * Math.PI * 0.6;
  } else {
    armAngBack =
      -Math.PI * 0.15 +
      walk * 0.55;

    armAngFront =
      -Math.PI * 0.15 -
      walk * 0.55;
  }

  /**
   * 绘制一只带有立体侧面的手臂。
   *
   * 手臂以肩部为旋转中心，沿局部 +y 方向延伸。
   */
  const drawArm = (
    shoulderX: number,
    shoulderY: number,
    angle: number,
    far: boolean,
  ): void => {
    ctx.save();

    ctx.translate(
      shoulderX * S,
      -shoulderY * S,
    );

    ctx.rotate(angle);

    ctx.globalAlpha = flash * (far ? 0.62 : 1);

    const armFill = far
      ? '#0a0b0e'
      : blackGrad;

    const armSide = far
      ? '#030405'
      : '#08090b';

    const armTop = far
      ? '#202126'
      : '#303238';

    /**
     * 手臂本体：与上身（1.30）等长，垂到膝盖附近（大猩猩比例）。
     *
     * 注意局部旋转后，手臂从肩部向下延伸。
     */
    prism(
      -0.19,
      -1.30,
      0.38,
      1.30,
      {
        side: true,
        top: true,
        sideFill: armSide,
        topFill: armTop,
        frontFill: armFill,
        width: far ? 1.45 : 1.7,
      },
    );

    /**
     * 手部稍微加宽，保留大猩猩粗壮轮廓（跟随加长后的手臂末端）。
     */
    poly(
      [
        [-0.21, -1.38],
        [0.21, -1.38],
        [0.25, -1.23],
        [-0.25, -1.23],
      ],
      armFill,
      stroke,
      far ? 1.4 : 1.65,
    );

    ctx.restore();
  };

  /**
   * 远侧手臂先绘制。
   */
  drawArm(
    -0.62,
    0.76,
    armAngBack,
    true,
  );

  /**
   * 远侧腿。
   *
   * 深度约定（与 creeper 一致）：prism 的侧面 / 顶面沿 (+dX, +dY) 延伸，
   * 即"远离观察者"= 右上方。因此远侧部件必须沿 (+dX, +dY) 偏移，
   * 才能在近侧部件的右上方露出一条厚度边，层次才自洽
   * （此前用 −dX 向左偏移，与厚度方向相反，看起来像整体错位）。
   *
   * 腿的摆动与近侧腿反相，形成对角步态。
   */
  const legSwing = walk * 0.09;

  ctx.globalAlpha = flash * 0.68;

  prism(
    -0.25 - legSwing + dX * 0.35,
    -1.50 + dY * 0.35,
    0.20,
    0.16,
    {
      side: true,
      top: false,
      sideFill: '#050608',
      frontFill: '#0a0b0e',
      width: 1.45,
    },
  );

  prism(
    0.04 + legSwing + dX * 0.35,
    -1.50 + dY * 0.35,
    0.20,
    0.16,
    {
      side: true,
      top: false,
      sideFill: '#050608',
      frontFill: '#0a0b0e',
      width: 1.45,
    },
  );

  /**
   * 远侧下身（腹/胯）：明显缩短（0.60），腿矮、胯短，突出上身。
   */
  ctx.globalAlpha = flash * 0.72;

  prism(
    -0.28 + dX * 0.28,
    -1.34 + dY * 0.28,
    0.56,
    0.60,
    {
      side: true,
      top: true,
      sideFill: '#06070a',
      topFill: '#282a2f',
      frontFill: '#0b0c10',
      width: 1.55,
    },
  );

  /**
   * 远侧上身（胸）：相应加高，顶到头部下方。
   */
  ctx.globalAlpha = flash * 0.72;

  prism(
    -0.62 + dX * 0.25,
    -0.74 + dY * 0.25,
    1.24,
    1.50,
    {
      side: true,
      top: true,
      sideFill: '#06070a',
      topFill: '#32343a',
      frontFill: '#0d0f13',
      width: 1.65,
    },
  );

  /**
   * 远侧头部：加高成更接近大猩猩的头（此前 0.20 过扁）。
   */
  ctx.globalAlpha = flash * 0.72;

  prism(
    -0.24 + dX * 0.18,
    0.76 + dY * 0.18,
    0.48,
    0.74,
    {
      side: true,
      top: true,
      sideFill: '#06070a',
      topFill: '#393b42',
      frontFill: '#101217',
      width: 1.65,
    },
  );

  /**
   * 近侧腿。
   */
  ctx.globalAlpha = flash;

  prism(
    -0.24 + legSwing,
    -1.50,
    0.20,
    0.16,
    {
      side: true,
      top: false,
      sideFill: '#08090b',
      frontFill: blackGrad,
      width: 1.8,
    },
  );

  prism(
    0.04 - legSwing,
    -1.50,
    0.20,
    0.16,
    {
      side: true,
      top: false,
      sideFill: '#08090b',
      frontFill: blackGrad,
      width: 1.8,
    },
  );

  /**
   * 近侧下身。
   */
  prism(
    -0.28,
    -1.34,
    0.56,
    0.60,
    {
      side: true,
      top: true,
      sideFill: '#08090b',
      topFill: '#3a3c42',
      frontFill: blackGrad,
      width: 1.8,
    },
  );

  /**
   * 近侧上身（胸）：加高顶到头部下方，体现强壮胸背。
   */
  prism(
    -0.62,
    -0.74,
    1.24,
    1.50,
    {
      side: true,
      top: true,
      sideFill: '#08090b',
      topFill: '#42444b',
      frontFill: blackGrad,
      width: 1.9,
    },
  );

  /**
   * 近侧手臂最后绘制，压住身体边缘，
   * 产生“手臂位于身体前方”的效果。
   */
  drawArm(
    0.62,
    0.76,
    armAngFront,
    false,
  );

  ctx.globalAlpha = flash;

  /**
   * 头部：加高成更接近大猩猩的头（此前 0.20 过扁）。
   */
  prism(
    -0.24,
    0.76,
    0.48,
    0.74,
    {
      side: true,
      top: true,
      sideFill: '#08090b',
      topFill: '#4a4c53',
      frontFill: blackGrad,
      width: 2,
    },
  );

  ctx.shadowBlur = 0;

  /**
   * 头部正面眼睛。
   *
   * 因为这是斜侧视而不是纯侧视，
   * 两只眼睛仍保留，但朝面朝方向的一侧略微靠前。
   */
  const eyeScale = atk ? 1.3 : 1;
  const eyeW = 0.10 * eyeScale;
  const eyeH = 0.10 * eyeScale;

  // 眼睛画在头部下 1/3 处（头 0.76→1.50，脸位于下方）
  const eyeY = 0.98;

  ctx.fillStyle = '#050608';

  ctx.fillRect(
    (-0.12 - eyeW / 2) * S,
    -(eyeY + eyeH) * S,
    eyeW * S,
    eyeH * S,
  );

  ctx.fillRect(
    (0.02 - eyeW / 2) * S,
    -(eyeY + eyeH) * S,
    eyeW * S,
    eyeH * S,
  );

  /**
   * 眼睛高光。
   */
  if (!hitFlash) {
    ctx.fillStyle = 'rgba(255,255,255,.18)';

    ctx.fillRect(
      (-0.12 - eyeW / 2 + 0.018) * S,
      -(eyeY + eyeH - 0.025) * S,
      eyeW * 0.25 * S,
      eyeH * 0.25 * S,
    );

    ctx.fillRect(
      (0.02 - eyeW / 2 + 0.018) * S,
      -(eyeY + eyeH - 0.025) * S,
      eyeW * 0.25 * S,
      eyeH * 0.25 * S,
    );
  }

  /**
   * 攻击 / 追击警戒符号。
   */
  if (atk || v.mode === 'chase') {
    drawAlert(0, -S * 1.75, S * 0.6, atk ? '#ffcf5a' : '#ff5a5a');
  }

  /**
   * 血条。
   */
  if (v.hp < v.maxHp) {
    drawHealthBar(0, -S * 1.95, S * 1.6, Math.max(2, S * 0.2), v.hp, v.maxHp, flash);
  }

  ctx.restore();
}

/**
 * 绘制大猩猩投掷的石头。
 *
 * 石头也采用简单 2.5D：
 *   - 正面灰色多边形
 *   - 朝向右上方的暗侧面
 *   - 顶部浅色面
 */
export function drawEnemyRock(r: number): void {
  const px = sx(Position.x[r]);
  const py = sy(Position.y[r]);

  const rad = EnemyRock.radius[r] * view.SZ;

  if (rad <= 0) return;

  const vx = EnemyRock.vx[r];
  const vy = EnemyRock.vy[r];

  const ang = Math.atan2(vy, vx);

  ctx.save();

  ctx.translate(px, py);

  ctx.rotate(
    ang * 0.3 +
    gs.time * 6 * Math.sign(vx || 1),
  );

  ctx.globalAlpha = 1;
  ctx.shadowColor = 'rgba(255,255,255,.8)';
  ctx.shadowBlur = 8;

  const outline = '#ffffff';

  /**
   * 石头的局部半径。
   */
  const frontR = rad;
  const sideX = rad * 0.20;
  const sideY = rad * 0.12;

  /**
   * 7 边不规则正面轮廓。
   */
  const points: Array<[number, number]> = [];

  const N = 7;

  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;

    const rr =
      frontR *
      (0.82 +
        0.18 *
          Math.abs(
            Math.sin(a * 1.7 + r),
          ));

    points.push([
      Math.cos(a) * rr,
      Math.sin(a) * rr,
    ]);
  }

  /**
   * 将屏幕像素转换为绘制路径。
   */
  const drawRockPoly = (
    pts: Array<[number, number]>,
    fill: string,
    strokeStyle = outline,
    width = 1.6,
  ): void => {
    ctx.fillStyle = fill;
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = width;

    ctx.beginPath();

    pts.forEach(([x, y], i) => {
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  /**
   * 后侧面先画。
   */
  drawRockPoly(
    points.map(([x, y]) => [
      x + sideX,
      y - sideY,
    ]),
    '#5e6570',
    outline,
    1.5,
  );

  /**
   * 顶部浅色面。
   */
  drawRockPoly(
    [
      points[0],
      points[1],
      [points[1][0] + sideX, points[1][1] - sideY],
      [points[0][0] + sideX, points[0][1] - sideY],
    ],
    '#eef2f7',
    outline,
    1.4,
  );

  /**
   * 石头正面。
   */
  drawRockPoly(
    points,
    '#cdd3de',
    outline,
    1.6,
  );

  /**
   * 正面暗色纹理。
   */
  ctx.fillStyle = 'rgba(50,55,65,.18)';

  ctx.beginPath();
  ctx.moveTo(-rad * 0.45, -rad * 0.05);
  ctx.lineTo(-rad * 0.08, -rad * 0.35);
  ctx.lineTo(rad * 0.22, -rad * 0.12);
  ctx.lineTo(rad * 0.02, rad * 0.18);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;

  ctx.restore();
}


/* ==================== 行为：近战砸地 / 远程投石（专属，控制器只调用） ==================== */

/** 大猩猩初始状态（生成即挂 attack，t/cd 归零表示空闲） */
export function createGorillaState(x: number, dir: 1 | -1): GorillaState {
  return { ...createWalkerState(x, dir), attack: { phase: 'melee', t: 0, cd: 0, aimX: x, aimY: 0 } };
}

/**
 * 大猩猩专属 step：冷却计时 → 攻击前摇（锁定停身）→ 前摇耗尽结算（砸地/投石）。
 * 空闲时视目标距离发起攻击：贴脸近战 / 中程投石；攻击锁定期间返回 hold。
 */
export function stepGorilla(inp: StepInput, st: GorillaState, def: GorillaDef): StepResult {
  const atk = st.attack;
  // 冷却递减
  if (atk.cd > 0) atk.cd -= inp.dt;

  // 攻击前摇：原地锁定倒计时，耗尽 → 结算
  if (atk.t > 0) {
    atk.t -= inp.dt;
    if (atk.t <= 0) {
      if (atk.phase === 'melee') {
        gorillaSlam(inp, def);
        atk.cd = def.melee.cooldown;
      } else {
        gorillaThrowRock(inp, def, atk.aimX, atk.aimY);
        atk.cd = def.rock.cooldown;
      }
      atk.t = 0;
      return {};
    }
    return { hold: true };
  }

  // 空闲且冷却就绪：视距离发起攻击
  if (inp.target && atk.cd <= 0) {
    const dx = inp.target.x - Position.x[inp.e];
    if (inp.dist2 <= def.melee.range * def.melee.range) {
      atk.phase = 'melee';
      atk.t = def.melee.windup;
      st.dir = dx > 0 ? 1 : -1;
      return { hold: true };
    }
    if (inp.dist2 <= def.rock.range * def.rock.range) {
      atk.phase = 'throw';
      atk.t = def.rock.windup;
      st.dir = dx > 0 ? 1 : -1;
      atk.aimX = inp.target.x;
      atk.aimY = inp.target.y;
      return { hold: true };
    }
  }
  return {};
}

/**
 * 近战砸地结算：前方 def.melee.range 内玩家受击 + 轻微震动 + 尘土特效 + 音效。
 * 结算时机 = 手臂旋转动画末帧（atk.t 耗尽），与绘制旋转手臂同步。
 */
function gorillaSlam(inp: StepInput, def: GorillaDef): void {
  const e = inp.e;
  const x = Position.x[e];
  const y = Position.y[e];
  const half = Collider.w[e] / 2;
  const meleeRange = def.melee.range;
  // 砸地判定：以脚底为基准向下覆盖到玩家身位。
  // 注意 Position.y 是碰撞箱中心（大猩猩高 3 格，脚底在其下方 1.5 格），
  // 此前直接用 y 会让命中区整体悬在玩家上方，永远打不到 —— 必须从脚底算起。
  const footY = y - Collider.h[e] / 2; // 脚底实际 Y
  const left = x - half - meleeRange;
  const right = x + half + meleeRange;
  const top = footY - 0.3;    // 略低于脚底（容错）
  const bottom = footY + 2.3; // 覆盖站立 / 轻度跳跃的玩家
  const dmg = def.melee.damage;

  spawnParticles(FX.gorillaSlam, x, y - 1.5, 10);
  sfx.gorillaSlam({ pan: panOfX(x) });
  gs.shake = Math.max(gs.shake, VIS.screen.hurtShake * 0.45);

  for (const pl of inp.players) {
    const ps = pl.state;
    if (ps.dead) continue;
    if (ps.x < left || ps.x > right || ps.y < top || ps.y > bottom) continue;
    damagePlayerFromEnemy(ps, dmg, 'gorilla', { x: Math.sign(ps.x - x) * 5, y: 2 });
  }
}

/** 计算投石初速：以抛物线从 (x0,y0) 飞到 (tx,ty)，重力 g（格/秒²），返回 {vx, vy} */
function rockVelocity(
  x0: number, y0: number, tx: number, ty: number, g: number, speed: number,
): { vx: number; vy: number } {
  const dx = tx - x0;
  const dy = ty - y0;
  // 飞行时间 = 水平距离 / 初速（限定最小/最大区间，避免贴脸时 stone 瞬达或过远时脱靶）
  const dist = Math.hypot(dx, dy);
  const T = Math.max(0.35, Math.min(1.3, dist / speed));
  const vx = dx / T;
  // 垂直速度：需要 T 时间后 y 到达 ty，配合重力 g（向下为正，敌人 y 轴向上）
  const vy = (dy + 0.5 * g * T * T) / T;
  return { vx, vy };
}

/**
 * 远程投石结算：生成石头抛体实体（Position + EnemyRock），
 * 抛物线飞向 aimX/aimY（攻击启动瞬间锁定的玩家位置）。
 */
function gorillaThrowRock(inp: StepInput, def: GorillaDef, aimX: number, aimY: number): void {
  const e = inp.e;
  const x0 = Position.x[e];
  const y0 = Position.y[e] + 1.2; // 从胸口/手中抛出
  const g = def.rock.gravity;
  const speed = def.rock.speed;
  const { vx, vy } = rockVelocity(x0, y0, aimX, aimY, g, speed);

  const r = addEntity(world);
  addComponent(world, r, Position);
  addComponent(world, r, EnemyRock);
  Position.x[r] = x0;
  Position.y[r] = y0;
  EnemyRock.vx[r] = vx;
  EnemyRock.vy[r] = vy;
  EnemyRock.gravity[r] = g;
  EnemyRock.radius[r] = def.rock.radius;
  EnemyRock.damage[r] = def.rock.damage;
  EnemyRock.life[r] = 4;

  sfx.gorillaThrow({ pan: panOfX(x0) });
}

/** 石头抛体是否有任一段与固体重叠（落地 / 撞墙检测） */
function rockHitsSolid(x: number, y: number): boolean {
  for (const s of getSolids()) {
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.top) return true;
  }
  return false;
}

/**
 * 步进全部敌人石头（gorilla 投石专属弹道；固定物理步调用，放在 stepEnemies 之后）。
 * 积分重力抛物线；命中玩家 → 结算伤害 + 碎石特效 + 移除；撞墙/落地或寿命耗尽 → 移除。
 */
export function stepGorillaRocks(dt: number, players: { state: PlayerState }[]): void {
  for (const r of qEnemyRocks()) {
    // 寿命
    EnemyRock.life[r] -= dt;
    // 积分（重力向下加速）
    EnemyRock.vy[r] -= EnemyRock.gravity[r] * dt;
    Position.x[r] += EnemyRock.vx[r] * dt;
    Position.y[r] += EnemyRock.vy[r] * dt;

    // 命中玩家（以石头圆心到玩家中心的距离判定）
    let hitPlayer = false;
    for (const pl of players) {
      const ps = pl.state;
      if (ps.dead) continue;
      const dx = ps.x - Position.x[r];
      const dy = ps.y - Position.y[r];
      const rr = EnemyRock.radius[r] + ps.half;
      if (dx * dx + dy * dy <= rr * rr) {
        hitPlayer = true;
        damagePlayerFromEnemy(ps, EnemyRock.damage[r], 'gorilla', { x: Math.sign(dx) * 4, y: 2 });
        break;
      }
    }

    // 命中 / 落地 / 寿命耗尽 → 碎石表现 + 移除
    if (hitPlayer || EnemyRock.life[r] <= 0 || rockHitsSolid(Position.x[r], Position.y[r])) {
      if (hitPlayer || EnemyRock.life[r] > 0) {
        spawnParticles(FX.rockBreak, Position.x[r], Position.y[r], 8);
        sfx.rockHit({ pan: panOfX(Position.x[r]) });
      }
      removeEntity(world, r);
    }
  }
}

/** 清空全部敌人石头（切图重建用，applyLevel 调用） */
export function clearGorillaRocks(): void {
  for (const r of qEnemyRocks()) {
    if (hasComponent(world, r, EnemyRock)) removeEntity(world, r);
  }
}
