/**
 * UI 场景组合根 —— 注册所有 UI 场景到 UIManager。
 * 不依赖 game 循环，通过回调注入防循环依赖。
 *
 * 问题 3：场景切换统一走唯一入口 ui.show(...)（内部写真源 gs.screen / gs.scene / 叠层栈）；
 * ui.currentName 为派生只读（栈顶叠层 ?? gs.scene），不再有 syncUI 的 if 推导。
 * instructions 弹窗为叠层（push/pop）；pause/dev 亦为叠层。
 * 预制体图鉴已迁移至 工具/gallery（单文件 HTML + sync-prefabs.mjs 同步脚本）。
 */
import type { GameState } from '../../types';
import { gs } from '../game/gameState';
import { startGame, startMultiplayerGame } from '../game';
import { ui } from '../../core/uiComponent';
import { buildMenuScene } from './menu';
import { buildPauseScene, syncPauseWidgets } from './pause';
import { buildLobbyScene, lobby } from './lobby';
import { buildDevScene } from './dev';
import { buildInstructionsScene } from './instructions';
import { buildSettingsScene } from './settings';
import { prepare, buildPrepareScene, buildMapSelectScene, buildCharSelectScene } from './prepare';
import { buildModeSelectScene } from './modeSelect';
import { net } from '../../net';
import { resetRoom, room } from '../../net/room';
import { resetRemotes } from '../player/remote';

/** 注册全部 UI 场景（由 main.ts 导入时副作用调用） */
export function registerUIScenes(): void {
  // 注入基础场景真源读写：UIManager 不直接依赖 gs（core 零业务依赖），经此绑定。
  // core 接口用宽类型（可含叠层名），此层收窄到 gs 的字面量联合 —— 依据 `ui.show()`
  // 只对基础场景写 scene（叠层仅压栈 + 可能改 screen），不会把叠层名写入 gs.scene。
  ui.bindSceneState({
    getScene: () => gs.scene,
    setScene: (name) => { gs.scene = name as GameState['scene']; },
    setScreen: (mode) => { if (mode !== null) gs.screen = mode as GameState['screen']; },
  });

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
      // 创建房间 → 先选玩法模式（普通 / 非对称对抗），再进创建表单
      prepare.mode = 'prepare';
      ui.show('modeSelect');
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

  // ── 模式选择（仅创建房间路径；选中后设置 prepare.gameMode → 创建表单）──
  ui.register(buildModeSelectScene({
    onSelect: (mode) => {
      prepare.gameMode = mode;
      lobby.mode = 'create';
      ui.show('lobby');
    },
    onBack: () => {
      prepare.mode = 'prepare';
      ui.show('prepare');
    },
  }));

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
