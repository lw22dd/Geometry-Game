# 玩家 SoA 单真相收敛路线图

> 目标：玩家实体 ECS 组件成为玩家状态的**唯一权威存储**；PlayerState 降级为
> "物理函数工作副本 / 只读派生视图"，最终删除常驻 PlayerState 与单向桥。
> 金测试（physics.golden.test.ts）是行为护栏：任何一步改动必须保持其逐帧轨迹不变。

## 现状（阶段 A 完成后）

- 组件层已**完整覆盖** PlayerState 全部字段：`Position/Velocity/Collider` + `PlayerControl`(SoA)
  + `JumpCharges`(SoA) + `ImpulseQueue/Backpack/PlayerTrackState/PlayerPlat`(AoS 侧表)。
- 双向桥齐备：`syncToEcs(p)`（全字段镜像）、`syncFromEcs(eid)`（合成派生视图）。
- 冒烟测试 `playerEntity.smoke.test.ts` 含 **round-trip 全字段一致** 用例，锁定承载能力。
- `PlayerState` 仍是常驻真源（PlayerController 持有），组件是每帧镜像。
- 废弃 SoA `PlayerTrack` 已删除（被 `PlayerTrackState` AoS 取代）。

## 字段 → 组件映射（权威表）

| PlayerState 字段 | 组件/侧表 | 类型 |
|---|---|---|
| x / y | Position.x/y | SoA |
| velocity.x/y | Velocity.x/y | SoA |
| half / grounded / coyote / jbuf / face / dead / deadT / sprint / wasSpr / inv / jumpWasDown / jumpFresh / hookCd / hookMissT / selectedSlot | PlayerControl.* | SoA |
| extraJumps / extraJumpsMax | JumpCharges.left / max | SoA |
| impulses | ImpulseQueue[eid] | AoS |
| backpack | Backpack[eid]（编码 0/1） | AoS |
| track | PlayerTrackState[eid] | AoS |
| plat | PlayerPlat[eid] | AoS |

## 阶段 B：物理引擎真源切换（最大工程，分槽位执行）

思路：**保留 `stepPlayerGeneric(p, ...)` 签名不变**（金测试同款），生产路径改为：

```
每帧（game/index.ts step）：
  const p = syncFromEcs(playerEid)            // 组件 → 瞬时工作副本
  playerController.step(p, dt, mode, isLocal) // 物理/碰撞/动画照常操作 p
  syncToEcs(p)                                // 写回组件（组件是唯一长期真相）
```

关键点：
1. **PlayerController 去常驻 state**：`this.state` 改为每帧注入的工作副本；die/respawn/
   resetToSpawn/applyCorrection 等生命周期方法从"写 this.state"改为"写传入的 p"（签名变化，
   或经桥在组件上操作）。
2. **渲染/UI/网络改读视图**：`playerController.getState()` 改为 `syncFromEcs(playerEid)`，
   或直接保留 controller 缓存视图（每帧物理后刷新）。
3. **网络广播**：broadcastHostState 已读 PlayerState 字段 → 改读组件/视图；NetPlayerState
   平铺序列化保持不动（收敛的是存储，不是协议）。
4. **远程玩家**：目前 host 模拟走 PlayerState（remotes Map）→ 可先保持，或建远程实体桥。
5. **金测试**：保持调用 `stepPlayerGeneric(p,...)` 与 freshPlayer 构造 → **不改**。
6. **顺序纪律**：每迁移一个槽位（物理/生命周期/渲染/网络）跑一次全量测试，金测试恒绿。

验收标准：
- `syncToEcs` / `syncFromEcs` 是仅有的两个玩家状态进出口；无任何模块直接改组件槽位。
- `broadcastHostState` 手写序列化删光 → 直接从组件/视图读。
- 常驻 PlayerState 删除（或仅作物理工作副本类型，无长期实例）。

## 阶段 C：S3 控制权仲裁 / Modifier 管道（收敛后）

- S3：`dead > zipline > track > spring > sprint > free` 优先级表实体化 → `ControlLock` 组件
  + 仲裁系统写 `ControlMode`；MovementSystem 只读仲裁结果。
- Modifier：`Stats` + `Modifiers` 组件 + 单系统重算（基础 < 道具 < 机制）。

## 纪律

- 金测试 S1–S8 逐位不变（改动物理必跑 `physics.golden.test.ts`）。
- 新增机制 = 注册表条目 + 可选新 Effect kind + 可选新 verbs（见 docs/effect-contract.md）。
- 禁止：往 stepPlayerGeneric 追加分支、向 PlayerState 增加机制专用字段。