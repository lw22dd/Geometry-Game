# Interactions 文件夹 — 玩法交互触发系统

<details>
<summary>systems/interactions — 碰撞事件订阅 + 坐标版交互（远程玩家用）</summary>

本地玩家的交互触发已事件化：CollisionHooks 订阅 collisionBus 的碰撞事件（危险物致死/收集/检查点/终点）。远程玩家（host 模拟，无 ECS 实体）仍使用坐标版交互系统（updateCollectSystem(tx,ty) 等）。
</details>

```
systems/interactions/
├── CollisionHooks.ts   # 碰撞事件订阅：enter:player:hazard → die()；collectible → 收集；respawn → 激活；goal → win
├── CollectSystem.ts    # 坐标版光球收集（远程玩家复用）
├── RespawnPointSystem.ts # 坐标版检查点激活（远程玩家复用）
├── GoalSystem.ts       # 坐标版终点判定（远程玩家复用）
└── index.ts            # barrel 导出
```

# 数据流

1. 依赖：流入的方向和原因


`core/collisionBus`（订阅碰撞事件）、`core/ecs`（world 实体查询）、`components`（Hazard/Timer/Collectible/RespawnPoint/Goal）、`systems/game/gameState`（gs）、`systems/player`（playerController 状态 + die）、`core/audio`（sfx）、`Prefabs/Fx`（spawnFx）、`core/netBus`（联机广播）。需要这些来响应碰撞事件并执行玩法逻辑。

2. 本模块：经过 systems/interactions 做了什么


initCollisionHooks() 在 startLoop 时注册（幂等）。CollisionSystem 检测到进入事件后 emit，CollisionHooks 响应：危险物（激光检查 Timer.on / 无敌帧保护）→ die()；光球 → 标记收集 + 计数 + 特效广播；检查点 → 激活 + 更新复活点；NOVA → 触发胜利。远程玩家路径由 game/index 直接调用坐标版系统。

3. 输出：流出的方向和目的


die/respawn → `systems/player`（P 状态）、`systems/game`（主循环死亡/复活逻辑）。gs 计数/胜利 → `systems/ui`（HUD/Toast）。netBus 事件 → 联机广播（ orb/checkpoint/death/win）。