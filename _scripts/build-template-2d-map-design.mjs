/**
 * 生成《2D地图设计》底图内置模板：从 src/config/level.ts 的 mvmap-2d-map-design
 * 转写为编辑器 MapData v2 常量，注册进 工具/SceneEditor/src/templates.ts。
 * （转换规则与 工具/SceneEditor/src/mapCodec.ts 的 decompileMapDefinition 一致）
 * 运行：node _scripts/build-template-2d-map-design.mjs
 */
import { readFileSync, writeFileSync } from 'fs';

const LEVEL_FILE = 'src/config/level.ts';
const TPL_FILE = '工具/SceneEditor/src/templates.ts';

const text = readFileSync(LEVEL_FILE, 'utf8');
const idIdx = text.indexOf("id: 'mvmap-2d-map-design'");
if (idIdx < 0) throw new Error('未找到 mvmap-2d-map-design');
const block = text.slice(idIdx, text.indexOf('\n  },\n', idIdx));

/* ── 解析 level.ts 地图块 ── */
const solids = [...block.matchAll(/R\(([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\)/g)]
  .map((m) => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] }));

const W = +block.match(/width:\s*(\d+)/)[1];
const H = +block.match(/height:\s*(\d+)/)[1];
const spawn = block.match(/playerSpawn: \{ x: ([\d.]+), y: ([\d.]+) \}/);
const playerSpawn = { x: +spawn[1], y: +spawn[2] };

const floorCells = [...block.matchAll(/\{ x: ([\d.]+), y: ([\d.]+), w: ([\d.]+), h: ([\d.]+), color: '([^']+)' \}/g)]
  .map((m) => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4], color: m[5] }));

// 括号配对提取数组
function extractKey(key) {
  const i = block.indexOf(`${key}: [`);
  if (i < 0) return '';
  const start = block.indexOf('[', i) + 1;
  let depth = 1, j = start;
  for (; j < block.length && depth > 0; j++) {
    const c = block[j];
    if (c === '[') depth++;
    else if (c === ']') depth--;
  }
  return block.slice(start, j - 1);
}
const spikes = [...extractKey('spikes').matchAll(/\{ x: ([\d.]+), y: ([\d.]+) \}/g)].map((m) => ({ x: +m[1], y: +m[2] }));
const decos = [...extractKey('decos').matchAll(/\[([\d.]+), ([\d.]+), ([\d.]+), (-?[\d.]+)\]/g)].map((m) => ({ x: +m[1], y: +m[2], size: +m[3], rotSpeed: +m[4] }));
const hints = [...extractKey('hints').matchAll(/\[([\d.]+), ([\d.]+), "([^"]*)"/g)].map((m) => ({ x: +m[1], y: +m[2], text: m[3] }));
const movers = [...extractKey('movers').matchAll(/\{ x0: ([\d.]+), y: ([\d.]+), w: ([\d.]+), h: ([\d.]+), range: ([\d.]+), spd: ([\d.]+), ph: ([\d.]+|Math\.PI)([^}]*)\}/g)]
  .map((m) => {
    const o = { x0: +m[1], y: +m[2], w: +m[3], h: +m[4], range: +m[5], spd: +m[6], ph: m[7] === 'Math.PI' ? Math.PI : +m[7] };
    const tail = m[8] || '';
    const ax = tail.match(/axis: '(\w)'/); if (ax) o.axis = ax[1];
    const yr = tail.match(/yRange: ([\d.]+)/); if (yr) o.yRange = +yr[1];
    return o;
  });
// 弹簧：支持显式字段 或 ...VERTICAL_SPRING 展开（与 src/config/springs.ts 默认值一致）
const SPRING_DEFAULTS = {
  VERTICAL_SPRING: { w: 2.5, h: 2, force: { x: 0, y: 96 }, duration: 0.3 },
  HORIZONTAL_SPRING: { w: 2, h: 2.5, force: { x: 96, y: 10 }, duration: 0.3 },
};
const springPads = [...extractKey('springPads').matchAll(/\{ x: ([\d.]+), y: ([\d.]+)(?:, w: ([\d.]+), h: ([\d.]+), force: \{ x: (-?[\d.]+), y: (-?[\d.]+) \}, duration: ([\d.]+)|, \.\.\.(\w+)) \}/g)]
  .map((m) => {
    if (m[8]) {
      const d = SPRING_DEFAULTS[m[8]] ?? { w: 2.5, h: 2, force: { x: 0, y: 96 }, duration: 0.3 };
      return { x: +m[1], y: +m[2], ...d };
    }
    return { x: +m[1], y: +m[2], w: +m[3], h: +m[4], force: { x: +m[5], y: +m[6] }, duration: +m[7] };
  });
