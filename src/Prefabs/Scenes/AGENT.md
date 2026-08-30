# Scenes 文件夹 — 场景道具预制体

<details>
<summary>Prefabs/Scenes — 场景道具建模（平台/障碍/收集品/终点/轨道/氛围 + 统一实体工厂）</summary>

本目录存放所有场景道具的绘制实现与 ECS 实体装配工厂（问题 6：原 `Prefabs/Scene` 并入本目录，统一实体工厂）：
- **绘制层**：atmosphere（视差/曳光/粒子/文字提示）、hazards（尖刺 + 激光）、items（光球/检查点/NOVA 星/拾取物/密码机/宝箱）、platforms（平台/边框/装饰/网格）、tracks（轨道）、theme（霓虹风格统一令牌 + neonBox 绘制原语）、material（材质原语：金属板材/玻璃面板/霓虹灯带/铆钉/格栅/接地光晕/警示斜纹/扫描线）。
- **实体工厂**（sceneFactory.ts）：`createXxx` 函数将组件装配成 bitECS 实体，由 `config/level` 的 `initECSFromLevel` 调用（取代旧分散的 `*Entity.ts` 工厂）。
- **动画控制器**（itemsAnimators.ts）：光球 / NOVA / 双跳票 / 钩锁的实体动画 FSM（自注册进 `Prefabs/Animations` 注册表）。

纯绘制不含游戏逻辑；实体工厂只负责组件装配，不参与运行时。
</details>

```
Prefabs/Scenes/
├── atmosphere.ts       # 绘制：视差 / 曳光 / 粒子 / 文字提示
├── hazards.ts          # 绘制：尖刺 / 激光
├── items.ts            # 绘制：光球 / 检查点 / NOVA 星 / 拾取物（读 AnimOutput 变换参数）
│                       #   + 密码机（drawCiphers）/ 宝箱（drawChests）的多层建模
├── itemsAnimators.ts   # 实体动画控制器：光球 / NOVA / 双跳票 / 钩锁（自注册）
├── platforms.ts        # 绘制：平台 / 边框 / 装饰 / 网格
├── sceneFactory.ts     # 统一 ECS 实体工厂：createOrb / createSpike / createLaser / createMovingPlatform /
│                       #   createSpringPad / createCheckpoint / createNova / createLoopTrack / createJumpBoost / createHookPickup / ...
├── material.ts         # 材质绘制原语（纯绘制，无状态）：metalPanel / glassPanel / neonTube /
│                       #   rivets / vents / groundGlow / stripes / scanLine（全部只接受 hue，
│                       #   内部复用 theme 的 T 令牌；按绘制面积做细节层 LOD）
├── theme.ts            # 霓虹风格统一令牌：底色 / 描边 / 光晕档位 / 渐变色 + neonBox 绘制原语
│                       #   （含 T.mat 材质层令牌组，供 material.ts 专用）
├── tracks.ts           # 绘制：轨道
└── index.ts            # barrel 导出（绘制函数 + 材质原语 + 实体工厂）
```

# 数据流

1. 依赖：流入的方向和原因


- 绘制层：`core/canvas`（ctx/VW/VH）、`core/camera`（sx/sy/view）、`core/math`（clamp）、`config`（当前地图 currentMap）、`core/ecs`（world 查询实体）、`core/path`（轨道几何）、`systems/level`（colliderWorldRect）、`systems/game/gameState`（gs.time）、`systems/player`（playerController）、`systems/particles`（trail/particles）、`Prefabs/Animations`（getAnimOutput 读取动画输出）。
- 实体工厂：`core/ecs`（world + 全部组件）、`springPresets`（同目录弹簧预设）、`config/physics`（TRACK_MIN_SPEED 等物理常量）、`core/path`（轨道弧长）、`itemsAnimators`（createXxxAnimState）。

2. 本模块：经过 Prefabs/Scenes 做了什么


- 绘制层：静态几何直接从当前地图读取，动态实体经 `world` 查询 + `getAnimOutput(e)` 读取组件与动画变换后绘制。
- 实体工厂（sceneFactory.ts）：将 SoA 组件（创建时完整初始化字段）、标签组件（addComponent）与 AoS 复杂对象（Animator / TrackGeom）装配成 bitECS 实体，供 `config/level` 按地图描述符实例化。
- 动画控制器（itemsAnimators.ts）：实现 `AnimatorController` 接口（createState/step/getOutput）并注册，供 `systems/animation` 步进、绘制层 `getAnimOutput` 求值。

3. 输出：流出的方向和目的


- 绘制函数 → `systems/game` render() 直接调用。
- 实体工厂（createXxx）→ `config/level` initECSFromLevel() 调用。