# Src 文件夹 — 项目根目录

<details>
<summary>src — NEON ASCENT 霓虹攀升客户端源码根目录</summary>

本目录是 Vite + TypeScript 构建的几何霓虹跑酷游戏客户端源码根目录。包含入口、配置、底座、玩法逻辑、预制体、网络层和类型定义。
</details>

```
src/
├── main.ts  # 入口：初始化 Canvas/Input/主循环 + UI 事件分发
├── netBridge.ts  # 组合根：装配 core/netBus + net（唯一合法 systems↔net 交界处）
├── style.css  # 全局样式
├── vite-env.d.ts  # Vite 环境类型声明
├── AGENT.md  # 本文档
├── assets/  # 图片 / 图集等运行期加载的静态资源
├── Audio/  # 音频资源
│   ├── enemy/  # 空目录
│   ├── system/  # 空目录
│   └── weapons/  # 空目录
├── core/ecs/  # ECS 全部组件集中定义：core/ecs/components.ts（SoA 数值组件 + 标签组件 + AoS 侧表）
├── config/  # 纯数据 + 注册表：物理参数、关卡布局、背景装饰、cpPoint 复活点
├── core/  # 无业务逻辑的底座：画布、输入、音效、相机、数学工具、netBus、ECS、UI
│   ├── ecs/  # ECS 底座：world.ts（世界/注册/清空）+ queries.ts（语义查询）
│   └── uiComponent/  # UI 框架：UIManager + Button / Toggle / TextInput 组件
├── net/  # 网络层：NetClient（WebSocket）+ session 状态机 + room 房间状态
├── Prefabs/  # 预制体：实体工厂 / 角色 / 场景道具 / 特效的绘制建模
│   ├── Enemy/  # 规划中（尚未创建）
│   ├── Fx/  # 特效发射预制体：FX 预设表 + 通用发射器 spawnFx
│   ├── NPC/  # 规划中（尚未创建）
│   ├── Player/  # 玩家角色预制体体系：注册表 + 默认预制体
│   │   ├── characters/  # 角色样式注册表（纯数据）
│   │   └── default/  # 默认角色「霓虹跑者」：FSM（states/animation）+ 纯绘制（render）+ 组合（defaultPrefab）
│   ├── Animations/  # 实体动画控制器注册表：registry + 通用输出辅助 getAnimOutput
│   ├── Scenes/  # 场景道具建模：platforms / hazards / items / atmosphere + itemsAnimators（动画控制器）
│   └── WeaponVis/  # 规划中（尚未创建）
├── systems/  # 玩法逻辑：game / player / level / ui / animation / interactions / combat / enemy / quest + 粒子运行时
│   ├── animation/  # 统一实体动画系统：stepAnimation(dt) 遍历 Animator 实体步进 FSM
│   ├── combat/  # 规划中（尚未创建）
│   ├── enemy/  # 规划中（尚未创建）
│   ├── game/  # 调度中枢：gameState（gs）+ gameMode（物理模式）/ 主循环 step/render/frame + 联机事件绑定
│   ├── interactions/  # 玩法交互触发系统：CollisionHooks（碰撞事件订阅）+ 坐标版 Collect / RespawnPoint / Goal
│   ├── level/  # 关卡级系统：MotionSystem（移动平台）/ LaserTimerSystem（激光）/ CollisionSystem（碰撞检测）/ OverlapUtils
│   ├── player/  # 玩家控制：PlayerController 生命周期 + 物理引擎（stepPlayerGeneric）+ remote 联机 + createPlayerState 工厂
│   ├── quest/  # 规划中（尚未创建）
│   ├── ui/  # 界面：菜单 / 大厅 / 暂停 / 开发者 / 图鉴 / 操作说明 + HUD + 小地图
│   │   └── styles/  # 规划中（尚未创建）
│   └── items/  # 物品系统（背包、钩爪）
└── types/  # 共享类型定义（PlayerState / InputKeys / FrameSignals / NetPlayerState / ...）
```

# 数据流

1. 依赖：流入的方向和原因


Vite 构建环境 + 浏览器 DOM API。`index.html` 挂载 canvas，`main.ts` 初始化各模块并启动游戏循环。

2. 本模块：经过 src 发生了什么


所有客户端源码在此编译、构建为单一 JS bundle。入口 `main.ts` 按顺序初始化 core（画布/输入/音效/UI 框架）→ netBridge（装配网络）→ systems（游戏调度 + 注册 UI 场景），然后启动 requestAnimationFrame 主循环。主循环按固定时间步长（1/120s）驱动 playerController（物理 + 碰撞事件 + 动画）、关卡系统（移动平台/激光）、粒子和 UI 渲染。**固定步长是物理金测试（`src/__smoke__/physics.golden.test.ts`）可复现的前提，严禁改为可变 dt 驱动物理。**

3. 输出：流出的方向和目的


构建产物写入 `dist/` 目录，供浏览器加载运行。游戏循环通过 canvas 2D context 实时渲染，音效经 Web Audio API 播放，联机数据经 WebSocket 与房主/客机同步。

# 架构决策记录（2025-06 · 玩家 ECS 接线前，已定案）

1. **玩家实体跨 clearWorld 存活**：切图重建（`setupLevel` → `clearWorld`）只清场景实体；
   玩家实体生命周期独立（接线后：`resetToSpawn` 清字段、不清实体），保证 `qLocalPlayer` 跨图可用。
2. **阶段一冻结 NetPlayerState 协议**：玩家 ECS 接线只是**内部存储层**改造；
   广播仍走现有 JSON 字段协议，协议变更与重构永不同时做。
3. **玩家物理目标挂载点**：`PlayerControl/PlayerInput/PlayerTrack/Backpack` SoA 组件已定义
   （`core/ecs/components.ts`），`qLocalPlayer` 查询已就绪，但**尚无实体挂载**（接线工作项）。
4. **玩家实体生命周期内写者收敛**：PlayerState 写者清单见 `docs/player-state-writers.md`；
   系统管道顺序见 `docs/system-execution-order.md`。
5. **测试护栏**：`src/__smoke__/physics.golden.test.ts`（node 可跑，冻结 stepPlayerGeneric
   逐帧行为）+ `ecs.smoke.test.ts`。`npx vitest run src/__smoke__/` 与 `tsc --noEmit` 是
   每次提交的门禁。