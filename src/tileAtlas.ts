// tileAtlas.ts
import type Phaser from "phaser";


// ---------------------------------------------------------------------------
// TILE & TERRAIN DATA LAYER  (this is where your LPC classification lives)
// ---------------------------------------------------------------------------

export type TerrainKind = "ground" | "chasm" | "water" | "hedge";

export interface TileRef {
    row: number;  // LPC tile row (0-based, 32x32 tiles)
    col: number;  // LPC tile col
}

export interface TerrainTiles {
    // Transparent overlays that sit on top of a base ground tile.
    decor?: TileRef[];

    // 2×2 inward-facing macro (concave block). Top-left tile of that 2x2.
    concave2x2?: { topLeft: TileRef };

    // 3×3 outward-facing rim cluster (convex block). Exactly 9 tiles.
    convex9?: TileRef[];

    // Opaque floor variants for “normal” ground-style families.
    groundVariants?: TileRef[];

    // Opaque lower-elevation / liquid floor (for chasm / water).
    interior?: TileRef[];

    // Special weird case for the dirt-in-grass family.
    edgeExtensions?: {
        left?: TileRef;
        right?: TileRef;
    };
}

export interface TerrainFamily {
    id: string;         // "ground_light", "chasm_void", "water_chasm", ...
    kind: TerrainKind;

    // Bounding rectangle of this family on the atlas, in tile coords.
    cols: [number, number];  // inclusive [colStart, colEnd]
    rows: [number, number];  // inclusive [rowStart, rowEnd]

    tiles: TerrainTiles;
}




// High-level autotile behavior for one terrain family.
export interface AutoTileConfig {
    id: string;       // "ground_light"
    familyId: string; // links to TerrainFamily.id

    // Interior fill (one or more variants).
    interior: TileRef[];

    // Outward edges from the convex9 cluster.
    edgeN: TileRef;
    edgeS: TileRef;
    edgeE: TileRef;
    edgeW: TileRef;

    // Outward corners from convex9.
    cornerNW: TileRef;
    cornerNE: TileRef;
    cornerSE: TileRef;
    cornerSW: TileRef;

    // Inward corners from concave2x2.
    innerNW: TileRef;
    innerNE: TileRef;
    innerSE: TileRef;
    innerSW: TileRef;
}




// Derive TileFamily from those ids so it's always in sync.
export type TerrainFamilyDef = (typeof TERRAIN_FAMILIES)[number];
export type TileFamily = TerrainFamilyDef["id"];




export type AutoShape =
    | "center"
    | "edgeN" | "edgeE" | "edgeS" | "edgeW"
    | "cornerNE" | "cornerNW" | "cornerSE" | "cornerSW";

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

export interface TileAtlas {
    /** Size of each tile in pixels (expected 32). */
    tileSize: number;
    /** Primary texture key backing the main tileset spritesheet. */
    primaryTextureKey: string;
    /** Return the first tile matching family+shape. */
    getAutoTile(family: TileFamily, shape: AutoShape): AutoTileDef | undefined;
    /** Return a random variant for family+shape if we have several to choose from. */
    getRandomVariant(family: TileFamily, shape: AutoShape): AutoTileDef | undefined;
    /** Return a random decoration tile for the given family, if any. */
    getRandomDecorForFamily(family: TileFamily): SingleTileDef | undefined;
}

const TILE_SIZE = 32;
const DEBUG_TILES_GLOBAL = true;

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
 * as the provided terrain.png: 672x736 → 21x23 tiles of 32x32. If you add other
 * sheets with different dimensions later, this will need to grow up a bit.
 */
const TILE_SHEETS: TileSheetDef[] = [];

for (const [path, url] of Object.entries(tilePngs)) {
    const fileNameWithExt = path.split(/[\\/]/).pop() || "terrain";
    const baseName = fileNameWithExt.replace(/\.png$/i, "");
    const textureKey = `tiles.${baseName}`;
    TILE_SHEETS.push({
        textureKey,
        url,
        cols: 21,
        rows: 23
    });
}

