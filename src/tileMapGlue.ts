// tileMapGlue.ts
import type Phaser from "phaser";
import type { TileAtlas, TileFamily, AutoShape } from "./tileAtlas";

const DEBUG_TILES_GLOBAL = true;

function logTiles(localDebug: boolean, ...args: any[]) {
    if (!DEBUG_TILES_GLOBAL || !localDebug) return;
    console.log(...args);
}


function defaultTileValueToFamily(v: number): TileFamily {
    // In HeroEngineInPhaser.ts:
    // const TILE_EMPTY = 0
    // const TILE_WALL  = 1
    //
    // Pick the default look for your procedural map here by choosing the
    // family IDs from TERRAIN_FAMILIES.
    if (v === 1) {
        // Walls → chasm with light rim
        return "chasm_light";
    }

    // Everything else → dense light grass
    return "grass_dense_light";
}




/**
 * Compute which AutoShape a tile should use based on its neighbors.
 * This is a simple 4-neighbor autotile: we only look at N/E/S/W.
 */
function computeAutoShape(
    grid: number[][],
    r: number,
    c: number,
    family: TileFamily,
    valueToFamily: (v: number) => TileFamily
): AutoShape {
    const rows = grid.length;
    const cols = rows > 0 ? grid[0].length : 0;

    const same = (rr: number, cc: number): boolean => {
        if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) return false;
        return valueToFamily(grid[rr][cc]) === family;
    };

    const n = same(r - 1, c);
    const s = same(r + 1, c);
    const w = same(r, c - 1);
    const e = same(r, c + 1);

    // All neighbors match → center.
    if (n && s && w && e) return "center";

    // Edges: missing exactly one neighbor.
    if (!n && s && w && e) return "edgeN";
    if (!s && n && w && e) return "edgeS";
    if (!w && n && s && e) return "edgeW";
    if (!e && n && s && w) return "edgeE";

    // Corners: missing two adjacent neighbors.
    if (!n && !e) return "cornerNE";
    if (!n && !w) return "cornerNW";
    if (!s && !e) return "cornerSE";
    if (!s && !w) return "cornerSW";

    // Fallback.
    return "center";
}

export interface WorldTileRendererOptions {
    /** If true, enable detailed tile logging for this renderer instance. */
    debugLocal?: boolean;
    /**
     * Optional mapper from engine tile values → TileFamily.
     * If omitted, a simple default implementation is used.
     */
    tileValueToFamily?: (v: number) => TileFamily;
}


export class WorldTileRenderer {
    private scene: Phaser.Scene;
    private atlas: TileAtlas;
    private debugLocal: boolean;
    private tileValueToFamily: (v: number) => TileFamily;

    private map?: Phaser.Tilemaps.Tilemap;
    private tileset?: Phaser.Tilemaps.Tileset;
    private layer?: Phaser.Tilemaps.TilemapLayer;

    constructor(scene: Phaser.Scene, atlas: TileAtlas, opts: WorldTileRendererOptions = {}) {
        this.scene = scene;
        this.atlas = atlas;
        this.debugLocal = opts.debugLocal ?? true;
        this.tileValueToFamily = opts.tileValueToFamily ?? defaultTileValueToFamily;

        logTiles(this.debugLocal, "[tileMapGlue] created WorldTileRenderer");
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
    // Create tilemap + tileset + layer ONE TIME
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

        // Create ONE layer and store it
        this.layer = this.map.createBlankLayer("world", this.tileset, 0, 0) || undefined;
        if (!this.layer) {
            throw new Error("[tileMapGlue.sync] tilemap layer missing after createBlankLayer");
        }

        // Lower depth → background
        this.layer.setDepth(-1000);

        logTiles(
            this.debugLocal,
            "[tileMapGlue.sync] created new Phaser.Tilemap",
            { rows, cols, tileSize }
        );
    }

    if (!this.layer) {
        throw new Error("[tileMapGlue.sync] tilemap layer missing");
    }

    // --------------------------------------------------------------
    // Fill the tilemap layer with frames
    // --------------------------------------------------------------
    const familyCounts = new Map<TileFamily, number>();

    for (let r = 0; r < rows; r++) {
        const row = grid[r];
        for (let c = 0; c < cols; c++) {
            const v = row[c];
            const family = this.tileValueToFamily(v);
            const shape = computeAutoShape(grid, r, c, family, this.tileValueToFamily);

            let tileDef = this.atlas.getRandomVariant(family, shape);
            if (!tileDef) {
                tileDef = this.atlas.getAutoTile(family, "center");
            }

            const frameIndex = tileDef ? tileDef.frameIndex : 0;

            this.layer.putTileAt(frameIndex, c, r);

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

    // I included our preemptive logging here: [tileMapGlue.WorldTileRenderer.syncFromEngineGrid]
}

}