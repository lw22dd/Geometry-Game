# Ui 文件夹 — 界面系统

<details>
<summary>systems/ui — 菜单 / 准备 / 暂停 / 大厅 / HUD / 小地图 / 图鉴 / 操作说明</summary>

本目录存放所有用户界面绘制与场景构建。每个场景模块独立一个文件，由 `scenes.ts` 组合根注册到 `core/uiComponent` 的 UIManager。

场景模块：
- **menu.ts** — 开始菜单（标题 + 霓虹流光按钮 + 背景极光/流星/漂浮几何动画 + 图鉴/操作说明入口）
- **prepare.ts** — 准备界面（选图/选人卡片 + 开始游戏/创建房间/加入房间按钮；两张选择子页由 `maps` / `CHARACTERS` 列表驱动）
- **pause.ts** — 暂停菜单（继续/创建房间/加入房间/断开连接/开发者设置/返回主菜单）
- **lobby.ts** — 联机大厅（昵称/IP/端口输入框 + 连接/返回按钮 + 状态行）
- **hud.ts** — 游戏内 HUD 面板（光球/速度/跳跃/物理/加速/用时/死亡计数 + 底部操作提示 + Toast 通知 + 胜利横幅 + 小地图（关卡鸟瞰 + 视口框））
- **dev.ts** — 开发者场景（物理网格 / 调试 HUD 开关 / FPS 计数器）
- **gallery.ts** — 预制体图鉴场景
- **instructions.ts** — 操作说明弹窗场景
- **scenes.ts** — 场景组合根（注册全部场景 + 每帧 syncUI 自动路由）
</details>

```
systems/ui/
├── theme.ts         # UI 主题 token：字体族 / 字号 / 颜色常量（消灭 50+ 处硬编码 ctx.font）
├── primitives.ts    # 共享绘制原语：玻璃面板 / 遮罩 / 标题排版 / 返回按钮 / 入场计时 / hover 复位（问题 13 去重）
├── icons.ts         # 道具图标（光球/双跳票/钩锁/护盾/加速）：HUD 背包栏与图鉴拾取物共用
├── menu.ts          # 开始菜单（标题/按钮/背景动画）
├── prepare.ts       # 准备界面（选图/选人卡片 + 单机/联机入口）
├── pause.ts         # 暂停菜单
├── lobby.ts         # 联机大厅
├── hud.ts           # HUD 面板 + 小地图
├── dev.ts           # 开发者场景
├── gallery.ts       # 预制体图鉴场景
├── instructions.ts  # 操作说明弹窗场景
└── scenes.ts        # 组合根：注册 + syncUI
```

# 数据流

1. 依赖：流入的方向和原因

`core/canvas`（ctx/VW/VH）、`core/camera`（cam）、`core/math`（rr/fmt）、`config`（currentMap/PHYS）、`core/ecs`（Position/Collider/PathMotion/Collectible/RespawnPoint/Goal 组件与语义查询）、`systems/level`（colliderWorldRect）、`systems/game/gameState`（gs）、`systems/game/gameMode`（getMode）、`systems/player`（playerController）、`systems/uiAtmosphere`（菜单/图鉴氛围）。需要这些来读取游戏状态、地图数据、坐标定位、绘制圆角矩形和格式化时间。

2. 本模块：经过 systems/ui 做了什么

**共享层**：`theme.ts` 提供字体/字号/颜色 token；`primitives.ts` 提供玻璃面板/遮罩/标题排版/返回按钮/入场计时/hover 复位；`icons.ts` 提供道具图标（HUD 槽位 + 图鉴拾取物共用）。各场景模块（menu / prepare / pause / lobby / hud / dev / gallery / instructions）优先复用共享层，消灭平行实现。

**menu.ts** — 构建开始菜单（标题/副标题/操作说明/目标提示/霓虹开始按钮 + 预制体图鉴/操作说明入口）。**prepare.ts** — 构建准备界面（选图/选人卡片，卡片列表由 maps / CHARACTERS 动态驱动）。**hud.ts** — drawHUD：绘制左上角统计面板（光球/速度/跳跃/物理/加速/用时/死亡）、底部操作提示、Toast 浮动提示、胜利横幅与统计数据。drawMinimap：绘制 252px 宽的小地图（平台/尖刺/激光/光球/检查点/NOVA/玩家/视口框）。**pause.ts** / **lobby.ts** / **dev.ts** / **gallery.ts** / **instructions.ts** — 通过 `core/uiComponent` 的 Button/TextInput/Toggle 组件构建各 UI 场景。**scenes.ts** 汇总注册全部场景到 UIManager，syncUI() 每帧根据 gs.screen + lobby + prepare 状态自动切换当前场景。

3. 输出：流出的方向和目的

绘制函数（drawHUD/drawMinimap）→ `systems/game` render() 调用。菜单/暂停/大厅场景注册到 `core/uiComponent` UIManager，由 `main.ts` 每帧 ui.draw() 渲染 + ui.handle* 分发事件。