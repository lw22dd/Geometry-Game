/**
 * UI 管理器 —— 场景管理 + 事件统一分发。
 * 整个项目只应有一个 UIManager 实例（单例）。
 *
 * main.ts 只需调用：
 *   ui.handleClick(lx, ly)   // 点击
 *   ui.handleMove(lx, ly)    // 鼠标移动 → 悬停
 *   ui.handleKey(e)           // 键盘
 *   ui.draw(t)                // 绘制当前场景
 */
import { ctx } from '../canvas';
import type { UIWidget, UIScene, UISceneName } from './types';

export class UIManager {
  private scenes = new Map<string, UIScene>();
  private current: UIScene | null = null;
  private _currentName: UISceneName = null;
  private hovered: UIWidget | null = null;
  private _focusedId: string | null = null;

  /** 注册场景（通常由各 UI 模块在初始化时调用） */
  register(scene: UIScene): void {
    this.scenes.set(scene.name, scene);
  }

  /** 当前场景名 */
  get currentName(): UISceneName {
    return this._currentName;
  }

  /** 当前场景对象（供外部操作组件可见性等） */
  get currentScene(): UIScene | null {
    return this.current;
  }

  /** 切换到场景 name（null 表示无 UI 覆盖） */
  show(name: UISceneName): void {
    if (this._currentName === name) return;
    // 退出旧场景
    if (this.current) {
      this.current.onExit?.();
    }
    this.hovered = null;
    this._focusedId = null;
    this._setCursor(false);
    // 进入新场景
    this._currentName = name;
    this.current = name ? this.scenes.get(name) ?? null : null;
    if (this.current) {
      this.current.onEnter?.();
    }
  }

  /** 鼠标移动：分发 hover 状态 */
  handleMove(lx: number, ly: number): void {
    if (!this.current) {
      this._clearHover();
      return;
    }
    let found: UIWidget | null = null;
    for (const w of this.current.widgets) {
      if (!w.visible) continue;
      const h = w.hit(lx, ly);
      if (w.focusable) {
        w.hover = h && !w.focused;
      } else {
        w.hover = h;
      }
      if (h && !found) found = w;
    }
    if (this.hovered !== found) {
      this.hovered = found;
      this._setCursor(!!found && !(found.focusable && found.focused));
    }
  }

  /** 点击：分发给命中的组件 */
  handleClick(lx: number, ly: number): boolean {
    if (!this.current) return false;
    // 从后往前遍历（最上层优先）
    const ws = this.current.widgets;
    for (let i = ws.length - 1; i >= 0; i--) {
      const w = ws[i];
      if (!w.visible || !w.hit(lx, ly)) continue;
      if (w.focusable) {
        // 输入框点击：切换焦点
        if (this._focusedId !== w.id) {
          // 失焦旧焦点
          if (this._focusedId) {
            const old = ws.find(x => x.id === this._focusedId);
            if (old) old.focused = false;
          }
          this._focusedId = w.id;
          w.focused = true;
        }
      } else {
        // 失焦
        if (this._focusedId) {
          const old = ws.find(x => x.id === this._focusedId);
          if (old) old.focused = false;
          this._focusedId = null;
        }
      }
      w.onClick?.();
      return true;
    }
    // 点击空白 → 失焦
    if (this._focusedId) {
      const old = ws.find(x => x.id === this._focusedId);
      if (old) old.focused = false;
      this._focusedId = null;
    }
    return false;
  }

  /** 键盘：优先分发给聚焦输入框，再给场景各组件 */
  handleKey(e: KeyboardEvent): boolean {
    if (!this.current) return false;
    // 聚焦输入框优先
    if (this._focusedId) {
      const fw = this.current.widgets.find(w => w.id === this._focusedId);
      if (fw?.onKey?.(e)) return true;
    }
    // 其他组件
    for (const w of this.current.widgets) {
      if (w.id === this._focusedId) continue;
      if (w.onKey?.(e)) return true;
    }
    return false;
  }

  /** 滚轮：分发给当前场景的 onWheel（返回 true 表示已消费） */
  handleWheel(dy: number): boolean {
    if (!this.current) return false;
    return this.current.onWheel?.(dy) ?? false;
  }

  /** 绘制当前场景（场景背景 + 全部组件） */
  draw(t: number): void {
    if (!this.current) return;
    this.current.draw?.(t);
    for (const w of this.current.widgets) {
      if (!w.visible) continue;
      w.draw(t);
    }
  }

  /* ---------- 内部辅助 ---------- */

  private _clearHover(): void {
    if (this.hovered) {
      this.hovered.hover = false;
      this.hovered = null;
      this._setCursor(false);
    }
  }

  private _setCursor(pointer: boolean): void {
    const c = ctx.canvas;
    if (c) c.style.cursor = pointer ? 'pointer' : 'default';
  }
}

/** 全局单例 */
export const ui = new UIManager();