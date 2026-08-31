/**
 * 鼠标输入 —— 维护游戏逻辑层鼠标状态（画布逻辑坐标 VW×VH）。
 * UI（btn/输入框）有自己的监听；本模块只服务游戏玩法（钩锁瞄准/发射）。
 * 世界坐标换算由调用方用 view（core/camera）反算。
 *
 * 按下沿（mousedown 边沿）由 game 层在 step 顶部捕获：
 *   const edge = mouse.down && !mouse.prevDown; mouse.prevDown = mouse.down;
 * 即使暂停/菜单期间也推进 prevDown，避免暂停期间的点击在恢复后误触发。
 */
import { VW, VH } from './canvas';
export const mouse = {
  /** 逻辑 X（0~VW） */
  x: 0,
  /** 逻辑 Y（0~VH） */
  y: 0,
  /** 左键是否按下 */
  down: false,
  /** 上一帧左键状态（由 game 层推进） */
  prevDown: false,
  /** 右键是否按下（副武器 / 手雷投掷） */
  rDown: false,
  /** 上一帧右键状态（由 game 层推进） */
  rPrevDown: false,
  /** 鼠标是否移动过（未移动时瞄准回退为面朝方向） */
  used: false,
};

/** 写入逻辑坐标（由 main.ts 的 mousemove 调用） */
export function setMousePos(lx: number, ly: number): void {
  mouse.x = lx;
  mouse.y = ly;
  mouse.used = true;
}

/** 事件 → 逻辑坐标（画布尺寸 → VW×VH 逻辑分辨率） */
function localPoint(cv: HTMLCanvasElement, e: MouseEvent): [number, number] {
  const rect = cv.getBoundingClientRect();
  return [
    (e.clientX - rect.left) / rect.width * VW,
    (e.clientY - rect.top) / rect.height * VH,
  ];
}

/** 监听画布鼠标事件（main.ts 调用） */
export function initMouseListeners(cv: HTMLCanvasElement): void {
  cv.addEventListener('mousemove', (e: MouseEvent) => {
    setMousePos(...localPoint(cv, e));
  });
  cv.addEventListener('mousedown', (e: MouseEvent) => {
    if (e.button !== 0 && e.button !== 2) return;
    setMousePos(...localPoint(cv, e));
    if (e.button === 0) mouse.down = true;
    else mouse.rDown = true;
  });
  window.addEventListener('mouseup', (e: MouseEvent) => {
    if (e.button === 0) mouse.down = false;
    else if (e.button === 2) mouse.rDown = false;
  });
  // 阻止右键弹出上下文菜单（射击游戏标准行为）
  cv.addEventListener('contextmenu', (e: MouseEvent) => e.preventDefault());
  // 失焦时复位，避免卡住
  window.addEventListener('blur', () => {
    mouse.down = false;
  });
}