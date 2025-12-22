// =====================================================================
// arcadeCompat.ts — PHASER COMPAT + GLUE LAYER (MakeCode Arcade semantics)
// =====================================================================
//
// FILE ROLE (single responsibility):
//   - Bridge MakeCode Arcade runtime semantics to Phaser runtime objects.
//   - Owns the lifecycle of "native sprites" that mirror Arcade Sprites.
//   - Owns network message ingest + dispatch into Arcade-style callbacks.
//   - Must NOT contain gameplay logic (HeroEngine + student code owns that).
//
// PRIMARY FLOW (call graph — keep masters logic-free):
//   Per Phaser frame (host):
//     _syncNativeSprites()
//       -> _syncBeginFrame()
//       -> _syncEarlySceneGuard()
//       -> _syncSpriteLoop()  // per-sprite attach/update/remove
//       -> _syncEndFrame()
//
//   Native sprite attach (on demand, per sprite):
//     _attachNativeSprite(sprite)
//       -> _attachBegin / _attachEarlySceneGuard
//       -> UI: status bars / combo meter (NO pixel upload)
//       -> Non-UI: _attachNativeSpriteNonUiPath(...) (may upload pixels)
//
// OWNERSHIP BOUNDARIES:
//   - Reads Arcade sprite state via Sprite + sprite.data keys.
//   - Writes Phaser state ONLY through nativeSprite creation/update + textures.
//   - Must treat Sprite.data as the source of truth for UI marker keys.
//
// PERFORMANCE INVARIANTS (do not violate without adding perf instrumentation):
//   - Any function called per-frame must not allocate textures unless required.
//   - UI sprites must never trigger pixel upload paths.
//   - Pixel uploads/logging must be gated behind a constant flag.
//   - Heavy debug (per-pixel / per-row logs) MUST remain OFF by default.
//
// KEY REGISTRY (stable contracts; helpers must not invent new keys ad hoc):
//   - UI_KIND_KEY / UI_KIND_STATUSBAR / UI_KIND_COMBO_METER
//   - STATUS_BAR_DATA_KEY (must match status-bars.ts)
//   - UI_COMBO_* keys
//
// PHASER-ONLY NOTES:
//   - Depends on (globalThis as any).__phaserScene being present.
//   - Safe no-op if scene missing (Arcade can run headless).
// =====================================================================


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

// Debug the "Extra" category
const DEBUG_CATEGORY_X = false;

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

// PERF: how many sprites were destroyed due to lifespan expiry since last perf.syncSteps dump
const PERF_LIFE_DESTROY_CALLS_KEY = "__perfLifeDestroyCalls";



// === UI marker keys (shared) ===
const UI_KIND_KEY = "__uiKind";
const UI_KIND_STATUSBAR = "statusbar";
const UI_KIND_COMBO_METER = "comboMeter";
const UI_KIND_AGI_AIM_INDICATOR = "agiAimIndicator";
// === Text sprite UI marker ===
const UI_KIND_TEXT = "text";


// === Agility aim indicator sprite data keys ===
const UI_AIM_VISIBLE_KEY = "__aimVis";       // 0/1
const UI_AIM_DIR_X1000_KEY = "__aimDx1000";  // -1000..1000
const UI_AIM_DIR_Y1000_KEY = "__aimDy1000";  // -1000..1000
const UI_AIM_ANGLE_MDEG_KEY = "__aimAngleMdeg"; // milli-deg (future 360)
const UI_AIM_LEN_KEY = "__aimLen";           // optional length



// === Combo meter sprite data keys ===
const UI_COMBO_TOTAL_W_KEY = "__comboTotalW";
const UI_COMBO_H_KEY = "__comboH";

const UI_COMBO_W_E_KEY = "__comboWE";
const UI_COMBO_W_1_KEY = "__comboW1";
const UI_COMBO_W_2_KEY = "__comboW2";
const UI_COMBO_W_3_KEY = "__comboW3";

const UI_COMBO_POS_X1000_KEY = "__comboPosX1000";
const UI_COMBO_VISIBLE_KEY = "__comboVisible";
const UI_COMBO_PKT_COUNT_KEY = "__comboPktCount"; // optional (only if you decide to render count in Phaser)

// === Status bar data key (must match status-bars.ts exactly) ===
const STATUS_BAR_DATA_KEY = "STATUS_BAR_DATA_KEY";


// === Text sprite data keys (written by text.ts; read by Phaser UI attach/sync) ===
const UI_TEXT_STR_KEY = "__txt";          // string
const UI_TEXT_VER_KEY = "__txtVer";       // number; bump to mark dirty

const UI_TEXT_FG_KEY = "__txtFg";         // number; MakeCode palette index (0-15)
const UI_TEXT_BG_KEY = "__txtBg";         // number; palette index (0-15) or -1 for "none"

const UI_TEXT_MAX_H_KEY = "__txtMaxH";    // number; "maxFontHeight" from textsprite
const UI_TEXT_MAX_W_KEY = "__txtMaxW";    // number; optional (0 = no wrap/fixed width)

const UI_TEXT_PAD_KEY = "__txtPad";       // number; padding px

const UI_TEXT_BORDER_W_KEY = "__txtBW";   // number; border width px (0 = none)
const UI_TEXT_BORDER_C_KEY = "__txtBC";   // number; border color palette index (0-15)

const UI_TEXT_OUTLINE_W_KEY = "__txtOW";  // number; outline/stroke width px (0 = none)
const UI_TEXT_OUTLINE_C_KEY = "__txtOC";  // number; outline/stroke color palette index (0-15)

const UI_TEXT_ALIGN_KEY = "__txtAlign";   // number; 0=left, 1=center, 2=right

// (Reserved for later if we decide to support icon sprites in Phaser text containers)
const UI_TEXT_ICON_KIND_KEY = "__txtIconKind";




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



// ======================================================
// SYNC PERF BREAKDOWN (Heroes / Enemies / Bars / Extras)
// ======================================================

const PERF_GROUP_HERO = 0 as const;
const PERF_GROUP_ENEMY = 1 as const;
const PERF_GROUP_BARS = 2 as const;
const PERF_GROUP_EXTRA = 3 as const;

type PerfGroup =
    | typeof PERF_GROUP_HERO
    | typeof PERF_GROUP_ENEMY
    | typeof PERF_GROUP_BARS
    | typeof PERF_GROUP_EXTRA;

function _perfGroupName(g: PerfGroup): "H" | "E" | "B" | "X" {
    return g === PERF_GROUP_HERO
        ? "H"
        : (g === PERF_GROUP_ENEMY
            ? "E"
            : (g === PERF_GROUP_BARS ? "B" : "X"));
}

function _perfGroupFromRole(role: string): PerfGroup {
    // Roles: HERO / ENEMY / ACTOR / PROJECTILE / OVERLAY / BAR / etc.
    if (role === "HERO") return PERF_GROUP_HERO;
    if (role === "ENEMY" || role === "ACTOR") return PERF_GROUP_ENEMY;
    if (role === "BAR") return PERF_GROUP_BARS;
    return PERF_GROUP_EXTRA;
}

// "current group" for the _attachNativeSprite call; set by _syncNativeSprites before calling attach
let _syncAttachPerfGroup: PerfGroup = PERF_GROUP_EXTRA;

// Per-frame accumulators (reset in _syncNativeSprites)
let _frameGroupAttachMs = [0, 0, 0, 0];       // total attach time
let _frameGroupAttachTexMs = [0, 0, 0, 0];    // texture create/recreate time
let _frameGroupAttachPixelMs = [0, 0, 0, 0];  // pixel upload time

let _frameGroupAttachCalls = [0, 0, 0, 0];
let _frameGroupAttachCreates = [0, 0, 0, 0];
let _frameGroupAttachUpdates = [0, 0, 0, 0];
let _frameGroupAttachEarlyOuts = [0, 0, 0, 0];




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


