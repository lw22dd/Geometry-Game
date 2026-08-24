/**
 * mapCodec —— 数据契约：标准地图数据 ⇄ 游戏 MapDefinition。
 *
 * 「标准地图数据」= 版本化 JSON（MapData：实例列表），是编辑器的唯一产出物。
 * 本文件只有两个纯函数：
 *   - decompile(MapDefinition) → MapData   游戏现有地图 → 编辑器格式（可逆向编辑）
 *   - compile(MapData)         → MapDefinition  编辑器格式 → 游戏可消费格式
 *
 * 两个函数都只做数据变换，运行在编辑器内；
 * 对游戏侧仅 `import type`（编译期擦除，零运行时依赖），不修改游戏源码。
 */
import type { MapData, MapInstance } from './mapTypes';
import type {
  MapDefinition,
  MoverSpawnData,
  LaserSpawnData,
  SpringPadSpawnData,
  Spike,
  Rect,
} from '@game/types';

/* ==================== decompile：游戏 → 编辑器 ==================== */

/**
 * 将游戏现有的 MapDefinition（如 config/level.ts 中的地图）转换
 * 为编辑器的标准地图数据，使已有地图可以逆向编辑。
 */
export function decompileMapDefinition(def: MapDefinition): MapData {
  const instances: MapInstance[] = [];

  // ── 静态几何 ──
  for (const r of def.solids) {
    instances.push({ type: 'solid', x: r.x, y: r.y, w: r.w, h: r.h });
  }
  for (const s of def.spikes) {
    instances.push({ type: 'spike', x: s.x, y: s.y });
  }
  for (const d of def.decos) {
    instances.push({ type: 'deco', x: d[0], y: d[1], size: d[2], rotSpeed: d[3] });
  }
  for (const h of def.hints) {
    instances.push({ type: 'hint', x: h[0], y: h[1], text: h[2] });
  }

  // ── 实体生成描述 ──
  for (const m of def.entitySpawners.movers) {
    const inst: MapInstance = { type: 'mover', x0: m.x0, y: m.y, w: m.w, h: m.h, range: m.range, spd: m.spd, ph: m.ph };
    if (m.axis) (inst as any).axis = m.axis;
    if (m.yRange !== undefined) (inst as any).yRange = m.yRange;
    instances.push(inst);
  }
  for (const sp of def.entitySpawners.springPads) {
    instances.push({
      type: 'springPad', x: sp.x, y: sp.y, w: sp.w, h: sp.h,
      forceX: sp.forceX, forceY: sp.forceY, duration: sp.duration,
    });
  }
  for (const l of def.entitySpawners.lasers) {
    instances.push({ type: 'laser', x: l.x, y0: l.y0, len: l.len, ph: l.ph });
  }
  for (const o of def.entitySpawners.orbs) {
    instances.push({ type: 'orb', x: o[0], y: o[1] });
  }
  for (const jb of def.entitySpawners.jumpBoosts) {
    instances.push({ type: 'jumpBoost', x: jb[0], y: jb[1] });
  }
  for (const c of def.entitySpawners.checkpoints) {
    instances.push({ type: 'checkpoint', x: c[0], y: c[1] });
  }
  // nova（MapDefinition 是单数，编辑器是实例）
  const n = def.entitySpawners.nova;
  instances.push({ type: 'nova', x: n.x, y: n.y });

  return {
    version: 1,
    id: def.id,
    name: def.name,
    width: def.width,
    height: def.height,
    playerSpawn: { x: def.playerSpawn.x, y: def.playerSpawn.y },
    instances,
  };
}

/* ==================== compile：编辑器 → 游戏 ==================== */

/** 具名访问器：多数点状实例共享 x/y 字段 */
function xy(inst: MapInstance): { x: number; y: number } {
  switch (inst.type) {
    case 'solid':   return { x: inst.x, y: inst.y };
    case 'spike':   return { x: inst.x, y: inst.y };
    case 'deco':    return { x: inst.x, y: inst.y };
    case 'hint':    return { x: inst.x, y: inst.y };
    case 'mover':   return { x: inst.x0, y: inst.y };
    case 'laser':   return { x: inst.x, y: inst.y0 };
    case 'orb':     return { x: inst.x, y: inst.y };
    case 'jumpBoost': return { x: inst.x, y: inst.y };
    case 'checkpoint': return { x: inst.x, y: inst.y };
    case 'nova':    return { x: inst.x, y: inst.y };
    case 'springPad': return { x: inst.x, y: inst.y };
  }
}

/**
 * 将编辑器的标准地图数据编译为游戏可消费的 MapDefinition。
 * 输出的形状与 config/level.ts 中手写的地图完全一致。
 */
