// tileMapGlue.ts
import type Phaser from "phaser";


import type { TileAtlas, TileFamily, AutoShape } from "./tileAtlas";
import {
  DECAL_VISUALS_BY_NAME,
  PROP_VISUALS_BY_NAME,
} from "./tileAtlas";


// ----------------------------------------------------------
// Debug
// ----------------------------------------------------------

const DEBUG_TILES_GLOBAL = true;



// ----------------------------------------------------------
// Depth model
// ----------------------------------------------------------
// World sprites (heroes/monsters/props) y-sort using:
//   depth = (yPx * WORLD_DEPTH_Y_SCALE) + zBias
const WORLD_DEPTH_Y_SCALE = 100;

// Tile layers always behind world sprites
const TILE_LAYER_DEPTH_GROUND = -1000000;
const TILE_LAYER_DEPTH_CHASM = -999000;
const TILE_LAYER_DEPTH_CHASM_OVERLAY = -998000;
const TILE_LAYER_DEPTH_DECALS = -997000;


type ParsedPropKey = {
  baseName: string;
  state: string | null;
  explicitFrameIndex: number | null;
};

function _parsePropKey(raw: string): ParsedPropKey {
  const s = (raw ?? "").trim();
  if (!s) return { baseName: "", state: null, explicitFrameIndex: null };

  // Supported syntaxes:
  //   "chest#open"   (state)
  //   "chest@closed" (state)
  //   "chest@123"    (explicit absolute frame index)
  const seps = ["#", "@", "|", ":"];
  for (let i = 0; i < seps.length; i++) {
    const sep = seps[i];
    const at = s.indexOf(sep);
    if (at <= 0) continue;

    const baseName = s.slice(0, at).trim();
    const mod = s.slice(at + 1).trim();
    if (!baseName) return { baseName: "", state: null, explicitFrameIndex: null };

    if (mod) {
      const n = (mod.length && /^[0-9]+$/.test(mod)) ? (parseInt(mod, 10) | 0) : NaN;
      if (!Number.isNaN(n)) return { baseName, state: null, explicitFrameIndex: n };
      return { baseName, state: mod, explicitFrameIndex: null };
    }
    return { baseName, state: null, explicitFrameIndex: null };
  }

  return { baseName: s, state: null, explicitFrameIndex: null };
}

function _frameIndexFromTileRef(cols: number, ref: { row: number; col: number }): number {
  return ((ref.row | 0) * (cols | 0) + (ref.col | 0)) | 0;
}

function _tileRefFromFrameIndex(cols: number, frameIndex: number): { row: number; col: number } {
  const c = (cols | 0);
  const fi = (frameIndex | 0);
  const row = c > 0 ? Math.floor(fi / c) : 0;
  const col = c > 0 ? (fi % c) : 0;
  return { row: row | 0, col: col | 0 };
}

function _ensurePropAnim(
  scene: Phaser.Scene,
  textureKey: string,
  sheetCols: number,
  anim: any
): string | null {
  if (!anim || typeof anim.key !== "string" || !anim.key.trim()) return null;

  const cols = (sheetCols | 0);
  const fps = (anim.frameRate ?? 6) | 0;
  const repeat = (anim.repeat ?? -1) | 0;

  let frames: number[] = [];

  if (Array.isArray(anim.frames) && anim.frames.length) {
    frames = anim.frames.map((n: any) => (n | 0)).filter((n: number) => Number.isFinite(n));
  } else if (Array.isArray(anim.frameRefs) && anim.frameRefs.length) {
    frames = anim.frameRefs.map((r: any) => _frameIndexFromTileRef(cols, { row: r?.row ?? 0, col: r?.col ?? 0 }));
  } else if (typeof anim.startFrame === "number" && typeof anim.endFrame === "number") {
    const a = (anim.startFrame | 0);
    const b = (anim.endFrame | 0);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    for (let i = lo; i <= hi; i++) frames.push(i | 0);
  } else if (anim.startRef && anim.endRef) {
    const a = _frameIndexFromTileRef(cols, anim.startRef);
    const b = _frameIndexFromTileRef(cols, anim.endRef);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    for (let i = lo; i <= hi; i++) frames.push(i | 0);
  }

  if (frames.length < 2) return null;

  const animKey = `prop:${textureKey}:${anim.key}`;
  const anyScene: any = scene as any;

  if (anyScene?.anims?.exists?.(animKey)) return animKey;

  try {
    anyScene?.anims?.create?.({
      key: animKey,
      frames: frames.map((fi: number) => ({ key: textureKey, frame: fi })),
      frameRate: Math.max(1, fps | 0),
      repeat
    });
    return animKey;
  } catch {
    return null;
  }
}


function logTiles(localDebug: boolean, ...args: any[]) {
    if (!DEBUG_TILES_GLOBAL || !localDebug) return;
    console.log(...args);
}

// ----------------------------------------------------------
// Family mapping from engine grid values
// ----------------------------------------------------------

function defaultTileValueToFamily(v: number): TileFamily | "" {
    // In HeroEngineInPhaser.ts:
    // const TILE_EMPTY = 0
    // const TILE_WALL  = 1

    if (v === 1) {
        // walls → chasm rim family
        return "chasm_light";
    }

    // everything else → light-brown dirt
    return "ground_light";
}

function isChasmLikeFamily(family: TileFamily | ""): boolean {
    const s = String(family ?? "");
    return !!s && (s.includes("chasm") || s.includes("lava"));
}


// ----------------------------------------------------------
// Neighbor mask + AutoShape (Wang 9+4)
// ----------------------------------------------------------

/**
 * Compute an 8-way neighbor bitmask for a tile.
 *
 * Bits:
 *   bit 0 = N
 *   bit 1 = E
 *   bit 2 = S
 *   bit 3 = W
 *   bit 4 = NE
 *   bit 5 = SE
 *   bit 6 = SW
 *   bit 7 = NW
 */
function computeNeighborMask(
    grid: number[][],
    r: number,
    c: number,
    family: TileFamily,
    valueToFamily: (v: number) => TileFamily | ""
): number {
    const rows = grid.length;
    const cols = rows > 0 ? grid[0].length : 0;

    const same = (rr: number, cc: number): boolean => {
        // Clamp to the nearest valid cell (duplicate border values)
        if (rr < 0) rr = 0;
        else if (rr >= rows) rr = rows - 1;

        if (cc < 0) cc = 0;
        else if (cc >= cols) cc = cols - 1;

        return valueToFamily(grid[rr][cc]) === family;
    };


    let mask = 0;

    if (same(r - 1, c))     mask |= 1 << 0; // N
    if (same(r,     c + 1)) mask |= 1 << 1; // E
    if (same(r + 1, c))     mask |= 1 << 2; // S
    if (same(r,     c - 1)) mask |= 1 << 3; // W

    if (same(r - 1, c + 1)) mask |= 1 << 4; // NE
    if (same(r + 1, c + 1)) mask |= 1 << 5; // SE
    if (same(r + 1, c - 1)) mask |= 1 << 6; // SW
    if (same(r - 1, c - 1)) mask |= 1 << 7; // NW

    return mask;
}




export type InnerCornerShape =
    | "none"
    | "innerNE"
    | "innerNW"
    | "innerSE"
    | "innerSW";

/**
 * Decide if this tile should get an inner-corner overlay.
 * This assumes the base tile is already "center" (all N/E/S/W are true).
 *
 * We look at diagonals like:
 *   N && W && !NW => innerNW
 *   N && E && !NE => innerNE
 *   S && W && !SW => innerSW
 *   S && E && !SE => innerSE
 */
