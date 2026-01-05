// tileAtlas.ts
import type Phaser from "phaser";

// ---------------------------------------------------------------------------
// Tile / terrain data
// ---------------------------------------------------------------------------

export type TerrainKind = "ground" | "chasm" | "water" | "hedge";

export interface TileRef {
    row: number; // LPC tile row (0-based, 32x32 tiles)
    col: number; // LPC tile col
}



// ---------------------------------------------------------------------------
// Decor registry (semantic name → visual tile refs)
//
// IMPORTANT:
// - Engine/gameplay code should NOT know atlas row/col.
// - Engine should only publish semantic IDs/names (e.g. "sand_patch").
// - Phaser-side rendering resolves those semantic values into atlas coordinates
//   via this registry.
// - TileRef.row/col are 0-based tile indices.
//
// Current terrain sheet assumption: 21 columns × 23 rows (0-based max: row=22, col=20)
// This matches the existing autotile defs already in this file (many use col: 20).
// ---------------------------------------------------------------------------

export type DecorAtlasKey =
    | "terrain"
    | "decor"
    | "props"
    | "coins"
    // Allow project-specific aliases without needing to edit this union every time.
    | (string & {});

export interface DecorVisualRef {
    /** Semantic atlas alias (preferred). Resolved to a Phaser textureKey via TileAtlas.resolveAtlasTextureKey(). */
    atlas: DecorAtlasKey;

    /** Optional direct Phaser textureKey override (escape hatch / debugging). */
    textureKey?: string;

    /** Bottom-left tile of the visual within the referenced sheet (0-based tile coords). */
    ref: TileRef;

    /** Footprint width in tiles (default 1). */
    wTiles?: number;

    /** Footprint height in tiles (default 1). */
    hTiles?: number;

    /** Reserved for future: animated props/decals. (Not used yet.) */
    anim?: {
        key: string;
        startFrame: number;
        endFrame: number;
        frameRate?: number;
        repeat?: number;
    };
}

export type PropVisualRef = DecorVisualRef;

// These are the terrain sheet tile-grid dimensions (NOT 1-based indices).
// If/when tile sheets vary by size, this will need to become sheet-specific.
export const TERRAIN_SHEET_TILE_COLS = 21;
export const TERRAIN_SHEET_TILE_ROWS = 23;

export function terrainFrameIndexFromRef(ref: TileRef, cols: number = TERRAIN_SHEET_TILE_COLS): number {
    return (ref.row | 0) * (cols | 0) + (ref.col | 0);
}

// v1 proof assets (semantic keys):
// - sand_patch → terrain tile at row 13, col 0
// - rock_mountain → terrain tile at row 22, col 20

export const DECAL_VISUALS_BY_NAME: Record<string, DecorVisualRef> = {
    sand_patch: { atlas: "terrain", ref: { row: 13, col: 0 } },

    // Teleporter pad: terrain_atlas rows 21/22, cols 0..4 (frame = col)
    telepad0_top: { atlas: "terrain", ref: { row: 21, col: 0 } },
    telepad0_bot: { atlas: "terrain", ref: { row: 22, col: 0 } },

    telepad1_top: { atlas: "terrain", ref: { row: 21, col: 1 } },
    telepad1_bot: { atlas: "terrain", ref: { row: 22, col: 1 } },

    telepad2_top: { atlas: "terrain", ref: { row: 21, col: 2 } },
    telepad2_bot: { atlas: "terrain", ref: { row: 22, col: 2 } },

    telepad3_top: { atlas: "terrain", ref: { row: 21, col: 3 } },
    telepad3_bot: { atlas: "terrain", ref: { row: 22, col: 3 } },

    telepad4_top: { atlas: "terrain", ref: { row: 21, col: 4 } },
    telepad4_bot: { atlas: "terrain", ref: { row: 22, col: 4 } },

    // Stairs statue: terrain_atlas col 19, rows 15/16/17 (1x3)
    stairs_statue_top: { atlas: "terrain_atlas", ref: { row: 15, col: 19 } },
    stairs_statue_mid: { atlas: "terrain_atlas", ref: { row: 16, col: 19 } },
    stairs_statue_bot: { atlas: "terrain_atlas", ref: { row: 17, col: 19 } },
}


export const PROP_VISUALS_BY_NAME: Record<string, DecorVisualRef> = {
    rock_mountain: { atlas: "terrain", ref: { row: 22, col: 20 } },
};



// Minimal v1 prop registry (name → atlas row/col)
// NOTE: row/col are 0-based.
// Your rock is “row 22, col 20” in human terms → (21, 19) 0-based.
export const PROP_CATALOG: { name: string; atlasRow: number; atlasCol: number }[] = [
    { name: "rock_mountain", atlasRow: 21, atlasCol: 19 },
];


export function getPropTileRefByName(name: string): { row: number; col: number } | null {
    // Assumes you have PROP_CATALOG in this file (as you planned).
    // Example row/col field names: atlasRow/atlasCol.
    for (let i = 0; i < PROP_CATALOG.length; i++) {
        const p = PROP_CATALOG[i];
        if (p && p.name === name) {
            return { row: (p.atlasRow | 0), col: (p.atlasCol | 0) };
        }
    }
    return null;
}





// Legacy types (kept so other code doesn't break, but we drive off TerrainAutoTileDef)
export interface TerrainTiles {
    decor?: TileRef[];
    concave2x2?: { topLeft: TileRef };
    convex9?: TileRef[];
    groundVariants?: TileRef[];
    interior?: TileRef[];
    edgeExtensions?: {
        left?: TileRef;
        right?: TileRef;
    };
}

