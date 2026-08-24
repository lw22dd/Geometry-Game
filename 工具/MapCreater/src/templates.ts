/**
 * 地图模板注册表 —— 编辑器「从模板新建」功能的数据源。
 *
 * 每个模板是一个独立副本的 MapData v2，由 create() 工厂返回深拷贝，
 * 确保多次应用模板互不干扰（编辑不会污染模板源数据）。
 */
import type { MapData } from './mapTypes';
import { createEmptyMapData } from './mapTypes';

export interface MapTemplate {
  /** 模板唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 图标 emoji */
  icon: string;
  /** 简短描述 */
  desc: string;
  /** 返回模板的独立深拷贝 MapData */
  create(): MapData;
}

/* ==================== 内置模板数据 ==================== */

/**
 * 水晶洞窟 · 对称迷城
 * 取自 工具/code (1).html 的 CUSTOM_MAP 预设。
 * 对称双塔 × 水晶花园：之字形攀升、移动平台、弹簧跳板、激光栅栏，登顶 NOVA。
 */
const CRYSTAL_CAVERNS_DATA: MapData = {
  version: 2,
  id: 'crystal-caverns',
  name: '水晶洞窟 · 对称迷城',
  width: 180,
  height: 100,
  playerSpawn: { x: 90, y: 6 },
  layers: {
    geometry: [
      /* —— 地面与外墙 —— */
      { type: 'rect', x: 0, y: 0, w: 180, h: 4, rotation: 0 },
      { type: 'rect', x: 0, y: 4, w: 3, h: 96, rotation: 0 },
      { type: 'rect', x: 177, y: 4, w: 3, h: 96, rotation: 0 },
      /* —— 出生平台 —— */
      { type: 'rect', x: 70, y: 4, w: 40, h: 2, rotation: 0 },
      /* —— 左塔之字形攀升平台 (11层) —— */
      { type: 'rect', x: 5, y: 8, w: 12, h: 1, rotation: 0 },
      { type: 'rect', x: 20, y: 12, w: 12, h: 1, rotation: 0 },
      { type: 'rect', x: 5, y: 16, w: 12, h: 1, rotation: 0 },
      { type: 'rect', x: 20, y: 20, w: 12, h: 1, rotation: 0 },
      { type: 'rect', x: 5, y: 24, w: 12, h: 1, rotation: 0 },
      { type: 'rect', x: 20, y: 28, w: 12, h: 1, rotation: 0 },
      { type: 'rect', x: 5, y: 32, w: 12, h: 1, rotation: 0 },
      { type: 'rect', x: 20, y: 36, w: 12, h: 1, rotation: 0 },
      { type: 'rect', x: 5, y: 40, w: 12, h: 1, rotation: 0 },
      { type: 'rect', x: 20, y: 44, w: 12, h: 1, rotation: 0 },
      { type: 'rect', x: 5, y: 48, w: 12, h: 1, rotation: 0 },
      /* —— 右塔之字形攀升平台 (镜像) —— */
      { type: 'rect', x: 163, y: 8, w: 12, h: 1, rotation: 0 },
      { type: 'rect', x: 148, y: 12, w: 12, h: 1, rotation: 0 },
      { type: 'rect', x: 163, y: 16, w: 12, h: 1, rotation: 0 },
      { type: 'rect', x: 148, y: 20, w: 12, h: 1, rotation: 0 },
      { type: 'rect', x: 163, y: 24, w: 12, h: 1, rotation: 0 },
      { type: 'rect', x: 148, y: 28, w: 12, h: 1, rotation: 0 },
      { type: 'rect', x: 163, y: 32, w: 12, h: 1, rotation: 0 },
      { type: 'rect', x: 148, y: 36, w: 12, h: 1, rotation: 0 },
      { type: 'rect', x: 163, y: 40, w: 12, h: 1, rotation: 0 },
      { type: 'rect', x: 148, y: 44, w: 12, h: 1, rotation: 0 },
      { type: 'rect', x: 163, y: 48, w: 12, h: 1, rotation: 0 },
      /* —— 下层桥（有缺口） —— */
      { type: 'rect', x: 30, y: 30, w: 35, h: 1, rotation: 0 },
      { type: 'rect', x: 115, y: 30, w: 35, h: 1, rotation: 0 },
      /* —— 中层桥（有缺口） —— */
      { type: 'rect', x: 35, y: 42, w: 30, h: 1, rotation: 0 },
      { type: 'rect', x: 115, y: 42, w: 30, h: 1, rotation: 0 },
      /* —— 上层桥（全通） —— */
      { type: 'rect', x: 25, y: 54, w: 130, h: 2, rotation: 0 },
      /* —— 水晶花园四层 —— */
      { type: 'rect', x: 40, y: 60, w: 100, h: 2, rotation: 0 },
      { type: 'rect', x: 55, y: 68, w: 70, h: 2, rotation: 0 },
      { type: 'rect', x: 65, y: 76, w: 50, h: 2, rotation: 0 },
      { type: 'rect', x: 75, y: 84, w: 30, h: 2, rotation: 0 },
      /* —— 浮空小平台 —— */
      { type: 'rect', x: 30, y: 50, w: 5, h: 0.8, rotation: 0 },
      { type: 'rect', x: 145, y: 50, w: 5, h: 0.8, rotation: 0 },
      { type: 'rect', x: 70, y: 57, w: 6, h: 0.8, rotation: 0 },
      { type: 'rect', x: 104, y: 57, w: 6, h: 0.8, rotation: 0 },
      /* —— 危险平台（带尖刺） —— */
      { type: 'rect', x: 45, y: 36, w: 8, h: 1, rotation: 0 },
      { type: 'rect', x: 127, y: 36, w: 8, h: 1, rotation: 0 },
    ],
    objects: [
      /* —— 地面尖刺 —— */
      { type: 'spike', x: 60, y: 4 },
      { type: 'spike', x: 61, y: 4 },
      { type: 'spike', x: 62, y: 4 },
      { type: 'spike', x: 63, y: 4 },
      { type: 'spike', x: 64, y: 4 },
      { type: 'spike', x: 115, y: 4 },
      { type: 'spike', x: 116, y: 4 },
      { type: 'spike', x: 117, y: 4 },
      { type: 'spike', x: 118, y: 4 },
      { type: 'spike', x: 119, y: 4 },
      /* —— 桥面尖刺 —— */
      { type: 'spike', x: 47, y: 31 },
      { type: 'spike', x: 48, y: 31 },
      { type: 'spike', x: 127, y: 31 },
      { type: 'spike', x: 128, y: 31 },
      /* —— 危险平台上的尖刺 —— */
      { type: 'spike', x: 48, y: 37 },
      { type: 'spike', x: 49, y: 37 },
      { type: 'spike', x: 130, y: 37 },
      { type: 'spike', x: 131, y: 37 },
      /* —— 装饰方块（水晶簇） —— */
      { type: 'deco', x: 90, y: 12, size: 1.5, rotSpeed: 0.3 },
      { type: 'deco', x: 40, y: 18, size: 1, rotSpeed: -0.5 },
      { type: 'deco', x: 140, y: 18, size: 1, rotSpeed: 0.5 },
      { type: 'deco', x: 90, y: 35, size: 1.2, rotSpeed: 0.4 },
      { type: 'deco', x: 25, y: 52, size: 0.9, rotSpeed: -0.7 },
      { type: 'deco', x: 155, y: 52, size: 0.9, rotSpeed: 0.7 },
      { type: 'deco', x: 90, y: 58, size: 1.3, rotSpeed: 0.3 },
      { type: 'deco', x: 50, y: 72, size: 1.1, rotSpeed: -0.4 },
      { type: 'deco', x: 130, y: 72, size: 1.1, rotSpeed: 0.4 },
      { type: 'deco', x: 90, y: 82, size: 1.4, rotSpeed: 0.2 },
      /* —— 提示文字 —— */
      { type: 'hint', x: 90, y: 9, text: '深渊 · 对称双塔迷城' },
      { type: 'hint', x: 8, y: 20, text: '← 左塔攀升' },
      { type: 'hint', x: 172, y: 20, text: '右塔攀升 →' },
      { type: 'hint', x: 50, y: 33, text: '下层桥 · 计时通过' },
      { type: 'hint', x: 90, y: 45, text: '⚡ 升降平台' },
      { type: 'hint', x: 30, y: 56, text: '上层走廊' },
      { type: 'hint', x: 90, y: 63, text: '水晶花园 · 弹簧上升' },
      { type: 'hint', x: 90, y: 78, text: '登顶 · NOVA ★' },
      /* —— 移动平台 —— */
      { type: 'mover', x0: 75, y: 28, w: 3, h: 0.8, range: 12, spd: 0.8, ph: 0 },
      { type: 'mover', x0: 75, y: 40, w: 3, h: 0.8, range: 0, spd: 0.7, ph: 0, axis: 'y', yRange: 8 },
      { type: 'mover', x0: 50, y: 52, w: 3, h: 0.8, range: 30, spd: 1, ph: 0.5 },
      { type: 'mover', x0: 100, y: 52, w: 3, h: 0.8, range: 25, spd: 0.9, ph: 2 },
      { type: 'mover', x0: 55, y: 58, w: 3, h: 0.8, range: 40, spd: 1.2, ph: 1 },
      { type: 'mover', x0: 120, y: 66, w: 3, h: 0.8, range: 15, spd: 1, ph: 1.5 },
      /* —— 弹簧跳板 —— */
      { type: 'springPad', x: 5, y: 48, w: 2.5, h: 2, force: { x: 0, y: 96 }, duration: 0.3 },
      { type: 'springPad', x: 163, y: 48, w: 2.5, h: 2, force: { x: 0, y: 96 }, duration: 0.3 },
      { type: 'springPad', x: 85, y: 60, w: 2.5, h: 2, force: { x: 0, y: 110 }, duration: 0.3 },
      { type: 'springPad', x: 65, y: 4, w: 2.5, h: 2, force: { x: 0, y: 128 }, duration: 0.3 },
      { type: 'springPad', x: 113, y: 4, w: 2.5, h: 2, force: { x: 0, y: 128 }, duration: 0.3 },
      /* —— 激光栅栏 —— */
      { type: 'laser', x: 25, y0: 30, len: 5, ph: 0 },
      { type: 'laser', x: 150, y0: 30, len: 5, ph: 1.5 },
      { type: 'laser', x: 60, y0: 42, len: 4, ph: 0.8 },
      { type: 'laser', x: 120, y0: 42, len: 4, ph: 2.1 },
      { type: 'laser', x: 40, y0: 54, len: 4, ph: 1.2 },
      { type: 'laser', x: 135, y0: 54, len: 4, ph: 0.5 },
      /* —— 光球（沿路径散布） —— */
      { type: 'orb', x: 7, y: 10 },
      { type: 'orb', x: 22, y: 14 },
      { type: 'orb', x: 7, y: 18 },
      { type: 'orb', x: 22, y: 22 },
      { type: 'orb', x: 7, y: 26 },
      { type: 'orb', x: 22, y: 30 },
      { type: 'orb', x: 7, y: 34 },
      { type: 'orb', x: 22, y: 38 },
      { type: 'orb', x: 7, y: 42 },
      { type: 'orb', x: 22, y: 46 },
      { type: 'orb', x: 7, y: 50 },
      { type: 'orb', x: 165, y: 10 },
      { type: 'orb', x: 150, y: 14 },
      { type: 'orb', x: 165, y: 18 },
      { type: 'orb', x: 150, y: 22 },
      { type: 'orb', x: 165, y: 26 },
      { type: 'orb', x: 150, y: 32 },
      { type: 'orb', x: 165, y: 34 },
      { type: 'orb', x: 150, y: 38 },
      { type: 'orb', x: 165, y: 42 },
      { type: 'orb', x: 150, y: 46 },
      { type: 'orb', x: 165, y: 50 },
      { type: 'orb', x: 35, y: 32 },
      { type: 'orb', x: 50, y: 32 },
      { type: 'orb', x: 130, y: 32 },
      { type: 'orb', x: 145, y: 32 },
      { type: 'orb', x: 40, y: 44 },
      { type: 'orb', x: 55, y: 44 },
      { type: 'orb', x: 125, y: 44 },
      { type: 'orb', x: 140, y: 44 },
      { type: 'orb', x: 90, y: 57 },
      { type: 'orb', x: 35, y: 57 },
      { type: 'orb', x: 145, y: 57 },
      { type: 'orb', x: 50, y: 63 },
      { type: 'orb', x: 70, y: 63 },
      { type: 'orb', x: 90, y: 66 },
      { type: 'orb', x: 110, y: 63 },
      { type: 'orb', x: 130, y: 63 },
      { type: 'orb', x: 60, y: 71 },
      { type: 'orb', x: 90, y: 71 },
      { type: 'orb', x: 120, y: 71 },
      { type: 'orb', x: 70, y: 79 },
      { type: 'orb', x: 90, y: 79 },
      { type: 'orb', x: 110, y: 79 },
      { type: 'orb', x: 80, y: 87 },
      { type: 'orb', x: 100, y: 87 },
      /* —— 双跳光球 —— */
      { type: 'jumpBoost', x: 90, y: 32 },
      { type: 'jumpBoost', x: 40, y: 57 },
      { type: 'jumpBoost', x: 140, y: 57 },
      { type: 'jumpBoost', x: 90, y: 71 },
      /* —— 检查点 —— */
      { type: 'checkpoint', x: 85, y: 6 },
      { type: 'checkpoint', x: 10, y: 50 },
      { type: 'checkpoint', x: 170, y: 50 },
      { type: 'checkpoint', x: 50, y: 56 },
      { type: 'checkpoint', x: 130, y: 56 },
      { type: 'checkpoint', x: 90, y: 62 },
      { type: 'checkpoint', x: 90, y: 78 },
      /* —— NOVA 终点 —— */
      { type: 'nova', x: 90, y: 88 },
    ],
  },
};

/* ==================== 模板注册表 ==================== */

export const MAP_TEMPLATES: MapTemplate[] = [
  {
    id: 'empty',
    name: '空白画布',
    icon: 'File',
    desc: '从零开始：默认 120×72 空地图，无任何内容。',
    create: () => createEmptyMapData(),
  },
  {
    id: 'crystal-caverns',
    name: '水晶洞窟 · 对称迷城',
    icon: 'Map',
    desc: '对称双塔与水晶花园：之字形攀升、移动平台、弹簧跳板、激光栅栏，登顶 NOVA。',
    create: () => JSON.parse(JSON.stringify(CRYSTAL_CAVERNS_DATA)) as MapData,
  },
];

/** 按 id 查找模板 */
export function getMapTemplate(id: string): MapTemplate | undefined {
  return MAP_TEMPLATES.find(t => t.id === id);
}