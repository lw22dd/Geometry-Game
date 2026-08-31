# Enemy 文件夹 — 敌人预制体（注册表 + 纯绘制）

<details>
<summary>Prefabs/Enemy — 敌人种类注册表 + 纯绘制（与 Prefabs/Player 对称）</summary>

本目录提供敌人种类定义注册表（`ENEMY_KINDS` / `getEnemyKind`）与纯绘制函数（`drawEnemy` / `drawEnemies`）。system（`systems/enemy`）只通过本模块的 API 与敌人体系交互，不直接 import 具体实现。绘制为纯 Canvas（只读 ECS 状态），不含任何 AI / 物理逻辑。
</details>

```
Prefabs/Enemy/
├── kinds.ts        # 敌人种类注册表 ENEMY_KINDS（walker）+ getEnemyKind 查询 + WalkerState（AoS 侧表类型）+ drawEnemy（纯绘制）
├── drawEnemies.ts  # 批量绘制全部敌人（渲染帧调用，反射读 qEnemies）
├── index.ts        # barrel 导出：ENEMY_KINDS / getEnemyKind / drawEnemy / drawEnemies
└── AGENT.md
```

# 数据流

1. 依赖：流入的方向和原因

`core/canvas`（ctx）、`core/camera`（sx / sy / view）、`core/ecs`（Position / Health 组件、qEnemies 查询）、`types`（EnemyKind）。需要这些将敌人世界状态转换为像素绘制。

2. 本模块：经过 Prefabs/Enemy 做了什么

定义敌人种类数据（生命 / 移速 / 警戒范围 / 接触伤害 / 配色）+ 纯绘制（身体 / 眼睛 / 追击警戒 / 血条）。`systems/enemy/EnemyController` 面向 `ENEMY_KINDS` 查询种类定义，维护 `EnemyBrain` AoS 状态；`systems/game/render` 每帧调 `drawEnemies()` 绘制。

3. 输出：流出的方向和目的

`ENEMY_KINDS` / `getEnemyKind` → `systems/enemy/EnemyController`（生成 / 步进）。`drawEnemy` / `drawEnemies` → `systems/game`（render 编排）。新增敌人种类 = 在 `kinds.ts` 的 `ENEMY_KINDS` 加一条定义 + `types` 的 `EnemyKind` 联合类型加一项。
