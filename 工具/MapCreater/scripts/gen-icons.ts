/**
 * 从 tdesign-icons-svg 生成图标模块 src/td-icons.ts
 * 运行：npx tsx scripts/gen-icons.ts
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import * as path from 'node:path';

const SRC = path.resolve('node_modules/tdesign-icons-svg/src');
const OUT = path.resolve('src/td-icons.ts');

// 需要的图标（文件名 → 导出常量名）
const NEEDED: Record<string, string> = {
  'add': 'Add',
  'file-add': 'FileAdd',
  'folder-open': 'FolderOpen',
  'save': 'Save',
  'rollback': 'Undo',
  'rollfront': 'Redo',
  'copy': 'Copy',
  'file-paste': 'FilePaste',
  'delete': 'Delete',
  'download': 'Download',
  'upload': 'Upload',
  'template': 'Template',
  'file': 'File',
  'edit-1': 'Edit',
  'view-module': 'ViewModule',
  'help-circle': 'HelpCircle',
  'check-circle': 'CheckCircle',
  'rectangle': 'Rectangle',
  'cursor': 'Cursor',
  'circle': 'Circle',
  'flag': 'Flag',
  'move': 'Move',
  'thunder': 'Thunder',
  'arrow-up': 'ArrowUp',
  'arrow-right': 'ArrowRight',
  'error-triangle': 'AlertTriangle',
  'module': 'Module',
  'chat-message': 'ChatMessage',
  'star': 'Star',
  'gift': 'Gift',
  'lock-on': 'LockOn',
  'lock-off': 'LockOff',
  'zoom-in': 'ZoomIn',
  'refresh': 'Refresh',
  'close': 'Close',
  'map': 'Map',
  'folder': 'Folder',
  'layers': 'Layers',
  'tools': 'Tools',
  'palette': 'Palette',
  'scan': 'Scan',
  'pin': 'Pin',
  'thumb-up': 'ThumbUp',
  'tips': 'Tips',
  'menu': 'Menu',
  'edit': 'EditPen',
  'setting': 'Setting',
  'remove': 'Remove',
  'add-circle': 'AddCircle',
  'error-circle': 'ErrorCircle',
  'info-circle': 'InfoCircle',
  'error-triangle': 'AlertTriangle',
  'check': 'Check',
  'search': 'Search',
  'location': 'Location',
  'home': 'Home',
};

function loadSvg(fileName: string): string | null {
  const p = path.join(SRC, `${fileName}.svg`);
  if (!existsSync(p)) return null;
  let content = readFileSync(p, 'utf-8');
  // 规范化：view-box → viewBox（HTML 标准 camelCase）
  content = content.replace(/view-box=/g, 'viewBox=');
  // 提取 <svg> 内部的全部内容（不含 <svg> 标签本身）
  const m = content.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  if (!m) return null;
  return m[1].trim();
}

let out = `/**
 * 自动生成的 TDesign 图标模块（由 scripts/gen-icons.ts 生成）。
 * 请勿手动编辑。
 */
export type IconName = ${Object.values(NEEDED).map(n => `'${n}'`).join(' | ')};

export interface IconDef {
  name: string;
  svg: string;
}

const registry = new Map<string, IconDef>();

function reg(name: string, svgContent: string): void {
  registry.set(name, {
    name,
    svg: \`<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-linecap="square" stroke-width="2" stroke-linejoin="miter">\${svgContent}</svg>\`,
  });
}

`;

for (const [fileName, constName] of Object.entries(NEEDED)) {
  const svgContent = loadSvg(fileName);
  if (svgContent === null) {
    console.warn(`⚠  Not found: ${fileName}.svg`);
    out += `// ${fileName}.svg not found\n`;
    continue;
  }
  // 简化：去掉 g 标签的 id 和包裹，只保留结构
  const cleaned = svgContent.replace(/<g[^>]*>/g, '').replace(/<\/g>/g, '');
  out += `reg('${constName}', \`${cleaned}\`);\n`;
}

out += `
export function getIcon(name: string): IconDef | undefined {
  return registry.get(name);
}

export function renderIcon(name: string, size = 18): string {
  const def = registry.get(name);
  if (!def) return '';
  return def.svg
    .replace('width="1em"', \`width="\${size}"\`)
    .replace('height="1em"', \`height="\${size}"\`);
}
`;

writeFileSync(OUT, out, 'utf-8');
console.log(`✅ Generated ${OUT} (${Object.keys(NEEDED).length} icons)`);