# Systems 文件夹 — 游戏系统层

<details>
<summary>systems — 玩法逻辑 + 实体行为注册表（按子系统归属）</summary>

本目录存放所有游戏玩法逻辑与实体行为。按子系统划分：game（调度中枢）、player（玩家控制）、world（世界/地图）、ui（界面）、combat（战斗）、enemy（敌人 AI）、quest（任务）。各子系统可依赖 core/config/types，也可相互读取状态但禁止循环依赖。
</details>

```
systems/
├── game/        # 调度中枢：step/render/frame 主循环编排，含 directors/、events.ts、npcs/
├── player/      # 玩家控制：movement/stats/weapons + pickups/interact/defs
├── world/       # 世界/地图：particles + defs 绘制委托
├── ui/          # 界面：HUD / 小地图 / 开始菜单
├── combat/      # 战斗系统（预留）
├── enemy/       # 敌人 AI / 生成（预留）
└── quest/       # 任务系统（预留）
```

# 数据流

1. 依赖：流入的方向和原因


`core`（画布、输入、音效、相机、数学工具）、`config`（物理参数与关卡数据）、`types`（共享类型）、`Prefabs`（通过 defs 薄委托获取绘制实现）。需要这些来执行游戏逻辑、渲染画面、处理输入。

2. 本模块：经过 systems 做了什么


接收输入（core/input）→ 更新玩家物理（player）→ 更新世界粒子（world）→ 编排主循环（game/step）→ 渲染画面（game/render 调用各 drawXxx）。game 是唯一调度中枢，按固定时间步长（1/120s）驱动所有子系统。

3. 输出：流出的方向和目的

游戏画面绘制到 canvas（通过 core/canvas 的 ctx）。音效经 core/audio 播放。`systems/*/defs.ts` 将绘制委托转发到 Prefabs 实际建模层。