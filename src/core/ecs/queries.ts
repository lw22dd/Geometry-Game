/**
 * 常用查询 —— 缓存组件引用，按语义命名。
 * 每个查询都是 `query(world, terms)` 的直接调用（bitECS 会内部缓存）。
 * 查询结果按实体 ID 升序返回；同一帧内多次查询结果一致。
 */
import { query, getAllEntities, type World } from 'bitecs';
import {
  Position, Velocity, Collider, PathMotion, SpringPad, Timer, Hazard, Health,
  Collectible, Cipher, Chest, Loot, RespawnPoint, Goal, Track, Aura, Renderable, Animator, Hookable,
  Player, PlayerControl, PlayerInput, Orb, JumpBoost, Hook, ShieldPickup, SpeedPickup, WeaponPickup, Backpack,
  Projectile, EnemyRock, EnemyBrain,
} from './components';
import { world } from './World';

export type W = World;
/** 查询结果（默认非 buffered：普通 EntityId[]） */
type Q = readonly number[];

/** 本地/全部玩家实体 */
export const qPlayers = (): Q => query(world, [Position, Velocity, Collider, PlayerControl, Player]) as Q;
export const qLocalPlayer = (): Q => query(world, [Position, Velocity, Collider, PlayerControl, Player, PlayerInput]) as Q;

/** 场景实体 */
export const qMovers = (): Q => query(world, [Position, Collider, PathMotion]) as Q;
export const qSpringPads = (): Q => query(world, [Position, Collider, SpringPad]) as Q;
export const qSpringAll = (): Q => query(world, [SpringPad]) as Q;
export const qTimers = (): Q => query(world, [Timer]) as Q;
export const qHazards = (): Q => query(world, [Position, Collider, Hazard]) as Q;
/** 有生命值的实体（敌人 / 可摧毁物；不含玩家） */
export const qHealth = (): Q => query(world, [Health]) as Q;
/** 可被伤害的实体（生命 + 碰撞体，供投射物 / 爆炸查询） */
export const qDamageable = (): Q => query(world, [Position, Collider, Health]) as Q;
export const qLasers = (): Q => query(world, [Position, Collider, Timer, Hazard]) as Q;
export const qTracks = (): Q => query(world, [Position, Track]) as Q;
export const qAuras = (): Q => query(world, [Position, Aura]) as Q;
export const qHookTargets = (): Q => query(world, [Position, Collider, Hookable]) as Q;
export const qCheckpoints = (): Q => query(world, [Position, Collider, RespawnPoint]) as Q;
export const qGoal = (): Q => query(world, [Position, Collider, Goal]) as Q;

/** 密码机（第五人格式交互物） */
export const qCiphers = (): Q => query(world, [Position, Collider, Cipher]) as Q;

/** 宝箱（场景交互物：冷却/可开启/开启中状态机） */
export const qChests = (): Q => query(world, [Position, Collider, Chest]) as Q;

/** 掉落物（宝箱掉落的临时可拾取物；带 lifetime 自动销毁） */
export const qLoot = (): Q => query(world, [Position, Collider, Loot]) as Q;

/** 可收集物（tag 区分类型） */
export const qCollectibles = (): Q => query(world, [Position, Collider, Collectible]) as Q;
export const qOrbs = (): Q => query(world, [Position, Collider, Collectible, Orb]) as Q;
export const qJumpBoosts = (): Q => query(world, [Position, Collider, Collectible, JumpBoost]) as Q;
export const qHooks = (): Q => query(world, [Position, Collider, Collectible, Hook]) as Q;
export const qShields = (): Q => query(world, [Position, Collider, Collectible, ShieldPickup]) as Q;
export const qSpeeds = (): Q => query(world, [Position, Collider, Collectible, SpeedPickup]) as Q;
export const qWeaponPickups = (): Q => query(world, [Position, Collider, Collectible, WeaponPickup]) as Q;

/** 动画 */
export const qAnimators = (): Q => query(world, [Position, Animator]) as Q;

/** 抛体（手雷等） */
export const qProjectiles = (): Q => query(world, [Position, Projectile]) as Q;
/** 敌人投石（大猩猩远程攻击） */
export const qEnemyRocks = (): Q => query(world, [Position, EnemyRock]) as Q;
/** 敌人实体（位置 + 生命 + 大脑） */
export const qEnemies = (): Q => query(world, [Position, Collider, Health, EnemyBrain]) as Q;

/** 全部实体（清场/调试用） */
export const qAll = (): Q => getAllEntities(world) as Q;