# Animations 文件夹 — 实体动画控制器注册表

<details>
<summary>Prefabs/Animations — 实体动画控制器注册表 + 绘制层输出辅助</summary>

本目录存放实体动画控制器的注册表与绘制层辅助函数。与 `Prefabs/Player` 的关系：玩家动画保持独立（PlayerState 特化 FSM），本目录面向所有非玩家实体（场景道具、未来敌人、NPC）的通用动画 FSM。

- `registry.ts` — `registerAnimator` / `getAnimator` 注册表（同 Player/registry 模式）
- `index.ts` — barrel 导出 + `getAnimOutput(e)` 绘制层辅助函数

控制器具体实现位于各预制体目录（如 `Prefabs/Scenes/itemsAnimators.ts` ），注册由模块加载时的副作用完成。
</details>

```
Animations/
├── registry.ts  # 注册表：registerAnimator/getAnimator（同 Player/registry 模式）
├── index.ts     # barrel 导出 + getAnimOutput(e) 绘制层辅助函数
└── AGENT.md     # 本文件
```

# 数据流

1. 依赖：流入的方向和原因

`core/ecs`（world / EntityId）、`components/render/Animator`（Animator 组件 + AnimatorController 接口 + AnimOutput 类型）。需要这些来读取实体组件、查询控制器、合成输出参数。

2. 本模块：经过 Prefabs/Animations 做了什么

注册表管理所有 `AnimatorController` 实例。`getAnimOutput(e)` 读取实体上的 Animator 组件 → 查表获取控制器 → 调用 `controller.getOutput(state, e)` 实时合成输出参数（支持 gs.time 连续动画）。绘制层（Prefabs/Scenes/items.ts 等）直接调用 `getAnimOutput(e)` 取变换参数，不再裸写三角函数。

3. 输出：流出的方向和目的

- `registerAnimator` / `getAnimator` → `Prefabs/Scenes/itemsAnimators`（控制器自注册）、`systems/animation`（步进时查表）。
- `getAnimOutput(e)` → `Prefabs/Scenes/items.ts` draw 函数（绘制时读取输出参数）。