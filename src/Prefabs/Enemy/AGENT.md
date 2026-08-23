# Enemy 文件夹 — 敌人预制体

<details>
<summary>Prefabs/Enemy — 敌人绘制建模（预留，未实现）</summary>

本目录预留用于存放敌人预制体（含 Boss）的绘制实现。当前游戏为纯平台跑酷，尚未实现敌人系统。
</details>

```
Prefabs/Enemy/
（空目录，预留）
```

# 数据流

1. 依赖：流入的方向和原因


（预留）将依赖 `core/canvas`（ctx）、`core/camera`（sx/sy/view）、`config`（敌人属性数据）、`systems/game/gameState`（gs.time）、`systems/player`（playerController 玩家位置）等。

2. 本模块：经过 Prefabs/Enemy 做了什么


（预留）敌人预制体工厂——定义每种敌人的几何体/颜色/动画/攻击特效。Boss 预制体含多阶段形态变化。

3. 输出：流出的方向和目的

（预留）drawXxx() 绘制函数 → `systems/enemy/defs.ts`（薄委托）→ `systems/game` render() 调用。