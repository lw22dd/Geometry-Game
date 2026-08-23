# Net 文件夹 — 网络层

<details>
<summary>net — NetClient + session 状态机（当前为桩，预留）</summary>

本目录存放网络层：NetClient 客户端类与 session 状态机。当前为桩实现（预留），真实实现将经 WebSocket 连接。只通过 `core/netBus` 与 systems 通信，绝不直接 import systems。
</details>

```
net/
└── index.ts    # NetClient 类（桩）+ session 状态机（idle/connecting/ready/closed）
```

# 数据流

1. 依赖：流入的方向和原因


`types`（NetBusEvent 事件载荷）。需要事件类型定义来描述跨网络传输的消息结构。

2. 本模块：经过 net 做了什么


定义网络客户端接口与 session 生命周期状态机。作为「唯一合法 systems↔net 交界」的接收端，从 `core/netBus` 订阅游戏事件（checkpoint/orb/death/win），转发给服务端（当前桩，暂不发送）。

3. 输出：流出的方向和目的

NetClient 实例 → `src/netBridge.ts`（组合根装配）。netBridge 将 netBus 事件桥接到 NetClient.send()，形成完整的网络数据通路。