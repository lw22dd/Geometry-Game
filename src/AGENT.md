# NEON ASCENT · 客户端模块说明

霓虹攀升（Neon Ascent）——几何霓虹跑酷游戏。本文档描述 `src/` 内各模块的职责与依赖方向。

## 目录结构

```
src/
├── main.ts            # 入口：初始化并启动游戏循环、挂载 Canvas
├── netBridge.ts       # 组合根：装配 core/netBus（唯一合法 systems↔net 交界处）
├── style.css          # 全局样式
├── vite-env.d.ts      # Vite 环境类型声明
├── AGENT.md           # 本文档
├── assets/            # 图片 / 图集等运行期加载的静态资源
├── Audio/             # 音频资源（enemy / system / weapons 子目录）
│   ├── enemy/       # 空目录
│   ├── system/      # 空目录
│   └── weapons/     # 空目录
├── config/            # 纯数据 + 注册表：物理参数、关卡布局、背景装饰（只依赖 types）
├── core/              # 无业务逻辑的底座：画布、输入、音效、相机、数学工具、netBus
│   └── ecs/           #   实体池遍历器（entityPool.ts：updateAll / drawAll / depthList）
├── net/               # 网络层：NetClient + session 状态机（经 core/netBus 与 systems 通信）
├── Prefabs/           # 预制体：Enemy/（含 boss）、Player/（含 characters）、NPC、WeaponVis、Scenes/ （场景道具绘制）
│   ├── Enemy/       # 空目录
│   ├── NPC/         # 空目录
│   ├── Player/
│   │   └── characters/  # 空目录
│   ├── Scenes/      # 空目录
│   └── WeaponVis/   # 空目录
├── systems/           # 游戏系统：玩法逻辑 + 实体行为注册表（按子系统归属）
│   ├── game/          # 调度中枢：编排各系统，含 directors/、events.ts、npcs/
│   │   ├── directors/  # 空目录
│   │   └── npcs/       # 空目录
│   ├── combat/        # 战斗：开火/爆炸/放置 + projectiles.ts（投射物行为）+ barrels.ts（油桶/地雷）
│   ├── enemy/         # 敌人 AI / 生成
│   ├── player/        # 玩家控制（movement/stats/weapons）+ pickups.ts（拾取行为）
│   │                  #   + interact.ts（E 键交互逻辑）+ defs.ts（PLAYER_DEF 绘制委托）
│   ├── world/         # 世界 / 地图：physics/particles/decals/loot/light/mapLoad
│   │                  #   + props.ts（道具绘制注册表）+ defs.ts（绘制委托）
│   ├── ui/            # 界面（styles/）
│   │   └── styles/   # 空目录
│   └── quest/         # 任务系统（questTracker 进度状态机）
└── types/             # 共享类型定义（本文件）
```

## 依赖规则

- `config/`、`types/` 只依赖 `types/`，不得引用 systems/core
- `core/` 不依赖任何 systems / config（`core/ecs` 只依赖 `types/`）
- `systems/*` 可依赖 `core/`、`config/`、`types/`
- `net/` 只通过 `core/netBus` 与 systems 通信，绝不直接 import systems
- `Prefabs/` 负责「预制体建模」—— 实际绘制实现，不含游戏逻辑
  - `Prefabs/Player/` 玩家角色建模（含 characters/ 角色样式注册表）
  - `Prefabs/Scenes/` 场景道具建模：platforms（长方形平台） / hazards（三角形尖刺+激光） / items（光球·检查点·NOVA） / atmosphere（视差·曳光·粒子·提示）
  - `systems/*/defs.ts` 为指向 Prefabs 的薄委托注册表


## 数据流

```
input ──> systems/player ──> systems/game（step 编排）──> systems/world（粒子/绘制）
                                        │
core/canvas + core/camera ──> 各 draw* 函数 ──> ctx 渲染
```