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
 *  - 叠层栈：pause / dev / instructions（可覆盖基础场景）
 *  - currentName = 栈顶叠层 ?? gs.scene（派生只读，不再由 syncUI 的 if 推导）
 *  - 所有写入走唯一入口 show(...)（内部写真源 gs.screen / gs.scene / 叠层栈后重算派生）
 */
export class UIManager {
  private scenes = new Map<string, UIScene>();
  private current: UIScene | null = null;
  private _currentName: UISceneName = null;
  private hovered: UIWidget | null = null;
  private _focusedId: string | null = null;
  /** 叠层栈（pause/dev/instructions） */
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

  /** 当前场景对象（供外部操作组件可见性等；与 currentName 同源，实时解析） */
  get currentScene(): UIScene | null {
    return this.active;
  }

  /** 当前叠层栈（只读，调试用） */
  get overlayStack(): UISceneName[] {
    return this.overlays;
  }

  /**
   * 唯一写入口：切换 UI 场景（同时写真源）。
   *  - null：进入游戏画面（playing，无 UI 覆盖）
   *  - menu / prepare / mapSelect / charSelect / lobby：基础场景（写 gs.scene，清空叠层）
   *  - pause / dev / instructions：叠层（压栈）
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
      // 叠层：pause / dev / instructions
      if (!this.overlays.includes(name)) this.overlays.push(name);
      if (name === 'pause') gs.screen = 'paused';
    }
    this.applyScene();
  }

  /** 压入叠层（instructions/dev 等） */
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

  /**
   * 当前场景对象 —— 按 currentName **实时解析**，而非读缓存。
   *
   * 背景：外部代码若绕过 show() 直接写 gs.scene（历史上 startGame 就这么做过），
   * 派生的 currentName 会变而缓存的 current 不变，于是"画面已经是游戏、
   * 点击却打在菜单按钮上"。事件分发与绘制一律走本 getter，保证与真源一致。
   */
  private get active(): UIScene | null {
    const name = this.currentName;
    return name ? this.scenes.get(name) ?? null : null;
  }

  /** 场景同步：真源已变但尚未走 applyScene 时补齐 onExit/onEnter（幂等，无变化即返回） */
  private syncScene(): void {
    if (this._currentName !== this.currentName) this.applyScene();
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
    this.current = this.active;
    if (this.current) {
      this.current.onEnter?.();
    }
  }

  /** 鼠标移动：分发 hover 状态 */
  handleMove(lx: number, ly: number): void {
    this.syncScene();
    const s = this.active;
    if (!s) {
      this._clearHover();
      return;
    }
    let found: UIWidget | null = null;
    for (const w of s.widgets) {
      if (!w.visible) continue;
      const h = w.hit(lx, ly);
      if (w.focusable) {
        w.hover = h && !w.focused;
      } else {
        w.hover = h;
      }
      if (h && !found) found = w;
      // 拖拽中的组件持续接收移动事件（指针移出组件范围也不中断拖拽）
      if (w.dragging) w.onDrag?.(lx, ly);
    }
    if (this.hovered !== found) {
      this.hovered = found;
      this._setCursor(!!found && !(found.focusable && found.focused));
    }
  }

  /**
   * 鼠标按下：分发给命中的组件（拖拽起点）。
   * 与 handleClick 同样的命中顺序（最上层优先），但不处理焦点，只回调 onPress。
   */
  handlePress(lx: number, ly: number): boolean {
    this.syncScene();
    const s = this.active;
    if (!s) return false;
    const ws = s.widgets;
    for (let i = ws.length - 1; i >= 0; i--) {
      const w = ws[i];
      if (!w.visible || !w.hit(lx, ly)) continue;
      w.onPress?.(lx, ly);
      return true;
    }
    return false;
  }

  /** 点击：分发给命中的组件 */
  handleClick(lx: number, ly: number): boolean {
    this.syncScene();
    const s = this.active;
    if (!s) return false;
    // 从后往前遍历（最上层优先）
    const ws = s.widgets;
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
      w.onClick?.(lx, ly);
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
    this.syncScene();
    const s = this.active;
    if (!s) return false;
    // 聚焦输入框优先
    if (this._focusedId) {
      const fw = s.widgets.find(w => w.id === this._focusedId);
      if (fw?.onKey?.(e)) return true;
    }
    // 其他组件
    for (const w of s.widgets) {
      if (w.id === this._focusedId) continue;
      if (w.onKey?.(e)) return true;
    }
    return false;
  }

  /** 鼠标抬起：结束所有组件的拖拽（挂在 window 上，拖出画布也能正确结束） */
  handleRelease(): void {
    this.syncScene();
    const s = this.active;
    if (!s) return;
    for (const w of s.widgets) {
      if (w.dragging) {
        w.dragging = false;
        w.onRelease?.();
      }
    }
  }

  /** 滚轮：分发给当前场景的 onWheel（返回 true 表示已消费） */
  handleWheel(dy: number): boolean {
    this.syncScene();
    const s = this.active;
    if (!s) return false;
    return s.onWheel?.(dy) ?? false;
  }

  /** 绘制当前场景（场景背景 + 全部组件） */
  draw(t: number): void {
    this.syncScene();
    const s = this.active;
    if (!s) return;
    s.draw?.(t);
    for (const w of s.widgets) {
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