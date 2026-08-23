# UiComponent 文件夹 — UI 框架（core 层）

<details>
<summary>core/uiComponent — UIManager 场景管理 + Button / TextInput 组件</summary>

本目录存放无业务逻辑的 UI 框架底座：`UIManager`（单例场景管理 + 事件统一分发）、基础交互组件 `Button` / `TextInput` 与类型定义。场景构建器位于 `systems/ui/`（业务层），经 `ui.register()` 注册到 UIManager。core/uiComponent 不依赖任何 systems 或 config。
</details>

```
core/uiComponent/
├── index.ts       # barrel 导出：UI_SCENE / Button / TextInput / ui / UIManager
├── manager.ts     # UIManager 单例：register / show / handleClick / handleMove / handleKey / draw
├── Button.ts      # Button 组件（label / variant / onClick / hover）
├── TextInput.ts   # TextInput 组件（label / value / focus / 文本编辑）
└── types.ts       # UIWidget / UIScene / UISceneName 接口定义
```

# 数据流

1. 依赖：流入的方向和原因


`core/canvas`（ctx 绘制上下文）。需要画布来绘制 UI 场景与组件。不读取游戏状态，只做渲染与事件分发。

2. 本模块：经过 core/uiComponent 做了什么


维护当前 UI 场景（menu / pause / lobby / null 等）与焦点/悬停状态，统一分发点击、鼠标移动、键盘事件。`main.ts` 每帧调用 `ui.draw(t)` 绘制当前场景，事件回调调用 `ui.handleClick/handleMove/handleKey`。`systems/ui/$`（index/pause/lobby/scenes）用 `buildXxxScene()` 构建场景后 `ui.register()` 注册。

3. 输出：流出的方向和目的


当前场景绘制与事件分发 → `main.ts`（每帧调用）与 `systems/ui`（场景注册）。UIManager 单例 `ui` → `systems/ui/scenes.ts`（组合根注册全部场景）。