export function innerCornerFromMask(mask: number): InnerCornerShape {
    const n  = (mask & (1 << 0)) !== 0;
    const e  = (mask & (1 << 1)) !== 0;
    const s  = (mask & (1 << 2)) !== 0;
    const w  = (mask & (1 << 3)) !== 0;

    const ne = (mask & (1 << 4)) !== 0;
    const se = (mask & (1 << 5)) !== 0;
    const sw = (mask & (1 << 6)) !== 0;
    const nw = (mask & (1 << 7)) !== 0;

    // Only meaningful for "full" cardinals – interior-ish
    if (!(n && e && s && w)) {
        return "none";
    }

    // Check each concave corner: cardinal neighbors present, diagonal missing
    if (n && w && !nw) return "innerNW";
    if (n && e && !ne) return "innerNE";
    if (s && w && !sw) return "innerSW";
    if (s && e && !se) return "innerSE";

    return "none";
}





export function autoShapeFromMask(mask: number): AutoShape {
    const n  = (mask & (1 << 0)) !== 0;
    const e  = (mask & (1 << 1)) !== 0;
    const s  = (mask & (1 << 2)) !== 0;
    const w  = (mask & (1 << 3)) !== 0;

    // Collapse cardinals into a 4-bit mask:
    // bit0 = N, bit1 = E, bit2 = S, bit3 = W
    const m4 =
        (n ? 1 : 0) |
        (e ? 2 : 0) |
        (s ? 4 : 0) |
        (w ? 8 : 0);

    switch (m4) {
        // 0 neighbors: isolated tile
        case 0:
            return "single";

        // Single neighbor – treat as a simple edge facing that neighbor
        case 1: // N only
            return "edgeS";
        case 2: // E only
            return "edgeW";
        case 4: // S only
            return "edgeN";
        case 8: // W only
            return "edgeE";



        // HACK for two adjacent neighbors – convex corners
        // Flip all corners 180°: NE↔SW, NW↔SE
        case 1 | 2:   // N + E
            return "cornerSW";
        case 1 | 8:   // N + W
            return "cornerSE";
        case 2 | 4:   // E + S
            return "cornerNW";
        case 4 | 8:   // S + W
            return "cornerNE";


        // Two adjacent neighbors – convex corners
        case 1 | 2:   // N + E
            return "cornerNE";
        case 1 | 8:   // N + W
            return "cornerNW";
        case 2 | 4:   // E + S
            return "cornerSE";
        case 4 | 8:   // S + W
            return "cornerSW";



        // Two opposite neighbors – straight strips
        case 1 | 4:   // N + S  (vertical)
            // choose a vertical-ish edge – either is fine visually
            return "edgeW";
        case 2 | 8:   // E + W  (horizontal)
            return "edgeN";

        // Three neighbors – classic edges (one side open)
        case 2 | 4 | 8:   // no N
            return "edgeN";
        case 1 | 2 | 8:   // no S
            return "edgeS";
        case 1 | 4 | 8:   // no E
            return "edgeE";
        case 1 | 2 | 4:   // no W
            return "edgeW";

        // All four neighbors – true interior
        case 1 | 2 | 4 | 8:
            return "center";

        // Anything weird we didn't explicitly handle – fall back to center
        default:
            return "center";
    }
}

// ----------------------------------------------------------
// WorldTileRenderer
// ----------------------------------------------------------

export interface WorldTileRendererOptions {
    /** If true, enable detailed tile logging for this renderer instance. */
    debugLocal?: boolean;
    /**
     * Optional mapper from engine tile values → TileFamily.
     * If omitted, a simple default implementation is used.
     */
    tileValueToFamily?: (v: number) => TileFamily | "";
}

export class WorldTileRenderer {
  scene: Phaser.Scene;
  atlas: TileAtlas;
  opts: WorldTileRendererOptions;

  map: Phaser.Tilemaps.Tilemap | null = null;

  groundLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  chasmLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  chasmOverlayLayer: Phaser.Tilemaps.TilemapLayer | null = null;

  decalLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  propLayer: Phaser.Tilemaps.TilemapLayer | null = null;

  // Tileset plumbing (multi-sheet)
  private _tilesetsAll: Phaser.Tilemaps.Tileset[] = [];
  private _firstGidByTextureKey: Record<string, number> = Object.create(null);
  private _gidRanges: Array<{ textureKey: string; firstGid: number; lastExclusive: number }> = [];

  constructor(scene: Phaser.Scene, atlas: TileAtlas, opts: WorldTileRendererOptions) {
    this.scene = scene;
    this.atlas = atlas;
    this.opts = opts;

    // Make it easy for arcadeCompat.ts to find us
    try {
      (this.scene as any).registry?.set?.("__worldTileRenderer", this);
    } catch { /* ignore */ }
  }

  // ---- public helpers used by arcadeCompat ----

  /** Decode a tile index (gid) into {textureKey, frameIndex}. Returns null if unknown/empty. */
  decodeTileIndex(idx: number): { textureKey: string; frameIndex: number } | null {
    const gid = idx | 0;
    if (gid < 0) return null;

    for (let i = 0; i < this._gidRanges.length; i++) {
      const r = this._gidRanges[i];
      if (gid >= r.firstGid && gid < r.lastExclusive) {
        return { textureKey: r.textureKey, frameIndex: (gid - r.firstGid) | 0 };
      }
    }
    return null;
  }

setPropStateAt(anchorR: number, anchorC: number, state: string): boolean {
  const anyThis: any = this as any;
  const instByAnchor: any = anyThis.__propInstancesByAnchor || null;
  if (!instByAnchor) return false;

  const k = String((anchorR | 0)) + "," + String((anchorC | 0));
  const inst: any = instByAnchor[k];
  if (!inst) return false;

  const vis: any = inst.vis || null;
  const animDef: any = vis?.anim || null;
  const st = animDef?.states?.[state] || null;
  if (!st) return false;

  const textureKey = String(inst.textureKey || "");
  const info = this.atlas.getSheetInfo(textureKey);
  const cols = (info?.cols ?? inst.sheetCols ?? 0) | 0;
  if (cols <= 0) return false;

  const baseRef = { row: (st.row | 0), col: (st.col | 0) };
  const wTiles = (inst.wTiles | 0) || 1;
  const hTiles = (inst.hTiles | 0) || 1;

  const byRc: any = inst.byRc || anyThis.__propTileInfoByRC || null;

  // Update all tiles in this prop instance (same placement order as sync)
  let objIdx = 0;
  for (let dy = 0; dy < hTiles; dy++) {
    for (let dx = 0; dx < wTiles; dx++) {
      const worldR = ((inst.anchorR | 0) - (hTiles - 1) + dy) | 0;
      const worldC = ((inst.anchorC | 0) + dx) | 0;

      const atlasCol = (baseRef.col + dx) | 0;
      const atlasRow = (baseRef.row - (hTiles - 1) + dy) | 0;
      const frameIndex = (atlasRow * cols + atlasCol) | 0;

      const obj: any = inst.objs?.[objIdx++] ?? null;
      if (obj) {
        try { obj.anims?.stop?.(); } catch { /* ignore */ }
        try { obj.setFrame?.(frameIndex); } catch { /* ignore */ }
      }

      if (byRc) {
        byRc[String(worldR) + "," + String(worldC)] = { textureKey, frameIndex };
      }
    }
  }

  inst.baseRefRow = baseRef.row | 0;
  inst.baseRefCol = baseRef.col | 0;
  inst.state = state;

  return true;
}


setPropFrameAt(anchorR: number, anchorC: number, frameIndex: number): boolean {
  const anyThis: any = this as any;
  const instByAnchor: any = anyThis.__propInstancesByAnchor || null;
  if (!instByAnchor) return false;

  const k = String((anchorR | 0)) + "," + String((anchorC | 0));
  const inst: any = instByAnchor[k];
  if (!inst) return false;

  const textureKey = String(inst.textureKey || "");
  const info = this.atlas.getSheetInfo(textureKey);
  const cols = (info?.cols ?? inst.sheetCols ?? 0) | 0;
  if (cols <= 0) return false;

  const tr = _tileRefFromFrameIndex(cols, frameIndex | 0);
  const baseRef = { row: tr.row | 0, col: tr.col | 0 };

  const wTiles = (inst.wTiles | 0) || 1;
  const hTiles = (inst.hTiles | 0) || 1;

  const byRc: any = inst.byRc || anyThis.__propTileInfoByRC || null;

  let objIdx = 0;
  for (let dy = 0; dy < hTiles; dy++) {
    for (let dx = 0; dx < wTiles; dx++) {
      const worldR = ((inst.anchorR | 0) - (hTiles - 1) + dy) | 0;
      const worldC = ((inst.anchorC | 0) + dx) | 0;

      const atlasCol = (baseRef.col + dx) | 0;
      const atlasRow = (baseRef.row - (hTiles - 1) + dy) | 0;
      const fi = (atlasRow * cols + atlasCol) | 0;

      const obj: any = inst.objs?.[objIdx++] ?? null;
      if (obj) {
        try { obj.anims?.stop?.(); } catch { /* ignore */ }
        try { obj.setFrame?.(fi); } catch { /* ignore */ }
      }

      if (byRc) {
        byRc[String(worldR) + "," + String(worldC)] = { textureKey, frameIndex: fi };
      }
    }
  }

  inst.baseRefRow = baseRef.row | 0;
  inst.baseRefCol = baseRef.col | 0;

  return true;
}



