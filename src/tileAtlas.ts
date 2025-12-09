// tileAtlas.ts
import type Phaser from "phaser";

export type TileFamily =
    | "dirtCrater"
    | "decor";

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

    const mainSheet = TILE_SHEETS[0];

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

    // ---------------------------------------------------------------------
    // Family: "dirtCrater" – use the 3x3 block at columns 2–4, rows 0–2.
    //
    // Based on your description:
    //   [2][0] [3][0] [4][0]
    //   [2][1] [3][1] [4][1]
    //   [2][2] [3][2] [4][2]
    //
    // We'll treat [3][1] as the "center" tile and the others as edges/corners.
    // ---------------------------------------------------------------------

    const tex = mainSheet.textureKey;

    addAuto({ family: "dirtCrater", shape: "center",   textureKey: tex, frameIndex: idx(3, 1) });
    addAuto({ family: "dirtCrater", shape: "edgeN",    textureKey: tex, frameIndex: idx(3, 0) });
    addAuto({ family: "dirtCrater", shape: "edgeS",    textureKey: tex, frameIndex: idx(3, 2) });
    addAuto({ family: "dirtCrater", shape: "edgeW",    textureKey: tex, frameIndex: idx(2, 1) });
    addAuto({ family: "dirtCrater", shape: "edgeE",    textureKey: tex, frameIndex: idx(4, 1) });
    addAuto({ family: "dirtCrater", shape: "cornerNW", textureKey: tex, frameIndex: idx(2, 0) });
    addAuto({ family: "dirtCrater", shape: "cornerNE", textureKey: tex, frameIndex: idx(4, 0) });
    addAuto({ family: "dirtCrater", shape: "cornerSW", textureKey: tex, frameIndex: idx(2, 2) });
    addAuto({ family: "dirtCrater", shape: "cornerSE", textureKey: tex, frameIndex: idx(4, 2) });

    // ---------------------------------------------------------------------
    // Family: "decor" – the two rocks at [0][0] and [1][0] as decorations.
    // ---------------------------------------------------------------------
    addDecor({ family: "decor", textureKey: tex, frameIndex: idx(0, 0) });
    addDecor({ family: "decor", textureKey: tex, frameIndex: idx(1, 0) });

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
