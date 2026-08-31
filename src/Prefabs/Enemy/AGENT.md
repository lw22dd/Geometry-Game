# Enemy 文件夹 — 敌人预制体（配置 + 外观 + 专属行为）

<details>
<summary>Prefabs/Enemy — 每种敌人一个模块：配置（ENEMY_KINDS）+ 外观绘制（drawXxx）+ 专属行为（stepXxx）</summary>

本目录是敌人预制体的完整模板。**每个敌人种类 = 一个模块（walker / creeper / gorilla），自含「配置 + 外观绘制 + 专属行为 step」**：

- **配置**：`ENEMY_KINDS` 注册表（移动 / 警戒 / 接触伤害 / 配色 + 专属攻击参数 fuse / melee / rock）
- **外观**：`drawXxx` 纯 Canvas 绘制（只读 ECS 位置 + AoS 状态，输出「怎么画」）
- **专属行为**：`stepXxx` 攻击方式（引爆自爆 / 近战砸地 / 远程投石）+ 伤害结算

**控制器（`systems/enemy/EnemyController`）只负责通用流程**：目标选择、距离计算、通用重力 / 移动 / 碰撞、生命周期，并通过 `StepInput` 把「目标 / 距离 / 全部存活玩家」喂给专属 step，用返回的 `StepResult`（hold 停身）决定移动意向。控制器不重写任何敌人的专属攻击逻辑——攻击方式由预制体自己提供，控制器只调用。
</details>

```
Prefabs/Enemy/
├── types.ts        # 共享契约：EnemyBaseDef + 判别联合（Walker/Creeper/Gorilla）+ 判别状态 + StepInput/StepResult + DrawView
├── combat.ts       # 敌人 → 玩家 共享伤害结算（damagePlayerFromEnemy / panOfX）——预制体专属行为调用的统一结算入口
├── kinds.ts        # ENEMY_KINDS 注册表 + getEnemyKind + createEnemyState / stepEnemyBehavior / drawEnemy 三大分派
├── walker.ts       # 行走兵：配置 + 纯绘制 + stepWalker（纯接触伤害型，无专属动作）
├── creeper.ts      # 苦力怕：配置 + 纯绘制 + stepCreeper（引爆 / 自爆结算）
├── gorilla.ts      # 大猩猩：配置 + 纯绘制 + stepGorilla（近战砸地 / 远程投石结算）+ 石头弹道 stepGorillaRocks
├── drawEnemies.ts  # 批量绘制全部敌人 + 敌人石头
└── index.ts        # barrel 导出
```

# 数据流

1. 依赖：流入的方向和原因

`core/canvas`（ctx）、`core/camera`（sx / sy / view）、`core/ecs`（Position / Health / EnemyBrain 组件、qEnemies / qEnemyRocks 查询）、`types`（EnemyKind / PlayerState），以及**结算服务**：`systems/player`（playerController）、`systems/combat/damage`（dealDamage）、`systems/particles`（spawnParticles）、`systems/game/gameState`（gs）、`core/audio`（sfx）、`config`（VIS）。

> 预制体含专属行为，因此允许调用系统的结算服务。这些依赖是「行为实现 → 结算服务」方向，不允许反向（systems 不 import 预制体的专属行为）。

2. 本模块：经过 Prefabs/Enemy 做了什么

定义敌人种类数据 + 专属攻击参数；实现每种的绘制与专属行为 step（含伤害结算）。`systems/enemy/EnemyController` 面向注册表查询定义、维护 `EnemyBrain` AoS 状态，做通用准备后调用 `stepEnemyBehavior` 分发到专属 step；`systems/game/render` 每帧调 `drawEnemies()` 绘制。

3. 输出：流出的方向和目的

`ENEMY_KINDS` / `getEnemyKind` / `createEnemyState` → `systems/enemy/EnemyController`（生成 / 步进通用准备）。`stepEnemyBehavior` → 控制器调用（专属行为 + 结算）。`drawEnemy` / `drawEnemies` / `drawEnemyRock` → `systems/game`（render 编排）。新增敌人种类 = 三步：`types.ts` 加 `XxxDef` 判别联合 → `ENEMY_KINDS` 加一条数据 → 新建 `xxx.ts`（配置 + 绘制 + 专属 step）并分发。
