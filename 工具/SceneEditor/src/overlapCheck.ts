/**
 * 场景重叠检测 —— 编辑器内「重叠检查」按钮与 verify/overlapCheck.ts 共享的核心逻辑。
 *
 * 规则（通用：所有对象参与几何相交检测，severity 按类型区分）：
 *   ❌ 错误 ：
 *     A. 可收集/装饰类（orb / jumpBoost / nova / deco）：命中框与地形相交 > 0.5 格²
 *        →「沉入地形」：道具基本被地形盖住，玩家拿不到
 *     B. 出生点严格位于几何矩形内部 →「出生点被地形遮挡」
 *   ⚠️ 警告 ：
 *     C. 机关/危险/插地类（springPad / mover / laser / spike / checkpoint）：命中框与地形
 *        相交 > 0.5 格² →「与地形重叠」（可能是设计：弹簧底座嵌平台/激光贴地/尖刺插地）
 *     D. 任意两个对象命中框相交 > 0.5 格²（排除 hint / checkpoint / laser 参与）
 *   ℹ️ 信息 ：
 *     E. 几何矩形互相相交（可能是故意相接，如平台压墙/立柱）
 *
 *   hint 特例：文字气泡宽大、常压平台边缘，仅用「锚点严格位于地形内部」判定。
 */
import type { EditorStore } from './store';
import type { MapData } from './mapTypes';
import {
  instancePosition, instanceHitBounds, rectCenter, rectRad, rotatedRectBounds,
} from './mapTypes';
import { showToast } from './toast';
import { renderIcon } from './td-icons';

/* ==================== 类型 ==================== */

interface AABB { x: number; y: number; w: number; h: number; }

export interface CheckIssue {
  severity: 'error' | 'warn' | 'info';
  kind: string;
  detail: string;
}

export interface MapCheckResult {
  name: string;
  issues: CheckIssue[];
}

/* ==================== 几何辅助 ==================== */

function overlapArea(a: AABB, b: AABB): number {
  const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ox * oy;
}

/** 点严格在矩形内部（不含边界） */
function pointStrictInside(rect: any, px: number, py: number): boolean {
  const c = rectCenter(rect);
  const rad = rectRad(rect);
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const dx = px - c.x, dy = py - c.y;
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;
  return Math.abs(lx) < rect.w / 2 && Math.abs(ly) < rect.h / 2;
}

const fmt = (n: number) => n.toFixed(1);
const fmtP = (x: number, y: number) => `(${fmt(x)}, ${fmt(y)})`;
const fmtR = (r: any) => `${fmtP(r.x, r.y)} ${r.w}×${r.h}`;

/* ==================== 对象分类 ==================== */

const TYPE_NAMES: Record<string, string> = {
  orb: '光球', jumpBoost: '双跳光球', nova: 'NOVA', deco: '装饰方块',
  hint: '提示文字', spike: '尖刺', checkpoint: '检查点', mover: '移动平台',
  laser: '激光栅栏', springPad: '弹簧跳板', hookPickup: '钩锁道具', shieldPickup: '护盾道具', track: '玻璃管道',
};

/** 与地形重叠的严重级别：可收集/装饰 → 错误；机关/危险/插地 → 警告 */
const TERRAIN_SEV: Record<string, 'error' | 'warn'> = {
  orb: 'error', jumpBoost: 'error', nova: 'error', deco: 'error',
  spike: 'warn', checkpoint: 'warn', mover: 'warn', laser: 'warn', springPad: 'warn',
  hookPickup: 'error', shieldPickup: 'error', track: 'warn',
};

/** 重叠面积阈值（格²）：低于此值视为贴边/接触 */
const AREA_MIN = 0.5;

function label(inst: any): string {
  const pos = instancePosition(inst);
  return `${TYPE_NAMES[inst.type] ?? inst.type} ${fmtP(pos.x, pos.y)}`;
}

/* ==================== 核心检查（纯函数，供无头脚本与编辑器共用） ==================== */

