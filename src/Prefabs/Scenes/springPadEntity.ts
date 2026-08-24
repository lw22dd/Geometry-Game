/**
 * 弹簧平台预制体工厂 —— 创建 ECS 实体。
 * 组装 Position(底左) + Collider(solid) + SpringPad。
 * 玩家踩踏后获得指定方向加速度，同时弹簧播放压缩/弹起动画。
 *
 * 用法：
 *   createSpringPad({ x, y, ...VERTICAL_SPRING })   // 带预设展开
 *   createSpringPad({ x: 100, y: 4 })               // 省略参数 → 垂直弹簧默认值
 *   createVerticalSpring(x, y)                      // 便捷：垂直弹簧
 *   createHorizontalSpring(x, y)                    // 便捷：水平弹簧
 */
import { world } from '../../core/ecs';
import type { EntityId } from '../../core/ecs/Entity';
import type { SpringPadSpawnData, Vector2 } from '../../types';
import { DEFAULT_SPRING, VERTICAL_SPRING, HORIZONTAL_SPRING } from '../../config/springs';
import { Position } from '../../components/physics/Position';
import { Collider } from '../../components/physics/Collider';
import { SpringPad } from '../../components/physics/SpringPad';

/** 生成数据：位置必填，其余字段可省略（回退到垂直弹簧默认值） */
export type SpringPadInput = Partial<Omit<SpringPadSpawnData, 'x' | 'y'>> & Pick<SpringPadSpawnData, 'x' | 'y'>;

/** 拷贝矢量（避免组件与生成数据共享引用） */
function copyVector(v: Vector2): Vector2 {
  return { x: v.x, y: v.y };
}

export function createSpringPad(d: SpringPadInput): EntityId {
  // 默认值合并：VERTICAL_SPRING 补齐省略字段
  const data: SpringPadSpawnData = { ...DEFAULT_SPRING, ...d };

  const e = world.createEntity();
  world.add(e, Position, { x: data.x, y: data.y });
  world.add(e, Collider, { w: data.w, h: data.h, solid: true, ox: data.w / 2, oy: data.h / 2 });
  world.add(e, SpringPad, {
    force: copyVector(data.force),
    duration: data.duration,
    cooldown: 0,
    animTimer: 0,
    firing: false,
  });
  return e;
}

/** 便捷：垂直弹簧（默认数值 W2.5×H2，垂直弹跳力 96） */
export function createVerticalSpring(x: number, y: number): EntityId {
  return createSpringPad({ x, y, ...VERTICAL_SPRING });
}

/** 便捷：水平弹簧（默认数值 W2×H2.5，水平弹射力 96） */
export function createHorizontalSpring(x: number, y: number): EntityId {
  return createSpringPad({ x, y, ...HORIZONTAL_SPRING });
}