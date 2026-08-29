/**
 * 新 ECS 场景实体工厂 —— bitECS 世界装配。
 * 取代旧 `Prefabs/Scenes/*Entity.ts` 工厂（旧世界），本文件全部操作新 `src/ecs` 世界。
 *
 * 约定：
 *  - SoA 组件在创建时**完整初始化所有字段**（默认 0），避免读 undefined；
 *  - 标签组件（Orb/JumpBoost/Hook/Hookable）用 `addComponent(world, e, Tag)` 挂载；
 *  - 复杂数据（Animator 状态 / 轨道段几何）走 AoS 组件。
 */
import { addEntity, addComponent } from 'bitecs';
import { world } from '../../core/ecs';
import {
  Position, Velocity, Collider, PathMotion, SpringPad, Timer, Hazard,
  Collectible, RespawnPoint, Goal, Track, Aura, Renderable, Animator, TrackGeom,
  Hookable, Orb, JumpBoost, Hook, ShieldPickup, renderStyles,
} from '../../core/ecs';
import type { PathSegment } from '../../types';
import type { LaserSpawnData, MoverSpawnData, SpringPadSpawnData } from '../../types';
import { DEFAULT_SPRING, HORIZONTAL_SPRING, VERTICAL_SPRING } from '../../config/springs';
import { TRACK_MIN_SPEED } from '../../config';
import { buildCumulativeLengths, pathPosition, pathTotalLength } from '../../core/path';
import { createOrbAnimState, createHoverAnimState } from '../Scenes/itemsAnimators';

/* ==================== 渲染样式调色板（styleId → renderStyles） ==================== */

export const STYLE_ORB = 0;
export const STYLE_JUMP_BOOST = 1;
export const STYLE_HOOK = 2;
export const STYLE_CHECKPOINT = 3;
export const STYLE_NOVA = 4;
export const STYLE_SHIELD = 5;

/** 写入手写样式表（renderStyles 为 src/ecs 注册表；幂等） */
function ensureStyles(): void {
  if (renderStyles.length > 0) return;
  renderStyles.push(
    { bodyGrad: ['#eaffff', '#8ff6ff', '#8ff6ff'], glow: 'rgba(140,246,255,.5)' },       // 0 orb
    { bodyGrad: ['#d6ffe6', '#66ff99', '#1fbf5f'], glow: 'rgba(120,255,170,.85)' },      // 1 jumpBoost
    { bodyGrad: ['#ffe0b3', '#ffb347', '#cc7000'], glow: 'rgba(255,180,70,.85)' },       // 2 hook
    { bodyGrad: ['#7df9ff', '#7df9ff', '#7df9ff'], glow: '#7df9ff' },                    // 3 checkpoint
    { bodyGrad: ['#f2e4ff', '#e3ccff', '#c07dff'], glow: '#c07dff' },                    // 4 nova
    { bodyGrad: ['#e8f0ff', '#b3c7ff', '#7d6bff'], glow: 'rgba(150,140,255,.85)' },      // 5 shield
  );
}

/* ==================== 小组件设置 helper ==================== */

/** 设置碰撞箱（默认 ox/oy=0） */
function setCollider(e: number, w: number, h: number, solid: number, ox = 0, oy = 0): void {
  addComponent(world, e, Collider);
  Collider.w[e] = w; Collider.h[e] = h;
  Collider.ox[e] = ox; Collider.oy[e] = oy;
  Collider.solid[e] = solid;
}

/** 设置位置 */
function setPosition(e: number, x: number, y: number): void {
  addComponent(world, e, Position);
  Position.x[e] = x; Position.y[e] = y;
}

/** 设置渲染（radius + styleId） */
function setRenderable(e: number, radius: number, styleId: number): void {
  addComponent(world, e, Renderable);
  Renderable.radius[e] = radius;
  Renderable.styleId[e] = styleId;
}

/** 设置动画（AoS：prefab + state） */
function setAnimator(e: number, prefab: string, state: unknown): void {
  addComponent(world, e, Animator);
  Animator[e] = { prefab, state };
}

/* ==================== 收集品 ==================== */

