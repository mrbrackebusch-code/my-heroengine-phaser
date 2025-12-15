/* 
  arcadeCompat.ts
  Minimal MakeCode Arcade-style compat layer to let HeroEngine + extensions compile.
  Step 1: get things compiling.
  Step 2: wire these stubs to Phaser / real game loop.
*/

// arcadeCompat.ts
//import { tryAttachMonsterSprite } from "./monsterAnimGlue";

// ✅ create a module object called `monsterAnimGlue`
import * as monsterAnimGlue from "./monsterAnimGlue";
// ✅ create a module object called `heroAnimGlue`
import * as heroAnimGlue from "./heroAnimGlue";


// Put this near the top of arcadeCompat.ts with your other debug toggles
const DEBUG_SETFLAG = false;

let _setFlagLogCount = 0;

// GLOBAL DEBUG FLAGS
const DEBUG_WRAP_TEX = false;   // 👈 disable spam

// MASTER NETWORK DEBUG FLAG
const DEBUG_NET = false;


let _heroAnimNoAtlasLogged = false;


const INPUT_LAG_WARN_MS = 120;          // already have this
const INPUT_LAG_WARN_EXCESS_MS = 80;    // how much above baseline counts as "bad"

let _inputLagBaselineMs = 0;
let _inputLagBaselineSamples = 0;
let _lastInputLagWarnMs = 0;


// New: per-input processing time thresholds (host only)
const INPUT_PROC_WARN_MS = 1.5;          // ms, log if host spends longer than this per input
const INPUT_PROC_SPAM_GAP_MS = 0.5;      // don't re-log at nearly the same cost

let _lastInputProcWarnMs = 0;


const PERF_FPS_WARN = 55;                // always log if fps < this
const PERF_MIN_LOG_INTERVAL_MS = 3000;   // ms between normal perf logs

let _lastPerfLogMs = 0;

const PERF_ALWAYS_LOG = false;   // flip to true if you want per-second spam



// ---------------------------------------
// Host perf buckets (arcadeCompat.ts)
// ---------------------------------------
let _hostPerfLastDumpMs = 0
let _hostPerfFrameCount = 0
let _hostPerfAccumTickMs = 0
let _hostPerfAccumSyncMs = 0
let _hostPerfAccumSnapMs = 0
let _hostPerfLastSpriteCount = 0
let _hostPerfLastSnapshotSprites = 0


let _frameAttachMsAccum = 0;
let _frameAttachCreateCount = 0;
let _frameAttachUpdateCount = 0;

let _frameAttachTexMs = 0;         // texture create/recreate time
let _frameAttachPixelMs = 0;       // pixel upload + putImageData + refresh
let _frameAttachEarlyOutCount = 0; // calls that return before pixel work








// --------------------------------------------------------------
// Phaser-only: HeroEngine hook override (visual geometry)
// --------------------------------------------------------------
// Engine calls:
//   (globalThis as any).__HeroEngineHooks.getHeroVisualInfo(hero, nx, ny)
// returning:
//   [innerR, leadEdge, wTipX, wTipY]
// wTip offsets are relative to hero center (pixels).

let __heroVisualHookInstalled = false;




function __installHeroVisualInfoHookOnce(): void {
    if (__heroVisualHookInstalled) return;
    __heroVisualHookInstalled = true;

    try {
        const g: any = (globalThis as any);
        g.__HeroEngineHooks = g.__HeroEngineHooks || {};

        g.__HeroEngineHooks.getHeroVisualInfo = function (hero: any, nx: number, ny: number): number[] {
            // 1) Try cached silhouette-derived values first
            let innerR = 0;
            let leadEdge = 0;

            try {
                innerR = sprites.readDataNumber(hero, HERO_DATA.VIS_INNER_R) | 0;
                leadEdge = sprites.readDataNumber(hero, HERO_DATA.VIS_LEAD_EDGE) | 0;
            } catch { /* ignore */ }

            // 2) Fallback if not ready yet (still compile-safe)
            if (innerR <= 0 || leadEdge <= 0) {
                const native: any = hero && hero.native;
                const w = native ? (native.displayWidth || native.width || 64) : 64;
                const h = native ? (native.displayHeight || native.height || 64) : 64;
                leadEdge = Math.min(w, h) / 2;
                innerR = leadEdge + 3;
            }

            // 3) Weapon tip: start dumb, later replace with real offsets from heroAnimGlue
            const tip = leadEdge + 6;
            const wTipX = nx * tip;
            const wTipY = ny * tip;

            return [innerR, leadEdge, wTipX, wTipY];
        };


        console.log(">>> [arcadeCompat] installed __HeroEngineHooks.getHeroVisualInfo override");
    } catch (e) {
        console.warn("[arcadeCompat] failed to install hero visual hook", e);
    }
}


(function installHeroVisualHook() {
    try {
        const g: any = globalThis as any;
        g.__HeroEngineHooks = g.__HeroEngineHooks || {};

        const AURA_RADIUS = 2;
        const AURA_THICKNESS = 1;
        const SPACING = 1;

        function cardinalFrom(nx: number, ny: number): "up" | "down" | "left" | "right" {
            if (Math.abs(nx) >= Math.abs(ny)) return nx >= 0 ? "right" : "left";
            return ny >= 0 ? "down" : "up";
        }

        g.__HeroEngineHooks.getHeroVisualInfo = function (hero: any, nx: number, ny: number): number[] {
            const native: any = hero && hero.native;

            // 1) Try cached hero data first (fast path)
            let innerR = 0;
            let leadEdge = 0;
            try {
                innerR = (hero?.data?.visInnerR | 0) || 0;
                leadEdge = (hero?.data?.visLeadEdge | 0) || 0;
            } catch { /* ignore */ }

            // 2) If missing, compute from aura silhouette cache (true pixels)
            if ((innerR <= 0 || leadEdge <= 0) && native) {
                const dir = cardinalFrom(nx, ny);

                const baseInner = heroAnimGlue.getHeroAuraInnerRForNative(native, AURA_RADIUS);
                const baseLead = heroAnimGlue.getHeroAuraLeadForNativeDir(native, AURA_RADIUS, dir);

                if (baseInner > 0) {
                    innerR = Math.ceil(baseInner + AURA_THICKNESS + SPACING);
                    leadEdge = Math.ceil(baseLead);

                    // store onto the Arcade hero (numbers only)
                    try {
                        hero.data = hero.data || {};
                        hero.data.visInnerR = innerR;
                        hero.data.visLeadEdge = leadEdge;
                    } catch { /* ignore */ }
                }
            }

            //console.log("[hook] getHeroVisualInfo called inner/lead=", innerR, leadEdge, "dir=", nx, ny)

            // 3) Final fallback (still never breaks)
            if (innerR <= 0) innerR = 35;
            if (leadEdge <= 0) leadEdge = 32;

            // 4) Weapon tip offset (dumb for now; we’ll replace with real weapon offsets later)
            const tip = leadEdge + 6;
            const wTipX = nx * tip;
            const wTipY = ny * tip;

            return [innerR, leadEdge, wTipX, wTipY];
        };

        console.log(">>> [arcadeCompat] installed __HeroEngineHooks.getHeroVisualInfo (silhouette)");
    } catch (e) {
        console.warn("[arcadeCompat] hero visual hook install failed", e);
    }
})();



// Install immediately on module load
//__installHeroVisualInfoHookOnce();









function _hostPerfNowMs(): number {
    if (typeof performance !== "undefined" && performance.now) {
        return performance.now()
    }
    return Date.now()
}

function _hostPerfMaybeDump(nowMs: number) {
    const elapsed = nowMs - _hostPerfLastDumpMs
    if (elapsed < 1000) return
    if (_hostPerfFrameCount <= 0) {
        _hostPerfLastDumpMs = nowMs
        return
    }

    const avgTick = _hostPerfAccumTickMs / _hostPerfFrameCount
    const avgSync = _hostPerfAccumSyncMs / _hostPerfFrameCount
    const avgSnap = _hostPerfAccumSnapMs / _hostPerfFrameCount

    const fps = (_hostPerfFrameCount * 1000) / elapsed

    console.log(
        "[perf.host]",
        "fps≈", fps.toFixed(1),
        "avgTickMs≈", avgTick.toFixed(2),
        "avgSyncMs≈", avgSync.toFixed(2),
        "avgSnapMs≈", avgSnap.toFixed(2),
        "sprites≈", _hostPerfLastSpriteCount,
        "snapSprites≈", _hostPerfLastSnapshotSprites
    )

    _hostPerfLastDumpMs = nowMs
    _hostPerfFrameCount = 0
    _hostPerfAccumTickMs = 0
    _hostPerfAccumSyncMs = 0
    _hostPerfAccumSnapMs = 0
}





// MakeCode Arcade 16-color palette
// 0 is *transparent*; 15 is black
const MAKECODE_PALETTE: number[][] = [
    [0, 0, 0],         // 0 - transparent (we will not draw this)
    [255, 255, 255],   // 1 - #FFFFFF
    [255, 33, 33],     // 2 - #FF2121
    [255, 147, 196],   // 3 - #FF93C4
    [255, 129, 53],    // 4 - #FF8135
    [255, 246, 9],     // 5 - #FFF609
    [36, 156, 163],    // 6 - #249CA3
    [120, 220, 82],    // 7 - #78DC52
    [0, 63, 173],      // 8 - #003FAD
    [135, 242, 255],   // 9 - #87F2FF
    [142, 46, 196],    // 10 - #8E2EC4
    [164, 131, 159],   // 11 - #A4839F
    [92, 64, 108],     // 12 - #5C406C
    [229, 205, 196],   // 13 - #E5CDC4
    [145, 70, 61],     // 14 - #91463D
    [0, 0, 0]          // 15 - #000000
];


/* -------------------------------------------------------
   Basic helpers
------------------------------------------------------- */

export function syncHeroAuraForNative(
  native: Phaser.GameObjects.Sprite,
  auraActive: boolean,
  auraColorIndex: number
)


function randint(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Extend Math with idiv
interface Math {
    idiv(a: number, b: number): number;
}
(Math as any).idiv = (a: number, b: number): number => (a / b) | 0;


interface Math {
    randomRange(min: number, max: number): number;
}

(Math as any).randomRange = (min: number, max: number): number =>
    Math.floor(Math.random() * (max - min + 1)) + min;



// Debug helpers
function dumpImagePixels(tag: string, img: Image) {
    if (!img) {
        console.log(`[IMG-DUMP] ${tag} <no image>`);
        return;
    }

    const w = img.width;
    const h = img.height;
    console.log(`[IMG-DUMP] ${tag} w=${w} h=${h}`);

    for (let y = 0; y < h; y++) {
        const row: number[] = [];
        for (let x = 0; x < w; x++) {
            // MAKECODE: palette index 0–15
            const p = img.getPixel(x, y);
            row.push(p);
        }
        console.log(row.join(" "));
    }
}













/* -------------------------------------------------------
   Image + image namespace
------------------------------------------------------- */

class Image {
    width: number;
    height: number;
    // simple RGBA-less pixel buffer: palette index per pixel
    private _pixels: Uint8Array;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this._pixels = new Uint8Array(width * height);
    }

    private idx(x: number, y: number): number {
        return y * this.width + x;
    }

    fill(color: number): void {
        this._pixels.fill(color & 0xff);
    }

    fillRect(x: number, y: number, w: number, h: number, color: number): void {
        const c = color & 0xff;
        for (let yy = y; yy < y + h; yy++) {
            if (yy < 0 || yy >= this.height) continue;
            for (let xx = x; xx < x + w; xx++) {
                if (xx < 0 || xx >= this.width) continue;
                this._pixels[this.idx(xx, yy)] = c;
            }
        }
    }




    getPixel(x: number, y: number): number {
        if (
            x < 0 ||
            y < 0 ||
            x >= this.width ||
            y >= this.height
        ) {
            return 0;
        }

        const v = this._pixels[this.idx(x, y)];
        // After fixing parseMakeCodeImage, v should already be 0..15
        // but we'll still be defensive and treat <0 as transparent.
        return v < 0 ? 0 : v;
    }





    setPixel(x: number, y: number, color: number): void {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        this._pixels[this.idx(x, y)] = color & 0xff;
    }


        // MakeCode compatibility: draw a line between two points
    drawLine(x0: number, y0: number, x1: number, y1: number, color: number): void {
        const c = color & 0xff;

        let dx = Math.abs(x1 - x0);
        let sx = x0 < x1 ? 1 : -1;
        let dy = -Math.abs(y1 - y0);
        let sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;

        while (true) {
            this.setPixel(x0, y0, c);

            if (x0 === x1 && y0 === y1) break;

            const e2 = 2 * err;
            if (e2 >= dy) {
                err += dy;
                x0 += sx;
            }
            if (e2 <= dx) {
                err += dx;
                y0 += sy;
            }
        }
    }





    // Very crude text printing; can be improved later.
    print(text: string, x: number, y: number, color: number, font: image.Font): void {
        // TODO: implement proper bitmap font rendering.
        // For now, no-op for compile; HeroEngine logic won’t break.
    }



    
    // --- NEW: helpers for network serialization ------------------

    /** Return a plain JS array of palette indices for JSON / network */
    toJSONPixels(): number[] {
        return Array.from(this._pixels);
    }




    /** Copy a plain JS array of palette indices back into this image */

    fromJSONPixels(pixels: number[]): void {
        if (!pixels) return;

        const n = Math.min(this._pixels.length, pixels.length);

        for (let i = 0; i < n; i++) {
            let v = pixels[i] | 0;

            // Make sure we never store out-of-range palette indices.
            // 0..15 are valid; anything else → treat as 0 (transparent).
            if (v < 0 || v > 15) v = 0;

            this._pixels[i] = v;
        }
    }




    /** Convenience: create an Image from serialized data */
    static fromJSON(width: number, height: number, pixels: number[]): Image {
        const img = new Image(width, height);
        img.fromJSONPixels(pixels);
        return img;
    }


}






namespace image {
    export class Font {
        charWidth: number;
        charHeight: number;
        constructor(w: number, h: number) {
            this.charWidth = w;
            this.charHeight = h;
        }
    }

    // Simple default fonts
    export const font5 = new Font(4, 6);
    export const font8 = new Font(6, 8);

    export function create(width: number, height: number): Image {
        return new Image(width, height);
    }

