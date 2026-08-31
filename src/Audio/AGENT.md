# Audio —— 音效播放函数（参考 zombie-world 模型）

无音频文件，全部用 Web Audio 实时合成（`core/audio.ts` 提供 OSC 总线与 ADSR 原语，本目录提供脉冲模型原语与武器播放函数）。

## 文件

| 文件 | 职责 |
|---|---|
| `utils.ts` | 脉冲模型原语：`sweep`（扫频冲击）/ `noiseHit`（滤波噪声打击）。峰值起步 + 指数衰减，支持 delay / pan |
| `weapons/ak.ts` | AK 武器音效：`playAKFire` / `playAKReload` / `playAKDryfire` / `playAKPickup` |
| `index.ts` | 统一导出所有播放函数 |

## 模型对比（vs core/audio）

- `core/audio` 的 `osc` / `noise` 走 **ADSR**（attack/decay/sustain/release），适合持续音与起音柔的音色；
- `utils.ts` 的 `sweep` / `noiseHit` 走**脉冲 + 指数衰减**（峰值起步、按指数自然衰掉），天然贴合枪声、弹匣、机械咔哒——能量瞬间注入。

## 约定

- 只放「如何发声」的函数，不放游戏逻辑；游戏通过 `core/audio.ts` 的 `sfx` 表薄分发调用。
- 新增音效 = 在对应子目录写 `playX()`，在 `index.ts` 导出，在 `core/audio.ts` 的 `sfx` 分发里挂一条。
- 原语全部挂 `sfxBus`、支持 `pan`、节点 `onended` 主动 disconnect（防泄漏）。
- 依赖方向：本目录（utils.ts）只读 `core/audioState` 的 `AU`（叶子模块），不 import `core/audio`，避免模块级循环依赖（core/audio → Audio → core/audio）。