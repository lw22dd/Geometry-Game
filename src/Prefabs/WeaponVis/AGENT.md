# WeaponVis 文件夹 — 武器外观预制体

<details>
<summary>Prefabs/WeaponVis — 武器外观绘制建模（预留，未实现）</summary>

本目录预留用于存放武器外观预制体（枪械/近战/投掷武器等）的绘制实现。当前游戏为纯平台跑酷，尚未实现武器系统。
</details>

```
Prefabs/WeaponVis/
（空目录，预留）
```

# 数据流

1. 依赖：流入的方向和原因


（预留）将依赖 `core/canvas`（ctx）、`core/camera`（sx/sy/view）、`config`（武器属性数据）、`systems/player`（玩家武器状态）、`systems/game/state`（gs.time）等。

2. 本模块：经过 Prefabs/WeaponVis 做了什么


（预留）武器外观预制体工厂——定义每种武器的视觉模型（开火闪光、弹道轨迹、枪口火焰、换弹动画）。

3. 输出：流出的方向和目的

（预留）drawXxx() 绘制函数 → `systems/player/defs.ts`（薄委托）→ `systems/game` render() 调用。