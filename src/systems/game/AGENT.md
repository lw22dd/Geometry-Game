# Game 文件夹 — 调度中枢

<details>
<summary>systems/game — 主循环编排：step/render/frame 调度所有子系统</summary>

本目录存放游戏调度中枢：游戏全局状态（state.ts）、事件常量（events.ts）、主循环 step/render/frame 函数、按键回调 handleKeyDown。负责按固定时间步长（1/120s）驱动 player/world 子系统，并在每帧编排所有绘制函数的调用顺序。
</details>

```
systems/game/
├── index.ts        # step/render/frame 主循环 + handleKeyDown 输入回调 + startGame/startLoop
├── state.ts        # 全局游戏状态 gs（GameState）+ 物理模式选择器（getMode/setMode）
├── events.ts       # 游戏事件常量 EV + netBus 发射辅助
├── directors/      # 导演系统（预留）
└── npcs/           # NPC 系统（预留）
```

# 数据流

1. 依赖：流入的方向和原因


`core`（canvas/camera/audio/math）、`config`（PHYS/movers/关卡数据）、`systems/player`（P/stepPlayer/respawn）、`systems/world`（stepParticles + 绘制函数）、`systems/ui`（HUD/小地图/菜单）、`Prefabs`（通过 defs 转发 Player/Scenes 绘制）。需要这些来执行每帧的物理步进与画面渲染。

2. 本模块：经过 systems/game 做了什么


主循环帧函数 frame() 按固定时间步长积累并调用 step(dt)，然后调用 render(dt)。step() 更新时钟、移动平台、粒子、toast，然后调度玩家物理。render() 根据当前画面（menu/playing）绘制背景、世界、HUD、小地图或菜单。handleKeyDown() 将按键分发到游戏逻辑（跳跃缓冲/物理切换/音效开关/复活/开始游戏）。

3. 输出：流出的方向和目的

游戏画面渲染到 canvas 2D context。音效通过 core/audio 播放。全局状态 gs 供 player/world/ui 模块读取和写入。