  /** Used by decor_applyTightOpaqueAabbToSolids to sample correct sheet+frame. */
/** Used by decor_applyTightOpaqueAabbToSolids to sample correct sheet+frame. */
tryGetPropTileInfoAt(r: number, c: number): { textureKey: string; frameIndex: number } | null {
  const anyThis: any = this as any;

  // Preferred: props rendered as images → consult stamped lookup
  const byRc: any = anyThis.__propTileInfoByRC || null;
  if (byRc) {
    const k = String((r | 0)) + "," + String((c | 0));
    const hit = byRc[k];
    if (hit && typeof hit.textureKey === "string" && typeof hit.frameIndex === "number") {
      return { textureKey: hit.textureKey, frameIndex: hit.frameIndex | 0 };
    }
  }

  // Fallback (legacy): if props were ever rendered into a tile layer.
  if (!this.propLayer) return null;
  const tile: any = (this.propLayer as any).getTileAt?.((c | 0), (r | 0), false) ?? null;
  const idx = tile && typeof tile.index === "number" ? (tile.index | 0) : -1;
  if (idx < 0) return null;
  return this.decodeTileIndex(idx);
}

/** Force a full tilemap rebuild even if dimensions are unchanged. */
forceRebuild(rows: number, cols: number): void {
    const r = rows | 0;
    const c = cols | 0;
    const tileSize = (this.atlas.tileSize | 0);
    if (r <= 0 || c <= 0) return;
    this._rebuildTilemap(r, c, tileSize);
}


  // ---- core sync ----

syncFromEngineGrid(grid: number[][]): void {
  const localDebug = this.opts.debugLocal ?? true;
  const valueToFamily = this.opts.tileValueToFamily ?? defaultTileValueToFamily;

  if (!Array.isArray(grid) || grid.length === 0 || !Array.isArray(grid[0])) {
    logTiles(localDebug, "[tileMapGlue] syncFromEngineGrid: empty/malformed grid");
    return;
  }

  const rows = (grid.length | 0);
  const cols = ((grid[0]?.length ?? 0) | 0);
  const tileSize = (this.atlas.tileSize | 0);

  if (rows <= 0 || cols <= 0) return;

  if (!this.map || (this.map.width | 0) !== cols || (this.map.height | 0) !== rows) {
    this._rebuildTilemap(rows, cols, tileSize);
  }

  if (!this.map || !this.groundLayer || !this.chasmLayer || !this.chasmOverlayLayer) return;

  // Clear base layers (decals/props are synced separately)
  this.groundLayer.fill(-1);
  this.chasmLayer.fill(-1);
  this.chasmOverlayLayer.fill(-1);

  // ---- HIGH-LEVEL SNAPSHOT (grid truth + renderer interpretation) ----
  let rawWalls = 0;
  let rawFloors = 0;
  let rawSig = 0;

  let famChasmCells = 0;
  let famNonChasmCells = 0;

  for (let r = 0; r < rows; r++) {
    const row = grid[r];
    if (!row) continue;
    for (let c = 0; c < cols; c++) {
      const v = (row[c] | 0);
      if (v === 1) rawWalls++;
      else rawFloors++;

      rawSig = (((rawSig << 5) - rawSig) + v + ((r + 1) * 131) + ((c + 1) * 17)) | 0;

      const fam = valueToFamily(v);
      if (fam && isChasmLikeFamily(fam as TileFamily)) famChasmCells++;
      else famNonChasmCells++;
    }
  }

  // Pick a fallback "floor" family to use underneath chasm tiles.
  // (First non-chasm family found in the grid; else default to ground_light.)
  let fallbackFloorFamily: TileFamily = "ground_light";
  outer: for (let r = 0; r < rows; r++) {
    const row = grid[r];
    if (!row) continue;
    for (let c = 0; c < cols; c++) {
      const fam = valueToFamily((row[c] | 0));
      if (fam && !isChasmLikeFamily(fam)) {
        fallbackFloorFamily = fam as TileFamily;
        break outer;
      }
    }
  }

  // PASS 1: paint a base floor tile EVERYWHERE (including under chasm tiles)
  for (let r = 0; r < rows; r++) {
    const row = grid[r];
    if (!row) continue;

    for (let c = 0; c < cols; c++) {
      const v = (row[c] | 0);
      const fam0 = valueToFamily(v);

      // If this cell is chasm-like (or empty), still paint a floor underneath it.
      const floorFamily =
        (fam0 && !isChasmLikeFamily(fam0)) ? (fam0 as TileFamily) : fallbackFloorFamily;

      const def =
        this.atlas.getRandomVariant(floorFamily, "center") ||
        this.atlas.getAutoTile(floorFamily, "center");
      if (!def) continue;

      const gid = this._gidFor(def.textureKey, def.frameIndex);
      if (gid >= 0) this.groundLayer.putTileAt(gid, c, r);
    }
  }

  // PASS 2: draw chasm-like families (chasm/lava/etc.) with autotiling into chasm + overlay layers.
  for (let r = 0; r < rows; r++) {
    const row = grid[r];
    if (!row) continue;
    for (let c = 0; c < cols; c++) {
      const v = (row[c] | 0);
      const family = valueToFamily(v);
      if (!family || !isChasmLikeFamily(family)) continue;

      const mask = computeNeighborMask(grid, r, c, family as TileFamily, valueToFamily);
      const shape: AutoShape = autoShapeFromMask(mask);

      let def: { textureKey: string; frameIndex: number } | null = null;

      // Special-case: isolated ('single') tiles use the family's decor slots (TerrainAutoTileDef.decor).
      // This lets us render 1-tile obstacles without requiring a dedicated AutoShape='single' entry.
      if (shape === "single") {
        const deco = this.atlas.getRandomDecorForFamily(family as TileFamily);
        if (deco) def = deco;
      }

      if (!def) {
        def =
          this.atlas.getRandomVariant(family as TileFamily, shape) ||
          this.atlas.getAutoTile(family as TileFamily, shape);
      }

      if (!def) {
        def =
          this.atlas.getRandomVariant(family as TileFamily, "center") ||
          this.atlas.getAutoTile(family as TileFamily, "center");
      }

      if (!def) continue;

      const gid = this._gidFor(def.textureKey, def.frameIndex);
      if (gid >= 0) this.chasmLayer.putTileAt(gid, c, r);

      // Inner-corner overlays (2×2) on top of chasm layer
      const inner = innerCornerFromMask(mask);
      if (inner !== "none") {
        const innerDef =
          this.atlas.getRandomVariant(family as TileFamily, inner as AutoShape) ||
          this.atlas.getAutoTile(family as TileFamily, inner as AutoShape);
        if (innerDef) {
          const innerGid = this._gidFor(innerDef.textureKey, innerDef.frameIndex);
          if (innerGid >= 0) this.chasmOverlayLayer.putTileAt(innerGid, c, r);
        }
      }
    }
  }

  // stash last snapshot for other debug consumers if needed
  try {
    const anyThis: any = this as any;
    anyThis.__lastGridRows = rows | 0;
    anyThis.__lastGridCols = cols | 0;
    anyThis.__lastGridWalls = rawWalls | 0;
    anyThis.__lastGridSig = rawSig | 0;
  } catch { /* ignore */ }

  if (localDebug) {
    logTiles(localDebug, "[tileMapGlue] base render done", {
      rows,
      cols,
      hasDecalLayer: !!this.decalLayer,
      hasPropLayer: !!this.propLayer,
      fallbackFloorFamily,
      rawWalls,
      rawFloors,
      rawSig,
      famChasmCells,
      famNonChasmCells,
      tilesets: this._gidRanges.map(r => `${r.textureKey}@${r.firstGid}-${r.lastExclusive - 1}`).join(", "),
    });
  }
}