    export function getFontForText(_text: string): Font {
        // Simple heuristic stub: just return font8.
        return font8;
    }

    export function scaledFont(base: Font, scale: number): Font {
        // NOTE: MakeCode returns a scaled font; we just fudge for now.
        return new Font(base.charWidth * scale, base.charHeight * scale);
    }
}


/* -------------------------------------------------------
   MakeCode img`` tagged template shim
------------------------------------------------------- */

function imgOLD(strings: TemplateStringsArray, ...expr: any[]): Image {
    // Turn the MakeCode ASCII image literal into an Image instance.
    // STEP 1: read raw text
    const raw = strings.join("");
    const lines = raw
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 0);

    // STEP 2: determine width & height
    const height = lines.length;
    const width = Math.max(...lines.map(l => l.length));

    const im = new Image(width, height);

    // STEP 3: naive fill — actual   comes later
    // Right now: treat '.' as 0, anything else as 1
    for (let y = 0; y < height; y++) {
        const row = lines[y];
        for (let x = 0; x < row.length; x++) {
            const ch = row[x];
            // TODO: full MakeCode palette parsing later
            if (ch === "." || ch === " ") im.setPixel(x, y, 0);
            else im.setPixel(x, y, 1);
        }
    }

    return im;
}



function parseMakeCodeImage(lit: TemplateStringsArray): Image {
    const raw = lit[0]
        .trim()
        .replace(/\r/g, "");

    const rows = raw
        .split("\n")
        .map(r => r.trim())
        .filter(r => r.length > 0);

    const height = rows.length;

    // PARSE EACH ROW TO A LIST OF PIXEL TOKENS
    const pixelRows: string[][] = [];

    for (const row of rows) {
        let tokens: string[] = [];

        if (row.includes(" ")) {
            // FORMAT A: space-separated
            tokens = row.split(/\s+/);
        } else {
            // FORMAT B: compact format – split into individual chars
            tokens = row.split("");
        }

        pixelRows.push(tokens);
    }

    // WIDTH = max row width (MakeCode allows uneven rows)
    const width = Math.max(...pixelRows.map(r => r.length));

    const img = new Image(width, height);

    // Fill via setPixel so we stay in 0..15 and keep Uint8Array
    for (let y = 0; y < height; y++) {
        const row = pixelRows[y];
        for (let x = 0; x < width; x++) {
            const c = row[x];

            if (!c || c === ".") {
                // transparent
                img.setPixel(x, y, 0);
            } else {
                const val = parseInt(c, 16);
                // Clamp to 0..15 (MakeCode 16-color palette)
                const color = isNaN(val) ? 0 : Math.max(0, Math.min(15, val | 0));
                img.setPixel(x, y, color);
            }
        }
    }

    return img;
}








/* -------------------------------------------------------
   MakeCode Math.constrain shim
------------------------------------------------------- */

;(Math as any).constrain = function (v: number, min: number, max: number): number {
    if (v < min) return min;
    if (v > max) return max;
    return v;
};




// -------------------------------------------------------
// Polyfill for MakeCode's Array.removeAt(index)
// JS Array doesn't have this; we add a compatible version.
// -------------------------------------------------------
if (!(Array.prototype as any).removeAt) {
    (Array.prototype as any).removeAt = function (index: number) {
        // MakeCode coerces index to int and ignores out-of-range.
        index = index | 0;
        if (index < 0 || index >= this.length) return undefined;

        const removed = this.splice(index, 1);
        return removed.length ? removed[0] : undefined;
    };
}






/* -------------------------------------------------------
   SpriteKind + flags + Sprite
------------------------------------------------------- */

namespace SpriteKind {
    let _next = 10;
    export const Player = 1;
    export const Enemy = 2;
    export function create(): number {
        return _next++;
    }
    // Your game / extensions will add:
    export let Hero: number;
    export let HeroWeapon: number;
    export let HeroAura: number;
    export let EnemySpawner: number;
    export let SupportBeam: number;
    export let SupportIcon: number;
    export let Text: number;
    export let StatusBar: number;
}



// 1) Keep SpriteFlag as bitmasks:
enum SpriteFlag {
    Ghost = 1 << 0,
    RelativeToCamera = 1 << 1,
    AutoDestroy = 1 << 2,
    Invisible = 1 << 3,
    Destroyed = 1 << 4
}




const enum CollisionDirection {
    Top,
    Bottom,
    Left,
    Right
}

class Sprite {
    // NEW: unique id per sprite
    private static _nextId = 1;
    id: number;
    
    x: number = 0;
    y: number = 0;
    vx: number = 0;
    vy: number = 0;
    z: number = 0;


    image: Image;

    // MakeCode compatibility: width/height mirror the image dimensions
    get width(): number {
        return this.image ? this.image.width : 0;
    }

    get height(): number {
        return this.image ? this.image.height : 0;
    }


    // 🔧 NEW: MakeCode compatibility helper
    setPosition(x: number, y: number): void {
        this.x = x;
        this.y = y;
        // We let _syncNativeSprites() push this into Phaser each frame.
    }

    kind: number = SpriteKind.Player;




    flags: number = 0;
    data: { [key: string]: any } = {};
    lifespan: number = 0;
    // Used by status-bars/text.ts:
    followPadding: number = 0;
    
    // NEW: link to a Phaser display object
    native: any = null;

    constructor(img: Image, kind: number) {
        this.id = Sprite._nextId++;  // 🔴 this was missing

        this.image = img;
        this.kind = kind;

        // Debug: prove IDs are being assigned
//        if (this.id <= 20) {
//            console.log(
//                "[Sprite.constructor] created sprite",
//                "id=", this.id,
//                "kind=", this.kind,
//                "img w,h=", img.width, img.height
//            );
//        }
    }







    setFlag(flag: number, on: boolean): void {
        if (DEBUG_SETFLAG && _setFlagLogCount < 20) {
            console.log(
                "[Sprite.setFlag]",
                "id", this.id,
                "flag", flag,
                "on", on,
                "flagsBefore", this.flags,
                "typeof flags", typeof this.flags
            );
            _setFlagLogCount++;
        }

        // Ensure flags is a numeric bitmask
        if (typeof this.flags !== "number") {
            this.flags = Number(this.flags) || 0;
        }

        // Bitmask semantics: SpriteFlag values are ALREADY masks
        if (on) {
            this.flags |= flag;      // <- no extra shift
        } else {
            this.flags &= ~flag;     // <- clear that mask
        }
    }

    isFlagSet(flag: number): boolean {
        if (typeof this.flags !== "number") return false;
        return !!(this.flags & flag); // <- direct mask check
    }

    setImage(img: Image): void {
        // Just update the MakeCode image reference.
        // The compat layer (_syncNativeSprites + _attachNativeSprite)
        // will see this.image and push pixels into Phaser on its own.
        this.image = img;
    }



    setKind(kind: number): void {
        this.kind = kind;
    }


destroy(effect?: number, durationMs?: number): void {
    // Mark the sprite as destroyed; the compat layer will
    // do the actual cleanup of native/texture/etc.
    this.flags |= SpriteFlag.Destroyed;
    this._destroyed = true;
}



    startEffect(effect: number, durationMs: number): void {
        // TODO: hook into Phaser particles / tweens later.
        // No-op for now.
    }

    // Simple bounding-box helpers for status-bars.
    get top(): number {
        return this.y - (this.image?.height ?? 0) / 2;
    }
    set top(v: number) {
        const h = this.image?.height ?? 0;
        this.y = v + h / 2;
    }

    get bottom(): number {
        return this.y + (this.image?.height ?? 0) / 2;
    }
    set bottom(v: number) {
        const h = this.image?.height ?? 0;
        this.y = v - h / 2;
    }

    get left(): number {
        return this.x - (this.image?.width ?? 0) / 2;
    }
    set left(v: number) {
        const w = this.image?.width ?? 0;
        this.x = v + w / 2;
    }

    get right(): number {
        return this.x + (this.image?.width ?? 0) / 2;
    }
    set right(v: number) {
        const w = this.image?.width ?? 0;
        this.x = v - w / 2;
    }

    // internal destroyed flag – not part of MakeCode API but handy.
    _destroyed: boolean = false;
}




/* -------------------------------------------------------
   sprites namespace – creation, projectile, data, events
------------------------------------------------------- */

namespace sprites {
    export const Flag = SpriteFlag;
    const _allSprites: Sprite[] = [];

    export function _registerExternalSprite(s: Sprite): void {
        if (_allSprites.indexOf(s) < 0) _allSprites.push(s);
    }


    // Expose internal sprite list for netWorld snapshots (read-only)
    export function _getAllSprites(): Sprite[] {
        return _allSprites;
    }

    // Ensure a sprite exists with a specific id/kind/size.
    // Used by netWorld.apply on followers to materialize host-only sprites
    // (e.g., new enemies, projectiles).
    export function _ensureSpriteWithId(
        id: number,
        kind: number,
        width: number,
        height: number
    ): Sprite {
        // Try to find an existing sprite first
        for (const s of _allSprites) {
            if (s && s.id === id) return s;
        }

        // Create a placeholder image of the right size
        const img = image.create(Math.max(1, width | 0), Math.max(1, height | 0));
        const s = new Sprite(img, kind);

        // Force the id to match host's id and bump global nextId if needed
        (s as any).id = id;
        const spriteClass: any = Sprite as any;
        if (typeof spriteClass._nextId === "number" && spriteClass._nextId <= id) {
            spriteClass._nextId = id + 1;
        }

        _allSprites.push(s);

        if (DEBUG_SPRITE_ATTACH || _attachCallCount <= MAX_ATTACH_VERBOSE) {
            console.log(
                "[sprites._ensureSpriteWithId] created",
                "id", s.id,
                "| kind", kind,
                "| w,h", img.width, img.height
            );
        }

        return s;
    }



    // Expose internal sprite list for netWorld snapshots (read-only)
    export function _getAllSprites(): Sprite[] {
        return _allSprites;
    }


    // ---- DEBUG CONTROLS ----
    let _syncCallCount = 0;
    let _attachCallCount = 0;


    const MAX_SYNC_VERBOSE = 5;       // fully log first 60 frames
    const SYNC_EVERY_N_AFTER = 300;   // then log every 300th frame
    const SPRITE_SYNC_LOG_MOD = 300;   // log every 300th frame *after* that

    const MAX_ATTACH_VERBOSE = 2;    // log first 20 sprite attach attempts
    const DEBUG_SPRITE_ATTACH = false; // master switch for attach logging

    const DEBUG_PROJECTILE_NATIVE = false;  // flip off when done debugging


    const DEBUG_NET_SNAPSHOT = false;  // master switch for per-snapshot logs


    // Extra per-sprite pixel introspection (second full scan per sprite).
    // Leave this false for normal play; turn on only when debugging pixel issues.
    const DEBUG_SPRITE_PIXELS = false;







    // ---- EXTRA DEBUG FOR PIXEL SHAPES / AURAS / PROJECTILES ----

    // Master switch
    //const DEBUG_SPRITE_PIXELS = false;

    // If true, log *everything* (ignores per-role toggles & limits)
    const DEBUG_SPRITE_PIXELS_ALL = false;

    // Per-role toggles
    // Turn HERO/ENEMY off so you can see PROJECTILE/AURA noise-free.
    const DEBUG_ROLE_HERO        = false;
    const DEBUG_ROLE_ENEMY       = false;
    const DEBUG_ROLE_PROJECTILE  = false;
    const DEBUG_ROLE_AURA        = false;
    const DEBUG_ROLE_ACTOR       = false;  // generic combat actors (if not clearly hero/enemy)
    const DEBUG_ROLE_OTHER       = false;

    // Per-role log limits (so even when enabled, they don't spam forever)
    const ROLE_LOG_LIMITS: { [role: string]: number } = {
        HERO:       10,
        ENEMY:      10,
        PROJECTILE: 200,
        AURA:       200,
        ACTOR:      20,
        OTHER:      10
    };

    const _roleLogCount: { [role: string]: number } = {};

    // Cache kind → name mapping at runtime using global SpriteKind
    let _kindNameCache: { [k: string]: string } | null = null;
    function _getSpriteKindName(kind: number): string {
        if (!_kindNameCache) {
            _kindNameCache = {};
            try {
                const SK = (globalThis as any).SpriteKind;
                if (SK && typeof SK === "object") {
                    for (const name in SK) {
                        const val = (SK as any)[name];
                        if (typeof val === "number") {
                            _kindNameCache[String(val)] = name;
                        }
                    }
                }
            } catch { /* ignore */ }
        }
        if (!_kindNameCache) return String(kind);
        return _kindNameCache[String(kind)] || String(kind);
    }

    
    // Classify a sprite into rough "roles" using kind + data flags
    function _classifySpriteRole(kind: number, dataKeys: string[]): string {
        const kindName = _getSpriteKindName(kind);

        // Direct kind-name checks first
        if (kindName === "HeroAura" || kindName.indexOf("Aura") >= 0) return "AURA";
        if (kindName === "HeroWeapon" || kindName.indexOf("Weapon") >= 0) return "PROJECTILE";
        if (kindName === "Player" || kindName === "Hero") return "HERO";
        if (kindName.indexOf("Enemy") >= 0) return "ENEMY";

        // Use data flags as heuristics (engine-specific)
        if (dataKeys.indexOf("maxHp") >= 0 && dataKeys.indexOf("hp") >= 0) {
            // Could be hero or enemy – but definitely a combat actor
            return "ACTOR";
        }
        if (
            dataKeys.indexOf("MOVE_TYPE") >= 0 ||
            dataKeys.indexOf("HERO_INDEX") >= 0 ||
            dataKeys.indexOf("DAMAGE") >= 0 ||
            dataKeys.indexOf("dashEndMs") >= 0
        ) {
            return "PROJECTILE";
        }

        return "OTHER";
    }


function _classifySpriteRole(kind: number, dataKeys: string[]): string {
    const kindName = _getSpriteKindName(kind);

    // Direct kind-name checks first
    if (kindName === "HeroAura" || kindName.indexOf("Aura") >= 0) return "AURA";
    if (kindName === "HeroWeapon" || kindName.indexOf("Weapon") >= 0) return "PROJECTILE";
    if (kindName === "Player" || kindName === "Hero") return "HERO";
    if (kindName.indexOf("Enemy") >= 0) return "ENEMY";

    // Use data flags as heuristics (engine-specific)
    if (dataKeys.indexOf("maxHp") >= 0 && dataKeys.indexOf("hp") >= 0) {
        // Could be hero or enemy – but definitely a combat actor
        return "ACTOR";
    }
    if (
        dataKeys.indexOf("MOVE_TYPE") >= 0 ||
        dataKeys.indexOf("HERO_INDEX") >= 0 ||
        dataKeys.indexOf("DAMAGE") >= 0 ||
        dataKeys.indexOf("dashEndMs") >= 0
    ) {
        return "PROJECTILE";
    }

    return "OTHER";
}


