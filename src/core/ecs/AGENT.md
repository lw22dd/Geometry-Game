# ECS 文件夹 — 实体池遍历器

<details>
<summary>core/ecs — 实体池 + 组件式实体遍历（EntityPool）</summary>

本目录存放 ECS 基础底座：泛型实体池容器 EntityPool 与组件定义。当前粒子系统使用 EntityPool 管理粒子池。
</details>

```
core/ecs/
├── entityPool.ts   # EntityPool<T> 泛型类：push / updateAll / drawAll / depthList
├── index.ts        # barrel 导出
├── Entity.ts       # Entity 定义（组件式实体）
└── World.ts        # World 定义（实体容器）
```

# 数据流

1. 依赖：流入的方向和原因


`types`（共享类型）。需要类型参数 T 来构造泛型实体池；Entity/World 组件模式为实体行为组合提供基础。

2. 本模块：经过 core/ecs 做了什么


实体池遍历器——管理实体数组的生命周期（增删），提供逐帧更新（updateAll）、批量绘制（drawAll）、深度排序（depthList）。为游戏实体提供统一的容器与遍历协议。

3. 输出：流出的方向和目的

`EntityPool<T>` → `systems/particles` 管理粒子池（推入、反向遍历剔除超龄粒子）。Entity/World 供 Prefabs/Entities 装配实体，由 systems/ 各系统逐帧读写。