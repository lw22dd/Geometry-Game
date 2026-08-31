# WeaponVis 文件夹 — 武器外观预制体

<details>
<summary>Prefabs/WeaponVis — 武器本体建模与图标（建模单一来源）</summary>

本目录集中所有武器绘制：AK 步枪 / 手雷 的本体建模与图标。调用方（拾取物 / 抛体 / 玩家持枪 / HUD / 图鉴）统一从这里取武器形状，不再各自散落一份武器绘制代码。
</details>

```
Prefabs/WeaponVis/
├── index.ts  # drawAKShape / drawGrenadeShape（纯本体，原点绘制）+ drawAKIcon / drawGrenadeIcon / drawWeaponIcon（带发光阴影图标）
└── AGENT.md
```

# 数据流

1. 依赖：流入的方向和原因

`core/canvas`（ctx）。本模块几乎零依赖，是纯绘制层。

2. 本模块：经过 Prefabs/WeaponVis 做了什么

定义武器绘制 API 分层：纯本体（发光阴影由调用方控制）与带发光阴影的图标。材质规范（竖向渐变 + 顶缘受光 + 底缘阴影 + 右缘暗边，metal / wood / polished / rough 四档）保证体素块有厚度感；纹理按块体面积自动 LOD。

3. 输出：流出的方向和目的

`drawAKShape` / `drawGrenadeShape` → 拾取物（`Prefabs/Scenes/items`）、抛体（`systems/combat/projectile`）。`drawAKIcon` / `drawGrenadeIcon` / `drawWeaponIcon` → HUD 背包栏（`systems/ui/hud`）、图鉴（`systems/ui/icons`）、持枪（`systems/items/hold`）、ItemVis 转发。

⚠ 契约：`drawAKShape` 的参考坐标系（枪口朝右）与 `s = r * 0.09` + `translate(-20, 3)` 的映射不得改动——全部调用方的尺寸与对齐都依赖这组常量。
