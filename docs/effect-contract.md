# 效果契约（Effect Contract）—— 影响来源与玩家核心的唯一接口

> 用途：定义"影响来源"（场景道具/道具/碰撞/区域/事件）对玩家施加影响的**唯一合法通道**。
> 铁律：**来源不得直接读写玩家状态，更不得直接调用 player.die()；只能投递请求，由结算管线裁决。**

## 1. 核心原则

```
影响来源(地刺/激光/弹簧/道具/收集物/终点/区域)
   └─→ 投递 PlayerRequest（请求，说明"发生了什么"）
         └─→ applyEffect(p, fx, ctx)   ← 唯一合法写入口
               ├─ 结算（settlement）: 无敌帧 / 已死 / 规则检查
               └─→ verbs 写入 PlayerState 通用字段（impulses / extraJumps* / dead）
```

- **来源只报告，不裁决**：地刺碰到玩家 → 投递 `KillRequest`，是否致死由结算管线判断。
- **玩家侧只有一套词表**：运动/控制/生命组件是通用契约字段，不与任何具体道具/机制绑定。
- **不认识的请求 = 免疫**：结算管线查不到豁免规则就按默认（致死类先查无敌帧）。

## 2. PlayerRequest（本轮竞速子集；战斗扩展位注释标注）

| kind | 含义 | 结算规则 | 写入（verbs） |
|---|---|---|---|
| `KillRequest` | 请求致死（地刺/激光） | `p.dead \|\| p.inv > 0` → 免疫；否则 `ctx.onKill`（本地 die()）或 `killState`（远程） | `dead` |
| `Impulse{ax,ay,dur,instant?}` | 外力（弹簧/击退/气流） | 无 | `impulses` 队列（instant 先加瞬时速度） |
| `GrantJumpCharges{max}` | 授予空中跳充能（双跳票） | 无 | `extraJumpsMax`/`extraJumps` |

战斗扩展位（启用时扩 union + 结算分支）：`DamageRequest`（需 HP 管线）、`TeleportRequest`、`EmitRequest`（纯表现钩子）。
四类契约信息（Intent/Effect/Modifier/Constraint）：本轮实现 **Effect** 子集；
Intent（有意愿请求，需仲裁）、Modifier（数值管道）、Constraint（持续约束/控制权接管，S3）留作扩展位。

## 3. verbs —— 玩家核心允许被修改的通用操作

`src/systems/effects/verbs.ts`：
- `grantImpulse(p, ax, ay, dur, instant?)`：外力入队（弹簧/击退/气流通用）
- `consumeImpulses(p, dt)`：自由物理步内消费外力（位置与原 springT 块一致）
- `decayImpulses(p, dt)`：约束态（轨道/滑索）只衰减计时不施力
- `grantJumpCharges(p, max)`：授予空中跳充能
- `killState(p)`：直接标记死亡（纯状态；计数/事件由 PlayerController 处理）

## 4. 投递通道（谁来投递请求）

| 通道 | 实现 | 覆盖面 |
|---|---|---|
| 直施/主动 | `systems/items/activeItem.ts` stepActiveItem（S7 槽位） | 主动道具（钩锁 onActivate） |
| 拾取 | `ITEMS[id].onPickup` → applyEffect | 双跳票 → GrantJumpCharges |
| 碰撞 | `CollisionHooks` + `systems/interactions/hazard.ts` | 危险物 → KillRequest |
| 固体接触 | `stepPlayerGeneric` 弹簧接触点 → Impulse | 弹簧弹射 |

（光环/触发/区域为扩展通道，战斗期启用。）

## 5. 写者纪律（谁可以写玩家状态）

**只有以下允许直接写 PlayerState：**
1. `stepPlayerGeneric`（运动积分自身：位置/速度/grounded/coyote/jbuf/face/impulses 消费）
2. `applyEffect`（经 contracts/effects.ts）
3. `PlayerController`（生命周期：deadT/复活/切线/背包复位）

**以下已从"直写"改为"投递请求"：**
- `CollisionHooks` 危险物（原 `die()` 直调）→ KillRequest
- `CollisionHooks` 双跳票（原 `extraJumpsMax=1` 直写）→ `ITEMS['doubleJump'].onPickup`
- `hook.ts` fireHook（原裸写 7 个字段）→ 经 onActivate + 动词（attachTrack 语义）
- `game/index.ts` stepRemoteClients 远端（原内联危险物/双跳/钩锁三套复制）→ 共用契约 + ActiveItemSystem

新增机制（新道具/新环境物）的接入点：**注册表条目（onPickup/onActivate）+ 可选新 Effect kind + 可选新 verbs**，
**禁止**：往 `stepPlayerGeneric` 函数体追加分支、向 `PlayerState` 增加机制专用字段。