export function checkMap(data: MapData): MapCheckResult {
  const issues: CheckIssue[] = [];
  const geometry = data.layers.geometry as any[];
  const objects = data.layers.objects as any[];

  // ── A/C. 对象命中框 vs 几何（AABB 相交面积） ──
  for (const inst of objects) {
    const b = instanceHitBounds(inst);
    if (b.w <= 0 || b.h <= 0) continue;

    for (const rect of geometry) {
      if (rect.type !== 'rect') continue;
      const gb = rotatedRectBounds(rect);
      const area = overlapArea(b, gb);
      if (area <= AREA_MIN) continue;

      // hint：只允许锚点严格内部判定（文字压平台边缘正常）
      if (inst.type === 'hint') {
        const pos = instancePosition(inst);
        if (!pointStrictInside(rect, pos.x, pos.y)) continue;
      }

      const sev = TERRAIN_SEV[inst.type] ?? 'warn';
      issues.push({
        severity: sev,
        kind: sev === 'error' ? 'embedded-in-terrain' : 'overlap-mech-terrain',
        detail: `${label(inst)} 命中框与地形 ${fmtR(rect)} 重叠 ${area.toFixed(2)} 格²`
          + (sev === 'warn' ? '（机关/危险物与地形重叠 — 底座嵌平台/激光贴地/尖刺插地可能是设计，请人工确认）' : ''),
      });
      break; // 报第一个重叠即可
    }
  }

  // ── B. 出生点 ──
  const sp = data.playerSpawn;
  for (const rect of geometry) {
    if (rect.type !== 'rect') continue;
    if (pointStrictInside(rect, sp.x, sp.y)) {
      issues.push({ severity: 'error', kind: 'spawn-blocked', detail: `出生点 ${fmtP(sp.x, sp.y)} 严格位于地形 ${fmtR(rect)} 内部` });
    }
  }

  // ── D. 对象间重叠 ──
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const a = objects[i], b2 = objects[j];
      if (a.type === 'hint' || b2.type === 'hint') continue;
      if (a.type === 'checkpoint' || b2.type === 'checkpoint') continue;
      if (a.type === 'laser' || b2.type === 'laser') continue;
      const ba = instanceHitBounds(a);
      const bb = instanceHitBounds(b2);
      const area = overlapArea(ba, bb);
      if (area > AREA_MIN) {
        issues.push({ severity: 'warn', kind: 'overlap-object', detail: `${label(a)} 与 ${label(b2)} 命中框重叠 ${area.toFixed(2)} 格²` });
      }
    }
  }

  // ── E. 几何间相交（信息级） ──
  for (let i = 0; i < geometry.length; i++) {
    for (let j = i + 1; j < geometry.length; j++) {
      const a = geometry[i], b2 = geometry[j];
      if (a.type !== 'rect' || b2.type !== 'rect') continue;
      const aa = rotatedRectBounds(a);
      const ab = rotatedRectBounds(b2);
      const area = overlapArea(aa, ab);
      if (area > 0.01) {
        issues.push({
          severity: 'info',
          kind: 'geom-overlap',
          detail: `几何 ${fmtR(a)} 与 ${fmtR(b2)} 相交 ${area.toFixed(2)} 格²（可能是设计：平台压墙/立柱）`,
        });
      }
    }
  }

  return { name: data.name ?? data.id ?? 'untitled', issues };
}

/* ==================== 编辑器内弹窗 ==================== */

/** 对当前编辑地图运行重叠检查并展示结果弹窗 */
export function runOverlapCheck(store: EditorStore): void {
  const result = checkMap(store.map);
  const errors = result.issues.filter(i => i.severity === 'error');
  const warns = result.issues.filter(i => i.severity === 'warn');
  const infos = result.issues.filter(i => i.severity === 'info');

  const list = document.getElementById('checkList');
  if (list) {
    list.textContent = '';
    const mk = (tag: string, sev: string, icon: string, text: string) => {
      const row = document.createElement('div');
      row.className = `check-item check-${sev}`;
      row.innerHTML = `<span class="check-icon">${renderIcon(icon, 14)}</span><span>${escapeHtml(text)}</span>`;
      list.appendChild(row);
    };
    for (const e of errors) mk('error', 'error', 'ErrorCircle', e.detail);
    for (const w of warns) mk('warn', 'warn', 'AlertTriangle', w.detail);
    for (const i of infos) mk('info', 'info', 'InfoCircle', i.detail);
    if (errors.length === 0 && warns.length === 0) {
      const ok = document.createElement('div');
      ok.className = 'check-item check-ok';
      ok.innerHTML = `<span class="check-icon">${renderIcon('CheckCircle', 16)}</span><span>当前地图没有检测到重叠问题</span>`;
      list.appendChild(ok);
    }
  }

  const summary = document.getElementById('checkSummary');
  if (summary) {
    const total = errors.length + warns.length + infos.length;
    summary.textContent = `检查「${result.name}」：${errors.length} 错误 / ${warns.length} 警告 / ${infos.length} 提示（共 ${total} 项）`;
  }

  document.getElementById('checkOverlay')?.classList.remove('hidden');
  showToast(
    errors.length > 0 ? `重叠检查：发现 ${errors.length} 个错误` : warns.length > 0 ? `重叠检查：${warns.length} 个警告（可能是设计）` : '重叠检查：全部通过',
    errors.length > 0 ? 'error' : 'success',
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 全局关闭函数（HTML 内联事件用）
const win = window as any;
win.hideCheck = (): void => document.getElementById('checkOverlay')?.classList.add('hidden');