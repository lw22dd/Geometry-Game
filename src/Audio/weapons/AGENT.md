# Weapons 文件夹 — 每武器一个音效文件

<details>
<summary>Audio/weapons — 武器音效播放函数（参考 zombie-world 模型）</summary>

本目录存放每种武器的音效播放函数。每个文件 = 一种武器的一组 `playXxx()`，由 `Audio/utils.ts` 的脉冲原语（`sweep` / `noiseHit`）组合而成。游戏逻辑经 `core/audio.ts` 的 `sfx` 表薄分发调用，不在本目录放置任何游戏逻辑。
</details>

```
Audio/weapons/
├── ak.ts   # AK 武器音效：playAKFire（开火）/ playAKReload（换弹）/ playAKDryfire（空膛）/ playAKPickup（拾取）
└── AGENT.md
```

# 数据流

1. 依赖：流入的方向和原因

`Audio/utils.ts`（脉冲原语 `sweep` / `noiseHit`）。原语挂 `sfxBus`、支持 `pan`、节点 `onended` 主动 disconnect。

2. 本模块：经过 Audio/weapons 做了什么

将武器动作（开火 / 换弹 / 空膛 / 拾取）映射为脉冲原语组合，实现"峰值起步 + 指数衰减"的枪械质感。音量微随机 `r()` 与时值抖动 `j()` 保留，让每枪不完全一样。

3. 输出：流出的方向和目的

`playXxx()` → 由 `Audio/index.ts` 统一导出，`core/audio.ts` 的 `sfx` 表挂一条分发。新增武器音效 = 本目录新建 `weapons/<name>.ts` 写 `playXxx()`，在 `Audio/index.ts` 导出，在 `core/audio.ts` 的 `sfx` 分发里挂一条。
