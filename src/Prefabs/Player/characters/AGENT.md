# Characters 文件夹 — 角色样式注册表

<details>
<summary>Prefabs/Player/characters — 角色样式数据定义与注册</summary>

本目录存放角色样式数据定义（CharacterStyle 接口）与注册表。每个角色是一个纯数据对象（颜色/尺寸/特效参数），不含绘制逻辑。新增角色只需在此添加数据文件并注册到 CHARACTERS 数组。
</details>

```
Prefabs/Player/characters/
├── index.ts    # CHARACTERS 角色数组 + DEFAULT_CHARACTER 默认角色 + re-export CharacterStyle
└── default.ts  # CharacterStyle 接口定义 + 默认角色「霓虹跑者」数据
```

# 数据流

1. 依赖：流入的方向和原因


无。本目录为纯数据定义，不依赖任何其他模块。

2. 本模块：经过 characters 做了什么


定义 CharacterStyle 接口（bodyGrad 三档渐变、stroke 描边色、glow 发光色、eyeColor 眼珠色、eyeDX 双眼偏移系数、radius 半径）。提供默认角色「霓虹跑者」的完整数据。CHARACTERS 数组汇总所有可用角色，DEFAULT_CHARACTER 指向默认角色。

3. 输出：流出的方向和目的

CharacterStyle 类型 + DEFAULT_CHARACTER → `Prefabs/Player/index.ts`（drawPlayer 参数）。CHARACTERS → 角色选择界面（当前未实现，预留）。