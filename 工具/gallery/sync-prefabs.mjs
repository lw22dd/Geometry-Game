#!/usr/bin/env node
/**
 * sync-prefabs.mjs —— 预制体图鉴数据同步脚本
 *
 * 扫描游戏 src/Prefabs 文件夹，解析出各分类预制体清单（角色 / 收集品 / 敌人 / 特效），
 * 生成 prefabs-data.js 供 prefab-gallery.html 展示。
 *
 * 用法：node sync-prefabs.mjs
 *
 * 新增预制体（角色、道具、敌人、特效）后重新运行本脚本，刷新 HTML 即可及时展示。
 * 机关 / 平台 / 装饰以静态清单保留（它们在 Scenes 中为绘制函数，无结构化数据）。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PREFABS = resolve(HERE, '../../src/Prefabs');
const OUT = join(HERE, 'prefabs-data.js');

/* ═══════════ 工具 ═══════════ */

const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };

/** 提取所有 "key: 'value'" */
function kvPairs(src) {
  const out = [];
  const re = /([A-Za-z0-9_]+)\s*:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(src))) out.push({ key: m[1], value: m[2] });
  return out;
}

/** 提取字符串数组 ["a","b",...]（可能跨行） */
function strArray(src, name) {
  const re = new RegExp(name + '\\s*:\\s*\\[([\\s\\S]*?)\\]', 'g');
  const m = re.exec(src);
  if (!m) return null;
  const arr = [];
  const re2 = /'([^']+)'/g;
  let mm;
  while ((mm = re2.exec(m[1]))) arr.push(mm[1]);
  return arr;
}

/** 提取单一字符串值 key: 'value' */
function strVal(src, name) {
  const re = new RegExp(name + "\\s*:\\s*'([^']+)'");
  const m = re.exec(src);
  return m ? m[1] : null;
}

/** 提取单个数字 key: 22 */
function numVal(src, name) {
  const re = new RegExp(name + '\\s*:\\s*(-?\\d+(?:\\.\\d+)?)');
  const m = re.exec(src);
  return m ? parseFloat(m[1]) : null;
}

/** 提取数字数组 key: [4, 13]（可能跨行） */
function numArr(src, name) {
  const re = new RegExp(name + '\\s*:\\s*\\[([\\s\\S]*?)\\]');
  const m = re.exec(src);
  if (!m) return null;
  const nums = [];
  const re2 = /-?\d+(?:\.\d+)?/g;
  let mm;
  while ((mm = re2.exec(m[1]))) nums.push(parseFloat(mm[0]));
  return nums;
}

/* ═══════════ 分类构建 ═══════════ */

const categories = [];

/* ── 角色：Player/characters/*.ts ── */
function buildCharacters() {
  const dir = join(PREFABS, 'Player/characters');
  if (!existsSync(dir)) return;
  const items = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.ts') || f === 'index.ts') continue;
    const src = read(join(dir, f));
    // 每个 CharacterStyle 对象
    const re = /:\s*CharacterStyle\s*=\s*\{([\s\S]*?)\n\};/g;
    let m;
    while ((m = re.exec(src))) {
      const body = m[1];
      const id = strVal(body, 'id');
      const name = strVal(body, 'name') || id;
      const bodyGrad = strArray(body, 'bodyGrad');
      const stroke = strVal(body, 'stroke') || 'rgba(255,255,255,.55)';
      const glow = strVal(body, 'glow') || 'rgba(120,200,255,.95)';
      const eyeColor = strVal(body, 'eyeColor') || '#1a1440';
      if (id) items.push({ id, name, bodyGrad, stroke, glow, eyeColor, file: 'Player/characters/' + f });
    }
  }
  if (items.length) categories.push({ id: 'characters', title: '角色', source: 'Player/characters', items });
}

