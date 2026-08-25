#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
check_agent_files.py — 检查 src/ 下所有目录是否都包含 AGENT.md 文件。

遍历 src/ 目录（默认：本脚本所在目录的 ../src），逐个检查所有子目录
是否都存在 AGENT.md；若存在缺失，输出缺失目录列表并以非零码退出。
支持 --create 自动创建缺失文件，--clean 清理空文件夹中的 AGENT.md。

空文件夹规则：空文件夹（仅含 AGENT.md 或完全空）不需要 AGENT.md，
检查时会自动跳过，不会报缺失。

用法：
    python script/check_agent_files.py                       # 默认检查 AGENT.md
    python script/check_agent_files.py --create             # 自动创建缺失的 AGENT.md
    python script/check_agent_files.py --clean              # 删除空文件夹中的 AGENT.md
    python script/check_agent_files.py --name AGENTS.md     # 检查其他文件名
    python script/check_agent_files.py --top-level          # 仅检查第一层子目录
    python script/check_agent_files.py --root <dir>         # 指定根目录
    python script/check_agent_files.py --git                # 仅检查 git 变更涉及的目录

--git 模式：
    结合 git status 分析，只关注有新增/修改文件的目录。输出变更文件列表
    和 AGENT.md 覆盖状态，方便 AI 直接获知需要处理的范围。

退出码：
    0  所有非空目录都包含目标文件（或 --create/--clean 成功）
    1  存在缺失（且未使用 --create）
    2  根目录不存在
"""

import argparse
import os
import sys
from pathlib import Path

# Windows 控制台默认 GBK 编码，强制 UTF-8 输出避免中文乱码
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "..", "src"))  # dash/src/

SKIP_DIRS = {".git", "__pycache__", ".venv"}

DEFAULT_NAME = "AGENT.md"

AGENT_TEMPLATE = """# AGENT.md — {dirname}

本目录是 Neon Ascent（霓虹攀升）项目的组成部分，位于 `src{relpath}/`。

## 职责

（请在此处描述本目录的职责与包含的模块。）

## 依赖方向

