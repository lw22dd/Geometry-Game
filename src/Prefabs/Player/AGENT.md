# Player 文件夹 — 玩家角色预制体注册表

<details>
<summary>Prefabs/Player — 玩家「外观-动画」组合：注册表 + 默认预制体 + ECS 实体</summary>

本目录存放玩家角色预制体体系：注册表（registry）按 id 选择预制体；每个预制体 = 一个动画 FSM + 纯绘制函数；玩家 ECS 实体接线（规划中，见下"架构决策记录"）。system 只通过 `index.ts` 的公开 API（`stepPlayerAnimation` / `drawPlayer` / `drawPlayerFor`）与预制体交互，不 import 具体实现。
</details>

```
Prefabs/Player/
├── characters/        # 角色样式注册表（纯数据）
│   ├── default.ts     #   默认角色「霓虹跑者」数据 + CharacterStyle 接口定义
│   ├── crimson.ts     #   绯红冲刺者（第二角色，纯数据，与 default 同流派）
│   └── index.ts       #   CHARACTERS 数组 + DEFAULT_CHARACTER + 当前选择状态
├── default/           # 默认预制体（霓虹跑者）
│   ├── animation.ts       #   动画 FSM 步进（边沿检测 + 状态转换 + 输出合成）
│   ├── defaultPrefab.ts   #   组合：实现 PlayerPrefab 接口的 defaultPrefab 对象
│   ├── render.ts          #   纯绘制（只读 AnimOutput + CharacterStyle）
│   └── states.ts          #   动画状态枚举 + 转换表（纯数据）
├── index.ts           # 统一出口：每玩家动画状态 WeakMap + step/draw/getOutput API + characterStyleForId
├── registry.ts        # 预制体注册表（registerPrefab / getPrefab / getAllPrefabs）
└── types.ts           # PlayerPrefab 接口（createState/step/getOutput/draw）
```
> 玩家 ECS 实体接线不在本目录：`systems/player/playerEntity.ts`（loadPlayerComponents / storePlayerComponents / ensurePlayerEntity）负责。本目录继续只做外观-动画。

# 数据流

1. 依赖：流入的方向和原因

- `core/canvas`（ctx）、`core/camera`（sx/sy/view）、`core/math`（clamp）、`systems/game/gameState`（gs.time）、`systems/player`（playerController / P 本地玩家）、`systems/player/remote`（RemotePlayer）。需要这些将玩家物理状态转换为动画输出与像素绘制。
- 物理状态由 `systems/player` 产生（grounded/vy/sprint/dead/face/inv），动画 FSM 只读这些事实 + 自身记忆（previous* 边沿检测），不碰输入与碰撞。
- 玩家实体接线在 `systems/player/playerEntity.ts`（依赖 `core/ecs`：world / Position / Velocity / Collider / Player 组件 / qLocalPlayer）。

2. 本模块：经过 Prefabs/Player 做了什么

- **步进**：`stepPlayerAnimation(player, dt, signals?)` — 取该玩家预制体 + 独立动画状态（WeakMap 按玩家对象），调用 `prefab.step()`。本地玩家在物理步后调用；远程玩家房主端在 `systems/player/tick.ts`（统一 tick 管线）中调用，客机端在渲染帧调用。
- **信号**：物理步内 `systems/player` 检测到的碰撞/交互事件（`collected` / `checkpointHit` / `goalReached` / `wallBump`）通过 `FrameSignals` 传入动画步进，驱动 FSM 进入 `collectPulse` / `celebrate` / `bump` 等状态。信号只在当前物理子步内有效，不持久化。
- **绘制**：`drawPlayer()` 绘制本地玩家；`drawPlayerFor(player, style)` 绘制远程玩家（按 ID 取 `characterStyleForId` 颜色变体）。
- **FSM**：默认预制体内部状态机（idle/run/jumpRise/jumpFall/land/dash/collectPulse/bump/celebrate/dead/respawn），边沿信号（起跳/落地/死亡/复活/冲刺）由动画模块从上帧记忆推导，碰撞信号由 system 显式发射，输出 `AnimOutput`（scale/rotation/offset/alpha）参数包给绘制层。
- **实体（已落地）**：玩家物理 ECS 接线用 `core/ecs` 的 SoA 组件（Position/Velocity/Collider/
  Player/PlayerControl/PlayerInput）承载玩家状态，`qLocalPlayer` 查询可跨图使用。
  ⚠️ 旧方案"把 PlayerState 对象直接作为 Position/Velocity 组件数据"在 bitECS SoA 下**不可行**
  （`Position.x` 是按 eid 索引的数值数组，不能别名 JS 对象），已废弃。
- `characters/` 注册表管理多角色样式数据；`registry.ts` 管理多预制体组合，新增角色 = 新建目录 + 注册一行。

3. 输出：流出的方向和目的

- `stepPlayerAnimation` / `drawPlayer` / `drawPlayerFor` → `systems/game`（render/step）与 `systems/player`（tick.ts / stepPlayer）。CHARACTERS/DEFAULT_CHARACTER → `systems/ui` 角色选择界面（当前未实现，预留）。
- 玩家实体交由 `core/ecs` world 管理，`systems/level` 碰撞系统与 `systems/player`（playerEntity）查询读取。

# 架构决策记录（2025-06 · 玩家 ECS 接线后，已落地）

1. **玩家实体跨 clearWorld 存活**：切图重建只清场景实体，玩家实体由
   `systems/player/playerEntity.ts` 的 `ensurePlayerEntity` 在 setupLevel 之后重建，保证 `qLocalPlayer` 跨图可用。
2. **阶段一冻结 NetPlayerState 协议**：接线是内部存储层改造，广播仍走现有 JSON 字段。
3. **表现与机制分离**：本目录（预制体/角色样式）继续只做外观-动画；物理手感与机制
   数据（LocomotionParams / 能力集）将收敛到角色数据预设，不进动画 FSM。