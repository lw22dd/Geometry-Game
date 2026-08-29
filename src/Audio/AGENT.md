# Audio 文件夹 — 音频资源

<details>
<summary>Audio — 音频资源目录（enemy / system / weapons 子目录）</summary>

本目录存放运行期加载的音频资源文件（.ogg/.wav/.mp3）。当前游戏所有音频均为 WebAudio 代码合成（音效见 `core/audio.ts`，分层动态 BGM 见 `core/music.ts`），无需外部音频文件。子目录按用途分类：enemy（敌人音效）、system（系统音效）、weapons（武器音效）。

> 音画升级后仍是纯代码合成路线：音效走分轨总线（sfx/bgm/master + 限幅器）并支持声像与节流，BGM 为 bass / arp / pad / perc 四层动态织体。若将来要换成采样素材，把文件放进对应子目录并在 `core/audio.ts` 增加 AudioBuffer 解码通路即可，接口不变。
</details>

```
Audio/
├── enemy/    # 敌人音效（预留）
├── system/   # 系统音效（预留）
└── weapons/  # 武器音效（预留）
```

# 数据流

1. 依赖：流入的方向和原因


（预留）将依赖 Vite 静态资源导入机制 + WebAudio API（AudioBuffer 解码）。

2. 本模块：经过 Audio 做了什么


（预留）存放音频源文件，按用途分类。可通过 `core/audio` 的 AudioBuffer 解码加载，替代当前代码合成音效。

3. 输出：流出的方向和目的

（预留）解码后的 AudioBuffer → `core/audio` 的 sfx 音效表，供 `systems/player`（跳跃/冲刺/死亡/收集）、`systems/combat`（开火/爆炸）、`systems/enemy`（敌人音效）等播放。