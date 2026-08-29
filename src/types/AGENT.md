# Types 文件夹 — 共享类型定义

<details>
<summary>types — 全项目统一共享类型声明</summary>

本目录定义跨模块共享的 TypeScript 类型：矩形刚体、移动平台生成数据、尖刺、激光生成数据、粒子、玩家状态、相机状态、游戏全局状态、地图描述符、netBus 事件载荷等。所有模块（config / core / systems / Prefabs / net）依赖本目录。
</details>

```
types/
├── index.ts    # 全部共享类型：Rect/Mover/Spike/Laser/Orb/Checkpoint/Particle/PlayerState/CameraState/GameState/NetBusEvent
└── path.ts     # 路径段类型 PathSegment（line/arc，t∈[0,1] 归一化参数化，供 core/path 与轨道/钩锁复用）
```

# 数据流

1. 依赖：流入的方向和原因


无。本目录只导出类型，不依赖任何其他模块。

2. 本模块：经过 types 做了什么


定义并导出所有跨模块数据结构。作为类型契约，约束各模块之间的数据形状（例如 PlayerState 字段 game/player/world 三处共享读写）。

3. 输出：流出的方向和目的

类型定义 → `config/`（实现数据）、`core/`（相机/ECS）、`systems/*`（状态与逻辑）、`Prefabs/`（绘制参数）、`net/`（网络载荷）。编译期校验各模块接口一致性。