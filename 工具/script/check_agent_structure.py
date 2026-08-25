#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
check_agent_structure.py
------------------------
校验「根目录 AGENT.md」中的目录结构内容是否与真实目录结构实时匹配。

默认约定（本仓库布局）:
    dash/
    ├── script/check_agent_structure.py   <- 本脚本
    ├── src/
    │   ├── AGENT.md                      <- 待校验的文档（其「目录结构」代码块树根为 src/）
    │   └── ...
    └── ...

用法:
    python check_agent_structure.py                       # 校验并报告差异
    python check_agent_structure.py --fix                 # 校验 + 自动修复 AGENT.md 目录树
    python check_agent_structure.py --doc <path>          # 指定 AGENT.md 路径
    python check_agent_structure.py --root <dir>          # 指定树根（如 src/）所在的父目录
    python check_agent_structure.py --verbose             # 匹配时也输出统计信息
    python check_agent_structure.py --git                 # 仅分析 git 变更涉及的目录树

--git 模式：
    结合 git status 分析，输出新增文件路径及其归属的 AGENT.md 文档，报告哪些
    AGENT.md 目录树需要更新（新增目录未声明 / 已删除条目残留）。方便 AI 直接
    获知需要同步的文档范围，无需逐个目录遍历比对。

校验规则（双向匹配）:
    1. 文档目录树中声明的每个目录 / 文件必须真实存在；
    2. 真实存在的每个子目录、以及树根下的每个文件，必须在文档目录树中有对应条目
       （嵌套文件不强制：AGENT.md 通常在注释里提及它们，不写成树条目）。

--fix 模式:
    自动生成与实际目录结构完全一致的目录树，保留原有注释，替换 AGENT.md 中的旧树。
    这是保证 AGENT.md 100% 同步真实项目结构的推荐方式。

退出码:
    0  匹配（或 --fix 修复成功）
    1  不匹配（且未使用 --fix，输出：请更新当前根目录下的AGENT.md目录结构）
    2  无法定位 / 解析 AGENT.md
