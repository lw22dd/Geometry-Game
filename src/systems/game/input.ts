/**
 * 输入回调 —— handleKeyDown / handleWheel。
 * 从原 game/index.ts 上帝模块拆出。
 */
import { ui } from '../../core/uiComponent';
import { prepare } from '../ui/prepare';
import { gs } from './gameState';
import { getMode, setMode } from './gameMode';
import { startGame } from './lifecycle';
import { playerController } from '../player';
import { PHYS } from '../../config';
import { Settings } from '../../core/settings';
import { resetMusicClock } from '../../core/music';
import { tryInteractCheckpoint } from '../interactions';
import { MAX_BACKPACK } from '../../types';

/** 按键逻辑（由 core/input 的 keydown 回调调用） */
export function handleKeyDown(e: KeyboardEvent): void {
  // 模式选择页（创建房间前）：ESC 返回准备界面（Enter/Space 不触发单机开局）
  if (ui.currentName === 'modeSelect') {
    if (e.code === 'Escape') {
      prepare.mode = 'prepare';
      ui.show('prepare');
    }
    return;
  }

  // 准备流程（含两个选择子页）：ESC 逐级返回，Enter/Space 单机开始（场景经 ui.show 唯一入口）
  if (gs.screen === 'prepare') {
    if (prepare.mode === 'maps' || prepare.mode === 'chars') {
      if (e.code === 'Escape') {
        prepare.mode = 'prepare';
        ui.show('prepare');
      }
      return;
    }
    if (e.code === 'Escape') {
      ui.show('menu');
    } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') {
      startGame();
    }
    return;
  }

  // 菜单中：Enter / Space 进入准备界面（选图/选人）
  if (gs.screen === 'menu') {
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') {
      prepare.mode = 'prepare';
      ui.show('prepare');
    }
    return;
  }

  // 暂停中：ESC 或 Enter 继续（弹出 pause 叠层 → 回游戏）
  if (gs.screen === 'paused') {
    if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') {
      ui.show(null);
    }
    return;
  }

  // ESC → 暂停（叠层：push pause）
  if (e.code === 'Escape') {
    ui.show('pause');
    return;
  }

  // 游戏中操作
  if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
    // 直写组件（setJumpBuffer 内部），不再需要"防下帧 hydrate 覆盖"补丁
    playerController.setJumpBuffer(PHYS[getMode()].jb);
  }

  // 注意：KeyR 已重排为「换弹」（S2）。换弹输入经 getLocalInputKeys 读取
  // keys.KeyR → InputKeys.reload，由武器系统消费按下沿，此处不再处理。
  // 手动复活移除：死亡走自动倒计时复活（tick 死亡分支）。

  // 数字键 1-9 / 0：选中背包槽位（10 格装备栏；第 10 格 = 0 键）
  if ((e.code >= 'Digit1' && e.code <= 'Digit9') || e.code === 'Digit0') {
    const slot = e.code === 'Digit0' ? MAX_BACKPACK - 1 : parseInt(e.code[5]) - 1; // 'Digit1' → 0
    playerController.setSelectedSlot(slot); // 直写组件
    gs.toast = '装备栏 ' + (slot + 1);
    gs.toastT = 1.2;
  }

  // E 键：检查点交互（按 E 激活附近的可交互检查点）
  if (e.code === 'KeyE') tryInteractCheckpoint();

  if (e.code === 'KeyP') {
    const cur = getMode();
    const next = cur === 'tuned' ? 'classic' : 'tuned';
    const old = PHYS[cur], nw = PHYS[next];
    playerController.scaleVerticalVelocity(nw.JV / old.JV); // 直写组件
    setMode(next);
    gs.toast = '物理 · ' + nw.name;
    gs.toastT = 2;
  }

  // 静音开关：走 Settings（持久化 + 分轨总线同步），不再直接改 AU.on
  if (e.code === 'KeyM') {
    const muted = !Settings.data.muted;
    Settings.set({ muted });
    gs.toast = muted ? '♪ 静音' : '♪ 恢复声音';
    gs.toastT = 2;
    if (!muted) resetMusicClock();
  }
}

/**
 * 滚轮切换背包选中槽位（仅游戏中消费；UI 场景滚轮由 UIManager 先行处理）。
 * 在整个装备栏（0..MAX_BACKPACK-1）间线性循环，空槽也滚动（与数字键直选一致）；
 * 始终消费滚轮（避免游戏中滚动页面）。
 */
export function handleWheel(deltaY: number): boolean {
  if (gs.screen !== 'playing') return false;
  const p = playerController.getState();
  const dir = deltaY > 0 ? 1 : -1; // 滚轮向下 = 下一格
  const next = (p.selectedSlot + dir + MAX_BACKPACK) % MAX_BACKPACK;
  playerController.setSelectedSlot(next); // 直写组件
  gs.toast = '装备栏 ' + (next + 1);
  gs.toastT = 1.2;
  return true;
}