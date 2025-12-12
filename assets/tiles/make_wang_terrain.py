import sys
print(sys.executable)


import os, json
import numpy as np
import cv2



TILE = 32

# ------------------------------------------------------------
# FILES (always relative to this script)
# ------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_PNG = os.path.join(SCRIPT_DIR, "terrain.png")
OUT_PNG = os.path.join(SCRIPT_DIR, "terrain_wang_rows_cv.png")
OUT_META = os.path.join(SCRIPT_DIR, "terrain_wang_rows_cv_meta.json")

# ------------------------------------------------------------
# WANG bit order: bit0=N, bit1=E, bit2=S, bit3=W
# ------------------------------------------------------------
BIT_N = 1
BIT_E = 2
BIT_S = 4
BIT_W = 8

# ------------------------------------------------------------
# REGION MODEL
# We do NOT assume a 1px seam. We copy pixels in "bands" (thirds).
# split = inset in pixels that defines corner/edge “ports”.
# For 32px tiles, 10 or 11 are sane. 11 is closest to 1/3.
# ------------------------------------------------------------
SPLIT = 11  # change to 10 or 12 if needed

def load_rgba(path: str) -> np.ndarray:
    # cv2 loads BGRA by default; convert to RGBA
    bgra = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if bgra is None:
        raise FileNotFoundError(path)
    if bgra.shape[2] == 3:
        bgr = bgra
        a = np.full((bgr.shape[0], bgr.shape[1], 1), 255, np.uint8)
        bgra = np.concatenate([bgr, a], axis=2)
    rgba = cv2.cvtColor(bgra, cv2.COLOR_BGRA2RGBA)
    return rgba

def crop_tile(sheet: np.ndarray, row: int, col: int) -> np.ndarray:
    y0 = row * TILE
    x0 = col * TILE
    return sheet[y0:y0+TILE, x0:x0+TILE].copy()

def alpha_mask(tile: np.ndarray, thr: int = 1) -> np.ndarray:
    return (tile[:, :, 3] >= thr).astype(np.uint8)

def paste_region(dst: np.ndarray, src: np.ndarray, region_mask: np.ndarray):
    """
    Copy RGBA pixels from src to dst wherever region_mask==1 AND src alpha>0.
    This preserves exact donor pixels (tileable weave), and respects transparency.
    """
    src_a = src[:, :, 3] > 0
    m = (region_mask.astype(bool) & src_a)
    dst[m] = src[m]

def rect_mask(x0, y0, x1, y1) -> np.ndarray:
    m = np.zeros((TILE, TILE), np.uint8)
    m[y0:y1, x0:x1] = 1
    return m

# Precomputed region masks (bands + corners)
REG_N  = rect_mask(0, 0, TILE, SPLIT)
REG_S  = rect_mask(0, TILE - SPLIT, TILE, TILE)
REG_W  = rect_mask(0, 0, SPLIT, TILE)
REG_E  = rect_mask(TILE - SPLIT, 0, TILE, TILE)

REG_NW = rect_mask(0, 0, SPLIT, SPLIT)
REG_NE = rect_mask(TILE - SPLIT, 0, TILE, SPLIT)
REG_SW = rect_mask(0, TILE - SPLIT, SPLIT, TILE)
REG_SE = rect_mask(TILE - SPLIT, TILE - SPLIT, TILE, TILE)

# “Middle” area we leave for fill/bridging
REG_MID = rect_mask(SPLIT, SPLIT, TILE - SPLIT, TILE - SPLIT)

