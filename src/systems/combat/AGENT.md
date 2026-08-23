# Combat 文件夹 — 战斗系统

<details>
<summary>systems/combat — 战斗系统（预留，未实现）</summary>

本目录预留用于存放战斗系统：开火/爆炸/放置逻辑、投射物行为（projectiles.ts）、油桶/地雷（barrels.ts）等。当前游戏为纯平台跑酷，尚未实现战斗系统。
</details>

```
systems/combat/
（空目录，预留）
```

# 数据流

1. 依赖：流入的方向和原因


（预留）将依赖 `core`（输入/音效/数学）、`config`（武器数据）、`types`（战斗相关类型）、`systems/player`（玩家状态）、`systems/particles`（粒子特效）。

2. 本模块：经过 combat 做了什么


（预留）战斗系统——处理武器开火逻辑、投射物运动与碰撞、爆炸范围与伤害、油桶/地雷触发器。

3. 输出：流出的方向和目的

（预留）战斗事件 → `systems/game` 主循环；投射物/爆炸粒子 → `systems/particles` 粒子系统；伤害 → `systems/player` 生命值。