export function preloadTileSheets(scene: Phaser.Scene): void {
    if (TILE_SHEETS.length === 0) {
        logTiles("[tileAtlas.preload] no tilesheets found under ../assets/tiles/*.png");
        return;
    }

    logTiles(
        "[tileAtlas.preload] tilesheets to load:",
        TILE_SHEETS.map(s =>
            `${s.textureKey} (${s.cols}x${s.rows} tiles, url="${s.url}")`
        )
    );

    for (const sheet of TILE_SHEETS) {
        scene.load.spritesheet(sheet.textureKey, sheet.url, {
            frameWidth: TILE_SIZE,
            frameHeight: TILE_SIZE
        });
    }

    // I included our preemptive logging here: [tileAtlas.preload]
}

export function buildTileAtlas(scene: Phaser.Scene): TileAtlas {
    if (TILE_SHEETS.length === 0) {
        throw new Error("[tileAtlas.build] no TILE_SHEETS defined – did preloadTileSheets run?");
    }

    // Prefer the terrain sheet, fall back to anything with "terrain" in the key,
    // and finally fall back to the first sheet if nothing matches.
    let mainSheet =
        TILE_SHEETS.find(s => s.textureKey === "tiles.terrain") ||
        TILE_SHEETS.find(s => s.textureKey.includes("terrain")) ||
        TILE_SHEETS[0];

    if (!mainSheet) {
        throw new Error("[tileAtlas.build] no tilesheets available");
    }

    logTiles(
        "[tileAtlas.build] using main sheet for autotiles:",
        `${mainSheet.textureKey} (${mainSheet.cols}x${mainSheet.rows} tiles)`
    );

    // Local helpers to compute frame indices on the main sheet.
    const cols = mainSheet.cols;
    const idx = (col: number, row: number): number => {
        return row * cols + col;
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


    const tex = mainSheet.textureKey;


    // -----------------------------------------------------------------
    // NEW: build autotiles for each TerrainFamily from TERRAIN_FAMILIES
    // -----------------------------------------------------------------

    const frameFromCoord = (coord: [number, number]) => {
        const [col, row] = coord;
        return idx(col, row);
    };

    function registerTerrainFamily(tf: TerrainFamilyDef) {
        const family = tf.id as TileFamily;
        const tiles = tf.tiles;

        // 1) Rim + corners from convex9 (3x3 block), if present.
        //
        // We assume convex9 is ordered row-major:
        //   [0] [1] [2]
        //   [3] [4] [5]
        //   [6] [7] [8]
        //
        const cv = tiles.convex9;
        if (cv && cv.length === 9) {
            const [t0, t1, t2, t3, t4, t5, t6, t7, t8] = cv;

            addAuto({ family, shape: "center",   textureKey: tex, frameIndex: frameFromCoord(t4) });

            addAuto({ family, shape: "edgeN",    textureKey: tex, frameIndex: frameFromCoord(t1) });
            addAuto({ family, shape: "edgeS",    textureKey: tex, frameIndex: frameFromCoord(t7) });
            addAuto({ family, shape: "edgeW",    textureKey: tex, frameIndex: frameFromCoord(t3) });
            addAuto({ family, shape: "edgeE",    textureKey: tex, frameIndex: frameFromCoord(t5) });

            addAuto({ family, shape: "cornerNW", textureKey: tex, frameIndex: frameFromCoord(t0) });
            addAuto({ family, shape: "cornerNE", textureKey: tex, frameIndex: frameFromCoord(t2) });
            addAuto({ family, shape: "cornerSW", textureKey: tex, frameIndex: frameFromCoord(t6) });
            addAuto({ family, shape: "cornerSE", textureKey: tex, frameIndex: frameFromCoord(t8) });
        }

        // 2) Center variants from groundVariants / interior.
        const centers: number[][] = [
            ...(tiles.groundVariants ?? []),
            ...(tiles.interior ?? [])
        ];

        for (const coord of centers) {
            addAuto({
                family,
                shape: "center",
                textureKey: tex,
                frameIndex: frameFromCoord(coord as [number, number])
            });
        }

        // 3) Per-family decor tiles.
        for (const coord of tiles.decor ?? []) {
            addDecor({
                family,
                textureKey: tex,
                frameIndex: frameFromCoord(coord as [number, number])
            });
        }

        // NOTE: concave2x2 and edgeExtensions are in the data, but we’re not
        // wiring special shapes for them yet. We can extend AutoShape later
        // if we want real concave autotiling / dirt-in-grass stitching.
    }

    // Register all terrain families into the atlas.
    for (const tf of TERRAIN_FAMILIES) {
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
        tileSize: TILE_SIZE,
        primaryTextureKey: mainSheet.textureKey,
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

    // I included our preemptive logging here: [tileAtlas.build]

    return atlas;
}



















type TerrainType = "ground" | "chasm" | "water" | "hedge";

interface TerrainFamily {
    id: string;
    type: TerrainType;
    cols: [number, number];      // inclusive tile column range
    rows: [number, number];      // inclusive tile row range
    tiles: {
        decor?: number[][];          // transparent overlays (go on top of base ground)
        concave2x2?: {               // inward-facing 2×2 macro (top-left cell)
            topLeft: [number, number];
        };
        convex9?: number[][];        // 3×3 outward-facing edge set
        interior?: number[][];       // lower-region floor (for chasm / water)
        groundVariants?: number[][]; // opaque full ground variants
        edgeExtensions?: {           // special for the dirt-in-grass set
            left?: [number, number];
            right?: [number, number];
        };
    };
}


export const TERRAIN_AUTOTILES: TerrainAutoTileDef[] = [

    // ----------------------------------------------------------
    // 1. ground_light
    // ----------------------------------------------------------
    {
        id: "ground_light",
        kind: "ground",

        atlasBounds: { cols: [0, 2], rows: [0, 5] },

        interior: [
            { row: 5, col: 0 },
            { row: 5, col: 1 },
            { row: 5, col: 2 },
        ],

        edgeN: { row: 2, col: 1 },
        edgeS: { row: 4, col: 1 },
        edgeW: { row: 3, col: 0 },
        edgeE: { row: 3, col: 2 },

        cornerNW: { row: 2, col: 0 },
        cornerNE: { row: 2, col: 2 },
        cornerSE: { row: 4, col: 2 },
        cornerSW: { row: 4, col: 0 },

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
    },

    // ----------------------------------------------------------
    // 2. ground_medium
    // ----------------------------------------------------------
    {
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

        decor: [],

        convex9BlockOrigin: { topLeft: { row: 2, col: 3 } },
        concave2x2BlockOrigin: { topLeft: { row: 0, col: 4 } },
    },

    // ----------------------------------------------------------
    // 3. ground_darkred
    // ----------------------------------------------------------
    {
        id: "ground_darkred",
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

        decor: [],

        convex9BlockOrigin: { topLeft: { row: 2, col: 6 } },
        concave2x2BlockOrigin: { topLeft: { row: 0, col: 7 } },
    },

    // ----------------------------------------------------------
    // 4. chasm_light
    // ----------------------------------------------------------
    {
        id: "chasm_light",
        kind: "chasm",

        atlasBounds: { cols: [0, 2], rows: [6, 11] },

        interior: [
            { row: 10, col: 0 },
            { row: 10, col: 1 },
            { row: 10, col: 2 },
        ],

        edgeN: { row: 8, col: 1 },
        edgeS: { row: 10, col: 1 },
        edgeW: { row: 9, col: 0 },
        edgeE: { row: 9, col: 2 },

        cornerNW: { row: 8, col: 0 },
        cornerNE: { row: 8, col: 2 },
        cornerSE: { row: 10, col: 2 },
        cornerSW: { row: 10, col: 0 },

        innerNW: { row: 6, col: 1 },
        innerNE: { row: 6, col: 2 },
        innerSE: { row: 7, col: 2 },
        innerSW: { row: 7, col: 1 },

        decor: [
            { row: 6, col: 0 },
            { row: 7, col: 0 },
        ],

        convex9BlockOrigin: { topLeft: { row: 8, col: 0 } },
        concave2x2BlockOrigin: { topLeft: { row: 6, col: 1 } },
    },

    // ----------------------------------------------------------
    // 5. chasm_medium
    // ----------------------------------------------------------
    {
        id: "chasm_medium",
        kind: "chasm",

        atlasBounds: { cols: [3, 5], rows: [6, 11] },

        interior: [
            { row: 10, col: 3 },
            { row: 10, col: 4 },
            { row: 10, col: 5 },
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

        convex9BlockOrigin: { topLeft: { row: 8, col: 3 } },
        concave2x2BlockOrigin: { topLeft: { row: 6, col: 4 } },
    },

    // ----------------------------------------------------------
    // 6. chasm_black
    // ----------------------------------------------------------
    {
        id: "chasm_black",
        kind: "chasm",

        atlasBounds: { cols: [6, 8], rows: [6, 11] },

        interior: [
            { row: 10, col: 6 },
            { row: 10, col: 7 },
            { row: 10, col: 8 },
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

        decor: [],

        convex9BlockOrigin: { topLeft: { row: 8, col: 6 } },
        concave2x2BlockOrigin: { topLeft: { row: 6, col: 7 } },
    },

    // ----------------------------------------------------------
    // 7. water_light
    // ----------------------------------------------------------
    {
        id: "water_light",
        kind: "water",

        atlasBounds: { cols: [9, 11], rows: [6, 11] },

        interior: [
            { row: 10, col: 9 },
            { row: 10, col: 10 },
            { row: 10, col: 11 },

            // water variants row 11
            { row: 11, col: 9 },
            { row: 11, col: 10 },
            { row: 11, col: 11 },
        ],

        edgeN: { row: 8, col: 10 },
        edgeS: { row: 10, col: 10 },
        edgeW: { row: 9, col: 9 },
        edgeE: { row: 9, col: 11 },

        cornerNW: { row: 8, col: 9 },
        cornerNE: { row: 8, col: 11 },
        cornerSE: { row: 10, col: 11 },
        cornerSW: { row: 10, col: 9 },

        innerNW: { row: 6, col: 10 },
        innerNE: { row: 6, col: 11 },
        innerSE: { row: 7, col: 11 },
        innerSW: { row: 7, col: 10 },

        decor: [],

        convex9BlockOrigin: { topLeft: { row: 8, col: 9 } },
        concave2x2BlockOrigin: { topLeft: { row: 6, col: 10 } },
    },

    // ----------------------------------------------------------
    // 8. grass_dense_light
    // ----------------------------------------------------------
    {
        id: "grass_dense_light",
        kind: "ground",

        atlasBounds: { cols: [0, 2], rows: [6, 11] },

        interior: [
            { row: 11, col: 0 },
            { row: 11, col: 1 },
            { row: 11, col: 2 },
        ],

        edgeN: { row: 8, col: 1 },
        edgeS: { row: 10, col: 1 },
        edgeW: { row: 9, col: 0 },
        edgeE: { row: 9, col: 2 },

        cornerNW: { row: 8, col: 0 },
        cornerNE: { row: 8, col: 2 },
        cornerSE: { row: 10, col: 2 },
        cornerSW: { row: 10, col: 0 },

        innerNW: { row: 6, col: 1 },
        innerNE: { row: 6, col: 2 },
        innerSE: { row: 7, col: 2 },
        innerSW: { row: 7, col: 1 },

        decor: [
            { row: 6, col: 0 },
            { row: 7, col: 0 },
        ],

        convex9BlockOrigin: { topLeft: { row: 8, col: 0 } },
        concave2x2BlockOrigin: { topLeft: { row: 6, col: 1 } },
    },

    // ----------------------------------------------------------
    // 9. grass_sparse_light
    // ----------------------------------------------------------
    {
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

        decor: [
            { row: 11, col: 3 },
            { row: 11, col: 4 },
            { row: 11, col: 5 },
        ],

        convex9BlockOrigin: { topLeft: { row: 8, col: 3 } },
        concave2x2BlockOrigin: { topLeft: { row: 6, col: 4 } },
    },

    // ----------------------------------------------------------
    // 10. grass_dark
    // ----------------------------------------------------------
    {
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
            { row: 7, col: 6 }
        ],

        convex9BlockOrigin: { topLeft: { row: 8, col: 6 } },
        concave2x2BlockOrigin: { topLeft: { row: 6, col: 7 } },
    },

    // ----------------------------------------------------------
    // 11. hedge_green_low
    // ----------------------------------------------------------
    {
        id: "hedge_green_low",
        kind: "hedge",

        atlasBounds: { cols: [9, 11], rows: [6, 11] },

        interior: [
            { row: 10, col: 10 }
        ],

        edgeN: { row: 8, col: 10 },
        edgeS: { row: 10, col: 10 },
        edgeW: { row: 9, col: 9 },
        edgeE: { row: 9, col: 11 },

        cornerNW: { row: 8, col: 9 },
        cornerNE: { row: 8, col: 11 },
        cornerSE: { row: 10, col: 11 },
        cornerSW: { row: 10, col: 9 },

        innerNW: { row: 6, col: 10 },
        innerNE: { row: 6, col: 11 },
        innerSE: { row: 7, col: 11 },
        innerSW: { row: 7, col: 10 },

        decor: [
            { row: 11, col: 11 },
        ],

        convex9BlockOrigin: { topLeft: { row: 8, col: 9 } },
        concave2x2BlockOrigin: { topLeft: { row: 6, col: 10 } },
    },

    // ----------------------------------------------------------
    // 12. hedge_green_high
    // ----------------------------------------------------------
    {
        id: "hedge_green_high",
        kind: "hedge",

        atlasBounds: { cols: [12, 14], rows: [6, 11] },

        interior: [
            { row: 10, col: 13 }
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

        decor: [
            { row: 11, col: 12 },
            { row: 11, col: 13 },
            { row: 11, col: 14 },
        ],

        convex9BlockOrigin: { topLeft: { row: 8, col: 12 } },
        concave2x2BlockOrigin: { topLeft: { row: 6, col: 13 } },
    },

    // ----------------------------------------------------------
    // 13. hedge_straw
    // ----------------------------------------------------------
    {
        id: "hedge_straw",
        kind: "hedge",

        atlasBounds: { cols: [15, 17], rows: [6, 11] },

        interior: [
            { row: 10, col: 16 }
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

        decor: [
            { row: 11, col: 15 },
            { row: 11, col: 16 },
            { row: 11, col: 17 },
        ],

        convex9BlockOrigin: { topLeft: { row: 8, col: 15 } },
        concave2x2BlockOrigin: { topLeft: { row: 6, col: 16 } },
    },

    // ----------------------------------------------------------
    // 14. dirt_patch_lightgrass
    // ----------------------------------------------------------
    {
        id: "dirt_patch_lightgrass",
        kind: "ground",

        atlasBounds: { cols: [18, 20], rows: [6, 11] },

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

        innerNW: { row: 6, col: 19 },
        innerNE: { row: 6, col: 20 },
        innerSE: { row: 7, col: 20 },
        innerSW: { row: 7, col: 19 },

        decor: [
            { row: 6, col: 18 },
            { row: 7, col: 18 },
        ],

        convex9BlockOrigin: { topLeft: { row: 8, col: 18 } },
        concave2x2BlockOrigin: { topLeft: { row: 6, col: 19 } },

        edgeExtensions: {
            left:  { row: 11, col: 19 },
            right: { row: 11, col: 20 },
        }
    },

];
