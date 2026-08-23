# Player 文件夹 — 玩家控制

<details>
<summary>systems/player — 玩家物理/碰撞/生死/联机</summary>

本目录存放玩家控制逻辑：物理运动（移动/跳跃/冲刺/重力）、碰撞检测（平台/尖刺/激光/坠落）、生死与复活、远程玩家管理（联机）。交互触发（光球收集/检查点激活/NOVA 登顶）已迁至 `systems/interactions/`。
</details>

```
systems/player/
├── index.ts      # 玩家状态 P + 物理步 stepPlayer + 生死 die/respawn + 碰撞 buildSolids/boxHit
└── remote.ts     # 远程玩家管理：联机模式下的其他玩家状态 + 输入缓冲
```

# 数据流

1. 依赖：流入的方向和原因


`core/input`（keys 键盘状态）、`core/audio`（sfx 音效）、`core/math`（clamp）、`config`（PHYS/RUN/SPRINT/currentMap/cpPoint）、`core/ecs`（world 查询移动平台/激光实体）、`systems/level`（colliderWorldRect）、`systems/game/state`（gs 全局状态 + getMode 物理模式）、`systems/particles`（part 发射粒子）、`Prefabs/Fx`（spawnFx + FX 特效预设）。需要这些来执行物理计算、播放音效、生成粒子特效。

2. 本模块：经过 systems/player 做了什么


每帧 stepPlayer(dt) 执行：读取输入 → 水平加速度 → 跳跃缓冲 → 重力（双模式）→ 水平碰撞 → 垂直碰撞 → 形变恢复 → 无敌计时 → 冲刺曳光 → 尖刺/激光/坠落判定 → 死亡/复活 → 光球收集 → 检查点激活 → NOVA 登顶判定。buildSolids() 每帧从 currentMap.solids 与 ECS 移动平台（Position + Collider + PathMotion）构建碰撞体列表。

3. 输出：流出的方向和目的

P（玩家状态）→ `systems/game`（主循环读取位置/速度/死亡状态）、`systems/ui`（HUD/小地图）、`Prefabs/Player`（drawPlayer 读取位置/形变/闪烁）。die/respawn → `systems/game`（handleKeyDown 的 R 键复活）。