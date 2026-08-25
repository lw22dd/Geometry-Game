# Gameplay 文件夹 — 玩法/交互组件

<details>
<summary>gameplay — 决定实体游戏语义的组件（数据容器）</summary>

本目录存放 ECS 组件的玩法/交互子集。每个组件为纯粹的数据容器，携带实体的一项游戏语义属性。Collectible 以 kind 统一三种可拾取物（光球/二段跳票/钩锁），其余组件各自封装单一职责。
</details>

```
gameplay/
├── Collectible.ts  # 可拾取物（kind: orb / jumpBoost / hook，collected 标记）
├── Goal.ts  # 终点 NOVA 星（triggered 标记）
├── Hazard.ts  # 危险物（激光/尖刺，damage 预留）
├── RespawnPoint.ts  # 检查点（active 激活 / nearby 交互态）
├── Tags.ts  # 多字符串标签（values: string[]；分类/分组用，玩家 = 'player'）
├── tagHelpers.ts  # 标签工具函数（TAG_PLAYER / addTag / hasTag / queryByTag 等）
├── Timer.ts  # 周期开关（激光等周期物件，on 由系统更新）
└── AGENT.md
```

# 数据流

1. 依赖：流入的方向和原因

`types`（共享类型）—— 需要 `Vector2` 等类型定义。`core/ecs`（Entity/World/ComponentType）—— 组件注册所需。

2. 本模块：经过 gameplay 做了什么

定义实体的玩法语义属性集合——可拾取物（光球/二段跳票/钩锁）、终点、危险物、检查点、标签（分类/分组）、周期开关。Collectible 以 kind 区分三种拾取物，单个组件承载多种玩法，减少组件爆炸。

3. 输出：流出的方向和目的

组件类 → `Prefabs/`（预制体工厂将组件合成到实体模板）、`systems/`（系统读写组件数据）。Prefabs 及 systems 通过 `components/index.ts` barrel 统一导入。