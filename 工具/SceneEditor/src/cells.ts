/**
 * cells —— 格子 → 矩形合并算法（单一数据源）。
 *
 * 用途：把 MVMap 导出的「格子集合」合并成游戏所需的轴对齐矩形列表。
 * 输入为「游戏坐标系」下的格子（Y 向上，整数格），输出为 (x,y,w,h) 矩形，
 * 其中 (x,y) 为左下角 —— 与游戏 `R(x,y,w,h)` / MapDefinition.solids 完全一致。
 *
 * 算法：行扫描 → 逐行提取连续段 → 相邻行同宽段纵向合并 → 得到近乎最小的矩形集。
 * 一次 O(n)，输出每个「等高同宽的长条」合并为一个矩形（对 2D 平台类碰撞体很友好）。
 */

export interface CellRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 格子键 "x,y"（游戏坐标）→ 数值坐标 */
export function parseCellKey(key: string): { x: number; y: number } {
  const i = key.indexOf(',');
  return { x: +key.slice(0, i), y: +key.slice(i + 1) };
}

/** 数值坐标 → 格子键（保证与输入键一致，用于去重/集合） */
export function cellKey(x: number, y: number): string {
  return x + ',' + y;
}

/**
 * 将格子集合合并为最小矩形集。
 * @param cellKeys  "x,y" 键列表（游戏坐标，Y 向上，整数格）
 * @param cellSize  每个格子的边长（游戏单位，默认 1 米）
 */
export function cellsToRects(cellKeys: string[], cellSize = 1): CellRect[] {
  if (cellKeys.length === 0) return [];

  // 解析 + 按行分组（去重）
  const rows = new Map<number, number[]>();
  const seen = new Set<string>();
  for (const key of cellKeys) {
    if (seen.has(key)) continue;
    seen.add(key);
    const { x, y } = parseCellKey(key);
    let xs = rows.get(y);
    if (!xs) { xs = []; rows.set(y, xs); }
    xs.push(x);
  }

  // 行按 y 升序（Y 向上 → 从下往上扫）
  const rowYs = [...rows.keys()].sort((a, b) => a - b);

  // 相邻行纵向合并：open 记录「上一行尚未闭合的矩形」（按起始 x 索引）
  // 结构 { x0, x1, y0, y1 }（格子坐标，含端点）
  interface OpenRect { x0: number; x1: number; y0: number; y1: number }
  let open = new Map<number, OpenRect>();
  const closed: OpenRect[] = [];

  for (const y of rowYs) {
    const xs = rows.get(y)!.sort((a, b) => a - b);

    // 该行连续段
    const runs: { x0: number; x1: number }[] = [];
    let runStart = xs[0], runEnd = xs[0];
    for (let i = 1; i <= xs.length; i++) {
      const x = xs[i];
      if (i < xs.length && x === runEnd + 1) { runEnd = x; continue; }
      runs.push({ x0: runStart, x1: runEnd });
      runStart = runEnd = x;
    }

    // 尝试把当前行每个段接到上一行同宽段的矩形上
    const nextOpen = new Map<number, OpenRect>();
    const usedOpen = new Set<number>();
    for (const run of runs) {
      const cand = open.get(run.x0);
      if (cand && cand.x1 === run.x1 && !usedOpen.has(run.x0)) {
        cand.y1 = y;                 // 纵向延伸
        nextOpen.set(run.x0, cand);
        usedOpen.add(run.x0);
      } else {
        nextOpen.set(run.x0, { x0: run.x0, x1: run.x1, y0: y, y1: y });
      }
    }
    // 未被接上的旧矩形 → 闭合
    for (const [x0, r] of open) if (!usedOpen.has(x0)) closed.push(r);
    open = nextOpen;
  }
  for (const r of open.values()) closed.push(r);

  // 格子坐标 → 世界矩形（左下角 + 尺寸）
  return closed.map((r) => ({
    x: r.x0 * cellSize,
    y: r.y0 * cellSize,
    w: (r.x1 - r.x0 + 1) * cellSize,
    h: (r.y1 - r.y0 + 1) * cellSize,
  }));
}

/**
 * 便捷：把「x,y 对数组」合并为矩形（内部转成键再调 cellsToRects）。
 */
export function pointsToRects(points: { x: number; y: number }[], cellSize = 1): CellRect[] {
  return cellsToRects(points.map((p) => cellKey(p.x, p.y)), cellSize);
}
