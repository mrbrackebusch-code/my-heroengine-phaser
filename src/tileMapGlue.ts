// tileMapGlue.ts
import type Phaser from "phaser";
import { DECAL_VISUALS_BY_NAME, PROP_VISUALS_BY_NAME, terrainFrameIndexFromRef } from "./tileAtlas";
import type { TileAtlas, TileFamily, AutoShape } from "./tileAtlas";

// ----------------------------------------------------------
// Debug
// ----------------------------------------------------------

const DEBUG_TILES_GLOBAL = true;

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
    syncDecalGridByName(decalKeys: Array<Array<string | "" | null | undefined>>): void {
        if (!this.map || !this.decalLayer) return;

        const rows = decalKeys.length | 0;
        const cols = rows > 0 ? (decalKeys[0].length | 0) : 0;

        if ((this.map.height | 0) !== rows || (this.map.width | 0) !== cols) {
            logTiles(
                this.debugLocal,
                "[tileMapGlue.decals] WARNING: decal grid dims differ from tilemap; skipping",
                { decalRows: rows, decalCols: cols, mapH: this.map.height | 0, mapW: this.map.width | 0 }
            );
            return;
        }

        // Clear then place.
        this.decalLayer.fill(-1);

        for (let r = 0; r < rows; r++) {
            const row = decalKeys[r];
            for (let c = 0; c < cols; c++) {
                const key = row[c];
                if (!key) continue;

                const vis = DECAL_VISUALS_BY_NAME[key];
                if (!vis) continue;

                // For now, tilemap rendering assumes the primary tileset is the terrain sheet.
                if (vis.atlas !== "terrain") continue;

                const frameIndex = terrainFrameIndexFromRef(vis.ref);
                this.decalLayer.putTileAt(frameIndex, c, r);
            }
        }
    }

    /**
     * Optional: Apply a visual-only prop overlay grid (tile-aligned props).
     * Not required for v1 overlap proof, but available if you choose to render
     * props as tiles instead of sprites.
     */
    syncPropGridByName(propKeys: Array<Array<string | "" | null | undefined>>): void {
        if (!this.map || !this.propLayer) return;

        const rows = propKeys.length | 0;
        const cols = rows > 0 ? (propKeys[0].length | 0) : 0;

        if ((this.map.height | 0) !== rows || (this.map.width | 0) !== cols) {
            logTiles(
                this.debugLocal,
                "[tileMapGlue.props] WARNING: prop grid dims differ from tilemap; skipping",
                { propRows: rows, propCols: cols, mapH: this.map.height | 0, mapW: this.map.width | 0 }
            );
            return;
        }

        this.propLayer.fill(-1);

        for (let r = 0; r < rows; r++) {
            const row = propKeys[r];
            for (let c = 0; c < cols; c++) {
                const key = row[c];
                if (!key) continue;

                const vis = PROP_VISUALS_BY_NAME[key];
                if (!vis) continue;
                if (vis.atlas !== "terrain") continue;

                const frameIndex = terrainFrameIndexFromRef(vis.ref);
                this.propLayer.putTileAt(frameIndex, c, r);
            }
        }
    }

}