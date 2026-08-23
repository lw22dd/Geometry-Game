/**
 * UI 组件框架 —— 类型定义。
 * core/uiComponent 不依赖 systems/config，只依赖 core（canvas/math）。
 */

/**
 * UI 组件接口 —— 所有可交互 UI 元素（按钮/输入框）实现此接口。
 * 状态：visible 显隐、hover 悬停（由 UIManager 分发）、focused 焦点（输入框用）。
 */
export interface UIWidget {
  readonly id: string;
  visible: boolean;
  hover: boolean;
  /** 可聚焦（输入框类）——点击获得焦点，键盘输入优先分发给它 */
  focusable: boolean;
  focused: boolean;
  /** 命中测试（逻辑坐标） */
  hit(lx: number, ly: number): boolean;
  /** 绘制（t = 本地 UI 时间，供入场动画/流光使用） */
  draw(t: number): void;
  /** 点击回调 */
  onClick?: () => void;
  /** 按键回调，返回 true 表示消费该事件 */
  onKey?: (e: KeyboardEvent) => boolean;
}

/** UI 场景 —— 一组组件的集合，可带自定义背景绘制 */
export interface UIScene {
  name: string;
  widgets: UIWidget[];
  /** 场景背景/装饰绘制（复杂动画走这里，组件之前的底层） */
  draw?: (t: number) => void;
  /** 进入场景时回调（如重置动画计时） */
  onEnter?: () => void;
  /** 离开场景时回调（如复位光标） */
  onExit?: () => void;
}

/** 场景名常量 */
export const UI_SCENE = {
  NONE: 'none',
  MENU: 'menu',
  PAUSE: 'pause',
  LOBBY: 'lobby',
  DEV: 'dev',
  GALLERY: 'gallery',
  INSTRUCTIONS: 'instructions',
} as const;

export type UISceneName = (typeof UI_SCENE)[keyof typeof UI_SCENE] | null;