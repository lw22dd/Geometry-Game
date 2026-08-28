/**
 * Toast 提示组件 —— 参考工具/code (2).html 的 #toast 实现。
 * 显示在页面底部中央，2.5 秒自动消失，支持 info / error / success 三种类型。
 */
let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(msg: string, type: 'info' | 'error' | 'success' = 'info'): void {
  const el = document.getElementById('toast');
  if (!el) return;
  if (toastTimer !== null) clearTimeout(toastTimer);
  el.textContent = msg;
  el.className = 'show ' + (type === 'error' ? 'error' : type === 'success' ? 'success' : '');
  toastTimer = setTimeout(() => {
    el.className = '';
    toastTimer = null;
  }, 2500);
}