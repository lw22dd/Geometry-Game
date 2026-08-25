# Items 文件夹 — 物品系统

<details>
<summary>items — 背包运行时 + 钩锁系统（玩法逻辑）</summary>

本目录存放主动/被动道具的系统逻辑。背包模块提供纯函数式道具注册表与槽位操作（addItem/hasItem/isFull），钩锁模块提供主动道具的发射、射线检测、滑索构造与瞄准渲染。不持有全局状态，背包数据驻留在 PlayerState.backpack 上。
</details>

```
items/
├── backpack.ts        # 背包运行时：道具注册表 ITEMS + 槽位操作（addItem/hasItem/isFull）
└── hook.ts            # 钩锁系统：发射（fireHook）、射线检测（raycastHook）、帧步进（stepHookPlayer）、渲染（drawHookAim / drawHookRope）
```

# 数据流

1. 依赖：流入的方向和原因

`types`（PlayerState / ItemId / TrackState 等）、`config`（物理参数 HOOK_MAX_RANGE / HOOK_SPEED / HOOK_COOLDOWN）、`core/canvas`（ctx / VW / VH）、`core/camera`（sx / sy / view）、`core/mouse`（mouse 全局状态）、`core/audio`（sfx）、`systems/player`（getSolids 获取固体碰撞箱列表）。

2. 本模块：经过 items 做了什么

背包管理道具的收集与装备，钩锁提供主动道具的完整玩法闭环——鼠标瞄准方向引导 → 射线检测命中固体 → 构造滑索轨道（TrackState）→ 物理引擎接管沿轨运动 → 到锚点脱钩。联机场景下，本地玩家走预测路径，房主通过 stepRemoteClients 中调用的 fireHook 模拟远程玩家。

3. 输出：流出的方向和目的

`systems/game`（主循环 step 调用 stepHookPlayer）、`systems/player/PlayerController`（钩锁轨道物理由 stepTrackMotion 处理）、`Prefabs/Scenes`（道具预制体工厂引用 ITEMS 注册表确定道具类型）。