def compute_outside_reachable(out_rgba: np.ndarray, mask: int) -> np.ndarray:
    """
    Flood fill on transparency to find outside-reachable pixels,
    but only seed from edges that are NOT connected (bit=0).
    Connected edges are "ports" into neighbors and should NOT be considered outside.
    """
    transparent = (out_rgba[:, :, 3] == 0).astype(np.uint8)  # 1 where passable
    h, w = transparent.shape

    visited = np.zeros((h, w), np.uint8)

    def flood_from(seed_x, seed_y):
        if transparent[seed_y, seed_x] == 0 or visited[seed_y, seed_x] == 1:
            return
        # OpenCV floodFill needs a mask that is 2 pixels larger
        ff_mask = np.zeros((h + 2, w + 2), np.uint8)
        # We flood on a copy; mark visited by setting to 0 in a temp
        temp = transparent.copy()
        cv2.floodFill(temp, ff_mask, (seed_x, seed_y), 0)
        reached = (temp == 0) & (transparent == 1)
        visited[reached] = 1
        # mark as no longer passable to avoid rework
        transparent[reached] = 0

    # Always seed from corners (true outside for hole/void styles)
    seeds = [(0,0), (w-1,0), (0,h-1), (w-1,h-1)]

    # Seed from edge pixels only where that edge is outside (bit=0)
    # N edge is outside if N bit is 0
    if (mask & BIT_N) == 0:
        for x in range(w):
            seeds.append((x, 0))
    if (mask & BIT_S) == 0:
        for x in range(w):
            seeds.append((x, h-1))
    if (mask & BIT_W) == 0:
        for y in range(h):
            seeds.append((0, y))
    if (mask & BIT_E) == 0:
        for y in range(h):
            seeds.append((w-1, y))

    for (sx, sy) in seeds:
        flood_from(sx, sy)

    return visited  # 1 where outside-reachable transparency

def fill_interior(out_rgba: np.ndarray, interior_tile: np.ndarray, outside_reach: np.ndarray):
    """
    Fill ONLY the non-outside, still-transparent pixels with the interior texture.
    Uses wrapped sampling so texture phase stays consistent inside the tile.
    """
    fill_mask = (out_rgba[:, :, 3] == 0) & (outside_reach == 0)
    if not np.any(fill_mask):
        return
    yy, xx = np.nonzero(fill_mask)
    out_rgba[yy, xx] = interior_tile[yy % TILE, xx % TILE]

def build_wang_tile(
    interior_tile: np.ndarray,
    edgeN: np.ndarray, edgeE: np.ndarray, edgeS: np.ndarray, edgeW: np.ndarray,
    cornerNW: np.ndarray, cornerNE: np.ndarray, cornerSE: np.ndarray, cornerSW: np.ndarray,
    singleton: np.ndarray,
    mask: int
) -> np.ndarray:
    """
    Compose rim regions by copying exact pixels from donor tiles.
    Then fill interior last using port-aware outside flood fill.
    """
    out = np.zeros((TILE, TILE, 4), np.uint8)  # transparent canvas

    if mask == 0:
        # singleton is an authored tile; use as-is
        return singleton.copy()

    # 1) Place side regions (bands) from edge donors for connected sides
    if mask & BIT_N: paste_region(out, edgeN, REG_N)
    if mask & BIT_S: paste_region(out, edgeS, REG_S)
    if mask & BIT_W: paste_region(out, edgeW, REG_W)
    if mask & BIT_E: paste_region(out, edgeE, REG_E)

    # 2) Place corners when both adjacent sides are connected
    if (mask & BIT_N) and (mask & BIT_W): paste_region(out, cornerNW, REG_NW)
    if (mask & BIT_N) and (mask & BIT_E): paste_region(out, cornerNE, REG_NE)
    if (mask & BIT_S) and (mask & BIT_E): paste_region(out, cornerSE, REG_SE)
    if (mask & BIT_S) and (mask & BIT_W): paste_region(out, cornerSW, REG_SW)

    # 3) Small crack closing (only on alpha mask), so fills don’t leak
    a = (out[:, :, 3] > 0).astype(np.uint8)
    a_closed = cv2.morphologyEx(a, cv2.MORPH_CLOSE, np.ones((3,3), np.uint8), iterations=1)
    # Only add alpha where we already have some nearby content; don’t invent colors.
    # (So we keep pixels as-is; this just helps flood-fill classification.)
    # We use the closed mask only for outside calculation below by temporarily treating
    # newly-closed pixels as blocked.
    # (We do NOT paint new colors here.)

    # 4) Compute outside reachability on transparency, with edge-ports based on mask
    # Temporarily treat closed alpha as blocked to prevent leaks through 1px gaps.
    out_for_fill = out.copy()
    out_for_fill[:, :, 3] = np.where(a_closed > 0, np.maximum(out[:, :, 3], 1), out[:, :, 3]).astype(np.uint8)
    outside = compute_outside_reachable(out_for_fill, mask)

    # 5) Fill the interior last
    fill_interior(out, interior_tile, outside)

    return out