  syncDecalGridByName(decalNameGrid: string[][]): void {
    if (!this.map || !this.decalLayer) return;

    const rows = decalNameGrid.length | 0;
    const cols = rows > 0 ? (decalNameGrid[0].length | 0) : 0;

    this.decalLayer.fill(-1);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const name = decalNameGrid[r]?.[c] ?? "";
        if (!name) continue;

        const vis = DECAL_VISUALS_BY_NAME[name];
        if (!vis) continue;

        this._placeVisualTiles(this.decalLayer, r, c, vis);
      }
    }
  }

syncPropGridByName(propNameGrid: string[][]): void {
  if (!this.map) return;

  const anyThis: any = this as any;

  // Destroy previous prop objects (images/sprites)
  const prev: any[] = (anyThis.__propImgs as any[]) || [];
  for (let i = 0; i < prev.length; i++) {
    const obj: any = prev[i];
    try { obj?.destroy?.(); } catch { /* ignore */ }
  }
  anyThis.__propImgs = [];

  // Reset lookup map used by decor_applyTightOpaqueAabbToSolids
  const byRc: Record<string, { textureKey: string; frameIndex: number }> = Object.create(null);
  anyThis.__propTileInfoByRC = byRc;

  // Track prop instances so we can switch states/frames without a full resync.
  const instByAnchor: Record<string, any> = Object.create(null);
  anyThis.__propInstancesByAnchor = instByAnchor;

  // Keep the tile layer empty / hidden (props rendered as y-sorted images/sprites).
  try { this.propLayer?.fill(-1); } catch { /* ignore */ }

  const rows = propNameGrid.length | 0;
  const cols = rows > 0 ? (propNameGrid[0].length | 0) : 0;

  const tileSize = (this.atlas.tileSize | 0);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rawKey = propNameGrid[r]?.[c] ?? "";
      if (!rawKey) continue;

      const parsed = _parsePropKey(rawKey);
      const baseName = parsed.baseName;
      if (!baseName) continue;

      const vis: any = PROP_VISUALS_BY_NAME[baseName];
      if (!vis) continue;

      // Resolve textureKey from atlas/alias
      const atlasOrTk = (vis.textureKey ?? vis.atlas ?? "") as string;
      const textureKey = vis.textureKey
        ? (vis.textureKey as string)
        : this.atlas.resolveAtlasTextureKey(atlasOrTk);

      const info = this.atlas.getSheetInfo(textureKey);
      if (!info) continue;

      // Resolve base ref (bottom-left) possibly overridden by state or explicit frame
      let baseRef = { row: (vis.ref?.row ?? 0) | 0, col: (vis.ref?.col ?? 0) | 0 };

      const animDef: any = vis.anim || null;

      // State override: "chest#open"
      let usedState: string | null = null;
      if (parsed.state && animDef?.states && animDef.states[parsed.state]) {
        const st = animDef.states[parsed.state];
        baseRef = { row: (st?.row ?? baseRef.row) | 0, col: (st?.col ?? baseRef.col) | 0 };
        usedState = parsed.state;
      }

      // Explicit absolute frame override: "thing@123"
      if (parsed.explicitFrameIndex != null) {
        const tr = _tileRefFromFrameIndex(info.cols | 0, parsed.explicitFrameIndex | 0);
        baseRef = { row: tr.row | 0, col: tr.col | 0 };
      }

      const wTiles = Math.max(1, (vis.wTiles ?? 1) | 0);
      const hTiles = Math.max(1, (vis.hTiles ?? 1) | 0);

      // Depth based on anchor (bottom tile) so whole prop sorts as ONE object.
      const anchorYpx = ((r | 0) * tileSize + (tileSize >> 1)) | 0;
      const baseDepth = ((anchorYpx * WORLD_DEPTH_Y_SCALE) + 0) | 0;

      // Auto-animate only when:
      // - no explicit state chosen
      // - no explicit frame chosen
      // - animDef provides a usable frame sequence
      // - prop is 1x1 (for now)
      const canAnimate = (wTiles === 1 && hTiles === 1);
      const animKey =
        (usedState == null && parsed.explicitFrameIndex == null && canAnimate)
          ? _ensurePropAnim(this.scene, textureKey, info.cols | 0, animDef)
          : null;

      const objs: any[] = [];

      // Expand upward and rightward from anchor.
      for (let dy = 0; dy < hTiles; dy++) {
        for (let dx = 0; dx < wTiles; dx++) {
          const worldR = (r - (hTiles - 1) + dy) | 0;
          const worldC = (c + dx) | 0;

          if (worldR < 0 || worldC < 0 || worldR >= this.map.height || worldC >= this.map.width) continue;

          const atlasCol = (baseRef.col + dx) | 0;
          const atlasRow = (baseRef.row - (hTiles - 1) + dy) | 0;
          const frameIndex = (atlasRow * (info.cols | 0) + atlasCol) | 0;

          // Record for collision sampler (initial frame)
          byRc[String(worldR) + "," + String(worldC)] = { textureKey, frameIndex };

          const x = (worldC * tileSize + (tileSize >> 1)) | 0;
          const y = (worldR * tileSize + (tileSize >> 1)) | 0;

          let obj: any;

          // If animKey exists (1x1), use a Sprite so Phaser can play an anim.
          if (animKey && dx === 0 && dy === 0) {
            const spr = this.scene.add.sprite(x, y, textureKey, frameIndex);
            spr.setOrigin(0.5, 0.5);
            spr.setDepth(baseDepth);
            try { spr.anims?.play?.(animKey); } catch { /* ignore */ }
            obj = spr;
          } else {
            const img = this.scene.add.image(x, y, textureKey, frameIndex);
            img.setOrigin(0.5, 0.5);
            img.setDepth(baseDepth);
            obj = img;
          }

          objs.push(obj);
          (anyThis.__propImgs as any[]).push(obj);
        }
      }

      // Store instance for runtime state/frame swapping (by anchor r,c)
      instByAnchor[String(r) + "," + String(c)] = {
        anchorR: r | 0,
        anchorC: c | 0,
        baseName,
        textureKey,
        sheetCols: info.cols | 0,
        wTiles,
        hTiles,
        baseRefRow: baseRef.row | 0,
        baseRefCol: baseRef.col | 0,
        objs,
        vis,
        byRc
      };
    }
  }
}

  // ---- internal helpers ----

