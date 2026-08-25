# Physics 文件夹 — 物理/运动组件

<details>
<summary>physics — 实体在世界中的空间与运动状态（数据容器）</summary>

本目录存放 ECS 组件的物理/运动子集。每个组件为纯粹的数据容器，携带实体的一项物理属性。所有物理量（速度、力）统一使用 Vector2 {x, y} 接口，不拆字段。
</details>

```
physics/
├── Position.ts       # 世界坐标（格，x/y）
├── Velocity.ts       # 速度矢量（格/秒，velocity: Vector2；y>0 向上）
├── Collider.ts       # 碰撞箱（w/h/solid/ox/oy；solid=true 实体阻挡，false 触发区）
├── PathMotion.ts     # 正弦路径运动（移动平台：x0/range/spd/ph/axis/dx/dy/y0/yRange）
├── Track.ts          # 轨道运动（冲刺环：segments/entryDist/exitDist/speedThreshold）
└── SpringPad.ts      # 弹簧平台（force/duration/cooldown/animTimer/firing）
```

# 数据流

1. 依赖：流入的方向和原因

`types`（共享类型）—— 需要 `Vector2`、`PathSegment` 等类型定义。`core/ecs`（Entity/World/ComponentType）—— 组件注册所需。

2. 本模块：经过 physics 做了什么

定义实体的空间属性——位置、速度矢量、碰撞箱、路径运动、轨道定义、弹簧平台。为 ECS 实体组装提供标准物理能力组件，所有物理量遵循统一坐标系（y>0 向上）。

3. 输出：流出的方向和目的

组件类 → `Prefabs/`（预制体将组件合成到实体模板）、`systems/`（系统读写组件数据）。Prefabs 根据组件合成属性和行为，定义实体的物理外观与运动；systems 每帧更新组件数据来驱动物理模拟。