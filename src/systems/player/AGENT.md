# Player 文件夹 — 玩家控制

<details>
<summary>systems/player — 玩家物理/生死/联机（触发事件已事件化）</summary>

本目录存放玩家控制逻辑：物理运动（移动/跳跃/冲刺/重力）、物理分辨率（平台推挤）、生死与复活、远程玩家管理（联机）。触发事件（危险物致死/光球收集/检查点激活/NOVA 登顶）已迁至事件驱动架构：`systems/level/CollisionSystem`（检测 + 分发）+ `systems/interactions/CollisionHooks`（订阅处理）。
</details>

```
systems/player/
├── index.ts      # 玩家状态 P + 物理步 stepPlayer + 生死 die/respawn + 平台推挤
└── remote.ts     # 远程玩家管理：联机模式下的其他玩家状态 + 输入缓冲
```

# 数据流

1. 依赖：流入的方向和原因


`core/input`（keys 键盘状态）、`core/audio`（sfx 音效）、`core/math`（clamp）、`config`（PHYS/RUN/SPRINT/currentMap/cpPoint）、`core/ecs`（world 查询移动平台实体）、`systems/level`（colliderWorldRect / aabbOverlap / updateCollisionSystem）、`systems/game/state`（gs 全局状态 + getMode 物理模式）、`systems/particles`（part 发射粒子）、`Prefabs/Fx`（spawnFx + FX 特效预设）。需要这些来执行物理计算、播放音效、生成粒子特效。

2. 本模块：经过 systems/player 做了什么


每帧 stepPlayer(dt) 执行：读取输入 → 水平加速度 → 跳跃缓冲 → 重力（双模式）→ 水平碰撞推挤 → 垂直碰撞落地 → 形变恢复 → 无敌计时 → 冲刺曳光 → 坠落判定 → 调用 updateCollisionSystem 触发事件 → 动画步进。buildSolids() 每帧从 currentMap.solids 与 ECS 移动平台（Position + Collider + PathMotion）构建碰撞体列表，仅供平台推挤使用（触发事件不在此处理）。

3. 输出：流出的方向和目的


P（玩家状态）→ `systems/game`（主循环读取位置/速度/死亡状态）、`systems/ui`（HUD/小地图）、`Prefabs/Player`（drawPlayer 读取位置/形变/闪烁）。die/respawn → `systems/game`（handleKeyDown 的 R 键复活）、`systems/interactions/CollisionHooks`（碰撞事件致死回调调用 die）。