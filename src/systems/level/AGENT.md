# Level 文件夹 — 关卡级系统

<details>
<summary>systems/level — 路径运动 / 激光计时 / 碰撞系统 / 碰撞箱工具</summary>

管理世界级对象的每帧更新：移动平台路径运动（MotionSystem）、激光周期开关（LaserTimerSystem）、统一 AABB 碰撞检测 + 事件分发（CollisionSystem）、碰撞箱世界坐标换算与重叠检测工具（OverlapUtils）。
</details>

```
systems/level/
├── MotionSystem.ts     # 移动平台正弦路径运动（更新 Position + PathMotion）
├── SpringSystem.ts     # 弹簧平台系统：更新所有 SpringPad 的冷却与动画计时
├── LaserTimerSystem.ts # 激光周期开关（更新 Timer.on）
├── CollisionSystem.ts  # 统一碰撞检测：玩家 Collider vs 所有 Collider 实体，enter/exit 状态跟踪 → collisionBus 事件
├── AuraSystem.ts       # 光环系统（扩展占位）：范围持续场，进出/周期投递 PlayerRequest
├── OverlapUtils.ts     # colliderWorldRect / aabbOverlap / pointInCollider / rectFromEntity
└── index.ts            # barrel 导出
```

# 数据流

1. 依赖：流入的方向和原因


`core/ecs`（world 实体查询 + Position/Collider/Hazard/Collectible/RespawnPoint/Goal/Aura/SpringPad 组件）、`core/collisionBus`（事件总线）、`systems/effects`（applyEffect，AuraSystem 投递 PlayerRequest）。需要这些来查询实体、计算碰撞箱、分发碰撞事件。

2. 本模块：经过 systems/level 做了什么


每帧由 `systems/game` 调用：updateMotion 更新移动平台位置 → updateSpringPads 更新弹簧冷却/动画 → updateLaserTimer 更新激光开关 → updateAuraSystem 推进光环场 → PlayerController.step 内调用 updateCollisionSystem 检测玩家 vs 所有 Collider 实体的 AABB 重叠，跟踪 enter/exit 状态，通过 collisionBus 发射 `enter:player:hazard` / `enter:player:collectible` / `enter:player:respawn` / `enter:player:goal` 等事件。

3. 输出：流出的方向和目的


CollisionSystem 的事件 → `core/collisionBus` → `systems/interactions/CollisionHooks`（致死/收集/检查点/终点逻辑）。OverlapUtils 工具 → `systems/player`（平台推挤）、`Prefabs/Scenes`（绘制）、`systems/ui`（小地图）。