    // NEW: tiny helper to recognize real heroes based on kind + data keys
    function isHeroSprite(s: Sprite): boolean {
        const kind = (s.kind as number) || 0;
        const dataKeys = Object.keys((s as any).data || {});
        const role = _classifySpriteRole(kind, dataKeys);

        if (role === "HERO") return true;

        // Belt-and-suspenders: hero-specific identity keys
        if (dataKeys.indexOf("heroName") >= 0) return true;
        if (dataKeys.indexOf("heroFamily") >= 0) return true;

        return false;
    }


    function _shouldLogSprite(kind: number, dataKeys: string[]): boolean {
        if (!DEBUG_SPRITE_PIXELS) return false;
        if (DEBUG_SPRITE_PIXELS_ALL) return true;

        const role = _classifySpriteRole(kind, dataKeys);

        let enabled = false;
        switch (role) {
            case "HERO":       enabled = DEBUG_ROLE_HERO;       break;
            case "ENEMY":      enabled = DEBUG_ROLE_ENEMY;      break;
            case "PROJECTILE": enabled = DEBUG_ROLE_PROJECTILE; break;
            case "AURA":       enabled = DEBUG_ROLE_AURA;       break;
            case "ACTOR":      enabled = DEBUG_ROLE_ACTOR;      break;
            default:           enabled = DEBUG_ROLE_OTHER;      break;
        }
        if (!enabled) return false;

        const limit = ROLE_LOG_LIMITS[role] ?? Infinity;
        const current = _roleLogCount[role] || 0;
        if (current >= limit) return false;

        _roleLogCount[role] = current + 1;
        return true;
    }




    /**
     * Log the non-zero pixel mask of a sprite's current image:
     *  - width/height
     *  - count of non-zero pixels
     *  - bounding box of non-zero area
     *  - role (HERO, ENEMY, PROJECTILE, AURA, etc.)
     *  - data keys attached (for HERO_DATA / PROJ_DATA debugging)
     */



    // Purely for debugging pixel shapes / bounds.
    // Called only when DEBUG_SPRITE_PIXELS is true.
    function _debugSpritePixels(s: Sprite, label: string): number {
        const img = s.image as any;
        if (!img) {
            console.log(`[PIXELS] ${label} id=${s.id} kind=${s.kind} NO IMAGE`);
            return 0;
        }

        const w = img.width | 0;
        const h = img.height | 0;
        console.log(`[PIXELS] ${label} id=${s.id} kind=${s.kind} w=${w} h=${h}`);

        let nonZero = 0;

        for (let y = 0; y < h; y++) {
            let row = "";
            for (let x = 0; x < w; x++) {
                const p = img.getPixel(x, y); // 0..15
                if (p !== 0) nonZero++;

                row += p === 0 ? "." : p.toString(16);
            }
            console.log(`[PIXELS] ${label} id=${s.id} y=${y}: ${row}`);
        }

        return nonZero;
    }







    type OverlapHandler = (a: Sprite, b: Sprite) => void;
    type DestroyHandler = (s: Sprite) => void;

    const _overlapHandlers: { a: number; b: number; handler: OverlapHandler }[] = [];
    const _destroyHandlers: { kind: number; handler: DestroyHandler }[] = [];

    let _debugFirstPlaced = false;

    // ... your _attachNativeSprite comes next ...



// Mirror hero identity + phase/dir from the Arcade Sprite onto the Phaser native sprite.
function _copyHeroIdentityToNative(
    s: Sprite,
    native: Phaser.GameObjects.Sprite
): void {
    const dataAny: any = (s as any).data || {};

    const heroName   = dataAny.heroName;
    const heroFamily = dataAny.heroFamily;
    const phase      = dataAny.phase;
    const dir        = dataAny.dir;

    if (typeof heroName === "string" && heroName) {
        native.setData("heroName", heroName);
    }
    if (typeof heroFamily === "string" && heroFamily) {
        native.setData("heroFamily", heroFamily);
    }

    // Ensure phase/dir always exist with safe defaults
    native.setData(
        "phase",
        (typeof phase === "string" && phase) ? phase : "idle"
    );
    native.setData(
        "dir",
        (typeof dir === "string" && dir) ? dir : "down"
    );
}




// Try to apply hero animation for a hero-native sprite.
// - Only runs if heroAtlas is present in the scene registry.
// - Only calls glue when phase/dir changed since last sync (or first time).
function _tryApplyHeroAnimationForNative(
    s: Sprite,
    native: Phaser.GameObjects.Sprite
): void {
    const scene: any = native.scene;
    if (!scene || !scene.registry) return;

    const atlas = scene.registry.get("heroAtlas");
    if (!atlas) {
        if (!_heroAnimNoAtlasLogged) {
            console.log("[heroAnim] heroAtlas not yet available; skipping hero animation for now");
            _heroAnimNoAtlasLogged = true;
        }
        return;
    }




    const dataAny: any = (s as any).data || {};
    const curPhase = (typeof dataAny.phase === "string" && dataAny.phase) ? dataAny.phase : "idle";
    const curDir   = (typeof dataAny.dir   === "string" && dataAny.dir)   ? dataAny.dir   : "down";
    const curFam   = (typeof dataAny.heroFamily === "string" && dataAny.heroFamily)
        ? dataAny.heroFamily
        : "";

    const LAST_PHASE_SYNC_KEY  = "__heroLastPhaseSync";
    const LAST_DIR_SYNC_KEY    = "__heroLastDirSync";
    const LAST_FAMILY_SYNC_KEY = "__heroLastFamilySync";

    const prevPhase = native.getData
        ? (native.getData(LAST_PHASE_SYNC_KEY) as string | undefined)
        : undefined;
    const prevDir = native.getData
        ? (native.getData(LAST_DIR_SYNC_KEY) as string | undefined)
        : undefined;
    const prevFam = native.getData
        ? (native.getData(LAST_FAMILY_SYNC_KEY) as string | undefined)
        : undefined;

    const isFirst = prevPhase === undefined && prevDir === undefined && prevFam === undefined;
    const changed = isFirst ||
        curPhase !== prevPhase ||
        curDir   !== prevDir   ||
        curFam   !== prevFam;

    if (!changed) return;

    if (native.setData) {
        native.setData(LAST_PHASE_SYNC_KEY,  curPhase);
        native.setData(LAST_DIR_SYNC_KEY,    curDir);
        native.setData(LAST_FAMILY_SYNC_KEY, curFam);
    }






    if (native.setData) {
        native.setData(LAST_PHASE_SYNC_KEY, curPhase);
        native.setData(LAST_DIR_SYNC_KEY,   curDir);
    }

    const glueAny: any = (globalThis as any).heroAnimGlue || heroAnimGlue;

    if (glueAny && typeof glueAny.tryApplyHeroAnimation === "function") {
        glueAny.tryApplyHeroAnimation(native);
    } else if (glueAny && typeof glueAny.applyHeroAnimationForSprite === "function") {
        glueAny.applyHeroAnimationForSprite(native);
    }
}




function _attachNativeSprite(s: Sprite): void {
    const sc: Phaser.Scene = (globalThis as any).__phaserScene;
    _attachCallCount++;

    const tA0 = _hostPerfNowMs();

    if (!sc) {
        if (_attachCallCount <= MAX_ATTACH_VERBOSE) {
            console.log("[_attachNativeSprite] NO SCENE — skipping for sprite", s.id);
        }
        return;
    }

    if (!s.image) {
        if (_attachCallCount <= MAX_ATTACH_VERBOSE) {
            console.log("[_attachNativeSprite] sprite has NO image", s);
        }
        _frameAttachEarlyOutCount++;
        return;
    }

    const w = s.image.width | 0;
    const h = s.image.height | 0;
    const texKey = "sprite_" + s.id;

    // --- HERO NATIVE SKIP PATH -------------------------------------------
    // Real heroes skip the pixel-upload path entirely and use a shared
    // 64x64 placeholder texture + Sprite, so heroAnimGlue can later
    // take over visuals from heroAtlas.
    const isHero = isHeroSprite(s);

    if (isHero) {
        const HERO_PLACEHOLDER_TEX_KEY = "__heroPlaceholder64";

        // Ensure we have a shared 64x64 canvas texture for hero placeholders.
        let heroTex = sc.textures.exists(HERO_PLACEHOLDER_TEX_KEY)
            ? (sc.textures.get(HERO_PLACEHOLDER_TEX_KEY) as Phaser.Textures.CanvasTexture)
            : null;

        if (!heroTex) {
            heroTex = sc.textures.createCanvas(HERO_PLACEHOLDER_TEX_KEY, 64, 64);
            const ctxHero = heroTex.context;
            if (ctxHero) {
                ctxHero.clearRect(0, 0, 64, 64);

                // Simple white outline so we can see something.
                ctxHero.strokeStyle = "#ffffff";
                ctxHero.lineWidth = 2;
                ctxHero.strokeRect(1, 1, 62, 62);
            }
            heroTex.refresh();
        }

        let native: any = s.native;


        if (!native) {
            // Create a real Sprite (not Image) so animations will work later.
            native = sc.add.sprite(s.x, s.y, HERO_PLACEHOLDER_TEX_KEY);
            native.setOrigin(0.5, 0.5);
            native.setData("isHeroNative", true);

            // NEW: mirror hero identity + phase/dir onto the native sprite
            _copyHeroIdentityToNative(s, native);

            // NEW: on first attach, try to apply hero animation
            _tryApplyHeroAnimationForNative(s, native);

            s.native = native;

            if (_attachCallCount <= MAX_ATTACH_VERBOSE) {
                console.log(
                    "[WRAP-NATIVE] create hero-native sprite",
                    "| id", s.id,
                    "| kind", s.kind,
                    "| texKey", HERO_PLACEHOLDER_TEX_KEY,
                    "| native.width", native.width,
                    "| native.height", native.height
                );
            }
        } else {
            // Keep native hero sprite in sync with Arcade sprite position.
            native.setPosition(s.x, s.y);

            // NEW: keep hero identity + phase/dir in sync on reuse
            _copyHeroIdentityToNative(s, native);

            // NEW: on first attach, try to apply hero animation
            _tryApplyHeroAnimationForNative(s, native);
        }



        // For visibility logic that uses nonZero pixels, just mark as non-empty.
        (s as any)._lastNonZeroPixels = 1;

        const tA1 = _hostPerfNowMs();
        _frameAttachMsAccum += (tA1 - tA0);
        _frameAttachUpdateCount++; // treat as "update" for stats
        return;
    }
    // ---------------------------------------------------------------------


    // If this sprite's native is already using a non-MakeCode texture
    // (e.g., an LPC spritesheet like "bee" or "imp blue"),
    // skip the pixel-upload path and just keep its position in sync elsewhere.
    const existingNative: any = s.native;
    if (
        existingNative &&
        existingNative.texture &&
        existingNative.texture.key &&
        existingNative.texture.key !== texKey
    ) {
        existingNative.x = s.x;
        existingNative.y = s.y;
        return;
    }




    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
        console.error(
            "[_attachNativeSprite] INVALID image size – skipping texture",
            "spriteId=", s.id,
            "kind=", s.kind,
            "w=", w,
            "h=", h,
            "image=", s.image
        );
        _frameAttachEarlyOutCount++;
        return;
    }

    if (_attachCallCount <= MAX_ATTACH_VERBOSE) {
        console.log(
            "[_attachNativeSprite] START",
            "spriteId=", s.id,
            "w,h=", w, h,
            "pixelsLen=", w * h,
        );


   }



    // --- TEXTURE HANDLING -------------------------------------------------
    const tTex0 = _hostPerfNowMs();

    let tex = sc.textures.exists(texKey)
        ? (sc.textures.get(texKey) as Phaser.Textures.CanvasTexture)
        : null;

    // If a texture exists but its size doesn't match the MakeCode image, destroy it
    if (tex) {
        const src = tex.source[0];
        const texW = src.width | 0;
        const texH = src.height | 0;

        if (texW !== w || texH !== h) {
            if (DEBUG_WRAP_TEX) {
                console.log(
                    "[WRAP-TEX-RECREATE]",
                    "| id", s.id,
                    "| old tex w,h", texW, texH,
                    "| new img w,h", w, h
                );
            }
            sc.textures.remove(texKey);
            tex = null;
        }
    }

    // (Re)create texture with the correct size
    if (!tex) {
        tex = sc.textures.createCanvas(texKey, w, h);

        if (DEBUG_WRAP_TEX && _attachCallCount <= MAX_ATTACH_VERBOSE) {
            console.log(
                "[WRAP-TEX-CREATE]",
                "| id", s.id,
                "| texKey", texKey,
                "| tex w,h", tex.source[0].width, tex.source[0].height
            );
        }
    }

    const tTex1 = _hostPerfNowMs();
    _frameAttachTexMs += (tTex1 - tTex0);





    // --- PIXEL UPLOAD -----------------------------------------------------

    // Now tex is guaranteed to have width/height == image width/height
    const ctx = tex.context;
    if (!ctx) {
        console.error("[_attachNativeSprite] no 2D context for", texKey);
        _frameAttachEarlyOutCount++;
        return;
    }

    const tPix0 = _hostPerfNowMs();

    ctx.clearRect(0, 0, w, h);

    const pixelsLen = w * h;
    const imgData = ctx.createImageData(w, h);
    const palette = MAKECODE_PALETTE as number[][];

    let nonZero = 0;

