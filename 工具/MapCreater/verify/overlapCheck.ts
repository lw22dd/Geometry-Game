/**
 * 场景重叠检查脚本（无头，Vite SSR 加载真实模块）。
 *
 * 通用性：不针对特定地图写死，任何 v2/v1 地图 JSON 均可传入检查；
 * 核心逻辑与编辑器内「重叠检查」按钮共用 src/overlapCheck.ts 的 checkMap
 * （规则见该模块注释：道具嵌地形=错误，机关嵌地形/对象互叠=警告，几何互叠=信息）。
 *
 * 运行方式（MapCreater 目录下）：
 *   npx tsx verify/overlapCheck.ts                  # 检查 游戏地图 + 全部模板
 *   npx tsx verify/overlapCheck.ts path/to/map.json # 检查导出的 v2/v1 地图文件
 *
 * 退出码：发现错误 → 1；仅警告/信息 → 0。
 */
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

/* ===== 极简 DOM mock（io.ts 模块加载需要 document/window） ===== */
const noop = (): any => undefined;
const dummyCtx: any = new Proxy({}, { get: () => noop, set: () => true });
const dummyCanvas: any = {
  width: 0, height: 0, style: {}, parentElement: { clientWidth: 1280, clientHeight: 720 },
  getContext: () => dummyCtx,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
  addEventListener: noop, removeEventListener: noop,
};
(globalThis as any).document = {
  getElementById: (id: string) => (id === 'c' ? dummyCanvas : null),
  createElement: () => dummyCanvas,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: noop, removeEventListener: noop,
};
(globalThis as any).window = {
  devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720,
  addEventListener: noop, removeEventListener: noop,
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  AudioContext: undefined, webkitAudioContext: undefined,
};
(globalThis as any).addEventListener = noop;
(globalThis as any).innerWidth = 1280;
(globalThis as any).innerHeight = 720;
(globalThis as any).devicePixelRatio = 1;

/* ==================== 输出 ==================== */

function render(results: { name: string; issues: { severity: 'error' | 'warn' | 'info'; kind: string; detail: string }[] }[]): void {
  let totalErrors = 0, totalWarns = 0;
  for (const r of results) {
    const errors = r.issues.filter(i => i.severity === 'error');
    const warns = r.issues.filter(i => i.severity === 'warn');
    const infos = r.issues.filter(i => i.severity === 'info');
    totalErrors += errors.length;
    totalWarns += warns.length;
    console.log(`\n=== ${r.name}（${errors.length} 错误 / ${warns.length} 警告 / ${infos.length} 提示）===`);
    for (const e of errors) console.log(`  ❌ [${e.kind}] ${e.detail}`);
    for (const w of warns) console.log(`  ⚠️  [${w.kind}] ${w.detail}`);
    for (const i of infos) console.log(`  ℹ️  [${i.kind}] ${i.detail}`);
    if (errors.length === 0 && warns.length === 0) console.log('  ✅ 无重叠问题');
  }
  console.log(`\n===== 汇总：${totalErrors} 个错误 / ${totalWarns} 个警告 =====`);
  process.exitCode = totalErrors > 0 ? 1 : 0;
}

/* ==================== 入口 ==================== */

const server = await createServer({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  root: fileURLToPath(new URL('..', import.meta.url)),
  server: { middlewareMode: true },
});

try {
  const io = await server.ssrLoadModule('/src/io.ts');
  const codec = await server.ssrLoadModule('/src/mapCodec.ts');
  const tplMod = await server.ssrLoadModule('/src/templates.ts');
  const mt = await server.ssrLoadModule('/src/mapTypes.ts');
  const oc = await server.ssrLoadModule('/src/overlapCheck.ts');

  const candidates: { name: string; data: any }[] = [];

  const gameMaps = io.getGameMaps();
  for (let i = 0; i < gameMaps.length; i++) {
    candidates.push({ name: `[游戏] ${gameMaps[i].name}`, data: codec.decompileMapDefinition(gameMaps[i]) });
  }

  for (const tpl of tplMod.MAP_TEMPLATES) {
    candidates.push({ name: `[模板] ${tpl.name}`, data: tpl.create() });
  }

  const fileArg = process.argv.slice(2).find(a => !a.startsWith('-'));
  if (fileArg) {
    const abs = path.resolve(process.cwd(), fileArg);
    const raw = JSON.parse(readFileSync(abs, 'utf-8'));
    candidates.push({ name: `[文件] ${path.basename(abs)}`, data: mt.migrateMapData(raw) });
  }

  const results = candidates.map(c => ({ name: c.name, issues: oc.checkMap(c.data).issues }));
  render(results);
} finally {
  await server.close();
}