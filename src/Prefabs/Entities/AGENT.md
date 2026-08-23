# Entities 文件夹 — ECS 实体工厂

<details>
<summary>Prefabs/Entities — 游戏实体模板（ECS 组件装配）</summary>

本目录存放游戏实体的装配模板：将 `components/` 定义的能力组件（Position / Velocity / Collider / PathMotion / Timer / Hazard / Collectible / RespawnPoint / Goal / Renderable / PlayerTag）组合成完整的 ECS 实体（分为 `world` 实体池与玩家实体）。装配后的实体由 `core/ecs` 的 World 管理，`systems/` 各系统逐帧读写。
</details>

```
Prefabs/Entities/
├── orb.ts            # 光球实体：Position + Collider(trigger) + Collectible + Renderable
├── checkpoint.ts     # 检查点实体：Position + Collider(trigger) + RespawnPoint + Renderable
├── nova.ts           # NOVA 星实体：Position + Collider(trigger) + Goal + Renderable
├── movingPlatform.ts # 移动平台实体：Position + Collider(solid) + PathMotion
├── laser.ts          # 激光实体：Position + Collider(trigger) + Timer + Hazard
└── playerEntity.ts   # 玩家实体：Position + Velocity + PlayerTag（引用 P）
```

# 数据流

1. 依赖：流入的方向和原因


`components/`（ECS 组件类）、`core/ecs`（Entity / World）、`types`（共享类型）。需要组件类来装配实体结构，World 来容纳实体。

2. 本模块：经过 Prefabs/Entities 做了什么


定义实体工厂函数：每个工厂创建对应的组件实例并装配成 Entity，将纯数据实体加入 `core/ecs` 的 world 实体池（移动平台/激光/光球/检查点/NOVA 星）或供玩家系统使用（playerEntity 引用 P 状态）。

3. 输出：流出的方向和目的


装配完成的实体 → `core/ecs` World 实体池（移动平台/激光由 `systems/level` 系统更新、光球/检查点/NOVA 由 `systems/interactions` 于 `systems/level` 碰撞检测后驱动，`Prefabs/Scenes` 绘制时经 `world.query()` 读取）。