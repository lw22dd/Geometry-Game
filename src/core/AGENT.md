# Core 文件夹 — 无业务逻辑底座

<details>
<summary>core — 画布、输入、鼠标、音效、相机、数学、路径、轨道编解码、事件总线、ECS、UI 框架</summary>

本目录存放所有不包含游戏业务逻辑的基础设施模块：Canvas 挂载与 DPR 缩放、键盘输入、鼠标状态、WebAudio 合成音效、相机跟随与坐标变换、数学工具函数、路径几何计算、轨道状态编解码、事件总线、bitECS 世界与组件、UI 框架。不依赖任何 systems 或 config（config 可依赖 core）。
</details>

```
core/
├── index.ts        # barrel 导出：canvas/math/input/audio/camera/netBus + EntityPool + ecs（world/initEcs/clearWorld/EntityId）
├── canvas.ts       # Canvas 挂载、VW×VH=1280×720 逻辑分辨率、DPR 缩放
├── math.ts         # clamp / lerp / mulberry32 RNG / rr 圆角矩形路径 / fmt 时间格式化
├── input.ts        # 键盘状态表 keys + 事件注册回调
├── mouse.ts        # 鼠标逻辑坐标状态（mousedown 边沿服务钩锁瞄准；UI 走 uiComponent 自带监听）
├── audio.ts        # WebAudio 合成音频：AU 上下文 + 分轨总线（sfx/bgm/master + 限幅器）、osc/noise 合成原语（ADSR/滤波/声像）、sfx 音效表（含节流）
├── music.ts        # 分层动态 BGM：bass / arp / pad / perc 四层 + 状态机（menu/playing/tension/victory）+ 前瞻调度
├── settings.ts     # 玩家设置存储：音量 / 静音 / 画质档位，localStorage 持久化（键 dash.settings.v1）+ 变更订阅
├── camera.ts       # 相机世界坐标 cam、视口变换 view（SL/SB/SZ）、sx/sy 坐标换算、updateCamera
├── netBus.ts       # 事件总线（systems↔net 交界，当前为桩）
├── collisionBus.ts # 碰撞事件总线（发布/订阅）：CollisionSystem emit，CollisionHooks 订阅
├── entityPool.ts   # EntityPool<T> 泛型类：push / updateAll / drawAll / depthList（仅系统的粒子池使用）
├── path.ts         # 路径几何纯函数：segPosition/pathTangent/buildCumulativeLengths 等（轨道/钩锁/移动平台复用）
├── trackCodec.ts   # 轨道状态编解码：TrackState ↔ 网络平铺字段（pack/unpack，问题 10 收敛唯一实现）
├── ecs/            # bitECS 底座：世界 + 全部组件 + 语义查询（见 ecs/AGENT.md）
└── uiComponent/    # UI 框架：UIManager 场景管理 + Button / Toggle / TextInput（见 uiComponent/AGENT.md）
```

# 数据流

1. 依赖：流入的方向和原因


`types`（共享类型）。`canvas.ts` 依赖浏览器 DOM（`document.getElementById`、`window.devicePixelRatio`）。`audio.ts` 依赖 `AudioContext` 浏览器 API。`input.ts` / `mouse.ts` 依赖 `addEventListener` DOM 事件。`ecs/` 依赖 bitECS 库（`body: bitecs`）与 `types`。

2. 本模块：经过 core 做了什么


初始化画布上下文（`ctx`）、逻辑分辨率、DPR 缩放。注册键盘/鼠标事件监听器。合成音效函数和音效表。提供世界→屏幕坐标换算和逐帧相机更新。提供路径几何计算与轨道状态编解码（联机协议平铺字段 ↔ TrackState）。提供泛型实体池容器（粒子专用）。维护 bitECS 全局世界与组件存储。提供事件总线。

3. 输出：流出的方向和目的


`ctx` / `VW` / `VH` / `DPR` → `systems/` 渲染和 `Prefabs/` 绘制。`keys` 状态表 → `systems/player` 读取输入。`mouse` → `systems/items/hook`（瞄准/发射）。`sfx` → 各交互系统播放音效（可传 pan 声像）。`musicTick` / `setMusicState` → `systems/game` 每帧调度音乐（强度由 `core/music` 按乐句自行起伏，不再绑定玩家状态）。`Settings` → `core/audio`（音量写回总线）、`config/visuals`（画质写回 VIS）、`systems/postfx`（后期总开关）。`cam` / `view` / `sx` / `sy` → 所有绘制函数。`path` → `systems/player`（轨道物理）、`systems/items`（钩锁）、`Prefabs/Scenes`（轨道绘制）、`config/level`（轨道工厂）。`trackCodec` → `systems/game` / `remote.ts`（网络同步）。`EntityPool` → `systems/particles`（粒子池，粒子不进入 ECS）。`world` / 组件 / 查询 → `systems/*` 与 `Prefabs/*`（依赖注入非强制，全项目共享单世界）。`ui`（UIManager）→ `systems/ui/scenes.ts` 注册场景，`main.ts` 每帧分发事件与绘制。