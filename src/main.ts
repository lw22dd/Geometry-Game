/**
 * 入口 —— 初始化并启动游戏循环、挂载 Canvas。
 */
import './style.css';
import { cv, VW, VH } from './core/canvas';
import { initInput, setInputHandler } from './core/input';
import { handleKeyDown, startLoop, startGame } from './systems/game';
import { gs } from './systems/game/state';
import { checkMenuClick } from './systems/ui';
import './netBridge'; // 装配 netBus（组合根，副作用）
import { initECSFromLevel } from './config/level';

// 初始化 ECS 实体（玩家、光球、检查点、NOVA）
initECSFromLevel();

// 按键 → 游戏逻辑
setInputHandler(handleKeyDown);
initInput();

// 点击「开始游戏」按钮 → 进入游戏
cv.addEventListener('click', (e: MouseEvent) => {
  if (gs.screen !== 'menu') return;
  // 将鼠标位置换算为逻辑坐标（1280×720）
  const rect = cv.getBoundingClientRect();
  const lx = (e.clientX - rect.left) / rect.width * VW;
  const ly = (e.clientY - rect.top) / rect.height * VH;
  if (checkMenuClick(lx, ly)) startGame();
});

// 启动主循环
startLoop();