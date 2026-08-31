# ItemVis 文件夹 — 普通道具外观预制体

<details>
<summary>Prefabs/ItemVis — 背包道具本体建模与图标（建模单一来源，与 WeaponVis 同层）</summary>

本目录集中所有背包道具（二段跳票 / 钩锁 / 护盾 / 加速 / AK / 手雷）的本体建模与图标。场景拾取物（`Prefabs/Scenes/items`）与 HUD 背包图标（`systems/ui/hud`）、图鉴、持枪统一从这里取形状——新增道具 = 本文件加一个分支，场景与背包图标自动绑定生效。武器形状转发 `WeaponVis`（武器建模单一来源不变）。
</details>

```
Prefabs/ItemVis/
├── index.ts  # drawItemModel(id, r) 纯本体 / drawItemIcon(id, cx, cy, r) 带发光阴影图标 / ITEM_ICON_R 槽位尺度表
└── AGENT.md
```

# 数据流

1. 依赖：流入的方向和原因

`core/canvas`（ctx）、`types`（ItemId）、`Prefabs/WeaponVis`（武器转发：drawWeaponModel / drawAKIcon / drawGrenadeIcon）。需要这些来绘制道具本体与图标。

2. 本模块：经过 Prefabs/ItemVis 做了什么

定义每种背包道具的形状（本体 / 图标分层）。`drawItemModel` 供场景拾取物绘制（泛光 / 旋转 / bob 由调用方控制），`drawItemIcon` 供 HUD 背包栏 / 图鉴 / 持枪使用（含发光阴影）。

3. 输出：流出的方向和目的

`drawItemModel` → `Prefabs/Scenes/items`（场景拾取物）。`drawItemIcon` → `systems/ui/hud`（背包栏）、`systems/ui/icons`（图鉴）、`systems/items/hold`（持枪）。新增道具 = 本文件加一个形状分支 + `types` 的 `ItemId` 加一项。
