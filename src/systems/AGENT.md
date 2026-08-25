# Systems 文件夹 — 游戏系统层

<details>
<summary>systems — 玩法逻辑 + 实体行为注册表（按子系统归属）</summary>

本目录存放所有游戏玩法逻辑与实体行为。按子系统划分：game（调度中枢）、player（玩家控制）、interactions（交互触发）、ui（界面）、combat（战斗）、enemy（敌人 AI）、quest（任务）。另含粒子供运行时系统与共享交互系统。各子系统可依赖 core/config/types，也可相互读取状态但禁止循环依赖。
</details>

```
systems/
├── game/  # 调度中枢：gameState（gs）+ gameMode（物理模式）/ 主循环 step/render/frame
├── player/  # 玩家控制：PlayerController 生命周期 + 物理引擎（stepPlayerGeneric）+ remote 联机
├── level/  # 关卡级系统：路径运动（MotionSystem）、激光计时（LaserTimerSystem）、碰撞箱工具（OverlapUtils）
├── interactions/  # 玩法交互触发系统：Collect（光球）/ RespawnPoint（检查点）/ Goal（登顶）
│     # 三个系统通过 level/OverlapUtils 的 pointInCollider 检测触发，支持传目标坐标供远程玩家复用
├── particles.ts  # 粒子运行时系统：池 / trail / part() / stepParticles()
├── ui/  # 界面：HUD / 小地图 / 菜单 / 暂停 / 大厅
│   └── styles/  # 空目录
├── combat/  # 战斗系统（预留）
├── enemy/  # 敌人 AI / 生成（预留）
├── quest/  # 任务系统（预留）
├── AGENT.md
├── items/  # 物品系统：backpack（背包运行时 + 道具注册表）+ hook（钩锁发射/滑索/瞄准）
└── uiAtmosphere.ts  # 氛围 UI 运行时：AtmoTheme 构建 + 发光粒子 + 主循环渲染
```

# 数据流

1. 依赖：流入的方向和原因


`core`（画布、输入、音效、相机、数学工具）、`config`（物理参数与关卡数据）、`types`（共享类型）、`Prefabs`（直接导入画函数 drawXxx 与 spawnFx 特效发射器）。需要这些来执行游戏逻辑、渲染画面、处理输入。

2. 本模块：经过 systems 做了什么


接收输入（core/input）→ 更新玩家物理（player）→ 步进粒子（particles）→ 编排主循环（game/step）→ 渲染画面（game/render 调用各 drawXxx）。game 是唯一调度中枢，按固定时间步长（1/120s）驱动所有子系统。

3. 输出：流出的方向和目的

游戏画面绘制到 canvas（通过 core/canvas 的 ctx）。音效经 core/audio 播放。`systems/game`（render 编排）直接调用 `Prefabs/` 各 drawXxx 函数完成绘制，不再经过 defs 委托层。