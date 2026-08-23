/**
 * 默认角色 —— 霓虹跑者（发光球体 + 双眼）。
 * 纯数据定义：颜色 / 尺寸 / 特效参数，不含任何绘制逻辑。
 */
export interface CharacterStyle {
  id: string;
  name: string;
  /** 身体径向渐变三档（0 / 0.55 / 1） */
  bodyGrad: [string, string, string];
  /** 外描边颜色 */
  stroke: string;
  /** 身体发光色 */
  glow: string;
  /** 眼睛颜色 */
  eyeColor: string;
  /** 前后两只眼的水平偏移系数（相对半径） */
  eyeDX: [number, number];
  /** 身体半径（米） */
  radius: number;
}

/** 霓虹跑者 —— 默认角色 */
export const defaultCharacter: CharacterStyle = {
  id: 'neon-runner',
  name: '霓虹跑者',
  bodyGrad: ['#ffffff', '#bfe9ff', '#5f8dff'],
  stroke: 'rgba(255,255,255,.55)',
  glow: 'rgba(120,200,255,.95)',
  eyeColor: '#1a1440',
  eyeDX: [0.15, 0.55],
  radius: 0.46,
};