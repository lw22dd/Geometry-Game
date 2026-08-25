#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
git_utils.py — Git 变更分析共享模块

供 check_agent_files.py / check_agent_structure.py 共享。
解析 git status --porcelain 输出，按文件变更类型分类，并支持按目录分组。

用法（作为独立脚本）：
    python git_utils.py                          # 当前工作目录
    python git_utils.py --root src               # 过滤 src/ 下的文件
    python git_utils.py --json                   # JSON 机器可读输出
    python git_utils.py --dirs                   # 按目录分组输出
"""

import subprocess
import os
import sys
import json
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

# Windows 控制台默认 GBK 编码，强制 UTF-8 输出避免中文乱码
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


@dataclass
class GitChanges:
    """Git 变更数据模型。"""
    root: str                         # git 仓库根（绝对路径）
    new_files: List[str] = field(default_factory=list)       # 未跟踪 ?? + 已暂存 A
    modified_files: List[str] = field(default_factory=list)  # 修改 M
    deleted_files: List[str] = field(default_factory=list)   # 删除 D
    renamed_pairs: List[Tuple[str, str]] = field(default_factory=list)  # (旧路径, 新路径)


def get_changes(workdir: Optional[str] = None) -> GitChanges:
    """获取 git 仓库的工作区变更（对比 HEAD → 工作区）。

    返回 GitChanges 对象，所有路径均为相对于仓库根的 / 通配路径。
    若不在 git 仓库中或 git 不可用，返回空 GitChanges。
    """
    cwd = workdir or os.getcwd()

    try:
        # 定位仓库根（git 输出固定为 UTF-8，须显式解码防止中文路径乱码）
        root_raw = subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=cwd, stderr=subprocess.DEVNULL, text=True, encoding="utf-8",
        ).strip()
        root = os.path.normpath(root_raw)  # 原生路径（反斜杠）

        # 获取完整状态（含所有未跟踪文件，不转义中文）
        output = subprocess.check_output(
            ["git", "-c", "core.quotepath=false", "status", "--porcelain=v1", "--untracked-files=all"],
            cwd=root, stderr=subprocess.DEVNULL, text=True, encoding="utf-8",
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        # 非 git 仓库 / git 不可用：root 置空以便调用方识别
        return GitChanges(root="")

    changes = GitChanges(root=root)

    for line in output.splitlines():
        if not line.strip():
            continue
        status = line[:2]  # 两字符状态码
        path = line[3:].strip()  # 路径（可能含空格，但 quotepath=false 不转义）

        # 处理重命名：`R  old -> new`
        if status[0] == 'R' or status[1] == 'R':
            if ' -> ' in path:
                old, new = path.split(' -> ', 1)
                changes.renamed_pairs.append((old.strip(), new.strip()))
                changes.new_files.append(new.strip())
                changes.deleted_files.append(old.strip())
            continue

        # 正常文件
        normalized = path.replace("\\", "/")

        # 首字符：暂存区状态
        if status[0] == '?' or status[0] == 'A' or status[0] == 'C':
            changes.new_files.append(normalized)
        elif status[0] == 'M' or status[1] == 'M':
            changes.modified_files.append(normalized)
        elif status[0] == 'D':
            changes.deleted_files.append(normalized)
        # 次字符：工作区状态
        if status[0] != '?' and status[1] == 'M' and status[0] != 'M':
            changes.modified_files.append(normalized)
        elif status[0] != '?' and status[1] == 'D' and status[0] != 'D':
            changes.deleted_files.append(normalized)

    # 去重（可能同时出现在 staged 和 unstaged 中）
    changes.new_files = sorted(set(changes.new_files))
    changes.modified_files = sorted(set(changes.modified_files))
    changes.deleted_files = sorted(set(changes.deleted_files))

    return changes


def filter_by_root(changes: GitChanges, src_root: str) -> GitChanges:
    """只保留 src_root（相对路径）下的文件。src_root 为空或 '.' 时不过滤。"""
    src_root = src_root.replace("\\", "/").strip("/")
    if not src_root:
        return GitChanges(
            root=changes.root,
            new_files=list(changes.new_files),
            modified_files=list(changes.modified_files),
            deleted_files=list(changes.deleted_files),
            renamed_pairs=list(changes.renamed_pairs),
        )
    root_norm = src_root + "/"
    return GitChanges(
        root=changes.root,
        new_files=[f for f in changes.new_files if f.startswith(root_norm)],
        modified_files=[f for f in changes.modified_files if f.startswith(root_norm)],
        deleted_files=[f for f in changes.deleted_files if f.startswith(root_norm)],
        renamed_pairs=[(o, n) for o, n in changes.renamed_pairs
                       if o.startswith(root_norm) or n.startswith(root_norm)],
    )


def group_by_dir(files: List[str]) -> Dict[str, List[str]]:
    """将文件按所在目录分组。"""
    groups = defaultdict(list)
    for f in files:
        d = os.path.dirname(f) or "."
        groups[d].append(f)
    return dict(sorted(groups.items()))


def format_text(changes: GitChanges, title: str = "Git 变更分析") -> str:
    """格式化为可读文本。"""
    lines = [f"[{title}]", f"仓库: {changes.root}", "对比: HEAD → 工作区"]
    lines.append("=" * 60)

    if changes.new_files:
        lines.append(f"\n[新增文件] {len(changes.new_files)} 个")
        for f in changes.new_files:
            lines.append(f"  + {f}")
    if changes.modified_files:
        lines.append(f"\n[修改文件] {len(changes.modified_files)} 个")
        for f in changes.modified_files:
            lines.append(f"  ~ {f}")
    if changes.deleted_files:
        lines.append(f"\n[删除文件] {len(changes.deleted_files)} 个")
        for f in changes.deleted_files:
            lines.append(f"  - {f}")
    if changes.renamed_pairs:
        lines.append(f"\n[重命名] {len(changes.renamed_pairs)} 个")
        for o, n in changes.renamed_pairs:
            lines.append(f"  {o} → {n}")

    if not (changes.new_files or changes.modified_files or changes.deleted_files or changes.renamed_pairs):
        lines.append("\n[结果] 工作区干净，无变更。")

    return "\n".join(lines)


def format_dirs(changes: GitChanges, src_root: str = "src") -> str:
    """按目录分组输出变更（供 AI 直接使用）。"""
    filtered = filter_by_root(changes, src_root) if src_root else changes
    lines = [f"[{src_root}/ 下按目录分组的 Git 变更]"]
    lines.append("=" * 60)

    # 所有有变更的目录
    all_new = group_by_dir(filtered.new_files)
    all_mod = group_by_dir(filtered.modified_files)
    all_del = group_by_dir(filtered.deleted_files)
    all_dirs = sorted(set(list(all_new.keys()) + list(all_mod.keys()) + list(all_del.keys())))

    if not all_dirs:
        lines.append("\n无变更。")
        return "\n".join(lines)

    for d in all_dirs:
        lines.append(f"\n  {d}/")
        if d in all_new:
            for f in all_new[d]:
                lines.append(f"    + {os.path.basename(f)}")
        if d in all_mod:
            for f in all_mod[d]:
                lines.append(f"    ~ {os.path.basename(f)}")
        if d in all_del:
            for f in all_del[d]:
                lines.append(f"    - {os.path.basename(f)}")

    lines.append("\n---")
    lines.append(f"新增: {len(filtered.new_files)}  修改: {len(filtered.modified_files)}  删除: {len(filtered.deleted_files)}")
    return "\n".join(lines)


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Git 变更分析工具")
    parser.add_argument("--root", default="", help="只显示指定前缀下的文件（如 src）")
    parser.add_argument("--json", action="store_true", help="JSON 输出")
    parser.add_argument("--dirs", action="store_true", help="按目录分组输出")
    args = parser.parse_args()

    changes = get_changes()
    if args.root:
        changes = filter_by_root(changes, args.root)

    if args.json:
        print(json.dumps({
            "root": changes.root,
            "new_files": changes.new_files,
            "modified_files": changes.modified_files,
            "deleted_files": changes.deleted_files,
            "renamed_pairs": [{"from": o, "to": n} for o, n in changes.renamed_pairs],
        }, ensure_ascii=False, indent=2))
        return

    if args.dirs:
        print(format_dirs(changes, args.root))
    else:
        title = f"Git 变更分析（{args.root}/）" if args.root else "Git 变更分析"
        print(format_text(changes, title))


if __name__ == "__main__":
    main()