"""

import argparse
import io
import os
import re
import subprocess
import sys
from pathlib import Path

# 确保 stdout 为 UTF-8（Windows 终端编码兼容）
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

MISMATCH_MSG = "请更新当前根目录下的AGENT.md目录结构"
SCRIPT_DIR = Path(__file__).resolve().parent

DEFAULT_DOC_REL = Path("src") / "AGENT.md"  # 相对项目根（dash/）


# ── 解析 ─────────────────────────────────────────────────────────────


def find_tree_lines(text: str):
    """从文档中抽取目录结构树形代码块，返回 (行列表, 块起始行号, 块结束行号, 全文行列表)。

    找不到返回 None。行号可用于精确替换该代码块。
    """
    all_lines = text.splitlines(keepends=True)
    blocks = re.findall(r"```[^\n]*\n(.*?)\n```", text, flags=re.S)
    offset = 0
    for block in blocks:
        raw_lines = block.splitlines()
        lines = [ln.strip("\r") for ln in raw_lines if ln.strip()]
        if not lines:
            offset += len(raw_lines) + 2
            continue
        first = lines[0].strip()
        if re.match(r"^[\w.\-]+/?$", first) and ("├" in block or "└" in block):
            # 找到该块在 all_lines 中的起止行号
            start = end = -1
            fence = 0
            for i, ln in enumerate(all_lines):
                if ln.strip().startswith("```") and not ln.strip().startswith("````"):
                    fence += 1
                    if fence == 1:
                        start = i
                    elif fence == 2:
                        end = i
                        break
            return lines, start, end, all_lines
        offset += len(raw_lines) + 2
    return None


def parse_tree(lines):
    """解析树形代码块，返回 (树根名, 声明目录集合, 声明文件集合, 树根下文件集合)。"""
    tree_root = lines[0].strip().rstrip("/")
    levels = {}          # 深度 -> 该深度最近一条声明的相对路径
    declared_dirs = set()
    declared_files = set()
    root_files = set()
    for line in lines[1:]:
        if "├" not in line and "└" not in line:
            continue  # 跳过注释续行（如"│   │   # + interact.ts …"）
        depth = line.count("│") + 1
        body = line.split("#", 1)[0]
        idx = body.rfind("──")
        name = body[idx + 2:].strip() if idx >= 0 else body.strip()
        if not name:
            continue
        is_dir = name.endswith("/")
        name = name.rstrip("/")
        parent = levels.get(depth - 1, "")
        rel = parent + "/" + name if parent else name
        levels[depth] = rel
        if is_dir:
            declared_dirs.add(rel)
        else:
            declared_files.add(rel)
            if depth == 1:
                root_files.add(rel)
    return tree_root, declared_dirs, declared_files, root_files


def parse_old_comments(lines):
    """解析旧树中的注释，返回 {path_without_slash: comment_text}。

    处理单行注释（# 后内容）和多行注释续行（只有 │ 和 # 的行）。
    path 不含末尾斜杠（目录名保持原样，如 core/ecs 而非 core/ecs/）。
    """
    levels = {}
    comment_map = {}
    last_path = None

    for line in lines[1:]:  # 跳过根行（如 "src/"）
        if "├" in line or "└" in line:
            depth = line.count("│") + 1
            parts = line.split("#", 1)
            name_part = parts[0]
            idx = name_part.rfind("──")
            name = name_part[idx + 2:].strip() if idx >= 0 else name_part.strip()
            if not name:
                continue
            name = name.rstrip("/")
            parent = levels.get(depth - 1, "")
            path = parent + "/" + name if parent else name
            levels[depth] = path
            last_path = path
            if len(parts) > 1:
                comment = parts[1].strip()
                if comment:
                    comment_map[path] = comment
                else:
                    comment_map[path] = ""
        elif "│" in line and "#" in line and last_path:
            parts = line.split("#", 1)
            if len(parts) > 1:
                extra = parts[1].strip()
                if extra:
                    existing = comment_map.get(last_path, "")
                    if existing:
                        comment_map[last_path] = existing + "\n" + extra
                    else:
                        comment_map[last_path] = extra

    return comment_map


# ── 真实目录遍历 ────────────────────────────────────────────────────


def walk_reality(root: Path):
    """返回 (相对目录集合, 树根下文件集合, 空目录集合)。相对路径统一用 '/' 分隔。

    空目录判定：目录下没有任何子目录，且除 AGENT.md / AGENTS.md（自动生成的
    文档占位文件）外没有任何文件 —— 即除文档占位外无真实内容。
    """
    real_dirs = set()
    real_root_files = set()
    empty_dirs = set()
    for dirpath, _dirnames, filenames in os.walk(root):
        rel = Path(dirpath).relative_to(root)
        rel_str = str(rel).replace("\\", "/")
        if str(rel) != ".":
            real_dirs.add(rel_str)
            # 目录下无子目录，且除 AGENT.md/AGENTS.md 外无文件 → 空目录
            content_files = [
                f for f in filenames
                if f.lower() not in ("agent.md", "agents.md")
            ]
            if not _dirnames and not content_files:
                empty_dirs.add(rel_str)
        else:
            real_root_files.update(filenames)
    return real_dirs, real_root_files, empty_dirs


# ── 树生成（--fix 核心）─────────────────────────────────────────────


def parse_old_nested(lines):
    """解析旧树为嵌套字典 + 注释表，保持原始条目顺序。

    - 嵌套字典：{name: sub_dict | None}，None 表示文件
    - comment_map：{path_without_slash: comment_text}
    - 顺序：dict 插入序 = 原文条目出现序
    """
    levels = {}        # 深度 -> (相对路径, 嵌套字典)
    comment_map = {}
    nested = {}        # 顶层 (src/ 下的条目)
    last_path = None

    for line in lines[1:]:  # 跳过根行
        if "├" in line or "└" in line:
            depth = line.count("│") + 1
            parts = line.split("#", 1)
            name_part = parts[0]
            idx = name_part.rfind("──")
            name = name_part[idx + 2:].strip() if idx >= 0 else name_part.strip()
            if not name:
                continue
            is_dir = name.endswith("/")
            name = name.rstrip("/")
            parent_path, parent_node = levels.get(depth - 1, ("", nested))
            path = parent_path + "/" + name if parent_path else name

            if is_dir:
                node = {}
                parent_node[name] = node
            else:
                node = None
                parent_node[name] = None
            levels[depth] = (path, node)
            last_path = path
            if len(parts) > 1:
                comment = parts[1].strip()
                if comment:
                    comment_map[path] = comment
                else:
                    comment_map[path] = ""
        elif "│" in line and "#" in line and last_path:
            parts = line.split("#", 1)
            if len(parts) > 1:
                extra = parts[1].strip()
                if extra:
                    existing = comment_map.get(last_path, "")
                    if existing:
                        comment_map[last_path] = existing + "\n" + extra
                    else:
                        comment_map[last_path] = extra

    return nested, comment_map


def build_nested_tree(root_files, dirs):
    """从真实结构构建嵌套字典树（字母序）。"""
    tree = {}
    for f in sorted(root_files):
        tree[f] = None  # None 标记文件
    for d in sorted(dirs):
        parts = d.split("/")
        current = tree
        for p in parts:
            if p not in current:
                current[p] = {}
            current = current[p]
    return tree


def merge_trees(old_tree, real_tree):
    """以旧树顺序为准，合并真实结构。

    - 保留旧树中仍然真实存在的条目（保持原顺序、原注释）；
    - 追加真实中存在但旧树缺失的条目（按字母序补在末尾）。
    """
    merged = {}
    for name, old_node in old_tree.items():
        if name not in real_tree:
            continue  # 旧树条目已不存在于真实结构 → 丢弃
        real_node = real_tree[name]
        if old_node is None:
            merged[name] = None
        else:
            merged[name] = merge_trees(old_node, real_node) if isinstance(real_node, dict) else None
    for name in sorted(real_tree.keys() - old_tree.keys()):
        merged[name] = real_tree[name]
    return merged


def render_tree(tree, comment_map, prefix="", path_prefix=""):
    """递归渲染目录树（保持 dict 插入顺序），返回行列表。

    comment_map 的 key 为不带末尾斜杠的路径（如 core/ecs）。
    多行注释（续行）会用 \n 分隔，渲染时放在主行之后的缩进行。
    """
    lines = []
    items = list(tree.items())  # 保持合并后的条目顺序
    for i, (name, children) in enumerate(items):
        is_last = i == len(items) - 1
        connector = "└── " if is_last else "├── "

        path = path_prefix + name
        raw_comment = comment_map.get(path, "")
        main_comment = ""
        extra = ""
        if "\n" in raw_comment:
            main_comment, extra = raw_comment.split("\n", 1)
        else:
            main_comment = raw_comment

        if children is None:  # 文件
            line = f"{prefix}{connector}{name}"
            if main_comment:
                line += f"  # {main_comment}"
            lines.append(line)
            if extra:
                continuation = f"{prefix}{'    ' if is_last else '│   '}  # {extra}"
                lines.append(continuation)
        else:  # 目录
            line = f"{prefix}{connector}{name}/"
            if main_comment:
                line += f"  # {main_comment}"
            lines.append(line)
            if extra:
                continuation = f"{prefix}{'    ' if is_last else '│   '}  # {extra}"
                lines.append(continuation)
            child_prefix = prefix + ("    " if is_last else "│   ")
            sub = render_tree(children, comment_map, child_prefix, path + "/")
            lines.extend(sub)

    return lines


def generate_new_tree(real_root_files, real_dirs, old_nested, old_comment_map):
    """生成与实际目录结构一致的树行列表：以旧树顺序为基础，追加缺失条目，保留旧注释。"""
    real_tree = build_nested_tree(real_root_files, real_dirs)
    merged = merge_trees(old_nested, real_tree)
    return render_tree(merged, old_comment_map)


def replace_tree_block(text, new_lines, tree_start, tree_end, all_lines):
    """将 AGENT.md 中第 tree_start ~ tree_end 行的代码块替换为新内容，返回更新后的文本。

    tree_start, tree_end 为 find_tree_lines 返回的块边界行号。
    all_lines 为 text.splitlines(keepends=True)。
    """
    before = all_lines[:tree_start]
    after = all_lines[tree_end + 1 :]
    block = ["```\n", f"{new_lines[0]}\n"]
    for l in new_lines[1:]:
        block.append(f"{l}\n")
    block.append("```\n")
    return "".join(before + block + after)


# ── git 变更分析（--git 模式）────────────────────────────────────


def _load_git_utils():
    """加载同目录的 git_utils 共享模块。"""
    sys.path.insert(0, str(SCRIPT_DIR))
    import git_utils
    return git_utils


def _scan_doc_mismatch(doc_path: Path, anchor: Path):
    """对单个 AGENT.md 执行标准双向校验，返回 (real_root, problems, empty_dirs) 或 None。

    None = 文档不存在 / 无目录树代码块 / 声明的树根不存在。
    problems 为字符串列表（空 = 匹配）。
    """
    if not doc_path.is_file():
        return None
    text = doc_path.read_text(encoding="utf-8")
    tree_info = find_tree_lines(text)
    if tree_info is None:
        return None
    lines, tree_start, tree_end, all_lines = tree_info
    tree_root, declared_dirs, declared_files, root_files = parse_tree(lines)
    real_root = (anchor / tree_root).resolve()
    if not real_root.is_dir():
        return None
    real_dirs, real_root_files, empty_dirs = walk_reality(real_root)

    problems = []
    for d in sorted(declared_dirs):
        if not (real_root / Path(*d.split("/"))).is_dir():
            problems.append(f"文档中声明但在实际目录中缺失（目录）：{d}/")
    for f in sorted(declared_files):
        if not (real_root / Path(*f.split("/"))).is_file():
            problems.append(f"文档中声明但在实际目录中缺失（文件）：{f}")
    for d in sorted(real_dirs - declared_dirs):
        problems.append(f"实际存在但目录树中未声明（目录）：{d}/")
    for f in sorted(real_root_files - root_files):
        problems.append(f"实际存在但目录树中未声明（文件）：{f}")
    return real_root, problems, empty_dirs


def run_git_mode(anchor: Path, args) -> int:
    """--git 模式主流程：列出 git 变更 + 找出受影响的 AGENT.md 及其缺失条目。"""
    git_utils = _load_git_utils()
    changes = git_utils.get_changes()
    if not changes.root:
        print("[FAIL] 当前目录不在 git 仓库中（或 git 不可用），无法进行变更分析。")
        return 2

    repo_root = Path(changes.root)
    # 变更范围：默认锚定 src/（与默认 AGENT.md 一致的树根），可用 --root 调整
    scope = (anchor / DEFAULT_DOC_REL.parent).resolve()  # dash/src/
    if args.root:
        scope = Path(args.root).resolve()
    try:
        scope_rel = os.path.relpath(scope, repo_root).replace("\\", "/")
    except ValueError:
        scope_rel = "src"
    filtered = git_utils.filter_by_root(changes, scope_rel)

    print(f"[Git 变更分析] 仓库: {changes.root}")
    print(f"[范围] {scope_rel}/")
    print(f"[对比] HEAD → 工作区")
    print("-" * 60)

    if filtered.new_files:
        print(f"[新增文件] {len(filtered.new_files)} 个")
        for f in filtered.new_files:
            print(f"  + {f}")
    if filtered.modified_files:
        print(f"[修改文件] {len(filtered.modified_files)} 个")
        for f in filtered.modified_files:
            print(f"  ~ {f}")
    if filtered.deleted_files:
        print(f"[删除文件] {len(filtered.deleted_files)} 个")
        for f in filtered.deleted_files:
            print(f"  - {f}")
    if filtered.renamed_pairs:
        print(f"[重命名] {len(filtered.renamed_pairs)} 个")
        for o, n in filtered.renamed_pairs:
            print(f"  {o} → {n}")

    if not (filtered.new_files or filtered.modified_files or filtered.deleted_files):
        print("\n[结果] 范围内无变更，无需同步任何 AGENT.md。")
        return 0
    print("-" * 60)

    # 收集变更文件就近的 AGENT.md 文档
    affected_agent_docs = set()   # doc 绝对路径集合

    changed_files = filtered.new_files + filtered.modified_files + filtered.deleted_files
    for rel in changed_files:
        # 找到该文件所在目录向上最近的一个 AGENT.md 文档（该文档树根为它所在目录）
        d = os.path.dirname(rel) or "."
        while True:
            cand = (repo_root / d / "AGENT.md").resolve()
            if cand.is_file():
                affected_agent_docs.add(cand)
                break
            parent = os.path.dirname(d)
            if parent == d:
                break
            d = parent

    # 对每个受影响的 AGENT.md，解析其真实树根，检查遗漏条目
    all_problems = {}   # doc -> [problems]
    for doc_abs in sorted(affected_agent_docs):
        project_anchor = project_root_of(doc_abs)
        result = _scan_doc_mismatch(doc_abs, project_anchor)
        if result is None:
            continue
        real_root, problems, empty_dirs = result
        all_problems[str(doc_abs)] = problems

    # 输出受影响文档
    if not all_problems:
        print("[受影响 AGENT.md] 无 —— 变更文件的目录没有就近的 AGENT.md 文档。")
        return 0
    for doc_abs in sorted(all_problems):
        doc_rel = os.path.relpath(doc_abs, repo_root).replace("\\", "/")
        problems = all_problems[doc_abs]
        print(f"\n[文档] {doc_rel}")
        if not problems:
            print(f"  ✓ 目录树与实际结构匹配")
        else:
            print(f"  ✗ 目录树与实际结构不匹配（{len(problems)} 处）：")
            for i, p in enumerate(problems, 1):
                tag = "新增" if p.startswith("实际存在") else "失效"
                print(f"    {i}. [{tag}] {p}")
            # 生成正确的修复命令（推导正确的 --root 参数，用相对路径）
            doc_abs_path = Path(doc_abs)
            # anchor = 文档所在目录的父目录（project_root_of）
            root_dir = str(doc_abs_path.parent.parent)
            root_rel = os.path.relpath(root_dir, repo_root).replace("\\", "/")
            print(f"    建议：python {SCRIPT_DIR.name}/check_agent_structure.py --doc {doc_rel} --root {root_rel} --fix")

    n_stale = sum(1 for p in all_problems.values() if p)
    print("-" * 60)
    if n_stale:
        print(f"\n[结果] {n_stale} 个 AGENT.md 目录树需要更新，请按上方建议执行 --fix。")
        return 1
    print("\n[结果] 所有受影响 AGENT.md 目录树均已与实际结构一致。")
    return 0


def project_root_of(doc_abs: Path) -> Path:
    """由 AGENT.md 绝对路径推导其目录树根 anchor。

    约定：AGENT.md 位于其描述的目录内（如 src/components/AGENT.md 描述 components/），
    因此 anchor = doc 所在目录的父目录。
    """
    return doc_abs.parent.parent


# ── 主流程 ──────────────────────────────────────────────────────────


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="校验 AGENT.md 目录结构与实际目录结构是否匹配（支持 --fix 自动修复）"
    )
    parser.add_argument("--doc", help="AGENT.md 路径（默认：项目根/src/AGENT.md）")
    parser.add_argument("--root", help="树根（如 src/）所在的父目录（默认：本脚本上一级目录）")
    parser.add_argument("--verbose", action="store_true", help="匹配时也输出统计信息")
    parser.add_argument("--git", action="store_true", help="结合 git 变更分析，仅报告受影响的文档")
    parser.add_argument(
        "--fix",
        action="store_true",
        help="自动修复 AGENT.md 目录树使其与实际结构一致（保留原有注释）",
    )
    args = parser.parse_args(argv)

    # 脚本位于 工具/script/，回退三级到项目根
    project_root = Path(__file__).resolve().parent.parent.parent   # dash/
    anchor = Path(args.root).resolve() if args.root else project_root
    doc_path = Path(args.doc).resolve() if args.doc else (anchor / DEFAULT_DOC_REL)

    # ── --git 模式：结合 git 变更，报告受影响的 AGENT.md ──
    if args.git:
        return run_git_mode(anchor, args)

    if not doc_path.is_file():
        print(f"[FAIL] 未找到 AGENT.md：{doc_path}", file=sys.stderr)
        sys.exit(2)

    text = doc_path.read_text(encoding="utf-8")
    tree_info = find_tree_lines(text)
    if tree_info is None:
        print(f"[FAIL] 无法在 {doc_path} 中找到可解析的目录结构代码块", file=sys.stderr)
        sys.exit(2)

    lines, tree_start, tree_end, all_lines = tree_info
    tree_root, declared_dirs, declared_files, root_files = parse_tree(lines)
    real_root = (anchor / tree_root).resolve()
    if not real_root.is_dir():
        print(f"[FAIL] AGENT.md 目录树中声明的根不存在：{real_root}")
        print(MISMATCH_MSG)
        sys.exit(1)

    real_dirs, real_root_files, empty_dirs = walk_reality(real_root)

    problems = []
    for d in sorted(declared_dirs):
        if not (real_root / Path(*d.split("/"))).is_dir():
            problems.append(f"文档中声明但在实际目录中缺失（目录）：{d}/")
    for f in sorted(declared_files):
        if not (real_root / Path(*f.split("/"))).is_file():
            problems.append(f"文档中声明但在实际目录中缺失（文件）：{f}")
    for d in sorted(real_dirs - declared_dirs):
        problems.append(f"实际存在但目录树中未声明（目录）：{d}/")
    for f in sorted(real_root_files - root_files):
        problems.append(f"实际存在但目录树中未声明（文件）：{f}")

    print(f"检查对象：{doc_path}")
    print(f"真实树根：{real_root}")

    if not problems:
        print("[OK] AGENT.md 中的目录结构与实际目录结构匹配。")
        if args.verbose:
            print(f"      共校验目录 {len(declared_dirs)} 个、文件 {len(declared_files)} 个。")
        sys.exit(0)

    # ── 有差异 ──
    print(f"[FAIL] AGENT.md 目录结构与实际目录结构不匹配（共 {len(problems)} 处）：")
    for i, problem in enumerate(problems, 1):
        print(f"  {i}. {problem}")

    if not args.fix:
        print(MISMATCH_MSG)
        sys.exit(1)

    # ── --fix 自动修复（最小化变动：保持原有条目顺序与注释，仅追加缺失条目） ──
    print("\n[修复] 正在生成与实际目录结构一致的目录树…")
    old_nested, old_comment_map = parse_old_nested(lines)
    # 空目录标注同步：
    # - 不再为空的目录：移除旧的「空目录」标注（保留其它注释）
    # - 当前为空目录：补注「空目录」（已有其它注释的保留原注释）
    for d, comment in list(old_comment_map.items()):
        if comment == "空目录" and d not in empty_dirs:
            del old_comment_map[d]
    for d in sorted(empty_dirs):
        if d not in old_comment_map or not old_comment_map.get(d, ""):
            old_comment_map[d] = "空目录"
    new_tree_lines = generate_new_tree(real_root_files, real_dirs, old_nested, old_comment_map)
    new_tree_lines.insert(0, tree_root + "/")

    new_text = replace_tree_block(text, new_tree_lines, tree_start, tree_end, all_lines)
    doc_path.write_text(new_text, encoding="utf-8")

    fixed_count = len(problems)
    print(f"[修复] 已修复 {fixed_count} 处差异，并保留原有注释。")
    print(f"[修复] 已更新：{doc_path}")
    print(f"\n请检查 {doc_path} 中新增条目的注释是否需要补充。")
    sys.exit(0)


if __name__ == "__main__":
    sys.exit(main())