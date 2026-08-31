/**
 * 生命周期（进场流程）—— applyLevel / startGame / startMultiplayerGame。
 * 从原 game/index.ts 上帝模块拆出：切图进场串联 + 单机/联机开始。
 */
import { currentMap, setupLevel } from '../../config';
import { VW, VH, PPM } from '../../core/canvas';
import { cam, view } from '../../core/camera';
import { gs } from './gameState';
import { prepare } from '../ui/prepare';
import { ui } from '../../core/uiComponent';
import { playerController } from '../player';
import { ensurePlayerEntity } from '../player/playerEntity';
import { resetAuraState } from '../level/AuraSystem';
import { clearProjectiles } from '../combat';
import { clearEnemyRocks, spawnLevelEnemies } from '../enemy';
import { resetCipherSpark, resetChestState } from '../interactions';
import { room, isHost } from '../../net/room';
import { net } from '../../net';
import { resetRemotes } from '../player/remote';

/**
 * 切图进场串联（单机/房主/客机共用）：
 * 清空旧 ECS 实体 → loadMap(id) → 重建实体 → 玩家复位 → gs 复位 → 相机复位。
 */
export function applyLevel(mapId: string): void {
  setupLevel(mapId);
  resetAuraState(); // 光环进出/周期状态随切图清空
  const sp = currentMap.playerSpawn;
  playerController.resetToSpawn(sp.x, sp.y);
  // 玩家 ECS 实体：setupLevel 已 clearWorld + initEcs，这里重建并同步出生点
  ensurePlayerEntity(room.playerId);
  playerController.flush(); // 初始化写回（实体新建，全字段落位）
  // 清空旧抛体 + 敌人石头（切图重建；clearWorld 已移除实体，防御性清理）
  clearProjectiles();
  clearEnemyRocks();
  // 敌人：房主/单机进程模拟并本地生成；客机为接收事件的木偶，不本地生成（S3/S4）
  if (room.role !== 'client') {
    spawnLevelEnemies(currentMap.entitySpawners.enemies ?? []);
  }
  // gs 计数/计时复位
  gs.gt = 0;
  gs.gotN = 0;
  gs.deaths = 0;
  gs.win = false;
  gs.winTime = 0;
  gs.toast = '';
  gs.toastT = 0;
  // 密码机世界状态：总数由地图装配写入（已完成数派生自 ECS，无需复位计数）
  gs.cipherTotal = currentMap.entitySpawners.ciphers?.length ?? 0;
  resetCipherSpark();
  resetChestState(); // 宝箱就绪边沿表随切图清空（实体 eid 失效）
  // 相机复位到出生点（避免镜头从旧图边界缓移）
  cam.x = sp.x;
  cam.y = sp.y + 3;
  const vwp = VW / (PPM * view.zoom);
  const vhp = VH / (PPM * view.zoom);
  view.SL = cam.x - vwp / 2;
  view.SB = cam.y - vhp / 2;
}

/** 单机开始（准备界面确认后立即进场，用当前所选地图） */
export function startGame(): void {
  prepare.mode = 'prepare';
  applyLevel(prepare.mapId);
  // 唯一写入口：进入游戏画面（清叠层 + 写真源 gs.screen/gs.scene）。
  // 切勿在此直接写 gs.scene —— 那会让 UIManager 的激活场景与真源失同步，
  // 表现为「画面是游戏、点击却命中菜单按钮」。
  ui.show(null);
  gs.started = true;
  if (isHost()) {
    // 房主模式下，重置远程玩家
    resetRemotes();
  }
}

/** 联机房主开始：广播所选地图（level 事件）→ 稍候本地进场 */
export function startMultiplayerGame(): void {
  if (!isHost()) return;
  net.sendHostEvent('level', { mapId: prepare.mapId });
  // 给客机留出「收到 level → 重建世界」的时间，避免双方世界不一致
  setTimeout(() => startGame(), 350);
}