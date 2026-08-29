/**
 * 校验 mvmap-2d-map-design 道具放置：
 *  1. 拾取物（orb/jumpBoost/hook/checkpoint）不能落在墙（solid）内；
 *  2. spike 报告是否贴地（可选警告）；
 *  3. 渲染带道具标记的 ASCII 地图（O=orb J=双跳 H=钩锁 C=检查点 S=地刺 P=弹簧 L=激光 M=平台 D=装饰 N=nova @=出生）。
 * 运行：node _scripts/validate-mvmap-2d-items.mjs
 */
import { readFileSync } from 'fs';

const text = readFileSync('src/config/level.ts', 'utf8');
const idIdx = text.indexOf("id: 'mvmap-2d-map-design'");
const block = text.slice(idIdx, text.indexOf('\n  },\n', idIdx));

const solids = [];
for (const m of block.matchAll(/R\(([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\)/g)) {
  solids.push({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] });
}
const W = +block.match(/width:\s*(\d+)/)[1];
const H = +block.match(/height:\s*(\d+)/)[1];
const solidAt = (x, y) => solids.some((s) => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h);
const groundedAt = (x, y) => y > 0 && solidAt(x, y - 1);

// ── 提取道具（括号配对，容忍数组内注释）──
function extractKey(key, name) {
  const i = block.indexOf(`${key}: ${name}`);
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
const orbs = [...extractKey('orbs', '[').matchAll(/\[([\d.]+), ([\d.]+)\]/g)].map((m) => ({ x: +m[1], y: +m[2] }));
const pickups = {
  orb: orbs,
  jumpBoost: [...extractKey('jumpBoosts', '[').matchAll(/\[([\d.]+), ([\d.]+)\]/g)].map((m) => ({ x: +m[1], y: +m[2] })),
  hook: [...extractKey('hooks', '[').matchAll(/\[([\d.]+), ([\d.]+)\]/g)].map((m) => ({ x: +m[1], y: +m[2] })),
  shield: [...extractKey('shields', '[').matchAll(/\[([\d.]+), ([\d.]+)\]/g)].map((m) => ({ x: +m[1], y: +m[2] })),
  checkpoint: [...extractKey('checkpoints', '[').matchAll(/\[([\d.]+), ([\d.]+)\]/g)].map((m) => ({ x: +m[1], y: +m[2] })),
};
const spikes = [...extractKey('spikes', '[').matchAll(/\{ x: ([\d.]+), y: ([\d.]+) \}/g)].map((m) => ({ x: +m[1], y: +m[2] }));
const springs = [...extractKey('springPads', '[').matchAll(/\{ x: ([\d.]+), y: ([\d.]+)/g)].map((m) => ({ x: +m[1], y: +m[2] }));
const lasers = [...extractKey('lasers', '[').matchAll(/\{ x: ([\d.]+), y0: ([\d.]+), len: ([\d.]+)/g)].map((m) => ({ x: +m[1], y0: +m[2], len: +m[3] }));
const movers = [...extractKey('movers', '[').matchAll(/\{ x0: ([\d.]+), y: ([\d.]+)/g)].map((m) => ({ x: +m[1], y: +m[2] }));
const decos = [...extractKey('decos', '[').matchAll(/\[([\d.]+), ([\d.]+)/g)].map((m) => ({ x: +m[1], y: +m[2] }));
const spawnM = block.match(/playerSpawn: \{ x: ([\d.]+), y: ([\d.]+) \}/);
const novaM = block.match(/nova: \{ x: ([\d.]+), y: ([\d.]+) \}/);
const spawn = spawnM ? { x: +spawnM[1], y: +spawnM[2] } : null;
const nova = novaM ? { x: +novaM[1], y: +novaM[2] } : null;

// ── 校验 1：拾取物不落墙 ──
let err = 0;
for (const [kind, list] of Object.entries(pickups)) {
  for (const p of list) {
    if (solidAt(p.x, p.y)) { console.log(`✗ ${kind} 落在墙内: (${p.x},${p.y})`); err++; }
  }
  console.log(`✓ ${kind} × ${list.length}${err ? '（有错误）' : ''}`);
}
// spike 贴地检查（尖刺墙竖排允许悬空，标注提示）
for (const s of spikes) {
  if (!groundedAt(s.x, s.y)) console.log(`  ⚠ spike 无地面支撑（悬空/墙面）: (${s.x},${s.y})`);
}
console.log(`✓ spikes × ${spikes.length}  springs × ${springs.length}  lasers × ${lasers.length}  movers × ${movers.length}  decos × ${decos.length}`);
if (spawn && solidAt(spawn.x, spawn.y)) { console.log(`✗ spawn 在墙内 (${spawn.x},${spawn.y})`); err++; }
if (nova && solidAt(nova.x, nova.y)) { console.log(`✗ nova 在墙内 (${nova.x},${nova.y})`); err++; }
console.log(err === 0 ? '\n✅ 无落墙错误' : `\n❌ ${err} 处落墙错误`);

// ── 渲染 ──
const grid = Array.from({ length: H }, () => Array(W).fill(null));
for (const s of solids) for (let dy = 0; dy < s.h; dy++) for (let dx = 0; dx < s.w; dx++) {
  const yy = s.y + dy, xx = s.x + dx;
  if (yy >= 0 && yy < H && xx >= 0 && xx < W) grid[yy][xx] = '#';
}
const mark = (x, y, ch) => {
  const X = Math.round(x), Y = Math.round(y);
  if (X >= 0 && X < W && Y >= 0 && Y < H && grid[Y][X] !== '#') grid[Y][X] = ch;
};
for (const p of pickups.orb) mark(p.x, p.y, 'o');
for (const p of pickups.jumpBoost) mark(p.x, p.y, 'J');
for (const p of pickups.hook) mark(p.x, p.y, 'H');
for (const p of pickups.checkpoint) mark(p.x, p.y, 'C');
for (const s of spikes) mark(s.x, s.y, 'S');
for (const s of springs) mark(s.x, s.y, 'P');
for (const l of lasers) for (let i = 0; i < l.len; i++) mark(l.x, l.y0 + i, 'L');
for (const m of movers) mark(m.x, m.y, 'M');
for (const d of decos) mark(d.x, d.y, 'D');
if (spawn) mark(spawn.x, spawn.y, '@');
if (nova) mark(nova.x, nova.y, 'N');

let out = '';
for (let y = H - 1; y >= 0; y--) {
  let row = '';
  for (let x = 0; x < W; x++) row += grid[y][x] === null ? '.' : grid[y][x];
  out += `y${String(y).padStart(2)} ${row}\n`;
}
console.log('\n' + out);