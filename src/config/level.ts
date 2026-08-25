/**
 * 关卡布局注册表 —— 多地图描述符。
 * 每张地图 = 静态几何（solids/spikes/decos/hints）+ 实体生成描述（movers/lasers/orbs/checkpoints/nova）。
 * 只依赖 types（及 physics 的 MAP 常量）。
 */
import type { Rect, Spike, MapDefinition } from '../types';
import { VERTICAL_SPRING, HORIZONTAL_SPRING } from './springs';
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
import { createHookPickup } from '../Prefabs/Scenes/hookPickupEntity';
import { world } from '../core/ecs';

const R = (x: number, y: number, w: number, h: number, hookable = true): Rect => ({ x, y, w, h, top: y + h, hookable });

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
      // 三·b · 半环出口衔接台（捕捉 / 阶梯 / 通往高空走廊）[随圆弧右移 +10]
      R(134, 5.0, 6, 0.8), R(131, 7.2, 6, 0.8), R(127, 9.6, 6, 0.8),
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
      [125, 10.5, 'SHIFT 冲刺进环'],
      [129, 17.5, '攀 升 塔'],
      [147, 33.4, '节奏平台'],
      [188, 38.6, '激光栅栏 · 计时通过'],
      [209, 34, 'SHIFT 冲刺大跳 →'],
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
        { x: 61.5, y: 4, w: 2.5, h: 1.2, force: { x: 0, y: 96 }, duration: 0.3 },
        // 尖刺谷地面：垂直弹射进入高空走廊（垂直弹簧默认数值）
        { x: 100, y: 4, ...VERTICAL_SPRING },
        // 攀升塔中段：帮助向上攀爬
        { x: 133.5, y: 24, w: 2.2, h: 0.7, force: { x: 0, y: 110 }, duration: 0.3 },
        // 终章登顶台：NOVA 前最后弹射
        { x: 233, y: 44.2, w: 2.2, h: 0.8, force: { x: 0, y: 105 }, duration: 0.3 },
        // 阶梯塔墙壁弹簧：从第二阶梯右壁弹向第三阶梯（水平弹簧默认数值）
        { x: 47, y: 6, ...HORIZONTAL_SPRING },
        // 攀升塔墙壁弹簧：左右平台之间横向弹射跨越
        { x: 129.5, y: 15, w: 0.5, h: 2, force: { x: 96, y: 10 }, duration: 0.3 },
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
      // 钩锁道具（拾取后进入背包，鼠标瞄准+左键发射滑索）
      hooks: [
        [5.5, 6.8],
        [67, 7.6],
        [96, 15.2],
      ],
      // 检查点坐标（复活点激活位置）
      checkpoints: [
        [33, 4], [90, 12], [121, 13], [140, 30.4], [173, 29.8], [203, 29.8], [234, 37.3],
      ],
      // NOVA 终点
      nova: { x: 236.5, y: 46.6 },
      // 冲刺半环轨道（三章：走廊 → 直线跑道 → 半环翻越 → 衔接台）
      // 两段拼接：直线跑道 (130,4.42)→(140,4.42) 无速度要求（speedThreshold=0），
      // 再接圆弧段：圆心 (140, 5.42) 半径 1.0，底部 (-π/2) → 顶部 (+π/2)，逆时针。
      // 入口在直线起点 (130, 4.42)，出口 = 直线长 10 + 弧长 π。
      tracks: [
        {
          segments: [
            { type: 'line', x1: 130, y1: 4.42, x2: 140, y2: 4.42 },
            { type: 'arc', cx: 140, cy: 5.42, radius: 1.0, startAngle: -Math.PI / 2, endAngle: Math.PI / 2, dir: 1 },
          ],
          entryDist: 0,
          exitDist: 10 + Math.PI,
          speedThreshold: 0,
        },
      ],
    },
  },
  // ══════════════════════════════════════════════
  // 地图二 · 水晶洞窟 · 对称迷城（180×100，46 光球）
  // 来源：工具/code (1).html 的 CUSTOM_MAP（v2 layers 格式），
  // 经编辑器同款 decompile 逻辑转录为 MapDefinition。
  // ══════════════════════════════════════════════
  {
    id: 'crystal-caverns',
    name: '水晶洞窟 · 对称迷城',
    width: 180,
    height: 100,
    playerSpawn: { x: 90, y: 6 },

    // ── 静态几何（非 ECS）──
    solids: [
      // 地面与外墙
      R(0, 0, 180, 4), R(0, 4, 3, 96), R(177, 4, 3, 96),
      // 出生平台
      R(70, 4, 40, 2),
      // 左塔之字形攀升平台 (11 层)
      R(5, 8, 12, 1), R(20, 12, 12, 1), R(5, 16, 12, 1), R(20, 20, 12, 1),
      R(5, 24, 12, 1), R(20, 28, 12, 1), R(5, 32, 12, 1), R(20, 36, 12, 1),
      R(5, 40, 12, 1), R(20, 44, 12, 1), R(5, 48, 12, 1),
      // 右塔之字形攀升平台（镜像）
      R(163, 8, 12, 1), R(148, 12, 12, 1), R(163, 16, 12, 1), R(148, 20, 12, 1),
      R(163, 24, 12, 1), R(148, 28, 12, 1), R(163, 32, 12, 1), R(148, 36, 12, 1),
      R(163, 40, 12, 1), R(148, 44, 12, 1), R(163, 48, 12, 1),
      // 下层桥（有缺口）
      R(30, 30, 35, 1), R(115, 30, 35, 1),
      // 中层桥（有缺口）
      R(35, 42, 30, 1), R(115, 42, 30, 1),
      // 上层桥（全通）
      R(25, 54, 130, 2),
      // 水晶花园四层
      R(40, 60, 100, 2), R(55, 68, 70, 2), R(65, 76, 50, 2), R(75, 84, 30, 2),
      // 浮空小平台
      R(30, 50, 5, 0.8), R(145, 50, 5, 0.8), R(70, 57, 6, 0.8), R(104, 57, 6, 0.8),
      // 危险平台（带尖刺）
      R(45, 36, 8, 1), R(127, 36, 8, 1),
    ],

    spikes: [
      // 地面尖刺
      { x: 60, y: 4 }, { x: 61, y: 4 }, { x: 62, y: 4 }, { x: 63, y: 4 }, { x: 64, y: 4 },
      { x: 115, y: 4 }, { x: 116, y: 4 }, { x: 117, y: 4 }, { x: 118, y: 4 }, { x: 119, y: 4 },
      // 桥面尖刺
      { x: 47, y: 31 }, { x: 48, y: 31 }, { x: 127, y: 31 }, { x: 128, y: 31 },
      // 危险平台上的尖刺
      { x: 48, y: 37 }, { x: 49, y: 37 }, { x: 130, y: 37 }, { x: 131, y: 37 },
    ],

    decos: [
      [90, 12, 1.5, 0.3], [40, 18, 1, -0.5], [140, 18, 1, 0.5], [90, 35, 1.2, 0.4],
      [25, 52, 0.9, -0.7], [155, 52, 0.9, 0.7], [90, 58, 1.3, 0.3], [50, 72, 1.1, -0.4],
      [130, 72, 1.1, 0.4], [90, 82, 1.4, 0.2],
    ],

    hints: [
      [90, 9, '深渊 · 对称双塔迷城'],
      [8, 20, '← 左塔攀升'],
      [172, 20, '右塔攀升 →'],
      [50, 33, '下层桥 · 计时通过'],
      [90, 45, '升降平台'],
      [30, 56, '上层走廊'],
      [90, 63, '水晶花园 · 弹簧上升'],
      [90, 78, '登顶 · NOVA ★'],
    ],

    // ── 实体生成描述（ECS 工厂）──
    entitySpawners: {
      movers: [
        { x0: 75, y: 28, w: 3, h: 0.8, range: 12, spd: 0.8, ph: 0 },
        { x0: 75, y: 40, w: 3, h: 0.8, range: 0, spd: 0.7, ph: 0, axis: 'y', yRange: 8 },
        { x0: 50, y: 52, w: 3, h: 0.8, range: 30, spd: 1, ph: 0.5 },
        { x0: 100, y: 52, w: 3, h: 0.8, range: 25, spd: 0.9, ph: 2 },
        { x0: 55, y: 58, w: 3, h: 0.8, range: 40, spd: 1.2, ph: 1 },
        { x0: 120, y: 66, w: 3, h: 0.8, range: 15, spd: 1, ph: 1.5 },
      ],
      springPads: [
        { x: 5, y: 49, w: 2.5, h: 2, force: { x: 0, y: 96 }, duration: 0.3 },
        { x: 163, y: 49, w: 2.5, h: 2, force: { x: 0, y: 96 }, duration: 0.3 },
        { x: 85, y: 62, w: 2.5, h: 2, force: { x: 0, y: 110 }, duration: 0.3 },
        { x: 65, y: 4, w: 2.5, h: 2, force: { x: 0, y: 128 }, duration: 0.3 },
        { x: 112, y: 4, w: 2.5, h: 2, force: { x: 0, y: 128 }, duration: 0.3 },
      ],
      lasers: [
        { x: 25, y0: 30, len: 5, ph: 0 },
        { x: 150, y0: 30, len: 5, ph: 1.5 },
        { x: 60, y0: 43, len: 4, ph: 0.8 },
        { x: 120, y0: 43, len: 4, ph: 2.1 },
        { x: 40, y0: 56, len: 4, ph: 1.2 },
        { x: 135, y0: 56, len: 4, ph: 0.5 },
      ],
      // 光球坐标（46 枚，沿塔/桥/花园路径散布，均悬空于台面上方 1 格）
      orbs: [
        // 左塔
        [7, 10], [22, 14], [7, 18], [22, 22], [7, 26], [22, 30], [7, 34], [22, 38], [7, 42], [22, 46], [9, 50],
        // 右塔
        [165, 10], [150, 14], [165, 18], [150, 22], [165, 26], [150, 32], [165, 34], [150, 38], [165, 42], [150, 46], [167, 50],
        // 下层/中层桥
        [35, 32], [50, 32], [130, 32], [145, 32],
        [40, 44], [55, 44], [125, 44], [140, 44],
        // 上层走廊
        [90, 57], [35, 57], [145, 57],
        // 水晶花园
        [50, 63], [70, 63], [90, 66], [110, 63], [130, 63],
        [60, 71], [90, 71], [120, 71],
        [70, 79], [90, 79], [110, 79],
        // 登顶
        [80, 87], [100, 87],
      ],
      jumpBoosts: [
        [90, 32], [40, 57], [140, 57], [94, 71],
      ],
      // 钩锁道具（拾取后进入背包，滑索跨桥/登塔用）
      hooks: [
        [16, 15.4],
        [164, 15.4],
        [93, 7.5],
      ],
      checkpoints: [
        [85, 6], [10, 50], [170, 50], [50, 56], [130, 56], [90, 62], [90, 78],
      ],
      nova: { x: 90, y: 88 },
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
 * 切换并重建关卡（切图串联：清空世界 → 数据层切图 → 重建实体）。
 * 玩家复位 / gs 计数复位 / 相机复位由 game 层 applyLevel 统一处理，
 * 保证「清空旧 ECS 实体 + loadMap(id) + initECSFromLevel() + 玩家复位」的完整链路。
 */
export function setupLevel(mapId: string): void {
  world.clear();
  loadMap(mapId);
  initECSFromLevel();
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
  // 钩锁道具（地图数据驱动；无 hooks 字段的地图自然不带钩锁）
  for (const [x, y] of s.hooks ?? []) {
    createHookPickup(x, y, 0);
  }
  for (const [x, y] of s.checkpoints) {
    createCheckpoint(x, y);
  }
  createNova(s.nova.x, s.nova.y);
  // 尖刺（静态几何 → ECS 实体）
  for (const sp of currentMap.spikes) {
    createSpike(sp.x, sp.y);
  }
  // 冲刺轨道（地图数据驱动；无 tracks 字段的地图自然不带轨道）
  for (const t of s.tracks ?? []) {
    createLoopTrack(t.segments, t.entryDist, t.exitDist, t.speedThreshold);
  }
}