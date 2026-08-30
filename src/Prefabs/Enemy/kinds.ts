/**
 * 敌人种类注册表（S3）—— 每类敌人的数据 + 纯绘制函数。
 *
 * 与 Prefabs/Player 的「注册表 + 纯绘制」结构对称：system（systems/enemy）
 * 只面向 ENEMY_KINDS 查询种类定义，不直接 import 具体实现。
 * 绘制为纯 Canvas（只读 ECS 状态），不含任何 AI / 物理逻辑。
 */
import { ctx } from '../../core/canvas';
import { sx, sy, view } from '../../core/camera';
import { gs } from '../../systems/game/gameState';
import { Position, Health } from '../../core/ecs';
import type { EnemyKind } from '../../types';

/** 敌人视觉/数值配置 */
export interface EnemyKindDef {
  id: EnemyKind;
  name: string;
  /** 碰撞半宽（格） */
  half: number;
  /** 最大生命 */
  hp: number;
  /** 巡逻移速（格/秒） */
  speed: number;
  /** 追击移速（格/秒） */
  chaseSpeed: number;
  /** 巡逻范围半径（围绕 homeX，格） */
  patrolRange: number;
  /** 警戒距离（格）：进入后转向玩家 */
  detectRange: number;
  /** 追击距离（格）：超过则回到巡逻 */
  loseRange: number;
  /** 接触伤害（撞到玩家单次扣血） */
  contactDamage: number;
  /** 主体色（bodyGrad 三档渐变） */
  bodyGrad: [string, string, string];
  /** 发光色 */
  glow: string;
}

/** 敌人注册表（key = kind id） */
export const ENEMY_KINDS: Record<EnemyKind, EnemyKindDef> = {
  walker: {
    id: 'walker',
    name: '行走兵',
    half: 0.42,
    hp: 60,
    speed: 2.2,
    chaseSpeed: 4.2,
    patrolRange: 6,
    detectRange: 8,
    loseRange: 12,
    contactDamage: 12,
    bodyGrad: ['#ffffff', '#ff9a6a', '#e04f2f'],
    glow: 'rgba(255,110,80,.9)',
  },
};

/** 按 id 取种类定义（未知回退 walker，防御） */
export function getEnemyKind(id: EnemyKind): EnemyKindDef {
  return ENEMY_KINDS[id] ?? ENEMY_KINDS.walker;
}

/** 敌人 AI 状态（AoS 侧表 EnemyBrain[eid].state，由 systems/enemy 维护） */
export interface WalkerState {
  /** 巡逻模式朝向（±1） */
  dir: 1 | -1;
  /** 巡逻中心 X（格） */
  homeX: number;
  /** 当前模式：'patrol' | 'chase' */
  mode: 'patrol' | 'chase';
  /** 是否在地面（重力的地面碰撞结果） */
  grounded: boolean;
  /** 动画计时（腿摆相位） */
  walkT: number;
}

/** 敌人实体可视化状态（绘制入参） */
interface DrawView {
  x: number; y: number;
  half: number;
  face: number;
  grounded: boolean;
  mode: 'patrol' | 'chase';
  walkT: number;
  inv: number;
  hp: number; maxHp: number;
}

/** 绘制单个敌人（纯表现，读 ECS + AI 状态） */
export function drawEnemy(eid: number, kind: EnemyKind, state: unknown): void {
  const def = getEnemyKind(kind);
  const st = state as WalkerState;
  const px = Position.x[eid];
  const py = Position.y[eid];
  const v: DrawView = {
    x: px, y: py,
    half: def.half,
    face: st.dir,
    grounded: st.grounded,
    mode: st.mode,
    walkT: st.walkT,
    inv: Health.inv[eid] ?? 0,
    hp: Health.hp[eid] ?? def.hp,
    maxHp: Health.max[eid] ?? def.hp,
  };

  const cx = sx(v.x);
  const cy = sy(v.y);
  const r = v.half * view.SZ;

  // 受击闪白（无敌帧内高频闪烁）
  let flash = 1;
  if (v.inv > 0) flash = Math.floor(gs.time * 20) % 2 === 0 ? 0.55 : 1;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(v.face, 1);

  // 身体：黑色填充正方形 + 白色外框
  ctx.shadowColor = def.glow;
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#000';
  ctx.strokeStyle = v.inv > 0 ? 'rgba(255,255,255,.9)' : '#fff';
  ctx.lineWidth = v.inv > 0 ? 2.4 : 1.6;
  ctx.globalAlpha = flash;
  ctx.beginPath();
  ctx.rect(-r, -r, r * 2, r * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 眼睛：位置与玩家一致（横排两只、居中偏上）
  ctx.fillStyle = '#fff';
  const ew = r * 0.17;
  const eh = r * 0.36;
  ctx.fillRect(r * 0.15 - ew / 2, -r * 0.3, ew, eh);
  ctx.fillRect(r * 0.55 - ew / 2, -r * 0.3, ew, eh);

  // 追击态：头顶警戒「!」
  if (v.mode === 'chase') {
    ctx.fillStyle = '#ff5a5a';
    ctx.font = `bold ${Math.round(r * 1.2)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, -r * 2.1);
  }

  // 血条（受伤时显示）
  if (v.hp < v.maxHp) {
    const bw = r * 1.6;
    const bh = Math.max(2, r * 0.24);
    ctx.fillStyle = 'rgba(10,6,20,.7)';
    ctx.fillRect(-bw / 2, -r * 1.7, bw, bh);
    const ratio = Math.max(0, v.hp / v.maxHp);
    ctx.fillStyle = ratio > 0.5 ? '#6aff8a' : ratio > 0.25 ? '#ffcf5a' : '#ff5a5a';
    ctx.fillRect(-bw / 2, -r * 1.7, bw * ratio, bh);
  }

  ctx.restore();
}