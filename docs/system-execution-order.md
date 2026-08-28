# 系统执行顺序（金标准 + 现状对照）

> 用途：玩家物理重构期间，任何"新机制系统"只允许插入下方指定的**插槽**，
> 不得改写既有插槽内的行为。这是"机制互不冲突"在执行层的保证。
> **2026-08 更新**：契约层（effects）已落地 —— 所有影响来源只投递 PlayerRequest，
> 玩家侧经 applyEffect 结算写入；弹簧/危险物/拾取/主动道具均已接入契约（见 docs/effect-contract.md）。
> 下文"待引入"标记随实现推进逐项更新。

## 1. 目标顺序（重构完成后）

单次固定步长（FDT = 1/120s）内的系统管道：

```
| 槽位 | 系统 | 职责 | 现况 |
|---|---|---|---|
| S1 | 输入收集 | 键盘 → PlayerInput（本地）；网络输入缓冲（远程） | 已有（setInput / getClientInput） |
| S2 | 输入解析 | 按下沿（jumpFresh / hook 边沿） | 部分内联在物理中 |
| S3 | 控制权仲裁 (MoveMode) | dead > zipline > track > spring > sprint > free，单槽优先级别表 | **扩展位**（当前为 if/return 顺序隐式表达；Constraint 类机制启用时落地） |
| S4 | 玩家物理 (MovementSystem) | 加速度/跳跃/重力/碰撞/外力消费（弹簧/击退/气流经 ImpulseQueue） | stepPlayerGeneric（外力已契约化：Effect.Impulse） |
| S5 | 场景物理 | 移动平台 / 弹簧动画 / 激光计时 | updateMotion / updateSpringPads / updateLaserTimer |
| S6 | 交互 | 收集 / 检查点 / 终点 / 危险物 | CollisionSystem + CollisionHooks（危险物投 KillRequest，经结算管线） |
| S7 | 主动道具 | 钩锁冷却 / 发射 / 滑索接管（写 track） | stepActiveItem（S7 注册表派发，本地/远端共用） |
| S8 | 玩家动画 FSM | 由物理事实 + FrameSignals 驱动 | stepPlayerAnimation |
| S9 | 表现 | 粒子 / 曳光 / UI / 相机 | stepParticles / render |
| S10 | 网络 | 房主：客机模拟 + 状态广播；客机：发输入 + 矫正 | stepRemoteClients / netBridge（远端与本地共用契约层，去重完成） |
```

**新机制系统的唯一合法入口**：
- 只接管控制权 → 注册新 MoveMode 优先级（S3）；
- 只改数值/状态 → 新增 Effect kind + verbs，或新增组件挂到 S4~S7 的合适插槽；
- 只做表现 → S9。
禁止：往 stepPlayerGeneric 函数体追加行为分支、向 PlayerState 增加机制专用字段（金测试会拦）。

## 2. 现状对照（2026-08 契约化后真实顺序，`systems/game/index.ts` `step()`）

```
1. gs.time += dt；鼠标按下沿捕获
2. 关卡级：updateMotion() / updateSpringPads(dt) / updateLaserTimer()
3. stepAnimation(dt)          // 实体动画 FSM
4. stepParticles(dt)          // 粒子+曳光
5. Toast 衰减
6. （非 playing 提前返回）
7. gs.gt += dt
8. 死亡计时（房主/单机倒计时复活；客机维持死亡视觉）
9. 本地输入注入：getLocalInputKeys() → setInput()
10. 客机：net.sendInput(inputKeys)
11. playerController.step()    // 物理(stepPlayerGeneric) → 碰撞事件(契约投递) → 动画 → 曳光
12. syncToEcs(pState)          // 玩家实体桥：PlayerState → ECS（qLocalPlayer 查询面）
13. stepActiveItem(pState)     // S7 主动道具（钩锁 onActivate），本地鼠标边沿/瞄准
14. 房主：stepRemoteClients(dt)（远端同样走 stepActiveItem + checkHazardOverlap 契约）+ 每 2 帧广播
```

差异说明：
- 目标顺序把"玩家物理"与"场景物理"合并为前后相邻的两个槽位（S4/S5），
  当前场景物理在玩家物理**之前**（2 先于 11）。
- 目标顺序显式化 S2/S3 两个目前内联/隐式的步骤（S3 控制权仲裁留作扩展位）。
- 危险物/拾取/弹簧均已契约化：来源只投递 PlayerRequest，玩家侧 applyEffect 结算。
- 所有渲染在固定步进之后统一 `render(dt)`（可变帧率）。

## 3. 顺序纪律

- 重构每步只迁移**一个**槽位（如先把死亡计时移出 step()），金测试保持绿。
- `FDT` 与累积器逻辑（`frame()`：最多 10 次子步、dt 上限 0.06、acc 上限 0.2）不变。
- 本文件与 `docs/player-state-writers.md` 是重构的核对基线。