private _rebuildTilemap(rows: number, cols: number, tileSize: number): void {
  const anyThis: any = this as any;

  // Destroy old prop images
  const prev: any[] = (anyThis.__propImgs as any[]) || [];
  for (let i = 0; i < prev.length; i++) {
    const obj: any = prev[i];
    try { obj?.destroy?.(); } catch { /* ignore */ }
  }
  anyThis.__propImgs = [];
  anyThis.__propTileInfoByRC = Object.create(null);

  // Destroy old layers/map
  try { this.groundLayer?.destroy(); } catch {}
  try { this.chasmLayer?.destroy(); } catch {}
  try { this.chasmOverlayLayer?.destroy(); } catch {}
  try { this.decalLayer?.destroy(); } catch {}
  try { this.propLayer?.destroy(); } catch {}
  try { this.map?.destroy(); } catch {}

  this.map = this.scene.make.tilemap({
    tileWidth: tileSize,
    tileHeight: tileSize,
    width: cols,
    height: rows,
  });

  // Tileset plumbing (unchanged)
  const keysRaw = this.atlas.allTextureKeys.slice();
  const seen: Record<string, 1> = Object.create(null);

  const ordered: string[] = [];
  const primary = this.atlas.primaryTextureKey;

  if (primary && !seen[primary]) {
    ordered.push(primary);
    seen[primary] = 1;
  }

  keysRaw.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const tk of keysRaw) {
    if (!tk || seen[tk]) continue;
    ordered.push(tk);
    seen[tk] = 1;
  }

  this._tilesetsAll = [];
  this._firstGidByTextureKey = Object.create(null);
  this._gidRanges = [];

  let gidCursor = 0;

  for (const tk of ordered) {
    const info = this.atlas.getSheetInfo(tk);
    if (!info || info.cols <= 0 || info.rows <= 0) continue;

    // ✅ Only tile-sized sheets should become tilemap tilesets.
    // anims.* (16x16, 64x64, 64x96, etc.) must NOT be added via addTilesetImage(tileSize=32).
    if ((info.tileSize | 0) !== (tileSize | 0)) continue;

    const total = (info.cols | 0) * (info.rows | 0);
    if (total <= 0) continue;

    const ts = this.map.addTilesetImage(tk, tk, tileSize, tileSize, 0, 0, gidCursor);
    if (!ts) continue;

    this._tilesetsAll.push(ts);
    this._firstGidByTextureKey[tk] = gidCursor;

    this._gidRanges.push({
      textureKey: tk,
      firstGid: gidCursor,
      lastExclusive: (gidCursor + total) | 0,
    });

    gidCursor = (gidCursor + total) | 0;
  }

  // Layers
  this.groundLayer = this.map.createBlankLayer("ground", this._tilesetsAll, 0, 0);
  this.chasmLayer = this.map.createBlankLayer("chasm", this._tilesetsAll, 0, 0);
  this.chasmOverlayLayer = this.map.createBlankLayer("chasmOverlay", this._tilesetsAll, 0, 0);
  this.decalLayer = this.map.createBlankLayer("decals", this._tilesetsAll, 0, 0);

  // Keep props layer only for compatibility/debug, but hide it.
  this.propLayer = this.map.createBlankLayer("props", this._tilesetsAll, 0, 0);
  try {
    this.propLayer.setVisible(false);
    this.propLayer.setAlpha(0);
    this.propLayer.fill(-1);
  } catch {}

  // ✅ Depth rule:
  // tile layers always behind hero; decals walkable behind hero
  this.groundLayer?.setDepth(TILE_LAYER_DEPTH_GROUND);
  this.chasmLayer?.setDepth(TILE_LAYER_DEPTH_CHASM);
  this.chasmOverlayLayer?.setDepth(TILE_LAYER_DEPTH_CHASM_OVERLAY);
  this.decalLayer?.setDepth(TILE_LAYER_DEPTH_DECALS);
}

  private _gidFor(textureKey: string, frameIndex: number): number {
    const tk = textureKey ?? this.atlas.primaryTextureKey;
    const first = this._firstGidByTextureKey[tk];
    if (typeof first !== "number") return -1;
    return (first + (frameIndex | 0)) | 0;
  }

  private _placeVisualTiles(layer: Phaser.Tilemaps.TilemapLayer, anchorR: number, anchorC: number, vis: any): void {
    const atlasOrTk = (vis.textureKey ?? vis.atlas ?? "") as string;
    const textureKey = vis.textureKey
      ? (vis.textureKey as string)
      : this.atlas.resolveAtlasTextureKey(atlasOrTk);

    const info = this.atlas.getSheetInfo(textureKey);
    if (!info) return;

    const wTiles = Math.max(1, (vis.wTiles ?? 1) | 0);
    const hTiles = Math.max(1, (vis.hTiles ?? 1) | 0);

    // vis.ref is BOTTOM-LEFT in atlas
    const baseCol = (vis.ref?.col ?? 0) | 0;
    const baseRow = (vis.ref?.row ?? 0) | 0;

    // World anchor is BOTTOM-LEFT at (anchorR, anchorC)
    // Expand upward (negative r) and rightward (+c)
    for (let dy = 0; dy < hTiles; dy++) {
      for (let dx = 0; dx < wTiles; dx++) {
        const worldR = (anchorR - (hTiles - 1) + dy) | 0;
        const worldC = (anchorC + dx) | 0;

        if (!this.map) continue;
        if (worldR < 0 || worldC < 0 || worldR >= this.map.height || worldC >= this.map.width) continue;

        const atlasCol = (baseCol + dx) | 0;
        const atlasRow = (baseRow - (hTiles - 1) + dy) | 0;

        const frameIndex = (atlasRow * (info.cols | 0) + atlasCol) | 0;
        const gid = this._gidFor(textureKey, frameIndex);
        if (gid < 0) continue;

        layer.putTileAt(gid, worldC, worldR);
      }
    }
  }
}



export class WorldTileRendererOLDCODETODELETE {
    private scene: Phaser.Scene;
    private atlas: TileAtlas;
    private debugLocal: boolean;
    private tileValueToFamily: (v: number) => TileFamily | "";

    private map?: Phaser.Tilemaps.Tilemap;
    private tileset?: Phaser.Tilemaps.Tileset;

    // NEW: separate layers
    private groundLayer?: Phaser.Tilemaps.TilemapLayer;
    private chasmLayer?: Phaser.Tilemaps.TilemapLayer;

    // NEW:
    private chasmOverlayLayer?: Phaser.Tilemaps.TilemapLayer;