export interface TerrainFamily {
    id: string;
    kind: TerrainKind;
    cols: [number, number];
    rows: [number, number];
    tiles: TerrainTiles;
}

// ---------------------------------------------------------------------------
// Wang-style autotile defs (9 + 4 shapes per family)
// ---------------------------------------------------------------------------

export interface TerrainAutoTileDef {
    id: string;
    kind: TerrainKind;

    atlasBounds?: {
        cols: [number, number];
        rows: [number, number];
    };

    // 3+ interior variants
    interior: TileRef[];

    // Convex rim 3×3 block
    edgeN: TileRef;
    edgeS: TileRef;
    edgeE: TileRef;
    edgeW: TileRef;

    cornerNW: TileRef;
    cornerNE: TileRef;
    cornerSE: TileRef;
    cornerSW: TileRef;

    // Concave 2×2 block
    innerNW: TileRef;
    innerNE: TileRef;
    innerSE: TileRef;
    innerSW: TileRef;

    // Optional decorative tiles
    decor?: TileRef[];

    // Optional block origins (useful for tooling / debug)
    convex9BlockOrigin?: { topLeft: TileRef };
    concave2x2BlockOrigin?: { topLeft: TileRef };

    edgeExtensions?: {
        left?: TileRef;
        right?: TileRef;
    };
}

export type TileFamily = TerrainAutoTileDef["id"];

export type AutoShape =
    | "center"
    | "edgeN" | "edgeE" | "edgeS" | "edgeW"
    | "cornerNE" | "cornerNW" | "cornerSE" | "cornerSW"
    | "innerNW" | "innerNE" | "innerSE" | "innerSW"
    | "single";

// Back-compat type alias for older imports (typo-casing).
export type Autoshape = AutoShape;


export interface AutoTileDef {
    family: TileFamily;
    shape: AutoShape;
    textureKey: string;
    frameIndex: number;
}

export interface SingleTileDef {
    family: TileFamily;
    textureKey: string;
    frameIndex: number;
}

export interface TileSheetInfo {
    textureKey: string;
    cols: number;
    rows: number;
    tileSize: number;
}

export interface TileAtlas {
    // Legacy: historically used by older tile renderers.
    textureKey: string;

    /** Size of each tile in pixels (expected 32). */
    tileSize: number;

    /** Primary texture key backing the main autotile spritesheet. */
    primaryTextureKey: string;

    /** All loaded tilesheet texture keys (deterministic order). */
    allTextureKeys: string[];

    /** Lookup sheet grid info for a given textureKey. */
    getSheetInfo(textureKey: string): TileSheetInfo | null;

    /** Resolve an atlas alias (e.g. "props") to a Phaser textureKey (e.g. "tiles.props"). */
    resolveAtlasTextureKey(aliasOrTextureKey: string): string;

    /** Return the first tile matching family+shape. */
    getAutoTile(family: TileFamily, shape: AutoShape): AutoTileDef | undefined;

    /** Return a random variant for family+shape if we have several to choose from. */
    getRandomVariant(family: TileFamily, shape: AutoShape): AutoTileDef | undefined;

