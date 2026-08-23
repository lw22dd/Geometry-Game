/**
 * 关卡布局注册表 —— 多地图描述符。
 * 每张地图 = 静态几何（solids/spikes/decos/hints）+ 实体生成描述（movers/lasers/orbs/checkpoints/nova）。
 * 只依赖 types（及 physics 的 MAP 常量）。
 */
import type { Rect, Spike, MapDefinition } from '../types';
import { createOrb } from '../Prefabs/Entities/orb';
import { createCheckpoint } from '../Prefabs/Entities/checkpoint';
import { createNova } from '../Prefabs/Entities/nova';
import { createMovingPlatform } from '../Prefabs/Entities/movingPlatform';
import { createLaser } from '../Prefabs/Entities/laser';
import { createSpike } from '../Prefabs/Entities/spike';
import { initPlayerEntity } from '../Prefabs/Entities/playerEntity';

const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h, top: y + h });

/** 地图注册表 */
export const maps: MapDefinition[] = [
  {
    id: 'neon-ascent',
    name: '霓虹攀升',
    width: 240,
    height: 72,
    playerSpawn: { x: 6, y: 4 },

    // ── 静态几何（非 ECS）──
    solids: [
      // 一 · 霓虹平原
      R(0, 0, 58, 4), R(38, 4, 4, 1.2),
      R(59.5, 5.2, 3, 0.8),
      // 二 · 阶梯塔
      R(64, 0, 24, 4),
      R(68, 4, 3.5, 2), R(73, 4, 3.5, 4), R(78, 4, 3.5, 6.5), R(83, 4, 4, 8), R(87, 11.2, 5, 0.8),
      // 三 · 尖刺谷高空走廊
      R(92, 0, 34, 4),
      R(93, 11.6, 3.5, 0.8), R(99, 11.2, 3, 0.8), R(104.5, 11.6, 3, 0.8), R(109, 12, 3, 0.8),
      R(113.5, 11.4, 3.5, 0.8), R(118, 12, 6, 1),
      // 四 · 攀升塔
      R(126, 14.6, 2.5, 0.7), R(131, 16.8, 2.5, 0.7), R(126, 19, 2.5, 0.7), R(131, 21.2, 2.5, 0.7),
      R(126, 23.4, 2.5, 0.7), R(131, 25.6, 2.5, 0.7), R(126, 27.8, 2.5, 0.7), R(131, 29.4, 12, 1),
      // 五/六 · 移动平台 + 激光走廊
      R(166, 28.8, 40, 1),
      // 七 · 冲刺天梯
      R(214, 29.2, 3, 0.8), R(224, 30.6, 3, 0.8), R(234, 32, 3, 0.8), R(228, 34.2, 3, 0.8), R(234, 36.4, 4, 0.9),
      // 八 · 终章
      R(236, 38.8, 3.5, 0.8), R(231, 41, 3, 0.8), R(232, 43.2, 7, 1),
    ],

    spikes: [
      { x: 24, y: 4 }, { x: 25, y: 4 }, { x: 26, y: 4 },
      ...(() => { const a: Spike[] = []; for (let x = 94; x <= 124; x++) a.push({ x, y: 4 }); return a; })(),
    ],

    decos: [
      [24, 13, 1.1, 0.6], [34, 18, 0.8, -0.9], [60, 22, 0.9, 0.8], [100, 20, 1.2, 0.5],
      [120, 33, 1, -0.7], [150, 36, 1.2, 0.6], [180, 40, 1, -0.5], [210, 42, 1.4, 0.4],
      [228, 50, 0.9, -0.6], [100, 50, 0.8, 0.7],
    ],

    hints: [
      [8, 6.4, '→ 出发'],
      [56, 8.8, '深渊 · 浮岛'],
      [96, 16.5, '尖刺谷 · 高空走廊'],
      [129, 17.5, '攀 升 塔'],
      [147, 33.4, '节奏平台'],
      [188, 38.6, '激光栅栏 · 计时通过'],
      [209, 34, '⚡ SHIFT 冲刺大跳 →'],
      [225, 48.6, '登顶 · NOVA ★'],
    ],

    // ── 实体生成描述（ECS 工厂）──
    entitySpawners: {
      // 移动平台（五/六章节）
      movers: [
        { x0: 145, y: 29.6, w: 3, h: 0.8, range: 4, spd: 0.8, ph: 0 },
        { x0: 157, y: 29.2, w: 3, h: 0.8, range: 4, spd: 0.8, ph: Math.PI },
      ],
      // 激光栅栏（六章节）
      lasers: [
        { x: 181, y0: 29.8, len: 6, ph: 0 },
        { x: 188, y0: 29.8, len: 6, ph: 0.95 },
        { x: 195, y0: 29.8, len: 6, ph: 1.9 },
      ],
      // 光球坐标（42 枚）
      orbs: [
        [12, 5.4], [18, 5.6], [25, 6.2], [40, 6.8], [48, 5.4],
        [61, 7.2], [69.8, 7.4], [74.8, 9.4], [79.8, 11.9], [85, 13.4], [89.5, 13.4],
        [97.8, 14], [103, 13.6], [107.8, 14.2], [111, 14], [115.2, 13.8], [121, 15],
        [127.2, 16.8], [132.2, 19.3], [127.2, 21.5], [132.2, 24], [127.2, 26.1], [132.2, 28.3],
        [137, 32], [142, 31.6],
        [147.5, 31.6], [152, 31.2], [159.5, 31], [169, 31.4],
        [181, 33], [184.5, 31.4], [191.5, 31.4], [198.5, 31.4],
        [211, 33.4], [215.5, 31.6], [225.5, 33], [235.5, 34.6], [229.5, 36.8], [237.7, 40.6],
        [231.5, 43.4], [238.5, 41], [235, 45.6],
      ],
      // 检查点坐标（复活点激活位置）
      checkpoints: [
        [33, 4], [90, 12], [121, 13], [140, 30.4], [173, 29.8], [203, 29.8], [234, 37.3],
      ],
      // NOVA 终点
      nova: { x: 236.5, y: 46.6 },
    },
  },
];

/** 当前地图（切图时通过 loadMap 切换） */
export let currentMap: MapDefinition = maps[0];

/** 当前检查点（复活点），初始为当前地图出生点 */
export const cpPoint = { x: 6, y: 4 };

/** 切换地图（数据层：替换 currentMap 引用；实体重建由调用方处理） */
export function loadMap(id: string): MapDefinition {
  const next = maps.find(m => m.id === id);
  if (!next) throw new Error('Unknown map id: ' + id);
  currentMap = next;
  cpPoint.x = next.playerSpawn.x;
  cpPoint.y = next.playerSpawn.y;
  return next;
}

/**
 * 从当前地图初始化 ECS 实体（组合根，由 main.ts 调用一次）。
 * 创建玩家实体 + 移动平台 + 激光 + 光球 + 检查点 + NOVA 星。
 */
export function initECSFromLevel(): void {
  initPlayerEntity();
  const s = currentMap.entitySpawners;
  for (const m of s.movers) createMovingPlatform(m);
  for (const l of s.lasers) createLaser(l);
  for (let i = 0; i < s.orbs.length; i++) {
    createOrb(s.orbs[i][0], s.orbs[i][1], i * 1.7);
  }
  for (const [x, y] of s.checkpoints) {
    createCheckpoint(x, y);
  }
  createNova(s.nova.x, s.nova.y);
  // 尖刺（静态几何 → ECS 实体）
  for (const sp of currentMap.spikes) {
    createSpike(sp.x, sp.y);
  }
}