/* ── 收集品：ItemVis/index.ts（道具）+ WeaponVis/index.ts（武器） ── */
function buildCollectibles() {
  const items = [];
  const itemSrc = read(join(PREFABS, 'ItemVis/index.ts'));
  const weaponSrc = read(join(PREFABS, 'WeaponVis/index.ts'));

  // 道具 id → 名称映射（ItemVis 内无中文名，这里维护展示名）
  const ITEM_NAME = {
    doubleJump: '双跳光球',
    hook: '钩锁道具',
    shield: '护盾道具',
    speed: '加速道具',
    recall: '重置箭头',
  };
  // 道具发光色（ITEM_GLOW 表）
  const glowMap = {};
  const glowRe = /ITEM_GLOW[\s\S]*?=\s*\{([\s\S]*?)\n\};/;
  const gm = glowRe.exec(itemSrc);
  if (gm) {
    const glowRe2 = /([A-Za-z0-9_]+)\s*:\s*'([^']+)'/g;
    let mm;
    while ((mm = glowRe2.exec(gm[1]))) glowMap[mm[1]] = mm[2];
  }
  for (const [id, name] of Object.entries(ITEM_NAME)) {
    if (itemSrc.includes("'" + id + "'") || itemSrc.includes('case \'' + id + '\'')) {
      items.push({ id, name, glow: glowMap[id] || 'rgba(120,230,255,.9)', file: 'ItemVis/index.ts' });
    }
  }

  // 武器（ak / grenade / shotgun / awm / rocket / iceBomb）
  const WEAPON_NAME = {
    ak: 'AK 步枪',
    grenade: '手雷',
    shotgun: '短管霰弹枪',
    awm: 'AWM 狙击枪',
    rocket: '火箭筒',
    iceBomb: '冰冻炸弹',
  };
  const WEAPON_GLOW = {
    ak: 'rgba(255,150,60,.9)',
    grenade: 'rgba(150,255,140,.9)',
    shotgun: 'rgba(255,120,70,.9)',
    awm: 'rgba(140,220,255,.9)',
    rocket: 'rgba(255,190,90,.9)',
    iceBomb: 'rgba(120,220,255,.9)',
  };
  for (const [id, name] of Object.entries(WEAPON_NAME)) {
    if (weaponSrc.includes("'" + id + "'")) {
      items.push({ id, name, glow: WEAPON_GLOW[id], file: 'WeaponVis/index.ts' });
    }
  }

  // 场景固定收集品（光球 / NOVA / 检查点 / 密码机 / 宝箱）
  const STATIC_COLLECT = [
    { id: 'orb', name: '光球', file: 'Scenes/items.ts' },
    { id: 'nova', name: 'NOVA 星', file: 'Scenes/items.ts' },
    { id: 'checkpoint', name: '检查点', file: 'Scenes/items.ts' },
    { id: 'cipher', name: '密码机（破译中）', file: 'Scenes/items.ts' },
    { id: 'cipherDone', name: '密码机（已完成）', file: 'Scenes/items.ts' },
    { id: 'chestReady', name: '宝箱（可开启）', file: 'Scenes/items.ts' },
    { id: 'chestCooling', name: '宝箱（冷却中）', file: 'Scenes/items.ts' },
    { id: 'chestOpen', name: '宝箱（开启中）', file: 'Scenes/items.ts' },
  ];
  items.push(...STATIC_COLLECT);

  if (items.length) categories.push({ id: 'collectibles', title: '收集品', source: 'ItemVis + WeaponVis + Scenes', items });
}

/**
 * 从对象字面量中按顶层键提取 { key: { ... } } 条目（兼容 CRLF / 嵌套对象 / `} satisfies X` 后缀）。
 * @param src 源码文本
 * @param containerStart 顶层对象起始大括号的索引（指向 '{'）
 * @returns { key: string; body: string }[]（body 为该键对应对象的内部文本）
 */