    for (let i = 0; i < pixelsLen; i++) {
        const x = i % w;
        const y = (i / w) | 0;
        const idx = i * 4;

        const p = s.image.getPixel(x, y); // 0..15 palette index

        // Treat 0 as transparent, like Arcade
        if (p <= 0) {
            imgData.data[idx + 0] = 0;
            imgData.data[idx + 1] = 0;
            imgData.data[idx + 2] = 0;
            imgData.data[idx + 3] = 0;
            continue;
        }

        const color = palette[p];
        if (!color) {
            if (_attachCallCount <= MAX_ATTACH_VERBOSE) {
                console.error(
                    "[_attachNativeSprite] BAD PALETTE INDEX",
                    "spriteId=", s.id,
                    "kind=", s.kind,
                    "img w,h=", w, h,
                    "pixelsLen=", pixelsLen,
                    "i=", i,
                    "x=", x,
                    "y=", y,
                    "p=", p,
                    "paletteLength=", palette.length
                );
            }
            imgData.data[idx + 0] = 0;
            imgData.data[idx + 1] = 0;
            imgData.data[idx + 2] = 0;
            imgData.data[idx + 3] = 0;
            continue;
        }

        const [r, g, b] = color;
        imgData.data[idx + 0] = r;
        imgData.data[idx + 1] = g;
        imgData.data[idx + 2] = b;
        imgData.data[idx + 3] = 255;

        nonZero++;
    }

    // Cache for visibility logic (projectile/overlay auto-hide, etc.)
    (s as any)._lastNonZeroPixels = nonZero;

    ctx.putImageData(imgData, 0, 0);
    tex.refresh();

    const tPix1 = _hostPerfNowMs();
    _frameAttachPixelMs += (tPix1 - tPix0);











    // --- NATIVE IMAGE / SPRITE HANDLING --------------------------------------------

    // If a native already exists but its size changed, destroy it so we can recreate.
    if (s.native) {
        const n: any = s.native;
        const nativeW = n.width | 0;
        const nativeH = n.height | 0;

        if (nativeW !== w || nativeH !== h) {
            if (DEBUG_WRAP_TEX) {
                console.log(
                    "[WRAP-NATIVE-RECREATE]",
                    "| id", s.id,
                    "| old native w,h", nativeW, nativeH,
                    "| new img w,h", w, h
                );
            }
            n.destroy();
            s.native = undefined as any;
        }
    }

    let native = s.native as any;
    let didCreate = false;

    if (!native) {
        // Decide whether this should be an animatable Sprite or a simple Image.
        const role = _classifySpriteRole((s.kind as number) || 0, Object.keys((s as any).data || {}));
        const isEnemyLike = (role === "ENEMY" || role === "ACTOR");

        // For enemies/actors, use Sprite so LPC animations can run.
        const n = isEnemyLike
            ? sc.add.sprite(s.x, s.y, texKey)
            : sc.add.image(s.x, s.y, texKey);

        n.setOrigin(0.5, 0.5);
        s.native = n;
        native = n;
        didCreate = true;

        if (_attachCallCount <= MAX_ATTACH_VERBOSE) {
            console.log(
                isEnemyLike ? "[WRAP-NATIVE] create enemy sprite" : "[WRAP-NATIVE] create sprite",
                "| id", s.id,
                "| kind", s.kind,
                "| texKey", texKey,
                "| native.width", n.width,
                "| native.height", n.height
            );
        }
    } else {
        // Keep native in sync with Arcade sprite position.
        native.setPosition(s.x, s.y);
    }

    // We already computed nonZero in the main upload loop.
    let nonZeroAttach = (s as any)._lastNonZeroPixels as number;

    if (DEBUG_SPRITE_PIXELS) {
        nonZeroAttach = _debugSpritePixels(s, "attach#" + _attachCallCount);
        (s as any)._lastNonZeroPixels = nonZeroAttach;
    }

    if (DEBUG_PROJECTILE_NATIVE && native) {
        const dataKeys2 = Object.keys((s as any).data || {});
        const kind = s.kind as number | undefined;
        const kindName = kind === undefined ? "undefined" : _getSpriteKindName(kind);
        const role2 = _classifySpriteRole(kind || 0, dataKeys2);

        if (role2 === "PROJECTILE") {
            console.log(
                "[WRAP-NATIVE] create projectile",
                "| id", s.id,
                "| kind", kind, `(${kindName})`,
                "| texKey", texKey,
                "| x,y", s.x, s.y,
                "| z", s.z,
                "| visible", native.visible,
                "| img w,h", w, h,
                "| nonZeroAttach", nonZeroAttach
            );
        }
    }

    const tA1 = _hostPerfNowMs();
    _frameAttachMsAccum += (tA1 - tA0);

    if (didCreate) _frameAttachCreateCount++;
    else _frameAttachUpdateCount++;
}


//
//
//
// This is the end of attachNativeSprite
//
//
//
//





        // NEW: simple physics integrator – apply vx,vy to x,y
    export function _physicsStep(dtSeconds: number): void {
        if (!dtSeconds || dtSeconds <= 0) return;

        for (const s of _allSprites) {
            if (!s || (s as any)._destroyed) continue;
            if (!s.vx && !s.vy) continue;

            s.x += s.vx * dtSeconds;
            s.y += s.vy * dtSeconds;
        }
    }




    export function create(img: Image, kind?: number): Sprite {
        // Mimic MakeCode Arcade:
        //  - if kind is omitted/undefined, default to SpriteKind.Player
        //  - otherwise use the provided kind
        let finalKind: number;
        if (typeof kind === "number") {
            finalKind = kind;
        } else {
            finalKind = SpriteKind.Player;
        }

        const s = new Sprite(img, finalKind);
        _allSprites.push(s);

        // Optional: creation log (ties into the kind-name helper)
        if (DEBUG_SPRITE_ATTACH || _attachCallCount <= MAX_ATTACH_VERBOSE) {
            console.log(
                "[sprites.create]",
                "id", s.id,
                "| argKind", kind,
                "| finalKind", finalKind, "(" + _getSpriteKindName(finalKind) + ")",
                "| w,h", img?.width, img?.height
            );
        }


        
    // Optional extra pixel-debug scan (second full pass) – gated.
    if (DEBUG_SPRITE_PIXELS) {
        const nonZeroCreate = _debugSpritePixels(s, "create");
        (s as any)._lastNonZeroPixels = nonZeroCreate;
    }


        
        // AFTER you've counted nonZero pixels for s.image
        if (s.kind === 12 && nonZeroCreate === 0 && s.native) {
            console.log(`[AURA] id=${s.id} image went fully blank -> hiding native sprite`);
            s.native.visible = false;
            return; // don't reattach a texture for an empty image
        }



        _attachNativeSprite(s);
        return s;
    }






    export function createProjectileFromSprite(img: Image, source: Sprite, vx: number, vy: number): Sprite {
        const s = new Sprite(img, SpriteKind.Enemy); // kind will usually be overridden in your code
        s.x = source.x;
        s.y = source.y;
        s.vx = vx;
        s.vy = vy;
        _allSprites.push(s);
        
        console.log(
        "[createProjectileFromSprite] from kind=",
        source.kind,
        "proj w=",
        img?.width,
        "h=",
        img?.height
        );

        _attachNativeSprite(s);
        return s;
    }



        // Simple physics integrator: apply vx,vy to x,y
        export function _physicsStep(dtSeconds: number): void {
            if (!dtSeconds || dtSeconds <= 0) return;

            for (const s of _allSprites) {
                if (!s || (s as any)._destroyed) continue;
                if (!s.vx && !s.vy) continue;

                s.x += s.vx * dtSeconds;
                s.y += s.vy * dtSeconds;
            }
        }









// NEW: helper to dump a sprite's pixel data row-by-row
function _debugDumpSpritePixels(s: Sprite, label: string) {
    const img = s.image as any;
    if (!img) {
        console.log(`[PIXELS] ${label} id=${s.id} kind=${s.kind} has NO image`);
        return;
    }

    const w = img.width | 0;
    const h = img.height | 0;
    console.log(`[PIXELS] ${label} id=${s.id} kind=${s.kind} w=${w} h=${h}`);

    for (let y = 0; y < h; y++) {
        let row = "";
        for (let x = 0; x < w; x++) {
            const p = img.getPixel(x, y); // 0..15 palette index in Arcade
            // Simple visualization:
            //  '.' = 0 (transparent)
            //  hex digit for non-zero palette
            row += p === 0 ? "." : p.toString(16);
        }
        console.log(`[PIXELS] ${label} id=${s.id} y=${y}: ${row}`);
    }
}





// Optional: set this low while debugging, raise it later.
//const SPRITE_SYNC_LOG_MOD = 30;

// OPTIONAL: set to true if you want per-row pixel dumps for proj/overlays.
const SPRITE_PIXEL_DUMP = false;

// Simple helper to visualize image pixels row-by-row.
// '.' = transparent (0), hex digit for non-zero palette index.
function _debugDumpSpritePixels(s: Sprite, label: string) {
    const img = s.image as any;
    if (!img) {
        console.log(`[PIXELS] ${label} id=${s.id} kind=${s.kind} NO IMAGE`);
        return;
    }

    const w = img.width | 0;
    const h = img.height | 0;
    console.log(`[PIXELS] ${label} id=${s.id} kind=${s.kind} w=${w} h=${h}`);

    for (let y = 0; y < h; y++) {
        let row = "";
        for (let x = 0; x < w; x++) {
            const p = img.getPixel(x, y); // 0..15
            row += p === 0 ? "." : p.toString(16);
        }
        console.log(`[PIXELS] ${label} id=${s.id} y=${y}: ${row}`);
    }
}





//
//
//
// This is the end of attach native sprites
//
//
//




function _propagateLabelDataToNative(s: Sprite): void {
    const native: any = s.native;
    if (!native || typeof native.setData !== "function") return;

    const data = s.data || {};

    // Prefer explicit name; fall back to monsterId or enemyName
    const name =
        (data["name"] as any) ??
        (data["monsterId"] as any) ??
        (data["enemyName"] as any);

    if (name !== undefined && name !== null && name !== "") {
        native.setData("name", name);
    }
    if (data["phase"] !== undefined) {
        native.setData("phase", data["phase"]);
    }
    if (data["dir"] !== undefined) {
        native.setData("dir", data["dir"]);
    }
}

// ======================================================
// PHASER NATIVE SPRITE SYNC
// ======================================================


// Put these at module scope (top of arcadeCompat.ts, near other globals)
let _syncPerfFrames = 0;
let _syncPerfLastReportMs = 0;




