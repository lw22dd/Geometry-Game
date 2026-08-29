# 美术提取包 · 供外部 LLM 单独阅读

> 用途：这是**入口文档**。外部 LLM 只能读文件，请先读本文件，再按「必读 → 参考」顺序
> 读取后续列出的源码文件。全部美术都是**程序化 Canvas 绘制**，不依赖任何图片/音频素材。
>
> 项目：**NEON ASCENT · 霓虹攀升**（几何霓虹跑酷，Vite + TypeScript + Canvas 2D + ECS）

---

## 1. 美术路线一句话

> **纯 Canvas 2D 程序化霓虹几何风格：零图片素材、颜色全部由 HSL 色相码 + 少量令牌驱动、
> 动画全部由 gs.time 正弦驱动，视觉一致性靠一个统一风格令牌表（theme.ts）保证。**

这就是「不需要优化 token/额度」的原因：整条美术链路约 **90KB 纯文本代码**（≈3 万 token），
没有任何 PNG/图集/字体/音频二进制文件（全仓库仅 `public/favicon.svg` 一个矢量图标）。

---

## 2. 风格系统拆解（先读 theme.ts 再读绘制文件）

### 2.1 三层光照结构（neonBox 原语，全场景统一）
1. **底色**：深空紫 `rgba(15,11,42,.94)`（静态）/ 略亮一档表示"可动物体"
2. **内衬线**：内缩 3px、1px 宽、12% 透明的细线（小尺寸自动省略）
3. **发光描边 + 顶部高光**：2px 描边 + 顶部 2.2px 高光条 = 霓虹"管灯"感

### 2.2 光晕三档 = 交互三态（语义编码）
| 档位 | 值 | 含义 |
|---|---|---|
| glowStatic | 12 | 静态刚体（平台） |
| glowMovable | 14 | 可动（移动平台/道具） |
| glowFiring | 16 | 触发中（弹簧/激光/入口亮核） |

### 2.3 颜色编码（HSL 色相 = 功能语义）
- 关卡几何：**位置渐变色** `hue = 196 + 100·(x/w·0.55 + y/h·0.45)`，青 → 紫 → 品红
- `HUE_TRACK = 190` 青：轨道/滑行路径
- `HUE_SPRING = 145` 绿：弹簧/双跳增益
- 品红/粉：危险（尖刺 `#ff8ade`、激光 `#ff5fc8`）
- 白青 `#8ff6ff`：光球收集物
- 紫 `#c07dff` → 终点 NOVA；通关后变金 `#ffd76b`
- 金 `#ffc04d`：钩锁道具；蓝紫 `#b3c7ff`：护盾道具
- 蓝紫 `#8a82ff` → 激活后青 `#7df9ff`：检查点

### 2.4 动画语法（唯一时钟 = gs.time）
- 所有待机动画用 `sin(gs.time · breathSpeed + ph)`，`breathSpeed = 2.4 rad/s`
- 相位按世界坐标错开（`ph = entryX·0.6` 等），多实例不同步
- 实体动画统一走 `Animator → AnimOutput {scaleX/Y, rotation, offsetX/Y, alpha}` 参数包，绘制层只读参数

### 2.5 玻璃管道（轨道，最复杂绘制体）法线偏移结构
光晕壳 → 管身+中空内腔 → 菲涅尔亮边（上亮下弱）→ 镜面分段高光条（呼吸）→ 焦散细线 → 周期箍环+支座 → 能量芯虚线；法线统一朝向左上光源，保证全局光照一致。

### 2.6 粒子 / UI 氛围
- 粒子：`FX` 预设表（纯数据）+ 统一发射器，池上限 420
- UI 氛围层：种子随机星空 + 极光辉斑 + 漂浮线框几何 + 流星 + 色差双层流光标题

---

## 3. 涉及文件清单（相对仓库根目录）

