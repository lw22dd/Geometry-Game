# Player 文件夹 — 玩家角色预制体

<details>
<summary>Prefabs/Player — 玩家角色绘制建模（CharacterStyle 驱动）</summary>

本目录存放玩家角色预制体：drawPlayer() 绘制实现（角色样式参数化），characters/ 子目录存放角色样式注册表（CHARACTERS / DEFAULT_CHARACTER / CharacterStyle 接口）。当前默认角色为「霓虹跑者」（发光球体 + 双眼）。
</details>

```
Prefabs/Player/
├── index.ts        # drawPlayer(style?) 绘制实现 + re-export CHARACTERS/DEFAULT_CHARACTER
└── characters/     # 角色样式注册表
    ├── index.ts    #   CHARACTERS 数组 + DEFAULT_CHARACTER
    └── default.ts  #   默认角色「霓虹跑者」：bodyGrad/stroke/glow/eyeColor/eyeDX/radius
```

# 数据流

1. 依赖：流入的方向和原因


`core/canvas`（ctx）、`core/camera`（sx/sy/view）、`core/math`（clamp）、`systems/player`（P 玩家状态）、`systems/game/state`（gs.time 游戏时钟）。需要这些来将玩家状态（位置/速度/形变/朝向/无敌）转换为像素绘制。

2. 本模块：经过 Prefabs/Player 做了什么


实体模板工厂——根据 CharacterStyle 参数绘制玩家角色：身体径向渐变圆球、外描边、发光阴影、双眼（眨眼动画）、空中拉伸/落地压扁形变、受伤闪烁。`characters/` 注册表管理多角色样式数据，新增角色只需在 characters/ 添加数据文件并注册。

3. 输出：流出的方向和目的

drawPlayer(style?) → `systems/game` render() 每帧直接调用。CHARACTERS/DEFAULT_CHARACTER → `systems/ui` 角色选择界面（当前未实现，预留）。