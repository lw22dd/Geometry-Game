/**
 * 关卡布局注册表 —— 多地图描述符。
 * 每张地图 = 静态几何（solids/spikes/decos/hints）+ 实体生成描述（movers/lasers/orbs/checkpoints/nova）。
 * 只依赖 types（及 physics 的 MAP 常量）。
 */
import type { Rect, Spike, MapDefinition } from '../types';
import { createOrb } from '../Prefabs/Scenes/orbEntity';
import { createJumpBoost } from '../Prefabs/Scenes/jumpBoostEntity';
import { createCheckpoint } from '../Prefabs/Scenes/checkpointEntity';
import { createNova } from '../Prefabs/Scenes/novaEntity';
import { createMovingPlatform } from '../Prefabs/Scenes/movingPlatformEntity';
import { createSpringPad } from '../Prefabs/Scenes/springPadEntity';
import { createLaser } from '../Prefabs/Scenes/laserEntity';
import { createSpike } from '../Prefabs/Scenes/spikeEntity';
import { initPlayerEntity } from '../Prefabs/Player/playerEntity';
import { createLoopTrack } from '../Prefabs/Scenes/loopTrackEntity';

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
      // 三 · 冲刺走廊（原尖刺谷 → 半环轨道）
      R(92, 0, 38, 4),
      R(93, 11.6, 3.5, 0.8), R(99, 11.2, 3, 0.8), R(104.5, 11.6, 3, 0.8), R(109, 12, 3, 0.8),
      R(113.5, 11.4, 3.5, 0.8), R(118, 12, 6, 1),
      // 三·b · 半环出口衔接台（捕捉 / 阶梯 / 通往高空走廊）
      R(124, 5.0, 6, 0.8), R(121, 7.2, 6, 0.8), R(117, 9.6, 6, 0.8),
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
      // 原 x=94~124 地刺已删除（90~130 区域改为冲刺半环轨道）
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
      [125, 10.5, '⚡ SHIFT 冲刺进环'],
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
        // 电梯平台（八·终章前后，垂直升降）
        { x0: 200, y: 27, w: 3, h: 0.8, range: 0, spd: 0.7, ph: 0, axis: 'y', yRange: 5 },
        { x0: 222, y: 26.5, w: 3, h: 0.8, range: 0, spd: 0.9, ph: 1.2, axis: 'y', yRange: 6 },
      ],
      // 弹簧平台（弹射台）
      springPads: [
        // 阶梯塔入口前：垂直弹跳过深谷
        { x: 61.5, y: 4, w: 2.5, h: 0.8, forceX: 0, forceY: 28, duration: 0.3 },
        // 尖刺谷地面：垂直弹射进入高空走廊
        { x: 100, y: 4, w: 2.5, h: 0.8, forceX: 0, forceY: 28, duration: 0.3 },
        // 攀升塔中段：帮助向上攀爬
        { x: 133.5, y: 24, w: 2.2, h: 0.7, forceX: 0, forceY: 110, duration: 0.3 },
        // 终章登顶台：NOVA 前最后弹射
        { x: 233, y: 44.2, w: 2.2, h: 0.8, forceX: 0, forceY: 105, duration: 0.3 },
        // 阶梯塔墙壁弹簧：从第二阶梯右壁弹向第三阶梯（横向放置）
        { x: 47, y: 6, w: 2, h: 2.5, forceX: 20, forceY: 28, duration: 0.3 },
        // 攀升塔墙壁弹簧：左右平台之间横向弹射跨越
        { x: 129.5, y: 15, w: 0.5, h: 2, forceX: 20, forceY: 18, duration: 0.3 },
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
      // 双跳光球（拾取后永久二段跳）
      jumpBoosts: [
        [10, 7.6],
        [96, 16.8],
        [215, 35.6],
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
  for (const sp of s.springPads) createSpringPad(sp);
  for (const l of s.lasers) createLaser(l);
  for (let i = 0; i < s.orbs.length; i++) {
    createOrb(s.orbs[i][0], s.orbs[i][1], i * 1.7);
  }
  for (const [x, y] of s.jumpBoosts) {
    createJumpBoost(x, y, 0);
  }
  for (const [x, y] of s.checkpoints) {
    createCheckpoint(x, y);
  }
  createNova(s.nova.x, s.nova.y);
  // 尖刺（静态几何 → ECS 实体）
  for (const sp of currentMap.spikes) {
    createSpike(sp.x, sp.y);
  }
  // 冲刺半环轨道（三章：走廊 → 半环翻越 → 衔接台）
  // 圆弧段：圆心 (130, 5.42) 半径 1.0，底部 (-π/2) → 顶部 (+π/2)，逆时针
  createLoopTrack(
    [{ type: 'arc', cx: 130, cy: 5.42, radius: 1.0, startAngle: -Math.PI / 2, endAngle: Math.PI / 2, dir: 1 }],
    0,
    Math.PI * 1.0,
    7,
  );
}