### A. 必读 —— 美术核心（按阅读顺序）
| # | 路径 | 大小 | 角色 |
|---|---|---|---|
| 1 | `src/Prefabs/Scenes/theme.ts` | 3.6KB | **风格令牌表 T + neonBox 原语（先读这个）** |
| 2 | `src/Prefabs/Scenes/platforms.ts` | 11KB | 平台/网格/地图边框/装饰方块/移动平台/弹簧 |
| 3 | `src/Prefabs/Scenes/atmosphere.ts` | 4.1KB | 视差背景 / 冲刺曳光 / 粒子绘制 / 关卡提示文字 |
| 4 | `src/Prefabs/Scenes/items.ts` | 11KB | 光球/检查点/NOVA 终点/双跳票/钩锁/护盾道具 |
| 5 | `src/Prefabs/Scenes/tracks.ts` | 10.7KB | 玻璃管道轨道（neonGlassTube 原语） |
| 6 | `src/Prefabs/Scenes/hazards.ts` | 2.9KB | 尖刺/激光栅栏 |
| 7 | `src/config/background.ts` | 0.9KB | 视差远/中层形状的种子生成（mulberry） |
| 8 | `src/Prefabs/Fx/presets.ts` | 3.5KB | 特效预设表（死亡/尘土/闪光/彩带/护盾碎） |
| 9 | `src/systems/particles.ts` | 3.2KB | 粒子池运行时（发射/步进/回收） |
| 10 | `src/Prefabs/Player/characters/default.ts` | 0.9KB | CharacterStyle 接口 + 默认角色「霓虹跑者」数据 |
| 11 | `src/Prefabs/Player/characters/crimson.ts` | 0.7KB | 第二角色「绯红冲刺者」数据 |
| 12 | `src/Prefabs/Player/characters/index.ts` | 1.4KB | 角色注册表 CHARCTERS |
| 13 | `src/Prefabs/Player/default/render.ts` | 2.4KB | 玩家纯绘制（发光球体+双眼+护盾罩） |
| 14 | `src/Prefabs/Player/default/animation.ts` | 5.5KB | 玩家动画 FSM（squash 形变合成） |
| 15 | `src/Prefabs/Animations/types.ts` | 2.4KB | 实体动画输出契约 AnimOutput |

### B. 参考 —— 视觉相关但不改也能理解
| 路径 | 大小 | 角色 |
|---|---|---|
| `src/Prefabs/Scenes/itemsAnimators.ts` | 6.3KB | 道具动画控制器（orb/nova/jumpBoost/hook） |
| `src/systems/uiAtmosphere.ts` | 8.4KB | UI 氛围层（星空/极光/流星/流光标题）可复用 |
| `src/systems/ui/hud.ts` | 8.8KB | HUD 统计面板 / 小地图绘制 |
| `src/systems/ui/menu.ts` | 14KB | 主菜单（霓虹标题 + 氛围按钮） |
| `src/systems/ui/gallery.ts` | 35KB | 预制体图鉴（美术展示目录） |
| `src/systems/ui/prepare.ts` | 20KB | 选图/选人卡片界面 |
| `src/config/level.ts` | 33.6KB | 关卡布局 + floor 色块 color（地图配色数据源） |
| `public/favicon.svg` | 9.5KB | 全仓库唯一矢量图标 |

### C. 可选 —— 编辑器侧美术（做地图时才需要）
| 路径 | 角色 |
|---|---|
| `工具/SceneEditor/src/palette.ts` / `render.ts` / `templates.ts` / `cells.ts` / `style.css` | 地图编辑器绘制与调色板 |

### D. 不需要给外部 LLM 的
`node_modules/`、`dist/`、`GoServer/`、`_shots/`（截图）、`工具/SceneEditor/dist/`（构建产物）、`.git/`。

---

## 4. 给外部 LLM 的扩展指南（读完后可做的事）

- **新增角色**：仿 `characters/crimson.ts` 建一个 `CharacterStyle` 数据文件 → 注册进 `characters/index.ts` 的 `CHARACTERS`。
- **新增道具视觉**：在 `items.ts` 加一个 `drawXxx()`（复用"泛光圈 + 主体 + 高光"三段式）+ 在 `Fx/presets.ts` 加拾取特效；动画参数走 `Animator`。
- **新地图配色**：改 `level.ts` 对应 `floor` 细胞的 `color` 字段，或调整 `platforms.ts` 的 `hue2` 渐变公式。
- **新增特效**：在 `Fx/presets.ts` 加一条纯数据预设即可，无需改粒子运行时。
- **风格纪律**：颜色用 HSL 色相码语义化表达；动画只用 `gs.time` 正弦；发光一律 `shadowColor + shadowBlur` 三档。