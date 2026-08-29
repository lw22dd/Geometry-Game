import type { MapData } from '../mapTypes';

export interface MapTemplate {
  /** 模板唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 图标 emoji */
  icon: string;
  /** 简短描述 */
  desc: string;
  /** 返回模板的独立深拷贝 MapData */
  create(): MapData;
}