function extractObjectEntries(src, containerStart) {
  // 找到 containerStart 对应大括号的闭合位置（括号配对）
  let depth = 0, containerEnd = -1;
  for (let i = containerStart; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { containerEnd = i; break; } }
  }
  if (containerEnd < 0) return [];
  const inner = src.slice(containerStart + 1, containerEnd);

  const out = [];
  // 顶层键：行首（允许缩进）key: { 开头的条目
  const re = /(?:^|\n)\s*([A-Za-z0-9_]+)\s*:\s*\{/g;
  let m;
  // 最近一个已收条目的 [起点, 闭括号] 区间：嵌套键（如 fuse/melee/rock 子配置）落在其中 → 跳过
  let lastStart = -1, lastEnd = -1;
  while ((m = re.exec(inner))) {
    const key = m[1];
    const openIdx = inner.indexOf('{', m.index);
    if (openIdx < 0) continue;
    // 括号配对找该条目的结束
    let d = 0, end = -1;
    for (let i = openIdx; i < inner.length; i++) {
      const c = inner[i];
      if (c === '{') d++;
      else if (c === '}') { d--; if (d === 0) { end = i; break; } }
    }
    if (end < 0) continue;
    // 嵌套键（位于上一条目内部）→ 非顶层条目，跳过
    if (lastStart >= 0 && openIdx > lastStart && openIdx < lastEnd) continue;
    lastStart = m.index; lastEnd = end;
    const body = inner.slice(openIdx + 1, end);
    out.push({ key, body });
  }
  return out;
}

/* ── 敌人：Enemy/kinds.ts ── */
function buildEnemies() {
  const src = read(join(PREFABS, 'Enemy/kinds.ts'));
  if (!src) return;
  const items = [];
  // 用赋值声明定位（避免注释中的 ENEMY_KINDS 字样误匹配）
  const decl = src.match(/ENEMY_KINDS\s*[:=]/);
  const containerStart = decl ? src.indexOf('{', decl.index) : src.indexOf('{', src.indexOf('ENEMY_KINDS'));
  if (containerStart < 0) return;
  for (const { key: id, body } of extractObjectEntries(src, containerStart)) {
    const name = strVal(body, 'name') || id;
    const bodyGrad = strArray(body, 'bodyGrad');
    const glow = strVal(body, 'glow') || 'rgba(255,110,80,.9)';
    items.push({ id, name, bodyGrad, glow, file: 'Enemy/kinds.ts' });
  }
  if (items.length) categories.push({ id: 'enemies', title: '敌人', source: 'Enemy/kinds.ts', items });
}

/* ── 特效：Fx/presets.ts ── */
function buildFx() {
  const src = read(join(PREFABS, 'Fx/presets.ts'));
  if (!src) return;
  const items = [];
  const containerStart = src.indexOf('export const FX');
  const openIdx = src.indexOf('{', containerStart);
  if (openIdx < 0) return;
  for (const { key: id, body } of extractObjectEntries(src, openIdx)) {
    const colors = strArray(body, 'colors');
    const kind = strVal(body, 'kind') || 'dot';
    const count = numVal(body, 'count') || 12;
    const gravity = numVal(body, 'gravity') || 0;
    const life = numArr(body, 'life');
    const size = numArr(body, 'size');
    const r0 = numArr(body, 'r0');
    const r1 = numArr(body, 'r1');
    const lw = numVal(body, 'lw');
    // vel 对象：提取 mode / speed / vx / vy / vyBias / uniform
    let vel = null;
    const velRe = /vel\s*:\s*\{([\s\S]*?)\n?\s*\}/;
    const velBody = velRe.exec(body);
    if (velBody) {
      vel = { mode: strVal(velBody[1], 'mode') || 'radial' };
      const speed = numArr(velBody[1], 'speed');
      const vx = numArr(velBody[1], 'vx');
      const vy = numArr(velBody[1], 'vy');
      if (speed) vel.speed = speed;
      if (vx) vel.vx = vx;
      if (vy) vel.vy = vy;
      const vyBias = numVal(velBody[1], 'vyBias');
      if (vyBias != null) vel.vyBias = vyBias;
    }
    // 展示 id：与收集品的 doubleJump 区分（特效侧加 Fx 后缀）
    const displayId = id === 'doubleJump' ? 'doubleJumpFx' : id;
    items.push({
      id: displayId,
      name: FX_NAME[id] || id,
      fx: {
        count,
        kind,
        colors: colors || ['#ffffff'],
        gravity,
        life,
        size,
        vel,
        r0,
        r1,
        lw,
      },
      file: 'Fx/presets.ts',
    });
  }
  if (items.length) categories.push({ id: 'fx', title: '特效', source: 'Fx/presets.ts', items });
}

