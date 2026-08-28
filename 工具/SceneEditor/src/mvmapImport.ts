/**
 * mvmapImport —— 从 MVMap（Metroidvania Map Editor）导入结构底盘。
 *
 * 【语义（模式 A · 恶魔城/银河城）】
 *   · MVMap 里的「色块」= 区域（房间/走廊/可行走带），不是墙！
 *     底图编辑器绘制的是「可行走空间」，黑块（未涂色格）= 建筑障碍。
 *   · 因此导入时：
 *       - 房间 cells            → 可行走区（floorCells 视觉层 + 可走判定）
 *       - 包围盒内未涂色格        → 墙（geometry / solids，碰撞体）
 *       - 门（door）             → 墙上开洞：门两侧格从墙中挖掉
 *       - 灰盒 detail.boxes      → 室内障碍（solid/platform → geometry；
 *                                  note → hint 文字；其余类型跳过并警告）
 *   · 1 个 MVMap 格 = 游戏 1 米；MVMap Y 向下 → 导入时翻转 Y，
 *     并把文档包围盒的左下角对齐到游戏原点 (0,0)。
 *
 * 产出（MapData v2）：
 *   · layers.geometry    ← 墙（包围盒 − 可行走区）的合并矩形 + 灰盒 solid/platform
 *   · layers.floorCells   ← 可行走区（区域色）+ 门洞格（相邻房间区域色/灰）
 *   · layers.objects      ← 房间备注 → hint；灰盒 note → hint；NOVA 补在地图顶部
 *   · width/height        ← 由格子包围盒推算（格数 × 1 米）
 *   · playerSpawn         ← 「玩家起点」房间（否则第一个房间）底部中心附近
 */
import type { MapData, RectItem, FloorCell } from './mapTypes';
import { createEmptyMapData, migrateMapData } from './mapTypes';
import { cellsToRects, parseCellKey, cellKey, type CellRect } from './cells';

/* ==================== MVMap JSON 形状（仅所需子集） ==================== */

interface MvArea {
  id: string;
  name: string;
  color: string;
}

interface MvRoom {
  id: string;
  name: string;
  areaId: string;
  color: string | null;
  notes?: string;
  cells: string[];
}

interface MvDoor {
  id: string;
  x: number;
  y: number;
  o: 'v' | 'h';
  kind: string;
  lockId: string | null;
}

interface MvDetailBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: string;
  label?: string;
}

interface MvDetailRoom {
  sub?: number;
  boxes?: MvDetailBox[];
}

interface MvDoc {
  id?: string;
  name?: string;
  areas?: MvArea[];
  rooms?: MvRoom[];
  doors?: MvDoor[];
  detail?: Record<string, MvDetailRoom>;
}

/** 门洞地板使用的中性色（门两侧都非房间格时） */
const DOORHOLE_COLOR = '#98a2b8';

/**
 * 外框墙厚度（格）。
 * 恶魔城地图四周应是石墙：在包围盒外再固一圈墙，
 * 保证玩家无法走出地图落地（地图边界 = 墙）。
 */
const BORDER = 1;

/** 导入异常（带用户可读消息） */
export class MvImportError extends Error {}

/* ==================== 导入 ==================== */

/**
 * 解析 MVMap 导出 JSON 并转为编辑器 MapData v2。
 *
 * 模式 A（区域语义）：色块 = 可行走空间，黑块 = 墙，门 = 墙洞。
 * @throws MvImportError 当 JSON 不是有效的 MVMap 文档时
 */
