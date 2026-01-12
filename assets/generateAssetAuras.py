#!/usr/bin/env python3
"""
gen_auras.py

Run directly from an IDE / "Run Python File".

Assumptions (per your request):
- This script lives in a "root" folder that also contains the asset subfolders.
- We only scan whitelisted subfolders listed in INPUT_SUBFOLDERS (relative to this script's folder).
- Aura outputs are generated for any enabled frame-grid sizes listed in OUTPUT_SIZES.
- Each enabled size writes to: <script_dir>/auras_<WxH>/<subfolder>/<sheetname>_<suffix>_aura_r{RADIUS}.png
  Example: auras_192x192/animations/Foo_192_aura_r2.png
           auras_64x64/tiles/Bar_aura_r2.png  (suffix can be empty)
- Skips regeneration if output exists and is newer than source unless FORCE_REGENERATE=True

Dependency:
- pip install pillow
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple

from PIL import Image

# ---------------------------------------------------------------------
# CONFIG (edit these in the IDE)
# ---------------------------------------------------------------------

# Only look inside these subfolders (relative to this script's folder)
INPUT_SUBFOLDERS: List[str] = [
    "tiles",
    "animations",
]

# Whether to recurse into nested subfolders under each input subfolder
RECURSIVE: bool = True

# Skip regeneration if output exists and is newer than source
FORCE_REGENERATE: bool = False

# Treat alpha >= ALPHA_THRESHOLD as "solid". Use 1 to match alpha!=0
ALPHA_THRESHOLD: int = 1

# Aura dilation radius (square dilation, matching your .mjs)
RADIUS: int = 2

# Enabled output sizes. The script ONLY looks at this array.
# - enabled: toggle output
# - frame_w/frame_h: frame grid size to slice the sheet
# - suffix: string appended to filename before "_aura..." (e.g. "_192"); use "" for default
# - expected_cols: warn if cols != expected, not fatal (use None for no check)
# Output folder created per size: auras_<WxH>  (e.g., auras_192x192)
@dataclass(frozen=True)
class OutputSize:
    enabled: bool
    frame_w: int
    frame_h: int
    suffix: str
    expected_cols: Optional[int] = None


OUTPUT_SIZES: List[OutputSize] = [
    # "canonical" style
    OutputSize(enabled=True, frame_w=64, frame_h=64, suffix="", expected_cols=None),

    # optional oversize view
    OutputSize(enabled=True, frame_w=32, frame_h=32, suffix="", expected_cols=None),

    # Add more as you want:
    # OutputSize(enabled=False, frame_w=32, frame_h=32, suffix="_32", expected_cols=None),
    # OutputSize(enabled=False, frame_w=96, frame_h=64, suffix="_96x64", expected_cols=None),
]

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


def _size_out_folder_name(frame_w: int, frame_h: int) -> str:
    return f"auras_{frame_w}x{frame_h}"


def main() -> int:
    script_dir = Path(__file__).resolve().parent

    enabled_sizes = [s for s in OUTPUT_SIZES if s.enabled]
    if not enabled_sizes:
        print("[gen-auras] No enabled sizes in OUTPUT_SIZES. Nothing to do.")
        return 1

    # Gather all PNGs across whitelisted subfolders
    sources: List[Tuple[Path, str]] = []
    for sub in INPUT_SUBFOLDERS:
        d = script_dir / sub
        files = _list_pngs(d, RECURSIVE)
        for f in files:
            sources.append((f, sub))

    if not sources:
        print(f"[gen-auras] No PNGs found in subfolders: {', '.join(INPUT_SUBFOLDERS)}")
        print(f"[gen-auras] Script dir: {script_dir}")
        return 1

    sizes_str = ", ".join([f"{s.frame_w}x{s.frame_h}{s.suffix}" for s in enabled_sizes])
    print(
        f"[gen-auras] root={script_dir.name} inputs={len(INPUT_SUBFOLDERS)} pngs={len(sources)} "
        f"radius={RADIUS} recursive={'yes' if RECURSIVE else 'no'} force={'yes' if FORCE_REGENERATE else 'no'} "
        f"sizes=[{sizes_str}]"
    )

    # Pre-create size output folders
    for s in enabled_sizes:
        (script_dir / _size_out_folder_name(s.frame_w, s.frame_h)).mkdir(parents=True, exist_ok=True)

    for src_path, sub in sources:
        base_name = src_path.stem

        # Load source
        try:
            src_img = Image.open(src_path).convert("RGBA")
        except Exception as e:
            print(f"[gen-auras] SKIP {src_path.relative_to(script_dir)}: failed to read PNG ({e})")
            continue

        # Apply alpha threshold if desired
        src_img = _apply_alpha_threshold(src_img, ALPHA_THRESHOLD)

        for size in enabled_sizes:
            # Output folder per size, then grouped by input subfolder to avoid collisions
            out_base = script_dir / _size_out_folder_name(size.frame_w, size.frame_h)
            out_dir = out_base / sub
            out_dir.mkdir(parents=True, exist_ok=True)

            suffix = size.suffix or ""
            # Keep same convention you used:
            # - base aura: <name>_aura_r2.png
            # - optional sizes: <name>_192_aura_r2.png
            out_path = out_dir / f"{base_name}{suffix}_aura_r{RADIUS}.png"

            if _should_skip(src_path, out_path, FORCE_REGENERATE):
                print(f"[gen-auras] skip {out_path.relative_to(script_dir)} (up-to-date)")
                continue

            ok, reason, out_img, _rows, cols = _build_aura_sheet_for_grid(
                src_img,
                size.frame_w,
                size.frame_h,
                RADIUS,
            )
            if not ok or out_img is None:
                print(f"[gen-auras] SKIP {src_path.relative_to(script_dir)} ({size.frame_w}x{size.frame_h}): {reason}")
                continue

            if size.expected_cols is not None and cols != size.expected_cols:
                print(
                    f"[gen-auras] WARN {src_path.relative_to(script_dir)} ({size.frame_w}x{size.frame_h}): "
                    f"cols={cols} (expected {size.expected_cols}). Continuing anyway."
                )

            out_img.save(out_path)
            print(f"[gen-auras] wrote {out_path.relative_to(script_dir)}")

    print("[gen-auras] done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
