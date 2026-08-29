/**
 * 一次性工具：将工具/MVMap/Draft/2d-map-design.mvmap.json（《2D地图设计》草稿）
 * 的地图空间按 x×3、y×2 扩大（保持设计比例与连通性）：
 *   · 房间 cells：每格 "x,y" → 3×2 实心块（(3x+dx, 2y+dy)，dx∈0..2, dy∈0..1）
 *   · 门 doors：坐标 (x,y) → (3x, 2y)（门洞开在相邻两块的公共边上）
 *   · 灰盒 detail.boxes：坐标/尺寸同比例放大（x,w×3；y,h×2）
 * 运行：node _scripts/scale-mvmap-draft-2d-map-design.mjs
 */
import { readFileSync, writeFileSync } from 'fs';

const FILE = '工具/MVMap/Draft/2d-map-design.mvmap.json';
const SX = 3;
const SY = 2;

const doc = JSON.parse(readFileSync(FILE, 'utf8'));
if (!Array.isArray(doc.rooms)) throw new Error('文档缺少 rooms 数组');

let roomCount = 0, cellCount = 0, doorCount = 0, boxCount = 0;

// ── 房间 cells：每格扩成 3×2 实心块 ──
for (const room of doc.rooms) {
  if (!Array.isArray(room.cells) || room.cells.length === 0) continue;
  const out = new Set();
  for (const key of room.cells) {
    const m = /^(\d+),(\d+)$/.exec(String(key));
    if (!m) throw new Error(`无法解析格子 "${key}"`);
    const x = Number(m[1]), y = Number(m[2]);
    for (let dx = 0; dx < SX; dx++) {
      for (let dy = 0; dy < SY; dy++) {
        out.add(`${x * SX + dx},${y * SY + dy}`);
      }
    }
  }
  // 行优先排序（y 升序、x 升序），与原始导出风格一致
  room.cells = [...out].sort((a, b) => {
    const [ax, ay] = a.split(',').map(Number);
    const [bx, by] = b.split(',').map(Number);
    return ay - by || ax - bx;
  });
  roomCount++;
  cellCount += room.cells.length;
}

// ── 门：坐标同比例缩放 ──
for (const d of doc.doors ?? []) {
  if (typeof d.x !== 'number' || typeof d.y !== 'number') continue;
  d.x *= SX;
  d.y *= SY;
  doorCount++;
}

// ── 灰盒：坐标与尺寸同比例缩放（子格坐标）──
for (const key of Object.keys(doc.detail ?? {})) {
  const boxes = doc.detail[key]?.boxes;
  if (!Array.isArray(boxes)) continue;
  for (const b of boxes) {
    b.x *= SX; b.w *= SX;
    b.y *= SY; b.h *= SY;
    boxCount++;
  }
}

writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n');
console.log(`已扩大《2D地图设计》地图空间：x×${SX}、y×${SY}`);
console.log(`  房间 ${roomCount} 个，cells 共 ${cellCount} 格；门 ${doorCount} 个；灰盒 ${boxCount} 个`);
