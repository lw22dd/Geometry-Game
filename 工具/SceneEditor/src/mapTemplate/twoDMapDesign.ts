import type { MapData } from '../mapTypes';
import type { MapTemplate } from './types';

/**
 * 2D地图设计 · 结构底盘（MVMap 导入底图，x×3、y×2 缩放）+ 完整道具配置。v2 重排版
 *
 * 坐标约定：y 向上（y=0 地面 / y=40 顶部），x=1-4 为贯穿竖井。
 * 五层结构：L0 地面回廊 → L1 下层展廊 → L2 中央大厅(出生枢纽) → L3 上层回廊 → L4 顶层圣所。
 * 能力门控：双跳(大厅石柱) → 钩锁(大厅右段，渡 6 格断层) → 护盾(尖刺/激光区前) 。
 * 登顶双路线：左侧电梯(稳妥，过顶层激光门) / 右侧高塔(双跳+渡车，直达 NOVA 台)。
 */
const TWO_D_MAP_DATA: MapData = {
  version: 2,
  id: '2d-map-design',
  name: '2D地图设计 · 底图',
  width: 122,
  height: 40,
  playerSpawn: { x: 58.5, y: 19.5 },

  layers: {
    geometry: [
      /* ── 边界 ── */
      { type: 'rect', x: 0, y: 0, w: 122, h: 1, rotation: 0 },   // 地面
      { type: 'rect', x: 0, y: 39, w: 122, h: 1, rotation: 0 },  // 天花板
      { type: 'rect', x: 0, y: 1, w: 1, h: 38, rotation: 0 },    // 左墙
      { type: 'rect', x: 121, y: 1, w: 1, h: 38, rotation: 0 },  // 右墙

      /* ── L0 地面回廊（竖井右南侧的起步区）── */
      { type: 'rect', x: 18, y: 1, w: 3, h: 2, rotation: 0 },    // 基座 → 左展廊台阶
      { type: 'rect', x: 13, y: 3, w: 18, h: 2, rotation: 0 },   // 左下展廊
      { type: 'rect', x: 11, y: 6, w: 3, h: 2, rotation: 0 },    // 台阶 → 井梯
      { type: 'rect', x: 28, y: 5, w: 3, h: 2, rotation: 0 },    // 渡车 M2 踏板
      { type: 'rect', x: 46, y: 1, w: 3, h: 2, rotation: 0 },    // 柱列基座
      { type: 'rect', x: 64, y: 1, w: 3, h: 2, rotation: 0 },
      { type: 'rect', x: 79, y: 1, w: 3, h: 2, rotation: 0 },
      { type: 'rect', x: 46, y: 3, w: 36, h: 2, rotation: 0 },   // 中央长平台
      { type: 'rect', x: 46, y: 5, w: 3, h: 2, rotation: 0 },    // 柱头
      { type: 'rect', x: 64, y: 5, w: 3, h: 2, rotation: 0 },
      { type: 'rect', x: 79, y: 5, w: 3, h: 2, rotation: 0 },
      { type: 'rect', x: 103, y: 3, w: 19, h: 2, rotation: 0 },  // 右下展廊（尖刺守宝）

      /* ── L1 下层展廊 ── */
      { type: 'rect', x: 64, y: 9, w: 3, h: 2, rotation: 0 },    // 浮空灯柱
      { type: 'rect', x: 79, y: 9, w: 3, h: 2, rotation: 0 },
      { type: 'rect', x: 4, y: 7, w: 6, h: 4, rotation: 0 },     // 井梯大块（顶 11）
      { type: 'rect', x: 4, y: 11, w: 9, h: 2, rotation: 0 },    // 井梯（顶 13）
      { type: 'rect', x: 16, y: 11, w: 3, h: 2, rotation: 0 },
      { type: 'rect', x: 22, y: 11, w: 3, h: 2, rotation: 0 },
      { type: 'rect', x: 28, y: 9, w: 3, h: 4, rotation: 0 },    // 中央块（顶 13）
      { type: 'rect', x: 34, y: 11, w: 3, h: 2, rotation: 0 },
      { type: 'rect', x: 40, y: 11, w: 3, h: 2, rotation: 0 },
      { type: 'rect', x: 46, y: 9, w: 3, h: 4, rotation: 0 },
      { type: 'rect', x: 79, y: 11, w: 9, h: 2, rotation: 0 },   // 右展廊
      { type: 'rect', x: 97, y: 11, w: 9, h: 2, rotation: 0 },
      { type: 'rect', x: 106, y: 11, w: 4, h: 2, rotation: 0 },  // 弹簧着陆台
      { type: 'rect', x: 118, y: 11, w: 4, h: 2, rotation: 0 },  // 坠入式凹龛
      { type: 'rect', x: 4, y: 14, w: 6, h: 2, rotation: 0 },    // 井梯（顶 16）

      /* ── L2 中央大厅（出生枢纽，顶 19）── */
      { type: 'rect', x: 4, y: 17, w: 21, h: 2, rotation: 0 },   // 厅底·左
      { type: 'rect', x: 28, y: 17, w: 27, h: 2, rotation: 0 },  // 厅底·中（缺口 25-28/55-58 通下层）
      { type: 'rect', x: 58, y: 17, w: 33, h: 2, rotation: 0 },  // 厅底·中右
      { type: 'rect', x: 94, y: 17, w: 15, h: 2, rotation: 0 },  // 厅底·右
      { type: 'rect', x: 115, y: 17, w: 7, h: 2, rotation: 0 },  // 断层东岸（钩锁渡点）
      { type: 'rect', x: 4, y: 19, w: 9, h: 2, rotation: 0 },    // 地窖台 1（顶 21）
      { type: 'rect', x: 16, y: 19, w: 9, h: 2, rotation: 0 },   // 地窖台 2
      { type: 'rect', x: 28, y: 19, w: 6, h: 2, rotation: 0 },   // 地窖台 3
      { type: 'rect', x: 40, y: 19, w: 9, h: 2, rotation: 0 },   // 地窖台 4
      { type: 'rect', x: 79, y: 19, w: 3, h: 2, rotation: 0 },   // 厅右台阶
      { type: 'rect', x: 4, y: 21, w: 3, h: 2, rotation: 0 },    // 井梯顶阶（顶 23）
      { type: 'rect', x: 43, y: 19, w: 6, h: 4, rotation: 0 },   // 大厅石柱（顶 23，双跳所在）

      /* ── L3 上层回廊 ── */
      { type: 'rect', x: 94, y: 23, w: 15, h: 2, rotation: 0 },  // 右展台（顶 25）
      { type: 'rect', x: 115, y: 23, w: 7, h: 2, rotation: 0 },  // 高塔中层（顶 25）
      { type: 'rect', x: 46, y: 29, w: 3, h: 2, rotation: 0 },   // 支撑柱
      { type: 'rect', x: 64, y: 29, w: 3, h: 2, rotation: 0 },   // 弹簧 S4 着陆柱（顶 31）
      { type: 'rect', x: 103, y: 29, w: 6, h: 2, rotation: 0 },  // 激光宝珠房（顶 31）
      { type: 'rect', x: 115, y: 29, w: 7, h: 2, rotation: 0 },  // 高塔顶（顶 31，弹簧直达 NOVA 台）
      { type: 'rect', x: 4, y: 31, w: 3, h: 2, rotation: 0 },    // 井顶平台（顶 33，电梯换层）
      { type: 'rect', x: 46, y: 31, w: 6, h: 2, rotation: 0 },   // 上层回廊 A（顶 33）
      { type: 'rect', x: 55, y: 31, w: 15, h: 2, rotation: 0 },  // 上层回廊 B（激光缺口 70-76）
      { type: 'rect', x: 76, y: 31, w: 15, h: 2, rotation: 0 },  // 上层回廊 C
      { type: 'rect', x: 94, y: 31, w: 9, h: 2, rotation: 0 },   // 上层回廊 D
      { type: 'rect', x: 88, y: 33, w: 3, h: 2, rotation: 0 },   // 石檐（顶 35，备用双跳）

      /* ── L4 顶层圣所 ── */
      { type: 'rect', x: 4, y: 35, w: 110, h: 2, rotation: 0 },  // 顶层走廊（顶 37，净空 2）
      { type: 'rect', x: 114, y: 35, w: 8, h: 2, rotation: 0 },  // NOVA 高台（顶 37，与走廊同面）
    ],

    objects: [
      /* —— 尖刺（地面带 ×2 + 守宝 ×1）—— */
      { type: 'spike', x: 30, y: 1 }, { type: 'spike', x: 31, y: 1 },
      { type: 'spike', x: 32, y: 1 }, { type: 'spike', x: 33, y: 1 },
      { type: 'spike', x: 40, y: 1 }, { type: 'spike', x: 41, y: 1 },
      { type: 'spike', x: 42, y: 1 }, { type: 'spike', x: 43, y: 1 }, { type: 'spike', x: 44, y: 1 },
      { type: 'spike', x: 114, y: 5 }, { type: 'spike', x: 115, y: 5 },

      /* —— 装饰方块 —— */
      { type: 'deco', x: 9, y: 3.5, size: 1.0, rotSpeed: 0.5 },
      { type: 'deco', x: 33, y: 7, size: 0.9, rotSpeed: -0.4 },
      { type: 'deco', x: 52, y: 2.5, size: 1.1, rotSpeed: 0.4 },
      { type: 'deco', x: 76, y: 7, size: 1.0, rotSpeed: -0.6 },
      { type: 'deco', x: 95, y: 2.2, size: 0.9, rotSpeed: 0.5 },
      { type: 'deco', x: 114, y: 7.5, size: 1.1, rotSpeed: -0.3 },
      { type: 'deco', x: 21, y: 16, size: 0.8, rotSpeed: 0.6 },
      { type: 'deco', x: 63, y: 16, size: 1.0, rotSpeed: -0.5 },
      { type: 'deco', x: 86, y: 16, size: 1.1, rotSpeed: 0.4 },
      { type: 'deco', x: 37, y: 27, size: 0.9, rotSpeed: -0.5 },
      { type: 'deco', x: 59, y: 26.5, size: 1.1, rotSpeed: 0.3 },
      { type: 'deco', x: 30, y: 34.5, size: 1.0, rotSpeed: 0.4 },
      { type: 'deco', x: 90, y: 34.8, size: 0.8, rotSpeed: -0.6 },

      /* —— 提示文字 —— */
      { type: 'hint', x: 58.5, y: 21.5, text: '玩家起点 · 中央大厅' },
      { type: 'hint', x: 2.5, y: 20, text: '电梯井 · 贯穿全图' },
      { type: 'hint', x: 45, y: 26.5, text: '石柱之巅 · 双跳试炼' },
      { type: 'hint', x: 97, y: 22, text: '西侧断层 · 钩锁可渡' },
      { type: 'hint', x: 31.5, y: 3.5, text: '前方尖刺回廊' },
      { type: 'hint', x: 42.5, y: 3.5, text: '尖刺密布 · 持盾再入' },
      { type: 'hint', x: 20, y: 8, text: '下层展廊' },
      { type: 'hint', x: 110, y: 7, text: '右侧展廊' },
      { type: 'hint', x: 60, y: 34.7, text: '上层回廊' },
      { type: 'hint', x: 95, y: 38.6, text: '顶层圣所 · 终点在前' },

      /* —— 移动平台（M1 电梯贯穿竖井 / M2·M5 展廊渡车 / M3 断层渡车 / M4 高塔渡车）—— */
      { type: 'mover', x0: 1.5, y: 1.5, w: 2.4, h: 0.8, range: 0, spd: 1.2, ph: 0, axis: 'y', yRange: 33.7 },
      { type: 'mover', x0: 33, y: 9, w: 3, h: 0.8, range: 9, spd: 0.8, ph: 0 },
      { type: 'mover', x0: 109.5, y: 18.4, w: 3, h: 0.8, range: 5, spd: 1, ph: 1.2 },
      { type: 'mover', x0: 104, y: 26, w: 3, h: 0.8, range: 10, spd: 0.9, ph: 2 },
      { type: 'mover', x0: 82, y: 8.5, w: 3, h: 0.8, range: 10, spd: 0.85, ph: 0.5 },

      /* —— 弹簧跳板（发射路径均已验证不穿模）—— */
      { type: 'springPad', x: 1.3, y: 1.2, w: 2.5, h: 2, force: { x: 0, y: 96 }, duration: 0.3 },    // 竖井助推
      { type: 'springPad', x: 66.5, y: 19.2, w: 2.5, h: 2, force: { x: 0, y: 96 }, duration: 0.3 },  // 大厅 → 上层回廊
      { type: 'springPad', x: 110.5, y: 5.2, w: 2.5, h: 2, force: { x: 0, y: 96 }, duration: 0.3 },  // 右展廊 → 着陆台
      { type: 'springPad', x: 117.5, y: 31.2, w: 2.5, h: 2, force: { x: 0, y: 96 }, duration: 0.3 }, // 高塔 → NOVA 台

      /* —— 激光栅栏（回廊缺口 ×1 / 宝珠房 ×2 / 顶层走廊门 ×2）—— */
      { type: 'laser', x: 73, y0: 33.2, len: 3.5, ph: 0.6 },
      { type: 'laser', x: 104.5, y0: 31.2, len: 3.6, ph: 0.9 },
      { type: 'laser', x: 107.5, y0: 31.2, len: 3.6, ph: 2.3 },
      { type: 'laser', x: 100, y0: 37.2, len: 1.6, ph: 0.3 },
      { type: 'laser', x: 104, y0: 37.2, len: 1.6, ph: 1.7 },

      /* —— 检查点（10 处枢纽）—— */
      { type: 'checkpoint', x: 60, y: 19.5 },     // 出生厅
      { type: 'checkpoint', x: 96, y: 19.5 },     // 断层前
      { type: 'checkpoint', x: 52, y: 1.5 },      // 地面回廊
      { type: 'checkpoint', x: 8, y: 13.5 },      // 下层左展廊
      { type: 'checkpoint', x: 99, y: 13.5 },     // 下层右展廊
      { type: 'checkpoint', x: 5.5, y: 33.5 },    // 井顶平台（电梯换层）
      { type: 'checkpoint', x: 60, y: 33.5 },     // 上层回廊
      { type: 'checkpoint', x: 99, y: 33.5 },     // 激光房前
      { type: 'checkpoint', x: 116.3, y: 31.5 },  // 高塔顶
      { type: 'checkpoint', x: 30, y: 37.5 },     // 顶层走廊

      /* —— 双跳增益（早期核心 + 备用）—— */
      { type: 'jumpBoost', x: 44, y: 23.8 },      // 大厅石柱顶
      { type: 'jumpBoost', x: 89, y: 35.8 },      // 上层石檐

      /* —— 钩锁道具（厅右渡断层 / 电梯途中拾取）—— */
      { type: 'hookPickup', x: 97, y: 20 },
      { type: 'hookPickup', x: 2.2, y: 30 },

      /* —— 护盾道具（尖刺区 / 激光房 / 顶层激光门前）—— */
      { type: 'shieldPickup', x: 20, y: 22 },
      { type: 'shieldPickup', x: 95.5, y: 34.2 },
      { type: 'shieldPickup', x: 86, y: 38.2 },

      /* —— 光球（沿主动线铺设 + 竖井奖励列 + 守宝区高难）—— */
      { type: 'orb', x: 8, y: 2.5 }, { type: 'orb', x: 26, y: 2.5 }, { type: 'orb', x: 48, y: 2.5 },
      { type: 'orb', x: 60, y: 2.5 }, { type: 'orb', x: 76, y: 2.5 }, { type: 'orb', x: 90, y: 2.5 },
      { type: 'orb', x: 42, y: 3.5 },                                  // 尖刺带上方（持盾/精准跳）
      { type: 'orb', x: 19.5, y: 4.5 }, { type: 'orb', x: 65.5, y: 4.5 },
      { type: 'orb', x: 50, y: 6.5 }, { type: 'orb', x: 62, y: 6.5 }, { type: 'orb', x: 70, y: 6.5 }, { type: 'orb', x: 74, y: 6.5 },
      { type: 'orb', x: 15, y: 6.5 }, { type: 'orb', x: 20, y: 6.5 }, { type: 'orb', x: 25, y: 6.5 },
      { type: 'orb', x: 29.5, y: 8.5 },
      { type: 'orb', x: 104, y: 6.5 }, { type: 'orb', x: 108, y: 6.5 }, { type: 'orb', x: 117, y: 6.5 }, { type: 'orb', x: 119.5, y: 6.5 },
      { type: 'orb', x: 65.5, y: 12.5 }, { type: 'orb', x: 80.5, y: 12.5 },
      { type: 'orb', x: 17.5, y: 14.5 }, { type: 'orb', x: 23.5, y: 14.5 }, { type: 'orb', x: 29.5, y: 14.5 },
      { type: 'orb', x: 41.5, y: 14.5 }, { type: 'orb', x: 47.5, y: 14.5 }, { type: 'orb', x: 84, y: 14.5 },
      { type: 'orb', x: 100, y: 14.5 }, { type: 'orb', x: 103, y: 14.5 }, { type: 'orb', x: 108, y: 14.5 },
      { type: 'orb', x: 119.5, y: 14.5 },                              // 坠入式凹龛
      { type: 'orb', x: 2.2, y: 6 }, { type: 'orb', x: 2.2, y: 12 }, { type: 'orb', x: 2.2, y: 18 },
      { type: 'orb', x: 2.2, y: 24 }, { type: 'orb', x: 2.2, y: 30 },  // 竖井奖励列（乘电梯收割）
      { type: 'orb', x: 6, y: 22.5 }, { type: 'orb', x: 22, y: 22.5 }, { type: 'orb', x: 30.5, y: 22.5 },
      { type: 'orb', x: 42, y: 22.5 }, { type: 'orb', x: 46, y: 22.5 },
      { type: 'orb', x: 46.5, y: 24.5 },                               // 石柱顶
      { type: 'orb', x: 52, y: 20.5 }, { type: 'orb', x: 62, y: 20.5 }, { type: 'orb', x: 70, y: 20.5 },
      { type: 'orb', x: 78, y: 20.5 }, { type: 'orb', x: 86, y: 20.5 },
      { type: 'orb', x: 80.5, y: 22.5 },
      { type: 'orb', x: 117, y: 20.5 }, { type: 'orb', x: 120, y: 20.5 },
      { type: 'orb', x: 96, y: 26.5 }, { type: 'orb', x: 104, y: 26.5 }, { type: 'orb', x: 107, y: 26.5 }, { type: 'orb', x: 118.5, y: 26.5 },
      { type: 'orb', x: 5.5, y: 34.5 }, { type: 'orb', x: 48, y: 34.5 }, { type: 'orb', x: 57, y: 34.5 },
      { type: 'orb', x: 65, y: 34.5 }, { type: 'orb', x: 68.5, y: 34.5 }, { type: 'orb', x: 82, y: 34.5 }, { type: 'orb', x: 101.5, y: 34.5 },
      { type: 'orb', x: 90.5, y: 36.5 },
      { type: 'orb', x: 105, y: 32.5 }, { type: 'orb', x: 108, y: 32.5 }, // 激光房内（计时穿行）
      { type: 'orb', x: 10, y: 38.5 }, { type: 'orb', x: 34, y: 38.5 }, { type: 'orb', x: 46, y: 38.5 },
      { type: 'orb', x: 58, y: 38.5 }, { type: 'orb', x: 70, y: 38.5 }, { type: 'orb', x: 82, y: 38.5 },
      { type: 'orb', x: 110, y: 38.5 }, { type: 'orb', x: 116, y: 38.5 },

      /* —— NOVA 终点（顶层圣所东端高台）—— */
      { type: 'nova', x: 118.5, y: 37.8 },
    ],

    /* 可行走区视觉层：与 geometry 一一镜像，按层分色（青→蓝→紫→品红，呼应 hue2 渐变） */
    floorCells: [
    /* 边界 */
    { x: 0, y: 0, w: 122, h: 1, color: '#5a64b8' }, { x: 0, y: 39, w: 122, h: 1, color: '#5a64b8' },
    { x: 0, y: 1, w: 1, h: 38, color: '#5a64b8' }, { x: 121, y: 1, w: 1, h: 38, color: '#5a64b8' },
    /* L0 地面回廊 */
    { x: 18, y: 1, w: 3, h: 2, color: '#4cc8d8' }, { x: 13, y: 3, w: 18, h: 2, color: '#4cc8d8' },
    { x: 11, y: 6, w: 3, h: 2, color: '#4cc8d8' }, { x: 28, y: 5, w: 3, h: 2, color: '#4cc8d8' },
    { x: 46, y: 1, w: 3, h: 2, color: '#4cc8d8' }, { x: 64, y: 1, w: 3, h: 2, color: '#4cc8d8' },
    { x: 79, y: 1, w: 3, h: 2, color: '#4cc8d8' }, { x: 46, y: 3, w: 36, h: 2, color: '#4cc8d8' },
    { x: 46, y: 5, w: 3, h: 2, color: '#4cc8d8' }, { x: 64, y: 5, w: 3, h: 2, color: '#4cc8d8' },
    { x: 79, y: 5, w: 3, h: 2, color: '#4cc8d8' }, { x: 103, y: 3, w: 19, h: 2, color: '#4cc8d8' },
    /* L1 下层展廊 */
    { x: 64, y: 9, w: 3, h: 2, color: '#5fa3e6' }, { x: 79, y: 9, w: 3, h: 2, color: '#5fa3e6' },
    { x: 4, y: 7, w: 6, h: 4, color: '#5fa3e6' }, { x: 4, y: 11, w: 9, h: 2, color: '#5fa3e6' },
    { x: 16, y: 11, w: 3, h: 2, color: '#5fa3e6' }, { x: 22, y: 11, w: 3, h: 2, color: '#5fa3e6' },
    { x: 28, y: 9, w: 3, h: 4, color: '#5fa3e6' }, { x: 34, y: 11, w: 3, h: 2, color: '#5fa3e6' },
    { x: 40, y: 11, w: 3, h: 2, color: '#5fa3e6' }, { x: 46, y: 9, w: 3, h: 4, color: '#5fa3e6' },
    { x: 79, y: 11, w: 9, h: 2, color: '#5fa3e6' }, { x: 97, y: 11, w: 9, h: 2, color: '#5fa3e6' },
    { x: 106, y: 11, w: 4, h: 2, color: '#5fa3e6' }, { x: 118, y: 11, w: 4, h: 2, color: '#5fa3e6' },
    { x: 4, y: 14, w: 6, h: 2, color: '#5fa3e6' },
    /* L2 中央大厅 */
    { x: 4, y: 17, w: 21, h: 2, color: '#8a8af0' }, { x: 28, y: 17, w: 27, h: 2, color: '#8a8af0' },
    { x: 58, y: 17, w: 33, h: 2, color: '#8a8af0' }, { x: 94, y: 17, w: 15, h: 2, color: '#8a8af0' },
    { x: 115, y: 17, w: 7, h: 2, color: '#8a8af0' }, { x: 4, y: 19, w: 9, h: 2, color: '#8a8af0' },
    { x: 16, y: 19, w: 9, h: 2, color: '#8a8af0' }, { x: 28, y: 19, w: 6, h: 2, color: '#8a8af0' },
    { x: 40, y: 19, w: 9, h: 2, color: '#8a8af0' }, { x: 79, y: 19, w: 3, h: 2, color: '#8a8af0' },
    { x: 4, y: 21, w: 3, h: 2, color: '#8a8af0' }, { x: 43, y: 19, w: 6, h: 4, color: '#8a8af0' },
    /* L3 上层回廊 */
    { x: 94, y: 23, w: 15, h: 2, color: '#b47cea' }, { x: 115, y: 23, w: 7, h: 2, color: '#b47cea' },
    { x: 46, y: 29, w: 3, h: 2, color: '#b47cea' }, { x: 64, y: 29, w: 3, h: 2, color: '#b47cea' },
    { x: 103, y: 29, w: 6, h: 2, color: '#b47cea' }, { x: 115, y: 29, w: 7, h: 2, color: '#b47cea' },
    { x: 4, y: 31, w: 3, h: 2, color: '#b47cea' }, { x: 46, y: 31, w: 6, h: 2, color: '#b47cea' },
    { x: 55, y: 31, w: 15, h: 2, color: '#b47cea' }, { x: 76, y: 31, w: 15, h: 2, color: '#b47cea' },
    { x: 94, y: 31, w: 9, h: 2, color: '#b47cea' }, { x: 88, y: 33, w: 3, h: 2, color: '#b47cea' },
    /* L4 顶层圣所 */
    { x: 4, y: 35, w: 110, h: 2, color: '#e17ce0' }, { x: 114, y: 35, w: 8, h: 2, color: '#e17ce0' },
    ],
    gridSize: 1,
  },
};

/** 2D地图设计 · 底图 —— 模板定义 */
export const TWO_D_MAP_TEMPLATE: MapTemplate = {
  id: '2d-map-design',
  name: '2D地图设计 · 底图',
  icon: 'Map',
  desc: '恶魔城式五层结构（地面回廊→下层展廊→中央大厅枢纽→上层回廊→顶层圣所），电梯井贯穿全图；双跳/钩锁/护盾按进度门控分布，双路线登顶 NOVA。',
  create: () => JSON.parse(JSON.stringify(TWO_D_MAP_DATA)) as MapData,
};
