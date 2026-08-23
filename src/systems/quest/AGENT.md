# Quest 文件夹 — 任务系统

<details>
<summary>systems/quest — 任务系统（预留，未实现）</summary>

本目录预留用于存放任务系统：任务进度状态机（questTracker）、任务条件检测、奖励解锁。当前游戏为纯平台跑酷，尚未实现任务系统。
</details>

```
systems/quest/
（空目录，预留）
```

# 数据流

1. 依赖：流入的方向和原因


（预留）将依赖 `core`（事件/数学）、`config`（任务定义）、`types`（任务类型）、`systems/player`（玩家行为）、`systems/game/gameState`（全局状态）。

2. 本模块：经过 quest 做了什么


（预留）任务系统——定义任务进度状态机（未开始/进行中/已完成/已领取），检测光球收集、通关时间、死亡次数等条件，触发奖励。

3. 输出：流出的方向和目的

（预留）任务状态更新 → `systems/game` 主循环；任务 UI → `systems/ui` 显示；任务奖励 → `systems/player` 解锁能力。