/* 特效展示名映射（Fx/presets.ts 内为纯数据，无中文名，这里维护展示名） */
const FX_NAME = {
  death: '死亡爆裂',
  dust: '落地尘土',
  sparkle: '收集闪光',
  cp: '检查点光柱',
  confetti: '通关彩带',
  arrowBoost: '双跳增益环绕',
  doubleJump: '二段跳触发',
  shieldBreak: '护盾破碎',
  speedBoost: '加速冲刺',
  orbAmbient: '光球环境光尘',
  springBurst: '弹簧弹射火花',
  laserHit: '激光命中火花',
  novaPulse: 'NOVA 通关脉冲',
  deathShock: '死亡冲击波',
  shieldRing: '破盾环',
  dashStreak: '冲刺火花',
  muzzleFlash: '枪口火光',
  hitSpark: '命中火花',
  weaponSpark: '武器拾取闪光',
  grenadeBoom: '手雷爆炸',
  grenadeShock: '手雷冲击环',
  enemyDeath: '敌人死亡爆裂',
};

/* ── 机关 / 平台 / 装饰：静态清单（Scenes 绘制函数） ── */
function buildScenes() {
  const scenesSrc = read(join(PREFABS, 'Scenes/index.ts'));

  const HAZARDS = [
    { id: 'laser', name: '激光栅栏', fn: 'drawLasers' },
    { id: 'spike', name: '尖刺', fn: 'drawSpikes' },
    { id: 'springPadV', name: '垂直弹簧', fn: 'drawSpringPads' },
    { id: 'springPadH', name: '水平弹簧', fn: 'drawSpringPads' },
  ].filter(h => scenesSrc.includes(h.fn)).map(h => ({ id: h.id, name: h.name, file: 'Scenes/hazards.ts + platforms.ts' }));

  const PLATFORMS = [
    { id: 'solid', name: '静态平台', fn: 'drawSolids' },
    { id: 'mover', name: '移动平台', fn: 'drawMovers' },
    { id: 'track', name: '玻璃管道', fn: 'drawTracks' },
    { id: 'deco', name: '装饰方块', fn: 'drawDecos' },
    { id: 'hint', name: '提示文字', fn: 'drawHints' },
  ].filter(p => scenesSrc.includes(p.fn)).map(p => ({ id: p.id, name: p.name, file: 'Scenes/platforms.ts + atmosphere.ts' }));

  if (HAZARDS.length) categories.push({ id: 'hazards', title: '机关', source: 'Scenes/hazards.ts', items: HAZARDS });
  if (PLATFORMS.length) categories.push({ id: 'platforms', title: '平台与装饰', source: 'Scenes/platforms.ts + atmosphere.ts', items: PLATFORMS });
}

/* ═══════════ 执行 ═══════════ */

buildCharacters();
buildCollectibles();
buildEnemies();
buildFx();
buildScenes();

const data = {
  generatedAt: new Date().toISOString(),
  source: 'src/Prefabs',
  categories,
};

const out = '/* 由 sync-prefabs.mjs 自动生成，请勿手动编辑 */\n'
  + 'window.PREFABS_DATA = ' + JSON.stringify(data, null, 2) + ';\n';

writeFileSync(OUT, out, 'utf8');

console.log('✅ 已生成 ' + OUT);
console.log('   分类数：' + categories.length);
for (const c of categories) {
  console.log('   - ' + c.title + '（' + c.source + '）：' + c.items.length + ' 项');
}
console.log('   刷新 prefab-gallery.html 即可查看最新内容。');
