/**
 * 轨道组件 —— 路径定义 + 运动参数（用于轨道滑行玩法）。
 * 由实体工厂 createLoopTrack 组装：Position + Track。
 * 路径段由 segments 数组定义（支持直线/圆弧），运动系统据此计算玩家位置。
 * 玩家运行到入口点附近且速度足够时被捕获，进入轨道运动模式。
 *
 * 路径几何计算（position/tangent/gravity）见 core/path.ts。
 * @category 物理/运动
 */
import type { ComponentType } from '../../core/ecs';
import type { PathSegment } from '../../types/path';

export interface Track {
  /** 路径段数组（当前至少一段，未来可多段拼接） */
  segments: PathSegment[];
  /** 从路径起点算起的入口距离（格） */
  entryDist: number;
  /** 出口距离（格） */
  exitDist: number;
  /** 捕获所需最小速度（m/s）：低于此值不进环，正常行走 */
  speedThreshold: number;
  /** 入口世界坐标 X（用于捕获距离检测，由工厂根据 segments + entryDist 计算） */
  entryX: number;
  /** 入口世界坐标 Y */
  entryY: number;
}

export const Track = 'Track' as unknown as ComponentType<Track>;