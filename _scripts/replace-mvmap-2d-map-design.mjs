/**
 * replace-mvmap-2d-map-design.mjs
 * 用编辑器新地图《2D地图设计 · 底图》(mapTemplate/2d2.ts, id 2d-2) 替换
 * 游戏 src/config/level.ts 中旧的 mvmap-2d-map-design 地图块。
 *
 * 转换语义与 工具/SceneEditor/src/mapCodec.ts 的 compileMapData 一致：
 *   · layers.geometry(rotation=0) → solids: R(x, y, w, h)
 *   · layers.objects              → spikes/decos/hints/movers/springPads/lasers/orbs/jumpBoosts/hooks/shields/checkpoints/nova
 *   · floorCells(null)            → 不输出 floor 视觉层
 * 保留游戏侧 id 'mvmap-2d-map-design'（脚本/切图/net 均按此 id 引用），
 * name 采用新地图名。
 *
 * 运行：node _scripts/replace-mvmap-2d-map-design.mjs [--dry-run]
 */
import { readFileSync, writeFileSync } from 'fs';

const SRC_FILE = '工具/SceneEditor/src/mapTemplate/2d2.ts';
const LEVEL_FILE = 'src/config/level.ts';
const MAP_ID = 'mvmap-2d-map-design';
const dryRun = process.argv.includes('--dry-run');

/* ── 1) 从 2d2.ts 提取 MapData v2（对象字面量为合法 JSON）── */
const src = readFileSync(SRC_FILE, 'utf8');
const jsonStart = src.indexOf('= {') + 2; // 指向 '{'
let depth = 0, jsonEnd = -1;
for (let i = jsonStart; i < src.length; i++) {
  const c = src[i];
  if (c === '{') depth++;
  else if (c === '}') { depth--; if (depth === 0) { jsonEnd = i; break; } }
}
if (jsonEnd < 0) throw new Error(`未在 ${SRC_FILE} 中找到 MapData 对象`);
const data = JSON.parse(src.slice(jsonStart, jsonEnd + 1));
if (data.id !== '2d-2') throw new Error(`意外的模板 id: ${data.id}（期望 2d-2）`);

/* ── 2) 数字格式化：整数保持整数，其余 4 位小数（去尾零）── */
const fmt = (n) => String(Math.round(n * 10000) / 10000);
const P = ([x, y]) => `        [${fmt(x)}, ${fmt(y)}],`;
const S = (o) => `        { x: ${fmt(o.x)}, y: ${fmt(o.y)} },`;

/* ── 3) 转换：geometry → solids；objects → 分类条目 ── */
const solids = data.layers.geometry
  .filter((g) => g.type === 'rect')
  .map((g) => `      R(${fmt(g.x)}, ${fmt(g.y)}, ${fmt(g.w)}, ${fmt(g.h)}),`);

const spikes = [], decos = [], hints = [], movers = [], springs = [];
const lasers = [], orbs = [], jumps = [], hooks = [], shields = [], checkpoints = [];
let nova = { x: 0, y: 0 };

for (const o of data.layers.objects) {
  switch (o.type) {
    case 'spike': spikes.push(S(o)); break;
    case 'deco': decos.push(`        [${fmt(o.x)}, ${fmt(o.y)}, ${fmt(o.size)}, ${fmt(o.rotSpeed)}],`); break;
    case 'hint': hints.push(`        [${fmt(o.x)}, ${fmt(o.y)}, ${JSON.stringify(o.text)}],`); break;
    case 'mover': {
      let s = `        { x0: ${fmt(o.x0)}, y: ${fmt(o.y)}, w: ${fmt(o.w)}, h: ${fmt(o.h)}, range: ${fmt(o.range)}, spd: ${fmt(o.spd)}, ph: ${fmt(o.ph)}`;
      if (o.axis) s += `, axis: '${o.axis}'`;
      if (o.yRange !== undefined) s += `, yRange: ${fmt(o.yRange)}`;
      movers.push(s + ` },`);
      break;
    }
    case 'springPad': {
      const isV = o.w === 2.5 && o.h === 2 && o.force.x === 0 && o.force.y === 96 && o.duration === 0.3;
      const isH = o.w === 2 && o.h === 2.5 && o.force.x === 96 && o.force.y === 10 && o.duration === 0.3;
      if (isV) springs.push(`        { x: ${fmt(o.x)}, y: ${fmt(o.y)}, ...VERTICAL_SPRING },`);
      else if (isH) springs.push(`        { x: ${fmt(o.x)}, y: ${fmt(o.y)}, ...HORIZONTAL_SPRING },`);
      else springs.push(`        { x: ${fmt(o.x)}, y: ${fmt(o.y)}, w: ${fmt(o.w)}, h: ${fmt(o.h)}, force: { x: ${fmt(o.force.x)}, y: ${fmt(o.force.y)} }, duration: ${fmt(o.duration)} },`);
      break;
    }
    case 'laser': lasers.push(`        { x: ${fmt(o.x)}, y0: ${fmt(o.y0)}, len: ${fmt(o.len)}, ph: ${fmt(o.ph)} },`); break;
    case 'orb': orbs.push(`        [${fmt(o.x)}, ${fmt(o.y)}],`); break;
    case 'jumpBoost': jumps.push(`        [${fmt(o.x)}, ${fmt(o.y)}],`); break;
    case 'checkpoint': checkpoints.push(`        [${fmt(o.x)}, ${fmt(o.y)}],`); break;
    case 'hookPickup': hooks.push(`        [${fmt(o.x)}, ${fmt(o.y)}],`); break;
    case 'shieldPickup': shields.push(`        [${fmt(o.x)}, ${fmt(o.y)}],`); break;
    case 'nova': nova = { x: o.x, y: o.y }; break;
  }
}

