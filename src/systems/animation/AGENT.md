# Animation 文件夹 — 统一实体动画系统

<details>
<summary>systems/animation — 步进所有带 Animator 组件的实体 FSM</summary>

本目录存放统一实体动画系统。职责：每物理步遍历带 `Animator` 组件的实体，步进其动画 FSM（边沿检测 / 状态切换 / 计时）。输出参数由绘制层在渲染帧经 `getAnimOutput(e)` 实时求值（保持 gs.time 连续动画）。

与玩家动画的关系：玩家保持独立 FSM（Prefabs/Player，PlayerState 特化、联机权威同步），不经过本系统；其他实体（场景道具 / 未来敌人 / NPC）经 Animator 组件接入本系统。
</details>

```
systems/animation/
├── index.ts     # stepAnimation(dt)：遍历（Position+Animator）实体，查表控制器并步进
└── AGENT.md     # 本文件
```

# 数据流

1. 依赖：流入的方向和原因

`core/ecs`（world 查询实体 + Animator 组件，AoS：`{ prefab, state }`）、`Prefabs/Animations`（控制器注册表 getAnimator 与 AnimatorController 契约）。需要这些来查询实体、读取控制器、步进 FSM。

2. 本模块：经过 systems/animation 做了什么

`stepAnimation(dt)` 查询 `world.query(Position, Animator)`，对每个实体：取 Animator 组件的 prefab id → 注册表查控制器 → 惰性创建 state（防御路径）→ 调用 `controller.step(state, e, dt)`。只推进状态，不变换绘制。

调度位置：`systems/game` 的 step() 中，关卡系统（updateMotion/updateSpringPads/updateLaserTimer）之后、粒子之前。位于 `screen !== 'playing'` 早退之前 → 暂停时动画继续推进（与现状 gs.time 持续驱动的行为一致）。

3. 输出：流出的方向和目的

步进后的 FSM 状态 → 各实体 Animator 组件的 state 字段，绘制层经 `getAnimOutput(e)` 读取合成视觉。无其他副作用（不写实体组件、不发事件）。