/** 光球 */
export function createOrb(x: number, y: number, phase: number): number {
  ensureStyles();
  const e = addEntity(world);
  setPosition(e, x, y);
  setCollider(e, 1.2, 1.2, 0);
  addComponent(world, e, Collectible); Collectible.collected[e] = 0;
  addComponent(world, e, Orb);
  setRenderable(e, 0.4, STYLE_ORB);
  setAnimator(e, 'orb', createOrbAnimState({ phase }));
  return e;
}

/** 二段跳票 */
export function createJumpBoost(x: number, y: number, phase: number): number {
  ensureStyles();
  const e = addEntity(world);
  setPosition(e, x, y);
  setCollider(e, 1.2, 1.2, 0);
  addComponent(world, e, Collectible); Collectible.collected[e] = 0;
  addComponent(world, e, JumpBoost);
  setRenderable(e, 0.45, STYLE_JUMP_BOOST);
  setAnimator(e, 'jumpBoost', createHoverAnimState({ phase }));
  return e;
}

/** 钩锁道具 */
export function createHookPickup(x: number, y: number, phase: number): number {
  ensureStyles();
  const e = addEntity(world);
  setPosition(e, x, y);
  setCollider(e, 1.2, 1.2, 0);
  addComponent(world, e, Collectible); Collectible.collected[e] = 0;
  addComponent(world, e, Hook);
  setRenderable(e, 0.45, STYLE_HOOK);
  setAnimator(e, 'hook', createHoverAnimState({ phase }));
  return e;
}

/** 护盾道具（限时 buff：拾取获得 1 格护盾，格挡一次或超时自动失效） */
export function createShieldPickup(x: number, y: number, phase: number): number {
  ensureStyles();
  const e = addEntity(world);
  setPosition(e, x, y);
  setCollider(e, 1.2, 1.2, 0);
  addComponent(world, e, Collectible); Collectible.collected[e] = 0;
  addComponent(world, e, ShieldPickup);
  setRenderable(e, 0.45, STYLE_SHIELD);
  // 复用 hover 动画控制器（浮动/摇摆），绘制层按 shield 样式画盾形
  setAnimator(e, 'jumpBoost', createHoverAnimState({ phase }));
  return e;
}

/** 检查点 */
export function createCheckpoint(x: number, y: number): number {
  ensureStyles();
  const e = addEntity(world);
  setPosition(e, x, y);
  setCollider(e, 2.2, 3.4, 0, 0, 0.7);
  addComponent(world, e, RespawnPoint);
  RespawnPoint.active[e] = 0; RespawnPoint.nearby[e] = 0;
  setRenderable(e, 0.3, STYLE_CHECKPOINT);
  return e;
}

/** NOVA 星（终点） */
export function createNova(x: number, y: number): number {
  ensureStyles();
  const e = addEntity(world);
  setPosition(e, x, y);
  setCollider(e, 2.68, 2.68, 0);
  addComponent(world, e, Goal); Goal.triggered[e] = 0;
  setRenderable(e, 0.72, STYLE_NOVA);
  setAnimator(e, 'nova', null); // 首次步进惰性创建 state
  return e;
}

/* ==================== 危险物 ==================== */

/** 尖刺（静态几何 → ECS 实体） */
export function createSpike(x: number, y: number): number {
  const e = addEntity(world);
  setPosition(e, x, y);
  setCollider(e, 0.4, 0.55, 0, 0.5, 0.275);
  addComponent(world, e, Hazard); Hazard.damage[e] = 1;
  return e;
}

/** 激光栅栏 */
export function createLaser(d: LaserSpawnData, period = 2.6, onDur = 1.15): number {
  const e = addEntity(world);
  setPosition(e, d.x, d.y0);
  setCollider(e, 1.12, d.len, 0, 0, d.len / 2);
  addComponent(world, e, Timer);
  Timer.period[e] = period; Timer.onDur[e] = onDur; Timer.ph[e] = d.ph; Timer.on[e] = 0;
  addComponent(world, e, Hazard); Hazard.damage[e] = 1;
  return e;
}

/* ==================== 平台 ==================== */