    /** Return a random decoration tile for the given family, if any. */
    getRandomDecorForFamily(family: TileFamily): SingleTileDef | undefined;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const TILE_SIZE = 32;
const DEBUG_TILES_GLOBAL = true;



// ---------------------------------------------------------------------------
// Deterministic atlas alias resolution (NO per-client overrides).
// ---------------------------------------------------------------------------

type DefaultAtlasTextureKeys = {
    baseTextureKey: string;
    decorTextureKey: string;
    propTextureKey: string;
    coinsTextureKey: string;
    aliasToTextureKey: Record<string, string>;
};

let __cachedAtlasKeys: DefaultAtlasTextureKeys | null = null;
const __warnedUnknownAtlasAliases: Record<string, 1> = Object.create(null);

function _computeDefaultAtlasTextureKeys(): DefaultAtlasTextureKeys {
    if (__cachedAtlasKeys) return __cachedAtlasKeys;

    const has = (tk: string): boolean => TILE_SHEETS.some(sh => sh.textureKey === tk);

    // Base terrain (autotiles) should be terrain.png when present.
    const baseTextureKey =
        (has("tiles.terrain") ? "tiles.terrain" : "") ||
        (TILE_SHEETS.map(s => s.textureKey).filter(Boolean).sort().find(k => k.includes("terrain") && !k.includes("atlas")) ?? "") ||
        (TILE_SHEETS.map(s => s.textureKey).filter(Boolean).sort()[0] ?? "tiles.terrain");

    // Decor sheet should be terrain_atlas when present; else fall back to base.
    const decorTextureKey = has("tiles.terrain_atlas") ? "tiles.terrain_atlas" : baseTextureKey;

    // Props sheet should be tiles.props when present; else fall back to decor.
    const propTextureKey = has("tiles.props") ? "tiles.props" : decorTextureKey;

    // Coins sheet optional; if absent, fall back to props.
    const coinsTextureKey = has("tiles.coins") ? "tiles.coins" : propTextureKey;

    // Alias map:
    // IMPORTANT:
    // - "terrain" MUST mean the base autotile sheet (terrain.png when present).
    // - "terrain_atlas" is the explicit decor sheet (terrain_atlas.png when present).
    const aliasToTextureKey: Record<string, string> = Object.create(null);

    // Explicit semantic aliases
    aliasToTextureKey["terrain"] = baseTextureKey;
    aliasToTextureKey["terrain_atlas"] = decorTextureKey;

    aliasToTextureKey["decor"] = decorTextureKey;

    aliasToTextureKey["props"] = propTextureKey;
    aliasToTextureKey["prop"] = propTextureKey;

    aliasToTextureKey["coins"] = coinsTextureKey;
    aliasToTextureKey["coin"] = coinsTextureKey;

    // Optional alias that explicitly means the base autotile sheet.
    aliasToTextureKey["base"] = baseTextureKey;
    aliasToTextureKey["autotile"] = baseTextureKey;

    __cachedAtlasKeys = { baseTextureKey, decorTextureKey, propTextureKey, coinsTextureKey, aliasToTextureKey };
    return __cachedAtlasKeys;
}

function _resolveAtlasTextureKeyDeterministic(aliasOrTextureKey: string, warnUnknown: boolean): string {
    const s = (aliasOrTextureKey ?? "").trim();

    if (!s) {
        const k = _computeDefaultAtlasTextureKeys();
        return k.decorTextureKey;
    }

    // Direct textureKey passthrough
    if (s.startsWith("tiles.")) return s;

    const k = _computeDefaultAtlasTextureKeys();

    // 1) Known semantic alias (terrain / terrain_atlas / decor / props / coins / base / ...)
    const hit = k.aliasToTextureKey[s];
    if (hit) return hit;

    // 2) If caller passed a bare sheet name like "terrain_atlas", "props", etc,
    //    resolve it as tiles.${name} when that sheet exists.
    const direct = `tiles.${s}`;
    if (TILE_SHEETS.some(sh => sh.textureKey === direct)) return direct;

    if (warnUnknown && !__warnedUnknownAtlasAliases[s]) {
        __warnedUnknownAtlasAliases[s] = 1;
        console.warn("[tileAtlas] unknown atlas alias:", s, "→ falling back to", k.decorTextureKey);
    }

    return k.decorTextureKey;
}

/**
 * Back-compat helper used by older decor code paths.
 * Prefer TileAtlas.resolveAtlasTextureKey() in the A2 renderer.
 */
export function decorAtlasTextureKey(aliasOrTextureKey: string): string {
    return _resolveAtlasTextureKeyDeterministic(aliasOrTextureKey, /*warnUnknown*/ false);
}

function logTiles(...args: any[]) {
    if (!DEBUG_TILES_GLOBAL) return;
    console.log(...args);
}

// Grab all tilesets under ../assets/tiles/*.png as Vite URLs.
const tilePngs = import.meta.glob(
    "../assets/tiles/*.png",
    { as: "url", eager: true }
) as Record<string, string>;

interface TileSheetDef {
    textureKey: string;
    url: string;
    cols: number;
    rows: number;
}

/**
 * NOTE: for now we assume all tilesheets in ../assets/tiles are the same size
 * as terrain.png: 672x736 → 21x23 tiles of 32x32. If you add other
 * sheets with different dimensions later, this will need to grow up a bit.
 */
const TILE_SHEETS: TileSheetDef[] = [];

for (const [path, url] of Object.entries(tilePngs)) {
    const fileNameWithExt = path.split(/[\\/]/).pop() || "terrain";
    const baseName = fileNameWithExt.replace(/\.png$/i, "");
    const textureKey = `tiles.${baseName}`;
    if (baseName === "terrain") {
        TILE_SHEETS.push({
            textureKey,
            url,
            cols: 21,
            rows: 23
        });
    }
    if (baseName === "terrain_atlas") {
    TILE_SHEETS.push({
        textureKey,
        url,
        cols: 32,
        rows: 32
    });
    }
    //Need more definitions here
}

export function preloadTileSheets(scene: Phaser.Scene): void {
    if (TILE_SHEETS.length === 0) {
        logTiles("[tileAtlas.preload] no tilesheets found under ../assets/tiles/*.png");
        return;
    }


    const DEBUG_TILES = true

    if (DEBUG_TILES) {
    logTiles(
        "[tileAtlas.preload] tilesheets to load:",
        TILE_SHEETS.map(s =>
            `${s.textureKey} (${s.cols}x${s.rows} tiles, url="${s.url}")`
        )
    );
}
    for (const sheet of TILE_SHEETS) {
        scene.load.spritesheet(sheet.textureKey, sheet.url, {
            frameWidth: TILE_SIZE,
            frameHeight: TILE_SIZE
        });
    }
    // [tileAtlas.preload] logging included
}





// ---------------------------------------------------------------------------
// Build TileAtlas from TERRAIN_AUTOTILES
// ---------------------------------------------------------------------------

export function buildTileAtlas(scene: Phaser.Scene): TileAtlas {
    if (TILE_SHEETS.length === 0) {
        throw new Error("[tileAtlas.build] no TILE_SHEETS defined – did preloadTileSheets run?");
    }

    // -----------------------------------------------------------------------
    // Deterministic sheet selection (NO per-client overrides).
    // Base terrain autotiles come from baseTextureKey.
    // Decals/props are resolved via alias map (terrain/decor/props/coins/base...).
    // -----------------------------------------------------------------------
    const keys = _computeDefaultAtlasTextureKeys();
    const baseTextureKey = keys.baseTextureKey;

    // Deterministic list of texture keys.
    const allTextureKeys: string[] = Array.from(new Set(TILE_SHEETS.map(s => s.textureKey)))
        .filter(Boolean)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    // -----------------------------------------------------------------------
    // Compute cols/rows for ALL loaded sheets from the actual loaded texture.
    // This is required because sheets may have different dimensions.
    // -----------------------------------------------------------------------
    const sheetInfoByKey = new Map<string, TileSheetInfo>();

    const computeSheetInfo = (texKey: string, fallbackCols: number, fallbackRows: number): TileSheetInfo | null => {
        try {
            const texObj: any = (scene as any)?.textures?.get?.(texKey);
            const img: any =
                texObj?.getSourceImage?.() ??
                texObj?.source?.[0]?.image ??
                null;

            const w = (img?.width ?? img?.naturalWidth ?? 0) | 0;
            const h = (img?.height ?? img?.naturalHeight ?? 0) | 0;

            const cols = w > 0 ? Math.floor(w / TILE_SIZE) : (fallbackCols | 0);
            const rows = h > 0 ? Math.floor(h / TILE_SIZE) : (fallbackRows | 0);

            if ((cols | 0) > 0 && (rows | 0) > 0) {
                return { textureKey: texKey, cols: cols | 0, rows: rows | 0, tileSize: TILE_SIZE };
            }
        } catch {
            // ignore; fall through
        }
        if ((fallbackCols | 0) > 0 && (fallbackRows | 0) > 0) {
            return { textureKey: texKey, cols: fallbackCols | 0, rows: fallbackRows | 0, tileSize: TILE_SIZE };
        }
        return null;
    };

    for (const sh of TILE_SHEETS) {
        const info = computeSheetInfo(sh.textureKey, sh.cols | 0, sh.rows | 0);
        if (info) sheetInfoByKey.set(sh.textureKey, info);
    }

    // Base sheet dims (fatal if missing — autotiles cannot index safely).
    const baseDef = TILE_SHEETS.find(s => s.textureKey === baseTextureKey) ?? TILE_SHEETS[0];
    if (!baseDef) throw new Error("[tileAtlas.build] no tilesheets available");
    const baseInfo = sheetInfoByKey.get(baseDef.textureKey) ?? computeSheetInfo(baseDef.textureKey, baseDef.cols | 0, baseDef.rows | 0);
    if (!baseInfo) {
        throw new Error(`[tileAtlas.build] unable to resolve sheet dimensions for base sheet: ${baseDef.textureKey}`);
    }
    sheetInfoByKey.set(baseDef.textureKey, baseInfo);

    const resolvedCols = baseInfo.cols | 0;

    logTiles(
        "[tileAtlas.build] base autotile sheet:",
        `${baseDef.textureKey} (${baseInfo.cols}x${baseInfo.rows} tiles)`
    );

    if (DEBUG_TILES_GLOBAL) {
        logTiles("[tileAtlas.build] atlas alias map:", {
            base: keys.baseTextureKey,
            decor: keys.decorTextureKey,
            props: keys.propTextureKey,
            coins: keys.coinsTextureKey,
        });
    }

    const idx = (col: number, row: number): number => {
        return ((row | 0) * (resolvedCols | 0) + (col | 0)) | 0;
    };

    const autoByKey = new Map<string, AutoTileDef[]>();
    const decorByFamily = new Map<TileFamily, SingleTileDef[]>();

    function addAuto(def: AutoTileDef) {
        const key = `${def.family}|${def.shape}`;
        let arr = autoByKey.get(key);
        if (!arr) {
            arr = [];
            autoByKey.set(key, arr);
        }
        arr.push(def);
    }

    function addDecor(def: SingleTileDef) {
        let arr = decorByFamily.get(def.family);
        if (!arr) {
            arr = [];
            decorByFamily.set(def.family, arr);
        }
        arr.push(def);
    }

    const tex = baseDef.textureKey;

    function frameFromRef(ref: TileRef): number {
        return idx(ref.col, ref.row);
    }

    function registerTerrainFamily(tf: TerrainAutoTileDef) {
        const family = tf.id as TileFamily;

        // 1) Center variants from the interior array.
        for (const ref of tf.interior ?? []) {
            addAuto({
                family,
                shape: "center",
                textureKey: tex,
                frameIndex: frameFromRef(ref)
            });
        }

        // 2) Explicit rim & corners for the convex 3×3 block.
        addAuto({ family, shape: "edgeN", textureKey: tex, frameIndex: frameFromRef(tf.edgeN) });
        addAuto({ family, shape: "edgeS", textureKey: tex, frameIndex: frameFromRef(tf.edgeS) });
        addAuto({ family, shape: "edgeW", textureKey: tex, frameIndex: frameFromRef(tf.edgeW) });
        addAuto({ family, shape: "edgeE", textureKey: tex, frameIndex: frameFromRef(tf.edgeE) });

        addAuto({ family, shape: "cornerNW", textureKey: tex, frameIndex: frameFromRef(tf.cornerNW) });
        addAuto({ family, shape: "cornerNE", textureKey: tex, frameIndex: frameFromRef(tf.cornerNE) });
        addAuto({ family, shape: "cornerSE", textureKey: tex, frameIndex: frameFromRef(tf.cornerSE) });
        addAuto({ family, shape: "cornerSW", textureKey: tex, frameIndex: frameFromRef(tf.cornerSW) });

        // 3) Concave 2×2 tiles.
        addAuto({ family, shape: "innerNW", textureKey: tex, frameIndex: frameFromRef(tf.innerNW) });
        addAuto({ family, shape: "innerNE", textureKey: tex, frameIndex: frameFromRef(tf.innerNE) });
        addAuto({ family, shape: "innerSE", textureKey: tex, frameIndex: frameFromRef(tf.innerSE) });
        addAuto({ family, shape: "innerSW", textureKey: tex, frameIndex: frameFromRef(tf.innerSW) });

        // 4) Optional decor tiles (these live on the BASE sheet).
        if (tf.decor && tf.decor.length) {
            for (const ref of tf.decor) {
                addDecor({
                    family,
                    textureKey: tex,
                    frameIndex: frameFromRef(ref)
                });
            }
        }
    }

    for (const tf of TERRAIN_AUTOTILES) {
        registerTerrainFamily(tf);
    }

    // Logging summary.
    const autoSummary: Record<string, number> = {};
    for (const [key, arr] of autoByKey.entries()) {
        autoSummary[key] = arr.length;
    }
    const decorSummary: Record<string, number> = {};
    for (const [family, arr] of decorByFamily.entries()) {
        decorSummary[family] = arr.length;
    }

    logTiles("[tileAtlas.build] auto tiles (family|shape → count):", autoSummary);
    logTiles("[tileAtlas.build] decor tiles (family → count):", decorSummary);

    const atlas: TileAtlas = {
        textureKey: baseDef.textureKey,
        tileSize: TILE_SIZE,
        primaryTextureKey: baseDef.textureKey,

        allTextureKeys,

        getSheetInfo(textureKey: string): TileSheetInfo | null {
            const tk = (textureKey ?? "").trim();
            if (!tk) return null;
            return sheetInfoByKey.get(tk) ?? null;
        },

        resolveAtlasTextureKey(aliasOrTextureKey: string): string {
            const s = (aliasOrTextureKey ?? "").trim();
            if (!s) return keys.decorTextureKey;

            // Direct textureKey passthrough
            if (s.startsWith("tiles.")) return s;

            // 1) Known semantic alias
            const hit = keys.aliasToTextureKey[s];
            if (hit) return hit;

            // 2) Bare sheet name → tiles.${name} if it exists
            const direct = `tiles.${s}`;
            if (sheetInfoByKey.has(direct) || TILE_SHEETS.some(sh => sh.textureKey === direct)) return direct;

            if (!__warnedUnknownAtlasAliases[s]) {
                __warnedUnknownAtlasAliases[s] = 1;
                console.warn("[tileAtlas] unknown atlas alias:", s, "→ falling back to", keys.decorTextureKey);
            }
            return keys.decorTextureKey;
        },

        getAutoTile(family: TileFamily, shape: AutoShape): AutoTileDef | undefined {
            const key = `${family}|${shape}`;
            const arr = autoByKey.get(key);
            return arr && arr.length > 0 ? arr[0] : undefined;
        },
        getRandomVariant(family: TileFamily, shape: AutoShape): AutoTileDef | undefined {
            const key = `${family}|${shape}`;
            const arr = autoByKey.get(key);
            if (!arr || arr.length === 0) return undefined;
            if (arr.length === 1) return arr[0];
            const i = Math.floor(Math.random() * arr.length);
            return arr[i];
        },
        getRandomDecorForFamily(family: TileFamily): SingleTileDef | undefined {
            const arr = decorByFamily.get(family);
            if (!arr || arr.length === 0) return undefined;
            const i = Math.floor(Math.random() * arr.length);
            return arr[i];
        }
    };

    // Expose via the Phaser registry for convenience.
    scene.registry.set("tileAtlas", atlas);

    return atlas;
}


export interface TerrainAutoTileDef {
    id: string;
    kind: TerrainKind;

