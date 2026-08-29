/**
 * 视觉参数注册表 —— 粒子 / 曳光 / 环境视觉的调参。
 * 与物理手感参数（physics.ts）分开维护：本文件只涉及"观感"，不涉及"手感"。
 * 消费者：systems/particles（曳光衰减）、Prefabs/Scenes/atmosphere（尾迹透明度）。
 * 只依赖 types。
 */

/** 曳光轨迹寿命（秒） */
export const TLIFE = 0.5;
