#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
check_dead_code.py — TypeScript 死代码检测（未引用导出 / 孤立文件）

基于静态 import/export 关系分析，检测 src/ 下的两类死代码：

  1. 孤立文件：没有任何文件 import 它，且不是入口文件（默认 main.ts）。
  2. 死导出：文件内定义的 export 符号从未被任何其他文件 import / 转发引用。

分析方式（启发式，非 AST 级）：
  - 剥离注释后解析 import / export 语句（支持多行、named/default/namespace/
    副作用/动态 import、export * 转发、re-export { a } from '...'）。
  - 文件可达性：从入口文件沿 import 边做 BFS。
  - 符号引用：named import 精确匹配符号；namespace/star 导入视为「整体引用」
    （保守，跳过该文件的符号级判定，避免误报）。

用法：
    python script/check_dead_code.py                              # 扫描 ../src
    python script/check_dead_code.py --root src                   # 指定源码目录
    python script/check_dead_code.py --entry main.ts              # 追加入口（可多次）
    python script/check_dead_code.py --ignore "core/ecs/Entity"   # 忽略特定文件/前缀
    python script/check_dead_code.py --json                       # 机器可读输出

退出码：
    0  未发现死代码（或 --only-files 且无孤立文件）
    1  发现死代码
    2  根目录不存在 / 无入口文件
"""

import argparse
import io
import json
import os
import re
import sys
from collections import defaultdict, deque
from pathlib import Path

# Windows 控制台默认 GBK，强制 UTF-8
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

SKIP_DIRS = {".git", "__pycache__", ".venv", "node_modules", "dist", "dist-ssr"}
TS_EXTS = {".ts", ".tsx"}
PREFIX = "./"
SUFFIX = re.compile(r"\.(tsx?)$")

# ---------------- 注释剥离 ----------------

def strip_comments(content: str) -> str:
    """移除 // 行注释与 /* */ 块注释（保护字符串字面量内部）。"""
    out = []
    i, n = 0, len(content)
    state = "code"  # code | line | block | str_s | str_d | str_t
    while i < n:
        c = content[i]
        nxt = content[i + 1] if i + 1 < n else ""
        if state == "code":
            if c == "/" and nxt == "/":
                state = "line"; i += 2; continue
            if c == "/" and nxt == "*":
                state = "block"; i += 2; continue
            if c == '"':
                state = "str_d"; out.append(c); i += 1; continue
            if c == "'":
                state = "str_s"; out.append(c); i += 1; continue
            if c == "`":
                state = "str_t"; out.append(c); i += 1; continue
            out.append(c); i += 1
        elif state == "line":
            if c == "\n":
                state = "code"; out.append(c)
            else:
                out.append(" ")  # 保持行内 token 隔离
            i += 1
        elif state == "block":
            if c == "*" and nxt == "/":
                state = "code"; out.append("  "); i += 2
            else:
                out.append(" " if c != "\n" else "\n"); i += 1
        else:  # 字符串内
            if c == "\\":
                out.append(c)
                if i + 1 < n:
                    out.append(content[i + 1]); i += 2
                else:
                    i += 1
            elif (state == "str_d" and c == '"') or (state == "str_s" and c == "'") \
                    or (state == "str_t" and c == "`"):
                state = "code"; out.append(c); i += 1
            else:
                out.append(c); i += 1
    return "".join(out)

# ---------------- import / export 解析 ----------------

IMPORT_NAMED = re.compile(
    r"\bimport\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['\"]([^'\"]+)['\"]", re.S)
IMPORT_NS = re.compile(
    r"\bimport\s+(?:type\s+)?\*\s*as\s+\w+\s+from\s+['\"]([^'\"]+)['\"]", re.S)
IMPORT_DEFAULT = re.compile(
    r"\bimport\s+(?:type\s+)?(\w+)\s+from\s+['\"]([^'\"]+)['\"]", re.S)
IMPORT_SIDE = re.compile(
    r"\bimport\s+['\"]([^'\"]+)['\"]", re.S)
IMPORT_DYNAMIC = re.compile(
    r"\bimport\(\s*['\"]([^'\"]+)['\"]\s*\)", re.S)

EXPORT_DECL = re.compile(
    r"\bexport\s+(?:default\s+)?(?:declare\s+)?(?:abstract\s+)?"
    r"(?:async\s+)?(function|class|interface|type|enum|const|let|var)\s+(\w+)")
EXPORT_DEFAULT = re.compile(r"\bexport\s+default\s+(\w+)")
EXPORT_NAMED = re.compile(r"\bexport\s*(?:type\s+)?\{([^}]*)\}", re.S)
EXPORT_FROM = re.compile(
    r"\bexport\s*\{[^}]*\}\s*from\s*['\"]([^'\"]+)['\"]", re.S)
EXPORT_STAR = re.compile(
    r"\bexport\s*\*\s*(?:as\s+\w+\s+)?from\s*['\"]([^'\"]+)['\"]", re.S)


