/**
 * UI 场景组合根 —— 注册所有 UI 场景到 UIManager。
 * 不依赖 game 循环，通过回调注入防循环依赖。
 *
 * 问题 3：场景切换统一走唯一入口 ui.show(...)（内部写真源 gs.screen / gs.scene / 叠层栈）；
 * ui.currentName 为派生只读（栈顶叠层 ?? gs.scene），不再有 syncUI 的 if 推导。
 * gallery / instructions 弹窗为叠层（push/pop）；pause/dev 亦为叠层。
 */
import { gs } from '../game/gameState';
import { startGame, startMultiplayerGame } from '../game';
import { ui } from '../../core/uiComponent';
import { buildMenuScene } from './menu';
import { buildPauseScene, syncPauseWidgets } from './pause';
import { buildLobbyScene, lobby } from './lobby';
import { buildDevScene } from './dev';
import { buildGalleryScene } from './gallery';
import { buildInstructionsScene } from './instructions';
import { buildSettingsScene } from './settings';
import { prepare, buildPrepareScene, buildMapSelectScene, buildCharSelectScene } from './prepare';
import { net } from '../../net';
import { resetRoom, room } from '../../net/room';
import { resetRemotes } from '../player/remote';

/** 注册全部 UI 场景（由 main.ts 导入时副作用调用） */
export function registerUIScenes(): void {
  // ── 菜单场景（开始游戏 → 准备界面）──
  ui.register(buildMenuScene(() => {
    prepare.mode = 'prepare';
    ui.show('prepare');
  }));

  // ── 暂停场景（叠层：覆盖 playing）──
  ui.register(buildPauseScene({
    onResume: () => {
      ui.show(null);
    },
    onDisconnect: () => {
      net.disconnect();
      resetRoom();
      resetRemotes();
      ui.show(null);
    },
    onDevSettings: () => {
      ui.pushOverlay('dev');
    },
    onReturnToMenu: () => {
      // 联机中断开并复位房间
      if (room.connected) {
        net.disconnect();
        resetRoom();
        resetRemotes();
      }
      ui.show('menu');
    },
  }));

  // ── 设置场景（叠层：音量 / 后期 / 画质档位）──
  ui.register(buildSettingsScene({
    onBack: () => {
      ui.popOverlay();
    },
  }));

  // ── 开发者设置场景（叠层：覆盖 pause）──
  ui.register(buildDevScene({
    onBack: () => {
      ui.popOverlay();
    },
  }));

  // ── 预制体图鉴场景（叠层：覆盖当前基础场景）──
  ui.register(buildGalleryScene({
    onBack: () => {
      ui.popOverlay();
    },
  }));

  // ── 操作说明弹窗场景（叠层：覆盖当前基础场景）──
  ui.register(buildInstructionsScene({
    onBack: () => {
      ui.popOverlay();
    },
  }));

  // ── 大厅场景（基础场景：lobby）──
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
      ui.show('prepare');
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
      ui.show('menu');
    },
  }));
  ui.register(buildMapSelectScene(() => { prepare.mode = 'prepare'; ui.show('prepare'); }));
  ui.register(buildCharSelectScene(() => { prepare.mode = 'prepare'; ui.show('prepare'); }));

  // 初始场景：菜单
  ui.show('menu');
}

/**
 * UI 同步（缩减版）——场景切换已由 ui.show 唯一入口 + 派生 currentName 承担；
 * 此处仅保留暂停场景的房间状态组件同步（连接/断开按钮可见性随房间状态实时更新）。
 */
export function syncUI(): void {
  if (gs.screen === 'paused' && ui.currentName === 'pause') {
    syncPauseWidgets(ui.currentScene!);
  }
}
