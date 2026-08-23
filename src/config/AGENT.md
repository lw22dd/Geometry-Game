# Config 文件夹 — 纯数据注册表

<details>
<summary>config — 物理参数 / 关卡布局 / 背景装饰等纯数据</summary>

本目录存放所有游戏配置数据：双物理模式参数、240×72 格八章节关卡布局（平台、尖刺、激光、光球、检查点、NOVA 星、提示文字、装饰方块）、视差背景形状种子数据。只依赖 types，不引用任何 systems 或 core。
</details>

```
config/
├── index.ts         # barrel 导出
├── physics.ts       # 双物理模式（tuned / classic）、RUN/SPRINT/JUMP_H/MAP_W/MAP_H
├── level.ts         # 240×72 八章节关卡：solids/movers/spikes/lasers/orbs/cps/NOVA/hints/decos
└── background.ts    # 视差背景：farShapes 光斑 + midShapes 旋转形状（mulberry 种子生成）
```

# 数据流

1. 依赖：流入的方向和原因


`types`（共享类型）和 `core/math`（mulberry RNG 种子函数）。需要类型定义来描述关卡数据结构，RNG 种子来生成确定的背景形状。

2. 本模块：经过 config 做了什么


定义并导出所有游戏常量、关卡几何数据、物理参数。`level.ts` 中的 R(x,y,w,h) 工厂函数将原始坐标转换为 Rect 碰撞体数组。`background.ts` 在模块加载时用种子 RNG 生成固定序列的视差形状。

3. 输出：流出的方向和目的

导出常量与数据供 `systems/`（玩家物理、世界绘制、HUD、小地图、碰撞检测）和 `Prefabs/`（场景绘制）读取。`systems/game` 读取 PHYS 确定物理模式，`systems/player` 读取 PHSN 和关卡数据执行碰撞与交互。