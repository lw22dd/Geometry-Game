# UiComponent 文件夹 — UI 框架（core 层）

<details>
<summary>core/uiComponent — UIManager 场景管理 + Button / Toggle / TextInput 组件</summary>

本目录存放无业务逻辑的 UI 框架底座：`UIManager`（单例场景管理 + 事件统一分发）、基础交互组件 `Button` / `Toggle` / `TextInput` 与类型定义。场景构建器位于 `systems/ui/`（业务层），经 `ui.register()` 注册到 UIManager。core/uiComponent 不依赖任何 systems 或 config。
</details>

```
core/uiComponent/
├── index.ts       # barrel 导出：UI_SCENE / Button / Toggle / Slider / TextInput / ui / UIManager
├── manager.ts     # UIManager 单例：register / show / handleClick / handleMove / handleKey / handleRelease / handleWheel / draw
├── Button.ts      # Button 组件（label / variant / onClick / hover）
├── Toggle.ts      # Toggle 开关组件（定位 / 开关状态 / 点击回调）
├── Slider.ts      # Slider 滑块组件（点击轨道定位 + 拖拽调节，音量等连续量用）
├── TextInput.ts   # TextInput 组件（label / value / focus / 文本编辑）
└── types.ts       # UIWidget / UIScene / UISceneName 接口定义
```

# 数据流

1. 依赖：流入的方向和原因


`core/canvas`（ctx 绘制上下文）。需要画布来绘制 UI 场景与组件。基础场景真源经 `bindSceneState()` 注入（由 `systems/ui/scenes.ts` 绑定到 gs）——core 不 import 任何业务模块，保持零业务依赖。

2. 本模块：经过 core/uiComponent 做了什么


维护当前 UI 场景（menu / pause / lobby / settings / null 等）与焦点/悬停状态，统一分发点击、按下、鼠标移动、键盘、滚轮事件。`main.ts` 每帧调用 `ui.draw(t)` 绘制当前场景，事件回调调用 `ui.handleClick/handlePress/handleMove/handleKey/handleWheel`；`handleRelease()` 由 window 的 mouseup 驱动，用于结束滑块拖拽（拖出画布也能结束）。`handleClick` 会把点击处的逻辑坐标传给 `onClick(lx, ly)`；按下经 `handlePress` 分发 `onPress`（拖拽起点，必须早于 click，否则 mouseup 先过境导致拖拽状态残留）；拖拽期间 `UIWidget.dragging` 为真时，`handleMove` 持续回调 `onDrag(lx, ly)`。

**场景一致性约定**：所有事件分发与 `draw()` 一律按 `currentName` **实时解析**场景（`active` getter），并在入口先 `syncScene()` 补齐 onExit/onEnter —— 绝不依赖缓存的 `current` 字段做事件源。原因：外部若绕过 `show()` 直接写真源（历史上 `startGame` 曾直接写 `gs.scene`），派生的 `currentName` 已变而缓存 `current` 不变，会造成「画面已是游戏、点击却命中菜单按钮」的图层错位。因此任何进入/退出 UI 的路径都必须走 `ui.show(...)` 唯一写入口。基础场景真源统一挂在注入的 `UISceneState`（`systems/ui/scenes.ts` 的 `registerUIScenes()` 调用 `ui.bindSceneState(...)` 绑定到 `gs`），叠层栈由 UIManager 自持。`systems/ui/$`（index/pause/lobby/scenes）用 `buildXxxScene()` 构建场景后 `ui.register()` 注册。

3. 输出：流出的方向和目的


当前场景绘制与事件分发 → `main.ts`（每帧调用）与 `systems/ui`（场景注册）。UIManager 单例 `ui` → `systems/ui/scenes.ts`（组合根注册全部场景）。