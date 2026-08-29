/**
 * 一次性工具：将 src/config/level.ts 中《2D地图设计》(mvmap-2d-map-design)
 * 的整个地图空间按 x×3、y×1.5 缩放（位置与尺寸同步缩放，保持设计比例）。
 * 运行：node _scripts/scale-mvmap-2d-map-design.mjs
 */
import { readFileSync, writeFileSync } from 'fs';

const FILE = 'src/config/level.ts';
const SX = 3;
const SY = 1.5;

const text = readFileSync(FILE, 'utf8');
const lines = text.split('\n');

/** 数字格式化：4 位小数取整，去掉多余尾零，保持整数为整数 */
function fmt(n) {
  const r = Math.round(n * 10000) / 10000;
  return String(r);
}

// ── 定位《2D地图设计》地图对象块（从包含 id 那行向上找 `{`，再做花括号配对）──
const idIdx = lines.findIndex((l) => l.includes("id: 'mvmap-2d-map-design'"));
if (idIdx < 0) throw new Error('未找到地图 id');
let start = idIdx - 1;
while (start >= 0 && !lines[start].includes('{')) start--;
if (start < 0) throw new Error('未找到块起始 {');

let depth = 0;
let end = -1;
for (let i = start; i < lines.length; i++) {
  for (const ch of lines[i]) {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
  }
  if (depth === 0) { end = i; break; }
}
if (end < 0) throw new Error('未找到块结束 }');
if (end - start > 300) throw new Error(`块范围异常（${start + 1}–${end + 1} 行）`);

const block = lines.slice(start, end + 1).join('\n');

// ── 按模式变换（各模式互斥，避免重复缩放）──
const sc = (v) => fmt(parseFloat(v) * SX);
const scy = (v) => fmt(parseFloat(v) * SY);

const newBlock = block
  // 地图宽高
  .replace(/width:\s*(\d+(?:\.\d+)?)/, (_, v) => `width: ${sc(v)}`)
  .replace(/height:\s*(\d+(?:\.\d+)?)/, (_, v) => `height: ${scy(v)}`)
  // 独立对象 { x: .., y: .. }（playerSpawn / nova）
  .replace(
    /(\{ x:\s*)([\d.]+)(,\s*y:\s*)([\d.]+)(\s*\})/g,
    (_, p1, x, p2, y, p3) => `${p1}${sc(x)}${p2}${scy(y)}${p3}`,
  )
  // 墙体 R(x, y, w, h)
  .replace(
    /R\(([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\)/g,
    (_, x, y, w, h) => `R(${sc(x)}, ${scy(y)}, ${sc(w)}, ${scy(h)})`,
  )
  // 地板格 { x: .., y: .., w: .., h: .., color: .. }
  .replace(
    /(\{ x:\s*)([\d.]+)(,\s*y:\s*)([\d.]+)(,\s*w:\s*)([\d.]+)(,\s*h:\s*)([\d.]+)(,\s*color:)/g,
    (_, p1, x, p2, y, p3, w, p4, h, p5) =>
      `${p1}${sc(x)}${p2}${scy(y)}${p3}${sc(w)}${p4}${scy(h)}${p5}`,
  )
  // 提示点 [x, y, "文本"]
  .replace(
    /(\[\s*)([\d.]+)(,\s*)([\d.]+)(,\s*")/g,
    (_, p1, x, p2, y, p3) => `${p1}${sc(x)}${p2}${scy(y)}${p3}`,
  );

if (newBlock === block) throw new Error('块内容未发生任何变化，请检查模式匹配');

const out = text.replace(block, newBlock);
writeFileSync(FILE, out);
console.log(`已缩放地图块：第 ${start + 1}–${end + 1} 行（x×${SX}, y×${SY}）`);