（请在此处说明本目录允许或不依赖哪些其他模块。）
"""


def is_own_dir(name: str) -> bool:
    """目录名是否属于项目自有（非隐藏、非生成物/缓存）。"""
    return not name.startswith(".") and name not in SKIP_DIRS


def is_empty_dir(dirpath: str, filename: str) -> bool:
    """检查目录是否为空（仅含 filename 或无任何内容）。"""
    try:
        entries = [e for e in os.listdir(dirpath) if e != filename]
        return len(entries) == 0
    except PermissionError:
        return False


def create_agent_file(dirpath: str, rel: str, filename: str) -> str:
    """在 dirpath 下创建 AGENT.md 文件，返回文件路径。"""
    dirname = os.path.basename(dirpath) or "src"
    relpath = "/" + rel.replace("\\", "/") if rel else ""
    content = AGENT_TEMPLATE.format(dirname=dirname, relpath=relpath)
    filepath = os.path.join(dirpath, filename)
    os.makedirs(dirpath, exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content.lstrip("\n"))
    return filepath


def main() -> int:
    parser = argparse.ArgumentParser(description="检查 src/ 下所有目录是否都包含 AGENT.md")
    parser.add_argument("--root", default=DEFAULT_ROOT, help="根目录（默认 ../src）")
    parser.add_argument("--name", default=DEFAULT_NAME, help="要检查的文件名（默认 AGENT.md）")
    parser.add_argument("--top-level", action="store_true", help="仅检查第一层子目录")
    parser.add_argument("--create", action="store_true", help="自动创建缺失的 AGENT.md 文件")
    parser.add_argument("--clean", action="store_true", help="删除空文件夹中的 AGENT.md 文件")
    parser.add_argument("--git", action="store_true", help="仅检查 git 变更涉及的目录（对比 HEAD → 工作区）")
    args = parser.parse_args()

    root = os.path.abspath(args.root)
    if not os.path.isdir(root):
        print(f"错误：目录不存在 — {root}")
        return 2

    # ── --git 模式：只关注 git 变更涉及的目录 ──
    if args.git:
        sys.path.insert(0, SCRIPT_DIR)
        import git_utils
        changes = git_utils.get_changes()
        changes = git_utils.filter_by_root(changes, os.path.relpath(root, changes.root))

        print(f"[Git 变更分析] 仓库: {changes.root}")
        print(f"[对比] HEAD → 工作区")
        print(f"[范围] {root}")
        print("-" * 60)

        if changes.new_files:
            print(f"[新增文件] {len(changes.new_files)} 个")
            for f in changes.new_files:
                print(f"  + {f}")
        if changes.modified_files:
            print(f"[修改文件] {len(changes.modified_files)} 个")
            for f in changes.modified_files:
                print(f"  ~ {f}")
        if changes.deleted_files:
            print(f"[删除文件] {len(changes.deleted_files)} 个")
            for f in changes.deleted_files:
                print(f"  - {f}")
        if changes.renamed_pairs:
            print(f"[重命名] {len(changes.renamed_pairs)} 个")
            for o, n in changes.renamed_pairs:
                print(f"  {o} → {n}")
        print("-" * 60)

        if not (changes.new_files or changes.modified_files or changes.deleted_files):
            print("[结果] 范围内无变更。")
            return 0

        # 收集变更涉及的非空目录（含新增文件父目录），检查 AGENT.md 覆盖
        affected_dirs = set()
        for f in changes.new_files + changes.modified_files:
            # 用仓库相对路径转绝对路径，向上回退到 root 为止
            abs_f = os.path.normpath(os.path.join(changes.root, f))
            d = os.path.dirname(abs_f)
            while d.startswith(root) and d != root:
                affected_dirs.add(d)
                d = os.path.dirname(d)

        missing_agent = []
        covered_agent = []
        for d in sorted(affected_dirs):
            agent_path = os.path.join(d, args.name)
            if os.path.isfile(agent_path):
                covered_agent.append(os.path.relpath(d, root))
            else:
                # 非空目录才需要 AGENT.md
                if not is_empty_dir(d, args.name):
                    missing_agent.append(os.path.relpath(d, root))

        if affected_dirs:
            print(f"[受影响的非空目录] {len(affected_dirs)} 个")
        if covered_agent:
            print(f"[AGENT.md 已存在] {len(covered_agent)} 个")
            for d in covered_agent:
                print(f"  ✓ {d}/")
        if missing_agent:
            print(f"[AGENT.md 缺失] {len(missing_agent)} 个")
            for d in missing_agent:
                print(f"  ✗ {d}/  （--create 可自动创建）")
        if not affected_dirs:
            print("[结果] 变更文件均为仓库根级文件，无涉及 src 下目录。")

        print("-" * 60)
        if changes.renamed_pairs:
            print("[提示] 重命名文件视为 新增+删除，注意 AGENT.md 目录树的同步。")

        if missing_agent:
            print(f"\n[结果] {len(missing_agent)} 个目录缺少 {args.name}，需补充或运行 --git --create。")
            return 1
        print("\n[结果] 所有受影响目录均已有 AGENT.md 覆盖。")
        return 0

    # 收集待检查目录：(目录绝对路径, 相对根目录的路径)
    dirs_to_check = []
    if args.top_level:
        for entry in sorted(os.listdir(root)):
            entry_path = os.path.join(root, entry)
            if os.path.isdir(entry_path) and is_own_dir(entry):
                dirs_to_check.append((entry_path, entry))
    else:
        # 先包含根目录本身
        dirs_to_check.append((root, ""))
        for dirpath, dirnames, _ in os.walk(root):
            dirnames[:] = [d for d in dirnames if is_own_dir(d)]
            rel = os.path.relpath(dirpath, root)
            if rel != ".":
                dirs_to_check.append((dirpath, rel))

    if not dirs_to_check:
        print(f"[结果] 根目录下没有可检查的子目录：{root}")
        return 2

    missing = []
    empty_with_agent = []
    present = 0
    for dirpath, rel in dirs_to_check:
        agent_path = os.path.join(dirpath, args.name)
        if os.path.isfile(agent_path):
            # 有 AGENT.md → 检查是否空文件夹
            if is_empty_dir(dirpath, args.name):
                empty_with_agent.append((dirpath, rel or "."))
            else:
                present += 1
        else:
            # 无 AGENT.md → 检查是否空文件夹（空则不报缺失）
            if is_empty_dir(dirpath, args.name):
                pass  # 空文件夹，跳过
            else:
                missing.append((dirpath, rel or "."))

    mode = "仅第一层子目录" if args.top_level else "递归（含根目录及全部子目录）"
    print(f"[扫描] {root}")
    print(f"[文件] {args.name}")
    print(f"[模式] {mode}")
    print(f"[目录] {len(dirs_to_check)} 个，其中 {present} 个包含 {args.name}，"
          f"{len(empty_with_agent)} 个空文件夹含 {args.name}，"
          f"{len(missing)} 个非空目录缺少 {args.name}")
    print("-" * 60)

    # --clean 模式：删除空文件夹中的 AGENT.md
    if args.clean:
        if not empty_with_agent:
            print(f"[OK] 没有需要清理的空文件夹 AGENT.md。")
            return 0
        cleaned = 0
        for dirpath, rel in empty_with_agent:
            agent_path = os.path.join(dirpath, args.name)
            os.remove(agent_path)
            cleaned += 1
            print(f"  [清理] {rel}/  → 已删除 {args.name}（空文件夹）")
        print("-" * 60)
        print(f"[结果] 已清理 {cleaned} 个空文件夹中的 {args.name}。")
        return 0

    if not missing and not empty_with_agent:
        print(f"[OK] 所有目录均包含 {args.name}。")
        return 0

    # 报告空文件夹中的 AGENT.md（非 --clean 模式仅提示）
    if empty_with_agent:
        print(f"[提示] 以下 {len(empty_with_agent)} 个空文件夹包含 {args.name}（空文件夹不需要）：")
        for _, rel in empty_with_agent:
            clean = rel.replace("\\", "/").rstrip("/")
            print(f"  - {clean}/")
        print(f"      使用 --clean 删除它们。")
        print("-" * 60)

    if not missing:
        return 0

    if args.create:
        created = []
        for dirpath, rel in missing:
            filepath = create_agent_file(dirpath, rel, args.name)
            created.append(rel)
            print(f"  [创建] {rel}/  → {os.path.basename(filepath)}")
        print("-" * 60)
        print(f"[结果] 已创建 {len(created)} 个 {args.name} 文件。")
        return 0

    # 仅报告不创建
    print(f"[FAIL] 以下 {len(missing)} 个目录缺少 {args.name}：")
    for _, rel in missing:
        clean = rel.replace("\\", "/").rstrip("/")
        suffix = "" if clean == "." else "/"
        print(f"  - {clean if clean != '.' else '.'}{suffix}")
    print("-" * 60)
    print(f"[提示] 请为以上目录补充 {args.name}，或使用 --create 自动创建。")
    return 1


if __name__ == "__main__":
    sys.exit(main())