// ======================================================
// PHASER NATIVE SPRITE SYNC
// ======================================================
export function _syncNativeSprites(): void {
    const t0 = _hostPerfNowMs()
    _syncCallCount++;

    const sc: Phaser.Scene | undefined = (globalThis as any).__phaserScene;

    // Decide whether to log this frame
    let shouldLog = false;

    // 1) Early startup: log the first few frames
    if (_syncCallCount <= MAX_SYNC_VERBOSE) {
        shouldLog = true;
    }
    // 2) After that: log every SYNC_EVERY_N_AFTER frames
    else if (_syncCallCount % SYNC_EVERY_N_AFTER === 0) {
        shouldLog = true;
    }
    // 3) Long-term: log every SPRITE_SYNC_LOG_MOD frames
    else if (_syncCallCount % SPRITE_SYNC_LOG_MOD === 0) {
        shouldLog = true;
    }

    if (shouldLog) {
        console.log(
            "[_syncNativeSprites]",
            "call#", _syncCallCount,
            "scenePresent=", !!sc,
            "spriteCount=", _allSprites.length
        );
    }
    

    // --- per-frame perf counters + timers ---------------------
    let removedHard = 0;       // Destroyed/engineDestroyed/imageGone
    let removedByPixels = 0;   // autoHideByPixels -> PIXEL-DESTROY
    let frameAttachCount = 0;  // how many times we call _attachNativeSprite

    let tSceneEnd = t0;        // after scene checks
    let tLoopStart = 0;        // start of main sprite loop
    let tLoopEnd = 0;          // end of main sprite loop

    // Attach timing / counts (global accumulators for this frame)
    _frameAttachMsAccum = 0;
    _frameAttachCreateCount = 0;
    _frameAttachUpdateCount = 0;
    _frameAttachTexMs = 0;
    _frameAttachPixelMs = 0;
    _frameAttachEarlyOutCount = 0;





    // If Phaser scene isn’t ready yet, don’t touch textures / natives
    if (!sc) {
        if (shouldLog) console.log("[_syncNativeSprites] no scene yet");
        return;
    }

    // mark end of scene-check step
    tSceneEnd = _hostPerfNowMs();

    // Local alias so we can use this in perf + loops
    const all = _allSprites;


    // mark start of main sprite loop
    tLoopStart = _hostPerfNowMs();


    // Walk backwards so we can safely splice destroyed sprites
    for (let i = all.length - 1; i >= 0; i--) {
        const s = all[i];
        if (!s) {
            all.splice(i, 1);
            continue;
        }

        const flags = s.flags | 0;

        // --- HARD-DEAD CHECKS ------------------------------------------------
        const hasDestroyedFlag = !!(flags & SpriteFlag.Destroyed);
        const engineDestroyed = (s as any)._destroyed === true;
        const imageGone = !s.image;

        const hardDead = hasDestroyedFlag || engineDestroyed || imageGone;

        if (hardDead) {
            
            removedHard++;

            if (shouldLog && (s.kind === 11 || s.kind === 12)) {
                console.log(
                    "[SYNC] HARD-DESTROY",
                    "| id", s.id,
                    "| kind", s.kind,
                    "| flags", flags,
                    "| hasDestroyedFlag", hasDestroyedFlag,
                    "| engineDestroyed", engineDestroyed,
                    "| imageGone", imageGone
                );
            }

            if (s.native && (s.native as any).destroy) {
                try {
                    (s.native as any).destroy();
                } catch (e) {
                    console.warn("[_syncNativeSprites] error destroying native", s.id, e);
                }
            }
            s.native = null;

            const texKey = "sprite_" + s.id;




            if (sc.textures && sc.textures.exists(texKey)) {
                sc.textures.remove(texKey);
            }

            all.splice(i, 1);
            continue;
        }

        // --- LIVE SPRITE PATH ------------------------------------------------
        frameAttachCount++;
        _attachNativeSprite(s);

        const native = s.native as any;
        if (!native) {
            if (shouldLog && (s.kind === 11 || s.kind === 12)) {
                console.log(
                    "[SYNC] no native after attach",
                    "| id", s.id,
                    "| kind", s.kind
                );
            }
            continue;
        }



        native.x = s.x;
        native.y = s.y;



        const dataKeys = Object.keys(s.data || {});
        const role = _classifySpriteRole(s.kind, dataKeys);

        // --- HERO ANIM GLUE HOOK (phase/dir-change gated) -------------------
        if (role === "HERO") {
            const nativeAny: any = s.native;
            if (nativeAny && nativeAny.getData && nativeAny.getData("isHeroNative")) {
                _tryApplyHeroAnimationForNative(s, nativeAny as Phaser.GameObjects.Sprite);

                // ------------------------------------------------------------
                // HERO AURA (Phaser-side, true LPC silhouette)
                // ------------------------------------------------------------
                const auraActive = !!(s.data && (s.data as any)["auraActive"]);
                const auraColor = ((s.data && (s.data as any)["auraColor"]) as any | 0);


                heroAnimGlue.syncHeroAuraForNative(
                    s.native,
                    auraActive,
                    auraColor
                );

            }
        }
        // --------------------------------------------------------------------



        // --------------------------------------------------------------------

        if (role === "ENEMY" || role === "ACTOR") {
            // Engine-side data bag
            if (!(s as any).data) (s as any).data = {};
            const data: any = (s as any).data;

            // Pull canonical fields from the engine data
            const monsterId =
                sprites.readDataString(s, "monsterId") ||
                sprites.readDataString(s, "enemyName") ||
                sprites.readDataString(s, "name") ||
                "";

            type MonsterAnimPhase = "walk" | "attack" | "death";
            type MonsterDirection = "up" | "down" | "left" | "right";

            let phase = (sprites.readDataString(s, "phase") as MonsterAnimPhase) || "walk";

            let dir = sprites.readDataString(s, "dir") as MonsterDirection | undefined;
            if (!dir) {
                // Fallback: infer direction from velocity if dir isn't explicitly set
                if (s.vx > 0)      dir = "right";
                else if (s.vx < 0) dir = "left";
                else if (s.vy > 0) dir = "down";
                else               dir = "up";
            }

            // Mirror back into the engine data bag for consistency
            if (monsterId) data["monsterId"] = monsterId;
            if (monsterId && !data["name"]) data["name"] = monsterId;
            data["phase"] = phase;
            data["dir"]   = dir;

            const nativeAny: any = s.native;
            if (!nativeAny || typeof nativeAny.setData !== "function") {
                continue;
            }

            // Push into Phaser DataManager so MonsterAnimGlue can read it
            nativeAny.setData("monsterId", monsterId);
            nativeAny.setData("name",      monsterId);
            nativeAny.setData("phase",     phase);
            nativeAny.setData("dir",       dir);

            // --- Drive LPC animation every sync ---
            const glueAny: any = (globalThis as any).monsterAnimGlue || monsterAnimGlue;
            const enemySprite = nativeAny as Phaser.GameObjects.Sprite;

            if (glueAny && typeof glueAny.tryAttachMonsterSprite === "function") {
                glueAny.tryAttachMonsterSprite(enemySprite);
            } else if (glueAny && typeof glueAny.applyMonsterAnimationForSprite === "function") {
                glueAny.applyMonsterAnimationForSprite(enemySprite);
            }

            // Focused debug for imp blue so we can see what anim actually plays
            if (false) { //monsterId === "imp blue") {
                console.log(
                    "[SYNC→Phaser] imp blue",
                    "phase=", phase,
                    "dir=", dir,
                    "texKey=", enemySprite.texture && enemySprite.texture.key,
                    "currentAnim=",
                        enemySprite.anims &&
                        enemySprite.anims.currentAnim &&
                        enemySprite.anims.currentAnim.key
                );
            }

            continue;
        }












        // EXTRA DEBUG: raw projectile state before visibility logic
        if (DEBUG_PROJECTILE_NATIVE && shouldLog && s.kind === 11) {
            console.log(
                "[SYNC-PROJ-RAW]",
                "| id", s.id,
                "| engine x,y", s.x, s.y,
                "| native x,y", native.x, native.y,
                "| flags", flags,
                "| image?", !!s.image,
                "| img w,h", s.image?.width, s.image?.height,
                "| _lastNonZeroPixels", (s as any)._lastNonZeroPixels,
                "| native.visible(before)", native.visible,
                "| native.alpha(before)", native.alpha,
                "| texKey", native.texture && native.texture.key,
                "| native.width", native.width,
                "| native.height", native.height,
                "| native.displayWidth", native.displayWidth,
                "| native.displayHeight", native.displayHeight,
                "| native.scaleX", native.scaleX,
                "| native.scaleY", native.scaleY,
                "| native.depth", (native as any).depth
            );
        }



        const lastNonZero = (s as any)._lastNonZeroPixels ?? -1;
        const hasInvisibleFlag = !!(flags & SpriteFlag.Invisible);
        const autoHideByPixels = lastNonZero === 0;

        // For projectiles / overlays / small move FX, a fully blank image = done
        const deadByPixels =
            autoHideByPixels &&
            (s.kind === 11 || s.kind === 12 || s.kind === 9100);

        if (deadByPixels) {

            removedByPixels++;

            if (shouldLog) {
                console.log(
                    "[SYNC] PIXEL-DESTROY",
                    "| id", s.id,
                    "| kind", s.kind,
                    "| flags", flags,
                    "| lastNonZero", lastNonZero
                );
            }

            if (s.native && (s.native as any).destroy) {
                try {
                    (s.native as any).destroy();
                } catch (e) {
                    console.warn("[_syncNativeSprites] error destroying native", s.id, e);
                }
            }
            s.native = null;

            const texKey = "sprite_" + s.id;



            if (sc.textures && sc.textures.exists(texKey)) {
                sc.textures.remove(texKey);
            }

            all.splice(i, 1);
            continue;
        }

        const shouldBeVisible = !hasInvisibleFlag && !autoHideByPixels;
        native.visible = shouldBeVisible;
        native.alpha = shouldBeVisible ? 1 : 0;

        // EXTRA DEBUG: projectile visibility outcome every frame
        if (DEBUG_PROJECTILE_NATIVE && shouldLog && s.kind === 11) {
            console.log(
                "[SYNC-PROJ-VIS]",
                "| id", s.id,
                "| shouldBeVisible", shouldBeVisible,
                "| hasInvisibleFlag", hasInvisibleFlag,
                "| autoHideByPixels", autoHideByPixels,
                "| native.visible(after)", native.visible,
                "| native.alpha(after)", native.alpha,
                "| flags", flags,
                "| lastNonZero", lastNonZero
            );
        }

        // Focus logging ONLY on projectile + overlay kinds
        if (shouldLog && (s.kind === 11 || s.kind === 12)) {
            console.log(
                "[SYNC] sprite",
                "| id", s.id,
                "| kind", s.kind,
                "| x,y", native.x, native.y,
                "| visible", native.visible,
                "| alpha", native.alpha,
                "| flags", flags,
                "| hasInvisibleFlag", hasInvisibleFlag,
                "| lastNonZero", lastNonZero,
                "| img w,h", s.image?.width, s.image?.height
            );

            if (SPRITE_PIXEL_DUMP) {
                const label = s.kind === 11 ? "PROJ" : "OVERLAY";
                _debugDumpSpritePixels(s, label);
            }
        }
    }

    // mark end of main sprite loop
    tLoopEnd = _hostPerfNowMs();


    // ==== PERF / LEAK DEBUG (runs once per ~second) ====
    const nowMs = performance.now();

    if (!_syncPerfLastReportMs) {
        _syncPerfLastReportMs = nowMs;
        _syncPerfFrames = 1;
    } else {
        _syncPerfFrames++;
        const elapsed = nowMs - _syncPerfLastReportMs;

        if (elapsed >= 1000) {
            // Histogram of kinds to see what's piling up
            const kindHist: { [kind: number]: number } = {};
            for (const s of all) {
                if (!s) continue;
                const k = (s.kind | 0);
                kindHist[k] = (kindHist[k] || 0) + 1;
            }

            const fps = (_syncPerfFrames * 1000) / elapsed;
            const spriteCount = all.length;

            // Only log when we actually care
            if (PERF_ALWAYS_LOG || fps < PERF_FPS_WARN) {
                console.log(
                    "[perf.sync]",
                    "fps≈", fps.toFixed(1),
                    "sprites=", spriteCount,
                    "kindHist=", kindHist
                );
            }

            _syncPerfFrames = 0;
            _syncPerfLastReportMs = nowMs;
        }

    }

    const t1 = _hostPerfNowMs()
    _hostPerfAccumSyncMs += (t1 - t0)
    
    const spriteCount = all.length;
    _hostPerfLastSpriteCount = spriteCount

    
    if (shouldLog) {
        const totalMs = t1 - t0;
        const sceneMs = tSceneEnd - t0;
        const loopMs = tLoopEnd - tLoopStart;
        const otherMsRaw = totalMs - sceneMs - loopMs;
        const otherMs = otherMsRaw < 0 ? 0 : otherMsRaw;

        const attachMs = _frameAttachMsAccum;
        const loopOtherMsRaw = loopMs - attachMs;
        const loopOtherMs = loopOtherMsRaw < 0 ? 0 : loopOtherMsRaw;

        console.log(
            "[perf.syncSteps]",
            "call#", _syncCallCount,
            "sprites=", spriteCount,
            "totalMs≈", totalMs.toFixed(3),
            "sceneMs≈", sceneMs.toFixed(3),
            "loopMs≈", loopMs.toFixed(3),
            "loopAttachMs≈", attachMs.toFixed(3),
            "loopAttachTexMs≈", _frameAttachTexMs.toFixed(3),
            "loopAttachPixelMs≈", _frameAttachPixelMs.toFixed(3),
            "loopOtherMs≈", loopOtherMs.toFixed(3),
            "otherMs≈", otherMs.toFixed(3),
            "removedHard=", removedHard,
            "removedByPixels=", removedByPixels,
            "attachCalls=", frameAttachCount,
            "attachCreates=", _frameAttachCreateCount,
            "attachUpdates=", _frameAttachUpdateCount,
            "attachEarlyOuts=", _frameAttachEarlyOutCount
        );

    }


    // (rest of your existing host perf snapshot logic stays as-is)


}





//
//
//
// This is the end of _syncNativeSprites
//
//
//
//





    // Debug helper: dump all sprite + native info once on demand
    export function _debugDumpSprites(label: string = ""): void {
        console.log("========== SPRITE DUMP", label, "==========");
        console.log("total sprites =", _allSprites.length);

        for (const s of _allSprites) {
            console.log({
                id: s.id,
                kind: s.kind,
                x: s.x,
                y: s.y,
                imageWidth: s.image && s.image.width,
                imageHeight: s.image && s.image.height,
                hasPixels: !!(s.image && (s.image as any)._pixels),
                nativeType: s.native && s.native.type,
                nativeTextureKey: s.native && s.native.texture && s.native.texture.key
            });
        }
        console.log("===========================================");
    }



    // sprite-data extension surface
    export function setDataNumber(s: Sprite, key: number | string, value: number): void {
        s.data[String(key)] = value;
    }
    export function readDataNumber(s: Sprite, key: number | string): number {
        const v = s.data[String(key)];
        return typeof v === "number" ? v : 0;
    }
    export function changeDataNumberBy(s: Sprite, key: number | string, delta: number): void {
        const k = String(key);
        const current = typeof s.data[k] === "number" ? s.data[k] : 0;
        s.data[k] = current + delta;
    }

    export function setDataString(s: Sprite, key: number | string, value: string): void {
        s.data[String(key)] = value;
    }
    export function readDataString(s: Sprite, key: number | string): string {
        const v = s.data[String(key)];
        return typeof v === "string" ? v : "";
    }

    export function setDataBoolean(s: Sprite, key: number | string, value: boolean): void {
        s.data[String(key)] = value;
    }
    export function readDataBoolean(s: Sprite, key: number | string): boolean {
        const v = s.data[String(key)];
        return !!v;
    }

    export function setDataSprite(s: Sprite, key: number | string, value: Sprite): void {
        s.data[String(key)] = value;
    }
    export function readDataSprite(s: Sprite, key: number | string): Sprite {
        const v = s.data[String(key)];
        return v instanceof Sprite ? v : null;
    }

    export function setDataImage(s: Sprite, key: number | string, value: Image): void {
        s.data[String(key)] = value;
    }
    export function readDataImage(s: Sprite, key: number | string): Image {
        const v = s.data[String(key)];
        return v instanceof Image ? v : null;
    }







// --- collision helpers ---

const DEBUG_OVERLAPS = false;          // controls per-frame + overlap logging
const MAX_OVERLAP_DEBUG_LOGS = 40;
let _overlapDebugCount = 0;
let _processEventsCallCount = 0;

// NEW: limit how many times we log onOverlap registration
const MAX_ON_OVERLAP_LOGS = 2;
let _onOverlapLogCount = 0;

