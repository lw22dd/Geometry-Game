# PlayerState 字段写者清单（契约化后收口状态）

> 用途：玩家 ECS 接线（Phase 1）前必须**列全所有直接写 PlayerState 的位置**，
> 否则 SoA 数据双写阶段必然漏同步。本文档是接线时的核对表。
> **2026-08 更新**：契约层（effects）落地后，影响来源直写点已收口 ——
> 本表"写者"一列标记为 **契约投递** 的模块不再直接写玩家字段，
> 只投递 PlayerRequest 经 applyEffect 结算写入（见 docs/effect-contract.md）。
> 后续新增机制一律按契约接入，禁止直写。

## 1. 写者总览（谁在写玩家状态）

| 写者模块 | 写法 | 写哪些字段 | 说明 |
|---|---|---|---|
| `systems/player/PlayerController.ts` | 生命周期方法 | `dead/deadT/x/y/velocity/face/grounded/inv/plat/track/springT/springAcceleration/extraJumps/jbuf/jumpFresh/hookCd/hookMissT/selectedSlot` | 构造函数经 `createPlayerState()` 工厂初始化；`die/respawn/resetToSpawn/applyCorrection/applyDeathAuthority/setJumpBuffer/step` 直接写 |
| `systems/player/index.ts` `stepPlayerGeneric` + `stepTrackMotion` | 物理引擎（纯函数，读传入 p） | `x/y/velocity/face/grounded/plat/sprint/wasSpr/coyote/jbuf/jumpFresh/jumpWasDown/springT/inv/extraJumps/track/dead` | **最大写者**；本文件是重构主战场 |
| `systems/items/hook.ts` `fireHook` / `stepHookPlayer` | 钩锁发射 + 滑索步进 | `track/grounded/plat/hookCd/hookMissT/velocity/x/y/face` | **直接写玩家状态**（不经 Controller）；接线后应成为 HookSystem |
| `systems/interactions/CollisionHooks.ts` | 拾取副作用 | `extraJumps`（二段跳票）、`selectedSlot`（钩锁自动选中） | 通过 `s = playerController.getState()` 拿引用后直接写 |
| `systems/game/index.ts` | 联机调度 | 客机模拟：`inv/plat/track/extraJumps/hookCd/hookMissT`（`stepRemoteClients`）；客机端应用房主状态：`track/grounded`（`applyNetPlayers` 调用侧）；`selectedSlot`（slot 切换）；`velocity.y`（物理模式切换缩放） | 分散在 6+ 处，均直接写 |
| `systems/player/remote.ts` `applyNetPlayers` | 客户端侧远程玩家渲染态 | `face/grounded/track/...`（写 RemotePlayer，不经 controller） | 远程玩家由本模块独立管理（不经 PlayerController） |

> 结论：**"单一写者"目前不成立**——PlayerState 被 6 个模块直接写。接线阶段先接受现状，
> 通过本清单确保 SoA 双写覆盖全部写点，再逐步收敛。

## 2. 读者（读 `getState()` / `P` 的模块，33+ 处）

- `systems/game/index.ts`：主循环读位置/速度/死亡状态、网络广播、模式切换（10+ 处）
- `systems/ui/*`：HUD、小地图、开发面板（dev/hud/prepare）
- `Prefabs/Player`：`drawPlayer` 读位置/形变/闪烁；动画 FSM 读物理事实
- `Prefabs/Scenes/atmosphere.ts`：曳光绘制
- `systems/interactions/*`：碰撞/收集/检查点/终点（CollectSystem/GoalSystem/CollisionHooks/RespawnPointSystem）
- `systems/items/hook.ts`：瞄准方向（mouseAimDir 读 face/position）

## 3. 关键事实与已修问题

1. **`P` 只读声明不成立**：`systems/player/index.ts:51` 导出 `P`（同一对象引用），
   且 `game/index.ts` 等多处直接 `getState().x = ...` / `getState().velocity.y *= ...`。
   "只读"只是注释约定，无类型或运行时保护。接线后 `P` 应改为只读快照或删除。
2. **远程玩家输入兜底**（本次已修）：`stepPlayerGeneric` 的 `input === null` 分支会
   回落读**房主全局键盘** `keys`——客户端尚未上报输入时，远程玩家会被房主键盘驱动。
   已改为 `input ?? IDLE_INPUT`（空输入=静止），物理与全局键盘彻底解耦。
3. **PlayerState 字面量重复 2 份**（已修）：`PlayerController` 构造与 `remote.registerRemote`
   各一份，已合并到 `createPlayerState()` 工厂（`systems/player/createPlayerState.ts`）。
4. **二段跳次数刷新语义**：`stepPlayerGeneric` 在 `grounded` 时 `extraJumps = extraJumpsMax`；
   `CollisionHooks` 拾取二段跳票时也写 `extraJumps = extraJumpsMax`。两处写同一规则，
   接线后应统一。

## 4. 迁移验收核对表（接线后逐项打勾）

- [ ] `qLocalPlayer` 能查到本地玩家实体，且 `Position/Velocity` 与 PlayerState 双写一致
- [ ] 6 个写者模块全部改为经系统写入（或双写），无一遗漏
- [ ] `P` 只读快照或已删除；无任何模块直接改 SoA 槽位
- [ ] 金测试（`src/__smoke__/physics.golden.test.ts`）全程保持绿