const lasers = [...extractKey('lasers').matchAll(/\{ x: ([\d.]+), y0: ([\d.]+), len: ([\d.]+), ph: ([\d.]+) \}/g)]
  .map((m) => ({ x: +m[1], y0: +m[2], len: +m[3], ph: +m[4] }));
const orbs = [...extractKey('orbs').matchAll(/\[([\d.]+), ([\d.]+)\]/g)].map((m) => ({ x: +m[1], y: +m[2] }));
const jumpBoosts = [...extractKey('jumpBoosts').matchAll(/\[([\d.]+), ([\d.]+)\]/g)].map((m) => ({ x: +m[1], y: +m[2] }));
const hooks = [...extractKey('hooks').matchAll(/\[([\d.]+), ([\d.]+)\]/g)].map((m) => ({ x: +m[1], y: +m[2] }));
const shields = [...extractKey('shields').matchAll(/\[([\d.]+), ([\d.]+)\]/g)].map((m) => ({ x: +m[1], y: +m[2] }));
const checkpoints = [...extractKey('checkpoints').matchAll(/\[([\d.]+), ([\d.]+)\]/g)].map((m) => ({ x: +m[1], y: +m[2] }));
const novaM = block.match(/nova: \{ x: ([\d.]+), y: ([\d.]+) \}/);
const nova = { x: +novaM[1], y: +novaM[2] };

const f = (n) => String(Math.round(n * 10000) / 10000);
const I = (o) => `      { type: '${o.type}', x: ${f(o.x)}, y: ${f(o.y)} },`;
const P = (o) => `      [${f(o.x)}, ${f(o.y)}],`;

/* ── 生成 MapData v2 常量（与 CRYSTAL_CAVERNS_DATA 风格一致）── */
const L = [];
L.push('/**');
L.push(' * 2D地图设计 · 结构底盘（MVMap 导入底图，x×3、y×2 缩放）+ 完整道具配置。');
L.push(' * 包含：恶魔城式分层结构、竖井电梯直达顶部 NOVA；');
L.push(' * 道具：光球/双跳/钩锁/护盾/检查点/尖刺/弹簧/激光/移动平台/装饰。');
L.push(' */');
L.push(`const TWO_D_MAP_DATA: MapData = {`);
L.push(`  version: 2,`);
L.push(`  id: '2d-map-design',`);
L.push(`  name: '2D地图设计 · 底图',`);
L.push(`  width: ${W},`);
L.push(`  height: ${H},`);
L.push(`  playerSpawn: { x: ${f(playerSpawn.x)}, y: ${f(playerSpawn.y)} },`);
L.push(`  layers: {`);
L.push(`    geometry: [`);  // 墙体
for (const s of solids) L.push(`      { type: 'rect', x: ${f(s.x)}, y: ${f(s.y)}, w: ${f(s.w)}, h: ${f(s.h)}, rotation: 0 },`);
L.push(`    ],`);
L.push(`    objects: [`);   // 道具
if (spikes.length) { L.push(`      /* —— 尖刺 —— */`); for (const o of spikes) L.push(`      { type: 'spike', x: ${f(o.x)}, y: ${f(o.y)} },`); }
if (decos.length) { L.push(`      /* —— 装饰方块 —— */`); for (const o of decos) L.push(`      { type: 'deco', x: ${f(o.x)}, y: ${f(o.y)}, size: ${f(o.size)}, rotSpeed: ${f(o.rotSpeed)} },`); }
if (hints.length) { L.push(`      /* —— 提示文字 —— */`); for (const o of hints) L.push(`      { type: 'hint', x: ${f(o.x)}, y: ${f(o.y)}, text: ${JSON.stringify(o.text)} },`); }
if (movers.length) {
  L.push(`      /* —— 移动平台 —— */`);
  for (const o of movers) {
    let s = `      { type: 'mover', x0: ${f(o.x0)}, y: ${f(o.y)}, w: ${f(o.w)}, h: ${f(o.h)}, range: ${f(o.range)}, spd: ${f(o.spd)}, ph: ${o.ph === Math.PI ? 'Math.PI' : f(o.ph)}`;
    if (o.axis) s += `, axis: '${o.axis}'`;
    if (o.yRange !== undefined) s += `, yRange: ${f(o.yRange)}`;
    L.push(s + ` },`);
  }
}
if (springPads.length) { L.push(`      /* —— 弹簧跳板 —— */`); for (const o of springPads) L.push(`      { type: 'springPad', x: ${f(o.x)}, y: ${f(o.y)}, w: ${f(o.w)}, h: ${f(o.h)}, force: { x: ${f(o.force.x)}, y: ${f(o.force.y)} }, duration: ${f(o.duration)} },`); }
if (lasers.length) { L.push(`      /* —— 激光栅栏 —— */`); for (const o of lasers) L.push(`      { type: 'laser', x: ${f(o.x)}, y0: ${f(o.y0)}, len: ${f(o.len)}, ph: ${f(o.ph)} },`); }
if (orbs.length) { L.push(`      /* —— 光球 —— */`); for (const o of orbs) L.push(I({ type: 'orb', x: o.x, y: o.y })); }
if (jumpBoosts.length) { L.push(`      /* —— 双跳光球 —— */`); for (const o of jumpBoosts) L.push(I({ type: 'jumpBoost', x: o.x, y: o.y })); }
if (hooks.length) { L.push(`      /* —— 钩锁道具 —— */`); for (const o of hooks) L.push(I({ type: 'hookPickup', x: o.x, y: o.y })); }
if (shields.length) { L.push(`      /* —— 护盾道具 —— */`); for (const o of shields) L.push(I({ type: 'shieldPickup', x: o.x, y: o.y })); }
if (checkpoints.length) { L.push(`      /* —— 检查点 —— */`); for (const o of checkpoints) L.push(I({ type: 'checkpoint', x: o.x, y: o.y })); }
L.push(`      /* —— NOVA 终点 —— */`);
L.push(`      { type: 'nova', x: ${f(nova.x)}, y: ${f(nova.y)} },`);
L.push(`    ],`);
L.push(`    floorCells: [`);  // 底盘视觉层
for (const c of floorCells) L.push(`      { x: ${f(c.x)}, y: ${f(c.y)}, w: ${f(c.w)}, h: ${f(c.h)}, color: '${c.color}' },`);
L.push(`    ],`);
L.push(`    gridSize: 1,`);
L.push(`  },`);
L.push(`};`);
L.push('');
const CONST = L.join('\n');

