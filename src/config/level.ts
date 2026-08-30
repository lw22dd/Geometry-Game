/**
 * 关卡布局注册表 —— 多地图描述符。
 * 每张地图 = 静态几何（solids/spikes/decos/hints）+ 实体生成描述（movers/lasers/orbs/checkpoints/nova）。
 * 只依赖 types（及 physics 的 MAP 常量）。
 *
 * 各张地图数据已拆分到 level/ 目录，每张地图一个文件：
 *   - level/neonAscent.ts       霓虹攀升
 *   - level/crystalCaverns.ts   水晶洞窟 · 对称迷城
 *   - level/mapVrg5wrvjcd.ts    未命名地图
 *   - level/mvmap2dMapDesign.ts 2D地图设计 · 底图
 *   - level/mvmapPlatformTree.ts 2D地图设计2-1 平台树
 */
import type { MapDefinition } from '../types';
import { initEcs, clearWorld } from '../core/ecs';
import {
  createOrb, createJumpBoost, createCheckpoint, createNova, createMovingPlatform,
  createSpringPad, createLaser, createSpike, createLoopTrack, createHookPickup, createShieldPickup, createSpeedPickup,
  createRecallPickup, createWeaponPickup, createCipherMachine, createChest,
} from '../Prefabs/Scenes/sceneFactory';
import { neonAscentMap } from './level/neonAscent';
import { crystalCavernsMap } from './level/crystalCaverns';
import { mapVrg5wrvjcd } from './level/mapVrg5wrvjcd';
import { mvmap2dMapDesign } from './level/mvmap2dMapDesign';
import { mvmapPlatformTree } from './level/mvmapPlatformTree';

/** 地图注册表 */
export const maps: MapDefinition[] = [
  neonAscentMap,
  crystalCavernsMap,
  mapVrg5wrvjcd,
  mvmap2dMapDesign,
  mvmapPlatformTree,
];

/** 当前地图（切图时通过 loadMap 切换） */
export let currentMap: MapDefinition = maps[0];

/** 当前检查点（复活点），初始为当前地图出生点 */
export const cpPoint = { x: 6, y: 4 };

/** 切换地图（数据层：替换 currentMap 引用；实体重建由调用方处理） */
export function loadMap(id: string): MapDefinition {
  const next = maps.find(m => m.id === id);
  if (!next) throw new Error('Unknown map id: ' + id);
  currentMap = next;
  cpPoint.x = next.playerSpawn.x;
  cpPoint.y = next.playerSpawn.y;
  return next;
}

/**
 * 切换并重建关卡（切图串联：清空世界 → 数据层切图 → 重建实体）。
 * 玩家复位 / gs 计数复位 / 相机复位由 game 层 applyLevel 统一处理，
 * 保证「清空旧 ECS 实体 + loadMap(id) + initECSFromLevel() + 玩家复位」的完整链路。
 */
export function setupLevel(mapId: string): void {
  clearWorld();
  loadMap(mapId);
  initECSFromLevel();
}

/**
 * 从当前地图初始化 ECS 实体（组合根，由 main.ts 调用一次）。
 * 创建玩家实体 + 移动平台 + 激光 + 光球 + 检查点 + NOVA 星。
 */
export function initECSFromLevel(): void {
  initEcs();
  const s = currentMap.entitySpawners;
  for (const m of s.movers) createMovingPlatform(m);
  for (const sp of s.springPads) createSpringPad(sp);
  for (const l of s.lasers) createLaser(l);
  for (let i = 0; i < s.orbs.length; i++) {
    createOrb(s.orbs[i][0], s.orbs[i][1], i * 1.7);
  }
  for (const [x, y] of s.jumpBoosts) {
    createJumpBoost(x, y, 0);
  }
  // 钩锁道具（地图数据驱动；无 hooks 字段的地图自然不带钩锁）
  for (const [x, y] of s.hooks ?? []) {
    createHookPickup(x, y, 0);
  }
  // 护盾道具（地图数据驱动；无 shields 字段的地图自然不带护盾）
  for (const [x, y] of s.shields ?? []) {
    createShieldPickup(x, y, 0);
  }
  // 加速道具（地图数据驱动；无 speeds 字段的地图自然不带加速）
  for (const [x, y] of s.speeds ?? []) {
    createSpeedPickup(x, y, 0);
  }
  // 重置箭头（地图数据驱动；无 recalls 字段的地图自然不带重置箭头）
  for (const [x, y] of s.recalls ?? []) {
    createRecallPickup(x, y, 0);
  }
  // 武器拾取物（地图数据驱动；无 weapons 字段的地图玩家无武器，需先拾取）
  for (const w of s.weapons ?? []) {
    createWeaponPickup(w.x, w.y, w.kind, 0);
  }
  // 密码机（地图数据驱动；无 ciphers 字段的地图自然不带密码机）
  for (const [x, y] of s.ciphers ?? []) {
    createCipherMachine(x, y);
  }
  // 宝箱（地图数据驱动；type 0=武器宝箱 1=道具宝箱；无 chests 字段的地图自然不带宝箱）
  for (const c of s.chests ?? []) {
    createChest(c.x, c.y, c.type);
  }
  for (const [x, y] of s.checkpoints) {
    createCheckpoint(x, y);
  }
  createNova(s.nova.x, s.nova.y);
  // 尖刺（静态几何 → ECS 实体）
  for (const sp of currentMap.spikes) {
    createSpike(sp.x, sp.y);
  }
  // 冲刺轨道（地图数据驱动；无 tracks 字段的地图自然不带轨道）
  for (const t of s.tracks ?? []) {
    createLoopTrack(t.segments, t.entryDist, t.exitDist, t.speedThreshold);
  }
}