/** 移动平台（正弦往返 / 垂直升降） */
export function createMovingPlatform(d: MoverSpawnData): number {
  const e = addEntity(world);
  const axis = d.axis === 'y' ? 1 : 0;
  setPosition(e, d.x0, d.y);
  setCollider(e, d.w, d.h, 1, d.w / 2, d.h / 2);
  addComponent(world, e, PathMotion);
  PathMotion.x0[e] = d.x0; PathMotion.range[e] = d.range;
  PathMotion.spd[e] = d.spd; PathMotion.ph[e] = d.ph;
  PathMotion.dx[e] = 0; PathMotion.dy[e] = 0;
  PathMotion.axis[e] = axis;
  PathMotion.y0[e] = d.y; PathMotion.yRange[e] = d.yRange ?? 0;
  addComponent(world, e, Hookable);
  return e;
}

/** 弹簧平台 */
export function createSpringPad(d: Partial<Omit<SpringPadSpawnData, 'x' | 'y'>> & Pick<SpringPadSpawnData, 'x' | 'y'>): number {
  const data: SpringPadSpawnData = { ...DEFAULT_SPRING, ...d };
  const e = addEntity(world);
  setPosition(e, data.x, data.y);
  setCollider(e, data.w, data.h, 1, data.w / 2, data.h / 2);
  addComponent(world, e, SpringPad);
  SpringPad.fx[e] = data.force.x; SpringPad.fy[e] = data.force.y;
  SpringPad.duration[e] = data.duration;
  SpringPad.cooldown[e] = 0; SpringPad.animTimer[e] = 0; SpringPad.firing[e] = 0;
  addComponent(world, e, Hookable);
  return e;
}

/* ==================== 轨道 ==================== */

/** 冲刺轨道（段几何存 AoS 侧表 TrackGeom） */
export function createLoopTrack(
  segments: PathSegment[],
  entryDist: number,
  exitDist: number,
  speedThreshold: number = TRACK_MIN_SPEED,
): number {
  const cl = buildCumulativeLengths(segments);
  const total = cl[cl.length - 1];
  if (exitDist > total) exitDist = total;
  const entryPos = pathPosition(segments, cl, entryDist);

  const e = addEntity(world);
  setPosition(e, entryPos.x, entryPos.y);
  addComponent(world, e, Track);
  Track.entryDist[e] = entryDist; Track.exitDist[e] = exitDist;
  Track.speedThreshold[e] = speedThreshold;
  Track.entryX[e] = entryPos.x; Track.entryY[e] = entryPos.y;
  addComponent(world, e, TrackGeom);
  TrackGeom[e] = { segments };
  return e;
}

/** 便捷：圆弧轨道 */
export function createArcTrack(
  cx: number, cy: number, radius: number,
  startAngle: number, endAngle: number, dir: 1 | -1,
  speedThreshold?: number,
): number {
  const arc: PathSegment = { type: 'arc', cx, cy, radius, startAngle, endAngle, dir };
  const len = pathTotalLength([arc]);
  return createLoopTrack([arc], 0, len, speedThreshold);
}

/** 便捷：直线轨道 */
export function createLineTrack(
  x1: number, y1: number, x2: number, y2: number,
  speedThreshold?: number,
): number {
  const line: PathSegment = { type: 'line', x1, y1, x2, y2 };
  const len = pathTotalLength([line]);
  return createLoopTrack([line], 0, len, speedThreshold);
}

/**
 * 光环（范围持续场，扩展占位）。
 * @param x,y 圆心坐标（格）
 * @param radius 半径（格）
 * @param tick 周期结算间隔（秒）；0 = 仅进出不周期
 * 效果配置（onEnter/onExit/onTick）由 AuraSystem.setAuraFx 注册（"每个光环只是配置"）。
 */
export function createAura(x: number, y: number, radius: number, tick = 0): number {
  const e = addEntity(world);
  setPosition(e, x, y);
  addComponent(world, e, Aura);
  Aura.radius[e] = radius;
  Aura.tick[e] = tick;
  Aura.tickT[e] = 0;
  return e;
}

/** 便捷：垂直弹簧（默认数值 W2.5×H2，垂直弹跳力 96） */
export function createVerticalSpring(x: number, y: number): number {
  return createSpringPad({ x, y, ...VERTICAL_SPRING });
}

/** 便捷：水平弹簧（默认数值 W2×H2.5，水平弹射力 96） */
export function createHorizontalSpring(x: number, y: number): number {
  return createSpringPad({ x, y, ...HORIZONTAL_SPRING });
}