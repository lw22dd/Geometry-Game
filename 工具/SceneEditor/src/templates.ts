/**
 * 地图模板注册表 —— 编辑器「从模板新建」功能的数据源。
 *
 * 每个模板是一个独立副本的 MapData v2，由 create() 工厂返回深拷贝，
 * 确保多次应用模板互不干扰（编辑不会污染模板源数据）。
 *
 * 模板数据与定义已按「每个模板一个文件」拆分至 mapTemplate/ 目录：
 *   - mapTemplate/types.ts            —— MapTemplate 接口
 *   - mapTemplate/empty.ts            —— 空白画布
 *   - mapTemplate/crystalCaverns.ts   —— 水晶洞窟 · 对称迷城
 *   - mapTemplate/twoDMapDesign.ts    —— 2D地图设计 · 底图
 */
import type { MapTemplate } from './mapTemplate/types';
import { EMPTY_TEMPLATE } from './mapTemplate/empty';
import { CRYSTAL_CAVERNS_TEMPLATE } from './mapTemplate/crystalCaverns';
import { TWO_D_MAP_TEMPLATE } from './mapTemplate/twoDMapDesign';
import { TPL_2D_TEMPLATE } from './mapTemplate/2d';


export type { MapTemplate } from './mapTemplate/types';

/* ==================== 模板注册表 ==================== */

export const MAP_TEMPLATES: MapTemplate[] = [
  EMPTY_TEMPLATE,
  CRYSTAL_CAVERNS_TEMPLATE,
  TWO_D_MAP_TEMPLATE,
  TPL_2D_TEMPLATE,

];

/** 按 id 查找模板 */
export function getMapTemplate(id: string): MapTemplate | undefined {
  return MAP_TEMPLATES.find(t => t.id === id);
}
