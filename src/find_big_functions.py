#!/usr/bin/env python3
"""
Find "danger zone" long functions in TypeScript files without a full parser.

- Scans all *.ts in the given directory (default: same directory as this script).
- Non-recursive by default (same level only), as requested.
- Detects:
  1) function foo(...) { ... }
  2) const foo = (...) => { ... }
  3) foo = (...) => { ... }   (common class field arrow methods)
- Reports: file, name, start/end line, line count, char count
"""

from __future__ import annotations
import re
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple, Optional


# ----------------------------
# "Mask" strings/comments so brace counting is less wrong.
# Keeps newlines intact so line numbers remain accurate.
# ----------------------------
def _mask_code(src: str) -> str:
    out = list(src)
    i, n = 0, len(src)
    state = "code"
    quote = ""

    while i < n:
        c = src[i]

        if state == "code":
            if c in ("'", '"', "`"):
                quote = c
                out[i] = " "
                state = "str"
                i += 1
                continue

            if c == "/" and i + 1 < n:
                c2 = src[i + 1]
                if c2 == "/":  # line comment
                    out[i] = out[i + 1] = " "
                    i += 2
                    state = "linecomment"
                    continue
                if c2 == "*":  # block comment
                    out[i] = out[i + 1] = " "
                    i += 2
                    state = "blockcomment"
                    continue

            i += 1
            continue

        if state == "str":
            # single/double quotes
            if quote in ("'", '"'):
                if c == "\\" and i + 1 < n:
                    out[i] = out[i + 1] = " "
                    i += 2
                    continue
                if c == quote:
                    out[i] = " "
                    state = "code"
                    i += 1
                    continue
                if c != "\n":
                    out[i] = " "
                i += 1
                continue

            # template literals (mask everything; we do NOT parse ${...} blocks)
            if quote == "`":
                if c == "\\" and i + 1 < n:
                    out[i] = out[i + 1] = " "
                    i += 2
                    continue
                if c == "`":
                    out[i] = " "
                    state = "code"
                    i += 1
                    continue
                if c != "\n":
                    out[i] = " "
                i += 1
                continue

        if state == "linecomment":
            if c == "\n":
                state = "code"
                i += 1
            else:
                out[i] = " "
                i += 1
            continue

        if state == "blockcomment":
            if c == "*" and i + 1 < n and src[i + 1] == "/":
                out[i] = out[i + 1] = " "
                i += 2
                state = "code"
            else:
                if c != "\n":
                    out[i] = " "
                i += 1
            continue

    return "".join(out)


def _build_line_starts(src: str) -> List[int]:
    starts = [0]
    for m in re.finditer(r"\n", src):
        starts.append(m.end())
    return starts


def _idx_to_line(line_starts: List[int], idx: int) -> int:
    # 1-based line numbers
    lo, hi = 0, len(line_starts)
    while lo < hi:
        mid = (lo + hi) // 2
        if line_starts[mid] <= idx:
            lo = mid + 1
        else:
            hi = mid
    return lo


def _find_brace_span(masked: str, brace_open_idx: int) -> Optional[int]:
    depth = 0
    for i in range(brace_open_idx, len(masked)):
        ch = masked[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i
    return None


@dataclass
class FuncInfo:
    file: str
    name: str
    start_line: int
    end_line: int
    lines: int
    chars: int


# Patterns:
# 1) function foo(...) {
PAT_FUNC_DECL = re.compile(r"\bfunction\s+([A-Za-z_\$][\w\$]*)\s*\(", re.M)

# 2) const foo = (...) => {
PAT_ARROW_CONST = re.compile(
    r"\b(?:const|let|var)\s+([A-Za-z_\$][\w\$]*)\s*=\s*(?:async\s*)?\([^;]*?\)\s*=>\s*{",
    re.M | re.S
)

# 3) foo = (...) => {   (class field arrow methods)
PAT_ARROW_FIELD = re.compile(
    r"^\s*([A-Za-z_\$][\w\$]*)\s*=\s*(?:async\s*)?\([^;]*?\)\s*=>\s*{",
    re.M | re.S
)


def _scan_text_for_functions(text: str, file_label: str) -> List[FuncInfo]:
    masked = _mask_code(text)
    line_starts = _build_line_starts(text)
    found: List[FuncInfo] = []

    def add_match(name: str, match_start_idx: int, brace_search_from: int):
        brace_open = masked.find("{", brace_search_from)
        if brace_open < 0:
            return
        brace_close = _find_brace_span(masked, brace_open)
        if brace_close is None:
            return

        sl = _idx_to_line(line_starts, match_start_idx)
        el = _idx_to_line(line_starts, brace_close)
        chars = max(0, (brace_close - match_start_idx + 1) | 0)
        found.append(FuncInfo(
            file=file_label,
            name=name,
            start_line=sl,
            end_line=el,
            lines=(el - sl + 1) | 0,
            chars=chars
        ))

    # function foo(...) { ... }
    for m in PAT_FUNC_DECL.finditer(masked):
        add_match(m.group(1), m.start(), m.end())

    # const foo = (...) => { ... }
    for m in PAT_ARROW_CONST.finditer(masked):
        add_match(m.group(1), m.start(), m.end())

    # foo = (...) => { ... }
    for m in PAT_ARROW_FIELD.finditer(masked):
        # Avoid counting “export default =” or other weirdness by requiring identifier + '=' at line start (already done)
        add_match(m.group(1), m.start(), m.end())

    return found


def find_big_functions_in_dir(
    directory: Path,
    min_lines: int = 250,
    top_n: int = 100,
    include_tsx: bool = False
) -> Tuple[List[FuncInfo], List[FuncInfo]]:
    exts = [".ts"] + ([".tsx"] if include_tsx else [])
    files = []
    for ext in exts:
        files.extend(sorted(directory.glob(f"*{ext}")))

    all_funcs: List[FuncInfo] = []
    for p in files:
        try:
            text = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        all_funcs.extend(_scan_text_for_functions(text, p.name))

    all_funcs.sort(key=lambda f: (f.lines, f.chars), reverse=True)
    flagged = [f for f in all_funcs if (f.lines | 0) >= (min_lines | 0)]
    return all_funcs[:top_n], flagged


def main():
    # Edit these defaults if you want “set and forget”.
    MIN_LINES = 250
    TOP_N = 100
    INCLUDE_TSX = False

    # By default: scan the directory where THIS SCRIPT lives.
    directory = Path(__file__).resolve().parent

    top, flagged = find_big_functions_in_dir(
        directory=directory,
        min_lines=MIN_LINES,
        top_n=TOP_N,
        include_tsx=INCLUDE_TSX
    )

    print(f"[bigfuncs] dir={directory}")
    print(f"[bigfuncs] showing top {TOP_N} by line count:\n")
    for f in top:
        print(f"{f.lines:5d} lines  {f.chars:7d} chars   {f.file}:L{f.start_line}-L{f.end_line}   {f.name}")

    print(f"\n[bigfuncs] flagged (>= {MIN_LINES} lines): {len(flagged)}\n")
    for f in flagged:
        print(f"{f.lines:5d} lines  {f.chars:7d} chars   {f.file}:L{f.start_line}-L{f.end_line}   {f.name}")


if __name__ == "__main__":
    main()
