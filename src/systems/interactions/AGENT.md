# Interactions 文件夹 — 玩法交互触发系统

<details>
<summary>systems/interactions — 碰撞事件订阅 + 交互规则</summary>

所有玩家（本地 + 远程）的交互触发均走碰撞路由：CollisionSystem 检测 → collisionBus emit → CollisionHooks 订阅处理（危险物致死/收集/检查点/终点）。远程玩家由 game 层 setCollisionSim 注入模拟目标，复用同一套 handler。
</details>

```
systems/interactions/
├── CollisionHooks.ts     # 碰撞事件订阅：enter:player:hazard → 投递 KillRequest；collectible → 收集；respawn → 激活；goal → win
├── RespawnPointSystem.ts # 检查点激活（activateCheckpoint）+ 复活点维护
├── ItemPickupSystem.ts   # 共享光球计数 helper（orbCount）
├── hazard.ts             # 危险物重叠检测（只报告不裁决；生死统一经 effects 契约层 KillRequest）
└── index.ts              # barrel 导出
```

# 数据流

1. 依赖：流入的方向和原因


`core/collisionBus`（订阅碰撞事件）、`core/ecs`（world 实体查询 + Hazard/Timer/Collectible/RespawnPoint/Goal 组件）、`systems/effects`（applyEffect 契约层，危险/拾取效果经此结算）、`systems/game/gameState`（gs）、`systems/player`（playerController 状态 + die）、`core/audio`（sfx）、`Prefabs/Fx`（spawnFx）、`core/netBus`（联机广播）。需要这些来响应碰撞事件并执行玩法逻辑。

2. 本模块：经过 systems/interactions 做了什么


initCollisionHooks() 在 startLoop 时注册（幂等）。CollisionSystem 检测到进入事件后 emit，CollisionHooks 响应：危险物（激光检查 Timer.on / 无敌帧保护）→ 投递 KillRequest 经契约层结算；光球/道具 → 标记收集 + 计数 + 特效广播；检查点 → 激活 + 更新复活点；NOVA → 触发胜利。本地与远程玩家路径统一（远程经 setCollisionSim 注入模拟目标；setCollisionSim(remoteId) 时副作用路由到 netBus/表现，不直写本地 gs/toast）。

3. 输出：流出的方向和目的


die/respawn → `systems/player`（P 状态）、`systems/game`（主循环死亡/复活逻辑）。gs 计数/胜利 → `systems/ui`（HUD/Toast）。netBus 事件 → 联机广播（ orb/checkpoint/death/win）。