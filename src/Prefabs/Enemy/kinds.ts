/**
 * 敌人种类注册表（S3）—— ENEMY_KINDS 数据 + getEnemyKind 查询 + drawEnemy 分发。
 *
 * 与 Prefabs/Player 的「注册表 + 纯绘制」结构对称：system（systems/enemy）
 * 只面向 ENEMY_KINDS 查询种类定义，不直接 import 具体实现。
 * 绘制为纯 Canvas（只读 ECS 状态），不含任何 AI / 物理逻辑。
 *
 * 每种敌人的专属行为配置分组为子对象（fuse / melee / rock），类型契约见 ./types.ts：
 * 新增敌人种类 = types.ts 加 XxxDef 判别联合 + 本表加一条数据 + 新建 xxx.ts 纯绘制 + 分发一行。
 */
import { ctx } from '../../core/canvas';
import { sx, sy, view } from '../../core/camera';
import { gs } from '../../systems/game/gameState';
import { Position, Health } from '../../core/ecs';
import type { EnemyKind } from '../../types';
import type {
  EnemyKindDef, WalkerDef, CreeperDef, GorillaDef,
  DrawView, EnemyState, WalkerState, CreeperState, GorillaState, StepInput, StepResult,
} from './types';
import { drawWalker, createWalkerState, stepWalker } from './walker';
import { drawCreeper, createCreeperState, stepCreeper } from './creeper';
import { drawGorilla, createGorillaState, stepGorilla } from './gorilla';

/** 敌人注册表（key = kind id；条目类型 = 各自的判别联合成员） */
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
  } satisfies WalkerDef,
  creeper: {
    id: 'creeper',
    name: '苦力怕',
    half: 0.34,
    height: 2,
    hp: 45,
    speed: 2.0,
    chaseSpeed: 3.6,
    patrolRange: 6,
    detectRange: 9,
    loseRange: 13,
    contactDamage: 0,
    bodyGrad: ['#3aff6e', '#1fae46', '#0d6b28'],
    glow: 'rgba(60,255,120,.95)',
    fuse: {
      range: 2.0,
      time: 1.2,
      blastRadius: 3.6,
      blastDamage: 85,
    },
  } satisfies CreeperDef,
  gorilla: {
    id: 'gorilla',
    name: '大猩猩',
    half: 0.5,
    height: 3,
    hp: 300,
    speed: 1.4,
    chaseSpeed: 2.6,
    patrolRange: 6,
    detectRange: 10,
    loseRange: 14,
    contactDamage: 0,
    bodyGrad: ['#ffffff', '#cdd3de', '#8a92a3'],
    glow: 'rgba(255,255,255,.95)',
    melee: {
      range: 2.4,
      damage: 28,
      windup: 0.55,
      cooldown: 2.2,
    },
    rock: {
      range: 10,
      damage: 24,
      windup: 0.5,
      cooldown: 2.8,
      gravity: 20,
      speed: 8,
      radius: 0.5,
    },
  } satisfies GorillaDef,
};

/** 按 id 取种类定义（未知回退 walker，防御） */
export function getEnemyKind(id: EnemyKind): EnemyKindDef {
  return ENEMY_KINDS[id] ?? ENEMY_KINDS.walker;
}

/** 绘制单个敌人（纯表现，读 ECS + AI 状态；含冰冻覆盖层） */
export function drawEnemy(eid: number, kind: EnemyKind, state: unknown): void {
  const def = getEnemyKind(kind);
  const st = state as EnemyState;
  const v: DrawView = {
    x: Position.x[eid], y: Position.y[eid],
    half: def.half,
    face: st.dir,
    grounded: st.grounded,
    mode: st.mode,
    walkT: st.walkT,
    inv: Health.inv[eid] ?? 0,
    hp: Health.hp[eid] ?? def.hp,
    maxHp: Health.max[eid] ?? def.hp,
    slow: st.slow ?? null,
    fuse: 'fuse' in st ? st.fuse : null,
    attack: 'attack' in st ? st.attack : null,
  };

  // 冰冻表现（冻结镜面覆盖层 + 冰晶边缘）——在具体种类绘制之后叠加，保持单一入口
  if (v.slow && v.slow.t > 0) {
    const cx = sx(v.x);
    const cy = sy(v.y);
    const S = view.SZ;
    const w = def.half * 2.1 * S;
    const h = (def.height ?? def.half * 2.1) * S;
    const blink = Math.floor(gs.time * 8) % 2 === 0;

    // 半透明冰蓝覆盖（模拟"被冻住"的滤镜）
    ctx.save();
    ctx.globalAlpha = blink ? 0.38 : 0.3;
    const g = ctx.createLinearGradient(cx, cy - h / 2, cx, cy + h / 2);
    g.addColorStop(0, 'rgba(120,220,255,.55)');
    g.addColorStop(1, 'rgba(60,150,255,.4)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
    // 冰晶描边 + 顶部小三角高光
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = 'rgba(220,248,255,.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
    ctx.fillStyle = 'rgba(240,255,255,.95)';
    ctx.beginPath();
    ctx.moveTo(cx, cy - h / 2 - 3);
    ctx.lineTo(cx - 4, cy - h / 2 + 3);
    ctx.lineTo(cx + 4, cy - h / 2 + 3);
    ctx.closePath();
    ctx.fill();
    // 左右两点小冰晶（闪烁）
    if (blink) {
      ctx.fillRect(cx - w / 2 + 3, cy - 2, 2, 2);
      ctx.fillRect(cx + w / 2 - 5, cy + 4, 2, 2);
    }
    ctx.restore();
  }

  // 按种类分发（判别联合自动收窄出专属配置）
  if (def.id === 'creeper') {
    drawCreeper(v, def);
    return;
  }
  if (def.id === 'gorilla') {
    drawGorilla(v, def);
    return;
  }
  drawWalker(v, def);
}

/** 初始状态工厂：按种类分发给各预制体（AoS 状态真源初始化） */
export function createEnemyState(kind: EnemyKind, x: number, dir: 1 | -1): EnemyState {
  if (kind === 'creeper') return createCreeperState(x, dir);
  if (kind === 'gorilla') return createGorillaState(x, dir);
  return createWalkerState(x, dir);
}

/**
 * 行为分派：控制器把通用准备（目标/距离）交给预制体的专属 step，
 * 预制体自行推进状态/结算并返回移动意向（hold = 本帧停身）。
 */
export function stepEnemyBehavior(
  kind: EnemyKind, input: StepInput, st: EnemyState, def: EnemyKindDef,
): StepResult {
  if (kind === 'creeper') return stepCreeper(input, st as CreeperState, def as CreeperDef);
  if (kind === 'gorilla') return stepGorilla(input, st as GorillaState, def as GorillaDef);
  return stepWalker(input, st as WalkerState, def as WalkerDef);
}