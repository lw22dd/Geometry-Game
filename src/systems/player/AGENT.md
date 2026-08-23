# Player 文件夹 — 玩家控制

<details>
<summary>systems/player — 玩家物理/碰撞/生死/交互/拾取</summary>

本目录存放玩家控制逻辑：物理运动（移动/跳跃/冲刺/重力）、碰撞检测（平台/尖刺/激光/坠落）、生死与复活、交互（NOVA 登顶）、拾取（光球/检查点）。绘制委托通过 defs.ts 转发到 Prefabs/Player。
</details>

```
systems/player/
├── index.ts      # 玩家状态 P + 物理步 stepPlayer + 生死 die/respawn + 碰撞 buildSolids/boxHit
├── defs.ts       # 绘制委托注册表（转发到 Prefabs/Player）
├── pickups.ts    # 拾取行为：updateOrbs（光球收集）+ updateCheckpoints（检查点激活）
└── interact.ts   # 交互逻辑：updateNova（NOVA 星终点判定）
```

# 数据流

1. 依赖：流入的方向和原因


`core/input`（keys 键盘状态）、`core/audio`（sfx 音效）、`core/math`（clamp）、`config`（PHYS/RUN/SPRINT/MAP_W/MAP_H/关卡数据）、`systems/game/state`（gs 全局状态 + getMode 物理模式）、`systems/world/particles`（burstDeath/dust/sparkle/cpFx/confetti/trail）。需要这些来执行物理计算、播放音效、生成粒子特效。

2. 本模块：经过 systems/player 做了什么


每帧 stepPlayer(dt) 执行：读取输入 → 水平加速度 → 跳跃缓冲 → 重力（双模式）→ 水平碰撞 → 垂直碰撞 → 形变恢复 → 无敌计时 → 冲刺曳光 → 尖刺/激光/坠落判定 → 死亡/复活 → 光球收集 → 检查点激活 → NOVA 登顶判定。buildSolids() 每帧构建带移动平台当前位置的碰撞体列表。

3. 输出：流出的方向和目的

P（玩家状态）→ `systems/game`（主循环读取位置/速度/死亡状态）、`systems/world/defs`（drawTrail 读取 P.sprint/face/position）、`systems/ui`（HUD/小地图）、`Prefabs/Player`（drawPlayer 读取位置/形变/闪烁）。die/respawn → `systems/game`（handleKeyDown 的 R 键复活）。