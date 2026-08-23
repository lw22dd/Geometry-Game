# Weapons 文件夹 — 武器音频资源

<details>
<summary>Audio/weapons — 武器音效资源目录（预留，当前空）</summary>

本目录存放武器相关音频资源文件：开枪音效、换弹音效、爆炸音效、弹道呼啸音效等。当前游戏音效为代码合成，无外部音频文件。
</details>

```
Audio/weapons/
（空目录，预留）
```

# 数据流

1. 依赖：流入的方向和原因


（预留）将依赖 Vite 静态资源导入 + WebAudio AudioBuffer 解码。

2. 本模块：经过 Audio/weapons 做了什么


（预留）分类存放武器音效源文件，与 `systems/combat` 和 `Prefabs/WeaponVis` 对应。

3. 输出：流出的方向和目的

（预留）解码后的 AudioBuffer → `core/audio` → `systems/combat` 在开火/爆炸/换弹时播放。