    // NEW: decor layers (visual-only)
    private decalLayer?: Phaser.Tilemaps.TilemapLayer;
    private propLayer?: Phaser.Tilemaps.TilemapLayer;


constructor(scene: Phaser.Scene, atlas: TileAtlas, opts: WorldTileRendererOptions = {}) {
    this.scene = scene;
    this.atlas = atlas;
    this.debugLocal = opts.debugLocal ?? true;
    this.tileValueToFamily = opts.tileValueToFamily ?? defaultTileValueToFamily;

    logTiles(this.debugLocal, "[tileMapGlue] created WorldTileRenderer");

    // IMPORTANT: arcadeCompat decor sync expects to find this in the Phaser scene registry.
    try {
        (this.scene as any).__worldTileRenderer = this;
        (this.scene as any)?.registry?.set?.("__worldTileRenderer", this);
    } catch {
        // fail soft; decor sync will no-op
    }
}





    /**
     * Rebuild the Phaser tilemap from a simple engine grid of numbers.
     */
    syncFromEngineGrid(grid: number[][]): void {
        const rows = grid.length;
        const cols = rows > 0 ? grid[0].length : 0;

        if (rows === 0 || cols === 0) {
            logTiles(this.debugLocal, "[tileMapGlue.sync] empty grid – nothing to render");
            return;
        }

        const tileSize = this.atlas.tileSize;

        // --------------------------------------------------------------
        // Create tilemap + tileset + layers ONE TIME
        // --------------------------------------------------------------
        if (!this.map) {
            this.map = this.scene.make.tilemap({
                width: cols,
                height: rows,
                tileWidth: tileSize,
                tileHeight: tileSize
            });

            this.tileset = this.map.addTilesetImage(
                this.atlas.primaryTextureKey,
                this.atlas.primaryTextureKey,
                tileSize,
                tileSize,
                0,
                0
            );

            if (!this.tileset) {
                throw new Error("[tileMapGlue.sync] failed to create Tileset – check primaryTextureKey");
            }

            // Base layers: Ground (bottom), chasm (middle), inner-corner overlay (top)
            this.groundLayer       = this.map.createBlankLayer("ground",       this.tileset, 0, 0) || undefined;
            this.chasmLayer        = this.map.createBlankLayer("chasm",        this.tileset, 0, 0) || undefined;
            this.chasmOverlayLayer = this.map.createBlankLayer("chasmOverlay", this.tileset, 0, 0) || undefined;

            // Decor layers (visual-only). These MUST NOT break base rendering if absent.
            this.decalLayer        = this.map.createBlankLayer("decal",        this.tileset, 0, 0) || undefined;
            this.propLayer         = this.map.createBlankLayer("props",        this.tileset, 0, 0) || undefined;

            if (!this.groundLayer || !this.chasmLayer || !this.chasmOverlayLayer) {
                throw new Error("[tileMapGlue.sync] missing one of ground/chasm/chasmOverlay layers");
            }

            // Depths: keep tile layers behind sprites (sprites typically at depth 0+)
            this.groundLayer.setDepth(-1000);
            this.chasmLayer.setDepth(-900);
            this.chasmOverlayLayer.setDepth(-800);

            // Decals/props render above base tiles but still behind characters by default.
            if (this.decalLayer) this.decalLayer.setDepth(-700);
            if (this.propLayer)  this.propLayer.setDepth(-600);

            logTiles(
                this.debugLocal,
                "[tileMapGlue.sync] created new Phaser.Tilemap with base + decor layers",
                { rows, cols, tileSize, hasDecalLayer: !!this.decalLayer, hasPropLayer: !!this.propLayer }
            );

            dbg_dumpTileLayers(scene, "after tileMapGlue.sync");

        }

        if (!this.map || !this.tileset || !this.groundLayer || !this.chasmLayer || !this.chasmOverlayLayer) {
            throw new Error("[tileMapGlue.sync] map/tileset/base layers missing");
        }

        // If the world grid dimensions ever change at runtime, we currently do not rebuild the tilemap.
        // Keep this safe: just log and return. (This preserves the "does not break game" invariant.)
        const mapW = (this.map.width | 0);
        const mapH = (this.map.height | 0);
        if (mapW !== (cols | 0) || mapH !== (rows | 0)) {
            logTiles(
                this.debugLocal,
                "[tileMapGlue.sync] WARNING: grid dims differ from existing tilemap dims; skipping rebuild",
                { gridRows: rows, gridCols: cols, mapH, mapW }
            );
            return;
        }

        // Clear layers
        this.groundLayer.fill(-1);
        this.chasmLayer.fill(-1);
        this.chasmOverlayLayer.fill(-1);
        if (this.decalLayer) this.decalLayer.fill(-1);
        if (this.propLayer)  this.propLayer.fill(-1);

        // --------------------------------------------------------------
        // PASS 1: Fill with ground_light using center (and its variants)
        // --------------------------------------------------------------
        const familyCounts = new Map<TileFamily, number>();

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                // Always place ground_light as the base
                const baseFamily: TileFamily = "ground_light";

                let baseDef = this.atlas.getRandomVariant(baseFamily, "center")
                    ?? this.atlas.getAutoTile(baseFamily, "center");

                const baseFrame = baseDef ? baseDef.frameIndex : 0;
                this.groundLayer.putTileAt(baseFrame, c, r);

                const current = familyCounts.get(baseFamily) || 0;
                familyCounts.set(baseFamily, current + 1);
            }
        }

        // --------------------------------------------------------------
        // PASS 2: Apply chasm/wall autotiles on top of ground
        // --------------------------------------------------------------
        for (let r = 0; r < rows; r++) {
            const row = grid[r];
            for (let c = 0; c < cols; c++) {
                const v = row[c];

                if (v !== 1) {
                    // Not a wall/chasm cell – leave ground only
                    continue;
                }

                const family: TileFamily = "chasm_light";

                // Compute neighbor mask for this family at [r,c]
                const mask = computeNeighborMask(
                    grid,
                    r,
                    c,
                    family,
                    this.tileValueToFamily
                );

                // Base LPC 3x3 shape (center/edge/corner/single)
                const shape: AutoShape = autoShapeFromMask(mask);

                let def;

                // For now: any isolated chasm tile ("single") uses a decorative chasm
                if (family === "chasm_light" && shape === "single") {
                    def = this.atlas.getRandomVariant(family, "decor" as any)
                        ?? this.atlas.getAutoTile(family, "decor" as any);
                } else {
                    def = this.atlas.getRandomVariant(family, shape)
                        ?? this.atlas.getAutoTile(family, shape);
                }

                // Fallback: center chasm if we somehow still don't have a tile
                if (!def) {
                    def = this.atlas.getRandomVariant(family, "center")
                        ?? this.atlas.getAutoTile(family, "center");
                }

                const frameIndex = def ? def.frameIndex : 0;
                this.chasmLayer.putTileAt(frameIndex, c, r);

                const current = familyCounts.get(family) || 0;
                familyCounts.set(family, current + 1);
            }
        }

        // --------------------------------------------------------------
        // PASS 3: Chasm inner-corner overlays (2×2) on top
        // --------------------------------------------------------------
        for (let r = 0; r < rows; r++) {
            const row = grid[r];
            for (let c = 0; c < cols; c++) {
                const v = row[c];
                if (v !== 1) continue; // only chasm cells

                const family: TileFamily = "chasm_light";

                const mask = computeNeighborMask(
                    grid,
                    r,
                    c,
                    family,
                    this.tileValueToFamily
                );

                const innerShape = innerCornerFromMask(mask);
                if (innerShape === "none") continue;

                let innerDef =
                    this.atlas.getRandomVariant(family, innerShape as AutoShape) ||
                    this.atlas.getAutoTile(family, innerShape as AutoShape);

                if (!innerDef) continue;

                const innerFrame = innerDef.frameIndex;
                this.chasmOverlayLayer.putTileAt(innerFrame, c, r);

                const current = familyCounts.get(family) || 0;
                familyCounts.set(family, current + 1);
            }
        }

        const countsSummary: Record<string, number> = {};
        for (const [fam, count] of familyCounts.entries()) {
            countsSummary[fam] = count;
        }

        logTiles(
            this.debugLocal,
            "[tileMapGlue.sync] finished building tile layer – tile counts by family:",
            countsSummary
        );

        // [tileMapGlue.WorldTileRenderer.syncFromEngineGrid] logging included
    }


    
        /**
     * Apply a visual-only decal overlay grid.
     *
     * This does NOT affect collisions. It writes into the optional "decal" layer.
     *
     * The input is a grid of semantic decal keys (e.g. "sand_patch").
     * Empty: "" or null/undefined.
     */
