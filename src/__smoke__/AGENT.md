# AGENT.md — __smoke__

本目录是 Neon Ascent（霓虹攀升）项目的组成部分，位于 `src/__smoke__/`。

## 职责

存放运行时冒烟测试（vitest，node 环境可跑）：
- `physics.golden.test.ts` — 物理金测试：冻结 `stepPlayerGeneric` 逐帧行为（重构必须保持绿，手感变更同步更新 GOLDEN 基线）
- `ecs.smoke.test.ts` — bitECS 场景层运行时：initEcs / 场景工厂 / tag 查询 / hasComponent / SoA 读写 / clearWorld
- `playerEntity.smoke.test.ts` — 玩家 ECS 实体桥接（A 路线装载/写回）
- `effects.smoke.test.ts` — 契约层 applyEffect / verbs 结算
- `controlMode.smoke.test.ts` — 控制权仲裁（ControlArbiter 优先级）
- `auraTrigger.smoke.test.ts` — 光环系统进出/周期投递

运行：`npx vitest run src/__smoke__/`；与 `tsc --noEmit` 一起构成每次提交的门禁。

## 依赖方向

直接 import 被测模块（`core/ecs`、`Prefabs/Scenes/sceneFactory`、`systems/player`、`systems/effects`、`systems/level` 等）与 vitest 断言 API。不参与游戏运行路径，仅测试用途；不依赖浏览器/DOM（node 环境）。