const block = (indent) => {
  const L = (l) => indent + l;
  const out = [];
  out.push(L('{'));
  out.push(L(`    id: '${MAP_ID}',`));
  out.push(L(`    name: '${data.name}',`));
  out.push(L(`    width: ${fmt(data.width)},`));
  out.push(L(`    height: ${fmt(data.height)},`));
  out.push(L(`    playerSpawn: { x: ${fmt(data.playerSpawn.x)}, y: ${fmt(data.playerSpawn.y)} },`));
  out.push(L(''));
  out.push(L('    // ── 静态几何（墙，包围盒 − 可行走区）──'));
  out.push(L('    solids: ['));
  out.push(...solids.map((s) => L(s)));
  out.push(L('    ],'));
  out.push(L(''));
  out.push(L('    spikes: ['));
  out.push(...spikes.map((s) => L(s)));
  out.push(L('    ],'));
  out.push(L(''));
  out.push(L('    // 装饰方块（旋转地标）'));
  out.push(L('    decos: ['));
  out.push(...decos.map((s) => L(s)));
  out.push(L('    ],'));
  out.push(L(''));
  out.push(L('    hints: ['));
  out.push(...hints.map((s) => L(s)));
  out.push(L('    ],'));
  out.push(L(''));
  out.push(L('    // ── 实体生成描述 ──'));
  out.push(L('    entitySpawners: {'));
  out.push(L('      movers: ['));
  out.push(...movers.map((s) => L(s)));
  out.push(L('      ],'));
  out.push(L('      springPads: ['));
  out.push(...springs.map((s) => L(s)));
  out.push(L('      ],'));
  out.push(L('      lasers: ['));
  out.push(...lasers.map((s) => L(s)));
  out.push(L('      ],'));
  out.push(L('      orbs: ['));
  out.push(...orbs.map((s) => L(s)));
  out.push(L('      ],'));
  out.push(L('      // 双跳光球（拾取后永久二段跳）'));
  out.push(L('      jumpBoosts: ['));
  out.push(...jumps.map((s) => L(s)));
  out.push(L('      ],'));
  out.push(L('      // 钩锁道具'));
  out.push(L('      hooks: ['));
  out.push(...hooks.map((s) => L(s)));
  out.push(L('      ],'));
  out.push(L('      // 护盾道具'));
  out.push(L('      shields: ['));
  out.push(...shields.map((s) => L(s)));
  out.push(L('      ],'));
  out.push(L('      // 检查点'));
  out.push(L('      checkpoints: ['));
  out.push(...checkpoints.map((s) => L(s)));
  out.push(L('      ],'));
  out.push(L(`      nova: { x: ${fmt(nova.x)}, y: ${fmt(nova.y)} },`));
  out.push(L('    },'));
  out.push(L('  },'));
  return out.join('\n');
};

/* ── 4) 定位并替换 level.ts 旧块 ── */
const text = readFileSync(LEVEL_FILE, 'utf8');
const srcLines = text.split('\n');
const idIdx = srcLines.findIndex((l) => l.includes(`id: '${MAP_ID}'`));
if (idIdx < 0) throw new Error(`未在 ${LEVEL_FILE} 中找到 ${MAP_ID}`);
let start = idIdx - 1;
while (start >= 0 && !srcLines[start].includes('{')) start--;
if (start < 0) throw new Error('未找到块起始 {');
let d = 0, end = -1;
for (let i = start; i < srcLines.length; i++) {
  for (const ch of srcLines[i]) {
    if (ch === '{') d++;
    else if (ch === '}') d--;
  }
  if (d === 0) { end = i; break; }
}
if (end < 0) throw new Error('未找到块结束 }');

const newBlock = block('  ');
const out = text.replace(srcLines.slice(start, end + 1).join('\n'), newBlock);

if (dryRun) {
  console.log(`[dry-run] 原块：第 ${start + 1}–${end + 1} 行 → 新块替换`);
  console.log(newBlock);
  console.log('──────── 统计 ────────');
  console.log(`solids ${solids.length} · spikes ${spikes.length} · decos ${decos.length} · hints ${hints.length}`);
  console.log(`movers ${movers.length} · springs ${springs.length} · lasers ${lasers.length} · orbs ${orbs.length}`);
  console.log(`jumpBoosts ${jumps.length} · hooks ${hooks.length} · shields ${shields.length} · checkpoints ${checkpoints.length} · nova 1`);
  console.log(`floor 视觉层：${data.layers.floorCells ? data.layers.floorCells.length : 0}（${data.layers.floorCells ? '有' : '无'}）`);
} else {
  writeFileSync(LEVEL_FILE, out);
  console.log(`已替换 ${MAP_ID}：第 ${start + 1}–${end + 1} 行 → 新块（${data.width}×${data.height}）`);
  console.log(`solids ${solids.length} · spikes ${spikes.length} · decos ${decos.length} · hints ${hints.length}`);
  console.log(`movers ${movers.length} · springs ${springs.length} · lasers ${lasers.length} · orbs ${orbs.length}`);
  console.log(`jumpBoosts ${jumps.length} · hooks ${hooks.length} · shields ${shields.length} · checkpoints ${checkpoints.length} · nova 1`);
}