function _debugDumpCategoryX(ctx: SyncContext, allSprites: Sprite[]): void {
    const DEBUG_CATEGORY_X = false;
    const DEBUG_CATEGORY_X_SAMPLES = false;

    if (!DEBUG_CATEGORY_X || !ctx.shouldLog) return;

    // ---- helpers (NO external UI constants) ----
    const isHero = (s: any) => { try { return !!(isHeroSprite as any)(s); } catch { return false; } };

    const readData = (s: any, k: string): any => {
        try {
            const d = s?.data;
            if (!d) return undefined;
            if (typeof d.get === "function") return d.get(k);
            return (d as any)[k];
        } catch { return undefined; }
    };

    const hasDataKey = (s: any, k: string): boolean => {
        try {
            const d = s?.data;
            if (!d) return false;
            if (typeof d.has === "function") return !!d.has(k);
            return Object.prototype.hasOwnProperty.call(d, k);
        } catch { return false; }
    };

    // Local category classifier that matches *your* project reality.
    // Returns: "H" | "E" | "B" | "X"
    const catOf = (s: any): "H" | "E" | "B" | "X" => {
        if (!s) return "X";
        if (isHero(s)) return "H";

        // Bars: your samples show STATUS_BAR_DATA_KEY and __uiKind.
        if (hasDataKey(s, "STATUS_BAR_DATA_KEY")) return "B";
        if (hasDataKey(s, "__uiKind")) return "B";

        // Also treat kind 11000 as bar (matches your dump).
        if (((s.kind | 0) === 11000)) return "B";

        // Enemies: your enemy sample has monsterId.
        if (hasDataKey(s, "monsterId")) return "E";

        return "X";
    };

    const getDataKeys = (s: any): string[] => {
        try {
            const d = s?.data;
            if (!d) return [];
            if (typeof d.keys === "function") {
                const out: string[] = [];
                for (const k of d.keys()) out.push(String(k));
                return out;
            }
            return Object.keys(d);
        } catch { return []; }
    };

    // ---- pass 1: counts for TRUE-X only, plus sanity counts for H/E/B ----
    const countsX: Record<number, number> = {};
    const samplesByKindX: Record<number, any[]> = {};
    let totalX = 0;

    let sanityH = 0, sanityE = 0, sanityB = 0;

    for (const s of allSprites as any[]) {
        const c = catOf(s);
        if (c === "H") { sanityH++; continue; }
        if (c === "E") { sanityE++; continue; }
        if (c === "B") { sanityB++; continue; }

        // X
        totalX++;
        const kind = (s.kind | 0);
        countsX[kind] = (countsX[kind] || 0) + 1;

        if (DEBUG_CATEGORY_X_SAMPLES) {
            const arr = (samplesByKindX[kind] ||= []);
            if (arr.length < 8) arr.push({ s, keys: getDataKeys(s) });
        }
    }

    const entries = Object.entries(countsX)
        .map(([k, v]) => [Number(k), v] as [number, number])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([kind, n]) => `kind${kind}:${n}`);

    console.log(
        "[DEBUG X]",
        `trueX=${totalX}`,
        `| sanity(H/E/B)= ${sanityH}/${sanityE}/${sanityB}`,
        "|", entries.join(" ")
    );

    if (!DEBUG_CATEGORY_X_SAMPLES) return;

    // ---- choose kinds to sample (always include 56 if it’s in TRUE-X) ----
    const sortedKindsX = Object.entries(countsX)
        .map(([k, v]) => [Number(k), v] as [number, number])
        .sort((a, b) => b[1] - a[1])
        .map(([k]) => k);

    const chosen: number[] = [];
    const push = (k: number) => { if (!chosen.includes(k)) chosen.push(k); };

    if (countsX[56]) push(56);
    for (const k of sortedKindsX) {
        if (chosen.length >= 3) break;
        push(k);
    }

    const MAX = 5;

    for (const kind of chosen) {
        const arr = samplesByKindX[kind];
        if (!arr?.length) continue;

        const lines: string[] = [];
        lines.push(`[DEBUG X:SAMPLES] TRUE-X kind${kind} count=${countsX[kind]} showing<=${MAX}`);

        for (let i = 0; i < Math.min(MAX, arr.length); i++) {
            const s: any = arr[i].s;
            const keys: string[] = arr[i].keys;

            const img = s?.image;
            const flags = (s?.flags | 0);

            lines.push(
                `  - id=${s?.id ?? "?"} kind=${kind} ` +
                `pos=(${s?.x},${s?.y}) z=${s?.z} ` +
                `img=${img?.width}x${img?.height} ` +
                `flags=0x${(flags >>> 0).toString(16)} ` +
                `keys=[${keys.slice(0, 12).join(",")}]`
            );
        }

        console.log(lines.join("\n"));
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



// --------------------------------------------------------------
// MakeCode Arcade compat: Image.drawRect
// --------------------------------------------------------------

interface Image {
    drawRect(x: number, y: number, w: number, h: number, c: number): void
}

(Image as any).prototype.drawRect = function (
    x: number,
    y: number,
    w: number,
    h: number,
    c: number
): void {
    if (!this || w <= 0 || h <= 0) return

    const x2 = x + w - 1
    const y2 = y + h - 1

    // Top + bottom
    for (let px = x; px <= x2; px++) {
        this.setPixel(px, y, c)
        this.setPixel(px, y2, c)
    }

    // Left + right
    for (let py = y; py <= y2; py++) {
        this.setPixel(x, py, c)
        this.setPixel(x2, py, c)
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

        // STATUS BARS FIRST (your desired "B" group)
        if (kindName === "StatusBar" || dataKeys.indexOf(STATUS_BAR_DATA_KEY) >= 0) return "BAR";

        // Direct kind-name checks
        if (kindName === "HeroAura" || kindName.indexOf("Aura") >= 0) return "AURA";
        if (kindName === "HeroWeapon" || kindName.indexOf("Weapon") >= 0) return "PROJECTILE";
        if (kindName === "Player" || kindName === "Hero") return "HERO";
        if (kindName.indexOf("Enemy") >= 0) return "ENEMY";

        // Use data flags as heuristics (engine-specific)
        if (dataKeys.indexOf("maxHp") >= 0 && dataKeys.indexOf("hp") >= 0) {
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




//##########################################################################################################################################



type AttachContext = {
    sc: Phaser.Scene;
    s: Sprite;
    g: number;
    tA0: number;
    shouldLog: boolean;
    dataAny: any;
};


type UiDetect = {
    uiKind: string;
    isStatusBarSprite: boolean;
    isComboMeterSprite: boolean;
    isAgiAimIndicatorSprite: boolean;
    isTextSprite: boolean;
};



// ---------------------------------------------------------------------
// MASTER: _attachNativeSprite (on-demand per-sprite attach/update)
// PURPOSE: Ensure Arcade sprite has Phaser native; route UI vs non-UI attach.
// READS:  globalThis.__phaserScene, sprite.kind, sprite.data (UI markers), sprite.image
// WRITES: sprite.native lifecycle via helpers; native data uiManaged/uiKind for UI
// PERF:
//   - Called: during sync loop (can be many times/frame) but should early-out fast
//   - Must remain call-graph only (no inline logic)
// SAFETY:
//   - Must early-return safely when scene missing
// CALL GRAPH:
//   _attachBegin
//   _attachEarlySceneGuard
//   _attachDetectUi
//   _attachUiEarlyUpdateIfExisting
//     ├─ _attachCreateStatusBar
//     └─ _attachCreateComboMeter
//   _attachNativeSpriteNonUiPath
// ---------------------------------------------------------------------
function _attachNativeSprite(s: Sprite): void {
    const ctx = _attachBegin(s);

    if (!_attachEarlySceneGuard(ctx)) return;

    const ui = _attachDetectUi(ctx);

    // If we've already attached a UI-managed native (Container), early-out.
    if (_attachUiEarlyUpdateIfExisting(ctx)) return;

    // Create UI natives (NO pixel upload)
    if (_attachCreateStatusBar(ctx, ui)) return;
    if (_attachCreateComboMeter(ctx, ui)) return;
    if (_attachCreateAgiAimIndicator(ctx, ui)) return;
    if (_attachCreateText(ctx, ui)) return;

    // Step 5+ work lives here for now (unchanged legacy body)
    _attachNativeSpriteNonUiPath(ctx.sc, ctx.s, ctx.g, ctx.tA0);
}



function _attachBegin(s: Sprite): AttachContext {
    const sc: Phaser.Scene = (globalThis as any).__phaserScene;
    _attachCallCount++;

    // Defensive: ensure group index is valid (0..3)
    let g = (_syncAttachPerfGroup as any) | 0;
    if (g !== 0 && g !== 1 && g !== 2 && g !== 3) g = PERF_GROUP_EXTRA;

    _frameGroupAttachCalls[g]++;

    const tA0 = _hostPerfNowMs();

    const dataAny = (s as any).data || {};

    return {
        sc,
        s,
        g,
        tA0,
        shouldLog: (_attachCallCount <= MAX_ATTACH_VERBOSE),
        dataAny,
    };
}


function _attachEarlySceneGuard(ctx: AttachContext): boolean {
    const sc: any = ctx.sc;
    if (!sc) {
        if (ctx.shouldLog) {
            console.log("[_attachNativeSprite] NO SCENE — skipping for sprite", ctx.s.id);
        }
        _attachFinalizeEarlyOutOnly(ctx);
        return false;
    }
    return true;
}



// PURPOSE: Classify sprite as UI-managed (status bar / combo meter) vs non-UI.
// READS:
//   - sprite.data[STATUS_BAR_DATA_KEY] (status bar marker)
//   - sprite.data["uiKind"] (if present) and/or native.getData("uiKind")
// WRITES: returns UiDetect (no side effects)
// PERF:
//   - Called: per attach decision
//   - Must not: allocate textures, upload pixels
// SAFETY:
//   - Must tolerate sprite.data missing / malformed
// ---------------------------------------------------------------------
function _attachDetectUi(ctx: AttachContext): UiDetect {
    const s = ctx.s;
    const dataAny = ctx.dataAny;

    const uiKind = (() => {
        try { return sprites.readDataString(s, UI_KIND_KEY) || ""; } catch { return ""; }
    })();

    const hasStatusBarData = !!(dataAny && dataAny[STATUS_BAR_DATA_KEY]);
    const kindIsStatusBar = (() => {
        try { return (s.kind as any) === (SpriteKind as any).StatusBar; } catch { return false; }
    })();

    const kindIsText = (() => {
        try { return (s.kind as any) === (SpriteKind as any).Text; } catch { return false; }
    })();

    return {
        uiKind,
        isStatusBarSprite: (hasStatusBarData || kindIsStatusBar),
        isComboMeterSprite: (uiKind === UI_KIND_COMBO_METER),
        isAgiAimIndicatorSprite: (uiKind === UI_KIND_AGI_AIM_INDICATOR),
        isTextSprite: (uiKind === UI_KIND_TEXT || kindIsText),
    };
}



function _attachUiEarlyUpdateIfExisting(ctx: AttachContext): boolean {
    const s = ctx.s;

    const existingNative: any = s.native;
    if (existingNative && existingNative.getData && existingNative.getData("uiManaged")) {
        existingNative.x = s.x;
        existingNative.y = s.y;

        _attachFinalizeEarlyOutUpdate(ctx);
        return true;
    }

    return false;
}


function _mcToHex(p: number): number {
    const pal = MAKECODE_PALETTE as any[];
    const c = pal && pal[p] ? pal[p] : null;
    if (!c) return 0xffffff;
    const r = (c[0] | 0) & 255;
    const g2 = (c[1] | 0) & 255;
    const b = (c[2] | 0) & 255;
    return (r << 16) | (g2 << 8) | b;
}


function _hexToCss(hex: number): string {
    const h = (hex >>> 0) & 0xffffff;
    return "#" + h.toString(16).padStart(6, "0");
}

function _readDataString0(s: Sprite, key: string, dflt: string): string {
    try {
        const v = sprites.readDataString(s, key);
        return (v === undefined || v === null) ? dflt : ("" + v);
    } catch {
        return dflt;
    }
}

function _readDataNumber0(s: Sprite, key: string, dflt: number): number {
    try {
        const v = sprites.readDataNumber(s, key);
        return (v === undefined || v === null) ? dflt : (v as any as number);
    } catch {
        return dflt;
    }
}





// PURPOSE: Create Phaser-native rectangles for a status bar UI sprite (no pixels).
// READS:
//   - sprite.data[STATUS_BAR_DATA_KEY] (dimensions/colors/max/current)
//   - sprite.flags (RelativeToCamera/Invisible), sprite.z
// WRITES:
//   - native.setData("uiManaged", true), native.setData("uiKind", UI_KIND_STATUSBAR)
//   - native.setData("sb_bg"|"sb_border"|"sb_fill", rect refs)
//   - native depth/scrollFactor/visible
// PERF:
//   - Called: on attach (and possibly recreate)
//   - Must never: upload pixels or create canvas textures
// SAFETY:
//   - Must tolerate missing sb fields; choose defaults safely
// ---------------------------------------------------------------------
function _attachCreateStatusBar(ctx: AttachContext, ui: UiDetect): boolean {
    if (!ui.isStatusBarSprite) return false;

    const sc = ctx.sc;
    const s = ctx.s;

    const dataAny: any = ctx.dataAny;
    const sb: any = dataAny[STATUS_BAR_DATA_KEY];
    if (!sb) return false;

    // Read geometry + colors from sb object
    const barW = (sb.barWidth | 0) || ((sb._barWidth | 0) || 20);
    const barH = (sb.barHeight | 0) || ((sb._barHeight | 0) || 4);
    const bw = (sb.borderWidth | 0) || 0;

    const borderColorIdx =
        (sb.borderColor === undefined || sb.borderColor === null)
            ? (sb.offColor | 0)
            : (sb.borderColor | 0);

    const onHex = _mcToHex((sb.onColor | 0) || 0);
    const offHex = _mcToHex((sb.offColor | 0) || 0);
    const borderHex = _mcToHex(borderColorIdx | 0);

    const container = sc.add.container(s.x, s.y);
    (container as any).setData("uiManaged", true);
    (container as any).setData("uiKind", UI_KIND_STATUSBAR);

    // Store geometry so sync can be consistent and cheap (container-local model)
    (container as any).setData("sb_w", barW);
    (container as any).setData("sb_h", barH);
    (container as any).setData("sb_bw", bw);

    const innerW = Math.max(1, barW - (bw * 2));
    const innerH = Math.max(1, barH - (bw * 2));
    const leftX = (-barW / 2) + bw;

    const borderRect = sc.add.rectangle(0, 0, barW, barH, borderHex, 1);
    borderRect.setOrigin(0.5, 0.5);

    const bgRect = sc.add.rectangle(leftX, 0, innerW, innerH, offHex, 1);
    bgRect.setOrigin(0, 0.5);

    const fillRect = sc.add.rectangle(leftX, 0, innerW, innerH, onHex, 1);
    fillRect.setOrigin(0, 0.5);

    // IMPORTANT: initialize fill width based on current/max (prevents “full red forever”)
    const cur = (sb.current | 0);
    const max = Math.max(1, (sb.max | 0));
    const pct = Math.max(0, Math.min(1, cur / max));
    fillRect.width = Math.floor(innerW * pct);

    container.add(borderRect);
    container.add(bgRect);
    container.add(fillRect);

    (container as any).setData("sb_border", borderRect);
    (container as any).setData("sb_bg", bgRect);
    (container as any).setData("sb_fill", fillRect);

    // Depth + scroll factor
    try { (container as any).setDepth(s.z | 0); } catch { /* ignore */ }

    const relToCam = !!(s.flags & SpriteFlag.RelativeToCamera);
    try { (container as any).setScrollFactor(relToCam ? 0 : 1, relToCam ? 0 : 1); } catch { /* ignore */ }

    // Respect Invisible at creation time
    const isInvisible = !!(s.flags & SpriteFlag.Invisible);
    try { (container as any).setVisible(!isInvisible); } catch { /* ignore */ }

    (s as any).native = container;

    // Prevent pixel-based hide/removal
    try { (s as any)._lastNonZeroPixels = 1; } catch { /* ignore */ }

    _attachFinalizeCreate(ctx);
    return true;
}




// PURPOSE: Create Phaser-native rectangles for combo meter UI sprite (no pixels).
// READS:
//   - sprites.readDataNumber(s, UI_COMBO_*_KEY) for geometry thresholds
//   - sprite.flags (RelativeToCamera/Invisible), sprite.z
// WRITES:
//   - native.setData("uiManaged", true), native.setData("uiKind", UI_KIND_COMBO_METER)
//   - native.setData("cm_segs"|"cm_border"|"cm_ptr", rect refs)
//   - native depth/scrollFactor/visible
// PERF:
//   - Called: on attach (and possibly recreate)
//   - Must never: upload pixels or create canvas textures
// SAFETY:
//   - Must tolerate missing combo keys; default geometry safely
// ---------------------------------------------------------------------
function _attachCreateComboMeter(ctx: AttachContext, ui: UiDetect): boolean {
    if (!ui.isComboMeterSprite) return false;

    const sc = ctx.sc;
    const s = ctx.s;

    // Read meter geometry from sprite data
    const totalW = (sprites.readDataNumber(s, UI_COMBO_TOTAL_W_KEY) | 0) || 30;
    const h = (sprites.readDataNumber(s, UI_COMBO_H_KEY) | 0) || 5;

    const wE = (sprites.readDataNumber(s, UI_COMBO_W_E_KEY) | 0) || 3;
    const w1 = (sprites.readDataNumber(s, UI_COMBO_W_1_KEY) | 0) || 4;
    const w2 = (sprites.readDataNumber(s, UI_COMBO_W_2_KEY) | 0) || 5;
    const w3 = (sprites.readDataNumber(s, UI_COMBO_W_3_KEY) | 0) || 6;

    // Colors (match Arcade drawAgiMeterImage)
    const colE = _mcToHex(2);
    const col1 = _mcToHex(7);
    const col2 = _mcToHex(9);
    const col3 = _mcToHex(3);
    const colBorder = _mcToHex(1);
    const colPtr = _mcToHex(5);

    const container = sc.add.container(s.x, s.y);
    (container as any).setData("uiManaged", true);
    (container as any).setData("uiKind", UI_KIND_COMBO_METER);

    // Border (stroke only)
    const borderRect = sc.add.rectangle(0, 0, totalW, h, colBorder, 0);
    borderRect.setOrigin(0.5, 0.5);
    borderRect.setStrokeStyle(1, colBorder, 1);

    // Segment rectangles (origin left-anchored)
    const left = -totalW / 2;
    const makeSeg = (xLeft: number, w: number, hex: number) => {
        const r = sc.add.rectangle(xLeft, 0, Math.max(1, w), Math.max(1, h), hex, 1);
        r.setOrigin(0, 0.5);
        return r;
    };

    // Layout: E 1 2 3 2 1 E
    let x = left;
    const seg0 = makeSeg(x, wE, colE); x += wE;
    const seg1 = makeSeg(x, w1, col1); x += w1;
    const seg2 = makeSeg(x, w2, col2); x += w2;
    const seg3 = makeSeg(x, w3, col3); x += w3;
    const seg4 = makeSeg(x, w2, col2); x += w2;
    const seg5 = makeSeg(x, w1, col1); x += w1;
    const seg6 = makeSeg(x, wE, colE);

    // Pointer (thin rect) — exact mirror of old behavior
    const ptr = sc.add.rectangle(left + 0.5, 0, 1, Math.max(1, h), colPtr, 1);
    ptr.setOrigin(0.5, 0.5);


    container.add(borderRect);
    container.add(seg0); container.add(seg1); container.add(seg2); container.add(seg3);
    container.add(seg4); container.add(seg5); container.add(seg6);
    container.add(ptr);

    // Store refs + last-geom for updates
    (container as any).setData("cm_border", borderRect);
    (container as any).setData("cm_ptr", ptr);
    (container as any).setData("cm_segs", [seg0, seg1, seg2, seg3, seg4, seg5, seg6]);

    (container as any).setData("cm_lastTotalW", totalW);
    (container as any).setData("cm_lastH", h);
    (container as any).setData("cm_lastWE", wE);
    (container as any).setData("cm_lastW1", w1);
    (container as any).setData("cm_lastW2", w2);
    (container as any).setData("cm_lastW3", w3);

    // Depth + scroll factor
    try {
        (container as any).setDepth(s.z | 0);
    } catch { /* ignore */ }

    const relToCam = !!(s.flags & SpriteFlag.RelativeToCamera);
    try {
        (container as any).setScrollFactor(relToCam ? 0 : 1, relToCam ? 0 : 1);
    } catch { /* ignore */ }

    s.native = container;

    // Mark as non-empty so any pixel-based visibility logic doesn't hide it
    (s as any)._lastNonZeroPixels = 1;

    _attachFinalizeCreate(ctx);
    return true;
}



// PURPOSE: Create Phaser-native arrow for Agility aim indicator UI sprite (no pixels).
// READS:
//   - sprites.readDataNumber(s, UI_AIM_*_KEY) for visible/length (optional)
//   - sprite.flags (RelativeToCamera), sprite.z
// WRITES:
//   - native.setData("uiManaged", true), native.setData("uiKind", UI_KIND_AGI_AIM_INDICATOR)
//   - native.setData("ai_*", refs + geometry)
//   - native depth/scrollFactor/visible
// PERF:
//   - Called: on attach (and possibly recreate)
//   - Must never: upload pixels or create canvas textures
// SAFETY:
//   - Must tolerate missing keys; default geometry safely
// ---------------------------------------------------------------------
function _attachCreateAgiAimIndicator(ctx: AttachContext, ui: UiDetect): boolean {
    if (!ui.isAgiAimIndicatorSprite) return false;

    const sc = ctx.sc;
    const s = ctx.s;

    const len = (sprites.readDataNumber(s, UI_AIM_LEN_KEY) | 0) || 14;

    // Use Graphics so head + shaft are guaranteed aligned.
    const thickness = 4;
    const headL = 6;
    const headW = 10; // wider head looks nicer and avoids “thin triangle” artifacts

    const col = _mcToHex(5);

    const container = sc.add.container(s.x, s.y);
    (container as any).setData("uiManaged", true);
    (container as any).setData("uiKind", UI_KIND_AGI_AIM_INDICATOR);

    const gfx = sc.add.graphics();
    container.add(gfx);

    function _drawArrow(g: Phaser.GameObjects.Graphics, L: number) {
        const shaftW = Math.max(1, L - headL);

        g.clear();
        g.fillStyle(col, 1);

        // Shaft: centered on y=0, starts at x=0 (tail)
        g.fillRect(0, -thickness / 2, shaftW, thickness);

        // Head triangle: base is at x=shaftW, tip at x=shaftW+headL
        g.beginPath();
        g.moveTo(shaftW, -headW / 2);
        g.lineTo(shaftW, +headW / 2);
        g.lineTo(shaftW + headL, 0);
        g.closePath();
        g.fillPath();
    }

    _drawArrow(gfx, len);

    (container as any).setData("ai_gfx", gfx);
    (container as any).setData("ai_lastLen", len);
    (container as any).setData("ai_thickness", thickness);
    (container as any).setData("ai_headL", headL);
    (container as any).setData("ai_headW", headW);
    (container as any).setData("ai_color", col);

    try { (container as any).setDepth(s.z | 0); } catch { /* ignore */ }

    const relToCam = !!(s.flags & SpriteFlag.RelativeToCamera);
    try { (container as any).setScrollFactor(relToCam ? 0 : 1, relToCam ? 0 : 1); } catch { /* ignore */ }

    const vis = ((sprites.readDataNumber(s, UI_AIM_VISIBLE_KEY) | 0) !== 0);
    try { (container as any).setVisible(vis); } catch { /* ignore */ }

    (s as any).native = container;

    try { (s as any)._lastNonZeroPixels = 1; } catch { /* ignore */ }

    _attachFinalizeCreate(ctx);
    return true;
}



function _attachCreateText(ctx: AttachContext, ui: UiDetect): boolean {
    if (!ui.isTextSprite) return false;

    const sc = ctx.sc;
    const s = ctx.s;

    const txt = _readDataString0(s, UI_TEXT_STR_KEY, "");

    const fgIdx = (_readDataNumber0(s, UI_TEXT_FG_KEY, 1) | 0) & 15;
    const bgIdxRaw = (_readDataNumber0(s, UI_TEXT_BG_KEY, 0) | 0);
    const bgIdx = bgIdxRaw & 15;

    const maxH = Math.max(1, _readDataNumber0(s, UI_TEXT_MAX_H_KEY, 8) | 0);
    const pad = Math.max(0, _readDataNumber0(s, UI_TEXT_PAD_KEY, 0) | 0);

    const bw = Math.max(0, _readDataNumber0(s, UI_TEXT_BORDER_W_KEY, 0) | 0);
    const bcIdx = (_readDataNumber0(s, UI_TEXT_BORDER_C_KEY, 1) | 0) & 15;

    const ow = Math.max(0, _readDataNumber0(s, UI_TEXT_OUTLINE_W_KEY, 0) | 0);
    const ocIdx = (_readDataNumber0(s, UI_TEXT_OUTLINE_C_KEY, 0) | 0) & 15;

    const ver = (_readDataNumber0(s, UI_TEXT_VER_KEY, 0) | 0);

    // PERF: Never tie text raster resolution to camera zoom. That explodes work under zoom.
    const renderScale = 1;

    const fgCss = _hexToCss(_mcToHex(fgIdx));
    const ocCss = _hexToCss(_mcToHex(ocIdx));

    const fontPx = Math.max(1, maxH | 0);
    const strokePx = Math.max(0, ow | 0);

    const container = sc.add.container(s.x, s.y);
    (container as any).setData("uiManaged", true);
    (container as any).setData("uiKind", UI_KIND_TEXT);

    // Phaser text object
    const txtObj = sc.add.text(0, 0, txt, {
        fontFamily: "Arial",
        fontSize: `${fontPx}px`,
        color: fgCss,
        stroke: (ow > 0) ? ocCss : undefined as any,
        strokeThickness: (ow > 0) ? strokePx : 0,
    } as any);

    txtObj.setOrigin(0.5, 0.5);

    // Compute box size in display units
    const tw = Math.max(1, (txtObj as any).displayWidth || (txtObj as any).width || 1);
    const th = Math.max(1, (txtObj as any).displayHeight || (txtObj as any).height || 1);

    const boxW = Math.max(1, tw + pad * 2);
    const boxH = Math.max(1, th + pad * 2);

    // Optional background (MakeCode bg=0 is transparent)
    let bgRect: Phaser.GameObjects.Rectangle | null = null;
    if ((bgIdxRaw | 0) !== 0) {
        const bgHex = _mcToHex(bgIdx);
        bgRect = sc.add.rectangle(0, 0, boxW, boxH, bgHex, 1);
        bgRect.setOrigin(0.5, 0.5);
        container.add(bgRect);
    }

    // Optional border rectangle (stroke only)
    let borderRect: Phaser.GameObjects.Rectangle | null = null;
    if (bw > 0) {
        const bcHex = _mcToHex(bcIdx);
        borderRect = sc.add.rectangle(0, 0, boxW, boxH, 0, 0);
        borderRect.setOrigin(0.5, 0.5);
        borderRect.setStrokeStyle(bw, bcHex, 1);
        container.add(borderRect);
    }

    // Text on top
    container.add(txtObj);

    // Store refs + last-style for sync step
    (container as any).setData("tx_text", txtObj);
    (container as any).setData("tx_bg", bgRect);
    (container as any).setData("tx_border", borderRect);

    (container as any).setData("tx_lastVer", ver);
    (container as any).setData("tx_renderScale", renderScale);

    // Depth + scroll factor
    try { (container as any).setDepth(s.z | 0); } catch { /* ignore */ }

    const relToCam = !!(s.flags & SpriteFlag.RelativeToCamera);
    try { (container as any).setScrollFactor(relToCam ? 0 : 1, relToCam ? 0 : 1); } catch { /* ignore */ }

    // Initial visibility
    const invisible = !!(s.flags & SpriteFlag.Invisible);
    try { (container as any).setVisible(!invisible); } catch { /* ignore */ }

    s.native = container;

    // Prevent any pixel-based "empty image" cleanup from nuking it
    (s as any)._lastNonZeroPixels = 1;

    _attachFinalizeCreate(ctx);
    return true;
}




function _attachFinalizeEarlyOutOnly(ctx: AttachContext): void {
    _frameAttachEarlyOutCount++;
    _frameGroupAttachEarlyOuts[ctx.g]++;
}


function _attachFinalizeEarlyOutUpdate(ctx: AttachContext): void {
    const dtA = _hostPerfNowMs() - ctx.tA0;

    _frameAttachMsAccum += dtA;
    _frameAttachEarlyOutCount++;

    _frameGroupAttachMs[ctx.g] += dtA;
    _frameGroupAttachEarlyOuts[ctx.g]++;

    if (ctx.shouldLog) {
        console.log("[attach] early-out update", { g: ctx.g, dtA });
    }
}


function _attachFinalizeCreate(ctx: AttachContext): void {
    const dtA = _hostPerfNowMs() - ctx.tA0;

    _frameAttachMsAccum += dtA;
    _frameAttachCreateCount++;

    _frameGroupAttachMs[ctx.g] += dtA;
    _frameGroupAttachCreates[ctx.g]++;

    if (ctx.shouldLog) {
        console.log("[attach] created", { g: ctx.g, dtA });
    }
}



// PURPOSE: Attach/update a non-UI sprite using canvas texture + pixel upload.
// READS:  sprite.image pixels (via upload helper), sprite.kind, sprite.flags, sprite.z
// WRITES:
//   - (re)creates Phaser CanvasTexture "sprite_<id>"
//   - uploads pixels into texture (expensive path)
//   - ensures Phaser native sprite exists + is sized correctly
// PERF:
//   - Called: on attach/update for non-UI sprites (can be frequent)
//   - This is the ONLY place pixel upload is allowed
// SAFETY:
//   - Must guard against missing image / invalid dimensions
//   - Must contain exceptions from Phaser texture/native ops
// ---------------------------------------------------------------------
function _attachNativeSpriteNonUiPath(sc: Phaser.Scene, s: Sprite, g: number, tA0: number): void {
    const ctx: AttachContext = {
        sc,
        s,
        g,
        tA0,
        shouldLog: (_attachCallCount <= MAX_ATTACH_VERBOSE),
        dataAny: (s as any).data || {},
    };

    if (!_attachImageGuard(ctx)) return;
    if (_attachHeroSkipPath(ctx)) return;

    const kind: number = (s.kind as any) | 0;
    const kindName: string = (() => { try { return (SpriteKind as any)[kind] || ""; } catch { return ""; } })();

    const w = (s.image.width | 0);
    const h = (s.image.height | 0);

    const texKey = "sprite_" + s.id;

    if (_attachEarlyOutOnNativeTexMismatch(ctx, texKey)) return;
    if (!_attachValidateImageDims(ctx, w, h)) return;

    _attachVerboseStart(ctx, s.id | 0, kind, kindName, w, h);

    const tex = _attachGetOrRecreateCanvasTexture(ctx, texKey, w, h);
    if (!tex) {
        _attachFinalizeEarlyOutOnly(ctx);
        return;
    }

    const nonZeroAttach = _attachUploadPixelsToTexture(ctx, tex, w, h);

    _attachDestroyNativeIfWrongSize(ctx, w, h);

    const { native, didCreate } = _attachGetOrCreateNative(ctx, texKey, kind);
    _attachApplyDepthAndScroll(ctx, native);

    _attachDebugOptional(ctx, kind, kindName, texKey, native, nonZeroAttach, w, h);

    if (didCreate) _attachFinalizeCreate(ctx);
    else _attachFinalizeUpdate(ctx);
}




// PURPOSE: Copy MakeCode image pixels into Phaser CanvasTexture (palette->RGBA).
// READS:  sprite.image.getPixel(x,y), MAKECODE_PALETTE, w/h
// WRITES: writes into CanvasTexture pixel buffer + refreshes texture
// PERF:
//   - EXPENSIVE: O(w*h). Must remain isolated here.
//   - Must be callable with perf bucket instrumentation.
// SAFETY:
//   - Must handle missing image gracefully (return 0 nonZero pixels)
// ---------------------------------------------------------------------
function _attachUploadPixelsToTexture(
    ctx: AttachContext,
    tex: Phaser.Textures.CanvasTexture,
    w: number,
    h: number
): number {
    const s = ctx.s;
    const g = ctx.g;

    const ctx2d: CanvasRenderingContext2D = tex.getContext();
    if (!ctx2d) {
        console.error("[_attachNativeSprite] no 2D context for texture", tex.key);
        _frameAttachEarlyOutCount++;
        _frameGroupAttachEarlyOuts[g]++;
        return 0;
    }

    const tPix0 = _hostPerfNowMs();

    ctx2d.clearRect(0, 0, w, h);

    const pixelsLen = w * h;
    const imgData = ctx2d.createImageData(w, h);
    const palette = MAKECODE_PALETTE as number[][];

    let nonZero = 0;

    for (let i = 0; i < pixelsLen; i++) {
        const x = (i % w) | 0;
        const y = ((i / w) | 0);
        const idx = (i * 4) | 0;

        const p = (s.image as any).getPixel(x, y) | 0;

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

            // OLD: invisible pixel (do NOT increment nonZero)
            imgData.data[idx + 0] = 0;
            imgData.data[idx + 1] = 0;
            imgData.data[idx + 2] = 0;
            imgData.data[idx + 3] = 0;
            continue;
        }


        const r = (color[0] | 0) & 255;
        const gg = (color[1] | 0) & 255;
        const b = (color[2] | 0) & 255;

        imgData.data[idx + 0] = r;
        imgData.data[idx + 1] = gg;
        imgData.data[idx + 2] = b;
        imgData.data[idx + 3] = 255;

        nonZero++;
    }

    (s as any)._lastNonZeroPixels = nonZero;

    ctx2d.putImageData(imgData, 0, 0);
    tex.refresh();

    const tPix1 = _hostPerfNowMs();
    const dPix = (tPix1 - tPix0);

    _frameAttachPixelMs += dPix;
    _frameGroupAttachPixelMs[g] += dPix;

    return nonZero;
}





function _attachDestroyNativeIfWrongSize(ctx: AttachContext, w: number, h: number): void {
    const s = ctx.s;

    if (s.native) {
        const n: any = s.native;
        const nativeW = (n.width | 0);
        const nativeH = (n.height | 0);

        if (nativeW !== w || nativeH !== h) {
            if (DEBUG_WRAP_TEX) {
                console.log(
                    "[WRAP-NATIVE-RECREATE]",
                    "| id", s.id,
                    "| old native w,h", nativeW, nativeH,
                    "| new img w,h", w, h
                );
            }
            try { n.destroy(); } catch { /* ignore */ }
            s.native = undefined as any; // OLD: undefined, not null
        }
    }
}



// PURPOSE: Ensure Phaser native sprite exists for this Arcade sprite + texture.
// READS:  sprite.native, texKey, sprite.kind, Phaser scene
// WRITES:
//   - creates Phaser.GameObjects.Sprite when missing
//   - sets native texture/frame; returns {native, didCreate}
// PERF:
//   - Called: on non-UI attach; should early-out if native already valid
// SAFETY:
//   - Must tolerate native existing but invalid/destroyed; recreate safely
// ---------------------------------------------------------------------
function _attachGetOrCreateNative(
    ctx: AttachContext,
    texKey: string,
    kind: number
): { native: any; didCreate: boolean } {
    const sc = ctx.sc;
    const s = ctx.s;

    let native: any = s.native;
    let didCreate = false;

    if (!native) {
        const role = _classifySpriteRole((kind as number) || 0, Object.keys((s as any).data || {}));
        const isEnemyLike = (role === "ENEMY" || role === "ACTOR");

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
        native.setPosition(s.x, s.y);
    }

    return { native, didCreate };
}





function _attachApplyDepthAndScroll(ctx: AttachContext, native: any): void {
    // OLD non-UI pipeline does NOT set depth or scrollFactor here.
    void ctx;
    void native;
}



function _attachDebugOptional(
    ctx: AttachContext,
    kind: number,
    kindName: string,
    texKey: string,
    native: any,
    nonZeroAttach: number,
    w: number,
    h: number
): void {
    const s = ctx.s;

    // OLD: if DEBUG_SPRITE_PIXELS, always dump and override nonZeroAttach / _lastNonZeroPixels
    if (DEBUG_SPRITE_PIXELS) {
        try {
            const nz = _debugSpritePixels(s, "attach#" + _attachCallCount);
            (s as any)._lastNonZeroPixels = nz;
        } catch { /* ignore */ }
    }

    // OLD: projectile debug log (same content)
    if (DEBUG_PROJECTILE_NATIVE && native) {
        const dataKeys2 = Object.keys((s as any).data || {});
        const kind2 = (s.kind as any) as number | undefined;
        const kindName2 = kind2 === undefined ? "undefined" : _getSpriteKindName(kind2 as any);
        const role2 = _classifySpriteRole((kind2 || 0) as any, dataKeys2);

        if (role2 === "PROJECTILE") {
            console.log(
                "[WRAP-NATIVE] create projectile",
                "| id", s.id,
                "| kind", kind2, `(${kindName2})`,
                "| texKey", texKey,
                "| x,y", s.x, s.y,
                "| z", s.z,
                "| visible", native.visible,
                "| img w,h", w, h,
                "| nonZeroAttach", (s as any)._lastNonZeroPixels
            );
        }
    }
}





function _attachImageGuard(ctx: AttachContext): boolean {
    const s = ctx.s;

    if (!s.image) {
        if (ctx.shouldLog) {
            console.log("[_attachNativeSprite] sprite has NO image", s);
        }
        _attachFinalizeEarlyOutOnly(ctx);
        return false;
    }

    return true;
}





// PURPOSE: Optional policy: skip non-UI pixel attach for hero-native sprites handled elsewhere.
// READS:  sprite/native data markers (hero-native), sprite.kind/role signals
// WRITES: none (returns boolean decision)
// PERF:
//   - Called: on non-UI attach entry
//   - Must avoid pixel upload for hero path when heroAnimGlue owns visuals
// SAFETY:
//   - Must be conservative: only skip when we are sure another pipeline owns it
// ---------------------------------------------------------------------
function _attachHeroSkipPath(ctx: AttachContext): boolean {
    const sc = ctx.sc;
    const s = ctx.s;
    const g = ctx.g;

    // OLD behavior: hero detection via isHeroSprite(s)
    const isHero = (() => {
        try { return !!(isHeroSprite as any)(s); } catch { return false; }
    })();

    if (!isHero) return false;

    const HERO_PLACEHOLDER_TEX_KEY = "__heroPlaceholder64";

    let heroTex = sc.textures.exists(HERO_PLACEHOLDER_TEX_KEY)
        ? (sc.textures.get(HERO_PLACEHOLDER_TEX_KEY) as Phaser.Textures.CanvasTexture)
        : null;

    if (!heroTex) {
        heroTex = sc.textures.createCanvas(HERO_PLACEHOLDER_TEX_KEY, 64, 64);
        const ctxHero = (heroTex as any).context as CanvasRenderingContext2D | undefined;
        if (ctxHero) {
            ctxHero.clearRect(0, 0, 64, 64);
            ctxHero.strokeStyle = "#ffffff";
            ctxHero.lineWidth = 2;
            ctxHero.strokeRect(1, 1, 62, 62);
        }
        heroTex.refresh();
    }

    let native: any = (s as any).native;

    if (!native) {
        native = sc.add.sprite(s.x, s.y, HERO_PLACEHOLDER_TEX_KEY);
        try { native.setOrigin(0.5, 0.5); } catch { /* ignore */ }
        try { native.setData("isHeroNative", true); } catch { /* ignore */ }

        // OLD behavior: copy identity + try apply animation using existing project helpers
        try { (_copyHeroIdentityToNative as any)(s, native); } catch { /* ignore */ }
        try { (_tryApplyHeroAnimationForNative as any)(s, native); } catch { /* ignore */ }

        (s as any).native = native;

        if (_attachCallCount <= MAX_ATTACH_VERBOSE) {
            try {
                console.log(
                    "[WRAP-NATIVE] create hero-native sprite",
                    "| id", s.id,
                    "| kind", s.kind,
                    "| texKey", HERO_PLACEHOLDER_TEX_KEY,
                    "| native.width", native.width,
                    "| native.height", native.height
                );
            } catch { /* ignore */ }
        }

        _frameAttachCreateCount++;
        _frameGroupAttachCreates[g]++;
    } else {
        native.setPosition(s.x, s.y);

        // OLD behavior: copy identity + try apply animation using existing project helpers
        try { (_copyHeroIdentityToNative as any)(s, native); } catch { /* ignore */ }
        try { (_tryApplyHeroAnimationForNative as any)(s, native); } catch { /* ignore */ }

        _frameAttachUpdateCount++;
        _frameGroupAttachUpdates[g]++;
    }

    // For visibility logic that uses nonZero pixels, just mark as non-empty.
    try { (s as any)._lastNonZeroPixels = 1; } catch { /* ignore */ }

    const tA1 = _hostPerfNowMs();
    const dA = (tA1 - ctx.tA0);
    _frameAttachMsAccum += dA;
    _frameGroupAttachMs[g] += dA;

    return true;
}






function _attachEarlyOutOnNativeTexMismatch(ctx: AttachContext, texKey: string): boolean {
    const s = ctx.s;
    const existingNative2: any = (s as any).native;

    if (existingNative2 && existingNative2.texture && existingNative2.texture.key !== texKey) {
        existingNative2.x = s.x;
        existingNative2.y = s.y;

        _attachFinalizeEarlyOutUpdate(ctx);
        return true;
    }

    return false;
}


function _attachValidateImageDims(ctx: AttachContext, w: number, h: number): boolean {
    // OLD had no explicit validation/early-out here.
    // Keep behavior identical: always proceed.
    return true;
}




function _attachVerboseStart(ctx: AttachContext, id: number, kind: number, kindName: string, w: number, h: number): void {
    void id; void kind; void kindName;
    if (_attachCallCount <= MAX_ATTACH_VERBOSE) {
        console.log(
            "[_attachNativeSprite] START",
            "spriteId=", ctx.s.id,
            "w,h=", w, h,
            "pixelsLen=", w * h,
        );
    }
}




// PURPOSE: Ensure a Phaser CanvasTexture exists for texKey with correct dimensions.
// READS:  Phaser texture manager (sc.textures), texKey, w/h
// WRITES: creates/destroys/recreates CanvasTexture as needed
// PERF:
//   - Called: on non-UI attach; must early-out if correct texture already exists
// SAFETY:
//   - Must tolerate Phaser texture lookups failing
// ---------------------------------------------------------------------
function _attachGetOrRecreateCanvasTexture(
    ctx: AttachContext,
    texKey: string,
    w: number,
    h: number
): Phaser.Textures.CanvasTexture | null {
    const sc = ctx.sc;
    const s = ctx.s;
    const g = ctx.g;

    const tTex0 = _hostPerfNowMs();

    let tex = sc.textures.exists(texKey)
        ? (sc.textures.get(texKey) as Phaser.Textures.CanvasTexture)
        : null;

    if (tex) {
        const src = tex.source[0];
        const texW = (src.width | 0);
        const texH = (src.height | 0);

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
    const dTex = (tTex1 - tTex0);

    _frameAttachTexMs += dTex;
    _frameGroupAttachTexMs[g] += dTex;

    return tex;
}




function _attachFinalizeUpdate(ctx: AttachContext): void {
    const dtA = _hostPerfNowMs() - ctx.tA0;

    _frameAttachMsAccum += dtA;
    _frameAttachUpdateCount++;

    _frameGroupAttachMs[ctx.g] += dtA;
    _frameGroupAttachUpdates[ctx.g]++;

    if (ctx.shouldLog) {
        console.log("[attach] updated", { g: ctx.g, dtA });
    }
}







//##########################################################################################################################################






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


    // ======================================================
    // KIND56 CREATION TRACE (debug)
    // ======================================================
    const DEBUG_KIND56_CREATE_TRACE = true;
    const KIND56_CREATE_TRACE_MAX = 10;
    let _kind56CreateTraceRemaining = KIND56_CREATE_TRACE_MAX;


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

        // Debug: trace who is creating kind56 sprites (first N only)
        if (DEBUG_KIND56_CREATE_TRACE && finalKind === 56 && _kind56CreateTraceRemaining > 0) {
            _kind56CreateTraceRemaining--;
            console.log(
                "[KIND56 CREATE]",
                "id", s.id,
                "| argKind", kind,
                "| finalKind", finalKind, "(" + _getSpriteKindName(finalKind) + ")",
                "| w,h", img?.width, img?.height
            );
            const st = (new Error("[KIND56 CREATE] stack")).stack;
            if (st) console.log(st);
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

        // Debug: if this path ever creates kind56, trace it too (first N only)
        if (DEBUG_KIND56_CREATE_TRACE && s.kind === 56 && _kind56CreateTraceRemaining > 0) {
            _kind56CreateTraceRemaining--;
            console.log(
                "[KIND56 CREATE][projectile]",
                "id", s.id,
                "| fromKind", source.kind,
                "| w,h", img?.width, img?.height
            );
            const st = (new Error("[KIND56 CREATE] stack")).stack;
            if (st) console.log(st);
        }

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
type SyncContext = {
    t0: number;
    sc?: Phaser.Scene;
    shouldLog: boolean;

    removedHard: number;
    removedByPixels: number;
    frameAttachCount: number;

    tSceneEnd: number;
    tLoopStart: number;
    tLoopEnd: number;

    groupLiveCounts: number[];
};




// ---------------------------------------------------------------------
// MASTER: _syncNativeSprites (per-frame host entry)
// PURPOSE: Mirror Arcade sprites into Phaser native sprites each frame.
// READS:  globalThis.__phaserScene, _allSprites
// WRITES: per-sprite native lifecycle via helpers; perf counters/log buckets
// PERF:
//   - Called: per-frame
//   - Must not: inline logic (keep call-graph only)
// SAFETY:
//   - Early-return when scene missing / not ready
// CALL GRAPH:
//   _syncBeginFrame
//   _syncEarlySceneGuard
//   _syncSpriteLoop
//   _syncEndFrame
// ---------------------------------------------------------------------
export function _syncNativeSprites(): void {
    const ctx = _syncBeginFrame();
    if (!_syncEarlySceneGuard(ctx)) return;

    _syncSpriteLoop(ctx);

    _syncEndFrame(ctx);
}


// PURPOSE: Initialize per-frame sync context + perf timing counters.
// READS:  global perf clock / debug flags
// WRITES: ctx.{t* timestamps, counters, groupLiveCounts}, any frame-global scratch
// PERF:
//   - Called: per-frame
//   - Must not: touch sprite textures / per-sprite work
// SAFETY:
//   - No-op safe if called without scene (guarded upstream)
// ---------------------------------------------------------------------
function _syncBeginFrame(): SyncContext {
    const t0 = _hostPerfNowMs();
    _syncCallCount++;

    const sc: Phaser.Scene | undefined = (globalThis as any).__phaserScene;

    let shouldLog = false;

    if (_syncCallCount <= MAX_SYNC_VERBOSE) {
        shouldLog = true;
    } else if (_syncCallCount % SYNC_EVERY_N_AFTER === 0) {
        shouldLog = true;
    } else if (_syncCallCount % SPRITE_SYNC_LOG_MOD === 0) {
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

    let removedHard = 0;
    let removedByPixels = 0;
    let frameAttachCount = 0;

    let tSceneEnd = t0;
    let tLoopStart = 0;
    let tLoopEnd = 0;

    _frameAttachMsAccum = 0;
    _frameAttachCreateCount = 0;
    _frameAttachUpdateCount = 0;
    _frameAttachTexMs = 0;
    _frameAttachPixelMs = 0;
    _frameAttachEarlyOutCount = 0;

    // Reset 4-group accumulators: H/E/B/X
    _frameGroupAttachMs[0] = 0; _frameGroupAttachMs[1] = 0; _frameGroupAttachMs[2] = 0; _frameGroupAttachMs[3] = 0;
    _frameGroupAttachTexMs[0] = 0; _frameGroupAttachTexMs[1] = 0; _frameGroupAttachTexMs[2] = 0; _frameGroupAttachTexMs[3] = 0;
    _frameGroupAttachPixelMs[0] = 0; _frameGroupAttachPixelMs[1] = 0; _frameGroupAttachPixelMs[2] = 0; _frameGroupAttachPixelMs[3] = 0;

    _frameGroupAttachCalls[0] = 0; _frameGroupAttachCalls[1] = 0; _frameGroupAttachCalls[2] = 0; _frameGroupAttachCalls[3] = 0;
    _frameGroupAttachCreates[0] = 0; _frameGroupAttachCreates[1] = 0; _frameGroupAttachCreates[2] = 0; _frameGroupAttachCreates[3] = 0;
    _frameGroupAttachUpdates[0] = 0; _frameGroupAttachUpdates[1] = 0; _frameGroupAttachUpdates[2] = 0; _frameGroupAttachUpdates[3] = 0;
    _frameGroupAttachEarlyOuts[0] = 0; _frameGroupAttachEarlyOuts[1] = 0; _frameGroupAttachEarlyOuts[2] = 0; _frameGroupAttachEarlyOuts[3] = 0;

    let groupLiveCounts = [0, 0, 0, 0] as number[];

    return {
        t0,
        sc,
        shouldLog,
        removedHard,
        removedByPixels,
        frameAttachCount,
        tSceneEnd,
        tLoopStart,
        tLoopEnd,
        groupLiveCounts,
    };
}






// PURPOSE: Validate Phaser Scene + prerequisites for sync.
// READS:  globalThis.__phaserScene
// WRITES: ctx.sc and any "skip sync" decisions
// PERF:
//   - Called: per-frame
//   - Must not: allocate or iterate sprites
// SAFETY:
//   - Must early-return false if scene missing / shutting down
// ---------------------------------------------------------------------
function _syncEarlySceneGuard(ctx: SyncContext): boolean {
    if (!ctx.sc) {
        if (ctx.shouldLog) console.log("[_syncNativeSprites] no scene yet");
        return false;
    }
    return true;
}


// PURPOSE: Iterate _allSprites; attach/update/remove native sprites.
// READS:  _allSprites, sprite.flags, sprite.image, sprite.kind, sprite.data keys (via role classifier)
// WRITES:
//   - may destroy native (hard-dead / pixel-death)
//   - may remove from _allSprites
//   - may mutate sprite._lastNonZeroPixels / sprite.native visibility
// PERF:
//   - Called: per-frame; O(numSprites)
//   - Must not: do per-pixel work here (pixel upload is attach-only)
// SAFETY:
//   - Must tolerate sprites with missing image/native/data
//   - Must not throw; exceptions must be contained
// ---------------------------------------------------------------------
function _syncSpriteLoop(ctx: SyncContext): void {
    const sc = ctx.sc!;
    const all = _allSprites;

    ctx.tSceneEnd = _hostPerfNowMs();
    ctx.tLoopStart = _hostPerfNowMs();

    // Helper: MakeCode palette index -> Phaser fill color
    const mcToHex = (p: number): number => {
        const pal = MAKECODE_PALETTE as any[];
        const c = pal && pal[p] ? pal[p] : null;
        if (!c) return 0xffffff;
        const r = (c[0] | 0) & 255;
        const g2 = (c[1] | 0) & 255;
        const b = (c[2] | 0) & 255;
        return (r << 16) | (g2 << 8) | b;
    };

    for (let i = all.length - 1; i >= 0; i--) {
        const s = all[i];
        if (!s) {
            all.splice(i, 1);
            continue;
        }

        const flags = s.flags | 0;

        // --------------------------------------------------
        // HARD-DEAD CHECK (still inline for now)
        // --------------------------------------------------
        const hasDestroyedFlag = !!(flags & SpriteFlag.Destroyed);
        const engineDestroyed = (s as any)._destroyed === true;
        const imageGone = !s.image;

        if (hasDestroyedFlag || engineDestroyed || imageGone) {
            ctx.removedHard++;

            if (ctx.shouldLog && (s.kind === 11 || s.kind === 12)) {
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

        // --------------------------------------------------
        // ATTACH + POSITION
        // --------------------------------------------------
        const dataKeysPre = Object.keys((s as any).data || {});
        const rolePre = _classifySpriteRole(s.kind, dataKeysPre);
        const group = _perfGroupFromRole(rolePre);

        ctx.groupLiveCounts[group]++;
        _syncAttachPerfGroup = group;

        ctx.frameAttachCount++;
        _attachNativeSprite(s);

        _syncAttachPerfGroup = PERF_GROUP_EXTRA;

        const native = s.native as any;
        if (!native) {
            if (ctx.shouldLog && (s.kind === 11 || s.kind === 12)) {
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

        // --------------------------------------------------
        // UI FAST PATH
        // --------------------------------------------------
        //if (_syncUiManagedFastPath(ctx, s, native)) continue;
        if (_syncUiManagedFastPath(ctx, s, native, mcToHex)) continue;
        // --------------------------------------------------
        // HERO PATH
        // --------------------------------------------------
        _syncHeroPath(ctx, s, native);

        // --------------------------------------------------
        // ENEMY / ACTOR PATH
        // --------------------------------------------------
        if (_syncEnemyActorPath(ctx, s, native)) continue;

        // --------------------------------------------------
        // PIXEL-DEATH REMOVAL
        // --------------------------------------------------
        if (_syncPixelDeathRemoval(ctx, sc, all, i, s, native, flags)) continue;

        // --------------------------------------------------
        // VISIBILITY + DEBUG
        // --------------------------------------------------
        _syncVisibilityAndDebugTail(ctx, s, native, flags);
    }

    ctx.tLoopEnd = _hostPerfNowMs();
}



// PURPOSE: Update UI-managed natives (status bars + combo meter) without pixel upload.
// READS:
//   - native.getData("uiManaged"), native.getData("uiKind")
//   - StatusBar: (s as any).data[STATUS_BAR_DATA_KEY], sprite.flags (Invisible / RelativeToCamera), s.z
//   - Combo: sprites.readDataNumber(s, UI_COMBO_*_KEY)
// WRITES:
//   - Phaser rect geometry + fill/stroke on native-owned rects (sb_* / cm_*)
//   - native.visible, native depth/scrollFactor
//   - (s as any)._lastNonZeroPixels = 1 (to prevent pixel-death removal)
// PERF:
//   - Called: per-frame for UI sprites
//   - Must never: upload pixels / create textures / log spam
// SAFETY:
//   - If expected rect refs missing (sb_* / cm_*), must degrade safely
// ---------------------------------------------------------------------
function _syncUiManagedFastPath(
    ctx: SyncContext,
    s: Sprite,
    native: Phaser.GameObjects.GameObject,
    mcToHex: (p: number) => number
): boolean {
    const uiKind = (native as any).getData?.("uiKind") as string | undefined;
    if (!uiKind) return false;

    // (Optional) keep these small “common” tweaks; no branching logic beyond calls.
    try { (native as any).setDepth?.(s.z | 0); } catch { /* ignore */ }

    const relToCam = !!(s.flags & SpriteFlag.RelativeToCamera);
    try { (native as any).setScrollFactor?.(relToCam ? 0 : 1, relToCam ? 0 : 1); } catch { /* ignore */ }

    if (uiKind === UI_KIND_STATUSBAR) {
        return _syncUiManagedStatusBar(ctx, s, native);
    }

    if (uiKind === UI_KIND_COMBO_METER) {
        return _syncUiManagedComboMeter(ctx, s, native, mcToHex);
    }

    if (uiKind === UI_KIND_AGI_AIM_INDICATOR) {
        return _syncUiManagedAgiAimIndicator(ctx, s, native);
    }

    if (uiKind === UI_KIND_TEXT) {
        return _syncUiManagedText(ctx, s, native, mcToHex);
    }

    // Unknown UI kind: treat as handled so it doesn't fall into pixel upload.
    try { (native as any).setVisible?.(false); } catch { /* ignore */ }
    (s as any)._lastNonZeroPixels = 1;
    return true;
}











function _syncUiManagedStatusBar(
    ctx: SyncContext,
    s: Sprite,
    native: Phaser.GameObjects.GameObject
): boolean {
    const anyNative: any = native;

    // We expect a Container created by _attachCreateStatusBar
    // Position is handled elsewhere (native.x/y = s.x/y), but be robust:
    try {
        anyNative.x = s.x;
        anyNative.y = s.y;
    } catch { /* ignore */ }

    // Respect Invisible every frame (critical for charge meter show/hide)
    const isInvisible = !!(s.flags & SpriteFlag.Invisible);
    try { anyNative.setVisible?.(!isInvisible); } catch { /* ignore */ }

    const sb = (s as any)._statusBar;
    if (!sb) {
        (s as any)._lastNonZeroPixels = 1;
        return true;
    }

    const borderRect = anyNative.getData?.("sb_border") as Phaser.GameObjects.Rectangle | undefined;
    const bgRect = anyNative.getData?.("sb_bg") as Phaser.GameObjects.Rectangle | undefined;
    const fillRect = anyNative.getData?.("sb_fill") as Phaser.GameObjects.Rectangle | undefined;

    if (!borderRect || !bgRect || !fillRect) {
        (s as any)._lastNonZeroPixels = 1;
        return true;
    }

    // Use stored geometry (set at attach). Fall back to sb if missing.
    const barW = ((anyNative.getData?.("sb_w") as number | undefined) ?? ((sb.barWidth | 0) || (sb._barWidth | 0) || 20)) | 0;
    const barH = ((anyNative.getData?.("sb_h") as number | undefined) ?? ((sb.barHeight | 0) || (sb._barHeight | 0) || 4)) | 0;
    const bw = ((anyNative.getData?.("sb_bw") as number | undefined) ?? (sb.borderWidth | 0) ?? 0) | 0;

    const innerW = Math.max(1, barW - (bw * 2));
    const innerH = Math.max(1, barH - (bw * 2));
    const leftX = (-barW / 2) + bw;

    // Container-local geometry (this is the consistent model)
    borderRect.x = 0;
    borderRect.y = 0;
    borderRect.width = barW;
    borderRect.height = barH;

    bgRect.x = leftX;
    bgRect.y = 0;
    bgRect.width = innerW;
    bgRect.height = innerH;

    const cur = (sb.current | 0);
    const max = Math.max(1, (sb.max | 0));
    const pct = Math.max(0, Math.min(1, cur / max));

    fillRect.x = leftX;
    fillRect.y = 0;
    fillRect.width = Math.floor(innerW * pct);
    fillRect.height = innerH;

    // Prevent pixel-death logic from hiding/removing it
    (s as any)._lastNonZeroPixels = 1;
    return true;
}


















function _syncUiManagedComboMeter(
    ctx: SyncContext,
    s: Sprite,
    native: Phaser.GameObjects.GameObject,
    mcToHex: (p: number) => number
): boolean {
    const totalW = (sprites.readDataNumber(s, UI_COMBO_TOTAL_W_KEY) | 0) || 30;
    const h = (sprites.readDataNumber(s, UI_COMBO_H_KEY) | 0) || 5;

    const wE = (sprites.readDataNumber(s, UI_COMBO_W_E_KEY) | 0) || 3;
    const w1 = (sprites.readDataNumber(s, UI_COMBO_W_1_KEY) | 0) || 4;
    const w2 = (sprites.readDataNumber(s, UI_COMBO_W_2_KEY) | 0) || 5;
    const w3 = (sprites.readDataNumber(s, UI_COMBO_W_3_KEY) | 0) || 6;

    const posX1000 = (sprites.readDataNumber(s, UI_COMBO_POS_X1000_KEY) | 0) || 0;
    const show = (sprites.readDataNumber(s, UI_COMBO_VISIBLE_KEY) | 0) ? true : false;

    const segs: any[] = (native as any).getData?.("cm_segs") || [];
    const borderRect: any = (native as any).getData?.("cm_border");
    const ptr: any = (native as any).getData?.("cm_ptr");

    if (borderRect) {
        borderRect.width = totalW;
        borderRect.height = h;
        const colBorder = mcToHex(1);
        borderRect.setStrokeStyle(1, colBorder, 1);
    }

    const left = -totalW / 2;
    let x = left;

    const setSeg = (idx: number, wSeg: number) => {
        const r = segs[idx];
        if (!r) return;
        r.x = x;
        r.width = Math.max(1, wSeg);
        r.height = Math.max(1, h);
        x += wSeg;
    };

    setSeg(0, wE);
    setSeg(1, w1);
    setSeg(2, w2);
    setSeg(3, w3);
    setSeg(4, w2);
    setSeg(5, w1);
    setSeg(6, wE);

    // ---------------------------------------------------------------------
    // C5: Combo meter labels (numbers on rectangles)
    // Layout: [E][1][2][3][2][1][E]
    // We render Phaser-native text objects inside the same UI container so we
    // don't need additional Arcade sprites (and we avoid pixel/texture churn).
    // ---------------------------------------------------------------------
    const sc: Phaser.Scene | undefined = ctx.sc || ((native as any).scene as any);
    if (sc) {
        let labels: Phaser.GameObjects.Text[] | null = (native as any).getData?.("cm_labels") as any;
        if (!labels || !Array.isArray(labels) || labels.length !== 7) {
            labels = [];
            const style: any = { fontFamily: "monospace", fontSize: "10px" };

            for (let i = 0; i < 7; i++) {
                const t = sc.add.text(0, 0, "", style);
                try { (t as any).setOrigin?.(0.5, 0.5); } catch { /* ignore */ }
                try { (t as any).setDepth?.(999999); } catch { /* ignore */ }
                try { (native as any).add?.(t); } catch { /* ignore */ }
                labels.push(t);
            }

            try { (native as any).setData?.("cm_labels", labels); } catch { /* ignore */ }
        }

        const segW = [wE, w1, w2, w3, w2, w1, wE];
        const segTxt = ["E", "1", "2", "3", "2", "1", "E"];

        let lx = left;
        for (let i = 0; i < 7; i++) {
            const t = labels[i];
            if (!t) continue;
            const wSeg = Math.max(1, segW[i]);
            const cx = lx + (wSeg / 2);
            const cy = 0; // centered vertically within the container

            try { (t as any).setPosition?.(cx, cy); } catch { /* ignore */ }
            try { (t as any).setText?.(segTxt[i]); } catch { /* ignore */ }
            try { (t as any).setVisible?.(show); } catch { /* ignore */ }

            lx += wSeg;
        }
    }

    const clamped = Math.max(0, Math.min(1000, posX1000));
    const span = Math.max(1, (totalW - 1));
    const pointerX = Math.floor((clamped * span) / 1000);

    if (ptr) {
        ptr.x = left + pointerX + 0.5;
        ptr.y = 0;
        ptr.width = 1;
        ptr.height = Math.max(1, h);

        // Defensive: ensure it actually draws
        const colPtr = mcToHex(5);
        ptr.setFillStyle(colPtr, 1);
        ptr.visible = true;
    }

    try { (native as any).setVisible?.(show); } catch { /* ignore */ }

    // Prevent pixel-death logic from hiding/removing it
    (s as any)._lastNonZeroPixels = 1;

    return true;
}





function _syncUiManagedAgiAimIndicator(
    ctx: SyncContext,
    s: Sprite,
    native: Phaser.GameObjects.GameObject
): boolean {
    const anyNative: any = native;

    // Position
    try {
        anyNative.x = s.x;
        anyNative.y = s.y;
    } catch { /* ignore */ }

    // Visibility: DO NOT use SpriteFlag.Invisible (engine keeps it Invisible in Phaser).
    const show = ((sprites.readDataNumber(s, UI_AIM_VISIBLE_KEY) | 0) !== 0);
    try { anyNative.setVisible?.(show); } catch { /* ignore */ }

    // Direction / angle
    const dx1000 = (sprites.readDataNumber(s, UI_AIM_DIR_X1000_KEY) | 0);
    const dy1000 = (sprites.readDataNumber(s, UI_AIM_DIR_Y1000_KEY) | 0);

    let dx = dx1000 / 1000;
    let dy = dy1000 / 1000;
    if ((dx === 0 && dy === 0) || !isFinite(dx) || !isFinite(dy)) { dx = 1; dy = 0; }

    // Prefer angleMdeg if the key exists
    let angleRad = 0;
    const dataAny: any = (s as any).data;
    const hasAngleKey =
        !!dataAny && Object.prototype.hasOwnProperty.call(dataAny, UI_AIM_ANGLE_MDEG_KEY);

    if (hasAngleKey) {
        const angleMdeg = (sprites.readDataNumber(s, UI_AIM_ANGLE_MDEG_KEY) | 0);
        const angleDeg = angleMdeg / 1000;
        angleRad = (angleDeg * Math.PI) / 180;
    } else {
        angleRad = Math.atan2(dy, dx);
    }

    try { (anyNative as any).rotation = angleRad; } catch { /* ignore */ }

    // Length-driven redraw (Graphics-based arrow)
    const len = (sprites.readDataNumber(s, UI_AIM_LEN_KEY) | 0) || 14;
    const lastLen = (anyNative.getData?.("ai_lastLen") as number | undefined) ?? 0;

    if (len !== lastLen) {
        const gfx: any = anyNative.getData?.("ai_gfx");
        const thickness = ((anyNative.getData?.("ai_thickness") as number | undefined) ?? 4);
        const headL = ((anyNative.getData?.("ai_headL") as number | undefined) ?? 6);
        const headW = ((anyNative.getData?.("ai_headW") as number | undefined) ?? 10);
        const col = ((anyNative.getData?.("ai_color") as number | undefined) ?? _mcToHex(5));

        if (gfx && gfx.clear) {
            const shaftW = Math.max(1, len - headL);

            gfx.clear();
            gfx.fillStyle(col, 1);

            gfx.fillRect(0, -thickness / 2, shaftW, thickness);

            gfx.beginPath();
            gfx.moveTo(shaftW, -headW / 2);
            gfx.lineTo(shaftW, +headW / 2);
            gfx.lineTo(shaftW + headL, 0);
            gfx.closePath();
            gfx.fillPath();
        }

        try { anyNative.setData?.("ai_lastLen", len); } catch { /* ignore */ }
    }

    (s as any)._lastNonZeroPixels = 1;
    return true;
}




function _syncUiManagedText(
    ctx: SyncContext,
    s: Sprite,
    native: Phaser.GameObjects.GameObject,
    mcToHex: (p: number) => number
): boolean {
    const anyNative: any = native;

    // Keep container positioned
    try {
        anyNative.x = s.x;
        anyNative.y = s.y;
    } catch { /* ignore */ }

    // Respect Invisible every frame
    const isInvisible = !!(s.flags & SpriteFlag.Invisible);
    try { anyNative.setVisible?.(!isInvisible); } catch { /* ignore */ }

    const sc: Phaser.Scene | undefined = ctx.sc || (anyNative.scene as any);
    if (!sc) {
        (s as any)._lastNonZeroPixels = 1;
        return true;
    }

    const txtObj: Phaser.GameObjects.Text | undefined = anyNative.getData?.("tx_text");
    if (!txtObj) {
        (s as any)._lastNonZeroPixels = 1;
        return true;
    }

    // Dirty/version gate
    const ver = (_readDataNumber0(s, UI_TEXT_VER_KEY, 0) | 0);
    const lastVer = ((anyNative.getData?.("tx_lastVer") as number | undefined) ?? 0) | 0;

    if (ver !== lastVer) {
        const txt = _readDataString0(s, UI_TEXT_STR_KEY, "");

        const fgIdx = (_readDataNumber0(s, UI_TEXT_FG_KEY, 1) | 0) & 15;
        const bgIdxRaw = (_readDataNumber0(s, UI_TEXT_BG_KEY, 0) | 0);
        const bgIdx = bgIdxRaw & 15;

        const maxH = Math.max(1, _readDataNumber0(s, UI_TEXT_MAX_H_KEY, 8) | 0);
        const pad = Math.max(0, _readDataNumber0(s, UI_TEXT_PAD_KEY, 0) | 0);

        const bw = Math.max(0, _readDataNumber0(s, UI_TEXT_BORDER_W_KEY, 0) | 0);
        const bcIdx = (_readDataNumber0(s, UI_TEXT_BORDER_C_KEY, 1) | 0) & 15;

        const ow = Math.max(0, _readDataNumber0(s, UI_TEXT_OUTLINE_W_KEY, 0) | 0);
        const ocIdx = (_readDataNumber0(s, UI_TEXT_OUTLINE_C_KEY, 0) | 0) & 15;

        const fontPx = Math.max(1, (maxH | 0));
        const strokePx = Math.max(0, (ow | 0));

        // Apply text + style (Phaser-native)
        try { (txtObj as any).setText?.(txt); } catch { /* ignore */ }
        try { (txtObj as any).setFontSize?.(fontPx); } catch { /* ignore */ }

        const fgCss = _hexToCss(mcToHex(fgIdx));
        try { (txtObj as any).setColor?.(fgCss); } catch { /* ignore */ }

        if (ow > 0) {
            const ocCss = _hexToCss(mcToHex(ocIdx));
            try { (txtObj as any).setStroke?.(ocCss, strokePx); } catch { /* ignore */ }
        } else {
            try { (txtObj as any).setStroke?.("#000000", 0); } catch { /* ignore */ }
        }

        // Ensure origin stays centered
        try { (txtObj as any).setOrigin?.(0.5, 0.5); } catch { /* ignore */ }

        // Recompute box size in display units
        const tw = Math.max(1, (txtObj as any).displayWidth || (txtObj as any).width || 1);
        const th = Math.max(1, (txtObj as any).displayHeight || (txtObj as any).height || 1);

        const boxW = Math.max(1, tw + pad * 2);
        const boxH = Math.max(1, th + pad * 2);

        // Background rect (optional)
        let bgRect: Phaser.GameObjects.Rectangle | null = (anyNative.getData?.("tx_bg") as any) || null;
        const wantBg = ((bgIdxRaw | 0) !== 0);

        if (wantBg) {
            const bgHex = mcToHex(bgIdx);
            if (!bgRect) {
                bgRect = sc.add.rectangle(0, 0, boxW, boxH, bgHex, 1);
                bgRect.setOrigin(0.5, 0.5);
                try { (anyNative as any).addAt?.(bgRect, 0); } catch { try { (anyNative as any).add?.(bgRect); } catch { } }
                anyNative.setData?.("tx_bg", bgRect);
            } else {
                bgRect.width = boxW;
                bgRect.height = boxH;
                try { bgRect.setFillStyle(bgHex, 1); } catch { /* ignore */ }
            }
        } else if (bgRect) {
            try { (anyNative as any).remove?.(bgRect, true); } catch { /* ignore */ }
            try { (bgRect as any).destroy?.(); } catch { /* ignore */ }
            anyNative.setData?.("tx_bg", null);
            bgRect = null;
        }

        // Border rect (optional)
        let borderRect: Phaser.GameObjects.Rectangle | null = (anyNative.getData?.("tx_border") as any) || null;
        const wantBorder = (bw > 0);

        if (wantBorder) {
            const bcHex = mcToHex(bcIdx);
            if (!borderRect) {
                borderRect = sc.add.rectangle(0, 0, boxW, boxH, 0, 0);
                borderRect.setOrigin(0.5, 0.5);
                borderRect.setStrokeStyle(bw, bcHex, 1);

                const idx = bgRect ? 1 : 0;
                try { (anyNative as any).addAt?.(borderRect, idx); } catch { try { (anyNative as any).add?.(borderRect); } catch { } }

                anyNative.setData?.("tx_border", borderRect);
            } else {
                borderRect.width = boxW;
                borderRect.height = boxH;
                try { borderRect.setStrokeStyle(bw, bcHex, 1); } catch { /* ignore */ }
            }
        } else if (borderRect) {
            try { (anyNative as any).remove?.(borderRect, true); } catch { /* ignore */ }
            try { (borderRect as any).destroy?.(); } catch { /* ignore */ }
            anyNative.setData?.("tx_border", null);
            borderRect = null;
        }

        anyNative.setData?.("tx_lastVer", ver);
    }

    (s as any)._lastNonZeroPixels = 1;
    return true;
}


// PURPOSE: Apply hero animation + hero aura glue onto hero native sprites.
// READS:
//   - role classification via _classifySpriteRole(kind, dataKeys)
//   - native.getData("isHeroNative")
//   - (s as any).data["auraActive"], (s as any).data["auraColor"]
// WRITES:
//   - native animation + aura visuals via heroAnimGlue (side effects)
// PERF:
//   - Called: per-frame for HERO sprites
//   - Must not: upload pixels or allocate textures
// SAFETY:
//   - Must no-op safely if native missing / not hero-native / glue unavailable
// ---------------------------------------------------------------------
function _syncHeroPath(
    ctx: SyncContext,
    s: any,
    native: any
): void {
    const dataKeys = Object.keys(s.data || {});
    const role = _classifySpriteRole(s.kind, dataKeys);

    // --- HERO ANIM GLUE HOOK --------------------------------------------
    if (role === "HERO") {
        const nativeAny: any = s.native;
        if (nativeAny && nativeAny.getData && nativeAny.getData("isHeroNative")) {
            _tryApplyHeroAnimationForNative(
                s,
                nativeAny as Phaser.GameObjects.Sprite
            );

            const auraActive = !!(s.data && (s.data as any)["auraActive"]);
            const auraColor =
                ((s.data && (s.data as any)["auraColor"]) as any | 0);

            heroAnimGlue.syncHeroAuraForNative(
                s.native,
                auraActive,
                auraColor
            );
        }
    }
}



// PURPOSE: Apply monster/actor animation data onto native sprites (Phaser-side anim glue).
// READS:
//   - sprites.readDataString(s, "monsterId" | "enemyName" | "name")
//   - sprites.readDataString(s, "phase"), sprites.readDataString(s, "dir")
//   - role classification via _classifySpriteRole(kind, dataKeys)
// WRITES:
//   - (s as any).data["monsterId"|"name"|"phase"|"dir"] (normalizes keys)
//   - nativeAny.setData("monsterId"|"name"|"phase"|"dir")
//   - triggers monsterAnimGlue hook (side effect on native anim)
// PERF:
//   - Called: per-frame for ENEMY/ACTOR sprites
//   - Must not: upload pixels or allocate textures
// SAFETY:
//   - Must tolerate missing native.setData / missing glue hook
// ---------------------------------------------------------------------
function _syncEnemyActorPath(
    ctx: SyncContext,
    s: any,
    native: any
): boolean {
    const dataKeys = Object.keys(s.data || {});
    const role = _classifySpriteRole(s.kind, dataKeys);

    if (role !== "ENEMY" && role !== "ACTOR") return false;

    if (!(s as any).data) (s as any).data = {};
    const data: any = (s as any).data;

    const monsterId =
        sprites.readDataString(s, "monsterId") ||
        sprites.readDataString(s, "enemyName") ||
        sprites.readDataString(s, "name") ||
        "";

    type MonsterAnimPhase = "walk" | "attack" | "death";
    type MonsterDirection = "up" | "down" | "left" | "right";

    let phase =
        (sprites.readDataString(s, "phase") as MonsterAnimPhase) || "walk";

    let dir = sprites.readDataString(s, "dir") as MonsterDirection | undefined;
    if (!dir) {
        if (s.vx > 0)      dir = "right";
        else if (s.vx < 0) dir = "left";
        else if (s.vy > 0) dir = "down";
        else               dir = "up";
    }

    if (monsterId) data["monsterId"] = monsterId;
    if (monsterId && !data["name"]) data["name"] = monsterId;
    data["phase"] = phase;
    data["dir"]   = dir;

    const nativeAny: any = s.native;
    if (!nativeAny || typeof nativeAny.setData !== "function") {
        return true;
    }

    nativeAny.setData("monsterId", monsterId);
    nativeAny.setData("name",      monsterId);
    nativeAny.setData("phase",     phase);
    nativeAny.setData("dir",       dir);

    const glueAny: any = (globalThis as any).monsterAnimGlue || monsterAnimGlue;
    const enemySprite = nativeAny as Phaser.GameObjects.Sprite;

    if (glueAny && typeof glueAny.tryAttachMonsterSprite === "function") {
        glueAny.tryAttachMonsterSprite(enemySprite);
    } else if (glueAny && typeof glueAny.applyMonsterAnimationForSprite === "function") {
        glueAny.applyMonsterAnimationForSprite(enemySprite);
    }

    return true;
}



// PURPOSE: Remove/destroy natives when sprite becomes "dead by pixels" (autoHideByPixels).
// READS:  (s as any)._lastNonZeroPixels, sprite.flags, sprite.kind
// WRITES: destroys s.native (if present), may splice _allSprites (caller controls index)
// PERF:
//   - Called: per-frame; only triggers work when lastNonZeroPixels==0
// SAFETY:
//   - Must tolerate native.destroy throwing; contain exceptions
// ---------------------------------------------------------------------
function _syncPixelDeathRemoval(
    ctx: SyncContext,
    sc: Phaser.Scene,
    all: any[],
    i: number,
    s: any,
    native: any,
    flags: number
): boolean {
    const lastNonZero = (s as any)._lastNonZeroPixels ?? -1;
    const hasInvisibleFlag = !!(flags & SpriteFlag.Invisible);
    const autoHideByPixels = lastNonZero === 0;

    const deadByPixels =
        autoHideByPixels &&
        (s.kind === 11 || s.kind === 12 || s.kind === 9100);

    if (!deadByPixels) return false;

    ctx.removedByPixels++;

    if (ctx.shouldLog) {
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
    return true;
}


// PURPOSE: Final visibility + debug logging tail for a sprite after main sync paths.
// READS:  debug flags, sprite.flags, sprite/image/native state
// WRITES: native.visible / alpha / debug-only logs (if enabled)
// PERF:
//   - Called: per-frame
//   - Debug logging must remain gated and OFF by default
// SAFETY:
//   - Must not throw even if native fields missing
// ---------------------------------------------------------------------
function _syncVisibilityAndDebugTail(
    ctx: SyncContext,
    s: any,
    native: any,
    flags: number
): void {
    // EXTRA DEBUG: raw projectile state
    if (DEBUG_PROJECTILE_NATIVE && ctx.shouldLog && s.kind === 11) {
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

    // ============================================================
    // UI-MANAGED VISIBILITY OVERRIDE
    //
    // Combo meter is intentionally SpriteFlag.Invisible in Phaser mode
    // (Arcade pixels hidden), but the Phaser-native container MUST remain visible.
    // ============================================================
    const isUiManaged = !!(native && typeof native.getData === "function" && native.getData("uiManaged"));
    if (isUiManaged) {
        const uiKind = (native.getData("uiKind") as string | undefined) || "";

        let shouldBeVisible = true;

        if (uiKind === UI_KIND_COMBO_METER) {
            // Visibility is driven by the published data key, NOT SpriteFlag.Invisible
            const show = ((sprites.readDataNumber(s, UI_COMBO_VISIBLE_KEY) | 0) ? true : false);
            shouldBeVisible = show && !autoHideByPixels;
        } else {
            // Status bars (and other UI) can still respect Invisible flag if you use it
            shouldBeVisible = !hasInvisibleFlag && !autoHideByPixels;
        }

        native.visible = shouldBeVisible;
        native.alpha = shouldBeVisible ? 1 : 0;

        return;
    }

    // ============================================================
    // DEFAULT (NON-UI) VISIBILITY
    // ============================================================
    const shouldBeVisible = !hasInvisibleFlag && !autoHideByPixels;
    native.visible = shouldBeVisible;
    native.alpha = shouldBeVisible ? 1 : 0;

    if (DEBUG_PROJECTILE_NATIVE && ctx.shouldLog && s.kind === 11) {
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

    if (ctx.shouldLog && (s.kind === 11 || s.kind === 12)) {
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



// PURPOSE: Finalize per-frame timings + counters; emit perf logs if enabled.
// READS:  ctx counters/timestamps, debug flags
// WRITES: perf log output / accumulated metrics
// PERF:
//   - Called: per-frame
//   - Must not: touch per-sprite state
// SAFETY:
//   - Must no-op safely if ctx incomplete
// ---------------------------------------------------------------------
// arcadeCompat.ts
// FULL FUNCTION REPLACEMENT

function _syncEndFrame(ctx: SyncContext): void {
    const t1 = _hostPerfNowMs();
    _hostPerfAccumSyncMs += (t1 - ctx.t0);

    const all = _allSprites;
    const spriteCount = all.length;
    _hostPerfLastSpriteCount = spriteCount;

    if (!ctx.shouldLog) return;

    const totalMs = t1 - ctx.t0;
    const sceneMs = ctx.tSceneEnd - ctx.t0;
    const loopMs = ctx.tLoopEnd - ctx.tLoopStart;
    const otherMsRaw = totalMs - sceneMs - loopMs;
    const otherMs = otherMsRaw < 0 ? 0 : otherMsRaw;

    const attachMs = _frameAttachMsAccum;
    const loopOtherMsRaw = loopMs - attachMs;
    const loopOtherMs = loopOtherMsRaw < 0 ? 0 : loopOtherMsRaw;

    // group counts
    const Hc = ctx.groupLiveCounts[PERF_GROUP_HERO] | 0;
    const Ec = ctx.groupLiveCounts[PERF_GROUP_ENEMY] | 0;
    const Bc = ctx.groupLiveCounts[PERF_GROUP_BARS] | 0;
    const Xc = ctx.groupLiveCounts[PERF_GROUP_EXTRA] | 0;

    // group time
    const Ha = _frameGroupAttachMs[PERF_GROUP_HERO];
    const Ea = _frameGroupAttachMs[PERF_GROUP_ENEMY];
    const Ba = _frameGroupAttachMs[PERF_GROUP_BARS];
    const Xa = _frameGroupAttachMs[PERF_GROUP_EXTRA];

    const Hpx = _frameGroupAttachPixelMs[PERF_GROUP_HERO];
    const Epx = _frameGroupAttachPixelMs[PERF_GROUP_ENEMY];
    const Bpx = _frameGroupAttachPixelMs[PERF_GROUP_BARS];
    const Xpx = _frameGroupAttachPixelMs[PERF_GROUP_EXTRA];

    const Htx = _frameGroupAttachTexMs[PERF_GROUP_HERO];
    const Etx = _frameGroupAttachTexMs[PERF_GROUP_ENEMY];
    const Btx = _frameGroupAttachTexMs[PERF_GROUP_BARS];
    const Xtx = _frameGroupAttachTexMs[PERF_GROUP_EXTRA];

    // group counts for attach ops
    const Hcalls = _frameGroupAttachCalls[PERF_GROUP_HERO] | 0;
    const Ecalls = _frameGroupAttachCalls[PERF_GROUP_ENEMY] | 0;
    const Bcalls = _frameGroupAttachCalls[PERF_GROUP_BARS] | 0;
    const Xcalls = _frameGroupAttachCalls[PERF_GROUP_EXTRA] | 0;

    const Hcr = _frameGroupAttachCreates[PERF_GROUP_HERO] | 0;
    const Ecr = _frameGroupAttachCreates[PERF_GROUP_ENEMY] | 0;
    const Bcr = _frameGroupAttachCreates[PERF_GROUP_BARS] | 0;
    const Xcr = _frameGroupAttachCreates[PERF_GROUP_EXTRA] | 0;

    const Hup = _frameGroupAttachUpdates[PERF_GROUP_HERO] | 0;
    const Eup = _frameGroupAttachUpdates[PERF_GROUP_ENEMY] | 0;
    const Bup = _frameGroupAttachUpdates[PERF_GROUP_BARS] | 0;
    const Xup = _frameGroupAttachUpdates[PERF_GROUP_EXTRA] | 0;

    const Heo = _frameGroupAttachEarlyOuts[PERF_GROUP_HERO] | 0;
    const Eeo = _frameGroupAttachEarlyOuts[PERF_GROUP_ENEMY] | 0;
    const Beo = _frameGroupAttachEarlyOuts[PERF_GROUP_BARS] | 0;
    const Xeo = _frameGroupAttachEarlyOuts[PERF_GROUP_EXTRA] | 0;

    // AURA PERF (accumulated by heroAnimGlue.syncHeroAuraForNative)
    const gAny: any = globalThis as any;
    const auraMs = +(gAny.__perfAuraMs || 0);
    const auraCalls = (gAny.__perfAuraCalls | 0) || 0;
    const auraBuilds = (gAny.__perfAuraBuilds | 0) || 0;
    const auraTexSets = (gAny.__perfAuraTexSets | 0) || 0;

    // LIFESPAN PERF (accumulated by _advanceLifespans in game._tick)
    const lifeDestroyCalls = (gAny[PERF_LIFE_DESTROY_CALLS_KEY] | 0) || 0;

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
        "removedHard=", ctx.removedHard,
        "removedByPixels=", ctx.removedByPixels,
        "attachCalls=", ctx.frameAttachCount,
        "attachCreates=", _frameAttachCreateCount,
        "attachUpdates=", _frameAttachUpdateCount,
        "attachEarlyOuts=", _frameAttachEarlyOutCount,
        "| H/E/B/X=", `${Hc}/${Ec}/${Bc}/${Xc}`,
        "| attachMs(H/E/B/X)=", `${Ha.toFixed(3)}/${Ea.toFixed(3)}/${Ba.toFixed(3)}/${Xa.toFixed(3)}`,
        "| pixMs(H/E/B/X)=", `${Hpx.toFixed(3)}/${Epx.toFixed(3)}/${Bpx.toFixed(3)}/${Xpx.toFixed(3)}`,
        "| texMs(H/E/B/X)=", `${Htx.toFixed(3)}/${Etx.toFixed(3)}/${Btx.toFixed(3)}/${Xtx.toFixed(3)}`,
        "| calls(H/E/B/X)=", `${Hcalls}/${Ecalls}/${Bcalls}/${Xcalls}`,
        "| creates(H/E/B/X)=", `${Hcr}/${Ecr}/${Bcr}/${Xcr}`,
        "| updates(H/E/B/X)=", `${Hup}/${Eup}/${Bup}/${Xup}`,
        "| early(H/E/B/X)=", `${Heo}/${Eeo}/${Beo}/${Xeo}`,
        "| auraMs≈", auraMs.toFixed(3),
        "auraCalls=", auraCalls,
        "auraBuilds=", auraBuilds,
        "auraTexSets=", auraTexSets,
        "| lifeDestroy=", lifeDestroyCalls
    );

    // Reset aura accumulators so each log line is "since last perf.syncSteps"
    gAny.__perfAuraMs = 0;
    gAny.__perfAuraCalls = 0;
    gAny.__perfAuraBuilds = 0;
    gAny.__perfAuraTexSets = 0;

    // Reset lifespan accumulator so each log line is "since last perf.syncSteps"
    gAny[PERF_LIFE_DESTROY_CALLS_KEY] = 0;

    _debugDumpCategoryX(ctx, _allSprites);
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



// PURPOSE: Run Arcade-style sprite event handlers (overlaps/destroys/etc).
// READS:  _overlapHandlers, _destroyHandlers, _allSprites, debug flags
// WRITES: invokes registered callbacks; may mutate sprite state via handlers
// PERF:
//   - Called: per-frame (or per tick)
//   - Must keep logging gated; handlers can be expensive so avoid extra passes
// SAFETY:
//   - Must isolate handler exceptions (never crash host loop)
// ---------------------------------------------------------------------
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



// Add this as a new top-level helper (NOT inside a namespace), somewhere above `namespace game {`
function _advanceLifespans(dtMs: number): void {
    if (!(dtMs > 0)) return;

    // Read the authoritative sprite list
    const all: Sprite[] =
        (sprites as any)._getAllSprites ? (sprites as any)._getAllSprites() : [];

    if (!all || all.length === 0) return;

    const gAny: any = globalThis as any;

    for (let i = 0; i < all.length; i++) {
        const s: any = all[i];
        if (!s) continue;

        const life = s.lifespan;
        if (typeof life !== "number" || life <= 0) continue;

        const next = life - dtMs;

        if (next <= 0) {
            s.lifespan = 0;

            // Arcade semantics: expire => destroy
            try {
                if (typeof s.destroy === "function") s.destroy();
                else {
                    // ultra-fallback: mark destroyed like Sprite.destroy()
                    s.flags |= SpriteFlag.Destroyed;
                    s._destroyed = true;
                }
            } catch {
                // fail-safe: never throw from tick
            }

            gAny[PERF_LIFE_DESTROY_CALLS_KEY] = ((gAny[PERF_LIFE_DESTROY_CALLS_KEY] | 0) + 1);
        } else {
            s.lifespan = next;
        }
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



// PURPOSE: Drive Arcade compat tick (input/events/time progression).
// READS:  engine queues/state, time deltas, debug flags
// WRITES: advances runtime; triggers _processEvents; updates bookkeeping
// PERF:
//   - Called: per-frame
//   - Must not allocate heavy objects per tick
// SAFETY:
//   - Must not throw; isolate downstream exceptions
// ---------------------------------------------------------------------
    // arcadeCompat.ts
// FULL FUNCTION REPLACEMENT (namespace game)

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

        // 2.5) Lifespan expiry (Arcade semantics)
        // Run AFTER user logic, BEFORE native sync, so expirations are visible immediately.
        _advanceLifespans(dtMs);

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

        // Pull ALL sprites from compat layer
        const allFn = (sprites as any)._getAllSprites;
        const all = typeof allFn === "function" ? (allFn.call(sprites) as any[]) : [];

        const snapSprites: SpriteSnapshot[] = [];

        for (const s of all) {
            if (!s) continue;

            // Clone data first (primitive-only). This includes __uiKind + text keys.
            const data = cloneData(s.data);

            // Skip pixel payloads for Phaser-native text sprites (metadata-only).
            const uiKind = (data && typeof (data as any)[UI_KIND_KEY] === "string")
                ? (data as any)[UI_KIND_KEY]
                : "";

            const isTextSprite =
                uiKind === UI_KIND_TEXT ||
                ((s.kind | 0) === 9100); // SpriteKind.Text from extension

            let pixels: number[] | undefined = undefined;

            if (!isTextSprite) {
                if (s.image && (s.image as any).toJSONPixels) {
                    pixels = (s.image as any).toJSONPixels();
                }
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
                data,
                flags: s.flags | 0,
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


    
    export function captureOLDCODETODELETE(): WorldSnapshotOLDCODETODELETE {
        const g: any = (globalThis as any);
        const runtimeMs = (g.__heroEngineWorldRuntimeMs ?? 0) | 0;
        const bgIndex = (g.__net_bgColorIndex ?? 0) | 0;
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


// PURPOSE: Apply inbound network/state payload into local Arcade compat runtime.
// READS:  inbound message/payload shape, player registry, sprite registry
// WRITES: sprite state, player state, queues for later processing
// PERF:
//   - Called: per message (can spike). Avoid per-pixel work.
// SAFETY:
//   - Must validate payload fields; tolerate partial/old clients
// ---------------------------------------------------------------------
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



// PURPOSE: Register a local player/controller and bind to networking + runtime hooks.
// READS:  player id/config, socket/server state, runtime registries
// WRITES: player registry entries, input bindings, network handlers
// PERF:
//   - Called: at player join; not per-frame, but complexity is high (boundary function)
// SAFETY:
//   - Must remain idempotent / avoid duplicate registrations
// ---------------------------------------------------------------------
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
