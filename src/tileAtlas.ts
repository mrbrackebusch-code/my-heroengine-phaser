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




const TERRAIN_FAMILIESRAW: TerrainFamily[] = [
  // ------------------------------------------------------------
  // 0 — Light brown ground
  // ------------------------------------------------------------
  {
    id: "ground_light",
    type: "ground",
    cols: [0, 2],
    rows: [0, 5],
    tiles: {
      decor: [
        [0,0], [1,0],   // small rock piles
        // extra light-grass overlays you said should belong to this color family
        [11,15], [11,16], [11,17],
      ],
      concave2x2: { topLeft: [0,1] },
      convex9: [
        [2,0],[2,1],[2,2],
        [3,0],[3,1],[3,2],
        [4,0],[4,1],[4,2]
      ],
      groundVariants: [
        [5,0],[5,1],[5,2],
        // extra light-green grass variants you called out
        [11,9],[11,10],[11,12],[11,13],[11,14]
      ]
    }
  },

  // ------------------------------------------------------------
  // 1 — Medium brown ground
  // ------------------------------------------------------------
  {
    id: "ground_medium",
    type: "ground",
    cols: [3, 5],
    rows: [0, 5],
    tiles: {
      decor: [[0,3],[1,3]],
      concave2x2: { topLeft: [0,4] },
      convex9: [
        [2,3],[2,4],[2,5],
        [3,3],[3,4],[3,5],
        [4,3],[4,4],[4,5]
      ],
      groundVariants: [[5,3],[5,4],[5,5]]
    }
  },

  // ------------------------------------------------------------
  // 2 — Red-brown ground
  // ------------------------------------------------------------
  {
    id: "ground_redbrown",
    type: "ground",
    cols: [6, 8],
    rows: [0, 5],
    tiles: {
      decor: [[0,6],[1,6]],
      concave2x2: { topLeft: [0,7] },
      convex9: [
        [2,6],[2,7],[2,8],
        [3,6],[3,7],[3,8],
        [4,6],[4,7],[4,8]
      ],
      groundVariants: [[5,6],[5,7],[5,8]]
    }
  },

  // ------------------------------------------------------------
  // 3 — Light-rim chasm (dark floor)
  // ------------------------------------------------------------
  {
    id: "chasm_light",
    type: "chasm",
    cols: [9, 11],
    rows: [0, 5],
    tiles: {
      decor: [[0,9],[1,9]],
      concave2x2: { topLeft: [0,10] },
      convex9: [
        [2,9],[2,10],[2,11],
        [3,9],[3,10],[3,11],
        [4,9],[4,10],[4,11]
      ],
      interior: [[5,9],[5,10],[5,11]]
    }
  },

  // ------------------------------------------------------------
  // 4 — Medium-rim chasm (dark floor)
  // ------------------------------------------------------------
  {
    id: "chasm_medium",
    type: "chasm",
    cols: [12, 14],
    rows: [0, 5],
    tiles: {
      decor: [[0,12],[1,12]],
      concave2x2: { topLeft: [0,13] },
      convex9: [
        [2,12],[2,13],[2,14],
        [3,12],[3,13],[3,14],
        [4,12],[4,13],[4,14]
      ],
      interior: [[5,12],[5,13],[5,14]]
    }
  },

  // ------------------------------------------------------------
  // 5 — Void chasm (black floor)
  // ------------------------------------------------------------
  {
    id: "chasm_void",
    type: "chasm",
    cols: [15, 17],
    rows: [0, 5],
    tiles: {
      decor: [[0,15],[1,15]],
      concave2x2: { topLeft: [0,16] },
      convex9: [
        [2,15],[2,16],[2,17],
        [3,15],[3,16],[3,17],
        [4,15],[4,16],[4,17]
      ],
      interior: [[5,15],[5,16],[5,17]]
    }
  },

  // ------------------------------------------------------------
  // 6 — Water chasm (rock rim + water floor)
  // ------------------------------------------------------------
  {
    id: "water_chasm",
    type: "water",
    cols: [18, 20],
    rows: [0, 5],
    tiles: {
      decor: [[0,18],[1,18]],
      concave2x2: { topLeft: [0,19] },
      convex9: [
        [2,18],[2,19],[2,20],
        [3,18],[3,19],[3,20],
        [4,18],[4,19],[4,20]
      ],
      interior: [
        [5,18],[5,19],[5,20]  // three distinct water textures
      ]
    }
  },

  // ==================================================================
  // ROWS 6–11  (grass, hedges, dirt-in-grass)
  // ==================================================================

  // ------------------------------------------------------------
  // 7 — Grass: dense light green
  // ------------------------------------------------------------
  {
    id: "grass_dense_light",
    type: "ground",
    cols: [0, 2],
    rows: [6, 11],
    tiles: {
      decor: [
        [6,0],[7,0],   // dense grass clumps
      ],
      concave2x2: { topLeft: [6,1] },
      convex9: [
        [8,0],[8,1],[8,2],
        [9,0],[9,1],[9,2],
        [10,0],[10,1],[10,2]
      ],
      groundVariants: [
        [11,0],[11,1],[11,2]
      ]
    }
  },

  // ------------------------------------------------------------
  // 8 — Grass: sparse light green (same hue, less coverage)
  // ------------------------------------------------------------
  {
    id: "grass_sparse_light",
    type: "ground",
    cols: [3, 5],
    rows: [6, 11],
    tiles: {
      decor: [],  // you explicitly said: no decor for this one
      concave2x2: { topLeft: [6,4] },
      convex9: [
        [8,3],[8,4],[8,5],
        [9,3],[9,4],[9,5],
        [10,3],[10,4],[10,5]
      ],
      groundVariants: [
        [11,3],[11,4],[11,5]  // same grass color, with tulips
      ]
    }
  },

  // ------------------------------------------------------------
  // 9 — Grass: dark green
  // ------------------------------------------------------------
  {
    id: "grass_dark",
    type: "ground",
    cols: [6, 8],
    rows: [6, 11],
    tiles: {
      decor: [
        [6,6],[7,6]
      ],
      concave2x2: { topLeft: [6,7] },
      convex9: [
        [8,6],[8,7],[8,8],
        [9,6],[9,7],[9,8],
        [10,6],[10,7],[10,8]
      ],
      groundVariants: [
        [11,6],[11,7],[11,8]
      ]
    }
  },

  // ------------------------------------------------------------
  // 10 — Hedge: low green hedge
  // ------------------------------------------------------------
  {
    id: "hedge_low",
    type: "hedge",
    cols: [9, 11],
    rows: [6, 11],
    tiles: {
      decor: [
        [6,9],[7,9],   // 1×2 bush object (treated as two tiles in data)
        [11,11]        // single-tile hedge overlay (transparent)
      ],
      concave2x2: { topLeft: [6,10] },
      convex9: [
        [8,9],[8,10],[8,11],
        [9,9],[9,10],[9,11],
        [10,9],[10,10],[10,11]
      ]
      // no dedicated hedge groundVariants; bottom row here is grass extras
    }
  },

  // ------------------------------------------------------------
  // 11 — Hedge: taller / second color hedge
  // (structure same as low hedge; art style differs)
  // ------------------------------------------------------------
  {
    id: "hedge_tall",
    type: "hedge",
    cols: [12, 14],
    rows: [6, 11],
    tiles: {
      // you noted this as a hedge family; decor in this band is grass, so leave empty
      decor: [],
      concave2x2: { topLeft: [6,13] },
      convex9: [
        [8,12],[8,13],[8,14],
        [9,12],[9,13],[9,14],
        [10,12],[10,13],[10,14]
      ]
      // row 11 here (12–14) we already attached to ground_light as variants
    }
  },

  // ------------------------------------------------------------
  // 12 — Hedge: straw / hay hedge
  // ------------------------------------------------------------
  {
    id: "hedge_straw",
    type: "hedge",
    cols: [15, 17],
    rows: [6, 11],
    tiles: {
      decor: [],  // you called out row 11,15–17 as general decor; those we
                  // associated with light ground above so we don't double-own them
      concave2x2: { topLeft: [6,16] },
      convex9: [
        [8,15],[8,16],[8,17],
        [9,15],[9,16],[9,17],
        [10,15],[10,16],[10,17]
      ]
    }
  },

  // ------------------------------------------------------------
  // 13 — Dirt patches inside grass (fertile soil)
  // ------------------------------------------------------------
  {
    id: "ground_dirtpatch",
    type: "ground",
    cols: [18, 20],
    rows: [6, 11],
    tiles: {
      // these assume surrounding grass; visually they are dirt patches within grass
      decor: [
        [6,18],[7,18]
      ],
      concave2x2: { topLeft: [6,19] }, // tiles [6,19],[6,20],[7,19],[7,20]
      convex9: [
        [8,18],[8,19],[8,20],
        [9,18],[9,19],[9,20],
        [10,18],[10,19],[10,20]
      ],
      // special “edge continuation” tiles that align with the concave band
      edgeExtensions: {
        left:  [11,19],  // placed immediately left of the concave block
        right: [11,20]   // placed immediately right of the concave block
      }
      // [11,18] is effectively unused/blank as you described
    }
  }
];
