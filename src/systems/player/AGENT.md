# Player 文件夹 — 玩家控制

<details>
<summary>systems/player — PlayerController + 物理引擎 + 远程玩家（触发事件已事件化）</summary>

本目录存放玩家控制逻辑：PlayerController（玩家私有状态 + 生命周期 + 事件产出）、纯物理引擎（移动/跳跃/冲刺/重力、平台推挤）、远程玩家管理（联机）。玩家状态由 PlayerController 私有持有，Game/UI 通过 controller 接口访问，不再直接读写裸状态。触发事件（危险物致死/光球收集/检查点激活/NOVA 登顶）已迁至事件驱动架构：`systems/level/CollisionSystem`（检测 + 分发）+ `systems/interactions/CollisionHooks`（订阅处理）。
</details>

```
systems/player/
├── PlayerController.ts  # 玩家控制类：私有 PlayerState + setInput + step + die/respawn + 网络矫正 + 事件产出
├── index.ts             # 物理引擎（stepPlayerGeneric 纯函数）+ playerController 单例 + P（只读向后兼容引用）
└── remote.ts            # 远程玩家管理：联机模式下的其他玩家状态 + 输入缓冲
```

# 数据流

1. 依赖：流入的方向和原因


`core/input`（keys 键盘状态）、`core/audio`（sfx 音效）、`core/math`（clamp）、`config`（PHYS/RUN/SPRINT/currentMap/cpPoint）、`core/ecs`（world 查询移动平台实体）、`systems/level`（colliderWorldRect / aabbOverlap / updateCollisionSystem）、`systems/game/gameMode`（getMode 物理模式）、`systems/particles`（trail 曳光）、`Prefabs/Player`（stepPlayerAnimation 动画步进）。需要这些来执行物理计算、步进动画、生成曳光。

2. 本模块：经过 systems/player 做了什么

PlayerController 每帧被 Game 调用：`setInput()` 注入输入 → `step(dt, mode, isLocal)` 内部执行 —— 死亡计时/复活（emit 'respawned'）→ 物理步（stepPlayerGeneric 纯函数）→ 跳跃/冲刺/硬着陆边沿检测（emit 'jumped'/'dashed'/'landed'）→ updateCollisionSystem 触发碰撞事件 → 动画步进 → 冲刺曳光。死亡（emit 'died'，含死亡计数）。客机权威矫正（applyCorrection / applyDeathAuthority）。`stepPlayerGeneric()` 保持纯函数：只解析物理，不含音效/粒子/gs 副作用。

3. 输出：流出的方向和目的


PlayerEvent（die/respawn/jump/dash/land 事件）→ `systems/game`（wirePlayerEvents 订阅：更新 gs.deaths/shake/flash、播 sfx、spawnFx、发 netBus）。playerController.getState() → `systems/game`（主循环读取位置/速度/死亡状态、网络广播）、`systems/ui`（HUD/小地图）、`Prefabs/Player`（drawPlayer 读取位置/形变/闪烁）、`Prefabs/Scenes/atmosphere`（曳光绘制）、`Prefabs/Entities/playerEntity`（ECS 实体注册）。远程玩家由 `remote.ts` 的 RemotePlayer 独立管理（不经 playerController）。