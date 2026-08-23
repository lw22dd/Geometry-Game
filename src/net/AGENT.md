# Net 文件夹 — 网络层

<details>
<summary>net — NetClient（真实 WebSocket 客户端）+ session 状态机 + room 房间状态</summary>

本目录存放网络层：NetClient 客户端类（真实 WebSocket 实现，连接 Go Server）、session 状态机（idle/connecting/ready/closed）、room 房间状态单例（角色/玩家列表/输入序号）。支持房主/客机两种角色：房主广播权威状态，客机发送输入并接收矫正。只通过 `core/netBus` 与 systems 通信，绝不直接 import systems。
</details>

```
net/
├── index.ts    # NetClient 类（WebSocket 实现）+ session 状态机 + 事件订阅 / 发射
└── room.ts     # 房间状态单例：role / playerId / name / connected / players / 输入序号
```

# 数据流

1. 依赖：流入的方向和原因


`types`（NetBusEvent / NetRole / RemotePlayerInfo / InputKeys / NetPlayerState / NetOrbState 事件载荷与网络类型）。需要事件类型与网络数据结构来描述跨网络传输的消息。

2. 本模块：经过 net 做了什么


定义网络客户端接口与 session 生命周期状态机。作为「唯一合法 systems↔net 交界」的接收端，从 `core/netBus` 订阅游戏事件（checkpoint/orb/death/win），通过 WebSocket 转发给 Go Server。房主模式：接收客机输入 → 本地模拟 → 广播权威状态。客机模式：发送输入 → 接收权威状态矫正。room.ts 维护房间全局状态（角色/玩家列表/连接状态）。

3. 输出：流出的方向和目的

NetClient 实例 → `src/netBridge.ts`（组合根装配）。netBridge 将 netBus 事件桥接到 NetClient.send()，形成完整的网络数据通路。room 单例 → `systems/ui/lobby.ts`（连接界面）、`systems/game`（主循环联机分支）、`systems/player/remote.ts`（远程玩家管理）。