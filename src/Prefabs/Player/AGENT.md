# Player 文件夹 — 玩家角色预制体注册表

<details>
<summary>Prefabs/Player — 玩家「外观-动画」组合：注册表 + 默认预制体 + ECS 实体</summary>

本目录存放玩家角色预制体体系：注册表（registry）按 id 选择预制体；每个预制体 = 一个动画 FSM + 纯绘制函数；playerEntity.ts 将玩家控制器状态注册为 ECS 实体。system 只通过 `index.ts` 的公开 API（`stepPlayerAnimation` / `drawPlayer` / `drawPlayerFor`）与预制体交互，不 import 具体实现。
</details>

```
Prefabs/Player/
├── characters/        # 角色样式注册表（纯数据）
│   ├── default.ts     #   默认角色「霓虹跑者」数据 + CharacterStyle 接口定义
│   └── index.ts       #   CHARACTERS 数组 + DEFAULT_CHARACTER
├── default/           # 默认预制体（霓虹跑者）
│   ├── animation.ts       #   动画 FSM 步进（边沿检测 + 状态转换 + 输出合成）
│   ├── defaultPrefab.ts   #   组合：实现 PlayerPrefab 接口的 defaultPrefab 对象
│   ├── render.ts          #   纯绘制（只读 AnimOutput + CharacterStyle）
│   └── states.ts          #   动画状态枚举 + 转换表（纯数据）
├── index.ts           # 统一出口：每玩家动画状态 WeakMap + step/draw/getOutput API + characterStyleForId
├── playerEntity.ts    # 玩家 ECS 实体注册（Position/Velocity/Collider/Tags 引用玩家状态）
├── registry.ts        # 预制体注册表（registerPrefab / getPrefab / getAllPrefabs）
└── types.ts           # PlayerPrefab 接口（createState/step/getOutput/draw）
```

# 数据流

1. 依赖：流入的方向和原因

- `core/canvas`（ctx）、`core/camera`（sx/sy/view）、`core/math`（clamp）、`systems/game/gameState`（gs.time）、`systems/player`（playerController / P 本地玩家）、`systems/player/remote`（RemotePlayer）。需要这些将玩家物理状态转换为动画输出与像素绘制。
- 物理状态由 `systems/player` 产生（grounded/vy/sprint/dead/face/inv），动画 FSM 只读这些事实 + 自身记忆（previous* 边沿检测），不碰输入与碰撞。
- `playerEntity.ts` 依赖 `core/ecs`（world）、`components/`（Position / Velocity / Collider / Tags）、`systems/player`（playerController.getState()）。

2. 本模块：经过 Prefabs/Player 做了什么

- **步进**：`stepPlayerAnimation(player, dt, signals?)` — 取该玩家预制体 + 独立动画状态（WeakMap 按玩家对象），调用 `prefab.step()`。本地玩家在物理步后调用；远程玩家房主端在 `stepRemoteClients` 中调用，客机端在渲染帧调用。
- **信号**：物理步内 `systems/player` 检测到的碰撞/交互事件（`collected` / `checkpointHit` / `goalReached` / `wallBump`）通过 `FrameSignals` 传入动画步进，驱动 FSM 进入 `collectPulse` / `celebrate` / `bump` 等状态。信号只在当前物理子步内有效，不持久化。
- **绘制**：`drawPlayer()` 绘制本地玩家；`drawPlayerFor(player, style)` 绘制远程玩家（按 ID 取 `characterStyleForId` 颜色变体）。
- **FSM**：默认预制体内部状态机（idle/run/jumpRise/jumpFall/land/dash/collectPulse/bump/celebrate/dead/respawn），边沿信号（起跳/落地/死亡/复活/冲刺）由动画模块从上帧记忆推导，碰撞信号由 system 显式发射，输出 `AnimOutput`（scale/rotation/offset/alpha）参数包给绘制层。
- **实体注册**：`initPlayerEntity()` — 将 `playerController.getState()` 的 PlayerState 对象直接作为 Position / Velocity 组件数据（既有代码读写 P 无需修改），外加 Collider 与 Tags（`'player'` 标签）。
- `characters/` 注册表管理多角色样式数据；`registry.ts` 管理多预制体组合，新增角色 = 新建目录 + 注册一行。

3. 输出：流出的方向和目的

- `stepPlayerAnimation` / `drawPlayer` / `drawPlayerFor` → `systems/game`（render/step）与 `systems/player`（stepPlayer）。CHARACTERS/DEFAULT_CHARACTER → `systems/ui` 角色选择界面（当前未实现，预留）。
- `initPlayerEntity` / `getPlayerEntity` → `config/level` initECSFromLevel() 调用；实体交由 `core/ecs` world 管理，`systems/level` 碰撞系统检测。