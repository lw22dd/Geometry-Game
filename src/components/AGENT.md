# Components 文件夹 — ECS 组件

<details>
<summary>components — ECS 组件定义（数据容器）</summary>

本目录存放 ECS（Entity-Component-System）架构的组件定义。每个组件是纯粹的数据容器，携带实体的一项属性，不包含行为逻辑。
</details>

```
components/
├── index.ts  # barrel 导出（按分类分组）
├── AGENT.md
├── physics/  # 物理/运动：实体在世界中的空间与运动状态
│   ├── Position.ts  # 位置（世界坐标，格）
│   ├── Velocity.ts  # 速度矢量（格/秒，velocity.x/y）
│   ├── Collider.ts  # 碰撞盒（w/h/solid，触发/实体标记）
│   ├── PathMotion.ts  # 路径运动（移动平台正弦摆动）
│   ├── Track.ts  # 轨道运动（冲刺环路径定义）
│   └── SpringPad.ts  # 弹簧平台（弹射力矢量 + 动画状态）
├── gameplay/  # 玩法/交互：决定实体的游戏语义
│   ├── Collectible.ts  # 可收集（kind: orb 光球 / jumpBoost 二段跳票 / hook 钩锁）
│   ├── Goal.ts  # 终点（NOVA 星）
│   ├── Hazard.ts  # 危险物（尖刺/激光）
│   ├── PlayerTag.ts  # 玩家标识（空标记）
│   ├── RespawnPoint.ts  # 复活点（检查点）
│   └── Timer.ts  # 计时（激光周期开关）
└── render/  # 表现/渲染：实体如何被绘制（Renderable.ts：半径/渐变/发光色/动画相位）
```

# 数据流

1. 依赖：流入的方向和原因

`types`（共享类型）。需要 `Vector2` 等类型定义来描述组件携带的数据形状。

2. 本模块：经过 components 做了什么

定义实体的数据属性集合——位置、速度矢量、碰撞箱、路径运动、计时、危险、渲染、收集、复活点、终点、玩家标记。为 ECS 实体组装提供标准能力组件。所有物理量（速度、力）统一使用 `Vector2 {x, y}` 接口，不拆字段。

3. 输出：流出的方向和目的

组件类 → `Prefabs/`（预制体将组件合成到实体模板）、`systems/`（系统读写组件数据）。Prefabs 根据组件合成属性和行为，定义实体的动画与外观。