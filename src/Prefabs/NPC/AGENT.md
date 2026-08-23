# NPC 文件夹 — NPC 预制体

<details>
<summary>Prefabs/NPC — NPC 绘制建模（预留，未实现）</summary>

本目录预留用于存放 NPC（非玩家角色）的绘制实现。当前游戏为纯平台跑酷，尚未实现 NPC。
</details>

```
Prefabs/NPC/
（空目录，预留）
```

# 数据流

1. 依赖：流入的方向和原因


（预留）将依赖 `core/canvas`（ctx）、`core/camera`（sx/sy/view）、`config`（NPC 数据）、`systems/game/state`（gs.time）、`Prefabs/Entities`（NPC 实体装配）等。

2. 本模块：经过 Prefabs/NPC 做了什么


（预留）NPC 预制体工厂——定义每种 NPC 的几何体/颜色/对话气泡/动画。

3. 输出：流出的方向和目的

（预留）drawXxx() 绘制函数 → `systems/game` render() 调用（或经预制体层薄委托）。