# Fx 文件夹 — 特效预设数据表（预制体层）

<details>
<summary>Prefabs/Fx — 粒子特效「配方」纯数据；运行时发射由 systems/particles 负责</summary>

本目录只存放粒子特效的「配方」（preset 纯数据），**不包含任何运行时生命周期**。一个特效 = 一条预设数据（数量/粒子类型/速度分布/重力/寿命/尺寸/颜色/旋转）。发射由 `systems/particles` 的 `spawnParticles(preset, x, y, countOverride?)` 完成：按预设生成一批粒子推入粒子池。原 burstDeath / dust / sparkle / cpFx / confetti 五个分散函数已合并为 FX 表 + spawnParticles。
</details>

```
Prefabs/Fx/
├── index.ts    # barrel 导出：FX / 类型（无运行时导出）
└── presets.ts  # FX 预设注册表：death / dust / sparkle / cp / confetti（纯数据）
```

# 数据流

1. 依赖：流入的方向和原因


`types`（ParticleKind 类型）。仅此而已——本层是纯数据层，不依赖任何系统/运行时模块。

2. 本模块：经过 Prefabs/Fx 做了什么


定义特效预设（纯数据模板），供 `systems/particles.spawnParticles` 读取后生成粒子。

3. 输出：流出的方向和目的


FX 预设表 → `systems/particles`（spawnParticles 读取，推入粒子池；由 `game/index` step() 调用 stepParticles 逐帧步进，`Prefabs/Scenes/atmosphere` drawParticles 绘制）。调用方（`systems/game`、`systems/interactions`）从本层取 FX 数据、从 `systems/particles` 调 spawnParticles。