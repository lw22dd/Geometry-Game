# Enemy 文件夹 — 敌人音频资源

<details>
<summary>Audio/enemy — 敌人音效资源目录（预留，当前空）</summary>

本目录存放敌人相关音频资源文件：攻击音效、受击音效、死亡音效、警报音效等。当前游戏音效为代码合成，无外部音频文件。
</details>

```
Audio/enemy/
（空目录，预留）
```

# 数据流

1. 依赖：流入的方向和原因


（预留）将依赖 Vite 静态资源导入 + WebAudio AudioBuffer 解码。

2. 本模块：经过 Audio/enemy 做了什么


（预留）分类存放敌人音效源文件，与 `systems/enemy` 和 `Prefabs/Enemy` 对应。

3. 输出：流出的方向和目的

（预留）解码后的 AudioBuffer → `core/audio` → `systems/enemy` 在敌人攻击/受伤/死亡时播放。