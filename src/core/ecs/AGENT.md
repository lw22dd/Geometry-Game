# ECS 文件夹 — bitECS 底座

<details>
<summary>core/ecs — bitECS 世界 + 全部组件存储（SoA/AoS）+ 语义查询</summary>

本目录是新 ECS 的根模块（替换旧 `core/ecs` 的 EntityPool 时代）。基于 bitECS 库（NateTheGreatt/bitECS 0.4.x）：世界是 context 引用，组件为模块级全局存储，切图重建用 `clearWorld()`（移除全部实体，observer/query 保持存活）。全项目共享单世界，无多世界概念。
</details>

```
core/ecs/
├── world.ts       # 全局世界 world + initEcs（注册组件，幂等）+ clearWorld（清空实体保留定义）
├── components.ts  # 全部组件定义：SoA 数值组件 / 标签组件（空对象）/ AoS 复杂对象侧表
├── queries.ts     # 语义查询：qPlayers/qLocalPlayer/qMovers/qSpringPads/qHazards/qOrbs/...（按实体 ID 升序）
├── index.ts       # barrel：导出 world/initEcs/clearWorld + 全部组件 + 查询 + EntityId 类型别名
└── AGENT.md
```

# 数据流

1. 依赖：流入的方向和原因


`types`（共享类型：ItemId / PathSegment / StatModifier / TrackState 等）、bitECS 库（bitecs / bitecs/serialization）。组件层只定义数据，不含任何系统逻辑；不依赖 systems 或 Prefabs。

2. 本模块：经过 core/ecs 做了什么


- **组件存储**（components.ts）：纯数值字段用 SoA（`Position = { x: [], y: [] }`，访问 `Position.x[eid]`）；复杂对象（动画状态/路径几何/背包）用 AoS（`Animator[eid] = { prefab, state }`）；布尔/枚举统一 0/1（ui8 语义）；标签组件为空对象 `{}`（仅表示"拥有"）。
- **世界生命周期**（world.ts）：`initEcs()` 一次性注册全部 SoA 组件（幂等）；切图重建前 `clearWorld()` 移除全部实体。
- **语义查询**（queries.ts）：每个查询是 `query(world, terms)` 的直接调用（bitECS 内部缓存），按语义命名，禁止散落裸 query。

3. 输出：流出的方向和目的


`world` / 组件 / 查询 → `systems/*`（player/level/interactions/items/effects/game）、`Prefabs/Scenes`（sceneFactory 装配实体）、`Prefabs/Animations`（Animator AoS 读写）、`Prefabs/Player`。玩家实体（`systems/player/playerEntity.ts`）与场景实体统一同世界管理。

# 与旧方案关系

旧 `core/ecs`（Entity/World/entityPool.ts 时代）已废弃：Entity/World 对象不再使用；`EntityPool` 泛型容器保留在 `core/entityPool.ts`，仅 `systems/particles` 的粒子池使用（粒子不进入 ECS）。`ecs.smoke.test.ts` 冻结新层的运行时行为。