    atlasBounds?: {
        cols: [number, number];
        rows: [number, number];
    };

    interior: TileRef[];

    edgeN: TileRef;
    edgeS: TileRef;
    edgeE: TileRef;
    edgeW: TileRef;

    cornerNW: TileRef;
    cornerNE: TileRef;
    cornerSE: TileRef;
    cornerSW: TileRef;

    innerNW: TileRef;
    innerNE: TileRef;
    innerSE: TileRef;
    innerSW: TileRef;

    decor?: TileRef[];

    convex9BlockOrigin?: { topLeft: TileRef };
    concave2x2BlockOrigin?: { topLeft: TileRef };

    edgeExtensions?: {
        left?: TileRef;
        right?: TileRef;
    };
}




const ground_light: TerrainAutoTileDef = {
    id: "ground_light",
    kind: "ground",

    atlasBounds: { cols: [0, 2], rows: [0, 5] },

    // Full opaque ground tiles (interior)
    interior: [
        { row: 5, col: 0 },
        { row: 5, col: 1 },
        { row: 5, col: 2 },
    ],

    // Convex 3×3 block at rows 2–4, cols 0–2
    edgeN: { row: 2, col: 1 },
    edgeS: { row: 4, col: 1 },
    edgeW: { row: 3, col: 0 },
    edgeE: { row: 3, col: 2 },

    cornerNW: { row: 2, col: 0 },
    cornerNE: { row: 2, col: 2 },
    cornerSE: { row: 4, col: 2 },
    cornerSW: { row: 4, col: 0 },

    // Concave 2×2 block top-left at (0,1)
    innerNW: { row: 0, col: 1 },
    innerNE: { row: 0, col: 2 },
    innerSE: { row: 1, col: 2 },
    innerSW: { row: 1, col: 1 },

    decor: [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
    ],

    convex9BlockOrigin: { topLeft: { row: 2, col: 0 } },
    concave2x2BlockOrigin: { topLeft: { row: 0, col: 1 } },
};


const chasm_light: TerrainAutoTileDef = {
    id: "chasm_light",
    kind: "chasm",

    atlasBounds: { cols: [9, 11], rows: [0, 5] },

    interior: [
        { row: 5, col: 9 },
        { row: 5, col: 10 },
        { row: 5, col: 11 },
    ],

    // Convex chasm rim 3×3 at rows 2–4, cols 9–11
    edgeN: { row: 2, col: 10 },
    edgeS: { row: 4, col: 10 },
    edgeW: { row: 3, col: 9 },
    edgeE: { row: 3, col: 11 },

    cornerNW: { row: 2, col: 9 },
    cornerNE: { row: 2, col: 11 },
    cornerSE: { row: 4, col: 11 },
    cornerSW: { row: 4, col: 9 },

    // Concave 2×2 “invert” block at rows 0–1, cols 10–11
    innerNW: { row: 0, col: 10 },
    innerNE: { row: 0, col: 11 },
    innerSE: { row: 1, col: 11 },
    innerSW: { row: 1, col: 10 },

    decor: [
        { row: 0, col: 9 },
        { row: 1, col: 9 },
    ],

    convex9BlockOrigin: { topLeft: { row: 2, col: 9 } },
    concave2x2BlockOrigin: { topLeft: { row: 0, col: 10 } },
};




const ground_medium: TerrainAutoTileDef = {
    id: "ground_medium",
    kind: "ground",

    atlasBounds: { cols: [3, 5], rows: [0, 5] },

    interior: [
        { row: 5, col: 3 },
        { row: 5, col: 4 },
        { row: 5, col: 5 },
    ],

    edgeN: { row: 2, col: 4 },
    edgeS: { row: 4, col: 4 },
    edgeW: { row: 3, col: 3 },
    edgeE: { row: 3, col: 5 },

    cornerNW: { row: 2, col: 3 },
    cornerNE: { row: 2, col: 5 },
    cornerSE: { row: 4, col: 5 },
    cornerSW: { row: 4, col: 3 },

    innerNW: { row: 0, col: 4 },
    innerNE: { row: 0, col: 5 },
    innerSE: { row: 1, col: 5 },
    innerSW: { row: 1, col: 4 },

    decor: [
        { row: 0, col: 3 },
        { row: 1, col: 3 },
    ],

    convex9BlockOrigin: { topLeft: { row: 2, col: 3 } },
    concave2x2BlockOrigin: { topLeft: { row: 0, col: 4 } },
};

const ground_red: TerrainAutoTileDef = {
    id: "ground_red",
    kind: "ground",

    atlasBounds: { cols: [6, 8], rows: [0, 5] },

    interior: [
        { row: 5, col: 6 },
        { row: 5, col: 7 },
        { row: 5, col: 8 },
    ],

    edgeN: { row: 2, col: 7 },
    edgeS: { row: 4, col: 7 },
    edgeW: { row: 3, col: 6 },
    edgeE: { row: 3, col: 8 },

    cornerNW: { row: 2, col: 6 },
    cornerNE: { row: 2, col: 8 },
    cornerSE: { row: 4, col: 8 },
    cornerSW: { row: 4, col: 6 },

    innerNW: { row: 0, col: 7 },
    innerNE: { row: 0, col: 8 },
    innerSE: { row: 1, col: 8 },
    innerSW: { row: 1, col: 7 },

    decor: [
        { row: 0, col: 6 },
        { row: 1, col: 6 },
    ],

    convex9BlockOrigin: { topLeft: { row: 2, col: 6 } },
    concave2x2BlockOrigin: { topLeft: { row: 0, col: 7 } },
};


const chasm_medium: TerrainAutoTileDef = {
    id: "chasm_medium",
    kind: "chasm",

    atlasBounds: { cols: [12, 14], rows: [0, 5] },

    interior: [
        { row: 5, col: 12 },
        { row: 5, col: 13 },
        { row: 5, col: 14 },
    ],

    edgeN: { row: 2, col: 13 },
    edgeS: { row: 4, col: 13 },
    edgeW: { row: 3, col: 12 },
    edgeE: { row: 3, col: 14 },

    cornerNW: { row: 2, col: 12 },
    cornerNE: { row: 2, col: 14 },
    cornerSE: { row: 4, col: 14 },
    cornerSW: { row: 4, col: 12 },

    innerNW: { row: 0, col: 13 },
    innerNE: { row: 0, col: 14 },
    innerSE: { row: 1, col: 14 },
    innerSW: { row: 1, col: 13 },

    // I am *not* inventing extra decor here because you didn’t explicitly
    // confirm big/small holes for medium/black, just “next three families”
    // being pits. Safer to leave decor empty than guess.
    decor: [],

    convex9BlockOrigin: { topLeft: { row: 2, col: 12 } },
    concave2x2BlockOrigin: { topLeft: { row: 0, col: 13 } },
};

const chasm_black: TerrainAutoTileDef = {
    id: "chasm_black",
    kind: "chasm",

    atlasBounds: { cols: [15, 17], rows: [0, 5] },

    interior: [
        { row: 5, col: 15 },
        { row: 5, col: 16 },
        { row: 5, col: 17 },
    ],

    edgeN: { row: 2, col: 16 },
    edgeS: { row: 4, col: 16 },
    edgeW: { row: 3, col: 15 },
    edgeE: { row: 3, col: 17 },

    cornerNW: { row: 2, col: 15 },
    cornerNE: { row: 2, col: 17 },
    cornerSE: { row: 4, col: 17 },
    cornerSW: { row: 4, col: 15 },

    innerNW: { row: 0, col: 16 },
    innerNE: { row: 0, col: 17 },
    innerSE: { row: 1, col: 17 },
    innerSW: { row: 1, col: 16 },

    decor: [],

    convex9BlockOrigin: { topLeft: { row: 2, col: 15 } },
    concave2x2BlockOrigin: { topLeft: { row: 0, col: 16 } },
};

const water_chasm: TerrainAutoTileDef = {
    id: "water_chasm",
    kind: "water",   // semantically “water in a chasm”

    atlasBounds: { cols: [18, 20], rows: [0, 5] },

    // Water interior – row 5, cols 18–20 (you called out water variants there)
    interior: [
        { row: 5, col: 18 },
        { row: 5, col: 19 },
        { row: 5, col: 20 },
    ],

    // Convex water edge 3×3 at rows 2–4, cols 18–20
    edgeN: { row: 2, col: 19 },
    edgeS: { row: 4, col: 19 },
    edgeW: { row: 3, col: 18 },
    edgeE: { row: 3, col: 20 },

    cornerNW: { row: 2, col: 18 },
    cornerNE: { row: 2, col: 20 },
    cornerSE: { row: 4, col: 20 },
    cornerSW: { row: 4, col: 18 },

    // Concave 2×2 shoreline block at rows 0–1, cols 19–20
    innerNW: { row: 0, col: 19 },
    innerNE: { row: 0, col: 20 },
    innerSE: { row: 1, col: 20 },
    innerSW: { row: 1, col: 19 },

    // I know there’s also the island feature, but instead of guessing its
    // precise coordinates, I’m leaving decor empty here so we can wire
    // that in explicitly when you want.
    decor: [],

    convex9BlockOrigin: { topLeft: { row: 2, col: 18 } },
    concave2x2BlockOrigin: { topLeft: { row: 0, col: 19 } },
};


const grass_dense_light: TerrainAutoTileDef = {
    id: "grass_dense_light",
    kind: "ground",

    atlasBounds: { cols: [0, 2], rows: [6, 11] },

    // Full opaque grass tiles (interior)
    interior: [
        { row: 11, col: 0 },
        { row: 11, col: 1 },
        { row: 11, col: 2 },
    ],

    // Convex 3×3 block (rows 8–10, cols 0–2)
    edgeN: { row: 8, col: 1 },
    edgeS: { row: 10, col: 1 },
    edgeW: { row: 9, col: 0 },
    edgeE: { row: 9, col: 2 },

    cornerNW: { row: 8, col: 0 },
    cornerNE: { row: 8, col: 2 },
    cornerSE: { row: 10, col: 2 },
    cornerSW: { row: 10, col: 0 },

    // Concave 2×2 block top-left at (6,1)
    innerNW: { row: 6, col: 1 },
    innerNE: { row: 6, col: 2 },
    innerSE: { row: 7, col: 2 },
    innerSW: { row: 7, col: 1 },

    // Decorative transparent patches
    decor: [
        { row: 6, col: 0 },
        { row: 7, col: 0 },
    ],

    convex9BlockOrigin:   { topLeft: { row: 8, col: 0 } },
    concave2x2BlockOrigin:{ topLeft: { row: 6, col: 1 } },
};

const grass_sparse_light: TerrainAutoTileDef = {
    id: "grass_sparse_light",
    kind: "ground",

    atlasBounds: { cols: [3, 5], rows: [6, 11] },

    interior: [
        { row: 11, col: 3 },
        { row: 11, col: 4 },
        { row: 11, col: 5 },
    ],

    edgeN: { row: 8, col: 4 },
    edgeS: { row: 10, col: 4 },
    edgeW: { row: 9, col: 3 },
    edgeE: { row: 9, col: 5 },

    cornerNW: { row: 8, col: 3 },
    cornerNE: { row: 8, col: 5 },
    cornerSE: { row: 10, col: 5 },
    cornerSW: { row: 10, col: 3 },

    innerNW: { row: 6, col: 4 },
    innerNE: { row: 6, col: 5 },
    innerSE: { row: 7, col: 5 },
    innerSW: { row: 7, col: 4 },

    decor: [],

    convex9BlockOrigin:   { topLeft: { row: 8, col: 3 } },
    concave2x2BlockOrigin:{ topLeft: { row: 6, col: 4 } },
};

const grass_dark: TerrainAutoTileDef = {
    id: "grass_dark",
    kind: "ground",

    atlasBounds: { cols: [6, 8], rows: [6, 11] },

    interior: [
        { row: 11, col: 6 },
        { row: 11, col: 7 },
        { row: 11, col: 8 },
    ],

    edgeN: { row: 8, col: 7 },
    edgeS: { row: 10, col: 7 },
    edgeW: { row: 9, col: 6 },
    edgeE: { row: 9, col: 8 },

    cornerNW: { row: 8, col: 6 },
    cornerNE: { row: 8, col: 8 },
    cornerSE: { row: 10, col: 8 },
    cornerSW: { row: 10, col: 6 },

    innerNW: { row: 6, col: 7 },
    innerNE: { row: 6, col: 8 },
    innerSE: { row: 7, col: 8 },
    innerSW: { row: 7, col: 7 },

    decor: [
        { row: 6, col: 6 },
        { row: 7, col: 6 },
    ],

    convex9BlockOrigin:   { topLeft: { row: 8, col: 6 } },
    concave2x2BlockOrigin:{ topLeft: { row: 6, col: 7 } },
};

const hedge_green_low: TerrainAutoTileDef = {
    id: "hedge_green_low",
    kind: "hedge",

    atlasBounds: { cols: [9, 11], rows: [6, 11] },

    // Use center of 3×3 hedge as interior fill
    interior: [
        { row: 10, col: 10 },
    ],

    edgeN: { row: 8, col: 10 },
    edgeS: { row: 10, col: 10 },
    edgeW: { row: 9, col: 9 },
    edgeE: { row: 9, col: 11 },

    cornerNW: { row: 8, col: 9 },
    cornerNE: { row: 8, col: 11 },
    cornerSE: { row: 10, col: 11 },
    cornerSW: { row: 10, col: 9 },

    // Concave 2×2 at (6,10)
    innerNW: { row: 6, col: 10 },
    innerNE: { row: 6, col: 11 },
    innerSE: { row: 7, col: 11 },
    innerSW: { row: 7, col: 10 },

    decor: [
        // 1×2 bush (we list as two tiles)
        { row: 6, col: 9 },
        { row: 7, col: 9 },

        // Single-tile hedge with transparent background
        { row: 11, col: 11 },
    ],

    convex9BlockOrigin:   { topLeft: { row: 8, col: 9 } },
    concave2x2BlockOrigin:{ topLeft: { row: 6, col: 10 } },
};

const hedge_green_high: TerrainAutoTileDef = {
    id: "hedge_green_high",
    kind: "hedge",

    atlasBounds: { cols: [12, 14], rows: [6, 11] },

    // Interior = center of 3×3 block + its duplicate at (11,12)
    interior: [
        { row: 10, col: 13 },
        { row: 11, col: 12 }, // explicit “repeat of the center”
    ],

    edgeN: { row: 8, col: 13 },
    edgeS: { row: 10, col: 13 },
    edgeW: { row: 9, col: 12 },
    edgeE: { row: 9, col: 14 },

    cornerNW: { row: 8, col: 12 },
    cornerNE: { row: 8, col: 14 },
    cornerSE: { row: 10, col: 14 },
    cornerSW: { row: 10, col: 12 },

    innerNW: { row: 6, col: 13 },
    innerNE: { row: 6, col: 14 },
    innerSE: { row: 7, col: 14 },
    innerSW: { row: 7, col: 13 },

    decor: [],  // 11,13–14 are intentionally left for grass, not hedge

    convex9BlockOrigin:   { topLeft: { row: 8, col: 12 } },
    concave2x2BlockOrigin:{ topLeft: { row: 6, col: 13 } },
};

const hedge_straw: TerrainAutoTileDef = {
    id: "hedge_straw",
    kind: "hedge",

    atlasBounds: { cols: [15, 17], rows: [6, 11] },

    // Interior from center of 3×3 hedge block
    interior: [
        { row: 10, col: 16 },
    ],

    edgeN: { row: 8, col: 16 },
    edgeS: { row: 10, col: 16 },
    edgeW: { row: 9, col: 15 },
    edgeE: { row: 9, col: 17 },

    cornerNW: { row: 8, col: 15 },
    cornerNE: { row: 8, col: 17 },
    cornerSE: { row: 10, col: 17 },
    cornerSW: { row: 10, col: 15 },

    innerNW: { row: 6, col: 16 },
    innerNE: { row: 6, col: 17 },
    innerSE: { row: 7, col: 17 },
    innerSW: { row: 7, col: 16 },

    decor: [], // 11,15–17 left unassigned on purpose for now

    convex9BlockOrigin:   { topLeft: { row: 8, col: 15 } },
    concave2x2BlockOrigin:{ topLeft: { row: 6, col: 16 } },
};

const dirt_patch_lightgrass: TerrainAutoTileDef = {
    id: "dirt_patch_lightgrass",
    kind: "ground",

    atlasBounds: { cols: [18, 20], rows: [6, 11] },

    // The 3×3 dirt interior block
    interior: [
        { row: 8, col: 18 }, { row: 9, col: 18 }, { row: 10, col: 18 },
        { row: 8, col: 19 }, { row: 9, col: 19 }, { row: 10, col: 19 },
        { row: 8, col: 20 }, { row: 9, col: 20 }, { row: 10, col: 20 },
    ],

    edgeN: { row: 8, col: 19 },
    edgeS: { row: 10, col: 19 },
    edgeW: { row: 9, col: 18 },
    edgeE: { row: 9, col: 20 },

    cornerNW: { row: 8, col: 18 },
    cornerNE: { row: 8, col: 20 },
    cornerSE: { row: 10, col: 20 },
    cornerSW: { row: 10, col: 18 },

    // Concave 2×2 block at (6,19)
    innerNW: { row: 6, col: 19 },
    innerNE: { row: 6, col: 20 },
    innerSE: { row: 7, col: 20 },
    innerSW: { row: 7, col: 19 },

    decor: [
        { row: 6, col: 18 },
        { row: 7, col: 18 },
    ],

    convex9BlockOrigin:   { topLeft: { row: 8, col: 18 } },
    concave2x2BlockOrigin:{ topLeft: { row: 6, col: 19 } },

    edgeExtensions: {
        left:  { row: 11, col: 19 },
        right: { row: 11, col: 20 },
    },
};




// ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
//
//
//This ends the tilemap family declarations
//
//
// ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~





export const TERRAIN_AUTOTILES: TerrainAutoTileDef[] = [
    ground_light,
    ground_medium,
    ground_red,
    chasm_light,
    chasm_medium,
    chasm_black,
    water_chasm,
    grass_dense_light,
    grass_sparse_light,
    grass_dark,
    hedge_green_low,
    hedge_green_high,
    hedge_straw,
    dirt_patch_lightgrass,
];













