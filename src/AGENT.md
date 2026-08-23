# Src 文件夹 — 项目根目录

<details>
<summary>src — NEON ASCENT 霓虹攀升客户端源码根目录</summary>

本目录是 Vite + TypeScript 构建的几何霓虹跑酷游戏客户端源码根目录。包含入口、配置、底座、玩法逻辑、预制体、网络层和类型定义。
</details>

```
src/
├── main.ts            # 入口：初始化 Canvas/Input/主循环
├── netBridge.ts       # 组合根：装配 core/netBus（唯一合法 systems↔net 交界处）
├── style.css          # 全局样式
├── vite-env.d.ts      # Vite 环境类型声明
├── AGENT.md           # 本文档
├── assets/            # 图片 / 图集等运行期加载的静态资源
├── Audio/             # 音频资源（enemy / system / weapons 子目录）
├── components/        # ECS 组件（Position / Velocity / Renderable 等）
├── config/            # 纯数据 + 注册表：物理参数、关卡布局、背景装饰
├── core/              # 无业务逻辑的底座：画布、输入、音效、相机、数学工具、netBus、ECS
├── net/               # 网络层：NetClient + session 状态机
├── Prefabs/           # 预制体：玩家角色建模、场景道具建模
├── systems/           # 玩法逻辑：game / player / world / ui / combat / enemy / quest
└── types/             # 共享类型定义
```

# 数据流

1. 依赖：流入的方向和原因


Vite 构建环境 + 浏览器 DOM API。`index.html` 挂载 canvas，`main.ts` 初始化各模块并启动游戏循环。

2. 本模块：经过 src 发生了什么


所有客户端源码在此编译、构建为单一 JS bundle。入口 `main.ts` 按顺序初始化 core（画布/输入/音效）→ netBridge（装配网络）→ systems（游戏调度），然后启动 requestAnimationFrame 主循环。

3. 输出：流出的方向和目的

构建产物写入 `dist/` 目录，供浏览器加载运行。游戏循环通过 canvas 2D context 实时渲染。