/**
 * 轨道预制体工厂 —— 创建 ECS 实体（路径轨道，支持直线/圆弧段）。
 * 组装 Position + Track 组件，供物理引擎检测入口捕获。
 * 路径几何由 PathSegment 数组定义，入口/出口用弧长距离定位。
 */
import { world } from '../../core/ecs';
import type { EntityId } from '../../core/ecs/Entity';
import { Position } from '../../components/Position';
import { Track } from '../../components/Track';
import type { PathSegment } from '../../types/path';
import {
  buildCumulativeLengths, pathPosition, pathTotalLength,
} from '../../core/path';
import { TRACK_MIN_SPEED } from '../../config';

/**
 * 创建一条路径轨道实体。
 *
 * @param segments  路径段数组（line / arc）
 * @param entryDist 入口距离（格，从路径起点算起）
 * @param exitDist  出口距离（格）
 * @param speedThreshold 捕获所需最小速度（m/s，默认 TRACK_MIN_SPEED=7）
 */
export function createLoopTrack(
  segments: PathSegment[],
  entryDist: number,
  exitDist: number,
  speedThreshold: number = TRACK_MIN_SPEED,
): EntityId {
  const cl = buildCumulativeLengths(segments);
  const total = cl[cl.length - 1];
  if (exitDist > total) exitDist = total;

  // 预计算入口世界坐标（用于捕获距离检测）
  const entryPos = pathPosition(segments, cl, entryDist);

  const e = world.createEntity();
  world.add(e, Position, { x: entryPos.x, y: entryPos.y });
  world.add(e, Track, {
    segments,
    entryDist,
    exitDist,
    speedThreshold,
    entryX: entryPos.x,
    entryY: entryPos.y,
  });
  return e;
}

/** 便捷构造：圆弧轨道（半环） */
export function createArcTrack(
  cx: number, cy: number, radius: number,
  startAngle: number, endAngle: number, dir: 1 | -1,
  speedThreshold?: number,
): EntityId {
  const arc: PathSegment = { type: 'arc', cx, cy, radius, startAngle, endAngle, dir };
  const len = pathTotalLength([arc]);
  return createLoopTrack([arc], 0, len, speedThreshold);
}

/** 便捷构造：直线轨道（滑索/钩锁式） */
export function createLineTrack(
  x1: number, y1: number, x2: number, y2: number,
  speedThreshold?: number,
): EntityId {
  const line: PathSegment = { type: 'line', x1, y1, x2, y2 };
  const len = pathTotalLength([line]);
  return createLoopTrack([line], 0, len, speedThreshold);
}