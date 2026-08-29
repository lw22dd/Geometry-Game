# Prefabs 文件夹 — 预制体建模层

<details>
<summary>Prefabs — 实体 / 场景道具的绘制建模（prefab 定义）</summary>

本目录存放所有实体与场景道具的绘制建模。与 `systems/*` 的分工：`Prefabs/` =「怎么画」（几何体、颜色、发光、动画形态），`systems/*` =「怎么做」（物理、AI、逻辑、状态变化）。一个预制体 = 一个模块，导出 `drawXxx()` 纯绘制函数。预制体内不允许出现游戏逻辑。
</details>

```
Prefabs/
├── AGENT.md        # 本文件（目录说明）
├── Animations/     # 实体动画控制器注册表（已实现）：registry + getAnimOutput 输出辅助 + types（契约）
├── Enemy/          # 敌人预制体（含 boss；预留，未建模）
├── Fx/             # 特效预制体（已实现，纯数据预设表）
├── NPC/            # NPC 预制体（预留）
├── Player/         # 玩家角色建模（已实现）：注册表 + 默认预制体 + 角色样式
│   ├── characters/     #   角色样式注册表（default / crimson）
│   ├── default/        #   默认预制体「霓虹跑者」
│   └── index.ts        #   统一出口：stepPlayerAnimation / drawPlayer / drawPlayerFor
│                        #   玩家 ECS 实体接线在 systems/player/playerEntity.ts（不在此目录）
├── Scene/          # 空目录（问题 6：已并入 Scenes/，仅保留占位）
├── Scenes/         # 场景道具建模（已实现）：绘制层 + 统一 ECS 实体工厂（sceneFactory.ts）+ 动画控制器（itemsAnimators）+ 主题（theme.ts）
└── WeaponVis/      # 武器外观预制体（预留）
```

# 数据流

1. 依赖：流入的方向和原因


`core`（canvas 上下文 ctx、相机 sx/sy/view、数学工具），`config`（只读关卡数据），`types`（共享类型），`systems` 状态（**只读**——玩家状态 P、游戏时钟 gs.time）。需要这些来将游戏世界状态转换为像素绘制。

2. 本模块：经过 Prefabs 做了什么


实体模板工厂——将逻辑数据（platform Rect、spike 坐标、orb 属性、player 状态）转化为 Canvas 2D 绘制命令。角色样式参数化（drawPlayer 接受 CharacterStyle），场景道具按类型分组模块（platforms / hazards / items / atmosphere），特效按 FX 预设表 + spawnParticles 统一发射。实体动画控制器（Animations/ + Scenes/itemsAnimators）实现 AnimatorController 接口并注册，绘制层经 getAnimOutput(e) 实时求取变换参数。systems 直接导入本层 drawXxx 函数调用；config/level 导入 Scenes/sceneFactory 的 createXxx 工厂装配 bitECS 实体（旧 *Entity.ts 分散工厂已合并）。

3. 输出：流出的方向和目的

纯绘制函数 → `systems/game/index.ts` render() 直接调用（按顺序绘制各 drawXxx）。FX 预设表 → `systems/particles` spawnParticles 发射粒子到粒子池；*Entity 工厂 → `config/level` initECSFromLevel 创建 ECS 实体。