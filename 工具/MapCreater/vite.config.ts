/**
 * MapCreater —— 独立地图编辑器（Vite）。
 *
 * 关键：通过 alias `@game/*` 引用外部预制体文件夹（游戏源码 ../../src）。
 * 编辑器不复制任何预制体定义，直接 import 游戏侧的工厂与类型，
 * 游戏新增/修改预制体后，编辑器刷新即可同步。
 */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

/** 本工具目录（工具/MapCreater） */
const toolDir = fileURLToPath(new URL('.', import.meta.url));
/** 游戏源码目录（相对工具目录的 ../../src） */
const gameSrc = fileURLToPath(new URL('../../src/', import.meta.url));

export default defineConfig({
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