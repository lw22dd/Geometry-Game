# Npcs 文件夹 — NPC 系统

<details>
<summary>systems/game/npcs — NPC 行为系统（预留，未实现）</summary>

本目录预留用于存放 NPC（非玩家角色）的行为逻辑、对话、交互处理。当前游戏为纯平台跑酷，尚未实现 NPC。
</details>

```
systems/game/npcs/
（空目录，预留）
```

# 数据流

1. 依赖：流入的方向和原因


（预留）将依赖 `core`（输入/音效）、`config`（关卡数据）、`types`（共享类型）、`systems/player`（交互触发）。

2. 本模块：经过 npcs 做了什么


（预留）NPC 行为注册表——定义 NPC 的对话树、移动模式、交互响应。

3. 输出：流出的方向和目的

（预留）NPC 状态更新 → `systems/game` 主循环执行；NPC 绘制 → `Prefabs/NPC` 建模。