# Core 文件夹 — 无业务逻辑底座

<details>
<summary>core — 画布、输入、音效、相机、数学工具、事件总线、ECS 实体池</summary>

本目录存放所有不包含游戏业务逻辑的基础设施模块：Canvas 挂载与 DPR 缩放、键盘输入、WebAudio 合成音效、相机跟随与坐标变换、数学工具函数、事件总线、ECS 实体池。不依赖任何 systems 或 config。
</details>

```
core/
├── index.ts        # barrel 导出
├── canvas.ts       # Canvas 挂载、VW×VH=1280×720 逻辑分辨率、DPR 缩放
├── math.ts         # clamp / lerp / mulberry32 RNG / rr 圆角矩形路径 / fmt 时间格式化
├── input.ts        # 键盘状态表 keys + 事件注册回调
├── audio.ts        # WebAudio 合成音效：AU 上下文、tone/nz 合成器、sfx 音效表、MUS 低音循环
├── camera.ts       # 相机世界坐标 cam、视口变换 view（SL/SB/SZ）、sx/sy 坐标换算、updateCamera
├── netBus.ts       # 事件总线（systems↔net 交界，当前为桩）
└── ecs/            # 实体池遍历器
    └── entityPool.ts  # EntityPool<T> 泛型类：updateAll / drawAll / depthList
```

# 数据流

1. 依赖：流入的方向和原因


`types`（共享类型）。`canvas.ts` 依赖浏览器 DOM（`document.getElementById`、`window.devicePixelRatio`）。`audio.ts` 依赖 `AudioContext` 浏览器 API。`input.ts` 依赖 `addEventListener` DOM 事件。

2. 本模块：经过 core 做了什么


初始化画布上下文（`ctx`）、逻辑分辨率、DPR 缩放。注册键盘事件监听器。合成音效函数和音效表。提供世界→屏幕坐标换算和逐帧相机更新。提供泛型实体池容器。提供事件总线桩。

3. 输出：流出的方向和目的

`ctx` / `VW` / `VH` / `DPR` → `systems/` 渲染和 `Prefabs/` 绘制。`keys` 状态表 → `systems/player` 读取输入。`sfx` / `MUS` / `musicTick` → `systems/game` 播放音效和音乐。`cam` / `view` / `sx` / `sy` → 所有绘制函数。`EntityPool` → `systems/world/particles` 管理粒子池。`netBus` → `netBridge.ts` 装配网络。