# Default 文件夹 — 默认角色预制体「霓虹跑者」

<details>
<summary>Prefabs/Player/default — 默认预制体：动画 FSM（states / animation）+ 纯绘制（render）+ 组合（defaultPrefab）</summary>

存放默认预制体的四个文件：状态定义（states.ts）、动画状态机步进 + 输出合成（animation.ts）、纯 Canvas 绘制（render.ts）、按 PlayerPrefab 接口组合（defaultPrefab.ts）。动画只读 PlayerState 物理事实 + 自身记忆（previous* 边沿检测），不读按键、不碰碰撞；绘制只读 AnimOutput + CharacterStyle，不含动画逻辑。
</details>

```
Prefabs/Player/default/
├── states.ts          # AnimState 枚举 + ANIM_TRANSITIONS 转换表（纯数据）
├── animation.ts       # DefaultAnimState + stepDefaultAnimation（边沿检测/状态转换/形变）/ getDefaultOutput
├── render.ts          # renderDefaultPlayer：纯绘制（发光圆球 + 双眼 + 眨眼 + 受伤闪烁）
└── defaultPrefab.ts   # 组合：实现 PlayerPrefab 接口的 defaultPrefab 对象
```

# 数据流

1. 依赖：流入的方向和原因

`core/canvas`（ctx）、`core/camera`（sx/sy/view）、`core/math`（clamp）、`systems/game/gameState`（gs.time，控制呼吸/奔跑节奏等表现计时）、`types`（PlayerState / AnimOutput / FrameSignals）、`../characters`（CharacterStyle 样式数据）。需要这些读取玩家物理事实、合成/消费动画输出参数。

2. 本模块：经过 Prefabs/Player/default 做了什么

- **步进**：`stepDefaultAnimation(state, player, dt, signals?)` — 首帧快照不触发边沿；此后从上帧记忆推导边沿信号（起跳/落地/死亡/复活/冲刺），按 ANIM_TRANSITIONS 执行状态转换并注入形变事件（jumpRise 拉伸 / land 压扁 / collectPulse / bump），squash 指数衰减恢复。
- **合成**：`getDefaultOutput(state, player)` — 按当前状态与 gs.time 合成 AnimOutput 参数包（scaleX/scaleY/rotation/offset/alpha），供绘制层消费。
- **绘制**：`renderDefaultPlayer(player, output, style)` — 纯渲染：发光球体（径向渐变 + 外描边）、双眼（blink）/眨眼、受伤无敌闪烁（inv 帧闪烁）。
- **组合**：`defaultPrefab.ts` 将三者按 PlayerPrefab 接口（createState/step/getOutput/draw）装配，注册进 `Prefabs/Player/registry.ts`。

3. 输出：流出的方向和目的

`defaultPrefab` → `Prefabs/Player/index.ts`（stepPlayerAnimation / drawPlayer / drawPlayerFor 统一按此路径消费）。AnimOutput → render.ts 直接消费；绘制结果 → canvas 2D context。