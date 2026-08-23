/**
 * UI 场景组合根 —— 注册所有 UI 场景到 UIManager。
 * 不依赖 game 循环，通过回调注入防循环依赖。
 */
import { gs } from '../game/gameState';
import { startGame } from '../game';
import { ui } from '../../core/uiComponent';
import { buildMenuScene } from './index';
import { buildPauseScene, syncPauseWidgets } from './pause';
import { buildLobbyScene, lobby } from './lobby';
import { buildDevScene } from './dev';
import { buildGalleryScene, gallery, closeGallery } from './gallery';
import { buildInstructionsScene, instructions, closeInstructions } from './instructions';
import { net } from '../../net';
import { resetRoom } from '../../net/room';
import { resetRemotes } from '../player/remote';

/** 注册全部 UI 场景（由 main.ts 导入时副作用调用） */
export function registerUIScenes(): void {
  // ── 菜单场景 ──
  ui.register(buildMenuScene(() => {
    startGame();
  }));

  // ── 暂停场景 ──
  const _pauseScene = buildPauseScene({
    onResume: () => {
      gs.screen = 'playing';
    },
    onCreateRoom: () => {
      lobby.mode = 'create';
      ui.show('lobby');
    },
    onJoinRoom: () => {
      lobby.mode = 'join';
      ui.show('lobby');
    },
    onDisconnect: () => {
      net.disconnect();
      resetRoom();
      resetRemotes();
      gs.screen = 'playing';
    },
    onDevSettings: () => {
      ui.show('dev');
    },
  });
  ui.register(_pauseScene);

  // ── 开发者设置场景 ──
  ui.register(buildDevScene({
    onBack: () => {
      ui.show('pause');
    },
  }));

  // ── 预制体图鉴场景 ──
  ui.register(buildGalleryScene({
    onBack: () => {
      closeGallery();
      ui.show('menu');
    },
  }));

  // ── 操作说明弹窗场景 ──
  ui.register(buildInstructionsScene({
    onBack: () => {
      closeInstructions();
      ui.show('menu');
    },
  }));

  // ── 大厅场景 ──
  ui.register(buildLobbyScene({
    onEnterGame: () => {
      lobby.mode = 'none';
      gs.screen = 'playing';
    },
    onBack: () => {
      lobby.mode = 'none';
      ui.show('pause');
    },
  }));

  // 初始场景：菜单
  ui.show('menu');
}

/**
 * UI 同步 —— 每帧在 render 顶部调用。
 * 根据 gs.screen + lobby 状态自动切换当前 UI 场景。
 */
export function syncUI(): void {
  // 图鉴 / 操作说明弹窗优先
  if (gallery.open || instructions.open) {
    const target = gallery.open ? 'gallery' : 'instructions';
    if (ui.currentName !== target) ui.show(target);
    return;
  }

  if (lobby.mode !== 'none') {
    // 大厅模式（创建/加入）
    if (ui.currentName !== 'lobby') ui.show('lobby');
    return;
  }
  switch (gs.screen) {
    case 'menu':
      if (ui.currentName !== 'menu') ui.show('menu');
      break;
    case 'paused':
      // pause / dev 都挂在暂停状态上
      if (ui.currentName !== 'pause' && ui.currentName !== 'dev') ui.show('pause');
      if (ui.currentName === 'pause') {
        // 联机状态变化时同步按钮可见性
        syncPauseWidgets(ui.currentScene!);
      }
      break;
    default:
      // playing / 其他 → 无 UI 覆盖
      if (ui.currentName !== null) ui.show(null);
      break;
  }
}