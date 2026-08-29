/**
 * 入口 —— 初始化并启动游戏循环、挂载 Canvas。
 * 所有 UI 事件通过 UIManager 统一分发（click/move/key）。
 */
import './style.css';
import { cv, VW, VH } from './core/canvas';
import { initInput, setInputHandler } from './core/input';
import { initMouseListeners } from './core/mouse';
import { handleKeyDown, startLoop } from './systems/game';
import { registerUIScenes } from './systems/ui/scenes';
import { ui } from './core/uiComponent';
import './netBridge'; // 装配 netBus（组合根，副作用）
import { initECSFromLevel } from './config/level';
import { Settings } from './core/settings';

// 载入玩家设置（音量 / 画质）—— 必须早于 UI 与音频初始化，
// 否则首帧用的是默认参数，随后才被覆盖（画面与音量会闪一下）。
Settings.load();

// 初始化 ECS 实体（玩家、光球、检查点、NOVA）
initECSFromLevel();

// 注册 UI 场景（菜单/暂停/大厅）
registerUIScenes();

// 键盘：UI 优先消费（输入框/快捷键），未消费的交给游戏逻辑
setInputHandler((e: KeyboardEvent) => {
  if (ui.handleKey(e)) return;
  handleKeyDown(e);
});
initInput();

// 鼠标（游戏玩法：钩锁瞄准/发射）
initMouseListeners(cv);

// 将鼠标屏幕坐标换算为逻辑坐标（1280×720）
function lxly(e: MouseEvent): [number, number] {
  const rect = cv.getBoundingClientRect();
  return [
    (e.clientX - rect.left) / rect.width * VW,
    (e.clientY - rect.top) / rect.height * VH,
  ];
}

// 鼠标按下 → UIManager 分发（滑块拖拽起点；必须早于 click，否则 mouseup 先过境）
cv.addEventListener('mousedown', (e: MouseEvent) => {
  if (e.button !== 0) return;
  const [lx, ly] = lxly(e);
  ui.handlePress(lx, ly);
});

// 点击 → UIManager 分发
cv.addEventListener('click', (e: MouseEvent) => {
  const [lx, ly] = lxly(e);
  ui.handleClick(lx, ly);
});

// 鼠标移动 → UIManager 分发（悬停/光标）
cv.addEventListener('mousemove', (e: MouseEvent) => {
  const [lx, ly] = lxly(e);
  ui.handleMove(lx, ly);
});

// 鼠标抬起 → UIManager 分发（结束滑块等组件的拖拽；挂 window 以便拖出画布也能结束）
window.addEventListener('mouseup', () => {
  ui.handleRelease();
});

// 滚轮 → UIManager 分发（选择页滚动等）；消费后阻止页面滚动
cv.addEventListener('wheel', (e: WheelEvent) => {
  if (ui.handleWheel(e.deltaY)) {
    e.preventDefault();
  }
}, { passive: false });

// 启动主循环
startLoop();