def parse_names(block: str):
    """解析 { a, b as c, d type } → 原符号名集合。"""
    names = set()
    for part in block.split(","):
        part = part.strip()
        if not part:
            continue
        part = re.sub(r"\btype\s+", "", part)
        base = re.split(r"\s+as\s+", part)[0].strip()
        if base:
            names.add(base)
    return names


def resolve_src(rel_file: str, src: str) -> str | None:
    """解析 import 目标为项目内实际文件相对路径；外部包 / 别名返回 None。

    返回带扩展名的真实文件名（用于与 files 列表比对）。
    """
    if src.startswith("."):
        base = os.path.dirname(rel_file)
        target = os.path.normpath(os.path.join(base, src))
        return target.replace("\\", "/")
    # Vite 别名 @ → src 根（本项目未用；若出现则尝试映射）
    if src == "@" or src.startswith("@/"):
        target = os.path.normpath(src[2:] if src.startswith("@/") else "")
        return target.replace("\\", "/")
    return None  # 外部包


def resolve_target(rel_file: str, src: str, files: list[str]) -> str | None:
    """把 import 目标解析成 files 中真实存在的文件（补扩展名、补 index）。"""
    base = resolve_src(rel_file, src)
    if base is None:
        return None
    if base in files:
        return base
    # 补 .ts / .tsx
    for ext in (".tsx", ".ts"):
        cand = base + ext
        if cand in files:
            return cand
    # 目录导入 → 补 /index.ts /index.tsx
    for ext in (".tsx", ".ts"):
        cand = base + "/index" + ext
        if cand in files:
            return cand
    return None


# ---------------- 主流程 ----------------

