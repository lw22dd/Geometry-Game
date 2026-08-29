/**
 * SceneEditor —— 独立地图编辑器（Vite）。
 *
 * 关键：通过 alias `@game/*` 引用外部预制体文件夹（游戏源码 ../../src）。
 * 编辑器不复制任何预制体定义，直接 import 游戏侧的工厂与类型，
 * 游戏新增/修改预制体后，编辑器刷新即可同步。
 *
 * dev 专用中间件 POST /__dsh-template-save：
 * 「保存」时，浏览器把当前地图 POST 到这里，自动写入 src/mapTemplate/*.ts
 * （所有地图的默认保存路径）：
 *   - 编辑既有地图（data.id 已在 src/mapTemplate 注册）→ 覆盖原文件，不新增；
 *   - 新地图 / 空白画布 → 新建 src/mapTemplate/<名称>.ts 并注册进 src/templates.ts；
 *   - 勾选「另存为新文件」（forceNew=true）→ 即使编辑既有地图也新建副本，不覆盖原文件；
 *   - 首次保存后前端把打开地图的 id 同步为文件 id，后续保存始终覆盖同一文件。
 * 仅 `npm run dev` 生效；纯静态构建（build/preview）不含此能力。
 */
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/** 本工具目录（工具/SceneEditor） */
const toolDir = fileURLToPath(new URL('.', import.meta.url));
/** 游戏源码目录（相对工具目录的 ../../src） */
const gameSrc = fileURLToPath(new URL('../../src/', import.meta.url));

/* ==================== 保存为模板 → 自动写入 src/mapTemplate/*.ts ==================== */

/** 由模板名生成合法 slug（仅保留字母数字，其余转连字符；空则回退 tpl-时间戳） */
function templateSlug(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return base || 'tpl-' + Date.now().toString(36);
}

/** slug → 常量前缀（crystal-caverns → CRYSTAL_CAVERNS；数字开头自动加 TPL_ 前缀保证合法标识符） */
function slugToConst(slug: string): string {
  const upper = slug.replace(/-/g, '_').toUpperCase();
  return /^[0-9]/.test(upper) ? 'TPL_' + upper : upper;
}

/** slug → 文件名驼峰（crystal-caverns → crystalCaverns） */
function slugToFile(slug: string): string {
  return slug.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

/** TS 单引号字符串字面量转义 */
function tsStr(s: string): string {
  return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n') + "'";
}

/** 模板源文件引用（磁盘扫描结果） */
interface TemplateFileRef {
  filePath: string;
  fileName: string;
  id: string;
  constName: string;
}

/** 数据常量名：由模板常量名推导（X_TEMPLATE → X_DATA） */
function dataConstOf(constName: string): string {
  return constName.endsWith('_TEMPLATE')
    ? constName.slice(0, -'_TEMPLATE'.length) + '_DATA'
    : constName + '_DATA';
}

/**
 * 扫描 src/mapTemplate/*.ts（排除 types.ts），解析每个模板文件的 id 与常量名。
 * 作为「编辑既有地图 → 覆盖原文件」的匹配依据：id 是稳定标识，比文件名更可靠
 * （如 twoDMapDesign.ts 的 id 是 '2d-map-design'）。
 */
function scanTemplateFiles(): TemplateFileRef[] {
  const dir = join(toolDir, 'src', 'mapTemplate');
  const out: TemplateFileRef[] = [];
  let names: string[];
  try { names = readdirSync(dir); } catch { return out; }
  for (const f of names) {
    if (!f.endsWith('.ts') || f === 'types.ts') continue;
    const src = readFileSync(join(dir, f), 'utf8');
    const m = /export const (\w+): MapTemplate = \{\s*id:\s*'([^']+)'/s.exec(src);
    if (m) out.push({ filePath: join(dir, f), fileName: f, id: m[2], constName: m[1] });
  }
  return out;
}

