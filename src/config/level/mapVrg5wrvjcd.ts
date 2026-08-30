/**
 * 地图三 · 未命名地图（33×24，编辑器 JSON v2 转录）
 * 来源：工具/map_vrg5wrvjcd.json（SceneEditor 标准导出）
 * 49 矩形几何 + 2 弹簧 + 2 尖刺 + 1 激光 + 1 双跳 + 1 钩锁 + MVMap 底盘。
 * 原文件无 nova/orb/checkpoint 对象；NOVA 依惯例补在地图最高点
 * （左上角王冠平台 (0,23,1,1) 之上 2 格），其余内容 1:1 忠实转录。
 */
import type { Rect, MapDefinition } from '../../types';

const R = (x: number, y: number, w: number, h: number, hookable = true): Rect => ({ x, y, w, h, top: y + h, hookable });

export const mapVrg5wrvjcd: MapDefinition = {
  id: 'map_vrg5wrvjcd',
  name: '未命名地图',
  width: 33,
  height: 24,
  playerSpawn: { x: 12.925218014224217, y: 9.186093070700803 },

  // ── 静态几何（非 ECS，49 矩形，全部 rotation=0）──
  solids: [
    // 下部平台区
    R(20, 0, 7, 1), R(18, 1, 3, 1), R(27, 1, 4, 1),
    R(17, 2, 2, 1), R(30, 2, 2, 1), R(31, 3, 2, 1), R(17, 3, 1, 2),
    R(4, 5, 1, 1), R(4, 6, 16, 1), R(32, 4, 1, 3),
    // 中部右侧阶梯
    R(19, 7, 1, 1), R(31, 7, 1, 1), R(29, 8, 3, 1),
    R(19, 8, 3, 2), R(27, 9, 3, 1),
    // 中部右侧攀升
    R(19, 10, 1, 1), R(19, 11, 2, 1), R(20, 12, 2, 1), R(21, 13, 1, 1),
    R(28, 13, 1, 1), R(28, 14, 2, 1),
    // 左侧立柱与横向平台行
    R(4, 7, 1, 9), R(7, 15, 1, 1), R(27, 15, 3, 1),
    R(6, 16, 2, 1), R(10, 16, 6, 1), R(17, 16, 3, 1), R(21, 16, 2, 1), R(24, 16, 6, 1),
    // 上部平台层
    R(5, 17, 2, 1), R(10, 17, 1, 1), R(27, 17, 3, 1),
    R(11, 18, 1, 1), R(20, 18, 3, 1), R(24, 18, 2, 1), R(27, 18, 1, 1), R(5, 18, 1, 2),
    R(12, 19, 1, 1), R(18, 19, 2, 1), R(26, 19, 2, 1),
    R(3, 20, 2, 1), R(13, 20, 2, 1), R(17, 20, 3, 1), R(25, 20, 2, 1),
    // 顶部（通向王冠）
    R(2, 21, 2, 1), R(14, 21, 5, 1), R(20, 21, 6, 1),
    R(0, 22, 2, 1), R(0, 23, 1, 1),
  ],

  spikes: [
    { x: 8.5, y: 7 }, { x: 7.5, y: 7 },
  ],

  decos: [],

  // 主题配色：青林（绿青，与平台树结构的自然感呼应）
  theme: {
    hueA: 150,
    hueB: 215,
    grid: '110,210,160',
    border: '130,225,180',
    fog: '40,105,95',
    accent: '175,255,205',
    far: ['80,200,150', '110,170,225'],
    mid: ['130,215,170', '150,195,235'],
  },

  hints: [],

  // ── MVMap 底盘视觉层（与几何逐块对应的区域色格线地板）──
  floor: {
    gridSize: 1,
    cells: [
      { x: 20, y: 0, w: 7, h: 1, color: '#4c8dd8' },
      { x: 18, y: 1, w: 3, h: 1, color: '#4c8dd8' },
      { x: 27, y: 1, w: 4, h: 1, color: '#4c8dd8' },
      { x: 17, y: 2, w: 2, h: 1, color: '#4c8dd8' },
      { x: 30, y: 2, w: 2, h: 1, color: '#4c8dd8' },
      { x: 31, y: 3, w: 2, h: 1, color: '#4c8dd8' },
      { x: 17, y: 3, w: 1, h: 2, color: '#4c8dd8' },
      { x: 4, y: 5, w: 1, h: 1, color: '#4c8dd8' },
      { x: 4, y: 6, w: 16, h: 1, color: '#4c8dd8' },
      { x: 32, y: 4, w: 1, h: 3, color: '#4c8dd8' },
      { x: 19, y: 7, w: 1, h: 1, color: '#4c8dd8' },
      { x: 31, y: 7, w: 1, h: 1, color: '#4c8dd8' },
      { x: 29, y: 8, w: 3, h: 1, color: '#4c8dd8' },
      { x: 19, y: 8, w: 3, h: 2, color: '#4c8dd8' },
      { x: 27, y: 9, w: 3, h: 1, color: '#4c8dd8' },
      { x: 19, y: 10, w: 1, h: 1, color: '#4c8dd8' },
      { x: 19, y: 11, w: 2, h: 1, color: '#4c8dd8' },
      { x: 20, y: 12, w: 2, h: 1, color: '#4c8dd8' },
      { x: 21, y: 13, w: 1, h: 1, color: '#4c8dd8' },
      { x: 28, y: 13, w: 1, h: 1, color: '#4c8dd8' },
      { x: 28, y: 14, w: 2, h: 1, color: '#4c8dd8' },
      { x: 4, y: 7, w: 1, h: 9, color: '#4c8dd8' },
      { x: 7, y: 15, w: 1, h: 1, color: '#4c8dd8' },
      { x: 27, y: 15, w: 3, h: 1, color: '#4c8dd8' },
      { x: 6, y: 16, w: 2, h: 1, color: '#4c8dd8' },
      { x: 10, y: 16, w: 6, h: 1, color: '#4c8dd8' },
      { x: 17, y: 16, w: 3, h: 1, color: '#4c8dd8' },
      { x: 21, y: 16, w: 2, h: 1, color: '#4c8dd8' },
      { x: 24, y: 16, w: 6, h: 1, color: '#4c8dd8' },
      { x: 5, y: 17, w: 2, h: 1, color: '#4c8dd8' },
      { x: 10, y: 17, w: 1, h: 1, color: '#4c8dd8' },
      { x: 27, y: 17, w: 3, h: 1, color: '#4c8dd8' },
      { x: 11, y: 18, w: 1, h: 1, color: '#4c8dd8' },
      { x: 20, y: 18, w: 3, h: 1, color: '#4c8dd8' },
      { x: 24, y: 18, w: 2, h: 1, color: '#4c8dd8' },
      { x: 27, y: 18, w: 1, h: 1, color: '#4c8dd8' },
      { x: 5, y: 18, w: 1, h: 2, color: '#4c8dd8' },
      { x: 12, y: 19, w: 1, h: 1, color: '#4c8dd8' },
      { x: 18, y: 19, w: 2, h: 1, color: '#4c8dd8' },
      { x: 26, y: 19, w: 2, h: 1, color: '#4c8dd8' },
      { x: 3, y: 20, w: 2, h: 1, color: '#4c8dd8' },
      { x: 13, y: 20, w: 2, h: 1, color: '#4c8dd8' },
      { x: 17, y: 20, w: 3, h: 1, color: '#4c8dd8' },
      { x: 25, y: 20, w: 2, h: 1, color: '#4c8dd8' },
      { x: 2, y: 21, w: 2, h: 1, color: '#4c8dd8' },
      { x: 14, y: 21, w: 5, h: 1, color: '#4c8dd8' },
      { x: 20, y: 21, w: 6, h: 1, color: '#4c8dd8' },
      { x: 0, y: 22, w: 2, h: 1, color: '#4c8dd8' },
      { x: 0, y: 23, w: 1, h: 1, color: '#4c8dd8' },
    ],
  },

  // ── 实体生成描述（ECS 工厂）──
  entitySpawners: {
    movers: [],
    springPads: [
      // 右下平台垂直弹射
      { x: 22.5, y: 1, w: 2.5, h: 2, force: { x: 0, y: 96 }, duration: 0.3 },
      // 中部左侧水平弹射（朝右越过间隙）
      { x: 11.992775287964905, y: 13.379740415562583, w: 2, h: 2.5, force: { x: 96, y: 10 }, duration: 0.3 },
    ],
    lasers: [
      // 上部 x=17.5 垂直激光栅栏（y0 起向上 len=6）
      { x: 17.5, y0: 17.5, len: 6, ph: 0 },
    ],
    orbs: [],
    jumpBoosts: [
      [17, 9],
    ],
    // 钩锁道具
    hooks: [
      [15.5, 8.5],
    ],
    checkpoints: [],
    nova: { x: 0.5, y: 26 },
  },
};
