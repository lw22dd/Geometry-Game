"""
大文件检查器 — 遍历 src/ 下所有文件，输出行数超过 1000 行的文件路径。

用法：
    python script/check_large_files.py
    python script/check_large_files.py --threshold 500   # 自定义阈值
"""

import os
import sys
import argparse

# Windows 控制台默认 GBK 编码，强制 UTF-8 输出避免中文乱码
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# 脚本位于 工具/script/，回退两级到项目根再到 src
DEFAULT_SRC = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "..", "src"))
SRC_DIR = os.path.abspath(DEFAULT_SRC)


def count_lines(filepath: str) -> int:
    """统计文件行数（高效，不一次性读入内存）。"""
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        for i, _ in enumerate(f, 1):
            pass
    return i if "i" in locals() else 0


def main():
    parser = argparse.ArgumentParser(description="大文件检查器 — 找出 src/ 下超过指定行数的文件")
    parser.add_argument(
        "--threshold", "-t",
        type=int,
        default=1000,
        help="行数阈值（默认 1000）",
    )
    args = parser.parse_args()

    src_dir = os.path.abspath(SRC_DIR)
    if not os.path.isdir(src_dir):
        print(f"错误：目录不存在 — {src_dir}")
        return

    threshold = args.threshold
    print(f"[扫描] {src_dir}")
    print(f"[阈值] {threshold} 行")
    print("-" * 50)

    large_files = []

    for root, dirs, files in os.walk(src_dir):
        # 跳过 node_modules 等隐藏目录
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for filename in files:
            filepath = os.path.join(root, filename)
            # 跳过非文本文件（按常见扩展名过滤）
            ext = os.path.splitext(filename)[1].lower()
            if ext in (".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg",
                       ".woff", ".woff2", ".ttf", ".otf", ".eot",
                       ".mp3", ".wav", ".ogg", ".mp4", ".webm",
                       ".zip", ".gz", ".tar", ".7z", ".rar",
                       ".wasm", ".bin", ".dat", ".blob"):
                continue

            try:
                line_count = count_lines(filepath)
            except Exception as e:
                print(f"  ⚠ 跳过 {filepath}: {e}")
                continue

            rel_path = os.path.relpath(filepath, src_dir)
            if line_count > threshold:
                print(f"  [大] {rel_path}  ({line_count} 行)")
                large_files.append((rel_path, line_count))
            else:
                print(f"  [OK] {rel_path}  ({line_count} 行)")

    print("-" * 50)
    if large_files:
        print(f"\n[结果] 共 {len(large_files)} 个文件超过 {threshold} 行：")
        for path, count in large_files:
            print(f"  - {path}  ({count} 行)")
    else:
        print(f"\n[结果] 所有文件均未超过 {threshold} 行。")


if __name__ == "__main__":
    main()