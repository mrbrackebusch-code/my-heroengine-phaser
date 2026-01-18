#!/usr/bin/env python3
"""
gen_auras.py

Run directly from an IDE / "Run Python File".

Assumptions (per your request):
- This script lives in the assets root folder.
- We only scan whitelisted subfolders listed in INPUT_SUBFOLDERS (relative to this script's folder).
- Aura outputs are written into each parent folder's auras subfolder:
  <script_dir>/<subfolder>/auras/<sheetname>_aura_r{RADIUS}.png
- Frame sizes are inferred from filenames when possible (e.g. "FireTotem 96x96"),
  and tiles default to 32x32.
- Skips regeneration if output exists and is newer than source unless FORCE_REGENERATE=True

Dependency:
- pip install pillow
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional, Tuple
import re

from PIL import Image

# ---------------------------------------------------------------------
# CONFIG (edit these in the IDE)
# ---------------------------------------------------------------------

# Only look inside these subfolders (relative to this script's folder)
INPUT_SUBFOLDERS: List[str] = [
    "tiles",
    "props",
]

# Whether to recurse into nested subfolders under each input subfolder
RECURSIVE: bool = True

# Skip regeneration if output exists and is newer than source
FORCE_REGENERATE: bool = False

# Treat alpha >= ALPHA_THRESHOLD as "solid". Use 1 to match alpha!=0
ALPHA_THRESHOLD: int = 1

# Aura dilation radius (square dilation, matching your .mjs)
RADIUS: int = 2

TILE_FRAME_W: int = 32
TILE_FRAME_H: int = 32
DEFAULT_FRAME_W: int = 64
DEFAULT_FRAME_H: int = 64

# ---------------------------------------------------------------------
# Implementation
# ---------------------------------------------------------------------


def _clamp(v: int, lo: int, hi: int) -> int:
    if v < lo:
        return lo
    if v > hi:
        return hi
    return v


def _list_pngs(dir_path: Path, recursive: bool) -> List[Path]:
    if not dir_path.exists():
        return []
    if recursive:
        return sorted([p for p in dir_path.rglob("*.png") if p.is_file()])
    return sorted([p for p in dir_path.glob("*.png") if p.is_file()])


def _should_skip(src_path: Path, out_path: Path, force: bool) -> bool:
    if force:
        return False
    if not out_path.exists():
        return False
    try:
        return out_path.stat().st_mtime >= src_path.stat().st_mtime
    except OSError:
        return False


def _apply_alpha_threshold(img_rgba: Image.Image, alpha_threshold: int) -> Image.Image:
    # alpha_threshold == 1 matches "alpha != 0"
    if alpha_threshold <= 1:
        return img_rgba

    w, h = img_rgba.size
    rgba = bytearray(img_rgba.tobytes())
    n = w * h
    for i in range(n):
        a = rgba[i * 4 + 3]
        if a < alpha_threshold:
            rgba[i * 4 + 3] = 0
    return Image.frombytes("RGBA", (w, h), bytes(rgba))


def _parse_size_from_name(base_name: str) -> Optional[Tuple[int, int]]:
    m = re.search(r"(?:^|[ _-])(\d+)\s*x\s*(\d+)$", base_name, flags=re.IGNORECASE)
    if not m:
        return None
    w = int(m.group(1))
    h = int(m.group(2))
    if w <= 0 or h <= 0:
        return None
    return (w, h)


def _infer_frame_size(subfolder: str, base_name: str) -> Tuple[int, int]:
    if subfolder == "tiles":
        return (TILE_FRAME_W, TILE_FRAME_H)
    parsed = _parse_size_from_name(base_name)
    if parsed:
        return parsed
    return (DEFAULT_FRAME_W, DEFAULT_FRAME_H)


def _build_dilated_mask(frame_rgba: bytes, w: int, h: int, r: int) -> bytearray:
    """
    frame_rgba: bytes length w*h*4 (RGBA)
    returns: bytearray length w*h where 1 indicates dilated mask pixel
    """
    n = w * h
    base = bytearray(n)

    # alpha>0 base mask (threshold already applied upstream if desired)
    for i in range(n):
        if frame_rgba[i * 4 + 3] != 0:
            base[i] = 1

    if r <= 0:
        return base

    out = bytearray(n)

    # square dilation (matches your .mjs)
    for y in range(h):
        row = y * w
        y0 = _clamp(y - r, 0, h - 1)
        y1 = _clamp(y + r, 0, h - 1)
        for x in range(w):
            i = row + x
            if base[i] == 0:
                continue

            x0 = _clamp(x - r, 0, w - 1)
            x1 = _clamp(x + r, 0, w - 1)

            for yy in range(y0, y1 + 1):
                yy_row = yy * w
                for xx in range(x0, x1 + 1):
                    out[yy_row + xx] = 1

    return out


def _build_aura_sheet_for_grid(
    src_img: Image.Image,
    frame_w: int,
    frame_h: int,
    radius: int,
) -> Tuple[bool, str, Optional[Image.Image], int, int]:
    """
    Returns: (ok, reason, out_img, rows, cols)
    """
    w, h = src_img.size
    if (w % frame_w) != 0 or (h % frame_h) != 0:
        return (False, f"size {w}x{h} not divisible by {frame_w}x{frame_h}", None, 0, 0)

    rows = h // frame_h
    cols = w // frame_w

    # Build output bytes (transparent background)
    src_rgba = src_img.tobytes()
    out_bytes = bytearray(w * h * 4)

    for fr in range(rows):
        for fc in range(cols):
            ox = fc * frame_w
            oy = fr * frame_h

            # extract frame RGBA (fast row copy)
            frame = bytearray(frame_w * frame_h * 4)
            for y in range(frame_h):
                src_row_start = ((oy + y) * w + ox) * 4
                dst_row_start = (y * frame_w) * 4
                frame[dst_row_start : dst_row_start + frame_w * 4] = src_rgba[
                    src_row_start : src_row_start + frame_w * 4
                ]

            mask = _build_dilated_mask(frame, frame_w, frame_h, radius)

            # write aura pixels (white) into output
            for y in range(frame_h):
                out_row_start_px = (oy + y) * w + ox
                mask_row_start = y * frame_w
                for x in range(frame_w):
                    if mask[mask_row_start + x] == 0:
                        continue
                    pi = (out_row_start_px + x) * 4
                    out_bytes[pi + 0] = 255
                    out_bytes[pi + 1] = 255
                    out_bytes[pi + 2] = 255
                    out_bytes[pi + 3] = 255

    out_img = Image.frombytes("RGBA", (w, h), bytes(out_bytes))
    return (True, "ok", out_img, rows, cols)


def main() -> int:
    script_dir = Path(__file__).resolve().parent

    # Gather all PNGs across whitelisted subfolders
    sources: List[Tuple[Path, str]] = []
    for sub in INPUT_SUBFOLDERS:
        d = script_dir / sub
        files = _list_pngs(d, RECURSIVE)
        for f in files:
            if "auras" in f.parts:
                continue
            sources.append((f, sub))

    if not sources:
        print(f"[gen-auras] No PNGs found in subfolders: {', '.join(INPUT_SUBFOLDERS)}")
        print(f"[gen-auras] Script dir: {script_dir}")
        return 1

    print(
        f"[gen-auras] root={script_dir.name} inputs={len(INPUT_SUBFOLDERS)} pngs={len(sources)} "
        f"radius={RADIUS} recursive={'yes' if RECURSIVE else 'no'} force={'yes' if FORCE_REGENERATE else 'no'}"
    )

    for src_path, sub in sources:
        base_name = src_path.stem
        frame_w, frame_h = _infer_frame_size(sub, base_name)

        # Load source
        try:
            src_img = Image.open(src_path).convert("RGBA")
        except Exception as e:
            print(f"[gen-auras] SKIP {src_path.relative_to(script_dir)}: failed to read PNG ({e})")
            continue

        # Apply alpha threshold if desired
        src_img = _apply_alpha_threshold(src_img, ALPHA_THRESHOLD)

        out_dir = script_dir / sub / "auras"
        out_path = out_dir / f"{base_name}_aura_r{RADIUS}.png"

        if _should_skip(src_path, out_path, FORCE_REGENERATE):
            print(f"[gen-auras] skip {out_path.relative_to(script_dir)} (up-to-date)")
            continue

        ok, reason, out_img, _rows, _cols = _build_aura_sheet_for_grid(
            src_img,
            frame_w,
            frame_h,
            RADIUS,
        )
        if not ok or out_img is None:
            print(f"[gen-auras] SKIP {src_path.relative_to(script_dir)} ({frame_w}x{frame_h}): {reason}")
            continue

        out_dir.mkdir(parents=True, exist_ok=True)
        out_img.save(out_path)
        print(f"[gen-auras] wrote {out_path.relative_to(script_dir)}")

    print("[gen-auras] done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
