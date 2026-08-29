/**
 * UI 主题 —— 字体 / 字号 / 颜色 token（问题 13：消灭 UI 层 50+ 处硬编码 ctx.font）。
 * 依赖：仅常量导出，无运行时导入。
 */

/** 字体族 */
export const F = {
  /** 主界面字体（拉丁优先 + 中文回退） */
  UI: '"Segoe UI","Microsoft YaHei",Arial',
  /** 纯拉丁字体（键帽 / 标题斜体 / 数字） */
  LATIN: 'Arial',
  /** 等宽（调试 HUD） */
  MONO: '"Consolas","Courier New",monospace',
} as const;

/** 常用字号（px） */
export const SZ = {
  TITLE: 28,     // 场景主标题
  TITLE_LG: 36,  // 大标题（选择页）
  H: 20,         // 小节标题 / 卡片名
  BODY: 15,      // 正文 / 状态行
  SMALL: 13,     // 辅助说明 / 键帽
  XS: 12,        // 底部提示
  KEY: 13,       // 键帽
} as const;

/** 常用颜色 */
export const C = {
  title: '#bfe9ff',               // 场景主标题
  text: '#eaf6ff',                // 主文字（卡片名）
  accent: '#7df9ff',              // 高亮青
  sub: 'rgba(160,185,255,.7)',    // 次级文字
  subDim: 'rgba(150,180,255,.55)',
  faint: 'rgba(150,180,255,.45)',
  panel: 'rgba(10,8,32,.92)',     // 玻璃面板底
  panelEdge: 'rgba(130,160,255,.45)', // 面板描边
  panelShadow: 'rgba(80,60,200,.45)', // 面板阴影
  mask: 'rgba(5,3,16,.7)',        // 全屏遮罩
  glowBar: 'rgba(140,246,255,.5)',
} as const;
