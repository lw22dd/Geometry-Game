# Styles 文件夹 — UI 样式常量

<details>
<summary>systems/ui/styles — UI 样式定义（预留，未实现）</summary>

本目录预留用于存放 UI 样式常量：颜色、字体、间距、主题定义等。当前这些值直接写在 drawing 函数中，后续可抽取为样式常量统一管理。
</details>

```
systems/ui/styles/
（空目录，预留）
```

# 数据流

1. 依赖：流入的方向和原因


（预留）将依赖 `types`（颜色/字体类型定义）。

2. 本模块：经过 styles 做了什么


（预留）定义 UI 主题色板、字体栈、间距常量、边框/阴影默认值。为 `systems/ui` 提供统一样式源，消除硬编码颜色值。

3. 输出：流出的方向和目的

（预留）样式常量 → `systems/ui/index.ts` 各绘制函数引用。