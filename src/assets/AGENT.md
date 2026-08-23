# Assets 文件夹 — 静态资源

<details>
<summary>assets — 图片、图集等运行期加载的静态资源（预留，当前空）</summary>

本目录存放运行期加载的静态资源文件：图片、图集、字体等。当前游戏所有视觉效果均为 Canvas 2D 代码绘制，无外部图片资源。后续如需纹理/精灵图/UI 图标，放置于此。
</details>

```
assets/
（空目录，预留）
```

# 数据流

1. 依赖：流入的方向和原因


（预留）将依赖 Vite 静态资源导入机制（`import logo from './assets/logo.png'` 返回 URL）。

2. 本模块：经过 assets 做了什么


（预留）提供静态资源文件供游戏代码引用。Vite 构建时自动哈希、复制到 dist 目录。

3. 输出：流出的方向和目的

（预留）资源 URL → `config/`（注册表配置 sprite 路径）、`Prefabs/`（绘制时通过 ctx.drawImage 渲染）、`systems/ui/`（UI 图标）。