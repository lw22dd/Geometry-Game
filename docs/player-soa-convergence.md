# 玩家 SoA 单真相收敛路线图

> 目标：玩家实体 ECS 组件成为玩家状态的**唯一权威存储**；PlayerState 降级为
> "物理函数工作副本 / 只读派生视图"，最终删除常驻 PlayerState 与单向桥。
> 金测试（physics.golden.test.ts）是行为护栏：任何一步改动必须保持其逐帧轨迹不变。

## 现状（阶段 B 主循环真源切换已完成）

- 组件层**完整覆盖** PlayerState 全部字段（阶段 A）。
- 双向桥齐备：`syncToEcs(p)`（全字段镜像）、`syncFromEcs(eid)`（合成派生视图）。
- **真源切换已落地**：`game/index.ts step()` 数据流改为
  `syncFromEcs → hydrateFrom(工作副本) → 物理 → stepActiveItem → syncToEcs`。
  组件是唯一权威存储；PlayerState 降级为每帧工作副本（`PlayerController.hydrateFrom` 原地覆盖）。
- 帧间写点（按键：跳跃缓冲/复活/槽位/物理切换；客机网络矫正）**即写即同步**回组件，
  防下帧 hydrate 覆盖（见 game/index.ts 各 syncToEcs 调用点）。
- 渲染/UI/网络读 `playerController.getState()`（= 每帧组件派生视图）；模块级 `P` 引用经
  Object.assign 原地覆盖持续有效。
- 远程玩家（host 模拟）本轮不建 ECS 实体，仍走 PlayerState（文档既定范围）。
- 废弃 SoA `PlayerTrack` 已删除（被 `PlayerTrackState` AoS 取代）。
- 遗留：`spawnBoostArrows` 为未调用死代码（与本收敛无关）。

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

## 阶段 B：物理引擎真源切换（主循环已完成；剩余：渲染/UI/网络显式改读组件）

完成部分：
- `game/index.ts step()`：`syncFromEcs → hydrateFrom → 物理+S7 → syncToEcs`（组件=唯一权威）
- 帧间事件（按键/网络矫正）即写即同步
- `PlayerController.hydrateFrom(source)`（Object.assign 原地覆盖）

剩余/可选：
- 渲染/UI/网络目前读 `playerController.getState()`（=派生视图），语义正确；
  如需彻底解耦可改为直接读 `syncFromEcs(getPlayerEid())`。
- 远程玩家（host 模拟）仍走 PlayerState，不建 ECS 实体。

思路：**保留 `stepPlayerGeneric(p, ...)` 签名不变**（金测试同款），生产路径改为：

```
每帧（game/index.ts step）：
  syncFromEcs(playerEid) → hydrateFrom          // 组件 → 瞬时工作副本
  playerController.step(...) + stepActiveItem(...) // 物理/碰撞/动画/S7 操作副本
  syncToEcs(pState)                             // 写回组件（组件是唯一长期真相）
```

关键点（已落地）：
1. **PlayerController 去常驻真相**：this.state 每帧被 hydrateFrom 覆盖（Object.assign 原地，
   保留模块级 P 引用可见性）。
2. **帧间写点必须即写即同步**：按键（跳跃缓冲/复活/槽位/物理切换）与客机网络矫正
   （applyCorrection/applyDeathAuthority/track/backpack）写副本后立即 syncToEcs，
   否则下帧 hydrateFrom 会用旧组件值覆盖。
3. **S7 主动道具须在 syncToEcs 之前调用**（钩锁写 track/hookCd 随步末统一写回）。
4. **网络广播**：broadcastHostState 读 PlayerState 字段（=派生视图）→ 协议平铺不变。
5. **金测试**：保持调用 `stepPlayerGeneric(p,...)` 与 freshPlayer 构造 → **不改**。

验收标准（阶段 B 完成态）：
- `syncToEcs` / `syncFromEcs` 是仅有的两个玩家状态进出口；无任何模块直接改组件槽位。
- 常驻 PlayerState 删除（或仅作物理工作副本类型，无长期实例）。

验收状态（本轮）：
- 进出口条件满足：玩家状态只经 syncToEcs / syncFromEcs；`ControlMode` 组件由 ControlArbiter
  直接写（非 PlayerState 字段，属派生组件，不在进出口约束内）。
- 常驻实例分支：**采用"仅作物理工作副本类型"分支** —— PlayerController.state 仍是每帧被
  hydrateFrom 原地覆盖的工作缓冲（保留模块级 P 引用可见性，帧间事件写点依赖其对象身份），
  但**不再是任何长期真相**；真相只在组件。彻底删除常驻实例需重写帧间事件写点与渲染读点，
  行为风险高且无收益，故本轮不做（文档既定可选）。
- 渲染/UI/网络读 `playerController.getState()`（= 每帧组件派生视图），语义正确；显式直读
  组件为可选解耦，本轮未做（文档既定可选）。

## 阶段 C：S3 控制权仲裁 / Modifier 管道

进度：

- **Modifier 管道（已落地）**：`StatId`/`StatModifier` 类型 → `ApplyModifier` 请求 →
  `applyModifier`（stat+source 幂等）/ `removeModifier` / `recomputeStats`（set=max，add=求和，
  max 上升补 extraJumps 差额，max 下降钳制）；doubleJump 已迁移为
  `{stat:'jumpCharges', op:'set', value:1, source:'doubleJump'}`；`PlayerModifiers` AoS 组件
  双向同步；PlayerController 复位路径清 modifiers + 重算。
- **S3 控制权仲裁（已落地，消费侧待接）**：`ControlMode` SoA 组件 + 优先级表
  `dead > zipline > track > [spring > sprint] > free`。`ControlArbiter`（controlArbiter.ts）
  每帧从 PlayerState 事实解析（dead→DEAD，track.zipline→ZIPLINE，track→TRACK，否则 FREE），
  在 game/index.ts step() 物理步后写入组件。已落地四档；spring/sprint 为扩展位
  （ControlLock 类约束届时插入更高优先级谓词，MovementSystem 零改动）。
- **待接（不阻塞收敛目标）**：MovementSystem 消费仲裁结果 —— stepPlayerGeneric 仍按
  if/return 顺序工作（金测试护栏要求签名与行为不变），真源切换在调用点而非物理内部（见阶段 B）。

## 纪律

- 金测试 S1–S8 逐位不变（改动物理必跑 `physics.golden.test.ts`）。
- 新增机制 = 注册表条目 + 可选新 Effect kind + 可选新 verbs（见 docs/effect-contract.md）。
- 禁止：往 stepPlayerGeneric 追加分支、向 PlayerState 增加机制专用字段。