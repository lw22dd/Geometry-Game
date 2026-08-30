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
  /** 点击回调（可选接收点击处的逻辑坐标，供滑块等需要定位的组件使用） */
  onClick?: (lx?: number, ly?: number) => void;
  /** 按键回调，返回 true 表示消费该事件 */
  onKey?: (e: KeyboardEvent) => boolean;
  /**
   * 鼠标按下回调（拖拽起点）。
   * 必须由 mousedown 驱动而非 click —— click 晚于 mouseup，
   * 若等到 click 才开始拖拽，mouseup 已经过境，拖拽状态会残留到下一次移动。
   */
  onPress?: (lx: number, ly: number) => void;
  /** 拖拽中标记（组件自维护；UIManager 在鼠标移动时据此回调 onDrag） */
  dragging?: boolean;
  /** 拖拽中的移动回调（仅 dragging 为真时触发） */
  onDrag?: (lx: number, ly: number) => void;
  /** 全局鼠标抬起回调（拖拽结束；由 window mouseup 驱动，拖出画布也能结束） */
  onRelease?: () => void;
}

/** UI 场景 —— 一组组件的集合，可带自定义背景绘制 */
export interface UIScene {
  name: string;
  widgets: UIWidget[];
  /** 场景背景/装饰绘制（复杂动画走这里，组件之前的底层） */
  draw?: (t: number) => void;
  /** 滚轮事件（dy>0 向下滚动）；返回 true 表示消费该事件（阻止页面滚动） */
  onWheel?: (dy: number) => boolean;
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
  PREPARE: 'prepare',
  MAP_SELECT: 'mapSelect',
  CHAR_SELECT: 'charSelect',
  DEV: 'dev',
  INSTRUCTIONS: 'instructions',
  SETTINGS: 'settings',
} as const;

export type UISceneName = (typeof UI_SCENE)[keyof typeof UI_SCENE] | null;