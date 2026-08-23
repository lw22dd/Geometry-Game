# World 文件夹 — 世界/地图

<details>
<summary>systems/world — 粒子系统 + 场景绘制委托</summary>

本目录存放世界系统：粒子池（particles.ts）和场景绘制委托注册表（defs.ts）。粒子系统管理所有游戏粒子（死亡爆裂、落地尘土、收集闪光、检查点光柱、通关彩带）和冲刺曳光轨迹。defs.ts 是 Prefabs/Scenes 的薄委托入口。
</details>

```
systems/world/
├── particles.ts  # 粒子系统：EntityPool<Particle> 池、trail 曳光数组、part/burstDeath/dust/sparkle/cpFx/confetti、stepParticles
└── defs.ts       # 场景绘制委托注册表（转发到 Prefabs/Scenes：platforms/hazards/items/atmosphere）
```

# 数据流

1. 依赖：流入的方向和原因


`core/ecs`（EntityPool 实体池）、`core/canvas`（ctx）、`core/camera`（sx/sy/view）、`config`（TLIFE/关卡数据）、`types`（Particle/TrailPoint）。需要这些来管理粒子生命周期、转换坐标、读取关卡配置。

2. 本模块：经过 systems/world 做了什么


粒子系统：part() 工厂函数生成粒子并入池（上限 420），stepParticles(dt) 反向遍历更新位置/速度/旋转/寿命，超龄剔除。特效函数封装具体粒子模板（爆裂/尘土/闪光/光柱/彩带）。defs.ts 转发所有场景绘制函数到 Prefabs/Scenes。

3. 输出：流出的方向和目的

particles/trail → `Prefabs/Scenes/atmosphere`（drawTrail 读取 trail 数组、drawParticles 读取 particles.all）。特效函数（burstDeath/dust/sparkle/cpFx/confetti）→ `systems/player`（死亡/落地/收集/检查点/登顶时调用）。stepParticles → `systems/game` 主循环 step() 中调用。绘制函数 → `systems/game` render() 调用。