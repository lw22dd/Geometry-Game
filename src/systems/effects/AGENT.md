# Effects — 契约层（影响来源 → 玩家核心的唯一接口）

<details>
<summary>effects —— PlayerRequest 请求 + 结算管线 + 玩家动词</summary>

影响来源不得直接读写玩家状态；只能投递 PlayerRequest，由 applyEffect 结算后经 verbs 写入。
本目录是"影响来源"（场景道具/道具/碰撞）与"玩家核心"（PlayerState/物理）之间的唯一边界。
</details>

```
effects/
├── effects.ts       # PlayerRequest 联合类型 + applyEffect 结算入口
├── verbs.ts         # 玩家动词：外力队列/跳充能/致死等通用写操作
├── TriggerSystem.ts # 触发系统（扩展占位）：事件/条件 → 投递 PlayerRequest 的统一注册表
└── index.ts         # barrel
```

# 数据流

1. 依赖：流入的方向和原因

`types`（PlayerState/Impulse）。本层只依赖类型与自身 verbs，不依赖任何系统/预制体，
保证"结算"与"具体玩法机制"隔离。

2. 本模块：经过 effects 做了什么

影响来源投递请求 → applyEffect 执行结算（无敌帧/已死免疫等）→ verbs 写入玩家状态。
调用方传入 ctx.onKill 可定制致死应用（本地=PlayerController.die() 计数+事件；远程=缺省直写）。

3. 输出：流出的方向和目的

`systems/player`（弹簧接触点投递 Impulse；物理消费 impulses）、`systems/interactions`
（危险物投递 KillRequest、拾取经 ITEMS.onPickup）、`systems/items`（主动道具 onActivate）。
详见 `docs/effect-contract.md`。