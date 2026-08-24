/**
 * mapCodec —— 数据契约：标准地图数据 v2 ⇄ 游戏 MapDefinition。
 *
 * 两层结构：
 *   - layers.geometry（rect + rotation）→ 游戏的 solids（仅 rotation≈0）
 *   - layers.objects → 游戏的 spikes/decos/hints/entitySpawners
 *
 * 注意：游戏当前不支持旋转矩形（rect 无 rotation 字段）——
 * rotation≠0 的矩形在编译时跳过并计入警告，但标准 JSON 完整保留。
 */
import type { MapData, GeometryItem, ObjectInstance } from './mapTypes';
import { createEmptyMapData, migrateMapData } from './mapTypes';
import type {
  MapDefinition,
  MoverSpawnData,
  LaserSpawnData,
  SpringPadSpawnData,
  Spike,
  Rect,
} from '@game/types';

/* ==================== decompile：游戏 → 编辑器 v2 ==================== */

/**
 * 将游戏现有的 MapDefinition（如 config/level.ts 中的地图）转换
 * 为编辑器的标准地图数据 v2，使已有地图可以逆向编辑。
 */
export function decompileMapDefinition(def: MapDefinition): MapData {
  const data = createEmptyMapData(def.id, def.name);
  data.width = def.width;
  data.height = def.height;
  data.playerSpawn = { x: def.playerSpawn.x, y: def.playerSpawn.y };

  // ── 静态几何 → geometry 层 ──
  for (const r of def.solids) {
    data.layers.geometry.push({ type: 'rect', x: r.x, y: r.y, w: r.w, h: r.h, rotation: 0 });
  }

  // ── 其余 → objects 层 ──
  for (const s of def.spikes) {
    data.layers.objects.push({ type: 'spike', x: s.x, y: s.y });
  }
  for (const d of def.decos) {
    data.layers.objects.push({ type: 'deco', x: d[0], y: d[1], size: d[2], rotSpeed: d[3] });
  }
  for (const h of def.hints) {
    data.layers.objects.push({ type: 'hint', x: h[0], y: h[1], text: h[2] });
  }
  for (const m of def.entitySpawners.movers) {
    const inst: ObjectInstance = {
      type: 'mover', x0: m.x0, y: m.y, w: m.w, h: m.h,
      range: m.range, spd: m.spd, ph: m.ph,
    };
    if (m.axis) (inst as any).axis = m.axis;
    if (m.yRange !== undefined) (inst as any).yRange = m.yRange;
    data.layers.objects.push(inst);
  }
  for (const sp of def.entitySpawners.springPads) {
    data.layers.objects.push({
      type: 'springPad', x: sp.x, y: sp.y, w: sp.w, h: sp.h,
      force: sp.force, duration: sp.duration,
    });
  }
  for (const l of def.entitySpawners.lasers) {
    data.layers.objects.push({ type: 'laser', x: l.x, y0: l.y0, len: l.len, ph: l.ph });
  }
  for (const o of def.entitySpawners.orbs) {
    data.layers.objects.push({ type: 'orb', x: o[0], y: o[1] });
  }
  for (const jb of def.entitySpawners.jumpBoosts) {
    data.layers.objects.push({ type: 'jumpBoost', x: jb[0], y: jb[1] });
  }
  for (const c of def.entitySpawners.checkpoints) {
    data.layers.objects.push({ type: 'checkpoint', x: c[0], y: c[1] });
  }
  const n = def.entitySpawners.nova;
  data.layers.objects.push({ type: 'nova', x: n.x, y: n.y });

  return data;
}

/* ==================== compile：编辑器 v2 → 游戏 ==================== */

function hasRotation(item: GeometryItem): boolean {
  return item.type === 'rect' && Math.abs(item.rotation) > 1e-6;
}

/**
 * 将编辑器的标准地图数据编译为游戏可消费的 MapDefinition。
 * rotation≈0 的矩形 → solids；rotation≠0 的跳过（计入 skippedRotated）。
 */