export function importMvMapJson(text: string): MapData {
  let doc: MvDoc;
  try {
    doc = JSON.parse(text) as MvDoc;
  } catch {
    throw new MvImportError('不是有效的 JSON 文件');
  }
  if (!doc || typeof doc !== 'object') throw new MvImportError('文件内容为空或格式错误');

  const areas = Array.isArray(doc.areas) ? doc.areas : [];
  const rooms = Array.isArray(doc.rooms) ? doc.rooms : [];
  const doors = Array.isArray(doc.doors) ? doc.doors : [];
  const detail = doc.detail && typeof doc.detail === 'object' ? doc.detail : {};
  if (rooms.length === 0) throw new MvImportError('这是 MVMap 文档，但没有房间（rooms）——无法导入结构底盘');

  const areaById = new Map<string, MvArea>();
  for (const a of areas) areaById.set(a.id, a);
  // 未声明区域时兜底
  if (areas.length === 0) areaById.set('__default', { id: '__default', name: '区域', color: '#4c8dd8' });

  // ── 收集全部格子，计算包围盒（MVMap 坐标，Y 向下）──
  const all: { x: number; y: number }[] = [];
  const roomCells: { room: MvRoom; cells: string[] }[] = [];
  // MVMap 格键 → 房间（用于门洞取色 / 起点房间查找）
  const cellRoom = new Map<string, MvRoom>();
  for (const room of rooms) {
    const keys = Array.isArray(room.cells) ? room.cells.filter((k) => typeof k === 'string') : [];
    const pts = keys.map(parseCellKey);
    all.push(...pts);
    roomCells.push({ room, cells: keys });
    for (const k of keys) if (!cellRoom.has(k)) cellRoom.set(k, room);
  }
  if (all.length === 0) throw new MvImportError('所有房间都没有格子（cells）——无法导入');

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of all) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const W = Math.max(1, maxX - minX + 1 + BORDER * 2);
  const H = Math.max(1, maxY - minY + 1 + BORDER * 2);

  // ── Y 翻转 + 平移：game = (mvX - minX + BORDER, maxY - mvY + BORDER) ──
  // 外扩 BORDER 格 → 所有房间/门偏移 BORDER，包围盒外自动落下为「墙」。
  const GX = (mvX: number) => mvX - minX + BORDER;
  const GY = (mvY: number) => maxY - mvY + BORDER;
  const inWorld = (mvX: number, mvY: number) =>
    mvX >= minX && mvX <= maxX && mvY >= minY && mvY <= maxY;
  const roomAreaColor = (mvK: string): string | null => {
    const r = cellRoom.get(mvK);
    if (!r) return null;
    const aid = r.areaId && areaById.has(r.areaId) ? r.areaId : areaById.keys().next().value as string;
    return areaById.get(aid)!.color;
  };

  /* ── 可行走集（区域语义的核心）──
   * walk = 所有房间格 ∪ 门两侧格（挖墙成洞）。
   * 这些格子在游戏里是「可以走的空间」：不生成碰撞体，只生成区域色地板。
   */
  const walk = new Set<string>();
  for (const { cells } of roomCells) {
    for (const k of cells) walk.add(cellKey(GX(parseCellKey(k).x), GY(parseCellKey(k).y)));
  }

  // 门洞：挖掉门两侧格。记录门洞格的取色来源（相邻房间区域色，找不到则灰）
  const doorHoleCells = new Map<string, string>();
  for (const d of doors) {
    const pairs: [number, number][] = d.o === 'v'
      ? [[d.x - 1, d.y], [d.x, d.y]]          // 竖边 (x,y) 分隔 (x-1,y) | (x,y)
      : [[d.x, d.y - 1], [d.x, d.y]];         // 水平边 (x,y) 分隔 (x,y-1) | (x,y)
    for (const [mx, my] of pairs) {
      if (!inWorld(mx, my)) continue;
      const gk = cellKey(GX(mx), GY(my));
      walk.add(gk);
      if (!doorHoleCells.has(gk)) doorHoleCells.set(gk, roomAreaColor(cellKey(mx, my)) ?? DOORHOLE_COLOR);
    }
  }

  /* ── 墙 = 包围盒 − 可行走区 ── */
  const wallCells: string[] = [];
  for (let gy = 0; gy < H; gy++) {
    for (let gx = 0; gx < W; gx++) {
      const k = cellKey(gx, gy);
      if (!walk.has(k)) wallCells.push(k);
    }
  }
  const wallRects: CellRect[] = cellsToRects(wallCells, 1);

  /* ── 可行走区 → floorCells：按区域色合并；门洞格单独补色 ── */
  const floorCells: FloorCell[] = [];
  const byArea = new Map<string, { area: MvArea; cells: { x: number; y: number }[] }>();
  for (const { room, cells } of roomCells) {
    const aid = room.areaId && areaById.has(room.areaId) ? room.areaId : areaById.keys().next().value as string;
    let group = byArea.get(aid);
    if (!group) {
      const area = areaById.get(aid)!;
      group = { area, cells: [] };
      byArea.set(aid, group);
    }
    for (const k of cells) {
      const p = parseCellKey(k);
      group.cells.push({ x: GX(p.x), y: GY(p.y) });
    }
  }
  // 区域色地板（房间格）
  const roomCellKeys = new Set<string>();
  for (const { area, cells } of byArea.values()) {
    const keys = cells.map((p) => cellKey(p.x, p.y));
    for (const k of keys) roomCellKeys.add(k);
    const rects: CellRect[] = cellsToRects(keys, 1);
    for (const r of rects) {
      floorCells.push({ x: r.x, y: r.y, w: r.w, h: r.h, color: area.color });
    }
  }
  // 门洞格地板（相邻区域色 / 中性灰）—— 覆盖在对应区域色矩形之上
  for (const [gk, color] of doorHoleCells) {
    if (roomCellKeys.has(gk)) continue; // 已是房间格，区域地板已覆盖
    const p = parseCellKey(gk);
    floorCells.push({ x: p.x, y: p.y, w: 1, h: 1, color });
  }

  /* ── 碰撞体（墙）── */
  const geometry: RectItem[] = [];
  for (const r of wallRects) {
    geometry.push({ type: 'rect', x: r.x, y: r.y, w: r.w, h: r.h, rotation: 0 });
  }

  /* ── 对象层：房间备注 hint + 灰盒 note hint + NOVA ── */
  const objects: MapData['layers']['objects'] = [];

  // 房间备注 → hint 提示文字（房间中心）
  // 过滤：仅较短的备注作为游戏内提示（超长备注多为设计说明/坐标，转成文字会造成重叠重影）；
  // 位置去重：与已生成提示相距 <1m 的跳过（相邻小房间的文字会叠在一起）。
  const HINT_MAX_LEN = 14;
  const hintPositions: { x: number; y: number }[] = [];
  for (const { room, cells } of roomCells) {
    const notes = (room.notes || '').trim();
    if (!notes || notes.length > HINT_MAX_LEN || cells.length === 0) continue;
    let cx = 0, cy = 0;
    for (const k of cells) {
      const p = parseCellKey(k);
      cx += GX(p.x) + 0.5;
      cy += GY(p.y) + 0.5;
    }
    const hx = cx / cells.length, hy = cy / cells.length;
    if (hintPositions.some((q) => Math.abs(q.x - hx) < 1.5 && Math.abs(q.y - hy) < 1.5)) continue;
    hintPositions.push({ x: hx, y: hy });
    objects.push({ type: 'hint', x: hx, y: hy, text: notes });
  }

  // 灰盒室内障碍：solid/platform → 碰撞体；note → hint；其余跳过
  const CONSUMED_BOX_TYPES = new Set(['solid', 'platform', 'note']);
  const skippedBoxTypes = new Set<string>();
  for (const { room } of roomCells) {
    const det = detail[room.id];
    if (!det || !Array.isArray(det.boxes) || det.boxes.length === 0) continue;
    const sub = Math.max(1, det.sub ?? 8);
    for (const b of det.boxes) {
      if (!CONSUMED_BOX_TYPES.has(b.type)) {
        skippedBoxTypes.add(b.type);
        continue;
      }
      // 灰盒坐标 = 绝对子格坐标（worldCell * sub），Y 向下 → 翻转到游戏坐标
      const mvX0 = b.x / sub, mvX1 = (b.x + b.w) / sub;
      const mvY0 = b.y / sub, mvY1 = (b.y + b.h) / sub;
      const gx = GX(mvX0);
      const gy = GY(mvY1);               // 游戏 y = 底边（MVMap 下边翻转后）
      const w = mvX1 - mvX0;
      const h = mvY1 - mvY0;
      if (b.type === 'note') {
        const label = (b.label || '').trim() || '灰盒注释';
        objects.push({ type: 'hint', x: gx + w / 2, y: gy + h / 2, text: label });
      } else {
        // solid / platform → 室内障碍（碰撞体）
        geometry.push({ type: 'rect', x: gx, y: gy, w, h, rotation: 0 });
      }
    }
  }
  // 未被消费的灰盒类型提示（开发期诊断，不抛错）
  if (skippedBoxTypes.size > 0) {
    console.warn('[mvmapImport] 灰盒类型未消费，已跳过:', [...skippedBoxTypes].join(', '));
  }

  /* ── 出生点：优先「玩家起点」房间，否则第一个房间。
   * 算法：在房间可行走格中，优先取「正下方是墙（有地面支撑）」的格，
   * 取其中最低（游戏 y 最小）且最靠近房间水平中心者 —— 出生即站在地板上；
   * 若无任何受支撑格，则退回房间最底行的可行走格（保证不在墙内，可能小幅下落）。 ── */
  const spawnRoom = roomCells.find(({ room }) => /玩家起点|出生|起点/.test(room.notes || '')) || roomCells[0];
  let spawnX = W / 2, spawnY = 1;
  if (spawnRoom && spawnRoom.cells.length > 0) {
    let bx0 = Infinity, bx1 = -Infinity;
    const roomPts: { x: number; y: number }[] = [];
    for (const k of spawnRoom.cells) {
      const p = parseCellKey(k);
      const gx = GX(p.x), gy = GY(p.y);
      roomPts.push({ x: gx, y: gy });
      if (gx < bx0) bx0 = gx; if (gx > bx1) bx1 = gx;
    }
    const cx = (bx0 + bx1) / 2; // 房间水平中心
    // 受支撑格：正下方不是可行走区（= 墙顶），出生即有地面
    const supported = roomPts.filter((p) => p.y - 1 < 0 || !walk.has(cellKey(p.x, p.y - 1)));
    let best: { x: number; y: number } | null = null;
    for (const p of supported) {
      if (!best || p.y < best.y || (p.y === best.y && Math.abs(p.x + 0.5 - cx) < Math.abs(best.x + 0.5 - cx))) {
        best = p;
      }
    }
    if (!best) {
      // 兜底：最底行中取最靠近水平中心的可走格
      const by0 = Math.min(...roomPts.map((p) => p.y));
      const bottomPts = roomPts.filter((p) => p.y === by0);
      best = bottomPts.reduce((a, b) => (Math.abs(b.x + 0.5 - cx) < Math.abs(a.x + 0.5 - cx) ? b : a));
    }
    spawnX = best.x + 0.5;
    spawnY = best.y + 0.5; // 站格中心（脚下为墙顶时落定仅微降半高）
  }

  /* ── NOVA 终点：补在最高的可行走格内（MVMap 无终点概念，惯例）──
   * 模式 A 下房间格 = 空腔，最高的可行走格玩家可达，NOVA 放其格心。
   */
  let novaX = W / 2, novaY = Math.min(1, H - 2);
  {
    let topY = -Infinity;
    for (const k of walk) {
      const p = parseCellKey(k);
      if (p.y > topY) topY = p.y;
    }
    if (topY > -Infinity) {
      let cx0 = Infinity, cx1 = -Infinity;
      for (const k of walk) {
        const p = parseCellKey(k);
        if (p.y === topY) { if (p.x < cx0) cx0 = p.x; if (p.x > cx1) cx1 = p.x; }
      }
      novaX = (cx0 + cx1 + 1) / 2;
      novaY = topY + 0.5;
    }
  }
  objects.push({ type: 'nova', x: novaX, y: novaY });

  const data: MapData = {
    version: 2,
    id: typeof doc.id === 'string' ? doc.id : 'from-mvmap',
    name: typeof doc.name === 'string' && doc.name ? doc.name : 'MVMap 导入地图',
    width: W,
    height: H,
    playerSpawn: { x: spawnX, y: spawnY },
    layers: {
      geometry,
      objects,
      floorCells,
      gridSize: 1,
    },
  };
  // 过一遍 migrate（保险：任何缺字段都会补齐）
  return migrateMapData(data);
}

/**
 * 把 MVMap 文件的 FileReader 结果导入编辑器（io.ts 使用的便捷包装）。
 * @returns MapData；失败时 throw MvImportError
 */
export function importMvMapFile(file: File): Promise<MapData> {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        resolve(importMvMapJson(String(rd.result ?? '')));
      } catch (e) {
        reject(e);
      }
    };
    rd.onerror = () => reject(new MvImportError('读取文件失败'));
    rd.readAsText(file);
  });
}