/** 生成单个模板文件的完整源码（数据 const + MapTemplate 定义） */
function buildTemplateFileCode(
  constName: string, id: string, name: string, icon: string, desc: string, data: unknown,
): string {
  const dataConst = dataConstOf(constName);
  // 快照：套用模板 id/name（与内置模板约定一致）
  const snapshot = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
  snapshot.id = id;
  snapshot.name = name;
  const json = JSON.stringify(snapshot, null, 2);
  const inner = json.slice(1, -1).trim();
  const body = inner.split('\n').map((l) => '  ' + l).join('\n');

  const docSafe = (s: string) => s.replace(/\*\//g, '*\\/');
  return (
    `import type { MapData } from '../mapTypes';\n` +
    `import type { MapTemplate } from './types';\n\n` +
    `/**\n * ${docSafe(name)}\n * ${docSafe(desc || '（无描述）')}\n */\n` +
    `const ${dataConst}: MapData = {\n${body}\n};\n\n` +
    `/** ${docSafe(name)} —— 模板定义 */\n` +
    `export const ${constName}: MapTemplate = {\n` +
    `  id: ${tsStr(id)},\n  name: ${tsStr(name)},\n  icon: ${tsStr(icon)},\n  desc: ${tsStr(desc)},\n` +
    `  create: () => JSON.parse(JSON.stringify(${dataConst})) as MapData,\n};\n`
  );
}

/** 幂等注册新模板进 templates.ts（import + 数组项；已存在则跳过） */
function registerTemplate(constName: string, fileName: string): void {
  const tplPath = join(toolDir, 'src', 'templates.ts');
  const tplSrc = readFileSync(tplPath, 'utf8');
  const modulePath = fileName.replace(/\.ts$/, '');
  let next = tplSrc;
  const importLine = `import { ${constName} } from './mapTemplate/${modulePath}';`;
  if (!tplSrc.includes(importLine)) {
    const lines = tplSrc.split('\n');
    let lastImp = -1;
    lines.forEach((l, i) => { if (/^import .* from '\.\/mapTemplate\//.test(l)) lastImp = i; });
    lines.splice(lastImp + 1, 0, importLine);
    next = lines.join('\n');
  }
  const arrayItem = `  ${constName},`;
  if (!next.includes(arrayItem)) {
    const lines = next.split('\n');
    const open = lines.findIndex((l) => /export const MAP_TEMPLATES: MapTemplate\[\] = \[/.test(l));
    if (open !== -1) {
      const close = lines.findIndex((l, i) => i > open && /^\s*\]\s*;/.test(l));
      if (close !== -1) {
        lines.splice(close, 0, arrayItem);
        next = lines.join('\n');
      }
    }
  }
  if (next !== tplSrc) writeFileSync(tplPath, next, 'utf8');
}

/**
 * 保存当前地图 → src/mapTemplate/*.ts（所有地图的默认保存路径）：
 *   - 编辑既有地图（data.id 已注册为某模板文件，且非空白模板 'empty'）
 *     → 覆盖原文件，不新增文件；
 *   - 新地图 / forceNew（另存为新模板）→ 生成唯一 slug 新建文件并注册进 templates.ts。
 */
function writeTemplateSource(
  name: string, icon: string, desc: string, data: unknown, forceNew: boolean,
): {
  ok: true; fileName: string; constName: string; id: string; updated: boolean;
  fileCode: string; registerCode: string;
} {
  const dir = join(toolDir, 'src', 'mapTemplate');
  const dataId = typeof (data as { id?: unknown })?.id === 'string' ? (data as { id: string }).id : '';

  // ① 编辑既有地图：id 已存在于 src/mapTemplate 某文件 → 原地覆盖，绝不新增
  //    （'empty' 空白画布是「从零开始」的起点模板，永远新建，避免误毁空白模板）
  if (!forceNew && dataId && dataId !== 'empty') {
    const existing = scanTemplateFiles().find((t) => t.id === dataId);
    if (existing) {
      const fileCode = buildTemplateFileCode(existing.constName, existing.id, name, icon, desc, data);
      writeFileSync(existing.filePath, fileCode, 'utf8');
      // 注册表不变（import 名与数组项保持不变），无需写 templates.ts
      return {
        ok: true, fileName: existing.fileName, constName: existing.constName,
        id: existing.id, updated: true, fileCode, registerCode: '',
      };
    }
  }

  // ② 新地图 / 另存为新模板：唯一 slug → 写文件 → 幂等注册
  const baseSlug = templateSlug(name);
  let slug = baseSlug;
  let n = 1;
  while (existsSync(join(dir, `${slugToFile(slug)}.ts`))) {
    slug = `${baseSlug}-${++n}`;
  }
  const constName = `${slugToConst(slug)}_TEMPLATE`;
  const fileName = `${slugToFile(slug)}.ts`;
  const fileCode = buildTemplateFileCode(constName, slug, name, icon, desc, data);
  writeFileSync(join(dir, fileName), fileCode, 'utf8');
  registerTemplate(constName, fileName);

  const modulePath = fileName.replace(/\.ts$/, '');
  const registerCode =
    `/* ① 在 src/templates.ts 顶部（现有 import 之后）加入： */\n` +
    `import { ${constName} } from './mapTemplate/${modulePath}';\n\n` +
    `/* ② 在 MAP_TEMPLATES 数组里加入一行（与现有模板并列）： */\n` +
    `  ${constName},\n`;

  return { ok: true, fileName, constName, id: slug, updated: false, fileCode, registerCode };
}

/** dev-only 中间件：POST /__dsh-template-save → 自动生成模板源码文件并注册；GET → 返回磁盘上已注册的模板 id 清单 */
function saveTemplatePlugin(): Plugin {
  return {
    name: 'dsh-save-template',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dsh-template-save', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        // GET：返回 src/mapTemplate 磁盘上已注册的模板清单（权威 id → 文件映射）。
        // 前端用它判断「当前地图是否已是已存在地图」，避免依赖打包时的静态 MAP_TEMPLATES。
        if (req.method === 'GET') {
          res.end(JSON.stringify({
            ok: true,
            templates: scanTemplateFiles().map((t) => ({ id: t.id, fileName: t.fileName, constName: t.constName })),
          }));
          return;
        }
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
          res.setHeader('Content-Type', 'application/json');
          try {
            const parsed = JSON.parse(body || '{}');
            const name = String(parsed.name ?? '').trim();
            const icon = String(parsed.icon ?? 'Star');
            const desc = String(parsed.desc ?? '').trim();
            if (!name || !parsed.data) {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, error: '缺少 name 或 data' }));
              return;
            }
            // forceNew=true（「另存为新文件」）→ 强制走新建分支，不覆盖现有地图
            const forceNew = parsed.forceNew === true;
            const result = writeTemplateSource(name, icon, desc, parsed.data, forceNew);
            res.end(JSON.stringify(result));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: String((e as Error)?.message ?? e) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [saveTemplatePlugin()],
  resolve: {
    alias: {
      '@game': gameSrc,
    },
  },
  server: {
    // 允许跨项目读取游戏源码（vite 默认只允许项目根目录）
    fs: {
      allow: [gameSrc, toolDir],
    },
  },
});
