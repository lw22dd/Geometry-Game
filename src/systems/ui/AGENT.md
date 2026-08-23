# Ui 文件夹 — 界面系统

<details>
<summary>systems/ui — HUD / 小地图 / 菜单 / 暂停 / 大厅</summary>

本目录存放所有用户界面绘制与场景构建：游戏内 HUD 面板（光球/速度/跳跃/物理模式/加速/用时/死亡计数）、操作提示、Toast 通知、胜利横幅、小地图（240×72 关卡鸟瞰图+视口框）、开始菜单（标题+霓虹按钮+操作说明）、暂停菜单（ESC 暂停 + 联机创建/加入房间按钮）、联机大厅（昵称/IP/端口输入框 + 连接/返回按钮）。场景通过 `core/uiComponent` UIManager 注册与切换。
</details>

```
systems/ui/
├── index.ts      # drawHUD / drawMinimap + buildMenuScene（菜单场景构建）
├── lobby.ts      # 联机大厅：创建/加入房间场景（TextInput ×3 + Button ×2）
├── pause.ts      # 暂停场景：暂停菜单 + 联机创建/加入房间按钮
├── scenes.ts     # UI 场景组合根：注册全部场景到 UIManager，回调注入防循环依赖
└── styles/       # UI 样式常量（预留）
```

# 数据流

1. 依赖：流入的方向和原因


`core/canvas`（ctx/VW/VH）、`core/camera`（cam）、`core/math`（rr/fmt）、`config`（currentMap/PHYS）、`components`（Position/Collider/PathMotion/Collectible/RespawnPoint/Goal 查询 ECS）、`systems/level`（colliderWorldRect）、`systems/game/state`（gs/getMode）、`systems/player`（P）。需要这些来读取游戏状态、地图数据、坐标定位、绘制圆角矩形和格式化时间。

2. 本模块：经过 systems/ui 做了什么


drawHUD：绘制左上角统计面板（光球/速度/跳跃/物理/加速/用时/死亡）、底部操作提示、Toast 浮动提示、胜利横幅与统计数据。drawMinimap：绘制 252px 宽的小地图（平台/尖刺/激光/光球/检查点/NOVA/玩家/视口框）。buildMenuScene：构建开始菜单（标题/副标题/操作说明/目标提示/霓虹开始按钮）。lobby.ts/pause.ts/scenes.ts：通过 `core/uiComponent` 的 Button/TextInput 组件构建暂停/大厅场景，注册到 UIManager 统一管理。

3. 输出：流出的方向和目的


绘制函数 → `systems/game` render() 调用。菜单/暂停/大厅场景注册到 `core/uiComponent` UIManager，由 `main.ts` 每帧 ui.draw() 渲染 + ui.handle* 分发事件。