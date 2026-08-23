# Fx 文件夹 — 特效发射预制体

<details>
<summary>Prefabs/Fx — 粒子特效预设表 + 通用发射器（预制体层）</summary>

本目录存放粒子特效的「配方」（preset 纯数据）与统一发射器 `spawnFx`。一个特效 = 一条预设数据（数量/粒子类型/速度分布/重力/寿命/尺寸/颜色/旋转），由发射器按预设生成一批粒子推入 `systems/particles` 的粒子池。原 burstDeath / dust / sparkle / cpFx / confetti 五个分散函数已合并为 spawnFx + FX 表。
</details>

```
Prefabs/Fx/
├── index.ts    # barrel 导出：FX / spawnFx / 类型
├── presets.ts  # FX 预设注册表：death / jump / land / trail / cp / nova / confetti 等（纯数据）
└── spawn.ts    # spawnFx(preset, x, y, count?) 通用发射器：radial / axis 两种速度模式
```

# 数据流

1. 依赖：流入的方向和原因


`types`（ParticleKind 类型）、`systems/particles`（part 推入粒子池）。需要粒子池承接生成的粒子，预设表提供发射参数。

2. 本模块：经过 Prefabs/Fx 做了什么


定义特效预设（纯数据模板）与通用发射逻辑——按 preset 生成 count 颗粒子（支持圆周均匀/随机方向/独立轴向速度、水平散布、重力、交替取色、碎片旋转），推入粒子池。

3. 输出：流出的方向和目的


粒子 → `systems/particles` 粒子池（由 `game/index` step() 调用 stepParticles 逐帧步进，`Prefabs/Scenes/atmosphere` drawParticles 绘制）。`spawnFx` → `systems/player`（死亡爆裂/跳跃/落地）、`systems/CheckpointSystem`/`NovaSystem`（检查点/登顶特效）等调用方。