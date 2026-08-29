import { createEmptyMapData } from '../mapTypes';
import type { MapTemplate } from './types';

/** 空白画布 —— 默认 120×72 空地图，无任何内容。 */
export const EMPTY_TEMPLATE: MapTemplate = {
  id: 'empty',
  name: '空白画布',
  icon: 'File',
  desc: '从零开始：默认 120×72 空地图，无任何内容。',
  create: () => createEmptyMapData(),
};
