# Scenes 文件夹 — 场景道具预制体

<details>
<summary>Prefabs/Scenes — 场景道具建模（平台/障碍/收集品/终点/氛围）</summary>

本目录存放所有场景道具的绘制实现，按类型分组：platforms（长方形平台/边框/装饰/网格）、hazards（三角形尖刺 + 激光栅栏）、items（光球/检查点/NOVA 星）、atmosphere（视差/曳光/粒子/文字提示）。纯绘制，不含游戏逻辑。
</details>

```
Prefabs/Scenes/
├── index.ts        # barrel 导出
├── platforms.ts    # 长方形：drawSolids / drawMovers / drawBorder / drawDecos / drawGrid
├── hazards.ts      # 三角形+激光：drawSpikes / drawLasers
├── items.ts        # 收集品+终点：drawOrbs / drawCheckpoints / drawNOVA
└── atmosphere.ts   # 氛围：drawParallax / drawTrail / drawParticles / drawHints
```

# 数据流

1. 依赖：流入的方向和原因


`core/canvas`（ctx/VW/VH）、`core/camera`（sx/sy/view）、`core/math`（clamp）、`config`（所有关卡数据：solids/movers/spikes/lasers/orbs/cps/NOVA/hints/decos/farShapes/midShapes）、`systems/game/state`（gs.time/gs.win）、`systems/player`（P.sprint/P.dead/P.face/P.x/P.y）、`systems/world/particles`（trail/particles）。需要这些来将世界坐标转换为像素绘制、读取游戏状态控制动画。

2. 本模块：经过 Prefabs/Scenes 做了什么


场景道具模板工厂——将配置数据（Rect/Mover/Spike/Laser/Orb/Checkpoint/Deco/FarShape/MidShape）转换为 Canvas 2D 绘制命令。每个 drawXxx() 函数独立负责一类道具的完整绘制（可见性裁剪、坐标换算、颜色/发光/阴影/动画）。

3. 输出：流出的方向和目的

绘制函数 → `systems/world/defs.ts`（薄委托）→ `systems/game` render() 按顺序调用（drawParallax → drawGrid → drawBorder → drawDecos → drawSolids → drawMovers → drawCheckpoints → drawSpikes → drawLasers → drawOrbs → drawNOVA → drawTrail → drawParticles → drawHints）。