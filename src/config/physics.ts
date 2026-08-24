/**
 * 物理参数注册表 —— 双物理模式（P 键切换，致敬 NEON DASH）。
 * 只依赖 types。
 */
import type { PhysicsMode } from '../types';

export const RUN = 7; // 常规移速 m/s
export const SPRINT = 12; // SHIFT 冲刺移速 m/s
export const JUMP_H = 3.2; // 长按跳高（格）
export const TLIFE = 0.5; // 曳光轨迹寿命（秒）
export const MAP_W = 240; // 地图宽（格）
export const MAP_H = 72; // 地图高（格）

// ── 轨道运动参数 ──
/** 轨道捕获半径（玩家中心距入口点的欧氏距离阈值，格） */
export const TRACK_CAPTURE_RADIUS = 1.5;
/** 轨道最低捕获速度（m/s，低于此值不进环） */
export const TRACK_MIN_SPEED = 7;
/** 轨道速度耗尽阈值（m/s，低于此值爬升反向滚回） */
export const TRACK_STOP_SPEED = 0.3;
/** 轨道摩擦系数（每帧速度乘子，轻微阻尼） */
export const TRACK_FRICTION = 0.06;

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