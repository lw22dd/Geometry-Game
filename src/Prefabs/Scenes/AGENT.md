# Scenes 文件夹 — 场景道具预制体

<details>
<summary>Prefabs/Scenes — 场景道具建模（平台/障碍/收集品/终点/氛围 + 实体工厂）</summary>

本目录存放所有场景道具的绘制实现与 ECS 实体装配工厂：
- **绘制层**：atmosphere（视差/曳光/粒子/文字提示）、hazards（尖刺 + 激光）、items（光球/检查点/NOVA 星）、platforms（平台/边框/装饰/网格）、tracks（轨道）。
- **实体工厂**（`*Entity.ts`）：将 components 的组件组合成 ECS 实体，由 config/level 的 initECSFromLevel 调用。

纯绘制不含游戏逻辑；实体工厂只负责组件装配，不参与运行时。
</details>

```
Prefabs/Scenes/
├── atmosphere.ts               # 绘制：视差 / 曳光 / 粒子 / 文字提示
├── checkpointEntity.ts         # 检查点工厂
├── hazards.ts                  # 绘制：尖刺 / 激光
├── index.ts                    # barrel 导出（绘制函数 + 实体工厂）
├── items.ts                    # 绘制：光球 / 检查点 / NOVA 星（读 AnimOutput 变换参数）
├── itemsAnimators.ts           # 实体动画控制器：光球 / NOVA / 双跳票 / 钩锁（自注册）
├── jumpBoostEntity.ts          # 双跳光球工厂（含 Animator）
├── laserEntity.ts              # 激光工厂
├── loopTrackEntity.ts          # 轨道工厂
├── movingPlatformEntity.ts     # 移动平台工厂
├── novaEntity.ts               # NOVA 终点工厂（含 Animator）
├── orbEntity.ts                # 光球工厂（含 Animator）
├── platforms.ts                # 绘制：平台 / 边框 / 装饰 / 网格
├── spikeEntity.ts              # 尖刺工厂
├── springPadEntity.ts          # 弹簧平台工厂
└── tracks.ts                   # 绘制：轨道
```

# 数据流

1. 依赖：流入的方向和原因


- 绘制层：`core/canvas`（ctx/VW/VH）、`core/camera`（sx/sy/view）、`core/math`（clamp）、`config`（当前地图 currentMap）、`core/ecs`（world 查询实体）、`systems/level`（colliderWorldRect）、`systems/game/gameState`（gs.time）、`systems/player`（playerController）、`systems/particles`（trail/particles）。
- 实体工厂：`core/ecs`（world）、`components/`（组件类）。

2. 本模块：经过 Prefabs/Scenes 做了什么


- 绘制层：静态几何直接从当前地图读取，动态实体经 `world.query()` 读取组件后绘制。
- 实体工厂：将组件类装配成 ECS 实体加入 world。

3. 输出：流出的方向和目的


- 绘制函数 → `systems/game` render() 直接调用。
- 实体工厂 → `config/level` initECSFromLevel() 调用。