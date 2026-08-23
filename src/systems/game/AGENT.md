# Game 文件夹 — 调度中枢

<details>
<summary>systems/game — 主循环编排 + 全局状态/物理模式单例</summary>

本目录存放游戏调度中枢：全局状态单例（gameState.ts）、物理模式选择器（gameMode.ts）、主循环 step/render/frame 函数、按键回调 handleKeyDown、联机网络事件绑定。负责按固定时间步长（1/120s）驱动 player/particles/interactions 子系统，并在每帧编排所有绘制函数的调用顺序。
</details>

```
systems/game/
├── index.ts        # step/render/frame 主循环 + handleKeyDown 输入回调 + startGame/startLoop
│                   # + 联机事件绑定（wireNetEvents）+ PlayerController 事件订阅（wirePlayerEvents）
├── gameState.ts    # 全局游戏状态 gs（GameState 单例，规避 systems 循环依赖）
└── gameMode.ts     # 物理模式选择器 getMode/setMode（tuned / classic，独立于 gs）
```

# 数据流

1. 依赖：流入的方向和原因


`core`（canvas/camera/audio/input/math/netBus）、`config`（PHYS/currentMap/cpPoint）、`systems/level`（updateMotion/updateLaserTimer/updateCollisionSystem）、`systems/player`（playerController / stepPlayerGeneric / remote 远程玩家）、`systems/interactions`（initCollisionHooks + 坐标版收集/检查点检测）、`net`（room/net）、`systems/particles`（stepParticles/spawnFx）、`systems/ui`（drawHUD/小地图/syncUI）、`Prefabs`（直接导入 Player/Scenes 的 drawXxx 函数）。需要这些来执行每帧的物理步进与画面渲染。

2. 本模块：经过 systems/game 做了什么


主循环帧函数 frame() 按固定时间步长（1/120s）积累并调用 step(dt)，然后调用 render(dt)。step() 更新时钟、关卡级系统（updateMotion/updateLaserTimer）、粒子，然后由 playerController.step(dt, getMode(), true) 驱动本地玩家物理（输入注入 → 物理步 → 碰撞事件 → 动画 → 曳光），死亡/复活由 controller 内部计时并 emit 事件（wirePlayerEvents 更新 gs/sfx/粒子/netBus）。联机模式：房主通过 stepRemoteClients 逐个模拟客机玩家物理（stepPlayerGeneric + 坐标版交互），并每 2 帧广播权威状态（broadcastHostState，含玩家/光球/gl 统计）；客机向房主发送输入（net.sendInput）、本地预测后由 state 事件做硬矫正（applyCorrection / applyDeathAuthority）。render() 先 syncUI 同步菜单/暂停/大厅场景，再按序绘制背景、世界、玩家（本地 + 远程）、HUD、小地图。handleKeyDown() 将按键分发到游戏逻辑（开始/暂停/跳跃缓冲/物理切换/复活/音效开关）。

3. 输出：流出的方向和目的


游戏画面渲染到 canvas 2D context。音效通过 core/audio 播放。全局状态 gs 供 player/particles/ui 模块读取和写入；物理模式经 gameMode 的 getMode 供 player/ui/level 读取。PlayerController 事件（died/jumped/dashed/landed/respawned）→ wirePlayerEvents → gs.deaths/shake/flash、sfx、spawnFx、netBus 广播。联机状态经 net.sendInput / net.sendHostState 与客机同步。