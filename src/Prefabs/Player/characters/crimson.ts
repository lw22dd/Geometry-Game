/**
 * 绯红冲刺者 —— 新增的第二位角色（暖橙红配色，独立数据定义）。
 * 与默认角色同流派（发光球体+双眼），但作为独立注册条目存在：
 * 选择界面/远端渲染均由 CHARACTERS 列表驱动，不是默认角色的数据复用。
 */
import type { CharacterStyle } from './default';

/** 绯红冲刺者 —— 暖橙红渐变 + 琥珀发光 */
export const crimsonCharacter: CharacterStyle = {
  id: 'crimson-runner',
  name: '绯红冲刺者',
  bodyGrad: ['#fff2ea', '#ffb8a8', '#ff4a3c'],
  stroke: 'rgba(255,170,140,.6)',
  glow: 'rgba(255,100,60,.95)',
  eyeColor: '#2b0d12',
  eyeDX: [0.15, 0.55],
  radius: 0.5,
};