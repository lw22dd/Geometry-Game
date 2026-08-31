# Combat 文件夹 — 战斗系统

<details>
<summary>systems/combat — 伤害入口 / 武器 / 射线 / 抛体</summary>

本目录存放战斗相关系统：伤害统一入口（dealDamage）、公共射线检测（raycastWorld）、武器系统（开火节流 / 散布 / 弹匣 / 换弹 / hitscan 命中结算）、抛体系统（手雷抛物线 / 引信 / 爆炸圆判定）。目标是「武器代码只写一次」，本地玩家与房主模拟的远端玩家统一走同一套步进。
</details>

```
systems/combat/
├── damage.ts      # 战斗伤害统一入口 dealDamage：目标多态（PlayerState 契约层 / eid Health 组件）+ 击退
├── raycast.ts     # 公共射线检测：segRectT（slab 法线段-矩形交点）+ raycastWorld（固体 + 敌人最近命中）
├── weapon.ts      # 武器系统（S2）：开火节流 / 散布 / 弹匣 / 换弹 / hitscan 命中结算 + 曳光
├── projectile.ts  # 抛体系统（S2）：手雷抛物线物理 + 引信 + 爆炸圆判定
└── index.ts       # barrel 导出
```

# 数据流

1. 依赖：流入的方向和原因

`types`（InputKeys / PlayerState / Vector2）、`core/ecs`（EnemyBrain / qDamageable / Projectile）、`config`（WEAPONS / HIT_INV）、`systems/effects`（applyEffect 契约层）、`systems/player`（getSolids）、`systems/level`（colliderWorldRect）、`Prefabs/Fx`（FX 预设）、`core/audio`（sfx）、`core/netBus`。

2. 本模块：经过 systems/combat 做了什么

统一伤害入口 `dealDamage`（目标多态：玩家走 applyEffect 契约层、敌人走 Health 组件），生死裁决权仍在目标侧；武器系统每 tick 步进（hitscan 命中 → dealDamage + 曳光 + 火花）；副武器（手雷）投掷生成抛体实体，抛物线步进 + 引信 + 爆炸圆判定 → dealDamage + 击退。

3. 输出：流出的方向和目的

`dealDamage` → 玩家（经 applyEffect 结算）与敌人（经 Health 管线）。`weapon.ts` / `projectile.ts` 的 stepXxx / drawXxx → `systems/game`（主循环 step / render）与 `systems/player/tick`（统一 tick 管线）。敌人击杀 → `killEnemy`（`systems/enemy`）。

伤害权威：玩家侧由目标自己的结算管线裁决；敌人由 Health 管线裁决。联机下只有房主调用 dealDamage；本地命中表现只在 isLocal 时播放。