// NEW: only log "checking handler" twice total
const MAX_CHECK_HANDLER_LOGS = 2;
let _checkHandlerLogCount = 0;





        // event hooks – now with real collision detection
        // event hooks – now with real collision detection

        export function onOverlap(
            kindA: number,
            kindB: number,
            handler: (a: Sprite, b: Sprite) => void
        ): void {

            if (kindA === undefined || kindB === undefined) {
                console.warn(
                    "[sprites.onOverlap] WARNING: undefined kind",
                    "kindA=", kindA,
                    "kindB=", kindB
                );
            }


            _overlapHandlers.push({ a: kindA, b: kindB, handler });

            // Always log the first couple registrations so we can sanity-check kinds
            if (_onOverlapLogCount < MAX_ON_OVERLAP_LOGS) {
                _onOverlapLogCount++;
                console.log(
                    "[sprites.onOverlap] registered",
                    "kindA=", kindA,
                    "kindB=", kindB,
                    "totalHandlers=", _overlapHandlers.length
                );
            }
        }


        export function onDestroyed(kind: number, handler: (s: Sprite) => void): void {
            _destroyHandlers.push({ kind, handler });
        }

        // --- collision helpers ---
        // --- collision helpers ---

        function _isCollidable(s: Sprite | undefined): s is Sprite {
            if (!s) return false;
            if (s.flags & SpriteFlag.Destroyed) return false;
            if (s.flags & SpriteFlag.Ghost) return false;
            // If you want invisible sprites to still collide, leave Invisible alone.
            // If you *don’t*, uncomment the next line:
            // if (s.flags & SpriteFlag.Invisible) return false;
            return true;
        }

        function _aabbOverlap(a: Sprite, b: Sprite): boolean {
            // MakeCode semantics: x,y are center of sprite; width/height from image.
            const aw = a.width;
            const ah = a.height;
            const bw = b.width;
            const bh = b.height;

            if (aw <= 0 || ah <= 0 || bw <= 0 || bh <= 0) return false;

            const leftA   = a.x - aw / 2;
            const rightA  = a.x + aw / 2;
            const topA    = a.y - ah / 2;
            const bottomA = a.y + ah / 2;

            const leftB   = b.x - bw / 2;
            const rightB  = b.x + bw / 2;
            const topB    = b.y - bh / 2;
            const bottomB = b.y + bh / 2;

            return (
                leftA < rightB &&
                rightA > leftB &&
                topA < bottomB &&
                bottomA > topB
            );
        }



        // Called from game loop to process overlaps/destroys.
        export function _processEvents(): void {
            _processEventsCallCount++;

            // Only spam for the first ~300 frames; tweak if you want.
            const shouldLogFrame = DEBUG_OVERLAPS && _processEventsCallCount <= 300;

            if (shouldLogFrame) {
                console.log(
                    "[sprites._processEvents] start",
                    "frame=", _processEventsCallCount,
                    "overlapHandlers=", _overlapHandlers.length,
                    "destroyHandlers=", _destroyHandlers.length,
                    "spriteCount=", _allSprites.length
                );
            }

            if (!_overlapHandlers.length && !_destroyHandlers.length) {
                if (shouldLogFrame) {
                    console.log("[sprites._processEvents] skip: no handlers");
                }
                return;
            }

            if (_allSprites.length <= 1 && !_destroyHandlers.length) {
                if (shouldLogFrame) {
                    console.log(
                        "[sprites._processEvents] skip: not enough sprites",
                        "spriteCount=", _allSprites.length
                    );
                }
                return;
            }

            // Snapshot current sprites so handlers can create/destroy safely.
            const spritesSnapshot = _allSprites.slice();



// ---- OVERLAPS ----
if (_overlapHandlers.length && spritesSnapshot.length > 1) {
    for (const { a: kindA, b: kindB, handler } of _overlapHandlers) {

        // Log "checking handler" only twice per run, independent of DEBUG_OVERLAPS
        if (_checkHandlerLogCount < MAX_CHECK_HANDLER_LOGS) {
            _checkHandlerLogCount++;
            console.log(
                "[sprites._processEvents] checking handler",
                "kindA=", kindA,
                "kindB=", kindB
            );
        }

        for (let i = 0; i < spritesSnapshot.length; i++) {
            const s1 = spritesSnapshot[i];
            if (!_isCollidable(s1)) continue;

            const k1 = s1.kind;
            // Quick prune: if s1 is neither kindA nor kindB, skip.
            if (k1 !== kindA && k1 !== kindB) continue;

            for (let j = i + 1; j < spritesSnapshot.length; j++) {
                const s2 = spritesSnapshot[j];
                if (!_isCollidable(s2)) continue;

                const k2 = s2.kind;
                // Only consider the pair if their kinds match this handler pair.
                if (!(
                    (k1 === kindA && k2 === kindB) ||
                    (k1 === kindB && k2 === kindA)
                )) continue;

                if (!_aabbOverlap(s1, s2)) continue;

                // Call handler with (kindA, kindB) ordering,
                // even if the actual sprites were found in the opposite order.
                try {
                    if (k1 === kindA && k2 === kindB) {
                        handler(s1, s2);
                    } else {
                        handler(s2, s1);
                    }

                    // Overlap-hit logging still controlled only by DEBUG_OVERLAPS
                    if (DEBUG_OVERLAPS && _overlapDebugCount < MAX_OVERLAP_DEBUG_LOGS) {
                        _overlapDebugCount++;
                        console.log(
                            "[sprites._processEvents] overlap",
                            "kinds=", kindA, kindB,
                            "sprites=", s1.id, s2.id,
                            "posA=(", s1.x, s1.y, ")",
                            "posB=(", s2.x, s2.y, ")"
                        );
                    }
                } catch (e) {
                    console.warn(
                        "[sprites._processEvents] overlap handler error:",
                        e
                    );
                }
            }
        }
    }
}






            // (destroyed-callback wiring can live here later if needed)



            // ---- DESTROYED CALLBACKS (optional wiring) ----
            // If you want to support sprites.onDestroyed(kind, handler),
            // easiest is to track destroyed sprites in Sprite.destroy()
            // and drain them here. For now, we leave this as a future hook.
            // (HeroEngine25 only relies on overlaps.)
        }

        export function allSprites(): Sprite[] {
            return _allSprites;
        }





}

/* -------------------------------------------------------
   screen & scene namespaces
------------------------------------------------------- */

namespace screen {
    export let width: number = 640;
    export let height: number = 480;
}





namespace scene {
    export const HUD_Z = 100;
    export const UPDATE_PRIORITY = 10;


    export function screenWidth(): number {
    // Use the compat screen namespace
    return screen.width | 0
    }

    export function screenHeight(): number {
        return screen.height | 0
    }



let _lastBgIndexLogged = -1;

export function setBackgroundColor(colorIndex: number): void {
    const g: any = (globalThis as any);

    // Clamp and store for network snapshots
    const idx = Math.max(0, Math.min(MAKECODE_PALETTE.length - 1, colorIndex | 0));
    g.__net_bgColorIndex = idx;

    const sc: Phaser.Scene = g.__phaserScene;

    if (!sc || !sc.cameras || !sc.cameras.main) {
        // Only complain once per index to avoid spam if scene isn't ready
        if (idx !== _lastBgIndexLogged) {
            console.log(
                "[scene.setBackgroundColor] no Phaser scene yet, colorIndex=",
                colorIndex,
                "clampedIdx=",
                idx
            );
            _lastBgIndexLogged = idx;
        }
        return;
    }

    const rgb = MAKECODE_PALETTE[idx] || [0, 0, 0];
    const hex = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];

    // Only log when the background index actually changes
    if (idx !== _lastBgIndexLogged) {
        console.log(
            "[scene.setBackgroundColor] index=",
            idx,
            "rgb=",
            rgb,
            "hex=",
            hex.toString(16)
        );
        _lastBgIndexLogged = idx;
    }

    sc.cameras.main.setBackgroundColor(hex);
}




}



// ------------------------------------------------------
// tiles namespace (stub) – just enough for HeroEngine
// ------------------------------------------------------
namespace tiles {
    // Minimal shape; expand later if you want real data
    export interface TileMapData {
        id: string;      // e.g., "level1"
        // add width/height/data later if needed
    }

    let _current: TileMapData | null = null;

    export function setCurrentTilemap(tm: TileMapData): void {
        _current = tm;
        console.log("[tiles.setCurrentTilemap] (stub) current =", tm);
    }

    export function currentTilemap(): TileMapData | null {
        return _current;
    }
}




// ------------------------------------------------------
// tilemap`...` tagged template (stub)
// ------------------------------------------------------
function tilemap(
    strings: TemplateStringsArray,
    ...expr: any[]
): tiles.TileMapData {
    // In MakeCode, this is compile-time. Here we just
    // turn `tilemap`level1`` into an object with id "level1".
    const id = strings.join("${}");
    console.log("[tilemap] (stub) requested map id =", id, "expr =", expr);
    return { id };
}




/* -------------------------------------------------------
   game namespace – time, scene, update handlers
------------------------------------------------------- */


class BasicPhysicsEngine {
    sprites: Sprite[] = [];
    addSprite(s: Sprite): void {
        if (this.sprites.indexOf(s) < 0) this.sprites.push(s);

        // NEW: let the compat renderer know about extension-created sprites
        if ((sprites as any)._registerExternalSprite) {
            (sprites as any)._registerExternalSprite(s);
        }
    }
}



class BasicGameScene {
    physicsEngine = new BasicPhysicsEngine();
    data: { [key: string]: any } = {};
    createdHandlers: ((s: Sprite) => void)[] = [];

    millis(): number {
        return game.runtime();
    }
}

class BasicEventContext {
    // priority not used yet, but stored for future.
    handlers: { priority: number; handler: () => void }[] = [];
    registerFrameHandler(priority: number, handler: () => void): void {
        this.handlers.push({ priority, handler });
    }
}


namespace game {
    const _startTime = Date.now();
    const _scene = new BasicGameScene();
    const _eventContext = new BasicEventContext();
    const _updateHandlers: (() => void)[] = [];
    const _intervalHandlers: { interval: number; last: number; fn: () => void }[] = [];

    let _lastTick = 0;

    export function runtime(): number {
        return Date.now() - _startTime;
    }



    
    export function onUpdate(handler: () => void): void {
        _updateHandlers.push(handler);
    }

    export function onUpdateInterval(intervalMs: number, handler: () => void): void {
        _intervalHandlers.push({ interval: intervalMs, last: runtime(), fn: handler });
    }

    export function currentScene(): BasicGameScene {
        return _scene;
    }

    export function eventContext(): BasicEventContext {
        return _eventContext;
    }
 
 
 

 
     // Main engine tick – controllers → physics → user update handlers
    // Multiplayer-aware:
    //   - Host (or single-player) runs full HeroEngine logic.
    //   - Followers only animate (physics + syncNativeSprites); they do NOT
    //     run game.onUpdate / onUpdateInterval handlers. World state for
    //     followers is driven by netWorld.apply(...) from host snapshots.
    export function _tick(): void {
        const t0 = _hostPerfNowMs()

        const now = runtime();
        if (_lastTick === 0) _lastTick = now;
        const dtMs = now - _lastTick;
        const dtSec = dtMs / 1000;
        _lastTick = now;

        // Decide host vs follower
        const g: any = (globalThis as any);
        // Default to host if no network or flag not yet set
        const isHost = !g || g.__isHost === undefined ? true : !!g.__isHost;

        // 0) Update controller-driven velocities (wrapper-only)
        //    Both host and followers keep controller state updated so local
        //    code that reads controller buttons directly still sees reality.
        if ((controller as any)._updateAllControllers) {
            (controller as any)._updateAllControllers();
        }

        // 1) Move sprites based on vx,vy (lightweight physics step)
        (sprites as any)._physicsStep(dtSec);

        // 2) Run game.onUpdate + game.onUpdateInterval + event handlers
        //    ONLY on the host. Followers will get their "truth" from the
        //    host via netWorld snapshots (applied in the network layer).



        if (isHost) {
            for (const h of _updateHandlers) h();
            for (const ih of _intervalHandlers) {
                if (now - ih.last >= ih.interval) {
                    ih.last = now;
                    ih.fn();
                }
            }
            for (const h of _eventContext.handlers) h.handler();

            // Host: optionally broadcast snapshots to followers
            const g2: any = (globalThis as any);
            if (g2 && typeof g2.__net_maybeSendWorldSnapshot === "function") {
                g2.__net_maybeSendWorldSnapshot();
            }
        }

        // 3) Keep compat sprites and Phaser visuals aligned
        sprites._syncNativeSprites();

        const t1 = _hostPerfNowMs()
        _hostPerfFrameCount++
        _hostPerfAccumTickMs += (t1 - t0)

        _hostPerfMaybeDump(t1)

    }




}


/* -------------------------------------------------------
   controller namespace – per-player input stubs
------------------------------------------------------- */

namespace controller {
    export interface Button {
        isPressed(): boolean;
    }

    class BasicButton implements Button {
        private _pressed = false;
        isPressed(): boolean {
            return this._pressed;
        }
        _setPressed(v: boolean): void {
            this._pressed = v;
        }
    }

    export interface Controller {
        moveSprite(s: Sprite, vx: number, vy: number): void;
        A: Button;
        B: Button;
        up: Button;
        down: Button;
        left: Button;
        right: Button;
    }

    class BasicController implements Controller {
        A = new BasicButton();
        B = new BasicButton();
        up = new BasicButton();
        down = new BasicButton();
        left = new BasicButton();
        right = new BasicButton();

        // NEW: remember which sprite this controller owns + its base speed
        private _sprite: Sprite | null = null;
        private _speedX: number = 0;
        private _speedY: number = 0;

        moveSprite(s: Sprite, vx: number, vy: number): void {
            // In real MakeCode, this is called repeatedly.
            // In our wrapper, treat it as "bind this sprite + speed to this controller".
            this._sprite = s;
            this._speedX = vx;
            this._speedY = vy;

            // Immediately update once so things respond even before first tick
            this._updateSpriteVelocity();
        }



    _updateSpriteVelocity(): void {
        const s = this._sprite;
        if (!s) return;

        // IMPORTANT: honor engine "inputLocked" flag.
        // When the HeroEngine locks movement for an ability, it expects to
        // drive vx / vy itself. If we keep overwriting here, abilities look frozen.
        try {
            const spritesNS: any = (globalThis as any).sprites;
            if (spritesNS && typeof spritesNS.readDataBoolean === "function") {
                const locked = spritesNS.readDataBoolean(s, "inputLocked");
                if (locked) {
                    // Do not modify vx/vy at all – keep whatever the engine set.
                    return;
                }
            }
        } catch { /* fail-safe: if anything goes weird, fall back to old behavior */ }

        const dx =
            (this.right.isPressed() ? 1 : 0) -
            (this.left.isPressed() ? 1 : 0);
        const dy =
            (this.down.isPressed() ? 1 : 0) -
            (this.up.isPressed() ? 1 : 0);

        s.vx = dx * this._speedX;
        s.vy = dy * this._speedY;
    }



        
    }

    export const player1: BasicController = new BasicController();
    export const player2: BasicController = new BasicController();
    export const player3: BasicController = new BasicController();
    export const player4: BasicController = new BasicController();



        // Which global player (1–4) this client controls.
        // All keyboard input will apply to THIS controller.
        let _localPlayerSlot = 1; // 1..4

        export function setLocalPlayerSlot(playerId: number): void {
            if (playerId < 1 || playerId > 4) {
                console.warn("[controller.setLocalPlayerSlot] invalid playerId", playerId);
                return;
            }
            _localPlayerSlot = playerId | 0;
            console.log("[controller] local player slot set to", _localPlayerSlot);
        }

        function _getLocalController(): BasicController {
            switch (_localPlayerSlot) {
                case 1: return player1;
                case 2: return player2;
                case 3: return player3;
                case 4: return player4;
                default: return player1;
            }
        }



    
    // NEW: helper for game._tick – update all controllers once per frame
    export function _updateAllControllers(): void {
        (player1 as any)._updateSpriteVelocity();
        (player2 as any)._updateSpriteVelocity();
        (player3 as any)._updateSpriteVelocity();
        (player4 as any)._updateSpriteVelocity();
    }






