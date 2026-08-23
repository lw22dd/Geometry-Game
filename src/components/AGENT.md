# Components 文件夹 — ECS 组件

<details>
<summary>components — ECS 组件定义（数据容器）</summary>

本目录存放 ECS（Entity-Component-System）架构的组件定义。每个组件是纯粹的数据容器，携带实体的一项属性，不包含行为逻辑。
</details>

```
components/
├── Position.ts       # 位置组件（x / y 坐标）
├── Velocity.ts       # 速度组件（vx / vy）
├── Renderable.ts     # 可渲染组件（绘制引用）
├── Collectible.ts    # 可收集组件（光球）
├── Checkpoint.ts     # 检查点组件
├── PlayerTag.ts      # 玩家标记组件
├── WinTrigger.ts     # 胜利触发组件（NOVA 终点）
└── index.ts          # barrel 导出
```

# 数据流

1. 依赖：流入的方向和原因


`types`（共享类型）。需要类型定义来描述组件携带的数据形状。

2. 本模块：经过 components 做了什么


定义实体的数据属性集合——位置、速度、渲染、收集、检查点、无敌、玩家标记、形变、胜利触发。为 ECS 实体组装提供标准组件。

3. 输出：流出的方向和目的

组件类 → `Prefabs/`（预制体将组件合成到实体模板）、`systems/`（系统读写组件数据）。Prefabs 根据组件合成属性和行为，定义实体的动画与外观。