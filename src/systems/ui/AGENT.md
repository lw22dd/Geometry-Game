# Ui 文件夹 — 界面系统

<details>
<summary>systems/ui — HUD / 小地图 / 开始菜单</summary>

本目录存放所有用户界面绘制：游戏内 HUD 面板（光球/速度/跳跃/物理模式/加速/用时/死亡计数）、操作提示、Toast 通知、胜利横幅、小地图（240×72 关卡鸟瞰图+视口框）、开始菜单（标题+霓虹按钮+操作说明）。
</details>

```
systems/ui/
├── index.ts      # drawHUD / drawMinimap / drawMenu / checkMenuClick
└── styles/       # UI 样式常量（预留）
```

# 数据流

1. 依赖：流入的方向和原因


`core/canvas`（ctx/VW/VH）、`core/camera`（cam）、`core/math`（rr/fmt）、`config`（orbs/solids/movers/spikes/lasers/cps/NOVA/MAP_W/MAP_H/PHYS）、`systems/game/state`（gs/getMode）、`systems/player`（P）。需要这些来读取游戏状态、关卡数据、坐标定位、绘制圆角矩形和格式化时间。

2. 本模块：经过 systems/ui 做了什么


drawHUD：绘制左上角统计面板（光球/速度/跳跃/物理/加速/用时/死亡）、底部操作提示、Toast 浮动提示、胜利横幅与统计数据。drawMinimap：绘制 252px 宽的小地图（平台/尖刺/激光/光球/检查点/NOVA/玩家/视口框）。drawMenu：绘制开始菜单（标题/副标题/操作说明/目标提示/霓虹开始按钮）。checkMenuClick：检测鼠标点击是否在按钮区域内。

3. 输出：流出的方向和目的

绘制函数 → `systems/game` render() 调用。checkMenuClick → `main.ts` 点击事件处理（菜单中点击按钮时调用 startGame）。