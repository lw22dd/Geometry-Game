# Enemy 文件夹 — 敌人系统

<details>
<summary>systems/enemy — 敌人 AI / 生成 / 死亡（S3）</summary>

本目录存放敌人玩法逻辑：EnemyController（生成 / 步进：FSM + 轻量专用物理）、death（敌人死亡表现 + 广播）、spawn（关卡批量生成）。敌人状态真源在 `EnemyBrain[eid]`（AoS 侧表），绘制在 `Prefabs/Enemy`（纯表现）。接触伤害（敌人 → 玩家）走 collisionBus，接线在 `systems/interactions/CollisionHooks`（enemy 分支）。
</details>

```
systems/enemy/
├── EnemyController.ts  # 生成 spawnEnemy / 步进 stepEnemies：AI FSM（patrol ↔ chase）+ 轻量物理（重力 / 地面 / 撞墙掉头）
├── death.ts            # 敌人死亡 killEnemy（幂等）：死亡粒子 + 音效 + 震屏 + netBus 广播 enemy:died + 实体移除
├── spawn.ts            # 关卡批量生成 spawnLevelEnemies：从 MapDefinition.entitySpawners.enemies 生成
├── index.ts            # barrel 导出
└── AGENT.md
```

# 数据流

1. 依赖：流入的方向和原因

`types`（EnemyKind）、`core/ecs`（EnemyBrain / qEnemies / Health）、`Prefabs/Enemy`（getEnemyKind 种类定义）、`systems/player`（getSolids）、`systems/particles`（spawnParticles）、`Prefabs/Fx`（FX 预设）、`core/audio`（sfx）、`core/netBus`、`config`（VIS）。

2. 本模块：经过 systems/enemy 做了什么

敌人控制器对称 PlayerController：持有 `EnemyBrain` AoS 状态真源 + 轻量专用物理（不复用玩家物理引擎）。AI FSM：巡逻（homeX ± patrolRange 往复、撞墙/悬崖掉头）↔ 追击（detectRange 警戒 → chase，loseRange 失目标回巡逻）。死亡由房主判定 → 本地表现 + netBus 广播。

3. 输出：流出的方向和目的

`spawnEnemy` / `stepEnemies` → `systems/game`（setupLevel 生成 + 主循环 step）与 `systems/player/tick`。`killEnemy` → 由 `systems/combat`（damage 管线 onEntityKilled）与 `systems/combat/projectile`（爆炸击杀）调用。`spawnLevelEnemies` → `systems/game`（applyLevel 调用，房主/单机生成；客机为接收事件木偶）。

新增敌人种类 = `Prefabs/Enemy/kinds.ts` 的 `ENEMY_KINDS` + `types` 的 `EnemyKind` 加项；AI 逻辑扩展在本目录 `EnemyController.ts`。
