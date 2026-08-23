# Directors 文件夹 — 导演系统

<details>
<summary>systems/game/directors — 导演系统（预留，未实现）</summary>

本目录预留用于存放导演系统（Director）——负责关卡流程控制、事件触发、过场动画编排等高层调度逻辑。当前游戏为纯平台跑酷，尚未实现导演系统。
</details>

```
systems/game/directors/
（空目录，预留）
```

# 数据流

1. 依赖：流入的方向和原因


（预留）将依赖 `systems/game` 状态、`systems/player` 玩家状态、`config` 关卡数据。

2. 本模块：经过 directors 做了什么


（预留）导演系统——监控游戏事件，触发关卡脚本（Camera 运镜、Boss 出场、光球收集完成后解锁路径等）。

3. 输出：流出的方向和目的

（预留）导演指令 → `systems/game` 主循环执行关卡流程切换。