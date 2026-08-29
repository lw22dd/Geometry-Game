/**
 * 物理参数注册表 —— 物理手感调参的单一来源。
 * 双物理模式（P 键切换，致敬 NEON DASH）。
 * 集中调参表：TRACK_* / HOOK_* 各只有一个主消费者系统（player 轨道 / items/hook），
 * 但 sceneFactory 用 TRACK_MIN_SPEED 作工厂默认值、hud 用 HOOK_COOLDOWN 画 UI，
 * 属跨模块引用，故集中于此统一调手感。只依赖 types。
 * 视觉参数（如 TLIFE 曳光寿命）见 ./visuals.ts。
 */
import type { PhysicsMode } from '../types';

export const RUN = 7; // 常规移速 m/s
export const SPRINT = 12; // SHIFT 冲刺移速 m/s
export const JUMP_H = 3.2; // 长按跳高（格）

// ── 轨道运动参数 ──
/** 轨道捕获半径（玩家中心距入口点的欧氏距离阈值，格） */
export const TRACK_CAPTURE_RADIUS = 1.5;
/** 轨道最低捕获速度（m/s，低于此值不进环） */
export const TRACK_MIN_SPEED = 7;
/** 轨道速度耗尽阈值（m/s，低于此值爬升反向滚回） */
export const TRACK_STOP_SPEED = 0.3;
/** 轨道摩擦系数（每帧速度乘子，轻微阻尼） */
export const TRACK_FRICTION = 0.06;
/** 滚回滑回速度（m/s，原 0.5 在长直线上会被摩擦耗尽卡死） */
export const TRACK_ROLLBACK_SPEED = 4;
/** 滚回回到入口时的温和释放速度（m/s） */
export const TRACK_ROLLBACK_RELEASE = 1.5;

// ── 钩锁（滑索）参数 ──
/** 钩锁最大射程（格，方向射线长度） */
export const HOOK_MAX_RANGE = 10;
/** 钩锁滑索时速（m/s） */
export const HOOK_SPEED = 20;
/** 钩锁发射冷却（秒） */
export const HOOK_COOLDOWN = 0.6;
/** 钩锁未命中收回时长（秒） */
export const HOOK_RETRACT_TIME = 0.3;

/** 两套物理模式：手感优化 tuned / 经典 classic */
export const PHYS: Record<'tuned' | 'classic', PhysicsMode> = {
  tuned: {
    G: 28,
    JV: Math.sqrt(2 * 28 * JUMP_H),
    MF: 32,
    coy: 0.12,
    jb: 0.14,
    air: 45,
    name: '优化',
  },
  classic: {
    G: 10,
    JV: Math.sqrt(2 * 10 * JUMP_H),
    MF: 18,
    coy: 0,
    jb: 0.02,
    air: 25,
    name: '经典 g=10',
  },
};

/** 当前物理模式 key */
export type PhysicsKey = 'tuned' | 'classic';