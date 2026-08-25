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

// 启动主循环
startLoop();