def place_tile(atlas: np.ndarray, tile: np.ndarray, row: int, col: int):
    y0 = row * TILE
    x0 = col * TILE
    atlas[y0:y0+TILE, x0:x0+TILE] = tile

# ------------------------------------------------------------
# Your family defs (add all families here)
# Using your row/col tile slicing on terrain.png
# ------------------------------------------------------------
FAMILIES = [
    {
        "id": "ground_light",
        "interior": [(5,0), (5,1), (5,2)],
        "singleton": (0,0),
        "edgeN": (2,1), "edgeS": (4,1), "edgeW": (3,0), "edgeE": (3,2),
        "cornerNW": (2,0), "cornerNE": (2,2), "cornerSE": (4,2), "cornerSW": (4,0),
    },
    {
        "id": "chasm_light",
        "interior": [(5,9), (5,10), (5,11)],
        "singleton": (0,9),
        "edgeN": (2,10), "edgeS": (4,10), "edgeW": (3,9), "edgeE": (3,11),
        "cornerNW": (2,9), "cornerNE": (2,11), "cornerSE": (4,11), "cornerSW": (4,9),
    },
]

def main():
    sheet = load_rgba(SRC_PNG)
    rows = len(FAMILIES)
    cols = 16  # masks 0..15

    atlas = np.zeros((rows * TILE, cols * TILE, 4), np.uint8)
    meta = {
        "tileSize": TILE,
        "cols": cols,
        "bitOrder": "bit0=N, bit1=E, bit2=S, bit3=W",
        "splitPx": SPLIT,
        "families": {}
    }

    for r, fam in enumerate(FAMILIES):
        # Choose first interior (you can randomize later)
        interior_tile = crop_tile(sheet, *fam["interior"][0])
        singleton = crop_tile(sheet, *fam["singleton"])

        edgeN = crop_tile(sheet, *fam["edgeN"])
        edgeS = crop_tile(sheet, *fam["edgeS"])
        edgeE = crop_tile(sheet, *fam["edgeE"])
        edgeW = crop_tile(sheet, *fam["edgeW"])

        cornerNW = crop_tile(sheet, *fam["cornerNW"])
        cornerNE = crop_tile(sheet, *fam["cornerNE"])
        cornerSE = crop_tile(sheet, *fam["cornerSE"])
        cornerSW = crop_tile(sheet, *fam["cornerSW"])

        for mask in range(16):
            tile = build_wang_tile(
                interior_tile,
                edgeN, edgeE, edgeS, edgeW,
                cornerNW, cornerNE, cornerSE, cornerSW,
                singleton,
                mask
            )
            place_tile(atlas, tile, r, mask)

        meta["families"][fam["id"]] = {"row": r, "maskCol": "col=mask (0..15)"}

    # Save (convert RGBA -> BGRA for cv2.imwrite)
    bgra = cv2.cvtColor(atlas, cv2.COLOR_RGBA2BGRA)
    cv2.imwrite(OUT_PNG, bgra)

    with open(OUT_META, "w") as f:
        json.dump(meta, f, indent=2)

    print("Wrote:", OUT_PNG)
    print("Wrote:", OUT_META)

if __name__ == "__main__":
    main()
