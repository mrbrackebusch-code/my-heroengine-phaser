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

    if (v === 1) {
        // walls → chasm rim family
        return "chasm_light";
    }

    // everything else → light-brown dirt
    return "ground_light";
}



/**
 * Compute an 8-way neighbor bitmask for a tile and then collapse it
 * down to one of our coarse AutoShape categories.
 *
 * Bit layout:
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
    valueToFamily: (v: number) => TileFamily
): number {
    const rows = grid.length;
    const cols = rows > 0 ? grid[0].length : 0;

    const same = (rr: number, cc: number): boolean => {
        if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) return false;
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

/**
 * First-pass mapping from neighbor mask → AutoShape.
 * For now we only use the 4 cardinal bits to decide center/edges/corners.
 * Diagonals are stored and ready for the richer 47-tile mapping.
 */
function autoShapeFromMask(mask: number): AutoShape {
    const n = (mask & (1 << 0)) !== 0;
    const e = (mask & (1 << 1)) !== 0;
    const s = (mask & (1 << 2)) !== 0;
    const w = (mask & (1 << 3)) !== 0;

    // All four neighbors present → interior
    if (n && e && s && w) return "center";

    // Single-missing neighbor → edge
    if (!n && e && s && w) return "edgeN";
    if (!s && e && n && w) return "edgeS";
    if (!w && n && e && s) return "edgeW";
    if (!e && n && s && w) return "edgeE";

    // Two adjacent neighbors missing → corner
    if (!n && !e && s && w) return "cornerNE";
    if (!n && !w && s && e) return "cornerNW";
    if (!s && !e && n && w) return "cornerSE";
    if (!s && !w && n && e) return "cornerSW";

    // Everything else (T-junctions, isolated, etc.) → treat as interior for now.
    // The important part is that the full mask is computed; we can refine this
    // mapping later to differentiate more of the 47 shapes.
    return "center";
}

/**
 * Wrapper used by the renderer: compute mask, then pick a coarse shape.
 */
function computeAutoShape(
    grid: number[][],
    r: number,
    c: number,
    family: TileFamily,
    valueToFamily: (v: number) => TileFamily
): AutoShape {
    const mask = computeNeighborMask(grid, r, c, family, valueToFamily);
    return autoShapeFromMask(mask);
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