    let _keyboardWired = false;

    // Send a local input event (button pressed/released) to the network.
    function _sendLocalInput(button: string, pressed: boolean) {
        const net: any = (globalThis as any).__net;
        if (net && typeof net.sendInput === "function") {
            net.sendInput(button, pressed);
        } else {
            // Fallback: no network – apply directly to local controller
            const ctrl = _getLocalController() as any;
            const btn = ctrl[button];
            if (btn && typeof btn._setPressed === "function") {
                btn._setPressed(pressed);
            }
        }
    }

    // Hook Phaser keyboard into the "local" player.
    // SAME keys on every client: arrows + Q/E.
    export function _wireKeyboard(scene: any): void {
        if (_keyboardWired) {
            console.log("[controller._wireKeyboard] already wired, skipping");
            return;
        }
        _keyboardWired = true;

        const kb = scene && scene.input && scene.input.keyboard;
        if (!kb) {
            console.warn("[controller._wireKeyboard] no keyboard plugin on scene", scene);
            return;
        }

        console.log("[controller._wireKeyboard] wiring keyboard controls for LOCAL player (network-aware)");

        function bindKeyToButtonName(key: string, buttonName: string) {
            kb.on("keydown-" + key, () => _sendLocalInput(buttonName, true));
            kb.on("keyup-" + key, () => _sendLocalInput(buttonName, false));
        }

        // Movement: arrows
        bindKeyToButtonName("LEFT",  "left");
        bindKeyToButtonName("RIGHT", "right");
        bindKeyToButtonName("UP",    "up");
        bindKeyToButtonName("DOWN",  "down");

        // Moves: Q/E → A/B
        bindKeyToButtonName("Q", "A");
        bindKeyToButtonName("E", "B");
    }



}




/* -------------------------------------------------------
   effects namespace
------------------------------------------------------- */

namespace effects {
    // Just numeric IDs for now; Sprite.startEffect/destroy interpret them.
    export const trail = 1;
    export const disintegrate = 2;
}





// ===============================================
// STEP 1: WORLD SNAPSHOT SYSTEM
// ===============================================
namespace netWorld {

        export interface SpriteSnapshot {
            id: number;
            kind: number;
            x: number;
            y: number;
            vx: number;
            vy: number;
            width: number;
            height: number;
            data: { [k: string]: any };

            // NEW: serialized pixel data from compat's Image
            pixels?: number[];
            flags: number;   // NEW: mirror Sprite.flags (Invisible, Destroyed, etc.)
        }




    export interface WorldSnapshot {
        timeMs: number;
        runtimeMs: number;      // <-- includes heroEngine's worldRuntimeMs if exported
        bgIndex: number;        // NEW: host background color index
        sprites: SpriteSnapshot[];
    }





    // Helper: shallow copy of sprite.data (only JSON-safe)
    function cloneData(src: any): any {
        const out: any = {};
        if (!src) return out;
        for (const k of Object.keys(src)) {
            const v = (src as any)[k];
            if (v === undefined) continue;
            // JSON-safe primitives only
            if (typeof v === "number" || typeof v === "boolean" || typeof v === "string" || v === null) {
                out[k] = v;
            }
            // Skip objects/arrays/functions (MakeCode Arcade sprite.data is primitive-only anyway)
        }
        return out;
    }




    let _applyCount = 0;
    let _lastApplyRuntimeMs = 0;

    // Perf tracking for follower apply()
    let _applyPerfSnaps = 0;
    let _applyPerfTimeMs = 0;
    let _applyPerfLastReportMs = 0;
    let _applyPerfLastSpriteCount = 0;



    // ====================================================
    // CAPTURE SNAPSHOT
    // ====================================================


    
    export function capture(): WorldSnapshot {
        const g: any = (globalThis as any);
        const runtimeMs = (g.__heroEngineWorldRuntimeMs ?? 0) | 0;
        const bgIndex = (g.__net_bgColorIndex ?? 0) | 0;
        // ...





    // Pull ALL sprites from compat layer
    const allFn = (sprites as any)._getAllSprites;
    const all = typeof allFn === "function" ? allFn.call(sprites) as any[] : [];

    const snapSprites: SpriteSnapshot[] = [];

    for (const s of all) {
        if (!s) continue;

        let pixels: number[] | undefined = undefined;
        if (s.image && (s.image as any).toJSONPixels) {
            pixels = (s.image as any).toJSONPixels();
        }

        snapSprites.push({
            id: s.id | 0,
            kind: s.kind | 0,
            x: s.x || 0,
            y: s.y || 0,
            vx: s.vx || 0,
            vy: s.vy || 0,
            width: (s.width || (s.image?.width ?? 16)) | 0,
            height: (s.height || (s.image?.height ?? 16)) | 0,
            data: cloneData(s.data),
            flags: s.flags | 0,   // 🔴 NEW
            pixels
            
        });
    }



    return {
        timeMs: game.runtime() | 0,
        runtimeMs: runtimeMs,
        bgIndex: bgIndex,
        sprites: snapSprites
    };





}





    // ====================================================
    // APPLY SNAPSHOT
    // ====================================================

export function apply(snap: WorldSnapshot): void {
    if (!snap) return;

    const g: any = (globalThis as any);
    const isHost = !!g.__isHost;
    const now = game.runtime();

    // Wall-clock timer for perf (per snapshot apply)
    const perfStart = Date.now();

    // Only care about "choppiness" on followers
    if (!isHost) {
        _applyCount++;
        const dt = _lastApplyRuntimeMs === 0 ? 0 : now - _lastApplyRuntimeMs;
        _lastApplyRuntimeMs = now;

        if (_applyCount <= 10 || _applyCount % 60 === 0) {
            console.log(
                "[netWorld.apply] follower snapshot #",
                _applyCount,
                "sprites=",
                snap.sprites ? snap.sprites.length : 0,
                "dtMs=",
                dt,
                "bgIndex=",
                (snap as any).bgIndex
            );
        }
    }

    const allFn = (sprites as any)._getAllSprites;
    const all = typeof allFn === "function" ? (allFn.call(sprites) as any[]) : [];

    const snapSprites = snap.sprites || [];

    // Track which IDs are present in the snapshot so we can prune leftovers
    const keepIds: { [id: number]: 1 } = {};

    for (const s of snapSprites) {
        if (!s) continue;

        const id = s.id | 0;
        keepIds[id] = 1;

        let target: any = null;

        // Find matching sprite by ID
        for (const local of all) {
            if (local && local.id === id) {
                target = local;
                break;
            }
        }

        // If follower has never seen this sprite before, create it with host's id
        if (!target) {
            const ensureFn = (sprites as any)._ensureSpriteWithId;
            if (typeof ensureFn === "function") {
                target = ensureFn.call(
                    sprites,
                    s.id,
                    s.kind,
                    s.width || 16,
                    s.height || 16
                );
            } else {
                console.warn(
                    "[netWorld.apply] Missing sprite for id",
                    id,
                    "and no _ensureSpriteWithId helper"
                );
                continue;
            }
        }

        // Update basic fields
        target.kind = s.kind | 0;
        target.x = s.x;
        target.y = s.y;
        target.vx = s.vx;
        target.vy = s.vy;

        // 🔴 NEW: mirror host flags so Invisible works on follower
        if (typeof (s as any).flags === "number") {
        target.flags = (s as any).flags | 0;
        }
        // Sync image pixels if provided
        if (s.pixels && s.width > 0 && s.height > 0) {
            const w = s.width | 0;
            const h = s.height | 0;
            let img: any = target.image;

            if (!img || img.width !== w || img.height !== h) {
                // Create a new Image from serialized pixels
                img = Image.fromJSON(w, h, s.pixels);
                if (typeof target.setImage === "function") {
                    target.setImage(img);
                } else {
                    target.image = img;
                }
            } else if ((img as any).fromJSONPixels) {
                // Reuse existing Image; just refresh pixels
                img.fromJSONPixels(s.pixels);
            }

            // 🔴 Recompute _lastNonZeroPixels on follower so auras / overlays
            // auto-hide when host clears them to blank.
            const px = s.pixels as number[];
            if (px && px.length) {
                let lastNonZero = 0;
                let foundNonZero = false;
                for (let idx = px.length - 1; idx >= 0; idx--) {
                    if ((px[idx] | 0) !== 0) {
                        lastNonZero = idx;
                        foundNonZero = true;
                        break;
                    }
                }
                (target as any)._lastNonZeroPixels = foundNonZero ? lastNonZero : 0;
            } else {
                (target as any)._lastNonZeroPixels = -1;
            }
        }

        // Replace data bag
        if (!target.data) target.data = {};
        const d = target.data;
        for (const k of Object.keys(d)) delete d[k];
        for (const k of Object.keys(s.data)) d[k] = s.data[k];
    }

    // 🔥 Follower-only: destroy any local sprites that vanished from the snapshot.
    // This is what fixes "stale aura / move" artifacts on followers.
    if (!isHost && all && all.length) {
        for (const local of all) {
            if (!local) continue;
            const id = (local.id | 0);
            if (!keepIds[id]) {
                // Mark as destroyed; _syncNativeSprites will clean up the native sprite/texture.
                if (typeof (local as any).destroy === "function") {
                    (local as any).destroy();
                } else {
                    // Fallback just in case
                    (local as any).flags |= SpriteFlag.Destroyed;
                    (local as any)._destroyed = true;
                }
            }
        }
    }

    // Keep heroEngine world time in sync, if exported
    if (typeof snap.runtimeMs === "number") {
        g.__heroEngineWorldRuntimeMs = snap.runtimeMs | 0;
    }

    // Followers mirror host's bgIndex
    if (!isHost && typeof (snap as any).bgIndex === "number") {
        scene.setBackgroundColor((snap as any).bgIndex | 0);
    }

    // ---- PERF LOGGING (follower apply cost) ----
    if (!isHost) {
        const elapsed = Date.now() - perfStart; // ms for this apply()
        _applyPerfSnaps++;
        _applyPerfTimeMs += elapsed;

        const spritesNow = snap.sprites ? snap.sprites.length : 0;
        const sinceReport = now - _applyPerfLastReportMs;

        if (_applyPerfLastReportMs === 0) {
            _applyPerfLastReportMs = now;
            _applyPerfLastSpriteCount = spritesNow;
        } else if (sinceReport >= 2000) {
            const avgMs = _applyPerfSnaps > 0
                ? _applyPerfTimeMs / _applyPerfSnaps
                : 0;

            console.log(
                "[netWorld.apply] PERF follower",
                "avgApplyMs=",
                avgMs.toFixed(3),
                "snapshots=",
                _applyPerfSnaps,
                "lastSprites=",
                _applyPerfLastSpriteCount
            );

            _applyPerfSnaps = 0;
            _applyPerfTimeMs = 0;
            _applyPerfLastReportMs = now;
            _applyPerfLastSpriteCount = spritesNow;
        }
    }
}










    // ====================================================
    // STRINGIFY / PARSE HELPERS
    // ====================================================
    export function toJSON(): string {
        return JSON.stringify(capture());
    }

    export function fromJSON(json: string): WorldSnapshot {
        return JSON.parse(json) as WorldSnapshot;
    }
}





// ===============================================
// STEP 5: DEBUG SAVE / LOAD WORLD STATE HELPERS
// ===============================================

// Usage from DevTools:
//   const json = (window as any).debugSaveWorldState();
//   // ... later ...
//   (window as any).debugLoadWorldState(json);

(globalThis as any).debugSaveWorldState = function (): string {
    try {
        const json = netWorld.toJSON();
        console.log("[netWorld] debugSaveWorldState:", json);
        return json;
    } catch (e) {
        console.error("[netWorld] debugSaveWorldState error", e);
        return "";
    }
};

(globalThis as any).debugLoadWorldState = function (json: string) {
    try {
        const snap = netWorld.fromJSON(json);
        netWorld.apply(snap);
        console.log("[netWorld] debugLoadWorldState: applied snapshot with",
            snap.sprites?.length ?? 0, "sprites");
    } catch (e) {
        console.error("[netWorld] debugLoadWorldState error", e);
    }
};







































/* -------------------------------------------------------
   End of compat layer
------------------------------------------------------- */
/* -------------------------------------------------------
   Expose MakeCode-style globals for engine files
------------------------------------------------------- */

;(globalThis as any).Image = Image;
;(globalThis as any).Sprite = Sprite;

;(globalThis as any).image = image;
;(globalThis as any).sprites = sprites;
;(globalThis as any).game = game;
;(globalThis as any).scene = scene;
;(globalThis as any).screen = screen;
;(globalThis as any).controller = controller;
;(globalThis as any).effects = effects;

;(globalThis as any).tiles = tiles;
;(globalThis as any).tilemap = tilemap;

;(globalThis as any).SpriteKind = SpriteKind;
;(globalThis as any).SpriteFlag = SpriteFlag;
;(globalThis as any).CollisionDirection = CollisionDirection;


/* -------------------------------------------------------
   Simple render sync loop – keeps sprites & Phaser in sync
   (Temporary: bypasses game._tick wiring issues)
------------------------------------------------------- */





// --- PERF: sprite sync loop stats ---
let __syncPerfLastReport = 0;
let __syncPerfFrames = 0;
let __syncPerfTimeMs = 0;

/**
 * Call this once to start the native sprite sync loop.
 * Uses requestAnimationFrame and measures how expensive _syncNativeSprites is.
 */
