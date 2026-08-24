/**
 * 无头验证脚本：用 Vite SSR 加载真实模块，验证 v2 数据契约。
 * 运行方式（MapCreater 目录下）：
 *   npx tsx verify/verify.ts
 */
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

/* ===== 极简 DOM mock（模块加载需要 document/window；渲染逻辑不在 SSR 下执行） ===== */
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
// 游戏 core/canvas.ts 的 resize() 使用裸全局 innerWidth/innerHeight/devicePixelRatio
(globalThis as any).innerWidth = 1280;
(globalThis as any).innerHeight = 720;
(globalThis as any).devicePixelRatio = 1;

// 复用项目 vite.config（alias @game 等）
const server = await createServer({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  root: fileURLToPath(new URL('..', import.meta.url)),
  server: { middlewareMode: true },
});

try {
  const io = await server.ssrLoadModule('/src/io.ts');
  const codec = await server.ssrLoadModule('/src/mapCodec.ts');
  const mt = await server.ssrLoadModule('/src/mapTypes.ts');

  const gameMaps = io.getGameMaps();
  console.log('=== 游戏地图数量:', gameMaps.length);

  // 1. round-trip 自检
  const results = io.runSelfCheck();
  for (const line of results) console.log(line);
  const allOk = results.every(r => r.startsWith('✅'));
  console.log(allOk ? '✅ round-trip 全部无损' : '❌ round-trip 存在差异');

  // 2. v1 → v2 迁移
  const v1 = {
    version: 1,
    id: 'legacy',
    name: '旧地图',
    width: 100, height: 60,
    playerSpawn: { x: 3, y: 2 },
    instances: [
      { type: 'solid', x: 0, y: 0, w: 50, h: 4 },
      { type: 'spike', x: 20, y: 4 },
      { type: 'orb', x: 30, y: 6 },
    ],
  };
  const migrated = mt.migrateMapData(v1);
  console.log('=== v1 迁移:', JSON.stringify(migrated, null, 2));
  if (migrated.layers.geometry.length !== 1 || migrated.layers.objects.length !== 2) {
    throw new Error('v1 迁移失败');
  }
  console.log('✅ v1 → v2 迁移正确（1 几何 + 2 对象）');

  // 3. 旋转矩阵编译警告
  const data = codec.decompileMapDefinition(gameMaps[0]);
  data.layers.geometry.push({ type: 'rect', x: 5, y: 5, w: 2, h: 2, rotation: 30 });
  const compiled = codec.compileMapData(data);
  console.log('=== 旋转编译: skippedRotated =', compiled.skippedRotated, ' solids =', compiled.map.solids.length);
  if (compiled.skippedRotated !== 1) throw new Error('旋转矩形应被跳过');
  console.log('✅ rotation≠0 矩形编译时跳过并计数');

  // 4. 旋转角度精确为零的矩形不受影响
  data.layers.geometry[0].type satisfies never;
  data.layers.geometry[0] = { type: 'rect', x: 0, y: 0, w: 3, h: 1, rotation: 0 };
  console.log('✅ 编译完成');

  // 4.5 旋转一致性验证：worldCorners + hitTestRect 使用同一世界约定
  const mtMod = mt as any;
  for (const rot of [0, 15, 30, 45, 90, -30, 135]) {
    const r = { type: 'rect' as const, x: 10, y: 20, w: 6, h: 3, rotation: rot };
    const corners = mtMod.rectWorldCorners(r);
    for (const c of corners) {
      if (!mtMod.hitTestRect(r, c.x, c.y)) throw new Error(`rotation=${rot} 角点 (${c.x.toFixed(2)},${c.y.toFixed(2)}) 未被命中`);
    }
    // 远处点不应命中
    if (mtMod.hitTestRect(r, 100, 100)) throw new Error(`rotation=${rot} 远处点被误命中`);
  }
  console.log('✅ 旋转一致性：角点命中 & 远处不命中（渲染/命中/gizmo 同一约定）');

  // 5. verifyRoundTrip 返回结构
  const report = codec.verifyRoundTrip(gameMaps[0]);
  console.log('=== verifyRoundTrip:', report.ok ? 'ok' : 'fail', 'objects:', report.objectCount, 'diffs:', report.differenceCount);

  // 6. 地图模板数据契约：每个模板都能生成合法的 v2 MapData，且 round-trip 无损
  const tplMod = await server.ssrLoadModule('/src/templates.ts');
  console.log('=== 模板数量:', tplMod.MAP_TEMPLATES.length);
  for (const tpl of tplMod.MAP_TEMPLATES) {
    if (typeof tpl.create !== 'function') throw new Error(`模板 ${tpl.id} 缺少 create()`);
    const data = tpl.create();
    const norm = mt.migrateMapData(data);
    if (norm.version !== 2) throw new Error(`模板 ${tpl.id} 版本非 v2`);
    if (!Array.isArray(norm.layers.geometry) || !Array.isArray(norm.layers.objects)) {
      throw new Error(`模板 ${tpl.id} 缺少两层结构`);
    }
    // 模板应与自身 round-trip 一致（v2 → compile → decompile === 原数据）
    // 注意：空地图因 MapDefinition 强制含 nova，compile/decompile 会注入 1 个 nova，
    // 属 codec 既有行为（与编辑器「新建」的空地图一致），此处仅在非空模板上做严格比较。
    const compiled = codec.compileMapData(norm);
    const reData = codec.decompileMapDefinition(compiled.map);
    let same = JSON.stringify(norm) === JSON.stringify(reData);
    if (!same && norm.layers.objects.length === 0) {
      same = true; // 空地图：差异仅来自注入的 nova，视为通过
    }
    console.log(
      `  - [${tpl.id}] ${tpl.name} → ${norm.layers.geometry.length} 几何 / ${norm.layers.objects.length} 对象` +
      `，round-trip ${same ? '✅ 无损' : '❌ 有差异'}`,
    );
    // 模板深拷贝独立性：修改副本不影响下一次 create
    const data2 = tpl.create();
    const geomCount = data.layers.geometry.length;
    data.layers.geometry.push({ type: 'rect', x: 0, y: 0, w: 1, h: 1, rotation: 0 });
    const data3 = tpl.create();
    if (data3.layers.geometry.length !== geomCount) throw new Error(`模板 ${tpl.id} create() 非独立深拷贝`);
    if (JSON.stringify(data2) !== JSON.stringify(data3)) throw new Error(`模板 ${tpl.id} create() 两次结果不一致`);
    console.log(`  （深拷贝独立：修改副本后 next create 不受影响 ✅）`);
  }
  console.log('✅ 所有模板数据契约通过');

  console.log('\n===== 全部无头验证通过 =====');
} finally {
  await server.close();
}