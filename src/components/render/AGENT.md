# Render 文件夹 — 表现/渲染组件

<details>
<summary>render — 实体如何被绘制（数据容器）</summary>

本目录存放 ECS 组件的渲染子集。目前仅一个 Renderable 组件，封装实体的视觉数据——尺寸、渐变、发光色、动画参数。纯数据，不含绘制逻辑；绘制由 Prefabs 的 drawXxx 函数完成。
</details>

```
render/
└── Renderable.ts     # 视觉数据（radius/bodyGrad/glow/phase/bobSpeed/rotSpeed）
```

# 数据流

1. 依赖：流入的方向和原因

`core/ecs`（Entity/World/ComponentType）—— 组件注册所需。

2. 本模块：经过 render 做了什么

定义实体的视觉属性集合——身体半径、径向渐变三档色、发光色、动画相位与浮动/旋转速度。为 ECS 实体组装提供标准渲染描述。

3. 输出：流出的方向和目的

组件类 → `Prefabs/`（预制体将组件合成到实体，drawXxx 函数读取 Renderable 数据绘制到 canvas）。Prefabs 通过 `components/index.ts` barrel 统一导入。