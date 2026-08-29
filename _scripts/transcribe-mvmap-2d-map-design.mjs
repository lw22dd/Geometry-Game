/**
 * transcribe-mvmap-2d-map-design.mjs
 * 把 工具/SceneEditor/export/mvmap-maps.json 中 mvmap-2d-map-design 的编译结果
 * 转写为 src/config/level.ts 中的地图块（替换旧块），完全沿用现有转写风格：
 *   · solids  → R(x, y, w, h)（helper 默认 hookable: true, top: y+h，与编译输出一致）
 *   · floor   → 与 solids 逐块同坐标的墙体视觉色块（#4c8dd8）
 *   · hints   → [x, y, "文本"]（坐标 4 位小数）
 *   · entitySpawners → 空数组 + nova
 *
 * 运行：node _scripts/transcribe-mvmap-2d-map-design.mjs
 */
import { readFileSync, writeFileSync } from 'fs';

const EXPORT_FILE = '工具/SceneEditor/export/mvmap-maps.json';
const LEVEL_FILE = 'src/config/level.ts';
const MAP_ID = 'mvmap-2d-map-design';

// ── 读取编译结果 ──
const payload = JSON.parse(readFileSync(EXPORT_FILE, 'utf8'));
const map = payload.maps.find((m) => m.id === MAP_ID);
if (!map) throw new Error(`未在导出 JSON 中找到 ${MAP_ID}`);

// ── 数字格式化：整数保持整数，其余 4 位小数（去尾零）──
const fmt = (n) => {
  const r = Math.round(n * 10000) / 10000;
  return String(r);
};

// ── 生成地图块（与现有转写风格一致）──
const lines = [];
lines.push('  {');
lines.push(`    id: '${map.id}',`);
lines.push(`    name: "${map.name}",`);
lines.push(`    width: ${fmt(map.width)},`);
lines.push(`    height: ${fmt(map.height)},`);
lines.push(`    playerSpawn: { x: ${fmt(map.playerSpawn.x)}, y: ${fmt(map.playerSpawn.y)} },`);
lines.push('');
lines.push('    // ── 静态几何（墙，包围盒 − 可行走区）──');
lines.push('    solids: [');
for (const s of map.solids) {
  lines.push(`      R(${fmt(s.x)}, ${fmt(s.y)}, ${fmt(s.w)}, ${fmt(s.h)}),`);
}
lines.push('    ],');
lines.push('');
lines.push('    spikes: [],');
lines.push('    decos: [],');
lines.push('');
lines.push('    // ── 墙体视觉层（统一色块，与 solids 逐块对应）──');
lines.push('    floor: {');
lines.push('      gridSize: 1,');
lines.push('      cells: [');
const wallColor = '#4c8dd8';
for (const c of map.floor.cells) {
  lines.push(`        { x: ${fmt(c.x)}, y: ${fmt(c.y)}, w: ${fmt(c.w)}, h: ${fmt(c.h)}, color: '${wallColor}' },`);
}
lines.push('      ],');
lines.push('    },');
lines.push('');
lines.push('    hints: [');
for (const h of map.hints) {
  lines.push(`      [${fmt(h[0])}, ${fmt(h[1])}, "${h[2]}"],`);
}
lines.push('    ],');
lines.push('');
lines.push('    // ── 实体生成描述 ──');
lines.push('    entitySpawners: {');
lines.push('      movers: [],');
lines.push('      springPads: [],');
lines.push('      lasers: [],');
lines.push('      orbs: [],');
lines.push('      jumpBoosts: [],');
lines.push('      checkpoints: [],');
lines.push(`      nova: { x: ${fmt(map.entitySpawners.nova.x)}, y: ${fmt(map.entitySpawners.nova.y)} },`);
lines.push('    },');
lines.push('  },');

const newBlock = lines.join('\n');

// ── 定位 level.ts 中旧块（id 行向上找 `{`，花括号配对）──
const text = readFileSync(LEVEL_FILE, 'utf8');
const srcLines = text.split('\n');
const idIdx = srcLines.findIndex((l) => l.includes(`id: '${MAP_ID}'`));
if (idIdx < 0) throw new Error(`未在 ${LEVEL_FILE} 中找到 ${MAP_ID}`);
let start = idIdx - 1;
while (start >= 0 && !srcLines[start].includes('{')) start--;
if (start < 0) throw new Error('未找到块起始 {');
let depth = 0;
let end = -1;
for (let i = start; i < srcLines.length; i++) {
  for (const ch of srcLines[i]) {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
  }
  if (depth === 0) { end = i; break; }
}
if (end < 0) throw new Error('未找到块结束 }');

const oldBlock = srcLines.slice(start, end + 1).join('\n');
const out = text.replace(oldBlock, newBlock);
writeFileSync(LEVEL_FILE, out);

console.log(`已转写 ${MAP_ID}：第 ${start + 1}–${end + 1} 行 → 新块（${map.width}×${map.height}，墙 ${map.solids.length}，hint ${map.hints.length}，spawn (${fmt(map.playerSpawn.x)},${fmt(map.playerSpawn.y)})，nova (${fmt(map.entitySpawners.nova.x)},${fmt(map.entitySpawners.nova.y)})）`);