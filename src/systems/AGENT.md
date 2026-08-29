# Systems 文件夹 — 游戏系统层

<details>
<summary>systems — 玩法逻辑 + 实体行为注册表（按子系统归属）</summary>

本目录存放所有游戏玩法逻辑与实体行为。按子系统划分：game（调度中枢）、player（玩家控制）、interactions（交互触发）、ui（界面）、combat（战斗）、enemy（敌人 AI）、quest（任务）。另含粒子供运行时系统与共享交互系统。各子系统可依赖 core/config/types，也可相互读取状态但禁止循环依赖。
</details>

```
systems/
├── animation/  # 统一实体动画系统：stepAnimation 遍历（Position+Animator）实体，步进各控制器 FSM
├── game/  # 调度中枢：gameState（gs）+ gameMode（物理模式）/ 主循环 step/render/frame
├── player/  # 玩家控制：PlayerController + 物理引擎（stepPlayerGeneric）+ 玩家 ECS 实体（playerEntity）+ 统一 tick 管线（tick.ts）+ 控制权仲裁（controlArbiter）+ remote 联机
├── level/  # 关卡级系统：路径运动（MotionSystem）、弹簧平台（SpringSystem）、激光计时（LaserTimerSystem）、碰撞检测（CollisionSystem）、光环场（AuraSystem）、碰撞箱工具（OverlapUtils）
├── interactions/  # 玩法交互触发系统：CollisionHooks（碰撞事件订阅）+ 坐标版 Collect / RespawnPoint / Goal / 拾取物（ItemPickupSystem）/ 危险检测（hazard.ts）
│     # 坐标版系统供远程玩家（host 模拟）复用；危险/拾取均走 level/OverlapUtils 检测
├── effects/  # 契约层：影响来源 → PlayerRequest → applyEffect 结算 → verbs 写入玩家（另含 TriggerSystem 触发注册表）
├── particles.ts  # 粒子运行时系统：池 / trail / part() / stepParticles()
├── postfx.ts  # 后期特效管线：Bloom / 色散 / 暗角 / 扫描线 / 颗粒（主场景画完后调用）
├── ui/  # 界面：菜单 / 准备 / 暂停 / 大厅 / HUD / 小地图 / 图鉴 / 操作说明 + 共享图元/图标/主题
│   └── styles/  # 空目录
├── combat/  # 战斗系统（预留）
├── enemy/  # 敌人 AI / 生成（预留）
├── quest/  # 任务系统（预留）
├── AGENT.md
├── items/  # 物品系统：backpack（背包运行时 + 道具注册表）+ hook（钩锁发射/滑索/瞄准）+ activeItem（S7 主动道具槽位）
└── uiAtmosphere.ts  # 氛围 UI 运行时：AtmoTheme 构建 + 发光粒子 + 主循环渲染
```

# 数据流

1. 依赖：流入的方向和原因


`core`（画布、输入、音效、相机、数学工具）、`config`（物理参数与关卡数据）、`types`（共享类型）、`Prefabs`（直接导入画函数 drawXxx 与 spawnFx 特效发射器）。需要这些来执行游戏逻辑、渲染画面、处理输入。

2. 本模块：经过 systems 做了什么


接收输入（core/input）→ 更新玩家物理（player）→ 步进关卡系统（level）→ 步进实体动画（animation）→ 步进粒子（particles）→ 编排主循环（game/step）→ 渲染画面（game/render 调用各 drawXxx）。game 是唯一调度中枢，按固定时间步长（1/120s）驱动所有子系统。

3. 输出：流出的方向和目的

游戏画面绘制到 canvas（通过 core/canvas 的 ctx）。音效经 core/audio 播放。`systems/game`（render 编排）直接调用 `Prefabs/` 各 drawXxx 函数完成绘制，不再经过 defs 委托层。