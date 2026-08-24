/**
 * 路径定义类型 —— 描述一段几何曲线，供运动系统/绘制系统/钩锁等复用。
 * 纯数据，不依赖 ECS 或物理引擎。
 * 每个段是一条直线（line）或圆弧（arc），t∈[0,1] 归一化参数化。
 */
export type PathSegment =
  | { type: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'arc'; cx: number; cy: number; radius: number; startAngle: number; endAngle: number; dir: 1 | -1 };