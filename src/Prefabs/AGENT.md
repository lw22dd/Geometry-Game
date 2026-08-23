# Prefabs — 预制体建模层

本目录存放所有**实体 / 场景道具的绘制建模**（prefab 定义）。与 `systems/*` 的分工：

- `Prefabs/` = **怎么画**（几何体、颜色、发光、动画形态）
- `systems/*` = **怎么做**（物理、AI、逻辑、状态变化）

一个预制体 = 一个模块，导出 `drawXxx()` 纯绘制函数。**预制体内不允许出现游戏逻辑**（碰撞、计分、状态写入等）。

---

## 目录结构

```
Prefabs/
├── Enemy/           # 敌人预制体（含 boss；预留，未建模）
├── NPC/             # NPC 预制体（预留）
├── Player/          # 玩家角色建模（已实现）
│   ├── index.ts     #   drawPlayer(style?) —— 玩家绘制实现
│   └── characters/  #   角色样式注册表
│       ├── index.ts #     CHARACTERS / DEFAULT_CHARACTER
│       └── default.ts #   默认角色「霓虹跑者」样式数据
├── Scenes/          # 场景道具建模（已实现）
│   ├── index.ts     #   barrel 导出
│   ├── platforms.ts #   长方形：solids / movers / border / decos / grid
│   ├── hazards.ts   #   三角形尖刺 + 激光栅栏
│   ├── items.ts     #   光球 / 检查点 / NOVA 星
│   └── atmosphere.ts#   视差 / 曳光 / 粒子 / 文字提示
└── WeaponVis/       # 武器外观预制体（预留）
```

---

## 依赖规则

| 可导入 | 说明 |
|---|---|
| `core/*` | ✅ 画布 ctx、相机 sx/sy/view、数学工具 |
| `config/*` | ✅ 只读关卡 / 样式数据 |
| `types/*` | ✅ 共享类型 |
| `systems/*` 状态 | ⚠️ **只读**——绘制需要玩家状态 P、游戏时钟 gs.time 等，仅读取，绝不写入 |
| `systems/*` 逻辑 / net / Prefabs 兄弟模块 | ❌ 禁止反向依赖逻辑层 |

**界限**：读状态画出来 ✅；改状态 / 触发行为 ❌。

---

---


## 现有模块速查

| 模块 | 导出 | 构成 |
|---|---|---|
| `Scenes/platforms.ts` | `drawSolids` 静态平台 / `drawMovers` 移动平台 / `drawBorder` 地图边框 / `drawDecos` 装饰方块 / `drawGrid` 网格线 | 长方形刚体 + 网格 + 发光描边 |
| `Scenes/hazards.ts` | `drawSpikes` 尖刺 / `drawLasers` 激光栅栏 | 三角形合并路径 + 时序激光 |
| `Scenes/items.ts` | `drawOrbs` 光球 / `drawCheckpoints` 检查点 / `drawNOVA` 终点星 | 收集品 / 检查点光柱 / NOVA 菱形 |
| `Scenes/atmosphere.ts` | `drawParallax` / `drawTrail` / `drawParticles` / `drawHints` | 视差背景 / 冲刺曳光 / 粒子 / 提示文字 |
| `Player/index.ts` | `drawPlayer(style?)` | 玩家角色（styles 驱动） |
| `Player/characters/` | `CHARACTERS` / `DEFAULT_CHARACTER` / `CharacterStyle` | 角色样式注册表 |

---

## 分层提醒

`systems/game/index.ts`（渲染编排）只从 `systems/*/defs.ts` 导入绘制函数，不直接 import 本目录。保持：

```
systems/game ──> systems/*/defs.ts ──> Prefabs/*（实际建模）
```