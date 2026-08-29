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
import { gs } from '../../systems/game/gameState';
import type { UIWidget, UIScene, UISceneName } from './types';

/**
 * UI 管理器（问题 3：单一真源 + 叠层栈）。
 *  - 基础场景真源：gs.scene（menu / prepare / mapSelect / charSelect / lobby / null）
 *  - 叠层栈：pause / dev / gallery / instructions（可覆盖基础场景）
 *  - currentName = 栈顶叠层 ?? gs.scene（派生只读，不再由 syncUI 的 if 推导）
 *  - 所有写入走唯一入口 show(...)（内部写真源 gs.screen / gs.scene / 叠层栈后重算派生）
 */
export class UIManager {
  private scenes = new Map<string, UIScene>();
  private current: UIScene | null = null;
  private _currentName: UISceneName = null;
  private hovered: UIWidget | null = null;
  private _focusedId: string | null = null;
  /** 叠层栈（pause/dev/gallery/instructions） */
  private overlays: UISceneName[] = [];

  /** 注册场景（通常由各 UI 模块在初始化时调用） */
  register(scene: UIScene): void {
    this.scenes.set(scene.name, scene);
  }

  /** 当前场景名（派生只读：栈顶叠层 ?? 基础场景 gs.scene） */
  get currentName(): UISceneName {
    if (this.overlays.length > 0) return this.overlays[this.overlays.length - 1];
    return gs.scene;
  }

  /** 当前场景对象（供外部操作组件可见性等） */
  get currentScene(): UIScene | null {
    return this.current;
  }

  /** 当前叠层栈（只读，调试用） */
  get overlayStack(): UISceneName[] {
    return this.overlays;
  }

  /**
   * 唯一写入口：切换 UI 场景（同时写真源）。
   *  - null：进入游戏画面（playing，无 UI 覆盖）
   *  - menu / prepare / mapSelect / charSelect / lobby：基础场景（写 gs.scene，清空叠层）
   *  - pause / dev / gallery / instructions：叠层（压栈）
   */
  show(name: UISceneName): void {
    if (name === null) {
      gs.screen = 'playing';
      gs.scene = null;
      this.overlays.length = 0;
    } else if (name === 'menu') {
      gs.screen = 'menu';
      gs.scene = 'menu';
      this.overlays.length = 0;
    } else if (name === 'prepare') {
      gs.screen = 'prepare';
      gs.scene = 'prepare';
      this.overlays.length = 0;
    } else if (name === 'mapSelect' || name === 'charSelect' || name === 'lobby') {
      gs.scene = name;
      this.overlays.length = 0;
    } else {
      // 叠层：pause / dev / gallery / instructions
      if (!this.overlays.includes(name)) this.overlays.push(name);
      if (name === 'pause') gs.screen = 'paused';
    }
    this.applyScene();
  }

  /** 压入叠层（gallery/instructions/dev 等） */
  pushOverlay(name: Exclude<UISceneName, null>): void {
    if (this.overlays.includes(name)) return;
    this.overlays.push(name);
    this.applyScene();
  }

  /** 弹出最上层叠层 */
  popOverlay(): void {
    this.overlays.pop();
    this.applyScene();
  }

  /** 按派生 currentName 真正切换场景 */
  private applyScene(): void {
    const name = this.currentName;
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