export function compileMapData(data: MapData): MapDefinition {
  const { instances } = data;

  // ── 静态几何 ──
  const solids: Rect[] = instances
    .filter((i): i is MapInstance & { type: 'solid'; w: number; h: number } => i.type === 'solid')
    .map(r => ({ x: r.x, y: r.y, w: r.w, h: r.h, top: r.y + r.h }));
  const spikes: Spike[] = instances
    .filter((i): i is MapInstance & { type: 'spike' } => i.type === 'spike')
    .map(s => ({ x: s.x, y: s.y }));
  const decos = instances
    .filter((i): i is MapInstance & { type: 'deco'; size: number; rotSpeed: number } => i.type === 'deco')
    .map(d => [d.x, d.y, d.size, d.rotSpeed] as [number, number, number, number]);
  const hints = instances
    .filter((i): i is MapInstance & { type: 'hint'; text: string } => i.type === 'hint')
    .map(h => [h.x, h.y, h.text] as [number, number, string]);

  // ── 实体生成描述 ──
  const movers: MoverSpawnData[] = instances
    .filter((i): i is MapInstance & { type: 'mover' } => i.type === 'mover')
    .map(m => {
      const base: MoverSpawnData = {
        x0: m.x0, y: m.y, w: m.w, h: m.h,
        range: m.range, spd: m.spd, ph: m.ph,
      };
      if (m.axis) base.axis = m.axis;
      if (m.yRange !== undefined) base.yRange = m.yRange;
      return base;
    });
  const springPads: SpringPadSpawnData[] = instances
    .filter((i): i is MapInstance & { type: 'springPad' } => i.type === 'springPad')
    .map(s => ({
      x: s.x, y: s.y, w: s.w, h: s.h,
      forceX: s.forceX, forceY: s.forceY, duration: s.duration,
    }));
  const lasers: LaserSpawnData[] = instances
    .filter((i): i is MapInstance & { type: 'laser' } => i.type === 'laser')
    .map(l => ({ x: l.x, y0: l.y0, len: l.len, ph: l.ph }));
  const orbs: [number, number][] = instances
    .filter((i): i is MapInstance & { type: 'orb' } => i.type === 'orb')
    .map(o => [o.x, o.y]);
  const jumpBoosts: [number, number][] = instances
    .filter((i): i is MapInstance & { type: 'jumpBoost' } => i.type === 'jumpBoost')
    .map(j => [j.x, j.y]);
  const checkpoints: [number, number][] = instances
    .filter((i): i is MapInstance & { type: 'checkpoint' } => i.type === 'checkpoint')
    .map(c => [c.x, c.y]);
  const novaInstances = instances.filter(i => i.type === 'nova');
  const nova = novaInstances.length > 0
    ? xy(novaInstances[0])
    : { x: 0, y: 0 };

  return {
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
}

/* ==================== 自检：round-trip 验证 ==================== */

export interface RoundTripReport {
  ok: boolean;
  instanceCount: number;
  differences: string[];
}

/**
 * round-trip 验证：MapDefinition → decompile → compile → 与原定义比较。
 * 用于确认数据契约无损（供启动时自检 / 测试）。
 */
export function verifyRoundTrip(def: MapDefinition): RoundTripReport {
  const diffs: string[] = [];
  const data = decompileMapDefinition(def);
  const compiled = compileMapData(data);

  const push = (label: string, a: unknown, b: unknown): void => {
    const ja = JSON.stringify(a);
    const jb = JSON.stringify(b);
    if (ja !== jb) diffs.push(`${label}: 原 ${ja} ≠ 编译 ${jb}`);
  };

  push('id', def.id, compiled.id);
  push('name', def.name, compiled.name);
  push('width', def.width, compiled.width);
  push('height', def.height, compiled.height);
  push('playerSpawn', def.playerSpawn, compiled.playerSpawn);
  push('solids', def.solids, compiled.solids);
  push('spikes', def.spikes, compiled.spikes);
  push('decos', def.decos, compiled.decos);
  push('hints', def.hints, compiled.hints);
  push('movers', def.entitySpawners.movers, compiled.entitySpawners.movers);
  push('springPads', def.entitySpawners.springPads, compiled.entitySpawners.springPads);
  push('lasers', def.entitySpawners.lasers, compiled.entitySpawners.lasers);
  push('orbs', def.entitySpawners.orbs, compiled.entitySpawners.orbs);
  push('jumpBoosts', def.entitySpawners.jumpBoosts, compiled.entitySpawners.jumpBoosts);
  push('checkpoints', def.entitySpawners.checkpoints, compiled.entitySpawners.checkpoints);
  push('nova', def.entitySpawners.nova, compiled.entitySpawners.nova);

  return {
    ok: diffs.length === 0,
    instanceCount: data.instances.length,
    differences: diffs,
  };
}