/* ── 注册表条目 ── */
const ENTRY = `  {
    id: '2d-map-design',
    name: '2D地图设计 · 底图',
    icon: 'Map',
    desc: '恶魔城式分层结构底盘（MVMap 导入 ×3/×2），竖井电梯登顶 NOVA；含光球/双跳/钩锁/护盾/检查点/机关等完整道具。',
    create: () => JSON.parse(JSON.stringify(TWO_D_MAP_DATA)) as MapData,
  },
`;

/* ── 写入 templates.ts ── */
let tpl = readFileSync(TPL_FILE, 'utf8');
if (tpl.includes('TWO_D_MAP_DATA')) {
  // 已有模板：先移除旧的常量与条目（从 /** 2D地图设计 注释到注册条目前）
  tpl = tpl.replace(/\n\/\*\*\n \* 2D地图设计[\s\S]*?\n\};/, '');
  tpl = tpl.replace(/\n  \{\n    id: '2d-map-design',[\s\S]*?\n  \},\n/, '\n');
}
// 常量插入到注册表注释前
tpl = tpl.replace('/* ==================== 模板注册表 ==================== */', `${CONST}\n/* ==================== 模板注册表 ==================== */`);
// 条目插入到 crystal-caverns 条目后（] 之前）
tpl = tpl.replace(/(    create: \(\) => JSON\.parse\(JSON\.stringify\(CRYSTAL_CAVERNS_DATA\)\) as MapData,\n  \},\n)(\];)/, `$1${ENTRY}$2`);
writeFileSync(TPL_FILE, tpl);

console.log(`已生成模板：${W}×${H}，墙 ${solids.length}，floor ${floorCells.length}，` +
  `spikes ${spikes.length} decos ${decos.length} hints ${hints.length} movers ${movers.length} springs ${springPads.length} ` +
  `lasers ${lasers.length} orbs ${orbs.length} jump ${jumpBoosts.length} hooks ${hooks.length} shields ${shields.length} ` +
  `checkpoints ${checkpoints.length} nova 1`);