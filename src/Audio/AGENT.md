# Audio 文件夹 — 音频资源

<details>
<summary>Audio — 音频资源目录（enemy / system / weapons 子目录）</summary>

本目录存放运行期加载的音频资源文件（.ogg/.wav/.mp3）。当前游戏所有音效均为 WebAudio 代码合成（core/audio.ts），无需外部音频文件。子目录按用途分类：enemy（敌人音效）、system（系统音效）、weapons（武器音效）。
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