export function compileMapData(data: MapData): {
  map: MapDefinition;
  skippedRotated: number;
} {
  const { geometry, objects } = data.layers;

  const solids: Rect[] = [];
  let skippedRotated = 0;
  for (const g of geometry) {
    if (g.type !== 'rect') continue;
    if (hasRotation(g)) {
      skippedRotated++;
      continue;
    }
    solids.push({ x: g.x, y: g.y, w: g.w, h: g.h, top: g.y + g.h });
  }

  const spikes: Spike[] = [];
  const decos: [number, number, number, number][] = [];
  const hints: [number, number, string][] = [];
  const movers: MoverSpawnData[] = [];
  const springPads: SpringPadSpawnData[] = [];
  const lasers: LaserSpawnData[] = [];
  const orbs: [number, number][] = [];
  const jumpBoosts: [number, number][] = [];
  const checkpoints: [number, number][] = [];
  let nova: { x: number; y: number } = { x: 0, y: 0 };

  for (const inst of objects) {
    switch (inst.type) {
      case 'spike': spikes.push({ x: inst.x, y: inst.y }); break;
      case 'deco': decos.push([inst.x, inst.y, inst.size, inst.rotSpeed]); break;
      case 'hint': hints.push([inst.x, inst.y, inst.text]); break;
      case 'mover': {
        const base: MoverSpawnData = {
          x0: inst.x0, y: inst.y, w: inst.w, h: inst.h,
          range: inst.range, spd: inst.spd, ph: inst.ph,
        };
        if (inst.axis) base.axis = inst.axis;
        if (inst.yRange !== undefined) base.yRange = inst.yRange;
        movers.push(base);
        break;
      }
      case 'springPad':
        springPads.push({
          x: inst.x, y: inst.y, w: inst.w, h: inst.h,
          force: inst.force, duration: inst.duration,
        });
        break;
      case 'laser': lasers.push({ x: inst.x, y0: inst.y0, len: inst.len, ph: inst.ph }); break;
      case 'orb': orbs.push([inst.x, inst.y]); break;
      case 'jumpBoost': jumpBoosts.push([inst.x, inst.y]); break;
      case 'checkpoint': checkpoints.push([inst.x, inst.y]); break;
      case 'nova': nova = { x: inst.x, y: inst.y }; break;
    }
  }

  const map: MapDefinition = {
    id: data.id,
    name: data.name,
    width: data.width,
    height: data.height,
    playerSpawn: { x: data.playerSpawn.x, y: data.playerSpawn.y },
    solids,
    spikes,
    decos,
    hints,
    entitySpawners: {
      movers,
      springPads,
      lasers,
      orbs,
      jumpBoosts,
      checkpoints,
      nova,
    },
  };

  return { map, skippedRotated };
}

/* ==================== 自检：round-trip 验证 ==================== */

export interface RoundTripReport {
  ok: boolean;
  objectCount: number;
  differenceCount: number;
  differences: string[];
}

const PUSH = (diffs: string[], label: string, a: unknown, b: unknown): void => {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    diffs.push(`${label}: 原 ${JSON.stringify(a)} ≠ 编译 ${JSON.stringify(b)}`);
  }
};

/**
 * round-trip 验证：MapDefinition → decompile(v2) → compile → 与原定义比较。
 * 现有地图全为 rotation=0，应无损通过。
 */
export function verifyRoundTrip(def: MapDefinition): RoundTripReport {
  const diffs: string[] = [];
  const data = decompileMapDefinition(def);
  const compiled = compileMapData(data).map;

  PUSH(diffs, 'id', def.id, compiled.id);
  PUSH(diffs, 'name', def.name, compiled.name);
  PUSH(diffs, 'width', def.width, compiled.width);
  PUSH(diffs, 'height', def.height, compiled.height);
  PUSH(diffs, 'playerSpawn', def.playerSpawn, compiled.playerSpawn);
  PUSH(diffs, 'solids', def.solids, compiled.solids);
  PUSH(diffs, 'spikes', def.spikes, compiled.spikes);
  PUSH(diffs, 'decos', def.decos, compiled.decos);
  PUSH(diffs, 'hints', def.hints, compiled.hints);
  PUSH(diffs, 'movers', def.entitySpawners.movers, compiled.entitySpawners.movers);
  PUSH(diffs, 'springPads', def.entitySpawners.springPads, compiled.entitySpawners.springPads);
  PUSH(diffs, 'lasers', def.entitySpawners.lasers, compiled.entitySpawners.lasers);
  PUSH(diffs, 'orbs', def.entitySpawners.orbs, compiled.entitySpawners.orbs);
  PUSH(diffs, 'jumpBoosts', def.entitySpawners.jumpBoosts, compiled.entitySpawners.jumpBoosts);
  PUSH(diffs, 'checkpoints', def.entitySpawners.checkpoints, compiled.entitySpawners.checkpoints);
  PUSH(diffs, 'nova', def.entitySpawners.nova, compiled.entitySpawners.nova);

  return {
    ok: diffs.length === 0,
    objectCount: data.layers.geometry.length + data.layers.objects.length,
    differenceCount: diffs.length,
    differences: diffs,
  };
}

// 保留 migrateMapData 的再导出（io.ts 使用）
export { migrateMapData };