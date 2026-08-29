/**
 * MapCreater —— 独立地图编辑器（Vite）。
 *
 * 关键：通过 alias `@game/*` 引用外部预制体文件夹（游戏源码 ../../src）。
 * 编辑器不复制任何预制体定义，直接 import 游戏侧的工厂与类型，
 * 游戏新增/修改预制体后，编辑器刷新即可同步。
 *
 * dev 专用中间件 POST /__dsh-template-save：
 * 「保存为模板」时，浏览器把当前地图 POST 到这里，自动写成
 * src/mapTemplate/<名称>.ts 并注册进 src/templates.ts，
 * 使新模板文件直接出现在源码目录。仅 `npm run dev` 生效；
 * 纯静态构建（build/preview）不含此能力。
 */
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/** 本工具目录（工具/MapCreater） */
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

/** 生成模板源码：唯一 slug → 写文件 → 幂等注册进 templates.ts */
function writeTemplateSource(name: string, icon: string, desc: string, data: unknown): {
  ok: true; fileName: string; constName: string; fileCode: string; registerCode: string;
} {
  const dir = join(toolDir, 'src', 'mapTemplate');

  // 唯一 slug：已存在同名文件时追加 -2/-3…，绝不覆盖已有模板
  const baseSlug = templateSlug(name);
  let slug = baseSlug;
  let n = 1;
  while (existsSync(join(dir, `${slugToFile(slug)}.ts`))) {
    slug = `${baseSlug}-${++n}`;
  }

  const dataConst = `${slugToConst(slug)}_DATA`;
  const constName = `${slugToConst(slug)}_TEMPLATE`;
  const fileName = `${slugToFile(slug)}.ts`;

  // 快照：套用模板 id/name（与内置模板约定一致）
  const snapshot = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
  snapshot.id = slug;
  snapshot.name = name;
  const json = JSON.stringify(snapshot, null, 2);
  const inner = json.slice(1, -1).trim();
  const body = inner.split('\n').map((l) => '  ' + l).join('\n');

  const docSafe = (s: string) => s.replace(/\*\//g, '*\\/');
  const fileCode =
    `import type { MapData } from '../mapTypes';\n` +
    `import type { MapTemplate } from './types';\n\n` +
    `/**\n * ${docSafe(name)}\n * ${docSafe(desc || '（无描述）')}\n */\n` +
    `const ${dataConst}: MapData = {\n${body}\n};\n\n` +
    `/** ${docSafe(name)} —— 模板定义 */\n` +
    `export const ${constName}: MapTemplate = {\n` +
    `  id: ${tsStr(slug)},\n  name: ${tsStr(name)},\n  icon: ${tsStr(icon)},\n  desc: ${tsStr(desc)},\n` +
    `  create: () => JSON.parse(JSON.stringify(${dataConst})) as MapData,\n};\n`;

  const modulePath = fileName.replace(/\.ts$/, '');
  const registerCode =
    `/* ① 在 src/templates.ts 顶部（现有 import 之后）加入： */\n` +
    `import { ${constName} } from './mapTemplate/${modulePath}';\n\n` +
    `/* ② 在 MAP_TEMPLATES 数组里加入一行（与现有模板并列）： */\n` +
    `  ${constName},\n`;

  // 1) 写入模板文件
  writeFileSync(join(dir, fileName), fileCode, 'utf8');

  // 2) 幂等注册进 templates.ts
  const tplPath = join(toolDir, 'src', 'templates.ts');
  const tplSrc = readFileSync(tplPath, 'utf8');
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

  return { ok: true, fileName, constName, fileCode, registerCode };
}

/** dev-only 中间件：POST /__dsh-template-save → 自动生成模板源码文件并注册 */
function saveTemplatePlugin(): Plugin {
  return {
    name: 'dsh-save-template',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dsh-template-save', (req, res) => {
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
            const result = writeTemplateSource(name, icon, desc, parsed.data);
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
