/**
 * 玩家设置存储 —— 音量 / 静音 / 画质档位，localStorage 持久化。
 *
 * 职责边界：本模块只管「数据 + 持久化 + 变更通知」，不直接操作音频节点或渲染管线。
 * 音频侧（core/audio）与视觉侧（config/visuals + systems/postfx）各自订阅变更并自行应用，
 * 避免本模块反向依赖 audio / systems 形成循环。
 *
 * 读取失败（隐私模式 / 存储禁用 / 脏数据）一律静默回退默认值，不抛错。
 */
import { VIS, applyQuality, type QualityTier } from '../config/visuals';

/** 持久化键（带版本号；未来结构变更直接换键，不做迁移逻辑） */
const STORAGE_KEY = 'dash.settings.v1';

/** 设置数据 */
export interface SettingsData {
  /** 主音量 0..1 */
  master: number;
  /** 音效音量 0..1 */
  sfx: number;
  /** 音乐音量 0..1 */
  bgm: number;
  /** 全局静音（不改变三条音量值） */
  muted: boolean;
  /** 画质档位 */
  quality: QualityTier;
  /** 后期特效总开关（关闭后仅保留基础绘制） */
  postfxOn: boolean;
}

const DEFAULTS: SettingsData = {
  master: 0.7,
  sfx: 0.9,
  bgm: 0.6,
  muted: false,
  quality: 'auto',
  postfxOn: true,
};

const TIERS: QualityTier[] = ['low', 'medium', 'high', 'auto'];

/** 数值钳制（脏数据 / NaN 兜底） */
function num(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** 档位白名单校验 */
function tier(v: unknown): QualityTier {
  return TIERS.includes(v as QualityTier) ? (v as QualityTier) : DEFAULTS.quality;
}

type Listener = (data: Readonly<SettingsData>) => void;

class SettingsStore {
  /** 当前设置（公开只读语义，修改请走 set()） */
  readonly data: SettingsData = { ...DEFAULTS };

  private listeners: Listener[] = [];

  /**
   * 从 localStorage 载入并应用（启动时调用一次）。
   * 应用动作：画质档位写回 VIS；音量与静音由订阅者（core/audio）自行读取。
   */
  load(): void {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      raw = null; // 隐私模式 / 存储禁用：静默用默认值
    }
    if (raw) {
      try {
        const p = JSON.parse(raw) as Record<string, unknown>;
        if (typeof p === 'object' && p !== null) {
          this.data.master = num(p.master, DEFAULTS.master);
          this.data.sfx = num(p.sfx, DEFAULTS.sfx);
          this.data.bgm = num(p.bgm, DEFAULTS.bgm);
          this.data.muted = p.muted === true;
          this.data.quality = tier(p.quality);
          this.data.postfxOn = p.postfxOn !== false;
        }
      } catch {
        // 脏数据：保持默认值
      }
    }
    applyQuality(this.data.quality);
    this.emit();
  }

  /** 修改一项或多项（自动钳制、持久化、通知） */
  set(patch: Partial<SettingsData>): void {
    if (patch.master !== undefined) this.data.master = num(patch.master, this.data.master);
    if (patch.sfx !== undefined) this.data.sfx = num(patch.sfx, this.data.sfx);
    if (patch.bgm !== undefined) this.data.bgm = num(patch.bgm, this.data.bgm);
    if (patch.muted !== undefined) this.data.muted = patch.muted === true;
    if (patch.quality !== undefined) this.data.quality = tier(patch.quality);
    if (patch.postfxOn !== undefined) this.data.postfxOn = patch.postfxOn === true;
    // 画质档位立即写回视觉参数表
    applyQuality(this.data.quality);
    this.save();
    this.emit();
  }

  /** 持久化（失败静默） */
  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // 存储不可用时忽略（设置仅在当前会话生效）
    }
  }

  /**
   * 订阅变更（音频/视觉侧据此实时应用）。
   * @returns 取消订阅函数
   */
  subscribe(fn: Listener): () => void {
    this.listeners.push(fn);
    fn(this.data); // 立即推送一次当前值，订阅者无需重复初始化
    return () => {
      const i = this.listeners.indexOf(fn);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  /**
   * 后期特效是否启用 —— 画质档位与总开关的合取。
   * systems/postfx 的 drawPostFX 用此做总闸（关闭时零开销）。
   */
  get postfxEnabled(): boolean {
    return this.data.postfxOn && VIS.postfx.bloomOn !== undefined;
  }

  /** 音量是否完全静默（静音开关或任意一条为 0） */
  isSilent(kind: 'sfx' | 'bgm'): boolean {
    if (this.data.muted) return true;
    return this.data.master <= 0 || this.data[kind] <= 0;
  }

  /** 取某条通道的实际增益（含静音与总线衰减） */
  gainOf(kind: 'sfx' | 'bgm'): number {
    if (this.data.muted) return 0;
    return this.data.master * this.data[kind];
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.data);
  }
}

/** 全局单例 */
export const Settings = new SettingsStore();
