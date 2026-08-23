# Enemy 文件夹 — 敌人 AI / 生成

<details>
<summary>systems/enemy — 敌人 AI / 生成系统（预留，未实现）</summary>

本目录预留用于存放敌人系统：AI 行为树、生成波次、Boss 脚本、状态机。当前游戏为纯平台跑酷，尚未实现敌人系统。
</details>

```
systems/enemy/
（空目录，预留）
```

# 数据流

1. 依赖：流入的方向和原因


（预留）将依赖 `core`（数学/音效）、`config`（敌人属性）、`types`（敌人类型）、`systems/player`（玩家位置与状态）、`systems/particles`（粒子特效）、`Prefabs/Enemy`（敌人绘制）。

2. 本模块：经过 enemy 做了什么


（预留）敌人系统——定义 AI 状态机（巡逻/追击/攻击/死亡），管理生成波次与 Boss 战阶段。

3. 输出：流出的方向和目的

（预留）敌人位置/状态 → `systems/game` 主循环；敌人绘制 → `Prefabs/Enemy` 建模；敌人死亡 → `systems/particles` 粒子特效 + `systems/player` 计分。