public syncDecalGridByName(decalGrid: (string | null | undefined)[][]): void {
    const scene = this.scene;
    if (!scene) return;

    const selfAny: any = this as any;

    // Destroy previous decal images
    const prev: Phaser.GameObjects.Image[] = selfAny.__decorDecalImgs || [];
    for (let i = 0; i < prev.length; i++) {
        try { prev[i]?.destroy(); } catch {}
    }
    selfAny.__decorDecalImgs = [];

    if (!decalGrid || decalGrid.length === 0 || !decalGrid[0] || decalGrid[0].length === 0) {
        return;
    }

    const rows = decalGrid.length | 0;
    const cols = (decalGrid[0]?.length | 0) || 0;
    if (rows <= 0 || cols <= 0) return;

    const tileSize = (this.map?.tileWidth | 0) || (this.opts?.tileSize | 0) || 32;

    // Cache: textureKey -> sheetCols (computed from texture width / tileSize)
    const sheetColsCache: Map<string, number> =
        selfAny.__decorSheetColsCache || (selfAny.__decorSheetColsCache = new Map<string, number>());

    const getSheetCols = (texKey: string): number => {
        const got = sheetColsCache.get(texKey);
        if (got && got > 0) return got;

        try {
            const tex = scene.textures.get(texKey);
            const src: any = tex?.getSourceImage?.();
            const w = (src && (src.width || src.naturalWidth)) ? (src.width || src.naturalWidth) : 0;
            const computed = w > 0 ? Math.max(1, Math.floor(w / tileSize)) : 1;
            sheetColsCache.set(texKey, computed);
            return computed;
        } catch {
            return 1;
        }
    };

    const baseDepth = ((this.baseLayer as any)?.depth ?? 0) | 0;
    const depth = baseDepth + 10;

    // Stamp each decal as one-or-more tile images
    for (let r = 0; r < rows; r++) {
        const row = decalGrid[r];
        if (!row) continue;

        for (let c = 0; c < cols; c++) {
            const name = row[c];
            if (!name) continue;

            const v = (DECAL_VISUALS_BY_NAME as any)[name];
            if (!v) continue;

            const texKey = decorAtlasTextureKey(v.atlas);
            const sheetCols = getSheetCols(texKey);

            const w = (v.size?.[0] | 0) || 1;
            const h = (v.size?.[1] | 0) || 1;
            const origin = v.origin || "topLeft";

            // anchor cell (r,c) -> top-left stamp cell
            let startC = c;
            let startR = r;

            if (origin === "bottom") {
                startC = (c - Math.floor((w - 1) / 2)) | 0;
                startR = (r - (h - 1)) | 0;
            }

            const baseFrame = ((v.ref.row | 0) * sheetCols + (v.ref.col | 0)) | 0;

            for (let dy = 0; dy < h; dy++) {
                const rr = (startR + dy) | 0;
                if (rr < 0 || rr >= rows) continue;

                for (let dx = 0; dx < w; dx++) {
                    const cc = (startC + dx) | 0;
                    if (cc < 0 || cc >= cols) continue;

                    const frame = (baseFrame + dx + dy * sheetCols) | 0;

                    const x = (cc * tileSize + tileSize * 0.5);
                    const y = (rr * tileSize + tileSize * 0.5);

                    const img = scene.add.image(x, y, texKey, frame);
                    img.setDepth(depth);
                    img.setOrigin(0.5, 0.5);

                    selfAny.__decorDecalImgs.push(img);
                }
            }
        }
    }
}