def main() -> int:
    parser = argparse.ArgumentParser(description="TypeScript 死代码检测")
    parser.add_argument("--root", default=None, help="源码根目录（默认 script/../src）")
    parser.add_argument("--entry", action="append", default=["main.ts"], help="入口文件（可多次指定）")
    parser.add_argument("--ignore", action="append", default=[], help="忽略的文件/前缀（相对根）")
    parser.add_argument("--json", action="store_true", help="JSON 输出")
    parser.add_argument("--only-files", action="store_true", help="只检测孤立文件，不做符号级分析")
    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    # 脚本位于 工具/script/，回退两级到项目根再到 src
    default_root = os.path.normpath(os.path.join(script_dir, "..", "..", "src"))
    root = os.path.abspath(args.root or default_root)
    if not os.path.isdir(root):
        print(json.dumps({"error": f"目录不存在: {root}"}) if args.json else f"错误：目录不存在 — {root}")
        return 2

    # 收集 TS 文件（.d.ts 声明文件靠 tsconfig types 引用，不参与 import 分析）
    files = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for fn in filenames:
            if os.path.splitext(fn)[1].lower() in TS_EXTS and not fn.endswith(".d.ts"):
                rel = os.path.relpath(os.path.join(dirpath, fn), root).replace("\\", "/")
                files.append(rel)
    files = sorted(files)

    ignored = tuple(p.replace("\\", "/").rstrip("/") for p in args.ignore)
    ignored_files = [f for f in files if f.startswith(ignored) or f in ignored]

    # 每个文件：exports（本地定义） / reexports（转发目标列表）
    exports = {}           # rel -> set(符号)
    reexports = {}         # rel -> set((符号, 目标文件))
    star_reexports = {}    # rel -> set(目标文件)
    file_has_default = set()

    # import 边：imports_from[rel] = [(kind, target, symbols|None)]
    imports_from = {}

    for rel in files:
        if rel in ignored_files:
            continue
        path = os.path.join(root, rel)
        try:
            code = strip_comments(open(path, encoding="utf-8").read())
        except (OSError, UnicodeDecodeError) as e:
            print(json.dumps({"error": str(e)}, ensure_ascii=False) if args.json else f"  ⚠ 读取失败 {rel}: {e}")
            continue

        # ---- exports ----
        exp = set()
        for kind, name in EXPORT_DECL.findall(code):
            exp.add(name)
        for name in EXPORT_DEFAULT.findall(code):
            exp.add(name)
            file_has_default.add(rel)
        for block in EXPORT_NAMED.findall(code):
            # 排除 re-export（{...} from '...'）—— 单独处理
            exp |= parse_names(block) - (set())
        exports[rel] = exp
        reexports[rel] = set()
        star_reexports[rel] = set()

        # re-export：找出带 from 的命名导出
        for m in EXPORT_NAMED.finditer(code):
            block = m.group(1)
            seg = code[m.end(): m.end() + 80]
            fm = re.match(r"\s*from\s*['\"]([^'\"]+)['\"]", seg)
            if fm:
                tgt = resolve_target(rel, fm.group(1), files)
                if tgt:
                    for name in parse_names(block):
                        reexports[rel].add((name, tgt))
                        exp.discard(name)  # 不属于本地定义
        for src in EXPORT_STAR.findall(code):
            tgt = resolve_target(rel, src, files)
            if tgt:
                star_reexports[rel].add(tgt)
        exports[rel] = {n for n in exp if n != "default"} | ({"default"} if rel in file_has_default else set())

        # ---- imports ----
        imps = []
        for m in IMPORT_NAMED.finditer(code):
            tgt = resolve_target(rel, m.group(2), files)
            if tgt:
                imps.append(("named", tgt, parse_names(m.group(1))))
        for src in IMPORT_NS.findall(code):
            tgt = resolve_target(rel, src, files)
            if tgt:
                imps.append(("ns", tgt, None))
        for m in IMPORT_DEFAULT.finditer(code):
            tgt = resolve_target(rel, m.group(2), files)
            if tgt:
                imps.append(("default", tgt, None))
        for src in IMPORT_SIDE.findall(code):
            tgt = resolve_target(rel, src, files)
            if tgt:
                imps.append(("side", tgt, None))
        for src in IMPORT_DYNAMIC.findall(code):
            tgt = resolve_target(rel, src, files)
            if tgt:
                imps.append(("side", tgt, None))
        imports_from[rel] = imps

    # ---------------- 文件可达性（BFS） ----------------
    out_edges = defaultdict(list)   # rel -> [targets]
    in_edges = defaultdict(list)    # target -> [rels]
    for rel, imps in imports_from.items():
        for _, tgt, _ in imps:
            out_edges[rel].append(tgt)
            in_edges[tgt].append(rel)
    # re-export 转发也构成文件间依赖边
    for rel, rexp in reexports.items():
        for _, tgt in rexp:
            out_edges[rel].append(tgt)
            in_edges[tgt].append(rel)
    for rel, tgts in star_reexports.items():
        for tgt in tgts:
            out_edges[rel].append(tgt)
            in_edges[tgt].append(rel)

    reachable = set()
    queue = deque(args.entry)
    for e in args.entry:
        if e in files:
            reachable.add(e)
    while queue:
        cur = queue.popleft()
        for nxt in out_edges.get(cur, []):
            if nxt not in reachable:
                reachable.add(nxt)
                queue.append(nxt)

    dead_files = [f for f in files if f not in reachable and f not in ignored_files]

    # ---------------- 符号级引用 ----------------
    used_symbols = defaultdict(set)   # (rel, symbol) -> marking used
    star_referenced = set()           # rel 被整体引用（ns / star / side / default / dynamic）
    if not args.only_files:
        for rel, imps in imports_from.items():
            for kind, tgt, syms in imps:
                if kind == "named":
                    for s in syms or []:
                        used_symbols[(tgt, s)].add(rel)
                else:
                    star_referenced.add(tgt)
        # re-export 转发也算对目标符号的引用
        for rel, rexp in reexports.items():
            for name, tgt in rexp:
                used_symbols[(tgt, name)].add(rel)
        for rel, tgts in star_reexports.items():
            star_referenced.update(tgts)

        dead_exports = []
        for rel, exp in exports.items():
            if rel in ignored_files or rel in dead_files:
                continue
            if rel in star_referenced:
                continue

            # 预计算文件内各符号的出现次数（用于判断内部引用）
            try:
                src_code = open(os.path.join(root, rel), encoding="utf-8").read()
                inner_counts = {}
                for n in exp:
                    inner_counts[n] = len(re.findall(r'\b' + re.escape(n) + r'\b', src_code))
            except (OSError, UnicodeDecodeError):
                inner_counts = {}

            for name in sorted(exp):
                if not used_symbols.get((rel, name)):
                    tag = ""
                    if inner_counts.get(name, 0) >= 2:
                        tag = " (内部引用，导出多余)"
                    dead_exports.append((rel, name, tag))

    # ---------------- 输出 ----------------
    if args.json:
        payload = {
            "root": root,
            "ts_files": len(files),
            "dead_files": dead_files,
            "dead_exports": sorted([f"{rel}: {name}{tag}" for rel, name, tag in dead_exports]) if not args.only_files else [],
        }
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 1 if (dead_files or dead_exports) else 0

    print(f"[扫描] {root}")
    print(f"[TS 文件] {len(files)} 个")
    print(f"[入口] {'、'.join(args.entry)}")
    if ignored_files:
        print(f"[忽略] {len(ignored_files)} 个文件")
    print("-" * 60)

    found_any = False
    if dead_files:
        found_any = True
        print(f"[孤立文件] {len(dead_files)} 个（未被引用，非入口）")
        for f in dead_files:
            print(f"  - {f}")
    else:
        print("[孤立文件] 无")

    if not args.only_files:
        if dead_exports:
            found_any = True
            print(f"[死导出] {len(dead_exports)} 个（无跨文件引用）")
            by_file = defaultdict(list)
            for rel, name, tag in dead_exports:
                by_file[rel].append(name + tag)
            for rel in sorted(by_file):
                print(f"  - {rel}: {', '.join(by_file[rel])}")
        else:
            print("[死导出] 无")
    print("-" * 60)
    if found_any:
        print("\n[结果] 发现死代码，请人工确认后删除（注意 barrel/文档导出可加 --ignore 排除）。")
        return 1
    print("\n[结果] 未发现死代码。")
    return 0


if __name__ == "__main__":
    sys.exit(main())