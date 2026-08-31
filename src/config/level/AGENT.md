# Level 文件夹 — 多地图描述符注册表

<details>
<summary>config/level — 每张地图一个 MapDefinition（静态几何 + 实体生成描述）</summary>

本目录存放所有关卡地图描述符。每张地图 = 一个 `MapDefinition`（`width`/`height`/`playerSpawn`/`solids` 静态几何 + `entitySpawners` 实体生成描述），由 `config/level.ts` 的 `maps[]` 注册表引用。只依赖 `types`，不引用任何 systems 或 core。
</details>

```
config/level/
├── crystalCaverns.ts      # 地图二·水晶洞窟·对称迷城（180×100，46 光球）
├── mapVrg5wrvjcd.ts       # （编辑器导出地图）
├── mvmap2dMapDesign.ts    # 2D 地图设计
├── mvmapPlatformTree.ts   # 平台树地图
├── neonAscent.ts          # 霓虹攀升默认地图
└── AGENT.md
```

# 数据流

1. 依赖：流入的方向和原因

`types`（Rect / MapDefinition 共享类型）。`R(x,y,w,h)` 工厂函数将原始坐标转换为 Rect 碰撞体数组。

2. 本模块：经过 config/level 做了什么

定义每张地图的静态几何（固体平台、地面、外墙）与实体出生描述（移动平台 / 激光 / 光球 / 检查点 / 敌人出生点）。地图经 `config/level.ts` 的 `maps[]` 注册、`loadMap()` 切换、`initECSFromLevel()` 装配为 bitECS 实体。

3. 输出：流出的方向和目的

`MapDefinition` → `config/level.ts`（maps[] 注册表 / loadMap / initECSFromLevel）→ `Prefabs/Scenes/sceneFactory`（装配 ECS 实体）与 `systems/enemy/spawn`（批量生成敌人）。新增地图 = 本目录新建 `<map>.ts` 定义 `MapDefinition` 并注册进 `config/level.ts` 的 `maps[]`。