public syncPropGridByName(propNameGrid: string[][]): void {
  if (!this.map) return;

  const anyThis: any = this as any;

  function _parsePropKey(s: string): { baseName: string; state: string | null; explicitFrameIndex: number | null } {
    const raw = (s ?? "").trim();
    if (!raw) return { baseName: "", state: null, explicitFrameIndex: null };

    // Allow patterns like:
    //   "chest"
    //   "chest#open"
    //   "thing@12"
    //   "chest#open@12"
    let base = raw;
    let state: string | null = null;
    let frame: number | null = null;

    const hash = raw.indexOf("#");
    const at = raw.indexOf("@");

    const cut = (hash >= 0 && at >= 0) ? Math.min(hash, at) : (hash >= 0 ? hash : (at >= 0 ? at : -1));
    if (cut >= 0) base = raw.slice(0, cut);

    if (hash >= 0) {
      const end = (at >= 0 && at > hash) ? at : raw.length;
      state = raw.slice(hash + 1, end).trim() || null;
    }
    if (at >= 0) {
      const n = parseInt(raw.slice(at + 1).trim(), 10);
      if (!isNaN(n)) frame = (n | 0);
    }

    return { baseName: base.trim(), state, explicitFrameIndex: frame };
  }

  function _tileRefFromFrameIndex(cols: number, frameIndex: number): { row: number; col: number } {
    const c = Math.max(1, cols | 0);
    const fi = Math.max(0, frameIndex | 0);
    const row = Math.floor(fi / c) | 0;
    const col = (fi - row * c) | 0;
    return { row, col };
  }

  function _ensurePropAnim(scene: Phaser.Scene, textureKey: string, animDef: any): string | null {
    if (!animDef) return null;

    const keyPart = String(animDef.key ?? "anim");
    const animKey = `${textureKey}::${keyPart}`;

    try {
      if (scene.anims.exists(animKey)) return animKey;
    } catch { /* ignore */ }

    let frames: number[] = [];
    if (Array.isArray(animDef.frames) && animDef.frames.length) {
      frames = animDef.frames.map((n: any) => (n | 0));
    } else if (animDef.startFrame != null && animDef.endFrame != null) {
      const a = (animDef.startFrame | 0);
      const b = (animDef.endFrame | 0);
      const lo = Math.min(a, b) | 0;
      const hi = Math.max(a, b) | 0;
      for (let i = lo; i <= hi; i++) frames.push(i | 0);
    } else {
      return null;
    }

    const frameRate = (animDef.frameRate ?? animDef.fps ?? 6) | 0;
    const repeat = (animDef.repeat ?? -1) | 0;

    try {
      scene.anims.create({
        key: animKey,
        frames: frames.map((f) => ({ key: textureKey, frame: f })),
        frameRate: Math.max(1, frameRate),
        repeat
      });
      return animKey;
    } catch {
      return null;
    }
  }

  // Destroy previous prop objects
  const prev: any[] = (anyThis.__propImgs as any[]) || [];
  for (let i = 0; i < prev.length; i++) {
    const obj: any = prev[i];
    try { obj?.destroy?.(); } catch { /* ignore */ }
  }
  anyThis.__propImgs = [];

  // Reset lookup map used by decor_applyTightOpaqueAabbToSolids
  const byRc: Record<string, { textureKey: string; frameIndex: number }> = Object.create(null);
  anyThis.__propTileInfoByRC = byRc;

  // Track instances
  const instByAnchor: Record<string, any> = Object.create(null);
  anyThis.__propInstancesByAnchor = instByAnchor;

  // Keep the tile layer empty / hidden
  try { this.propLayer?.fill(-1); } catch { /* ignore */ }

  const rows = propNameGrid.length | 0;
  const cols = rows > 0 ? (propNameGrid[0].length | 0) : 0;
  const tileSize = (this.atlas.tileSize | 0);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rawKey = propNameGrid[r]?.[c] ?? "";
      if (!rawKey) continue;

      const parsed = _parsePropKey(rawKey);
      const baseName = parsed.baseName;
      if (!baseName) continue;

      const vis: any = (PROP_VISUALS_BY_NAME as any)[baseName];
      if (!vis) continue;

      // Resolve textureKey from atlas/alias
      const atlasOrTk = (vis.textureKey ?? vis.atlas ?? "") as string;
      const textureKey = vis.textureKey
        ? (vis.textureKey as string)
        : decorAtlasTextureKey(atlasOrTk);

      // Determine sheet cols if known
      let sheetCols = 1;
      try {
        const info = this.atlas.getSheetInfo(textureKey);
        if (info && (info.cols | 0) > 0) sheetCols = info.cols | 0;
        else {
          const tex: any = this.scene.textures.get(textureKey);
          const w = (tex?.source?.[0]?.width ?? tex?.getSourceImage?.()?.width ?? 0) | 0;
          sheetCols = Math.max(1, Math.floor(w / tileSize) | 0);
        }
      } catch {
        sheetCols = 1;
      }

      // Resolve base ref (bottom-left) possibly overridden
      let baseRef = { row: (vis.ref?.row ?? 0) | 0, col: (vis.ref?.col ?? 0) | 0 };

      const animDef: any = vis.anim || null;

      // State override: "chest#open" => anim.states.open -> tileRef
      let usedState: string | null = null;
      if (parsed.state && animDef?.states && animDef.states[parsed.state]) {
        const st = animDef.states[parsed.state];
        baseRef = { row: (st?.row ?? baseRef.row) | 0, col: (st?.col ?? baseRef.col) | 0 };
        usedState = parsed.state;
      }

      // Explicit absolute frame override: "thing@123"
      if (parsed.explicitFrameIndex != null) {
        const tr = _tileRefFromFrameIndex(sheetCols | 0, parsed.explicitFrameIndex | 0);
        baseRef = { row: tr.row | 0, col: tr.col | 0 };
      }

      const wTiles = Math.max(1, (vis.wTiles ?? 1) | 0);
      const hTiles = Math.max(1, (vis.hTiles ?? 1) | 0);

      // y-sorted depth based on anchor (bottom tile)
      const anchorYpx = ((r | 0) * tileSize + (tileSize >> 1)) | 0;
      const baseDepth = ((anchorYpx * WORLD_DEPTH_Y_SCALE) + 0) | 0;

      // Auto-animate only when:
      // - no explicit state
      // - no explicit frame
      // - animDef has a usable frame sequence
      // - prop is 1x1 (for now)
      const canAnimate = (wTiles === 1 && hTiles === 1);
      const animKey =
        (usedState == null && parsed.explicitFrameIndex == null && canAnimate)
          ? _ensurePropAnim(this.scene, textureKey, animDef)
          : null;

      const objs: any[] = [];

      // Expand upward/rightward from anchor
      for (let dy = 0; dy < hTiles; dy++) {
        for (let dx = 0; dx < wTiles; dx++) {
          const worldR = (r - (hTiles - 1) + dy) | 0;
          const worldC = (c + dx) | 0;

          if (worldR < 0 || worldC < 0 || worldR >= this.map.height || worldC >= this.map.width) continue;

          const atlasCol = (baseRef.col + dx) | 0;
          const atlasRow = (baseRef.row - (hTiles - 1) + dy) | 0;
          const frameIndex = (atlasRow * (sheetCols | 0) + atlasCol) | 0;

          // Record for collision sampler (initial frame)
          byRc[String(worldR) + "," + String(worldC)] = { textureKey, frameIndex };

          const x = (worldC * tileSize + (tileSize >> 1)) | 0;
          const y = (worldR * tileSize + (tileSize >> 1)) | 0;

          let obj: any;

          if (animKey && dx === 0 && dy === 0) {
            const spr = this.scene.add.sprite(x, y, textureKey, frameIndex);
            spr.setOrigin(0.5, 0.5);
            spr.setDepth(baseDepth);
            try { spr.anims?.play?.(animKey); } catch { /* ignore */ }
            obj = spr;

            // Special-case: flash when we see the flash state
            if (baseName === "teleport_rune_flash") {
              try { (this.scene.cameras?.main as any)?.flash?.(140); } catch { /* ignore */ }
            }
          } else {
            const img = this.scene.add.image(x, y, textureKey, frameIndex);
            img.setOrigin(0.5, 0.5);
            img.setDepth(baseDepth);
            obj = img;
          }

          objs.push(obj);
          (anyThis.__propImgs as any[]).push(obj);
        }
      }

      instByAnchor[String(r) + "," + String(c)] = {
        anchorR: r | 0,
        anchorC: c | 0,
        baseName,
        textureKey,
        sheetCols: sheetCols | 0,
        wTiles,
        hTiles,
        baseRefRow: baseRef.row | 0,
        baseRefCol: baseRef.col | 0,
        objs,
        vis,
        byRc
      };
    }
  }
}





}

export function dbg_dumpTileLayers(scene: any, tag: string): void {
  try {
    const kids: any[] = scene?.children?.list ?? [];
    const layers = kids.filter(o => o && o.tilemap && o.layer && typeof o.getTileAt === "function");

    console.log(`[DBG][TILES] ${tag} layers=${layers.length}`);
    for (const l of layers) {
      const map = l.tilemap;
      const name = l.name ?? l.layer?.name ?? "(unnamed)";
      const depth = (l as any).depth ?? "(na)";
      const vis = !!l.visible;
      const alpha = l.alpha;
      const tilesets = (map?.tilesets ?? []).map((ts: any) => `${ts?.name ?? "?"}:${ts?.image?.key ?? ts?.imageKey ?? "?"}`).join(", ");

      let nonEmpty = 0;
      let sample: string[] = [];
      const W = map?.width ?? 0;
      const H = map?.height ?? 0;

      // map is small (13x25), so a full scan is cheap and definitive
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const t = l.getTileAt(x, y, true);
          if (t && typeof t.index === "number" && t.index >= 0) {
            nonEmpty++;
            if (sample.length < 8) sample.push(`${x},${y}:idx=${t.index}`);
          }
        }
      }

      console.log(`[DBG][TILES] layer=${name} depth=${depth} vis=${vis} alpha=${alpha} tilesets=[${tilesets}] size=${W}x${H} nonEmpty=${nonEmpty} sample=[${sample.join(" | ")}]`);
    }
  } catch (e) {
    console.log(`[DBG][TILES] ${tag} ERROR`, e);
  }
}