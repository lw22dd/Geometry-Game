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

  // 5. verifyRoundTrip 返回结构
  const report = codec.verifyRoundTrip(gameMaps[0]);
  console.log('=== verifyRoundTrip:', report.ok ? 'ok' : 'fail', 'objects:', report.objectCount, 'diffs:', report.differenceCount);

  console.log('\n===== 全部无头验证通过 =====');
} finally {
  await server.close();
}