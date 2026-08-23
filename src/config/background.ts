/**
 * 背景装饰注册表 —— 视差远层 / 中层形状（mulberry 种子生成）。
 * 只依赖 types 与 core/math 的 mulberry。
 */
import type { FarShape, MidShape } from '../types';
import { mulberry } from '../core/math';

/** 远层光斑（cyan / purple 渐变） */
export const farShapes: FarShape[] = [];
/** 中层旋转形状 */
export const midShapes: MidShape[] = [];

(function init() {
  const r = mulberry(2024);
  for (let i = 0; i < 26; i++) {
    farShapes.push({
      x: r() * 85,
      y: r() * 34 + 2,
      r: 2 + r() * 4.5,
      c: r() < 0.5 ? '96,140,255' : '168,110,255',
      a: 0.05 + r() * 0.06,
    });
  }
  for (let i = 0; i < 22; i++) {
    midShapes.push({
      x: r() * 132,
      y: r() * 44 + 3,
      s: 0.5 + r() * 1.2,
      sp: (r() - 0.5) * 1.6,
      ph: r() * 6.28,
      t: r() < 0.5 ? 0 : 1,
    });
  }
})();