function startSpriteSyncLoop() {
    function frame(now: number) {
        const t0 = performance.now();
        _syncNativeSprites();
        const t1 = performance.now();

        // accumulate stats
        __syncPerfFrames++;
        __syncPerfTimeMs += (t1 - t0);

        // once per second, print a summary
        if (!__syncPerfLastReport) {
            __syncPerfLastReport = now;
        } else if (now - __syncPerfLastReport >= 1000) {
            const dt = now - __syncPerfLastReport;
            const fps = (__syncPerfFrames * 1000) / dt;
            const avgMs = __syncPerfTimeMs / __syncPerfFrames;

            // NOTE: keep this log small; it’s our “is this the lag culprit?” line
            console.log(
                `[perf.sync] fps≈${fps.toFixed(1)} avgSyncMs=${avgMs.toFixed(3)} frames=${__syncPerfFrames}`
            );

            __syncPerfLastReport = now;
            __syncPerfFrames = 0;
            __syncPerfTimeMs = 0;
        }

        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
}










// NEW: engine loop – runs HeroEngine updates + physics + overlap events
(function startGameLoop() {
    function frame() {
        try {
            (game as any)._tick();

            // After all sprites have updated positions for this tick,
            // process collisions and fire sprites.onOverlap handlers.
            (sprites as any)._processEvents();
        } catch (e) {
            console.warn("[gameLoop] error in game._tick/_processEvents:", e);
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();





/* -------------------------------------------------------
   Player registry – names & profiles for HeroEngine
   (Used by getHeroProfileForHeroIndex in WorkingHeroEngine)
------------------------------------------------------- */

(function initPlayerRegistry() {
    const g: any = (globalThis as any);
    if (!g.__heroProfiles) {
        g.__heroProfiles = ["Default", "Default", "Default", "Default"];
    }
    if (!g.__playerNames) {
        g.__playerNames = [null, null, null, null];
    }
})();

// slotIndex is 0..3 (Player 1..4); name can be null/undefined for default.
export function registerLocalPlayer(slotIndex: number, name: string | null) {
    const g: any = (globalThis as any);
    if (!g.__heroProfiles) g.__heroProfiles = ["Default", "Default", "Default", "Default"];
    if (!g.__playerNames) g.__playerNames = [null, null, null, null];

    g.__playerNames[slotIndex] = name || null;
    g.__heroProfiles[slotIndex] = name || "Default";

    // This client controls this slot (1–4)
    if ((globalThis as any).controller &&
        typeof (globalThis as any).controller.setLocalPlayerSlot === "function") {
        (globalThis as any).controller.setLocalPlayerSlot(slotIndex + 1);
    }

    console.log("[players] registered LOCAL player slot", slotIndex + 1, "name=", name);
}







/* -------------------------------------------------------
   Network client – WebSocket → controller bridge
------------------------------------------------------- */
type NetMessage =
    | { type: "assign"; playerId: number; name?: string }
    | {
          type: "input";
          playerId: number;
          button: string;
          pressed: boolean;
          // Timestamp (ms) when the client sent this input
          sentAtMs?: number;
      }
    | { type: "state"; playerId: number; snapshot: netWorld.WorldSnapshot };

    


class NetworkClient {
    private ws: WebSocket | null = null;
    playerId: number | null = null;
    url: string;

    // NEW: per-client monotonically increasing input sequence
    private inputSeq: number = 0;

    constructor(url: string) {
        this.url = url;
    }

    connect() {
        if (this.ws) return;

        const ws = new WebSocket(this.url);
        this.ws = ws;

        ws.onopen = () => {
            console.log("[net] connected to", this.url);
        };

        ws.onmessage = (ev) => {
            let msg: NetMessage;
            try {
                msg = JSON.parse(ev.data) as NetMessage;
            } catch (e) {
                console.warn("[net] invalid message:", ev.data, e);
                return;
            }
            this.handleMessage(msg);
        };

        ws.onclose = () => {
            console.log("[net] disconnected");
            this.ws = null;
            // You can implement reconnect here later if you want.
        };

        ws.onerror = (ev) => {
            console.warn("[net] error", ev);
        };
    }



    // Send a button event up to the server
    sendInput(button: string, pressed: boolean) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            // console.log("[net] not connected; ignoring input");
            return;
        }
        if (this.playerId == null) {
            console.warn("[net] no playerId yet; ignoring input");
            return;
        }

        // Bump sequence number
        const seq = ++this.inputSeq;

        // High-res time for *this page only* (host RTT measurement)
        const perfNow =
            typeof performance !== "undefined" ? performance.now() : null;

        // Wall-clock time for cross-process comparisons (client↔server)
        const wallNow = Date.now();

        const payload: NetMessage = {
            type: "input",
            playerId: this.playerId,
            button,
            pressed,
            // For host-side [inputLag.net]
            sentAtMs: perfNow != null ? perfNow : wallNow,
            // For server lag + cross-process correlation
            sentWallMs: wallNow,
            // NEW: shared ID so all logs can line up
            inputSeq: seq
        };

        this.ws.send(JSON.stringify(payload));
    }


    // Host uses this to send snapshots of the world state
    sendWorldSnapshot(snap: netWorld.WorldSnapshot) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        if (this.playerId == null || this.playerId !== 1) {
            // Only player 1 is allowed to send world snapshots (host)
            return;
        }
        const payload: NetMessage = {
            type: "state",
            playerId: this.playerId,
            snapshot: snap
        };
        this.ws.send(JSON.stringify(payload));
    }

    private handleMessage(msg: NetMessage) {





        if (msg.type === "assign") {
            this.playerId = msg.playerId;

            const gAssign: any = (globalThis as any);

            console.log(
                "[net] assigned playerId =",
                this.playerId,
                "name=",
                msg.name
            );

            // Tie this client to that global player slot
            const ctrlNS: any = gAssign.controller;
            if (ctrlNS && typeof ctrlNS.setLocalPlayerSlot === "function") {
                ctrlNS.setLocalPlayerSlot(this.playerId);
            }

            // Register profile / name for HeroEngine hook
            const slotIndex = this.playerId - 1;
            const name = msg.name || null;

            if (!gAssign.__heroProfiles) {
                gAssign.__heroProfiles = ["Default", "Default", "Default", "Default"];
            }
            if (!gAssign.__playerNames) {
                gAssign.__playerNames = [null, null, null, null];
            }

            gAssign.__playerNames[slotIndex] = name;

            if (name) {
                const existing = gAssign.__heroProfiles[slotIndex];
                if (!existing || existing === "Default") {
                    gAssign.__heroProfiles[slotIndex] = name;
                }
            }

            return;
        }


        if (msg.type === "hostStatus") {
            const gAssign: any = (globalThis as any);
            const isHost = !!msg.isHost;

            gAssign.__isHost = isHost;

            console.log("[net] hostStatus =", isHost);

            // If this client is host, kick off the HeroEngine host loop
            if (isHost && typeof gAssign.__startHeroEngineHost === "function") {
                gAssign.__startHeroEngineHost();
            }

            return;
        }


        if (msg.type === "state") {
            const gState: any = (globalThis as any);
            const isHost = !!(gState && gState.__isHost);

            // Host already has authoritative world state.
            // Ignore echoed snapshots to avoid duplicating sprites / state.
            if (isHost) {
                // console.log("[net] host ignoring echoed state snapshot");
                return;
            }

            // Followers mirror the host via snapshots.
            netWorld.apply(msg.snapshot);
            return;
        }






        if (msg.type === "input") {
            const g: any = (globalThis as any);
            const isHost = !!g.__isHost;

            // Only the host should apply inputs to controllers.
            if (!isHost) {
                // console.log("[net] non-host ignoring input message", msg);
                return;
            }

            const ctrlNS: any = g.controller;
            if (!ctrlNS) return;

            const playerId = msg.playerId;
            let ctrl: any = null;
            if (playerId === 1) ctrl = ctrlNS.player1;
            else if (playerId === 2) ctrl = ctrlNS.player2;
            else if (playerId === 3) ctrl = ctrlNS.player3;
            else if (playerId === 4) ctrl = ctrlNS.player4;

            if (!ctrl) return;

            const btnName = msg.button;       // "left" | "right" | "up" | "down" | "A" | "B"
            const pressed = !!msg.pressed;

            // ---------------------------------------------------------
            // 1) Measure input *arrival* lag (client -> host)
            // ---------------------------------------------------------
            let lagMs = -1;
            if (typeof msg.sentAtMs === "number") {
                const nowMs =
                    typeof performance !== "undefined" ? performance.now() : Date.now();
                lagMs = nowMs - msg.sentAtMs;

                // Establish a baseline to account for clock offset + normal latency
                if (_inputLagBaselineSamples < 20) {
                    if (_inputLagBaselineSamples === 0 || lagMs < _inputLagBaselineMs) {
                        _inputLagBaselineMs = lagMs;
                    }
                    _inputLagBaselineSamples++;
                }

                // If we have a baseline, look at *extra* lag beyond that
                let excessMs = lagMs;
                if (_inputLagBaselineSamples > 0) {
                    excessMs = lagMs - _inputLagBaselineMs;
                }

                let spriteCount = 0;
                try {
                    spriteCount = sprites.allSprites().length;
                } catch (e) {
                    // ignore; non-fatal
                }



                
                const shouldWarn =
                    excessMs > INPUT_LAG_WARN_EXCESS_MS &&
                    lagMs > INPUT_LAG_WARN_MS &&
                    Math.abs(lagMs - _lastInputLagWarnMs) > 50;

                if (DEBUG_NET && shouldWarn) {
                    _lastInputLagWarnMs = lagMs;

                    const hostWallNow = Date.now();
                    const seq = (msg as any).inputSeq ?? -1;
                    const sentWall = (msg as any).sentWallMs ?? null;

                    console.warn(
                        "[inputLag.net]",
                        "seq=", seq,
                        "playerId=", playerId,
                        "button=", btnName,
                        "pressed=", pressed,
                        "lagMs≈", lagMs.toFixed(1),
                        "baseline≈", _inputLagBaselineMs.toFixed(1),
                        "excessMs≈", excessMs.toFixed(1),
                        "sprites=", spriteCount,
                        "sentWallMs=", sentWall,
                        "hostWallMs=", hostWallNow
                    );
                }
            }

            // ---------------------------------------------------------
            // 2) Measure *host processing* time for this input
            // ---------------------------------------------------------
            const btn: any = ctrl[btnName];
            if (!btn || typeof btn._setPressed !== "function") return;

            const procStartMs =
                typeof performance !== "undefined" ? performance.now() : Date.now();

            btn._setPressed(pressed);    // <-- actual host-side work for this input

            const procEndMs =
                typeof performance !== "undefined" ? performance.now() : Date.now();
            const procMs = procEndMs - procStartMs;

            // Only log if host processing is unusually slow
            if (
                procMs > INPUT_PROC_WARN_MS &&
                Math.abs(procMs - _lastInputProcWarnMs) > INPUT_PROC_SPAM_GAP_MS
            ) {
                _lastInputProcWarnMs = procMs;

                let spriteCountForProc = 0;
                try {
                    spriteCountForProc = sprites.allSprites().length;
                } catch (e) {
                    // ignore
                }

                console.warn(
                    "[inputProc.net]",
                    "playerId=", playerId,
                    "button=", btnName,
                    "pressed=", pressed,
                    "procMs≈", procMs.toFixed(3),
                    lagMs >= 0 ? "lagMs≈ " + lagMs.toFixed(1) : "lagMs≈ n/a",
                    "sprites=", spriteCountForProc
                );
            }

            // (no extra return; we're done)
        }


    }
}

























// CHANGE THIS to your actual server IP/port as needed
//const _netClient = new NetworkClient("ws://localhost:8080");



const host = window.location.hostname || "localhost";



const _netClient = new NetworkClient(`ws://${host}:8080`);

let _lastSnapshotSentMs = 0;
let _snapshotSentCount = 0;


// Host perf tracking: approximate bandwidth + cadence
let _snapshotPerfAccumSnaps = 0;
let _snapshotPerfAccumBytes = 0;
let _snapshotPerfLastReportMs = 0;





// Called from game._tick() on the host to periodically send world snapshots
function _maybeSendWorldSnapshotTick() {
    const snapT0 = _hostPerfNowMs();

    const g: any = (globalThis as any);
    if (!g || !g.__isHost) return;

    const now = game.runtime();

    const intervalMs = 16; // ~60 snapshots per second

    const dt = now - _lastSnapshotSentMs;
    if (_lastSnapshotSentMs !== 0 && dt < intervalMs) return;
    _lastSnapshotSentMs = now;

    const snap = netWorld.capture();
    _snapshotSentCount++;

    const sprites = snap.sprites ? snap.sprites.length : 0;

    // Rough size estimate: base overhead + 1 "byte" per pixel index.
    let approxBytes = 0;
    if (snap.sprites) {
        for (const s of snap.sprites) {
            if (!s) continue;
            approxBytes += 32; // ids / coords / kind / etc.
            if (s.pixels && s.pixels.length) {
                approxBytes += s.pixels.length;
            }
        }
    }

    _snapshotPerfAccumSnaps++;
    _snapshotPerfAccumBytes += approxBytes;

    // Periodic perf report (~every 2 seconds)
    const sinceReport = now - _snapshotPerfLastReportMs;
    if (_snapshotPerfLastReportMs === 0) {
        _snapshotPerfLastReportMs = now;
    } else if (sinceReport >= 2000) {
        const snapsPerSec =
            (_snapshotPerfAccumSnaps * 1000) / Math.max(1, sinceReport);
        const kbPerSec =
            (_snapshotPerfAccumBytes * 1000) / Math.max(1, sinceReport) / 1024;

        console.log(
            "[net.host] PERF",
            "Hz≈",
            snapsPerSec.toFixed(1),
            "KB/s≈",
            kbPerSec.toFixed(2),
            "latestSprites=",
            sprites
        );

        _snapshotPerfAccumSnaps = 0;
        _snapshotPerfAccumBytes = 0;
        _snapshotPerfLastReportMs = now;
    }


    // Light cadence log so you can correlate with follower if needed
    if (_snapshotSentCount <= 3 || _snapshotSentCount % 300 === 0) {
        console.log(
            "[net.host] snapshot #",
            _snapshotSentCount,
            "sprites=",
            sprites,
            "dtMs=",
            dt
        );
    }

    const snapT1 = _hostPerfNowMs()

    _hostPerfAccumSnapMs += (snapT1 - snapT0)

    // Keep track of how many sprites are in the snapshot
    try {
        if (snap && snap.sprites && snap.sprites.length != null) {
            _hostPerfLastSnapshotSprites = snap.sprites.length
        }
    } catch (e) {
        // ignore
    }

    _netClient.sendWorldSnapshot(snap);

    



}





// Expose to the game loop
(globalThis as any).__net_maybeSendWorldSnapshot = _maybeSendWorldSnapshotTick;




export function initNetwork() {
    console.log("[net] initNetwork: connecting...");
    _netClient.connect();
    (globalThis as any).__net = _netClient;
}




export function img(lit: TemplateStringsArray) {
    return parseMakeCodeImage(lit);
}
(globalThis as any).img = img;
