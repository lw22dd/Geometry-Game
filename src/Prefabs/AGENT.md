# Prefabs 文件夹 — 预制体建模层

<details>
<summary>Prefabs — 实体 / 场景道具的绘制建模（prefab 定义）</summary>

本目录存放所有实体与场景道具的绘制建模。与 `systems/*` 的分工：`Prefabs/` =「怎么画」（几何体、颜色、发光、动画形态），`systems/*` =「怎么做」（物理、AI、逻辑、状态变化）。一个预制体 = 一个模块，导出 `drawXxx()` 纯绘制函数。预制体内不允许出现游戏逻辑。
</details>

```
Prefabs/
├── Enemy/             # 敌人预制体（含 boss；预留，未建模）
├── NPC/               # NPC 预制体（预留）
├── Player/            # 玩家角色建模（已实现）
│   ├── index.ts       #   drawPlayer(style?) —— 玩家绘制实现
│   └── characters/    #   角色样式注册表
│       ├── index.ts   #     CHARACTERS / DEFAULT_CHARACTER
│       └── default.ts #   默认角色「霓虹跑者」样式数据
├── Scenes/            # 场景道具建模（已实现）
│   ├── index.ts       #   barrel 导出
│   ├── platforms.ts   #   长方形：solids / movers / border / decos / grid
│   ├── hazards.ts     #   三角形尖刺 + 激光栅栏
│   ├── items.ts       #   光球 / 检查点 / NOVA 星
│   └── atmosphere.ts  #   视差 / 曳光 / 粒子 / 文字提示
├── Entities/          # ECS 实体工厂（已实现）
│   ├── orb.ts         #   光球实体：Position + Collectible + Renderable
│   ├── checkpoint.ts  #   检查点实体：Position + Checkpoint + Renderable
│   ├── nova.ts        #   NOVA 星实体：Position + WinTrigger + Renderable
│   └── playerEntity.ts#   玩家实体：Position + Velocity + PlayerTag（引用 P）
└── WeaponVis/         # 武器外观预制体（预留）
```

# 数据流

1. 依赖：流入的方向和原因


`core`（canvas 上下文 ctx、相机 sx/sy/view、数学工具），`config`（只读关卡数据），`types`（共享类型），`systems` 状态（**只读**——玩家状态 P、游戏时钟 gs.time）。需要这些来将游戏世界状态转换为像素绘制。

2. 本模块：经过 Prefabs 做了什么


实体模板工厂——将逻辑数据（platform Rect、spike 坐标、orb 属性、player 状态）转化为 Canvas 2D 绘制命令。角色样式参数化（drawPlayer 接受 CharacterStyle），场景道具按类型分组模块（platforms / hazards / items / atmosphere）。`systems/*/defs.ts` 是本层到 systems 的薄委托入口。

3. 输出：流出的方向和目的

纯绘制函数 → `systems/world/defs.ts` 和 `systems/player/defs.ts` → `systems/game/index.ts` 渲染编排。在每帧 render() 中按顺序调用各 drawXxx() 函数将画面绘制到 canvas 上。