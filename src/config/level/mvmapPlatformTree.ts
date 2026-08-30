/**
 * 2D地图设计2-1 平台树（18×6）
 */
import type { Rect, MapDefinition } from '../../types';

const R = (x: number, y: number, w: number, h: number, hookable = true): Rect => ({ x, y, w, h, top: y + h, hookable });

export const mvmapPlatformTree: MapDefinition = {
  id: 'mvmap-platform-tree',
  name: '2D地图设计2-1 平台树',
  width: 18,
  height: 6,
  playerSpawn: { x: 3.5, y: 1.5 },

  // ── 静态几何（墙，包围盒 − 可行走区）──
  solids: [
    R(0, 0, 18, 1),
    R(8, 1, 2, 1),
    R(2, 2, 1, 1),
    R(8, 2, 1, 1),
    R(13, 2, 1, 1),
    R(0, 1, 1, 3),
    R(8, 3, 2, 1),
    R(17, 1, 1, 3),
    R(0, 4, 2, 1),
    R(4, 4, 1, 1),
    R(6, 4, 7, 1),
    R(15, 4, 3, 1),
    R(0, 5, 18, 1),
  ],

  spikes: [],
  decos: [],

  // ── 墙体视觉层（统一色块，与 solids 逐块对应）──
  floor: {
    gridSize: 1,
    cells: [
      { x: 0, y: 0, w: 18, h: 1, color: '#4c8dd8' },
      { x: 8, y: 1, w: 2, h: 1, color: '#4c8dd8' },
      { x: 2, y: 2, w: 1, h: 1, color: '#4c8dd8' },
      { x: 8, y: 2, w: 1, h: 1, color: '#4c8dd8' },
      { x: 13, y: 2, w: 1, h: 1, color: '#4c8dd8' },
      { x: 0, y: 1, w: 1, h: 3, color: '#4c8dd8' },
      { x: 8, y: 3, w: 2, h: 1, color: '#4c8dd8' },
      { x: 17, y: 1, w: 1, h: 3, color: '#4c8dd8' },
      { x: 0, y: 4, w: 2, h: 1, color: '#4c8dd8' },
      { x: 4, y: 4, w: 1, h: 1, color: '#4c8dd8' },
      { x: 6, y: 4, w: 7, h: 1, color: '#4c8dd8' },
      { x: 15, y: 4, w: 3, h: 1, color: '#4c8dd8' },
      { x: 0, y: 5, w: 18, h: 1, color: '#4c8dd8' },
    ],
  },

  hints: [],

  // ── 实体生成描述 ──
  entitySpawners: {
    movers: [],
    springPads: [],
    lasers: [],
    orbs: [],
    jumpBoosts: [],
    checkpoints: [],
    nova: { x: 8.5, y: 4.5 },
  },
};
