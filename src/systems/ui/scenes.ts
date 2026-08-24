/**
 * UI 场景组合根 —— 注册所有 UI 场景到 UIManager。
 * 不依赖 game 循环，通过回调注入防循环依赖。
 */
import { gs } from '../game/gameState';
import { startGame, startMultiplayerGame } from '../game';
import { ui } from '../../core/uiComponent';
import { buildMenuScene } from './menu';
import { buildPauseScene, syncPauseWidgets } from './pause';
import { buildLobbyScene, lobby } from './lobby';
import { buildDevScene } from './dev';
import { buildGalleryScene, gallery, closeGallery } from './gallery';
import { buildInstructionsScene, instructions, closeInstructions } from './instructions';
import { prepare, buildPrepareScene, buildMapSelectScene, buildCharSelectScene } from './prepare';
import { net } from '../../net';
import { resetRoom, room } from '../../net/room';
import { resetRemotes } from '../player/remote';

/** 注册全部 UI 场景（由 main.ts 导入时副作用调用） */
export function registerUIScenes(): void {
  // ── 菜单场景（开始游戏 → 准备界面）──
  ui.register(buildMenuScene(() => {
    gs.screen = 'prepare';
    prepare.mode = 'prepare';
  }));

  // ── 暂停场景 ──
  const _pauseScene = buildPauseScene({
    onResume: () => {
      gs.screen = 'playing';
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
    onReturnToMenu: () => {
      // 联机中断开并复位房间
      if (room.connected) {
        net.disconnect();
        resetRoom();
        resetRemotes();
      }
      gs.screen = 'menu';
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
    onStartGame: () => {
      if (room.role === 'host') {
        // 房主：广播所选地图并稍候进场
        startMultiplayerGame();
      }
      // 客机：无需此动作（由 level 事件驱动进入游戏）
    },
    onBack: () => {
      lobby.mode = 'none';
      ui.show('pause');
    },
  }));

  // ── 准备界面（选图/选人）与两个选择子页 ──
  ui.register(buildPrepareScene({
    onStart: () => {
      startGame();
    },
    onCreateRoom: () => {
      lobby.mode = 'create';
      ui.show('lobby');
    },
    onJoinRoom: () => {
      lobby.mode = 'join';
      ui.show('lobby');
    },
    onBack: () => {
      gs.screen = 'menu';
    },
  }));
  ui.register(buildMapSelectScene(() => { prepare.mode = 'prepare'; }));
  ui.register(buildCharSelectScene(() => { prepare.mode = 'prepare'; }));

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

  // 大厅模式（创建/加入/房间中）优先于 prepare 路由
  if (lobby.mode !== 'none') {
    if (ui.currentName !== 'lobby') ui.show('lobby');
    return;
  }

  // 准备流程（选图/选人）路由
  if (gs.screen === 'prepare') {
    const target = prepare.mode === 'maps' ? 'mapSelect'
      : prepare.mode === 'chars' ? 'charSelect'
      : 'prepare';
    if (ui.currentName !== target) ui.show(target);
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