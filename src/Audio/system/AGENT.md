# System 文件夹 — 系统音频资源

<details>
<summary>Audio/system — 系统音效资源目录（预留，当前空）</summary>

本目录存放系统相关音频资源文件：UI 点击音效、菜单音效、提示音、成就解锁音效等。当前游戏音效为代码合成，无外部音频文件。
</details>

```
Audio/system/
（空目录，预留）
```

# 数据流

1. 依赖：流入的方向和原因


（预留）将依赖 Vite 静态资源导入 + WebAudio AudioBuffer 解码。

2. 本模块：经过 Audio/system 做了什么


（预留）分类存放系统音效源文件，与 `systems/ui` 和 `systems/game` 对应。

3. 输出：流出的方向和目的

（预留）解码后的 AudioBuffer → `core/audio` → `systems/game`（菜单/开始/通关）和 `systems/ui`（按钮点击）播放。