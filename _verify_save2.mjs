// Throwaway verification for SceneEditor save-template middleware (round 2).
import { EventEmitter } from 'node:events';
import { readFileSync, copyFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const se = join(root, '工具', 'SceneEditor');
const mapTplDir = join(se, 'src', 'mapTemplate');
const tplsPath = join(se, 'src', 'templates.ts');

const mod = await import(pathToFileURL(join(se, 'vite.config.ts')).href);
const config = mod.default;
const plugin = config.plugins.find((p) => p && p.name === 'dsh-save-template');
if (!plugin) throw new Error('save plugin not found');

const handlers = [];
plugin.configureServer({ middlewares: { use: (path, handler) => handlers.push({ path, handler }) } });
const mw = handlers.find((h) => h.path === '/__dsh-template-save').handler;

function post(payload) {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = 'POST';
    let out = '';
    const res = {
      setHeader() {},
      statusCode: 200,
      end(d) { out += String(d); resolve({ status: res.statusCode, body: JSON.parse(out || '{}') }); },
    };
    mw(req, res);
    req.emit('data', JSON.stringify(payload));
    req.emit('end');
  });
}

function get() {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = 'GET';
    let out = '';
    const res = {
      setHeader() {},
      statusCode: 200,
      end(d) { out += String(d); resolve({ status: res.statusCode, body: JSON.parse(out || '{}') }); },
    };
    mw(req, res);
    req.emit('end');
  });
}

const mkMap = (id, name) => ({
  version: 2, id, name, width: 10, height: 10,
  playerSpawn: { x: 1, y: 1 },
  layers: { geometry: [], objects: [], floorCells: null, gridSize: 1 },
});

const backup = (p) => { if (existsSync(p)) copyFileSync(p, p + '.bak'); };
backup(join(mapTplDir, '2d.ts'));
backup(tplsPath);

const results = [];
try {
  // Simulate the full "new map from blank" flow:
  // save#1 creates file (server returns id+updated:false) -> client syncs id
  // save#2 (id now = slug) must OVERWRITE, not create a duplicate.
  let openMapId = 'empty'; // what the open map looks like after loading blank canvas
  const filesBefore2 = readdirSync(mapTplDir).sort();
  const r1 = await post({ name: 'NewTestMap', icon: 'Star', desc: '', data: mkMap(openMapId, 'NewTestMap') });
  const b1 = r1.body;
  openMapId = b1.id; // client: setMapMeta({ id: b1.id, name })
  const filesMid = readdirSync(mapTplDir).sort();
  const r2 = await post({ name: 'NewTestMap', icon: 'Star', desc: '', data: mkMap(openMapId, 'NewTestMap') });
  const b2 = r2.body;
  const filesAfter = readdirSync(mapTplDir).sort();
  results.push([
    'A 空白画布首次保存新建文件，再保存应覆盖不产生副本',
    b1.ok === true && b1.updated === false && b1.fileName === 'newtestmap.ts'
      && b2.ok === true && b2.updated === true && b2.fileName === 'newtestmap.ts'
      && filesAfter.length === filesBefore2.length + 1
      && JSON.stringify(filesMid) === JSON.stringify(filesAfter),
    JSON.stringify({ save1: { id: b1.id, updated: b1.updated, fileName: b1.fileName }, save2: { id: b2.id, updated: b2.updated, fileName: b2.fileName }, newFiles: filesAfter.filter((f) => !filesBefore2.includes(f)) }),
  ]);

  // Existing registered map still overwrites (regression).
  const before = readFileSync(join(mapTplDir, '2d.ts'), 'utf8');
  const filesB3 = readdirSync(mapTplDir).sort();
  const r3 = await post({ name: '2D地图设计 · 底图改', icon: 'Star', desc: '', data: mkMap('2d', '2D地图设计 · 底图改') });
  const b3 = r3.body;
  const filesA3 = readdirSync(mapTplDir).sort();
  results.push([
    'B 编辑既有地图(2d)仍覆盖原文件、不新增',
    b3.ok === true && b3.updated === true && b3.fileName === '2d.ts'
      && JSON.stringify(filesB3) === JSON.stringify(filesA3)
      && readFileSync(join(mapTplDir, '2d.ts'), 'utf8') !== before,
    JSON.stringify({ updated: b3.updated, fileName: b3.fileName }),
  ]);

  // Blank canvas itself is never destroyed.
  const emptyBefore = readFileSync(join(mapTplDir, 'empty.ts'), 'utf8');
  const r4 = await post({ name: 'FromBlank', icon: 'Star', desc: '', data: mkMap('empty', 'FromBlank') });
  results.push([
    'C 从空白画布(empty)保存不毁空模板',
    r4.body.ok === true && r4.body.updated === false && readFileSync(join(mapTplDir, 'empty.ts'), 'utf8') === emptyBefore,
    JSON.stringify({ id: r4.body.id, fileName: r4.body.fileName }),
  ]);

  // GET returns the authoritative disk registry (incl. the just-created newtestmap;
  // empty IS registered — it is empty.ts's real id, and overwrite-protection is separate).
  const rg = await get();
  const gIds = rg.body.templates.map((t) => t.id);
  results.push([
    'D GET 返回磁盘注册清单（含刚新建的 newtestmap、既有 2d、以及 empty.ts 的 empty）',
    rg.body.ok === true && gIds.includes('newtestmap') && gIds.includes('2d') && gIds.includes('empty') && gIds.length >= 5,
    JSON.stringify(gIds),
  ]);
} finally {
  if (existsSync(join(mapTplDir, '2d.ts.bak'))) {
    copyFileSync(join(mapTplDir, '2d.ts.bak'), join(mapTplDir, '2d.ts'));
    rmSync(join(mapTplDir, '2d.ts.bak'));
  }
  if (existsSync(tplsPath + '.bak')) {
    copyFileSync(tplsPath + '.bak', tplsPath);
    rmSync(tplsPath + '.bak');
  }
  for (const f of ['newtestmap.ts', 'fromblank.ts']) {
    const p = join(mapTplDir, f);
    if (existsSync(p)) rmSync(p);
  }
}

for (const [name, ok, detail] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + '\n    ' + detail);
}
const allOk = results.every((r) => r[1]);
console.log(allOk ? '\n=== ALL PASS ===' : '\n=== SOME FAILED ===');
process.exit(allOk ? 0 : 1);
