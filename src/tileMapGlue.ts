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



export function autoShapeFromMask(mask: number): AutoShape {
    const n  = (mask & (1 << 0)) !== 0;
    const e  = (mask & (1 << 1)) !== 0;
    const s  = (mask & (1 << 2)) !== 0;
    const w  = (mask & (1 << 3)) !== 0;

    const ne = (mask & (1 << 4)) !== 0;
    const se = (mask & (1 << 5)) !== 0;
    const sw = (mask & (1 << 6)) !== 0;
    const nw = (mask & (1 << 7)) !== 0;

    const cardCount =
        (n ? 1 : 0) +
        (e ? 1 : 0) +
        (s ? 1 : 0) +
        (w ? 1 : 0);

    const diagCount =
        (ne ? 1 : 0) +
        (se ? 1 : 0) +
        (sw ? 1 : 0) +
        (nw ? 1 : 0);

    // ------------------------------------------------------
    // 1. Single-tile island: no neighbors at all → "single"
    // ------------------------------------------------------
    if (cardCount === 0 && diagCount === 0) {
        return "single";
    }

    // ------------------------------------------------------
    // 2. Fully surrounded 3×3 blob:
    //    All 8 neighbors present → true interior center
    // ------------------------------------------------------
    if (n && e && s && w && ne && se && sw && nw) {
        return "center";
    }

    // ------------------------------------------------------
    // 3. Concave corners:
    //    All 4 cardinals present, but one diagonal missing
    //    → use innerNW / innerNE / innerSE / innerSW
    // ------------------------------------------------------
    if (n && e && s && w) {
        // exact single missing diagonal → concave corner
        if (!nw && ne && se && sw) return "innerNW";
        if (!ne && nw && se && sw) return "innerNE";
        if (!se && ne && nw && sw) return "innerSE";
        if (!sw && ne && se && nw) return "innerSW";

        // Other weird diagonal combos: just treat as center-ish interior.
        return "center";
    }

    // ------------------------------------------------------
    // 4. Classic edges (one cardinal missing, three present)
    // ------------------------------------------------------
    if (!n && e && s && w) return "edgeN";
    if (!s && e && n && w) return "edgeS";
    if (!w && n && e && s) return "edgeW";
    if (!e && n && s && w) return "edgeE";

    // ------------------------------------------------------
    // 5. Classic convex corners (two adjacent cardinals present)
    // ------------------------------------------------------
    // NE corner: have N+E, missing S+W
    if (n && e && !s && !w) return "cornerNE";
    // NW corner: have N+W, missing S+E
    if (n && w && !s && !e) return "cornerNW";
    // SE corner: have S+E, missing N+W
    if (s && e && !n && !w) return "cornerSE";
    // SW corner: have S+W, missing N+E
    if (s && w && !n && !e) return "cornerSW";

    // ------------------------------------------------------
    // 6. Strips / lines & sparse cases:
    //    Never fall back to "center" here; pick an edge.
    // ------------------------------------------------------

    // Horizontal strip (only E+W)
    if (e && w && !n && !s) {
        // Heuristic: treat as "edgeS" so it renders like a top-of-cliff line.
        return "edgeS";
    }

    // Vertical strip (only N+S)
    if (n && s && !e && !w) {
        // Heuristic: treat as "edgeE" (pick one consistently).
        return "edgeE";
    }

    // Single neighbor cases:
    if (n && !e && !s && !w) return "edgeS";
    if (s && !e && !n && !w) return "edgeN";
    if (e && !n && !s && !w) return "edgeW";
    if (w && !n && !e && !s) return "edgeE";

    // Mixed weird patterns: default to an edge instead of center
    // Prefer an edge in the direction of "missing outside".
    if (!n) return "edgeN";
    if (!s) return "edgeS";
    if (!w) return "edgeW";
    if (!e) return "edgeE";

    // Absolute last resort (should be unreachable with logic above)
    return "center";
}



function computeAutoShape(grid, r, c, family, valueToFamily): AutoShape {
    const mask = computeNeighborMask(grid, r, c, family, valueToFamily);

    const nSame = (mask & 1) !== 0;
    const eSame = (mask & 2) !== 0;
    const sSame = (mask & 4) !== 0;
    const wSame = (mask & 8) !== 0;

    // --- NEW: if this is ground and a neighbor is chasm → inner shapes
    if (family === "ground_light") {

        const nChasm = valueToFamily(grid[r-1]?.[c]) === "chasm_light";
        const sChasm = valueToFamily(grid[r+1]?.[c]) === "chasm_light";
        const wChasm = valueToFamily(grid[r]?.[c-1]) === "chasm_light";
        const eChasm = valueToFamily(grid[r]?.[c+1]) === "chasm_light";

        // Single-direction transitions
        if (nChasm) return "innerN";
        if (sChasm) return "innerS";
        if (wChasm) return "innerW";
        if (eChasm) return "innerE";

        // Corners
        const nwChasm = valueToFamily(grid[r-1]?.[c-1]) === "chasm_light";
        const neChasm = valueToFamily(grid[r-1]?.[c+1]) === "chasm_light";
        const swChasm = valueToFamily(grid[r+1]?.[c-1]) === "chasm_light";
        const seChasm = valueToFamily(grid[r+1]?.[c+1]) === "chasm_light";

        if (nwChasm) return "innerNW";
        if (neChasm) return "innerNE";
        if (swChasm) return "innerSW";
        if (seChasm) return "innerSE";
    }

    // Default: classic 47-tile logic
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