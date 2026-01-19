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

// 🍁 ────── 🍂 ────── 🍁  SECTION  🍁 ────── 🍂 ────── 🍁 ────── 🍂 ────── 🍁 ────── 🍂 ────── 🍁  SECTION  🍁 ────── 🍂 ────── 🍁
// 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥
// 🌕 ────── ✨ ────── 🌕  SECTION  🌕 ────── ✨ ────── 🌕 ────── ✨ ────── 🌕 ────── ✨ ────── 🌕  SECTION  🌕 ────── ✨ ────── 🌕
// 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃
// 🌕 ────── ✨ ────── 🌕  SECTION  🌕 ────── ✨ ────── 🌕 ────── ✨ ────── 🌕 ────── ✨ ────── 🌕  SECTION  🌕 ────── ✨ ────── 🌕
// 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥
// 🍁 ────── 🍂 ────── 🍁  SECTION  🍁 ────── 🍂 ────── 🍁 ────── 🍂 ────── 🍁 ────── 🍂 ────── 🍁  SECTION  🍁 ────── 🍂 ────── 🍁





// ✅ create a module object called `monsterAnimGlue`
import * as monsterAnimGlue from "./monsterAnimGlue";
// ✅ create a module object called `heroAnimGlue`
import * as heroAnimGlue from "./heroAnimGlue";

// ✅ create a module object called `weaponAnimGlue`
import * as weaponAnimGlue from "./weaponAnimGlue";
import * as effectAnimGlue from "./effectAnimGlue";
import { listWeaponVariants } from "./weaponAtlas";
import {
    DECOR_ENABLED,
    DECOR_DEBUG,
    DECOR_ENABLE_SOLID_BLOCKING,
    DECOR_ENABLE_TIER2,
    DEBUG_CATEGORY_X,
    DEBUG_CATEGORY_X_SAMPLES,
    DEBUG_COLLIDER_ALPHA,
    DEBUG_COLLIDER_BODY_COLOR,
    DEBUG_COLLIDER_ENEMY_COLOR,
    DEBUG_COLLIDER_HIT_COLOR,
    DEBUG_COLLIDER_DECOR_COLOR,
    DEBUG_COLLIDER_AURA_COLOR,
    DEBUG_COLLIDER_NAV_COLOR,
    DEBUG_COLLIDER_NATIVE_COLOR,
    DEBUG_COLLIDER_SPRITE_COLOR,
    DEBUG_COLLIDER_WALL_COLOR,
    DEBUG_COMPAT_BACKGROUND,
    DEBUG_COMPAT_BOOT,
    DEBUG_COMPAT_CONTROLLER,
    DEBUG_COMPAT_TILEMAP_STUB,
    DEBUG_DRAW_ENEMY_COLLIDER_BOUNDS,
    DEBUG_DRAW_ENEMY_HITBOX,
    DEBUG_DRAW_ENEMY_AURA_BOUNDS,
    DEBUG_DRAW_ENEMY_NAV_FOOTPRINT,
    DEBUG_DRAW_ENEMY_NATIVE_BOUNDS,
    DEBUG_DRAW_ENEMY_SPRITE_BOUNDS,
    DEBUG_DRAW_ENEMY_WALL_COLLIDERS,
    DEBUG_DRAW_EFFECT_BOUNDS,
    DEBUG_DRAW_DECOR_COLLIDERS,
    DEBUG_DRAW_HERO_COLLIDER_BOUNDS,
    DEBUG_DRAW_HERO_HITBOX,
    DEBUG_DRAW_HERO_NAV_FOOTPRINT,
    DEBUG_DRAW_HERO_NATIVE_BOUNDS,
    DEBUG_DRAW_HERO_SPRITE_BOUNDS,
    DEBUG_DRAW_HERO_WALL_COLLIDERS,
    DEBUG_ENEMY_POS_GUARD,
    DEBUG_ENEMY_POS_GUARD_THROW,
    DEBUG_DRAW_WALL_COLLIDERS,
    DEBUG_ENEMY_FOOTPRINT_MAX_PX,
    DEBUG_ENEMY_WALL_FOOTPRINT_PX,
    DEBUG_HERO_NATIVE_FEET_ANCHOR,
    DEBUG_INT_HERO_NAME_FILTER,
    DEBUG_INT_HERO_VIS,
    DEBUG_INPUT_EDGE_LOGS,
    DEBUG_KIND56_CREATE_TRACE,
    DEBUG_NET,
    DEBUG_NET_APPLY_FOLLOWER,
    DEBUG_NET_SNAPSHOT,
    DEBUG_NPC_PIPELINE,
    DEBUG_EFFECT_MASKS,
    DEBUG_OVERLAPS,
    DEBUG_PROJECTILE_NATIVE,
    DEBUG_PROP_OUTLINE_VERBOSE,
    DEBUG_COLLIDER_EFFECT_FRAME_COLOR,
    DEBUG_COLLIDER_EFFECT_PIXEL_COLOR,
    DEBUG_ROLE_ACTOR,
    DEBUG_ROLE_AURA,
    DEBUG_ROLE_EFFECT,
    DEBUG_ROLE_ENEMY,
    DEBUG_ROLE_HERO,
    DEBUG_ROLE_OTHER,
    DEBUG_ROLE_PROJECTILE,
    DEBUG_SETFLAG,
    DEBUG_SPRITE_ATTACH,
    DEBUG_SPRITE_PIXELS,
    DEBUG_SPRITE_PIXELS_ALL,
    DEBUG_SPRITE_SYNC,
    DEBUG_WEAPON_SYNC,
    DEBUG_WRAP_TEX,
    FORCE_PROP_PREBAKED_OUTLINE,
    MAX_OVERLAP_DEBUG_LOGS,
} from "./debugFlags";
import { auraKey } from "./auraConfig";



// ============================================================
// DEBUG: Prove why hero disappears during intellect cast
// ============================================================
// Empty string = log all heroes; otherwise only log this heroName (e.g. "Jason")

// Put this near the top of arcadeCompat.ts with your other debug toggles
let _setFlagLogCount = 0;

// NPC pipeline debug (code-only)
const NPC_PIPE_COMPAT_LOG_ONCE_KEY = "__npcPipeCompatLogged";
const NPC_PIPE_WEAPON_CALL_LOG_ONCE_KEY = "__npcPipeWeaponCallLogged";

// Collider debug overlays (Phaser-only). Heavy when enabled; keep OFF by default.
// (flags live in src/debugFlags.ts)


// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮

// --------------------------------------------------------------
// DECOR PIPELINE (Phaser wrapper) — centralized + safe
// --------------------------------------------------------------
// Master switch: if false, ALL decor ingestion/rendering is disabled (no-op).
// (flags live in src/debugFlags.ts)

// We only apply when decorRev changes AND the renderer is ready.
// This keeps per-tick overhead near-zero.
let _decorAppliedRev = -1;

// One-time warnings (avoid console spam)
let _decorWarnedNoInternals = false;
let _decorWarnedNoRenderer = false;

// One-time overlap-proof install
let _decorOverlapProofInstalled = false;

// Mirror of engine DECOR_DATA keys (engine writes; wrapper reads)
// We duplicate the string literals here intentionally to avoid import coupling.
const DECOR_DATA_IS_COLLIDER = "decorCollider";
const DECOR_DATA_ID = "decorId";
const DECOR_DATA_ROLE = "decorRole";
const DECOR_DATA_NAME = "decorName";


import { getPropTileRefByName, PROP_VISUALS_BY_NAME } from "./tileAtlas";
import { getPropSpec, propBaseNameFromKey } from "./propSpecs";


const DECOR_DATA_TILE_R = "decorTileR";
const DECOR_DATA_TILE_C = "decorTileC";

type OpaqueAabb = { ox: number; oy: number; w: number; h: number };
const _decorOpaqueAabbCache: Record<string, OpaqueAabb> = Object.create(null);
type OpaqueBaseBounds = { minX: number; maxX: number; frameW: number; frameH: number; baseH: number };
const _decorOpaqueBaseCache: Record<string, OpaqueBaseBounds> = Object.create(null);

let _decorTmpCanvas: HTMLCanvasElement | null = null;
let _decorTmpCtx: CanvasRenderingContext2D | null = null;



const DECOR_SOLID_ALPHA_THRESHOLD = 1; // include edge antialias pixels
const DECOR_SOLID_INSET_PX = 0;        // start at 0 until it feels right


const DECOR_KIND_TRIGGER_FALLBACK = 60;
const DECOR_KIND_SOLID_FALLBACK = 61;

const DECOR_OVERLAP_LOG_COOLDOWN_MS = 600;

// key = `${kind}:${heroId}:${otherSpriteId}`
const _decorOverlapLastLogMs: Record<string, number> = Object.create(null);





// --------------------------------------------------------------
// RESERVED: future solid-blocking collision backends
// These are intentionally NOOP today (return false / do nothing).
// The engine-side hook exists (decorSolids_blockingHook) but is disabled.
// When we enable it, THIS is where the wrapper-side resolution will live.
// --------------------------------------------------------------

// 🍁 ────── 🍂 ────── 🍁  SECTION  🍁 ────── 🍂 ────── 🍁 ────── 🍂 ────── 🍁 ────── 🍂 ────── 🍁  SECTION  🍁 ────── 🍂 ────── 🍁
//This section is for the decor things decor section section decor section props props section


function decor_solidsResolveMove_tier1(_hero: Sprite, _nowMs: number): boolean {
    // Tier 1 backend: AABB/circle/compound-rect resolution (fast)
    // Return true if movement was modified/blocked.
    return false;
}

function decor_solidsResolveMove_tier2(_hero: Sprite, _nowMs: number): boolean {
    // Tier 2 backend: polygon/compound-poly resolution (gated; likely SAT/Matter later)
    // Return true if movement was modified/blocked.
    return false;
}


function _decor_tryGetPropFrameIndexAt(renderer: any, r: number, c: number): number {
    try {
        // Preferred: ask the renderer (it knows gid ranges + texture keys)
        if (renderer && typeof renderer.tryGetPropTileInfoAt === "function") {
            const info = renderer.tryGetPropTileInfoAt(r, c);
            if (info && typeof info.frameIndex === "number") return info.frameIndex | 0;
            return 0;
        }

        // Fallback: decode using tile.tileset.firstgid if present
        const tm =
            (renderer && ((renderer as any).tilemap || (renderer as any).map || (renderer as any)._tilemap || (renderer as any)._map)) ||
            null;

        if (tm && typeof tm.getTileAt === "function") {
            const tile: any = tm.getTileAt(c, r, false, "props");
            const idx = tile && typeof tile.index === "number" ? (tile.index | 0) : -1;
            if (idx < 0) return 0;

            const ts: any = tile?.tileset ?? null;
            const first = ts && typeof ts.firstgid === "number" ? (ts.firstgid | 0) : 0;
            return (idx - first) | 0;
        }
    } catch { /* ignore */ }

    return 0;
}

function _decor_computeOpaqueBaseBounds(
    scene: any,
    textureKey: string,
    frameIndex: number,
    baseHeightPx: number
): OpaqueBaseBounds | null {
    const baseH = Math.max(1, (baseHeightPx | 0));
    const cacheKey =
        textureKey + ":" + (frameIndex | 0) +
        ":base:" + (baseH | 0) +
        ":" + (DECOR_SOLID_ALPHA_THRESHOLD | 0) +
        ":" + (DECOR_SOLID_INSET_PX | 0);
    const hit = _decorOpaqueBaseCache[cacheKey];
    if (hit) return hit;

    try {
        const tex = scene && scene.textures ? scene.textures.get(textureKey) : null;
        if (!tex) return null;

        const frame: any = tex.get(frameIndex);
        const src: any = tex.getSourceImage ? tex.getSourceImage() : null;
        if (!frame || !src) return null;

        const sx = ((frame.cutX ?? frame.x) | 0);
        const sy = ((frame.cutY ?? frame.y) | 0);
        const sw = ((frame.cutWidth ?? frame.width ?? 0) | 0);
        const sh = ((frame.cutHeight ?? frame.height ?? 0) | 0);

        if (sw <= 0 || sh <= 0) return null;

        const useH = Math.max(1, Math.min(baseH | 0, sh | 0)) | 0;

        if (!_decorTmpCanvas) _decorTmpCanvas = document.createElement("canvas");
        if (!_decorTmpCtx) _decorTmpCtx = _decorTmpCanvas.getContext("2d", { willReadFrequently: true } as any);

        const cnv = _decorTmpCanvas!;
        const ctx = _decorTmpCtx!;
        cnv.width = sw | 0;
        cnv.height = useH | 0;

        ctx.clearRect(0, 0, sw, useH);

        const cropY = Math.max(0, (sh - useH) | 0);
        ctx.drawImage(src, sx, sy + cropY, sw, useH, 0, 0, sw, useH);

        const img = ctx.getImageData(0, 0, sw, useH);
        const data = img.data;

        let minX = 9999;
        let maxX = -1;

        for (let y = 0; y < useH; y++) {
            for (let x = 0; x < sw; x++) {
                const a = data[(((y * sw + x) * 4) + 3) | 0] | 0;
                if (a > (DECOR_SOLID_ALPHA_THRESHOLD | 0)) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                }
            }
        }

        if (maxX < minX) {
            minX = 0;
            maxX = (sw - 1) | 0;
        }

        const inset = (DECOR_SOLID_INSET_PX | 0);
        minX = Math.min(sw - 1, Math.max(0, (minX + inset) | 0));
        maxX = Math.min(sw - 1, Math.max(minX, (maxX - inset) | 0));

        const out: OpaqueBaseBounds = {
            minX: minX | 0,
            maxX: maxX | 0,
            frameW: sw | 0,
            frameH: sh | 0,
            baseH: useH | 0,
        };

        _decorOpaqueBaseCache[cacheKey] = out;
        return out;
    } catch {
        return null;
    }
}

function _decor_computeOpaqueAabbForFrame(scene: any, textureKey: string, frameIndex: number, tileSize: number): OpaqueAabb {
    const cacheKey = textureKey + ":" + (frameIndex | 0) + ":" + (DECOR_SOLID_ALPHA_THRESHOLD | 0) + ":" + (DECOR_SOLID_INSET_PX | 0);
    const hit = _decorOpaqueAabbCache[cacheKey];
    if (hit) return hit;

    // safe fallback = full tile
    let out: OpaqueAabb = { ox: 0, oy: 0, w: tileSize | 0, h: tileSize | 0 };

    try {
        const tex = scene && scene.textures ? scene.textures.get(textureKey) : null;
        if (!tex) {
            _decorOpaqueAabbCache[cacheKey] = out;
            return out;
        }

        const frame: any = tex.get(frameIndex);
        const src: any = tex.getSourceImage ? tex.getSourceImage() : null;
        if (!frame || !src) {
            _decorOpaqueAabbCache[cacheKey] = out;
            return out;
        }

        const sx = ((frame.cutX ?? frame.x) | 0);
        const sy = ((frame.cutY ?? frame.y) | 0);
        const sw = ((frame.cutWidth ?? frame.width ?? tileSize) | 0);
        const sh = ((frame.cutHeight ?? frame.height ?? tileSize) | 0);

        if (!_decorTmpCanvas) _decorTmpCanvas = document.createElement("canvas");
        if (!_decorTmpCtx) _decorTmpCtx = _decorTmpCanvas.getContext("2d", { willReadFrequently: true } as any);

        const cnv = _decorTmpCanvas!;
        const ctx = _decorTmpCtx!;
        cnv.width = tileSize;
        cnv.height = tileSize;

        ctx.clearRect(0, 0, tileSize, tileSize);
        ctx.drawImage(src, sx, sy, sw, sh, 0, 0, tileSize, tileSize);

        const img = ctx.getImageData(0, 0, tileSize, tileSize);
        const data = img.data;

        let minX = 9999, minY = 9999, maxX = -1, maxY = -1;

        for (let y = 0; y < tileSize; y++) {
            for (let x = 0; x < tileSize; x++) {
                const a = data[(((y * tileSize + x) * 4) + 3) | 0] | 0;
                if (a > (DECOR_SOLID_ALPHA_THRESHOLD | 0)) {
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                }
            }
        }

        if (maxX >= 0 && maxY >= 0) {
            const inset = (DECOR_SOLID_INSET_PX | 0);
            minX = Math.min(tileSize - 1, Math.max(0, (minX + inset) | 0));
            minY = Math.min(tileSize - 1, Math.max(0, (minY + inset) | 0));
            maxX = Math.min(tileSize - 1, Math.max(0, (maxX - inset) | 0));
            maxY = Math.min(tileSize - 1, Math.max(0, (maxY - inset) | 0));

            const w = Math.max(1, ((maxX - minX + 1) | 0)) | 0;
            const h = Math.max(1, ((maxY - minY + 1) | 0)) | 0;

            out = { ox: minX | 0, oy: minY | 0, w, h };
        }
    } catch {
        // keep fallback
    }

    _decorOpaqueAabbCache[cacheKey] = out;
    return out;
}





function _decor_getPrimaryTileTextureKey(renderer: any): string {
    // Prefer an explicit public field if you added one; otherwise, read atlas (runtime-private but stable).
    try {
        const atlas = renderer && (renderer as any).atlas;
        const key = atlas && (atlas as any).primaryTextureKey;
        if (typeof key === "string" && key) return key;
    } catch { /* ignore */ }

    // Fallback that matches your preload naming convention
    return "tiles.terrain";
}

function _decor_getSolidTileRC(s: Sprite, tileSize: number): { r: number; c: number } {
    let r = (sprites.readDataNumber(s, DECOR_DATA_TILE_R) | 0);
    let c = (sprites.readDataNumber(s, DECOR_DATA_TILE_C) | 0);

    if (r || c) return { r, c };

    // If missing, infer from current placement (this is still tile-aligned BEFORE we tighten)
    const left = (s.left | 0);
    const top = (s.top | 0);

    c = ((left / tileSize) | 0);
    r = ((top / tileSize) | 0);

    sprites.setDataNumber(s, DECOR_DATA_TILE_R, r);
    sprites.setDataNumber(s, DECOR_DATA_TILE_C, c);

    return { r, c };
}

function _decor_computeOpaqueAabbForTile(scene: any, textureKey: string, tileSize: number, row: number, col: number): OpaqueAabb {
    const cacheKey = textureKey + ":" + tileSize + ":" + (row | 0) + ":" + (col | 0);
    const hit = _decorOpaqueAabbCache[cacheKey];
    if (hit) return hit;

    // Default full tile (safe fallback)
    let out: OpaqueAabb = { ox: 0, oy: 0, w: tileSize | 0, h: tileSize | 0 };

    try {
        const tex = scene && scene.textures ? scene.textures.get(textureKey) : null;
        const src: any = tex ? tex.getSourceImage() : null;
        if (!src) {
            _decorOpaqueAabbCache[cacheKey] = out;
            return out;
        }

        if (!_decorTmpCanvas) _decorTmpCanvas = document.createElement("canvas");
        if (!_decorTmpCtx) _decorTmpCtx = _decorTmpCanvas.getContext("2d", { willReadFrequently: true } as any);

        const cnv = _decorTmpCanvas!;
        const ctx = _decorTmpCtx!;
        cnv.width = tileSize;
        cnv.height = tileSize;

        const sx = (col * tileSize) | 0;
        const sy = (row * tileSize) | 0;

        ctx.clearRect(0, 0, tileSize, tileSize);
        ctx.drawImage(src, sx, sy, tileSize, tileSize, 0, 0, tileSize, tileSize);

        const img = ctx.getImageData(0, 0, tileSize, tileSize);
        const data = img.data;

        let minX = 9999, minY = 9999, maxX = -1, maxY = -1;

        for (let y = 0; y < tileSize; y++) {
            for (let x = 0; x < tileSize; x++) {
                const idx = (((y * tileSize + x) * 4) + 3) | 0; // alpha channel
                const a = data[idx] | 0;
                if (a > (DECOR_SOLID_ALPHA_THRESHOLD | 0)) {
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                }
            }
        }

        // If nothing opaque, keep full-tile fallback.
        if (maxX >= 0 && maxY >= 0) {
            // Optional inset to reduce "sticky" feel
            const inset = (DECOR_SOLID_INSET_PX | 0);
            minX = Math.min(tileSize - 1, Math.max(0, (minX + inset) | 0));
            minY = Math.min(tileSize - 1, Math.max(0, (minY + inset) | 0));
            maxX = Math.min(tileSize - 1, Math.max(0, (maxX - inset) | 0));
            maxY = Math.min(tileSize - 1, Math.max(0, (maxY - inset) | 0));

            const w = Math.max(1, ((maxX - minX + 1) | 0)) | 0;
            const h = Math.max(1, ((maxY - minY + 1) | 0)) | 0;

            out = { ox: minX | 0, oy: minY | 0, w, h };
        }
    } catch {
        // keep fallback
    }

    _decorOpaqueAabbCache[cacheKey] = out;
    return out;
}



function decor_applyTightOpaqueAabbToSolids(args: {
    scene: any;
    renderer: any;
    solids: any;
    tileSize: number;
}): void {
    if (!args) return;

    const scene = (args as any).scene;
    const renderer = (args as any).renderer;
    const tileSize = (((args as any).tileSize ?? 0) | 0);

    if (!scene || !renderer || tileSize <= 0) return;

    const solAny: any = (args as any).solids;

    // Normalize "solids" to a real array so we never explode on `.length`.
    let sol: any[] | null = null;
    if (Array.isArray(solAny)) {
        sol = solAny as any[];
    } else if (solAny && typeof solAny.length === "number") {
        try {
            sol = Array.prototype.slice.call(solAny);
        } catch {
            sol = null;
        }
    }

    if (!sol || sol.length <= 0) return;

    for (let i = 0; i < sol.length; i++) {
        const s: any = sol[i];
        if (!s) continue;

        const name = (sprites.readDataString(s, DECOR_DATA_NAME) || "");
        if (!name) continue;

        // Tile coordinate in WORLD grid (stored earlier by your prop-grid builder, or inferred)
        let r = (sprites.readDataNumber(s, "decorTileR") | 0);
        let c = (sprites.readDataNumber(s, "decorTileC") | 0);

        // If both are 0, treat as "unset" and infer from position (safe default)
        if ((r | 0) === 0 && (c | 0) === 0) {
            c = (((s.left as any) / tileSize) | 0);
            r = (((s.top as any) / tileSize) | 0);
            sprites.setDataNumber(s, "decorTileR", r);
            sprites.setDataNumber(s, "decorTileC", c);
        }

        // A2 (multi-tileset) path: ask the WorldTileRenderer for {textureKey, frameIndex}
        // so the opaque-AABB sampling hits the correct sheet.
        let info: { textureKey: string; frameIndex: number } | null = null;

        try {
            if (typeof (renderer as any).tryGetPropTileInfoAt === "function") {
                info = (renderer as any).tryGetPropTileInfoAt(r, c);
            }
        } catch {
            info = null;
        }

        // Back-compat fallback (single-sheet): use tile index directly on the primary sheet
        if (!info) {
            const idx = _decor_tryGetPropFrameIndexAt(renderer, r, c);
            if (typeof idx === "number" && (idx | 0) >= 0) {
                const tk = _decor_getPrimaryTileTextureKey(renderer);
                info = { textureKey: tk, frameIndex: (idx | 0) };
            }
        }

        if (!info) {
            if (DECOR_DEBUG) _decor_dbg("AABB", "no prop tile info at (r,c); skipping tighten", { name, r, c });
            continue;
        }

        const baseName = propBaseNameFromKey(name);
        const spec = baseName ? getPropSpec(baseName) : null;
        const vis: any = baseName ? (PROP_VISUALS_BY_NAME as any)[baseName] : null;

        const collision = spec?.collision;
        const collisionMode = (collision?.mode || "").trim();
        let baseHeightPx = 0;
        let useAura = false;
        let forceAura = false;

        if (collisionMode === "base") {
            baseHeightPx = (collision?.baseHeightPx ?? vis?.collisionBaseHeightPx ?? 0) | 0;
            useAura = !!(collision?.useAura ?? vis?.collisionUseAura);
        } else if (collisionMode === "aura") {
            baseHeightPx = 0;
            useAura = !!(collision?.useAura ?? true);
            forceAura = true;
        } else if (collisionMode === "opaque") {
            baseHeightPx = 0;
            useAura = false;
        } else if (collisionMode === "none" || collisionMode === "polygon") {
            baseHeightPx = 0;
            useAura = false;
        } else {
            baseHeightPx = (collision?.baseHeightPx ?? vis?.collisionBaseHeightPx ?? 0) | 0;
            useAura = !!(collision?.useAura ?? vis?.collisionUseAura);
        }

        if ((baseHeightPx | 0) > 0) {
            let srcKey = info.textureKey;
            if (useAura) {
                const auraTexKey = auraKey(info.textureKey, 0);
                if (!scene?.textures?.exists?.(auraTexKey)) {
                    throw new Error(
                        `[AURA-MISSING] Missing prop aura (r0) for ${info.textureKey}. Run: npm run gen-prop-auras`
                    );
                }
                srcKey = auraTexKey;
            }

            const bbBase = _decor_computeOpaqueBaseBounds(scene, srcKey, info.frameIndex, baseHeightPx | 0);
            if (bbBase) {
                const offX = (vis?.offsetXPx ?? 0) | 0;
                const offY = (vis?.offsetYPx ?? 0) | 0;

                const centerX = (((c * tileSize) + (tileSize >> 1) + offX) | 0);
                const centerY = (((r * tileSize) + (tileSize >> 1) + offY) | 0);

                const halfW = Math.idiv((bbBase.frameW | 0), 2) | 0;
                const halfH = Math.idiv((bbBase.frameH | 0), 2) | 0;
                const spriteLeft = ((centerX - halfW) | 0);
                const spriteTop = ((centerY - halfH) | 0);

                const left = ((spriteLeft + (bbBase.minX | 0)) | 0);
                const top = ((spriteTop + ((bbBase.frameH | 0) - (bbBase.baseH | 0))) | 0);
                const w = Math.max(1, (((bbBase.maxX | 0) - (bbBase.minX | 0) + 1) | 0)) | 0;
                const h = Math.max(1, (bbBase.baseH | 0)) | 0;

                const img = image.create(w | 0, h | 0);
                if (typeof s.setImage === "function") s.setImage(img);
                else s.image = img;

                s.left = (left | 0);
                s.top = (top | 0);

                if (DECOR_DEBUG) {
                    _decor_dbg("AABB", "tightened base-only solid", { name, tileR: r, tileC: c, info, bbBase });
                }
                continue;
            }
        }

        let fullKey = info.textureKey;
        if (forceAura && useAura) {
            const auraTexKey = auraKey(info.textureKey, 0);
            if (!scene?.textures?.exists?.(auraTexKey)) {
                throw new Error(
                    `[AURA-MISSING] Missing prop aura (r0) for ${info.textureKey}. Run: npm run gen-prop-auras`
                );
            }
            fullKey = auraTexKey;
        }

        const bb = _decor_computeOpaqueAabbForFrame(scene, fullKey, info.frameIndex, tileSize);

        // Resize Arcade collider sprite to tight bounds
        const img = image.create((bb.w | 0), (bb.h | 0));
        if (typeof s.setImage === "function") s.setImage(img);
        else s.image = img;

        // Reposition inside the tile
        s.left = ((c * tileSize + (bb.ox | 0)) | 0);
        s.top  = ((r * tileSize + (bb.oy | 0)) | 0);

        if (DECOR_DEBUG) {
            _decor_dbg("AABB", "tightened solid", { name, tileR: r, tileC: c, info, bb });
        }
    }

}



function decor_installOverlapProofHandlersOnce(): void {
    if (_decorOverlapProofInstalled) return;

    // Player kind is stable in compat
    const kindPlayer = (((SpriteKind as any).Player ?? 1) | 0);

    // Resolve decor kinds from engine internals (most reliable), then fallback.
    const g: any = (globalThis as any);
    const internals: any = g ? g.__HeroEnginePhaserInternals : null;

    let kindTrigger = 0;
    let kindSolid = 0;

    try {
        const trigList: any = internals && typeof internals.getDecorTriggerSprites === "function"
            ? internals.getDecorTriggerSprites()
            : null;
        if (trigList && trigList.length) kindTrigger = (trigList[0].kind | 0);
    } catch { /* ignore */ }

    try {
        const solList: any = internals && typeof internals.getDecorSolidSprites === "function"
            ? internals.getDecorSolidSprites()
            : null;
        if (solList && solList.length) kindSolid = (solList[0].kind | 0);
    } catch { /* ignore */ }

    const DECOR_KIND_TRIGGER_FALLBACK = 60;
    const DECOR_KIND_SOLID_FALLBACK = 61;

    if (!kindTrigger) kindTrigger = (((SpriteKind as any).DecorTrigger ?? DECOR_KIND_TRIGGER_FALLBACK) | 0);
    if (!kindSolid)  kindSolid  = (((SpriteKind as any).DecorSolid  ?? DECOR_KIND_SOLID_FALLBACK)  | 0);

    // If either is still bogus, bail WITHOUT marking installed (so we retry next boot)
    if (!kindTrigger || !kindSolid) {
        _decor_dbg("OVERLAP-PROOF", "kinds unresolved; skipping install (will retry)", {
            kindPlayer, kindTrigger, kindSolid
        });
        return;
    }

    function nowMs(): number {
        try {
            const gr = (game as any);
            if (gr && typeof gr.runtime === "function") return (gr.runtime() | 0);
        } catch { /* ignore */ }
        return (Date.now() | 0);
    }

    function shouldLog(kindLabel: string, heroId: number, otherId: number): boolean {
        const t = nowMs();
        const k = kindLabel + ":" + (heroId | 0) + ":" + (otherId | 0);
        const last = _decorOverlapLastLogMs[k];
        if (last != null && ((t - (last | 0)) | 0) < (DECOR_OVERLAP_LOG_COOLDOWN_MS | 0)) return false;
        _decorOverlapLastLogMs[k] = t;
        return true;
    }

    // Proof: hero enters trigger zone (e.g. sand patch trigger)
    sprites.onOverlap(kindPlayer, kindTrigger, function (a: Sprite, b: Sprite) {
        if (!DECOR_DEBUG) return;
        if (!shouldLog("TRIG", a.id | 0, b.id | 0)) return;

        const id = (sprites.readDataNumber(b, DECOR_DATA_ID) | 0);
        const name = sprites.readDataString(b, DECOR_DATA_NAME) || "";
        const role = (sprites.readDataNumber(b, DECOR_DATA_ROLE) | 0);

        console.log("[DECOR][OVERLAP-PROOF] hero=", a.id, " triggerId=", id, " name=", name, " role=", role);
    });

    // Proof: hero touches solid collider (e.g. rock collider)
    sprites.onOverlap(kindPlayer, kindSolid, function (a: Sprite, b: Sprite) {
        if (!DECOR_DEBUG) return;
        if (!shouldLog("SOLID", a.id | 0, b.id | 0)) return;

        const id = (sprites.readDataNumber(b, DECOR_DATA_ID) | 0);
        const name = sprites.readDataString(b, DECOR_DATA_NAME) || "";
        const role = (sprites.readDataNumber(b, DECOR_DATA_ROLE) | 0);

        console.log("[DECOR][OVERLAP-PROOF] hero=", a.id, " solidId=", id, " name=", name, " role=", role);
    });

    _decorOverlapProofInstalled = true;
    _decor_dbg("OVERLAP-PROOF", "armed", { kindPlayer, kindTrigger, kindSolid, cooldownMs: DECOR_OVERLAP_LOG_COOLDOWN_MS });
}


function _decor_dbg(tag: string, msg: string, payload?: any): void {
    if (!DECOR_DEBUG) return;
    if (payload !== undefined) console.log(`[DECOR][${tag}]`, msg, payload);
    else console.log(`[DECOR][${tag}]`, msg);
}

// Engine is art-agnostic; it publishes numeric semantic ids.
// We translate those ids to tileAtlas semantic keys here (v1 proof).
function _decor_decalIdToKey(id: number): string {
    const v = id | 0

    // Existing proof asset
    if (v === 1) return "sand_patch"

    // Dungeon telepad (100..104 top, 110..114 bot)
    if (v >= 100 && v <= 104) return `telepad${v - 100}_top`
    if (v >= 110 && v <= 114) return `telepad${v - 110}_bot`

    // Dungeon stairs statue (120..122)
    if (v === 120) return "stairs_statue_top"
    if (v === 121) return "stairs_statue_mid"
    if (v === 122) return "stairs_statue_bot"

    return ""
}

function _decor_propIdToKey(id: number): string {
    switch (id | 0) {
        case 1: return "rock_mountain"; // PROP_ROCK_MOUNTAIN (engine semantic id)
        case 4: return "pedestal"; // PROP_PEDESTAL (engine semantic id)
        default: return "";
    }
}


// Central choke point: ingest decor from engine internals + sync Phaser decal overlay.
// SAFE: no-op if internals missing, renderer missing, or rev unchanged.
function decor_maybeSyncFromEngineInternals(): void {
    if (!DECOR_ENABLED) return;

    const g: any = (globalThis as any);
    const internals: any = g ? g.__HeroEnginePhaserInternals : null;

    if (!internals || typeof internals.getDecorRev !== "function") {
        if (!_decorWarnedNoInternals) {
            _decorWarnedNoInternals = true;
            _decor_dbg("BOOT", "no __HeroEnginePhaserInternals.getDecorRev() yet; skipping");
        }
        return;
    }

    const rev = (internals.getDecorRev() | 0);
    if (rev === (_decorAppliedRev | 0)) return;

    const sc: any = g ? g.__phaserScene : null;
    const renderer: any = sc && sc.registry ? sc.registry.get("__worldTileRenderer") : null;
    if (!renderer || typeof renderer.syncDecalGridByName !== "function") {
        if (!_decorWarnedNoRenderer) {
            _decorWarnedNoRenderer = true;
            _decor_dbg("BOOT", "no __worldTileRenderer with syncDecalGridByName() yet; will retry");
        }
        return;
    }

    _decor_dbg("BOOT", `begin v=1 decorRev=${rev}`);
    _decor_dbg("GATES", "feature gates", {
        tier2: !!DECOR_ENABLE_TIER2,
        solidBlocking: !!DECOR_ENABLE_SOLID_BLOCKING
    });

    const decalGrid: any = (typeof internals.getDecalGrid === "function") ? internals.getDecalGrid() : null;
    const trig: any = (typeof internals.getDecorTriggerSprites === "function") ? internals.getDecorTriggerSprites() : null;
    const sol: any  = (typeof internals.getDecorSolidSprites === "function") ? internals.getDecorSolidSprites() : null;

    const trigCount = (trig && trig.length) ? (trig.length | 0) : 0;
    const solCount  = (sol && sol.length) ? (sol.length | 0) : 0;

    const rows = (decalGrid && decalGrid.length) ? (decalGrid.length | 0) : 0;
    const cols = (rows > 0 && decalGrid[0] && decalGrid[0].length) ? (decalGrid[0].length | 0) : 0;

    _decor_dbg("VALID", "counts", { rows, cols, triggers: trigCount, solids: solCount });

    // Convert numeric decals -> semantic keys
    const keyGrid: Array<Array<string | "" | null | undefined>> = new Array(rows);
    let decalPlaced = 0;

    for (let r = 0; r < rows; r++) {
        const srcRow = decalGrid[r];
        const outRow: Array<string> = new Array(cols);
        for (let c = 0; c < cols; c++) {
            const id = (srcRow && srcRow[c] != null) ? (srcRow[c] | 0) : 0;
            if (id) {
                const key = _decor_decalIdToKey(id);
                if (key) { outRow[c] = key; decalPlaced++; }
                else outRow[c] = "";
            } else outRow[c] = "";
        }
        keyGrid[r] = outRow;
    }

    renderer.syncDecalGridByName(keyGrid);

    const tileSize = (typeof internals.getWorldTileSize === "function")
        ? (internals.getWorldTileSize() | 0)
        : 32;

    // Props overlay from solid colliders (tile-aligned) AND triggers (for visuals like teleport rune)
    let propPlaced = 0;
    if (typeof renderer.syncPropGridByName === "function" && rows > 0 && cols > 0) {
        const propGrid: Array<Array<string | "" | null | undefined>> = new Array(rows);
        for (let r = 0; r < rows; r++) {
            const row: Array<string> = new Array(cols);
            for (let c = 0; c < cols; c++) row[c] = "";
            propGrid[r] = row;
        }

        // Solids first (they win if collision visuals overlap)
        if (sol && sol.length && tileSize > 0) {
            for (let i = 0; i < sol.length; i++) {
                const s: any = sol[i];
                if (!s) continue;

                let key = "";
                try { key = (sprites.readDataString(s, DECOR_DATA_NAME) || ""); } catch { key = ""; }
                if (!key) continue;

                const rc = _decor_getSolidTileRC(s, tileSize);
                if (rc.r < 0 || rc.c < 0 || rc.r >= rows || rc.c >= cols) continue;

                propGrid[rc.r][rc.c] = key;
                propPlaced++;
            }
        }

        // Triggers next (ONLY fill empty cells)
        if (trig && trig.length && tileSize > 0) {
            for (let i = 0; i < trig.length; i++) {
                const s: any = trig[i];
                if (!s) continue;

                let key = "";
                try { key = (sprites.readDataString(s, DECOR_DATA_NAME) || ""); } catch { key = ""; }
                if (!key) continue;

                const rc = _decor_getSolidTileRC(s, tileSize);
                if (rc.r < 0 || rc.c < 0 || rc.r >= rows || rc.c >= cols) continue;

                if (!propGrid[rc.r][rc.c]) {
                    propGrid[rc.r][rc.c] = key;
                    propPlaced++;
                }
            }
        }

        renderer.syncPropGridByName(propGrid);
    }

    // tighten solid colliders to the opaque bounds of their PNG tile art
    decor_applyTightOpaqueAabbToSolids({
        scene: sc,
        renderer,
        solids: sol,
        tileSize
    });

    // Install proof overlaps once
    decor_installOverlapProofHandlersOnce();

    _decor_dbg("DECAL", `rendered overlay tiles count=${decalPlaced}`);
    if (propPlaced) _decor_dbg("PROPS", `rendered prop tiles count=${propPlaced}`);
    _decor_dbg("BOOT", "end");

    _decorAppliedRev = rev;
}



function decor_forceResyncFromEngine(reason: string): void {
    // The tilemap renderer clears decal/prop layers during syncFromEngineGrid().
    // That can wipe overlays without changing engine decorRev.
    // Force a re-apply by invalidating the applied rev and syncing immediately.
    _decorAppliedRev = -999999;

    if (DECOR_DEBUG) _decor_dbg("FORCE", "decor_forceResyncFromEngine", { reason });

    decor_maybeSyncFromEngineInternals();
}

(function installDecorForceResyncHook() {
    const g: any = globalThis as any;
    g.__HeroEnginePhaserDecor = g.__HeroEnginePhaserDecor || {};
    g.__HeroEnginePhaserDecor.forceResync = decor_forceResyncFromEngine;
})();

// 🍁 ────── 🍂 ────── 🍁  SECTION  🍁 ────── 🍂 ────── 🍁 ────── 🍂 ────── 🍁 ────── 🍂 ────── 🍁  SECTION  🍁 ────── 🍂 ────── 🍁


// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮


// 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥
//Constants -- random and various constants section section constants




// === UI marker keys (shared) ===
const UI_KIND_KEY = "__uiKind";
const UI_KIND_STATUSBAR = "statusbar";
const UI_KIND_COMBO_METER = "comboMeter";
const UI_KIND_AGI_AIM_INDICATOR = "agiAimIndicator";
// === Text sprite UI marker ===
const UI_KIND_TEXT = "text";

const HERO_WPN_COMBO_KEY = "wCo";

const UI_KIND_AGI_STORED_COUNTER = "agiStoredCounter"


// ------------------------------------------------------------
// Weapon loadout keys (must match HeroEngineInPhaser.ts HERO_DATA)
// ------------------------------------------------------------
const HERO_WPN_VER_KEY = "wVer";
const HERO_WPN_SLASH_KEY = "wSl";
const HERO_WPN_THRUST_KEY = "wTh";
const HERO_WPN_CAST_KEY = "wCa";
const HERO_WPN_EXEC_KEY = "wEx";
const HERO_WPN_INT_KEY = "wInt";
const HERO_WPN_SUP_KEY = "wSup";
const HERO_AIM_DIR_X1000_KEY = "aimDx";
const HERO_AIM_DIR_Y1000_KEY = "aimDy";
const HERO_AIM_ANGLE_MDEG_KEY = "aimAng";

// Weapon diagonal aim render mode:
//  - "rotate": rotate the weapon overlays to the aim angle
//  - "ghost": keep weapon cardinal, show a rotated ghost at aim
//  - "projectile": no weapon changes (only projectiles follow aim)
const WPN_AIM_RENDER_MODE: "rotate" | "ghost" | "projectile" = "projectile";
const WPN_AIM_GHOST_ALPHA = 0.6;
const WPN_AIM_GHOST_OFFSET_PX = 6;

// Staff-cast hover tuning (Intellect/Support)
const STAFF_CAST_DEFAULT_CLIP_LEN = 7;
const STAFF_CAST_RETURN_FRAMES = 2;
const STAFF_CAST_X_OFF_PX = 14;
const STAFF_CAST_BASE_Y_OFF_PX = -4;
const STAFF_CAST_HOVER_AMP_PX = 2;
const STAFF_CAST_HOVER_PERIOD_MS = 500;
const STAFF_CAST_FRAME_COL_BY_ID: Record<string, number> = {
    gnarled: 0,
    simple: 0,
    loop: 0,
    diamond: 0,
    s: 0,
};

// Agility state key + enum values (must match HeroEngineInPhaser.ts)
const HERO_AGI_STATE_KEY = "aState";
const AGI_STATE_EXECUTING = 2;

// Agility v4: EXEC sheen (Phaser-only beauty knobs)
const AGI_WPN_SHEEN_PULSE_MS = 160
const AGI_WPN_SHEEN_ALPHA_MIN = 0.55
const AGI_WPN_SHEEN_ALPHA_MAX = 1.0

// Agility v4: execute FX (Phaser-only)
const AGI_EXEC_STREAK_DT_MS = 35
const AGI_EXEC_STREAK_FLY_MS = 140
const AGI_EXEC_STREAK_SIZE = 2
const AGI_EXEC_TICK_BOUNCE_SCALE = 1.28
const AGI_EXEC_TICK_BOUNCE_MS = 70

// Execute layering: temporarily lift hero + weapon overlays above monsters during execute.
const HERO_EXECUTE_DEPTH_BOOST = 10000;

const UI_STATUSBAR_FOLLOW_DEPTH_BIAS = 10;

const HERO_WPN_GHOST_BG_DEPTH_OFF = 1;
const HERO_WPN_GHOST_FG_DEPTH_OFF = 2;
const HERO_WPN_BG_DEPTH_OFF = 3;
const HERO_WPN_FG_DEPTH_OFF = 4;

// Execute streamline (Phaser-only)
const AGI_EXEC_STREAMLINE_LIFE_MS = 140;
const AGI_EXEC_STREAMLINE_STREAK_THICK = 6;
const AGI_EXEC_STREAMLINE_STREAK_ALPHA = 0.85;
const AGI_EXEC_STREAMLINE_STREAK_COLOR = 0xfff06a;

const AGI_EXEC_STREAMLINE_SQUASH_X = 1.55; // hero stretches along slash
const AGI_EXEC_STREAMLINE_SQUASH_Y = 0.60; // hero gets skinny
const AGI_EXEC_STREAMLINE_TWEEN_MS = 120;



// Universal EventMask bits (must match HeroEngineInPhaser.ts)
const EVENT_MASK_AGI_EXEC_SLASH = 1 << 0
const EVENT_MASK_SHOP_SWAP = 1 << 1

const SHOP_AURA_GLOW_PERIOD_MS = 1280
const SHOP_AURA_GLOW_ALPHA_MIN = 0.65
const SHOP_AURA_GLOW_ALPHA_MAX = 1.0

const SHOP_SWAP_FX_MS = 180
const SHOP_SWAP_FX_PULSE_MS = 60
const SHOP_SWAP_FX_ALPHA_MIN = 0.35
const SHOP_SWAP_FX_ALPHA_MAX = 1.0

// Execute slash visuals (Phaser-only)
const AGI_EXEC_SLASH_MARK_LEN = 28
const AGI_EXEC_SLASH_MARK_THICK = 4
const AGI_EXEC_SLASH_MARK_LIFE_MS = 520
const AGI_EXEC_SLASH_MARK_FADE_MS = 320
const AGI_EXEC_SLASH_MARK_COLOR = 0xffe14a
const AGI_EXEC_SLASH_DASH_THICK = 2
const AGI_EXEC_SLASH_DASH_FADE_MS = 160


// Execute mark angles (radians). Chosen deterministically from ActionSeed + beat index.
const AGI_EXEC_ANGLE_PATTERNS: number[][] = [
    // Pattern 0: classic X
    [ 0.78, -0.78, 0.78, -0.78 ],
    // Pattern 1: tight cross
    [ 0.35, -0.35, 1.20, -1.20 ],
    // Pattern 2: spiral-ish
    [ 0.20, 0.78, 1.35, -0.35 ],
    // Pattern 3: aggressive alternating
    [ 1.05, -0.35, 0.78, -1.25 ],
];




// Agility v4 published keys (must match HeroEngineInPhaser.ts HERO_DATA)
const HERO_AGI_CHARGE_ACTIVE_KEY = "aChg"; // 0/1
const HERO_AGI_PENDING_ADD_KEY = "aPend";  // number
const HERO_AGI_IS_EXEC_WINDOW_KEY = "aExW"; // 0/1


// Agility v4 published keys (engine -> Phaser)
const HERO_AGI_V4_EXECUTE_SEQ_KEY = "aExSeq"
const HERO_AGI_V4_LAST_ADD_KEY = "aLastAdd"
const HERO_AGI_V4_STORED_HITS_KEY = "aStor"     // preferred (new)
const HERO_AGI_PKT_COUNT_FALLBACK_KEY = "aPkC"  // fallback (old stored hits)


const DEFAULT_WEAPON_VARIANT = "base";
const _weaponVariantByHeroIndex: Record<number, Record<string, string>> = Object.create(null);
const _weaponVariantByKey: Record<string, string> = Object.create(null);

function _pickWeaponVariantForModel(weaponId: string): string {
    const id = String(weaponId || "").trim();
    if (!id) return DEFAULT_WEAPON_VARIANT;
    const variants = listWeaponVariants(id);
    if (!variants || variants.length === 0) return DEFAULT_WEAPON_VARIANT;
    const idx = Math.max(0, Math.min(variants.length - 1, Math.floor(Math.random() * variants.length)));
    return variants[idx] || DEFAULT_WEAPON_VARIANT;
}

function _weaponVariantForHero(heroIndex: number, weaponId: string): string {
    const id = String(weaponId || "").trim();
    if (!id) return DEFAULT_WEAPON_VARIANT;
    const hi = heroIndex | 0;
    if (hi < 0) return _weaponVariantForKey("hero", id);
    let map = _weaponVariantByHeroIndex[hi];
    if (!map) _weaponVariantByHeroIndex[hi] = map = Object.create(null);
    const hit = map[id];
    if (hit) return hit;
    const pick = _pickWeaponVariantForModel(id);
    map[id] = pick;
    return pick;
}

function _weaponVariantForKey(key: string, weaponId: string): string {
    const id = String(weaponId || "").trim();
    if (!id) return DEFAULT_WEAPON_VARIANT;
    const k = `${String(key || "").trim()}|${id}`;
    const hit = _weaponVariantByKey[k];
    if (hit) return hit;
    const pick = _pickWeaponVariantForModel(id);
    _weaponVariantByKey[k] = pick;
    return pick;
}

// Cache: heroIndex -> cast weapon model id (wCa)
const _heroCastWeaponByIndex: { [k: number]: string } = Object.create(null);



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

// Generic focus outline data keys (engine-driven)
const FOCUS_OUTLINE_ACTIVE_KEY = "focusOutlineActive";
const FOCUS_OUTLINE_COLOR_KEY = "focusOutlineColor";
const FOCUS_OUTLINE_RADIUS_KEY = "focusOutlineRadius";
const FOCUS_OUTLINE_DEPTH_BIAS_KEY = "focusOutlineDepthBias";

const UI_TEXT_ALIGN_KEY = "__txtAlign";   // number; 0=left, 1=center, 2=right

// (Reserved for later if we decide to support icon sprites in Phaser text containers)
const UI_TEXT_ICON_KIND_KEY = "__txtIconKind";




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





// 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥

// 🌕 ────── ✨ ────── 🌕  SECTION  🌕 ────── ✨ ────── 🌕 ────── ✨ ────── 🌕 ────── ✨ ────── 🌕  SECTION  🌕 ────── ✨ ────── 🌕

//Intellect specials section

// ------------------------------------------------------------
// Intellect spell visuals (Phaser-only)
// ------------------------------------------------------------
// NOTE: FAMILY.INTELLECT is 2 in HeroEngineInPhaser.ts; we mirror that here
// so Phaser can recognize intellect spell projectiles.
const FAMILY_INTELLECT = 2;
const FAMILY_HEAL = 3;

// Hero + projectile data keys (must match HeroEngineInPhaser.ts)
const HERO_INDEX_DATA_KEY = "heroIndex";
const HERO_IS_CTRL_SPELL_KEY = "isCtrlSpell";
const PROJ_FAMILY_KEY = "family";
const PROJ_HERO_INDEX_KEY = "heroIndex";
const EFFECT_SKIN_DATA_KEY = "effectSkin";
const EFFECT_DIR_DATA_KEY = "effectDir";
const EFFECT_DEBUG_ID_KEY = "effectDebugId";
const EFFECT_OFFX_DATA_KEY = "effectOffX";
const EFFECT_OFFY_DATA_KEY = "effectOffY";
const EFFECT_TINT_DATA_KEY = "effectTint";
const EFFECT_ALPHA_DATA_KEY = "effectAlpha";
const EFFECT_BLEND_DATA_KEY = "effectBlend";
const EFFECT_FORCE_TOP_DATA_KEY = "effectForceTop";
const EFFECT_MASK_INVERT_DATA_KEY = "effectMaskInvert";
const EFFECT_MASK_RADIUS_DATA_KEY = "effectMaskRadius";
const EFFECT_MASK_RADIUS_PX_DATA_KEY = "effectMaskRadiusPx";
const EFFECT_MASK_SPRITE_REF_DATA_KEY = "effectMaskSpriteRef";
const EFFECT_HERO_REF_DATA_KEY = "effectHeroRef";
const EFFECT_FPS_DATA_KEY = "effectFps";
const EFFECT_REPEAT_DATA_KEY = "effectRepeat";
const EFFECT_MODE_DATA_KEY = "effectMode";
const EFFECT_SCALE_DATA_KEY = "effectScale";
const EFFECT_BRUSH_PX_DATA_KEY = "effectBrushPx";
const EFFECT_POP_MS_DATA_KEY = "effectPopMs";
const EFFECT_POP_SCALE_DATA_KEY = "effectPopScale";
const EFFECT_POP_START_MS_DATA_KEY = "effectPopStartMs";
const EFFECT_ALIGN_BOTTOM_Y_DATA_KEY = "effectAlignBottomY";
const EFFECT_INTRO_MS_DATA_KEY = "effectIntroMs";
const EFFECT_INTRO_SCALE_DATA_KEY = "effectIntroScale";
const EFFECT_INTRO_START_MS_DATA_KEY = "effectIntroStartMs";
const EFFECT_ANIM_DELAY_MS_DATA_KEY = "effectAnimDelayMs";
const EFFECT_ANIM_DELAY_START_MS_DATA_KEY = "effectAnimDelayStartMs";
const EFFECT_FRAME_WINDOW_MS_DATA_KEY = "effectFrameWindowMs";

const EFFECT_BLANK_TEX_KEY = "__effectBlankTex";
const EFFECT_FORCE_TOP_DEPTH = 2000000000;

function _getEffectAtlasFromScene(scene: Phaser.Scene): any | null {
    const anyScene = scene as any;
    return (
        (scene.registry?.get?.("effectAtlas") as any) ||
        (anyScene.effectAtlas as any) ||
        (anyScene.__effectAtlas as any) ||
        ((globalThis as any).__effectAtlas as any) ||
        null
    );
}

function _resolveEffectAtlasEntry(atlas: any, skin: string, dir: string): any | null {
    if (!atlas || !skin) return null;
    const direct = atlas[skin];
    if (direct) return direct;
    const dirLower = String(dir || "").trim().toLowerCase();
    if (!dirLower) return null;
    const suffixes = [`_${dirLower}`, `-${dirLower}`, ` ${dirLower}`];
    for (const suffix of suffixes) {
        const candidate = `${skin}${suffix}`;
        if (atlas[candidate]) return atlas[candidate];
    }
    return null;
}

function _ensureEffectBlankTexture(sc: Phaser.Scene): string {
    const key = EFFECT_BLANK_TEX_KEY;
    if (!sc.textures || sc.textures.exists(key)) return key;
    const tex = sc.textures.createCanvas(key, 1, 1);
    if (tex) {
        const ctx = tex.getContext();
        if (ctx) ctx.clearRect(0, 0, 1, 1);
        tex.refresh();
    }
    return key;
}

const __effectMaskSyncOnce = new Set<string>();
const __effectMaskInitOnce = new Set<string>();
const __effectMaskSkipOnce = new Set<string>();
const __effectMaskHideOnce = new Set<string>();
const __effectMaskClearOnce = new Set<string>();
const __effectMaskKeyOnce = new Set<string>();
const __effectMaskVisOnce = new Set<string>();
const __effectMaskTexOnce = new Set<string>();

const __heroNativeByIndex: { [idx: number]: any } = Object.create(null);

function _setHeroNativeByIndex(heroIndex: number, nativeAny: any): void {
    if (!Number.isFinite(heroIndex)) return;
    const idx = heroIndex | 0;
    if (idx < 0) return;
    __heroNativeByIndex[idx] = nativeAny;
}

function _getHeroNativeByIndex(heroIndex: number): any {
    const idx = heroIndex | 0;
    if (idx < 0) return null;
    return __heroNativeByIndex[idx] || null;
}

function _clearHeroNativeByIndex(heroIndex: number, nativeAny: any): void {
    const idx = heroIndex | 0;
    if (idx < 0) return;
    if (__heroNativeByIndex[idx] === nativeAny) delete __heroNativeByIndex[idx];
}

// Phaser-only native data keys
const NATIVE_FORCE_INVISIBLE_KEY = "__forceInvisible";

// Orbiting crystal ring around the hero while controlling an intellect spell.
const INT_CAST_CRYSTAL_COUNT = 4;
const INT_CAST_ORBIT_RADIUS_PX = 18;
const INT_CAST_ORBIT_Y_OFFSET_PX = -18;
const INT_CAST_ROT_SPEED_RAD_PER_MS = 0.0042; // ~ one rotation / 1.5s
const INT_CAST_BOB_AMP_PX = 2.5;
const INT_CAST_JITTER_AMP_PX = 1.25;

// Per projectile: a single crystal that follows the spell (replaces blue circle)
const INT_PROJ_WOBBLE_AMP_PX = 1.0;
const INT_PROJ_WOBBLE_SPEED_RAD_PER_MS = 0.008;



// Intellect projectile: best-effort detection of "detonated / land / linger" state.
// We avoid assuming a single key name by checking a tiny set and falling back to image dims.
const INT_PROJ_DET_KEYS = ["intDetonated", "detonated"] as const;
const INT_PROJ_TERMHIT_KEYS = ["termHit"] as const;

function _intProj_readDataNumberMaybe(s: any, key: string): number {
    // Prefer MakeCode sprites.readDataNumber if available (works even if keys aren't enumerable)
    try {
        const spritesNS: any = (globalThis as any).sprites;
        if (spritesNS && typeof spritesNS.readDataNumber === "function") {
            return (spritesNS.readDataNumber(s, key) | 0);
        }
    } catch { }

    // Fall back to direct access
    try {
        const d: any = (s as any)?.data;
        const v = d ? d[key] : undefined;
        if (typeof v === "number") return (v | 0);
        if (typeof v === "string") return ((v as any) | 0);
    } catch { }

    return 0;
}

function _intProj_isDetonatingOrLanding(sc: any, s: any): boolean {
    // 1) explicit "detonated" keys (preferred)
    for (const k of INT_PROJ_DET_KEYS) {
        const v = _intProj_readDataNumberMaybe(s, k);
        if (v) return true;
    }

    // 2) termHit > 0 is also a reliable “we hit something / terminated” signal
    for (const k of INT_PROJ_TERMHIT_KEYS) {
        const v = _intProj_readDataNumberMaybe(s, k);
        if (v) return true;
    }

    // 3) fallback: detonation image is often a different size (your log shows img=34x34)
    try {
        const img: any = (s as any)?.image;
        const w = (img?.width | 0);
        const h = (img?.height | 0);
        if (w >= 34 && h >= 34) return true;
    } catch { }

    return false;
}


function _destroyIntellectFxForNative(nativeAny: any): void {
    if (!nativeAny) return;

    try {
        const arr: any[] = (nativeAny as any).__intCastCrystals;
        if (arr && Array.isArray(arr)) {
            for (const spr of arr) {
                try { spr?.destroy?.(); } catch { }
            }
        }
    } catch { }

    try {
        const spr: any = (nativeAny as any).__intProjCrystal;
        if (spr) {
            try { spr.destroy?.(); } catch { }
        }
    } catch { }

    try {
        const halo: any = (nativeAny as any).__intProjCrystalHalo;
        if (halo) {
            try { halo.destroy?.(); } catch { }
        }
    } catch { }

    try { (nativeAny as any).__intCastCrystals = undefined; } catch { }
    try { (nativeAny as any).__intProjCrystal = undefined; } catch { }
    try { (nativeAny as any).__intProjCrystalHalo = undefined; } catch { }

    try { (nativeAny as any).__intCastSeq = undefined; } catch { }
    try { (nativeAny as any).__intProjLastHeroIndex = undefined; } catch { }
    try { (nativeAny as any).__intProjLastWeaponId = undefined; } catch { }

    try { (nativeAny as any).__intProjDestroyBound = undefined; } catch { }

    try { (nativeAny as any).__intProjAppliedTexKey = undefined; } catch { }
    try { (nativeAny as any).__intProjAppliedFrame = undefined; } catch { }
    try { (nativeAny as any).__intProjPivotApplied = undefined; } catch { }
    try { (nativeAny as any).__intProjPivotKey = undefined; } catch { }
}

function _ensureHeroIntellectCrystals(sc: Phaser.Scene, nativeHero: any): Phaser.GameObjects.Sprite[] {
    const anyHero: any = nativeHero as any;
    let arr: Phaser.GameObjects.Sprite[] | undefined = anyHero.__intCastCrystals;
    if (arr && Array.isArray(arr) && arr.length === INT_CAST_CRYSTAL_COUNT) return arr;

    // Recreate cleanly
    try {
        if (arr && Array.isArray(arr)) {
            for (const spr of arr) { try { (spr as any)?.destroy?.(); } catch { } }
        }
    } catch { }

    arr = [];
    for (let i = 0; i < INT_CAST_CRYSTAL_COUNT; i++) {
        const spr = sc.add.sprite(nativeHero.x, nativeHero.y, "__MISSING", 0);
        spr.setVisible(false);
        spr.setAlpha(0.95);
        arr.push(spr);
    }

    anyHero.__intCastCrystals = arr;
    return arr;
}

function _syncHeroIntellectCastCrystals(ctx: SyncContext, s: any, nativeHero: Phaser.GameObjects.Sprite): void {
    const sc = ctx.sc as any;
    if (!sc) return;

    const dataAny: any = (s as any).data || {};
    const phaseRaw = (typeof dataAny.phase === "string" && dataAny.phase) ? dataAny.phase : "idle";
    const isCtrlSpell = !!(dataAny[HERO_IS_CTRL_SPELL_KEY]);

    // We show the ring only while the hero is actively controlling a spell AND in cast phase.
    if (!(isCtrlSpell && phaseRaw === "cast")) {
        const anyHero: any = nativeHero as any;
        const arr: any[] = anyHero.__intCastCrystals;
        if (arr && Array.isArray(arr)) {
            for (const spr of arr) { try { spr.setVisible(false); } catch { } }
        }
        return;
    }

    const heroIndex = (dataAny[HERO_INDEX_DATA_KEY] as any | 0);
    const weaponId = _heroCastWeaponByIndex[heroIndex] || (typeof dataAny[HERO_WPN_CAST_KEY] === "string" ? String(dataAny[HERO_WPN_CAST_KEY]) : "");
    if (!weaponId) return;
    const weaponVariant = _weaponVariantForHero(heroIndex, weaponId);

    const dirRaw = (typeof dataAny.dir === "string" && dataAny.dir) ? dataAny.dir : "down";
    const dir = (dirRaw === "up" || dirRaw === "down" || dirRaw === "left" || dirRaw === "right") ? dirRaw : "down";

    const arr = _ensureHeroIntellectCrystals(sc, nativeHero as any);

    const now = (sc.time?.now ?? 0) as number;
    const heroDepth = (nativeHero as any).depth ?? 0;

    for (let i = 0; i < arr.length; i++) {
        const spr = arr[i];

        // Reuse weapon atlas resolver: treat each crystal as the hero's "cast" weapon.
        const glueAny: any = (globalThis as any).weaponAnimGlue || weaponAnimGlue;
        glueAny.syncWeaponToHero({
            scene: sc,
            heroSprite: nativeHero,
            weaponSprite: spr,
            weaponId,
            heroPhase: "cast",
            dir: dir as any,
            heroFrameIndex: 0,
            variant: weaponVariant,
            frameColOverride: 0
        });

        // Orbit + bob + jitter around the hero
        const baseAngle = (now * INT_CAST_ROT_SPEED_RAD_PER_MS) + (i * (Math.PI * 2 / arr.length));
        const bob = INT_CAST_BOB_AMP_PX * Math.sin(now * 0.006 + i * 1.7);
        const jx = INT_CAST_JITTER_AMP_PX * Math.sin(now * 0.021 + i * 2.1 + heroIndex * 0.17);
        const jy = INT_CAST_JITTER_AMP_PX * Math.cos(now * 0.019 + i * 1.9 + heroIndex * 0.11);

        spr.x = nativeHero.x + Math.cos(baseAngle) * INT_CAST_ORBIT_RADIUS_PX + jx;
        spr.y = nativeHero.y + INT_CAST_ORBIT_Y_OFFSET_PX + Math.sin(baseAngle) * (INT_CAST_ORBIT_RADIUS_PX * 0.62) + bob + jy;

        // Slight independent scale so it reads as a spell object, not the held weapon.
        spr.scaleX = (nativeHero as any).scaleX * 0.75;
        spr.scaleY = (nativeHero as any).scaleY * 0.75;
        (spr as any).rotation = baseAngle;

        spr.setDepth(heroDepth + 3);
        spr.setVisible(true);
    }
}



const INT_PROJ_GLOW_TINT = 0x66ccff;          // icy blue
const INT_PROJ_GLOW_ALPHA = 0.85;
const INT_PROJ_GLOW_PULSE_SCALE = 0.18;       // how much it pulses
const INT_PROJ_GLOW_HALO_R = 25;              // big halo radius (for 192px crystal)
const INT_PROJ_GLOW_HALO_THICK = 10;
const INT_PROJ_CRYSTAL_SCALE = 2.5;
const INT_PROJ_CLOUD_TINT = 0xff6a3d;
const INT_PROJ_CLOUD_BASE_R = 10;
const INT_PROJ_CLOUD_PULSE_SCALE = 0.35;
const INT_PROJ_CLOUD_PULSE_SPEED = 0.022;
const INT_PROJ_CLOUD_FLASH_BASE = 0.35;
const INT_PROJ_CLOUD_FLASH_AMP = 0.55;
const INT_PROJ_CLOUD_FLASH_SPEED = 0.035;
const INT_PROJ_CLOUD_Y_OFFSET = 0;

function _intProj_applyObviousGlow(sc: any, anyNative: any, spr: Phaser.GameObjects.Sprite, nowMs: number): void {
    // Base sprite: additive + tint + big scale pulse
    try { (spr as any).setBlendMode?.((Phaser as any).BlendModes.ADD); } catch { }
    try { (spr as any).setTint?.(INT_PROJ_GLOW_TINT); } catch { }
    try { (spr as any).setAlpha?.(0.98); } catch { }

    // Pulse scale
    const pulse = 1 + INT_PROJ_GLOW_PULSE_SCALE * Math.sin(nowMs * 0.010);
    try { (spr as any).setScale?.(pulse); } catch { }


    // Optional: Phaser PostFX glow if supported (only once)
    if (!anyNative.__intProjTriedPostFx) {
        anyNative.__intProjTriedPostFx = true;
        try {
            const pfx = (spr as any).postFX;
            if (pfx && typeof pfx.addGlow === "function") {
                // color, outerStrength, innerStrength, knockout
                pfx.addGlow(INT_PROJ_GLOW_TINT, 6, 2, false);
                anyNative.__intProjHasPostFxGlow = true;
            }
        } catch { }
    }
}

function _intProj_drawCrystalCloud(g: Phaser.GameObjects.Graphics): void {
    g.clear();
    g.fillStyle(INT_PROJ_CLOUD_TINT, 0.45);
    g.fillCircle(0, 0, INT_PROJ_CLOUD_BASE_R);
    g.fillStyle(INT_PROJ_CLOUD_TINT, 0.25);
    g.fillCircle(0, 0, INT_PROJ_CLOUD_BASE_R * 1.45);
    g.fillStyle(INT_PROJ_CLOUD_TINT, 0.18);
    g.fillCircle(0, 0, INT_PROJ_CLOUD_BASE_R * 1.9);
}

function _intProj_ensureCrystalCloud(sc: any, anyNative: any): Phaser.GameObjects.Graphics {
    let g: Phaser.GameObjects.Graphics | undefined = anyNative.__intProjCrystalHalo;
    if (!g) {
        g = sc.add.graphics();
        _intProj_drawCrystalCloud(g);
        try { (g as any).setBlendMode?.((Phaser as any).BlendModes.ADD); } catch { }
        try { (g as any).setVisible?.(true); } catch { }
        anyNative.__intProjCrystalHalo = g;
    }
    return g!;
}

function _intProj_updateCrystalCloud(sc: any, anyNative: any, native: any, shouldBeVisible: boolean): void {
    const g = _intProj_ensureCrystalCloud(sc, anyNative);
    const now = (sc.time?.now ?? 0) as number;
    const pulse = 1 + INT_PROJ_CLOUD_PULSE_SCALE * Math.sin(now * INT_PROJ_CLOUD_PULSE_SPEED);
    const flash = INT_PROJ_CLOUD_FLASH_BASE + INT_PROJ_CLOUD_FLASH_AMP * Math.abs(Math.sin(now * INT_PROJ_CLOUD_FLASH_SPEED));

    g.x = native.x;
    g.y = native.y + INT_PROJ_CLOUD_Y_OFFSET;
    try { (g as any).setScale?.(pulse); } catch { }
    try { (g as any).setAlpha?.(flash); } catch { }
    try { (g as any).setDepth?.(999998); } catch { }
    try { (g as any).setVisible?.(shouldBeVisible); } catch { }
}

const __intProjCrystalFirstNonEmptyFrameByTex: Record<string, number> = Object.create(null);



function _intProj_findFirstNonEmptyFrame(sc: any, texKey: string, maxFramesToScan: number): number {
    const cached = __intProjCrystalFirstNonEmptyFrameByTex[texKey];
    if (cached !== undefined) return cached;

    const tex = sc.textures?.get?.(texKey);
    const total = (tex?.frameTotal ?? 0) | 0;
    const N = Math.max(0, Math.min(total, maxFramesToScan | 0));

    // Scan from 0 upward; pick first with any non-transparent pixels.
    for (let fi = 0; fi < N; fi++) {
        const nz = _dbgCountNonTransparentPixelsInFrame(sc, texKey, fi);
        if (nz > 0) {
            __intProjCrystalFirstNonEmptyFrameByTex[texKey] = fi;
            console.log("[INTPROJ][FRAMEPICK]", "| tex", texKey, "| picked", fi, "| nonZeroA", nz, "| scanned", N);
            return fi;
        }
    }

    // If none found, cache -1 so we don't keep scanning.
    __intProjCrystalFirstNonEmptyFrameByTex[texKey] = -1;
    console.log("[INTPROJ][FRAMEPICK]", "| tex", texKey, "| picked NONE", "| scanned", N);
    return -1;
}



// Cache: per (texKey|frame) → origin point within that frame (pixel coords)
const _intProjOriginCache: { [k: string]: { ox: number; oy: number } } = {};

/**
 * Compute alpha-centroid inside a texture frame and return a pivot point (ox, oy)
 * in *frame-local pixel coordinates* (0..frameW-1, 0..frameH-1).
 *
 * If no alpha pixels exist, returns the frame center.
 *
 * NOTE: Called rarely (cached). Safe to do a full imageData scan once per frame.
 */
function _intProj_getAlphaCentroidOrigin(
    sc: Phaser.Scene,
    texKey: string,
    frameNameOrIndex: any
): { ox: number; oy: number } {
    const cacheKey = texKey + "|" + String(frameNameOrIndex);
    const hit = _intProjOriginCache[cacheKey];
    if (hit) return hit;

    try {
        const tm: any = sc.textures;
        if (!tm || !tm.exists?.(texKey)) {
            const fallback = { ox: 96, oy: 96 };
            _intProjOriginCache[cacheKey] = fallback;
            return fallback;
        }

        const tex: any = tm.get(texKey);
        const fr: any = tex?.get?.(frameNameOrIndex);
        if (!fr) {
            const fallback = { ox: 96, oy: 96 };
            _intProjOriginCache[cacheKey] = fallback;
            return fallback;
        }

        // Frame rect inside the source image
        const fx = (fr.cutX ?? fr.x ?? 0) | 0;
        const fy = (fr.cutY ?? fr.y ?? 0) | 0;
        const fw = (fr.cutWidth ?? fr.width ?? 0) | 0;
        const fh = (fr.cutHeight ?? fr.height ?? 0) | 0;

        if (fw <= 0 || fh <= 0) {
            const fallback = { ox: 96, oy: 96 };
            _intProjOriginCache[cacheKey] = fallback;
            return fallback;
        }

        // Source image backing this texture
        const srcImg: any = tex?.source?.[0]?.image;
        if (!srcImg) {
            const fallback = { ox: (fw >> 1), oy: (fh >> 1) };
            _intProjOriginCache[cacheKey] = fallback;
            return fallback;
        }

        // Draw this frame into a tiny offscreen canvas, then scan alpha
        const canvas = document.createElement("canvas");
        canvas.width = fw;
        canvas.height = fh;
        const g = canvas.getContext("2d", { willReadFrequently: true } as any);
        if (!g) {
            const fallback = { ox: (fw >> 1), oy: (fh >> 1) };
            _intProjOriginCache[cacheKey] = fallback;
            return fallback;
        }

        g.clearRect(0, 0, fw, fh);
        g.drawImage(srcImg, fx, fy, fw, fh, 0, 0, fw, fh);

        const imgData = g.getImageData(0, 0, fw, fh);
        const d = imgData.data;

        let count = 0;
        let sumX = 0;
        let sumY = 0;

        // Alpha centroid (unweighted beyond alpha>0, which is what you want here)
        for (let y = 0; y < fh; y++) {
            const row = y * fw;
            for (let x = 0; x < fw; x++) {
                const a = d[((row + x) << 2) + 3];
                if (a) {
                    count++;
                    sumX += x;
                    sumY += y;
                }
            }
        }

        let ox: number;
        let oy: number;

        if (count > 0) {
            ox = (sumX / count);
            oy = (sumY / count);
        } else {
            ox = fw * 0.5;
            oy = fh * 0.5;
        }

        const out = { ox, oy };
        _intProjOriginCache[cacheKey] = out;
        return out;
    } catch {
        const fallback = { ox: 96, oy: 96 };
        _intProjOriginCache[cacheKey] = fallback;
        return fallback;
    }
}


function _intProj_setForceInvisible(anyNative: any, v: number): void {
    try { anyNative?.setData?.(NATIVE_FORCE_INVISIBLE_KEY, v | 0); } catch { }
}

function _intProj_restoreNativeVisibleAlpha(anyNative: any, show: boolean): void {
    if (!anyNative) return;
    try { anyNative.setVisible?.(!!show); } catch { }
    try { anyNative.setAlpha?.(show ? 1 : 0); } catch { }
    try { anyNative.visible = !!show; } catch { }
    try { anyNative.alpha = show ? 1 : 0; } catch { }
}

function _intProj_hardShowNativeFully(anyNative: any): void {
    if (!anyNative) return;
    try { anyNative.setVisible?.(true); } catch { }
    try { anyNative.setAlpha?.(1); } catch { }
    try { anyNative.visible = true; } catch { }
    try { anyNative.alpha = 1; } catch { }
}

function _intProj_hardHideNativeFully(anyNative: any): void {
    if (!anyNative) return;
    try { anyNative.setVisible?.(false); } catch { }
    try { anyNative.setAlpha?.(0); } catch { }
    try { anyNative.visible = false; } catch { }
    try { anyNative.alpha = 0; } catch { }
}

function _intProj_destroyCrystalOverlays(anyNative: any): void {
    if (!anyNative) return;

    if (anyNative.__intProjCrystal) {
        try { anyNative.__intProjCrystal.destroy?.(); } catch { }
        try { anyNative.__intProjCrystal = undefined; } catch { }
    }
    if (anyNative.__intProjCrystalHalo) {
        try { anyNative.__intProjCrystalHalo.destroy?.(); } catch { }
        try { anyNative.__intProjCrystalHalo = undefined; } catch { }
    }
}

function _intProj_cleanupNonIntellect(anyNative: any): void {
    if (!anyNative) return;

    // If we ever forced invisibility, undo it.
    try {
        if (anyNative.getData && anyNative.getData(NATIVE_FORCE_INVISIBLE_KEY)) {
            _intProj_setForceInvisible(anyNative, 0);
        }
    } catch { }

    // STEP 3 (restore): if we ever hard-hid this native, undo it.
    _intProj_hardShowNativeFully(anyNative);

    _intProj_destroyCrystalOverlays(anyNative);
}

function _intProj_applyDetonationOrLandingState(anyNative: any, shouldBeVisible: boolean): void {
    if (!anyNative) return;

    _intProj_setForceInvisible(anyNative, 0);

    // STEP 3 (restore): tendrils follow sprite Invisible flag
    _intProj_restoreNativeVisibleAlpha(anyNative, shouldBeVisible);

    // Ensure overlay is gone so it doesn't stick / hide tendrils by proxy.
    _intProj_destroyCrystalOverlays(anyNative);
}

function _intProj_applyFlyingState(anyNative: any): void {
    if (!anyNative) return;

    // Hide Arcade pixels and show Phaser overlay.
    _intProj_setForceInvisible(anyNative, 1);

    // STEP 3 (force-hide): stop placeholder circle even if later sync re-enables visibility.
    _intProj_hardHideNativeFully(anyNative);
}

function _intProj_ensureCrystalOverlaySprite(
    sc: any,
    native: any,
    anyNative: any,
    heroIndex: number,
    weaponId: string
): { spr: Phaser.GameObjects.Sprite; createdNow: boolean } {
    let spr: Phaser.GameObjects.Sprite | undefined = anyNative.__intProjCrystal;
    const createdNow = !spr;

    if (!spr) {
        spr = sc.add.sprite(native.x, native.y, "__MISSING", 0);
        spr.setAlpha(0.95);
        spr.setVisible(true);
        anyNative.__intProjCrystal = spr;

        anyNative.__intProjLastHeroIndex = heroIndex;
        anyNative.__intProjLastWeaponId = weaponId;

        anyNative.__intProjLoggedCreate = false;
        anyNative.__intProjLoggedNoSheet = false;
        anyNative.__intProjLoggedFirstOk = false;
        anyNative.__intProjLastLogKey = "";
        anyNative.__intProjDumpedOnce = false;
        anyNative.__intProjPickedLogged = false;

        anyNative.__intProjPivotApplied = false;
        anyNative.__intProjPivotKey = "";

        anyNative.__intProjAppliedTexKey = "";
        anyNative.__intProjAppliedFrame = -9999;
    }

    return { spr: spr!, createdNow };
}

function _intProj_bindDestroyCleanupOnce(anyNative: any): void {
    if (!anyNative) return;

    if (!anyNative.__intProjDestroyBound) {
        anyNative.__intProjDestroyBound = true;
        try {
            (anyNative as any).once?.("destroy", () => {
                _destroyIntellectFxForNative(anyNative);
            });
        } catch { }
    }
}

function _intProj_logCreateOnce(anyNative: any, s: any, heroIndex: number, native: any, spr: Phaser.GameObjects.Sprite): void {
    if (!anyNative) return;

    if (!anyNative.__intProjLoggedCreate) {
        anyNative.__intProjLoggedCreate = true;
        console.log("[INTPROJ][CREATE]",
            "| s.id", s?.id,
            "| heroIndex", heroIndex,
            "| nativeXY", (native?.x ?? 0), (native?.y ?? 0),
            "| startTex", (spr as any).texture?.key,
            "| startFrame", (spr as any).frame?.name,
            "| alpha", (spr as any).alpha
        );
    }
}

function _intProj_applyTexturePickFrameOrHide(args: {
    sc: any;
    anyNative: any;
    s: any;
    heroIndex: number;
    spr: Phaser.GameObjects.Sprite;
    texKey: string;
}): number {
    const { sc, anyNative, s, heroIndex, spr, texKey } = args;

    const picked = _intProj_findFirstNonEmptyFrame(sc, texKey, 128);
    if (picked >= 0) {
        // Only apply texture/frame if it actually changed.
        if (anyNative.__intProjAppliedTexKey !== texKey || anyNative.__intProjAppliedFrame !== picked) {
            anyNative.__intProjAppliedTexKey = texKey;
            anyNative.__intProjAppliedFrame = picked;

            spr.setTexture(texKey);
            spr.setFrame(picked);
        }

        spr.setVisible(true);

        if (!anyNative.__intProjPickedLogged) {
            anyNative.__intProjPickedLogged = true;
            const ft = ((spr as any).texture as any)?.frameTotal ?? -1;
            console.log("[INTPROJ][PICK]",
                "| s.id", s?.id,
                "| heroIndex", heroIndex,
                "| tex", texKey,
                "| picked", picked,
                "| frameTotal", ft
            );
        }

        return picked;
    }

    spr.setVisible(false);

    if (!anyNative.__intProjLoggedNoSheet) {
        anyNative.__intProjLoggedNoSheet = true;
        const texExists = !!(sc.textures?.exists?.(texKey));
        const frameTotal = sc.textures?.get?.(texKey)?.frameTotal ?? -1;
        console.log("[INTPROJ][FAIL] no non-empty frames found",
            "| s.id", s?.id,
            "| heroIndex", heroIndex,
            "| texKey", texKey,
            "| texExists", texExists,
            "| frameTotal", frameTotal
        );
    }

    return -1;
}

function _intProj_applyPivotIfNeeded(sc: any, anyNative: any, s: any, heroIndex: number, spr: Phaser.GameObjects.Sprite, texKey: string, picked: number): void {
    const pivotKey = texKey + "|" + String(picked);
    if (!anyNative.__intProjPivotApplied || anyNative.__intProjPivotKey !== pivotKey) {
        anyNative.__intProjPivotApplied = true;
        anyNative.__intProjPivotKey = pivotKey;

        const piv = _intProj_getAlphaCentroidOrigin(sc, texKey, picked);

        try { (spr as any).setOrigin?.(0.5, 0.5); } catch { }
        try { (spr as any).setDisplayOrigin?.(piv.ox, piv.oy); } catch { }

        console.log("[INTPROJ][PIVOT]",
            "| s.id", s?.id,
            "| heroIndex", heroIndex,
            "| tex", texKey,
            "| frame", picked,
            "| ox", Math.round(piv.ox * 100) / 100,
            "| oy", Math.round(piv.oy * 100) / 100
        );
    }
}

function _intProj_dumpOnce(sc: any, anyNative: any, spr: Phaser.GameObjects.Sprite): void {
    if (!anyNative.__intProjDumpedOnce) {
        console.log("Sending as a PNG");
        anyNative.__intProjDumpedOnce = true;
        _dbgDumpSpriteFramePNG(sc, spr, "INTPROJ_CRYSTAL");
    }
}

function _intProj_followProjectileOverlay(sc: any, anyNative: any, native: any, spr: Phaser.GameObjects.Sprite, shouldBeVisible: boolean): void {
    const now = (sc.time?.now ?? 0) as number;

    (spr as any).rotation = now * 0.006;

    spr.setDepth(999999);
    try { (spr as any).setScale?.(INT_PROJ_CRYSTAL_SCALE); } catch { }

    spr.x = native.x;
    spr.y = native.y;

    // If you want the "pixel auto-hide" to matter, use:
    // spr.setVisible(shouldBeVisible && !autoHideByPixels);
    spr.setVisible(shouldBeVisible);

    _intProj_updateCrystalCloud(sc, anyNative, native, shouldBeVisible);
}

function _intProj_postOkLogIfNeeded(args: {
    anyNative: any;
    s: any;
    heroIndex: number;
    spr: Phaser.GameObjects.Sprite;
    createdNow: boolean;
    hasInvisibleFlag: boolean;
    autoHideByPixels: boolean;
}): void {
    const { anyNative, s, heroIndex, spr, createdNow, hasInvisibleFlag, autoHideByPixels } = args;

    const texKey2 = (spr as any).texture?.key ?? "";
    const frameName2 = (spr as any).frame?.name ?? "";
    const frameTotal2 = ((spr as any).texture as any)?.frameTotal ?? -1;
    const depth2 = (spr as any).depth ?? 0;
    const vis2 = !!spr.visible;

    const logKey =
        texKey2 + "|" + frameName2 + "|" + frameTotal2 + "|" +
        (vis2 ? "V" : "H") + "|" + depth2 + "|" +
        (hasInvisibleFlag ? "IF" : "if") + "|" +
        (autoHideByPixels ? "PX0" : "px");

    if (!anyNative.__intProjLoggedFirstOk || anyNative.__intProjLastLogKey !== logKey || createdNow) {
        anyNative.__intProjLoggedFirstOk = true;
        anyNative.__intProjLastLogKey = logKey;

        console.log("[INTPROJ][OK]",
            "| s.id", s?.id,
            "| heroIndex", heroIndex,
            "| createdNow", createdNow,
            "| tex", texKey2,
            "| frame", frameName2,
            "| frames", frameTotal2,
            "| xy", (spr.x | 0), (spr.y | 0),
            "| depth", depth2,
            "| visible", vis2,
            "| hasInvisibleFlag", hasInvisibleFlag,
            "| autoHideByPixels(lastNonZero==0)", autoHideByPixels
        );
    }
}



function _syncIntellectSpellProjectileCrystal(ctx: SyncContext, s: any, native: any, flags: number): void {
    const sc = ctx.sc as any;
    if (!sc) return;

    const dataAny: any = (s as any).data || {};
    if (dataAny[PROJ_FAMILY_KEY] === undefined) return;

    const family = (dataAny[PROJ_FAMILY_KEY] as any | 0);
    const isIntellectSpell = (family === FAMILY_INTELLECT);
    const anyNative: any = native as any;

    // --------------------------------------------------
    // Cleanup path (non-intellect projectiles)
    // --------------------------------------------------
    if (!isIntellectSpell) {
        _intProj_cleanupNonIntellect(anyNative);
        return;
    }

    // --------------------------------------------------
    // State detection: if detonating/landing, show Arcade pixels (tendrils),
    // and hide/destroy the crystal overlay.
    // --------------------------------------------------
    const isDetonatingOrLanding = _intProj_isDetonatingOrLanding(sc, s);

    // Visibility intent
    const lastNonZero = (s as any)._lastNonZeroPixels ?? -1;
    const hasInvisibleFlag = !!(flags & SpriteFlag.Invisible);
    const shouldBeVisible = !hasInvisibleFlag;
    const autoHideByPixels = (lastNonZero === 0);

    // If we're in detonation/land/linger: let the Arcade native render again.
    if (isDetonatingOrLanding) {
        _intProj_applyDetonationOrLandingState(anyNative, shouldBeVisible);
        return;
    }

    // Otherwise (drive/flying): hide Arcade pixels and show the Phaser crystal overlay.
    _intProj_applyFlyingState(anyNative);

    const heroIndex = (dataAny[PROJ_HERO_INDEX_KEY] as any | 0);
    const weaponId = "crystal";

    // --------------------------------------------------
    // Create / reuse overlay sprite
    // --------------------------------------------------
    const ensured = _intProj_ensureCrystalOverlaySprite(sc, native, anyNative, heroIndex, weaponId);
    const spr = ensured.spr;
    const createdNow = ensured.createdNow;

    // Bind cleanup to the Arcade native destroy so the overlay can never leak.
    _intProj_bindDestroyCleanupOnce(anyNative);

    // One-time create log
    _intProj_logCreateOnce(anyNative, s, heroIndex, native, spr);

    // --------------------------------------------------
    // Resolve texture + pick a non-empty frame (cached)
    // --------------------------------------------------
    const texKey = "t192__magic__crystal__thrust__fg__vbase";

    const picked = _intProj_applyTexturePickFrameOrHide({
        sc,
        anyNative,
        s,
        heroIndex,
        spr,
        texKey
    });

    if (picked < 0) {
        try { anyNative.__intProjCrystalHalo?.setVisible?.(false); } catch { }
        return;
    }

    // --------------------------------------------------
    // Apply pivot so rotation centers on the crystal pixels (NOT frame center)
    // --------------------------------------------------
    _intProj_applyPivotIfNeeded(sc, anyNative, s, heroIndex, spr, texKey, picked);

    // One-time PNG dump (now it should be non-empty)
    _intProj_dumpOnce(sc, anyNative, spr);

    // --------------------------------------------------
    // FOLLOW ENGINE PROJECTILE (authoritative)
    // --------------------------------------------------
    _intProj_followProjectileOverlay(sc, anyNative, native, spr, shouldBeVisible);

    // --------------------------------------------------
    // Post-state log (once on first success, then only on meaningful change)
    // --------------------------------------------------
    _intProj_postOkLogIfNeeded({
        anyNative,
        s,
        heroIndex,
        spr,
        createdNow,
        hasInvisibleFlag,
        autoHideByPixels
    });
}





// 🌕 ────── ✨ ────── 🌕  SECTION  🌕 ────── ✨ ────── 🌕 ────── ✨ ────── 🌕 ────── ✨ ────── 🌕  SECTION  🌕 ────── ✨ ────── 🌕

// 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃

//Debug functions debug section section debug

// Debug the "Extra" category (flag in src/debugFlags.ts)
let _heroAnimNoAtlasLogged = false;



function _dbgDumpSpriteFramePNG(sc: any, spr: Phaser.GameObjects.Sprite, label: string): void {
    try {
        const texKey = spr.texture?.key ?? "";
        const frame = (spr as any).frame;
        if (!texKey || !frame) {
            console.log("[DBGFRAME] missing tex/frame", "| label", label, "| texKey", texKey);
            return;
        }

        const tex = sc.textures?.get?.(texKey);
        if (!tex) {
            console.log("[DBGFRAME] texture not found in manager", "| label", label, "| texKey", texKey);
            return;
        }

        // Underlying source image (HTMLImageElement or HTMLCanvasElement)
        const src: any = tex.getSourceImage?.() ?? tex.source?.[0]?.image;
        if (!src) {
            console.log("[DBGFRAME] no source image", "| label", label, "| texKey", texKey);
            return;
        }

        // Frame rectangle inside the source image
        const cutX = (frame.cutX ?? frame.x ?? 0) | 0;
        const cutY = (frame.cutY ?? frame.y ?? 0) | 0;
        const cutW = (frame.cutWidth ?? frame.width ?? 0) | 0;
        const cutH = (frame.cutHeight ?? frame.height ?? 0) | 0;

        if (cutW <= 0 || cutH <= 0) {
            console.log("[DBGFRAME] invalid frame dims", "| label", label, "| texKey", texKey, "| w,h", cutW, cutH);
            return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = cutW;
        canvas.height = cutH;

        const g = canvas.getContext("2d");
        if (!g) return;

        // Draw frame crop
        g.clearRect(0, 0, cutW, cutH);
        g.drawImage(src, cutX, cutY, cutW, cutH, 0, 0, cutW, cutH);

        // Analyze pixels: count non-transparent pixels
        const img = g.getImageData(0, 0, cutW, cutH).data;
        let nonZeroA = 0;
        for (let i = 3; i < img.length; i += 4) {
            if (img[i] !== 0) nonZeroA++;
        }

        // Convert to PNG data URL
        const url = canvas.toDataURL("image/png");

        console.log("[DBGFRAME]",
            "| label", label,
            "| texKey", texKey,
            "| frame", frame.name ?? frame.index ?? "",
            "| rect", cutX, cutY, cutW, cutH,
            "| nonZeroAlphaPx", nonZeroA,
            "| dataUrlPrefix", url.slice(0, 80) + "..."
        );

        // Optional: auto-download (uncomment when you want it)
        // const a = document.createElement("a");
        // a.href = url;
        // a.download = `${label}__${texKey}__frame${frame.name ?? frame.index ?? 0}.png`;
        // document.body.appendChild(a);
        // a.click();
        // a.remove();

        // Optional: open in new tab (uncomment when you want it)
        // window.open(url, "_blank");

    } catch (e) {
        console.log("[DBGFRAME] exception", label, e);
    }
}


function _dbgCountNonTransparentPixelsInFrame(sc: any, texKey: string, frameIndex: number): number {
    const tex = sc.textures?.get?.(texKey);
    if (!tex) return -1;

    const frame: any = tex.get?.(frameIndex);
    if (!frame) return -1;

    const src: any = tex.getSourceImage?.() ?? tex.source?.[0]?.image;
    if (!src) return -1;

    const cutX = (frame.cutX ?? frame.x ?? 0) | 0;
    const cutY = (frame.cutY ?? frame.y ?? 0) | 0;
    const cutW = (frame.cutWidth ?? frame.width ?? 0) | 0;
    const cutH = (frame.cutHeight ?? frame.height ?? 0) | 0;
    if (cutW <= 0 || cutH <= 0) return -1;

    const canvas = document.createElement("canvas");
    canvas.width = cutW;
    canvas.height = cutH;
    const g = canvas.getContext("2d");
    if (!g) return -1;

    g.clearRect(0, 0, cutW, cutH);
    g.drawImage(src, cutX, cutY, cutW, cutH, 0, 0, cutW, cutH);

    const data = g.getImageData(0, 0, cutW, cutH).data;
    let nonZeroA = 0;
    for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 0) nonZeroA++;
    }
    return nonZeroA;
}

// --------------------------------------------------
// DEBUG: Position write trap for a Phaser sprite.
// Logs a stack trace whenever anything writes x/y, setPosition, or setX/setY.
// --------------------------------------------------
function _dbgInstallPosWriteTrap(label: string, spr: any): void {
    if (!spr || spr.__dbgPosTrapInstalled) return;
    spr.__dbgPosTrapInstalled = true;

    // Tag we can set while *we* are writing positions (to avoid self-noise)
    spr.__dbgPosTrapTag = "";

    // Wrap setPosition / setX / setY (these are common)
    const wrapFn = (obj: any, fnName: string) => {
        const orig = obj?.[fnName];
        if (typeof orig !== "function") return;
        obj[fnName] = function (...args: any[]) {
            if (!this.__dbgPosTrapTag) {
                const e = new Error();
                console.log(`[POSWRITE][${label}] ${fnName}`, "| args", args, "\n", (e.stack || ""));
            }
            return orig.apply(this, args);
        };
    };

    wrapFn(spr, "setPosition");
    wrapFn(spr, "setX");
    wrapFn(spr, "setY");

    // Trap direct x/y assignments too
    try {
        const proto = Object.getPrototypeOf(spr);
        // Preserve current values
        let _x = spr.x;
        let _y = spr.y;

        Object.defineProperty(spr, "x", {
            configurable: true,
            enumerable: true,
            get() { return _x; },
            set(v: any) {
                if (!spr.__dbgPosTrapTag) {
                    const e = new Error();
                    console.log(`[POSWRITE][${label}] x=`, v, "\n", (e.stack || ""));
                }
                _x = v;
            }
        });

        Object.defineProperty(spr, "y", {
            configurable: true,
            enumerable: true,
            get() { return _y; },
            set(v: any) {
                if (!spr.__dbgPosTrapTag) {
                    const e = new Error();
                    console.log(`[POSWRITE][${label}] y=`, v, "\n", (e.stack || ""));
                }
                _y = v;
            }
        });

        // Re-apply current values through the new setters
        spr.__dbgPosTrapTag = "init";
        spr.x = _x;
        spr.y = _y;
        spr.__dbgPosTrapTag = "";
    } catch (e) {
        console.log(`[POSWRITE][${label}] trap install FAILED`, e);
    }
}





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


// Optional debug (leave false)
// DEBUG_WEAPON_SYNC flag is defined in src/debugFlags.ts


// 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃

// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️

//Performance section section performance

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

            // 3) Weapon tip: prefer cached offsets if available
            let wTipX = 0;
            let wTipY = 0;
            try {
                wTipX = sprites.readDataNumber(hero, HERO_DATA.VIS_WTIP_X) | 0;
                wTipY = sprites.readDataNumber(hero, HERO_DATA.VIS_WTIP_Y) | 0;
            } catch { /* ignore */ }
            if (!wTipX && !wTipY) {
                const tip = leadEdge + 6;
                wTipX = nx * tip;
                wTipY = ny * tip;
            }

            return [innerR, leadEdge, wTipX, wTipY];
        };


        if (DEBUG_COMPAT_BOOT) {
            console.log(">>> [arcadeCompat] installed __HeroEngineHooks.getHeroVisualInfo override");
        }
    } catch (e) {
        console.warn("[arcadeCompat] failed to install hero visual hook", e);
    }
}


(function installHeroVisualHook() {
    try {
        const g: any = globalThis as any;
        g.__HeroEngineHooks = g.__HeroEngineHooks || {};

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
                const auraRadiusRaw = hero?.data?.auraRadius;
                const auraRadius = (typeof auraRadiusRaw === "number" && isFinite(auraRadiusRaw))
                    ? (auraRadiusRaw | 0)
                    : 2;

                const baseInner = heroAnimGlue.getHeroAuraInnerRForNative(native, auraRadius);
                const baseLead = heroAnimGlue.getHeroAuraLeadForNativeDir(native, auraRadius, dir);

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

            // 4) Weapon tip offset (prefer cached real weapon offsets)
            let wTipX = 0;
            let wTipY = 0;
            try {
                wTipX = sprites.readDataNumber(hero, HERO_DATA.VIS_WTIP_X) | 0;
                wTipY = sprites.readDataNumber(hero, HERO_DATA.VIS_WTIP_Y) | 0;
            } catch { /* ignore */ }
            if (!wTipX && !wTipY) {
                const tip = leadEdge + 6;
                wTipX = nx * tip;
                wTipY = ny * tip;
            }

            return [innerR, leadEdge, wTipX, wTipY];
        };

        if (DEBUG_COMPAT_BOOT) {
            console.log(">>> [arcadeCompat] installed __HeroEngineHooks.getHeroVisualInfo (silhouette)");
        }
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

    const shouldLogPerformance = false
    if (shouldLogPerformance) { console.log(
        "[perf.host]",
        "fps≈", fps.toFixed(1),
        "avgTickMs≈", avgTick.toFixed(2),
        "avgSyncMs≈", avgSync.toFixed(2),
        "avgSnapMs≈", avgSnap.toFixed(2),
        "sprites≈", _hostPerfLastSpriteCount,
        "snapSprites≈", _hostPerfLastSnapshotSprites
    )
    }
    
    _hostPerfLastDumpMs = nowMs
    _hostPerfFrameCount = 0
    _hostPerfAccumTickMs = 0
    _hostPerfAccumSyncMs = 0
    _hostPerfAccumSnapMs = 0
}



// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
/* -------------------------------------------------------
   Basic helpers
------------------------------------------------------- */

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

// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️


// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️
//Shop here
//Shop section
//Shop integration
// ------------------------------------------------------------
// SHOP RING (Phaser) – internal tagging + native sprite fields
// ------------------------------------------------------------
const SHOP_RING_NATIVE_SIG_KEY = "__shopRingSig";
const SHOP_RING_NATIVE_WIRED_KEY = "__shopRingCleanupWired";

// Tags on the spawned Phaser sprites so we can recognize them later if needed.
const SHOP_RING_TAG_IS = "__isShopRingWeapon";
const SHOP_RING_TAG_INDEX = "__shopRingIndex";
const SHOP_RING_TAG_LAYER = "__shopRingLayer"; // "bg" | "fg"

// Native sprite fields we attach to the shopkeeper Phaser sprite
// (stored as properties, not data keys)
const SHOP_RING_NATIVE_BG_FIELD = "__shopRingBg"; // Phaser.Sprite[]
const SHOP_RING_NATIVE_FG_FIELD = "__shopRingFg"; // Phaser.Sprite[]

// Visual tuning
const SHOP_RING_UNFOCUSED_ALPHA = 0.60;
const SHOP_RING_FOCUSED_ALPHA = 1.00;

// Optional: quick tint when focused (leave undefined to disable)
const SHOP_RING_FOCUS_TINT: number | undefined = undefined; // e.g. 0xffffaa

// Shop weapon display tweaks
// We render shop weapons using the "Up" row so we can pick frames that don't have the hero silhouette cutout.
const SHOP_RING_FORCE_DIR_LETTER = "U" as const

// Table/rug layout (matches HeroEngineInPhaserV7.ts)
const SHOP_RING_LINE_SPACING_PX = 40
const SHOP_RING_LINE_Y_OFFSET_PX = 28

// How many sprite-sheet columns we brute-test to find a “complete” weapon frame.
const SHOP_RING_STATIC_COL_MAX = 12




// ------------------------------------------------------------
// SHOP (Phaser-side) sprite.data keys
// NOTE: arcadeCompat.ts cannot see MakeCode constants.
// ------------------------------------------------------------


// ------------------------------------------------------------
// SHOP WEAPON RING – contract keys (must match MakeCode side)
// ------------------------------------------------------------
const SHOP_WPN_RING_IDS_KEY = "shopWpnRingIds";                 // "idA|idB|idC"
const SHOP_WPN_RING_RADIUS_PX_KEY = "shopWpnRingRadiusPx";      // number
const SHOP_WPN_RING_ANGLE_DEG_KEY = "shopWpnRingAngleDeg";      // number
const SHOP_WPN_DEFAULT_DIR_KEY = "shopWpnDefaultDir";           // "R","L","U","D"
const SHOP_WPN_DIR_MAP_KEY = "shopWpnDirMap";                   // "idA:R,idB:U"

const SHOP_WPN_RING_SLOTS_KEY = "shopWpnRingSlots";             // "thrust|slash|cast"
const SHOP_WPN_RING_SOURCE_PHASES_KEY = "shopWpnRingSourcePhases"; // "thrust|slash|cast"

// By-pid focus payloads (published by shop logic)
const SHOP_WPN_TOUCHED_RING_BY_PID_KEY = "shopWpnTouchedRingByPid"; // "p1=-1|p2=0|p3=-1|p4=-1"
const SHOP_WPN_TOUCHED_ID_BY_PID_KEY = "shopWpnTouchedIdByPid";     // "p1=|p2=diamond|..."
const SHOP_WPN_TOUCHED_SLOT_BY_PID_KEY = "shopWpnTouchedSlotByPid"; // "p1=|p2=thrust|..."

// ------------------------------------------------------------
// SHOP WEAPON RING – Phaser-side visuals
// ------------------------------------------------------------
//const SHOP_RING_NATIVE_SIG_KEY = "__shopRingSig";

// Alpha for focused/unfocused weapons in ring
//const SHOP_RING_FOCUSED_ALPHA = 1.0;
//const SHOP_RING_UNFOCUSED_ALPHA = 0.35;

// Optional tint (set to undefined to disable tinting)
//const SHOP_RING_FOCUS_TINT: number | undefined = undefined; // e.g. 0xffffaa

// Variant passed to weaponAnimGlue (without leading "v")
//const DEFAULT_WEAPON_VARIANT = "1";



// ------------------------------------------------------------
// SHOP WEAPON RING – helpers + ring cache on the native shopkeeper
// ------------------------------------------------------------

type _ShopRingNative = {
    bg: Phaser.GameObjects.Sprite[];
    fg: Phaser.GameObjects.Sprite[];
};

function _shopRing_lineOffsetForIndex(i: number, n: number): { ox: number; oy: number } {
    const nn = Math.max(1, n | 0)
    const spacing = (SHOP_RING_LINE_SPACING_PX | 0) || 40
    const yOff = (SHOP_RING_LINE_Y_OFFSET_PX | 0) || 28

    // Center the row around the shopkeeper native.
    const startX = -Math.floor(((nn - 1) * spacing) / 2)
    const ox = (startX + ((i | 0) * spacing)) | 0
    const oy = yOff | 0
    return { ox, oy }
}


function _shopSplitPipeNonEmpty(s: string): string[] {
    const t = (s || "").trim();
    if (!t) return [];
    return t.split("|").map(x => (x || "").trim()).filter(x => !!x);
}

function _shopSplitPipeKeepEmpty(s: string): string[] {
    const t = (s ?? "");
    // keep empties so slots/phases stay aligned by index
    return t.split("|").map(x => (x ?? "").trim());
}

// "p1=-1|p2=0|p3=-1|p4=-1" -> array indexed by pid: out[1..4]
function _shopParsePidEqIntPipe(s: string): number[] {
    const out = [0, -1, -1, -1, -1]; // [0 unused, p1..p4]
    const t = (s || "").trim();
    if (!t) return out;

    const parts = t.split("|");
    for (const part of parts) {
        const kv = part.split("=");
        if (kv.length !== 2) continue;
        const k = (kv[0] || "").trim().toLowerCase(); // "p2"
        const v = (kv[1] || "").trim();
        if (k.length < 2 || k[0] !== "p") continue;
        const pid = (parseInt(k.slice(1), 10) | 0);
        if (pid < 1 || pid > 4) continue;
        const n = parseInt(v, 10);
        out[pid] = isFinite(n) ? (n | 0) : -1;
    }
    return out;
}

// "p1=dagger|p2=|p3=foo|p4=" -> out[1..4]
function _shopParsePidEqStrPipe(s: string): string[] {
    const out = ["", "", "", "", ""]; // [0 unused, p1..p4]
    const t = (s || "").trim();
    if (!t) return out;

    const parts = t.split("|");
    for (const part of parts) {
        const kv = part.split("=");
        if (kv.length !== 2) continue;
        const k = (kv[0] || "").trim().toLowerCase();
        const v = (kv[1] || "").trim();
        if (k.length < 2 || k[0] !== "p") continue;
        const pid = (parseInt(k.slice(1), 10) | 0);
        if (pid < 1 || pid > 4) continue;
        out[pid] = v;
    }
    return out;
}


// "idA:R,idB:U" -> { idA:"R", idB:"U" }
function _shopParseDirMap(s: string): Record<string, string> {
    const out: Record<string, string> = Object.create(null);
    const t = (s || "").trim();
    if (!t) return out;

    const pairs = t.split(",");
    for (const pair of pairs) {
        const p = (pair || "").trim();
        if (!p) continue;
        const kv = p.split(":");
        if (kv.length !== 2) continue;
        const id = (kv[0] || "").trim();
        const dir = (kv[1] || "").trim().toUpperCase();
        if (!id || !dir) continue;
        out[id] = dir;
    }
    return out;
}

function _shopDirLetterToDir4(letter: string): number {
    const d = (letter || "").trim().toUpperCase();
    if (d === "U") return 0;
    if (d === "R") return 1;
    if (d === "D") return 2;
    if (d === "L") return 3;
    return 1; // default R
}


function _getTextureFrameIndex(native: any): number {
    // 1) Best: sprite.frame (this is what Phaser is actually displaying)
    try {
        const fr = native?.frame as any;
        if (fr) {
            const idxA = fr.index;
            if (typeof idxA === "number" && Number.isFinite(idxA)) return (idxA | 0);

            const nameA = fr.name;
            if (typeof nameA === "number" && Number.isFinite(nameA)) return (nameA | 0);

            if (typeof nameA === "string" && nameA) {
                const n = parseInt(nameA, 10);
                if (Number.isFinite(n)) return (n | 0);
            }
        }
    } catch { /* ignore */ }

    // 2) Next: anims.currentFrame (sometimes present even when frame is weird)
    try {
        const cf = native?.anims?.currentFrame as any;
        if (cf) {
            const tf = (cf.textureFrame as any);
            if (typeof tf === "number" && Number.isFinite(tf)) return (tf | 0);

            if (typeof tf === "string" && tf) {
                const n = parseInt(tf, 10);
                if (Number.isFinite(n)) return (n | 0);
            }

            const fr2 = (cf.frame as any);
            const idx2 = fr2?.index;
            if (typeof idx2 === "number" && Number.isFinite(idx2)) return (idx2 | 0);

            const name2 = fr2?.name;
            if (typeof name2 === "number" && Number.isFinite(name2)) return (name2 | 0);

            if (typeof name2 === "string" && name2) {
                const n2 = parseInt(name2, 10);
                if (Number.isFinite(n2)) return (n2 | 0);
            }
        }
    } catch { /* ignore */ }

    return -1;
}


function _getNativeFrameIndexLoose(nativeHero: Phaser.GameObjects.Sprite): number {
    const fr: any = (nativeHero as any)?.frame;
    if (!fr) return -1;

    const nameAny: any = (fr.name ?? fr.textureFrame ?? fr.index ?? null);

    if (typeof nameAny === "number" && Number.isFinite(nameAny)) return nameAny | 0;

    const s = String(nameAny ?? "");
    if (!s) return -1;

    // "__BASE"/"base" are common sentinels in some pipelines
    if (s === "__BASE" || s === "base") return -1;

    const n2 = parseInt(s, 10);
    return Number.isFinite(n2) ? (n2 | 0) : -1;
}



function _destroyShopWeaponRingForNative(native: any): void {
    const ring = (native?.getData?.("__shopRing") as any) as _ShopRingNative | null;
    if (!ring) return;

    try { native.setData?.("__shopRing", null); } catch { }

    const bgs = ring.bg || [];
    const fgs = ring.fg || [];

    for (const sp of bgs) {
        try { sp?.destroy?.(); } catch { }
    }
    for (const sp of fgs) {
        try { sp?.destroy?.(); } catch { }
    }
}


function _ensureShopWeaponRingForNative(
    ctx: SyncContext,
    nativeShop: Phaser.GameObjects.Sprite,
    count: number
): { bg: Phaser.GameObjects.Sprite[]; fg: Phaser.GameObjects.Sprite[] } | null {
    const sc = ctx.sc as any;
    if (!sc || !nativeShop) return null;

    const need = Math.max(0, count | 0);
    if (need <= 0) return null;

    const host: any = nativeShop as any;

    // Prefer storing on nativeShop data, but fall back to fields if you want.
    let ring: any = null;
    try { ring = nativeShop.getData("__shopRing"); } catch { ring = null; }

    let bgArr: any[] = (ring && ring.bg) ? ring.bg : [];
    let fgArr: any[] = (ring && ring.fg) ? ring.fg : [];

    const isAlive = (spr: any): boolean => {
        if (!spr) return false;
        if ((spr as any).destroyed) return false;
        if (!(spr as any).scene) return false;
        return true;
    };

    // Rebuild if mismatch or dead sprites
    let rebuild = false;
    if (bgArr.length !== need || fgArr.length !== need) rebuild = true;
    if (!rebuild) {
        for (let i = 0; i < need; i++) {
            if (!isAlive(bgArr[i]) || !isAlive(fgArr[i])) { rebuild = true; break; }
        }
    }

    if (rebuild) {
        _destroyShopWeaponRingForNative(nativeShop as any);
        bgArr = new Array(need);
        fgArr = new Array(need);
    }

    // Create any missing sprites
    for (let i = 0; i < need; i++) {
        if (!isAlive(bgArr[i])) {
            // Use a guaranteed texture key that exists in your Phaser project.
            // "__missing__" may not exist => would create an invisible sprite / error depending on Phaser config.
            // "white" also may not exist. So we create as a Graphics-backed texture fallback if needed.
            bgArr[i] = _shopRingCreatePlaceholderSprite(sc, nativeShop.x, nativeShop.y);
            try { (bgArr[i] as any).setVisible(false); } catch { }
        }
        if (!isAlive(fgArr[i])) {
            fgArr[i] = _shopRingCreatePlaceholderSprite(sc, nativeShop.x, nativeShop.y);
            try { (fgArr[i] as any).setVisible(false); } catch { }
        }

        // Common props
        try {
            const sfx = (nativeShop as any).scrollFactorX;
            const sfy = (nativeShop as any).scrollFactorY;
            (bgArr[i] as any).setScrollFactor?.(sfx, sfy);
            (fgArr[i] as any).setScrollFactor?.(sfx, sfy);
        } catch { }

        try { (bgArr[i] as any).setDepth?.(((nativeShop as any).depth ?? 0) - 1); } catch { }
        try { (fgArr[i] as any).setDepth?.(((nativeShop as any).depth ?? 0) + 1); } catch { }

        // Tagging (optional)
        try { (bgArr[i] as any).setData?.(SHOP_RING_TAG_IS, 1); } catch { }
        try { (fgArr[i] as any).setData?.(SHOP_RING_TAG_IS, 1); } catch { }
        try { (bgArr[i] as any).setData?.(SHOP_RING_TAG_INDEX, i); } catch { }
        try { (fgArr[i] as any).setData?.(SHOP_RING_TAG_INDEX, i); } catch { }
        try { (bgArr[i] as any).setData?.(SHOP_RING_TAG_LAYER, "bg"); } catch { }
        try { (fgArr[i] as any).setData?.(SHOP_RING_TAG_LAYER, "fg"); } catch { }
    }

    // Persist
    try { nativeShop.setData("__shopRing", { bg: bgArr, fg: fgArr }); } catch { }

    // Wire cleanup once
    if (!host.__shopRingWired && typeof host.once === "function") {
        host.__shopRingWired = 1;
        try {
            host.once("destroy", () => _destroyShopWeaponRingForNative(nativeShop as any));
        } catch { /* ignore */ }
    }

    return { bg: bgArr as any, fg: fgArr as any };
}

// Helper: create something that ALWAYS renders even if you don't have a texture key
function _shopRingCreatePlaceholderSprite(
    sc: Phaser.Scene,
    x: number,
    y: number
): Phaser.GameObjects.Sprite {
    // Try to use an existing 1x1 texture if you have one
    const texKey = "__shopRing_px";

    try {
        if (!sc.textures.exists(texKey)) {
            // Create a 4x4 white square texture
            const g = sc.add.graphics();
            g.fillStyle(0xffffff, 1);
            g.fillRect(0, 0, 4, 4);
            g.generateTexture(texKey, 4, 4);
            g.destroy();
        }
    } catch {
        // If texture gen fails, fall back to a normal sprite key (may still fail if missing)
    }

    try {
        const spr = sc.add.sprite(x, y, texKey, 0);
        // make it easier to see during bring-up
        try { (spr as any).setScale?.(2); } catch { }
        return spr;
    } catch {
        // Absolute fallback: create an image (still needs texture though)
        return sc.add.sprite(x, y, texKey, 0);
    }
}



function _shopRing_readStr(spr: any, key: string): string {
    if (!spr) return ""
    const d: any = (spr as any).data
    if (!d) return ""

    // Map / DataBag style
    try {
        if (typeof d.get === "function") {
            const v = d.get(key)
            return (typeof v === "string") ? v : ""
        }
    } catch { /* ignore */ }

    // PXT internal
    try {
        if (d._data && typeof d._data[key] === "string") return d._data[key]
    } catch { /* ignore */ }

    // Plain object
    try {
        const v = d[key]
        return (typeof v === "string") ? v : ""
    } catch { /* ignore */ }

    return ""
}

function _shopRing_readNum(spr: any, key: string): number {
    if (!spr) return 0
    const d: any = (spr as any).data
    if (!d) return 0

    try {
        if (typeof d.get === "function") {
            const v = d.get(key)
            return (typeof v === "number") ? (v | 0) : 0
        }
    } catch { /* ignore */ }

    try {
        if (d._data && typeof d._data[key] === "number") return d._data[key] | 0
    } catch { /* ignore */ }

    try {
        const v = d[key]
        return (typeof v === "number") ? (v | 0) : 0
    } catch { /* ignore */ }

    return 0
}

function _shopRing_teardownIfNoIds(native: Phaser.GameObjects.Sprite, ringIdsRaw: string): boolean {
    if (ringIdsRaw && ringIdsRaw.trim()) return false

    const lastSig = (native.getData(SHOP_RING_NATIVE_SIG_KEY) as any) || ""
    if (lastSig) {
        _destroyShopWeaponRingForNative(native as any)
        try { native.setData(SHOP_RING_NATIVE_SIG_KEY, "") } catch { }
    }
    return true
}

function _shopRing_buildConfig(s: any): any | null {
    const ringIdsRaw = _shopRing_readStr(s, SHOP_WPN_RING_IDS_KEY)
    const ids = _shopSplitPipeNonEmpty(ringIdsRaw)
    const n = ids.length | 0
    if (n <= 0) return null

    const radiusPx = (_shopRing_readNum(s, SHOP_WPN_RING_RADIUS_PX_KEY) | 0) || 22
    const baseDeg = (_shopRing_readNum(s, SHOP_WPN_RING_ANGLE_DEG_KEY) | 0) || 0

    const defaultDirLetter = (_shopRing_readStr(s, SHOP_WPN_DEFAULT_DIR_KEY).trim() || "R")
    const dirMapRaw = _shopRing_readStr(s, SHOP_WPN_DIR_MAP_KEY)
    const slotsRaw = _shopRing_readStr(s, SHOP_WPN_RING_SLOTS_KEY)
    const srcPhasesRaw = _shopRing_readStr(s, SHOP_WPN_RING_SOURCE_PHASES_KEY)

    const slots = _shopSplitPipeKeepEmpty(slotsRaw)
    const srcPhases = _shopSplitPipeKeepEmpty(srcPhasesRaw)
    const dirMap = _shopParseDirMap(dirMapRaw)

    const touchedRingByPid = _shopParsePidEqIntPipe(_shopRing_readStr(s, SHOP_WPN_TOUCHED_RING_BY_PID_KEY))
    const touchedIdByPid = _shopParsePidEqStrPipe(_shopRing_readStr(s, SHOP_WPN_TOUCHED_ID_BY_PID_KEY))
    const touchedSlotByPid = _shopParsePidEqStrPipe(_shopRing_readStr(s, SHOP_WPN_TOUCHED_SLOT_BY_PID_KEY))

    // IMPORTANT: actually detect weaponAnimGlue and stash it on cfg
    const glueInfo = _shopRing_findGlue()
    const glueAny = glueInfo.glueAny
    const hasGlue = glueInfo.hasGlue

    // One-time debug if glue is missing (helps if export name/load order is wrong)
    const g: any = globalThis as any
    if (!hasGlue && !g.__shopRingWarnedNoGlue) {
        g.__shopRingWarnedNoGlue = 1
        try {
            console.warn(
                "[SHOPRING] weaponAnimGlue missing or lacks syncWeaponLayersToHero()",
                "| weaponAnimGlue=", !!g.weaponAnimGlue,
                "| weaponAnimGlueTs=", !!g.weaponAnimGlueTs,
                "| weaponAnimGlueTS=", !!g.weaponAnimGlueTS
            )
        } catch { }
    }

    const sig =
        `n=${n}|ids=${ids.join(",")}|r=${radiusPx}|a=${baseDeg}|dd=${defaultDirLetter}|dm=${dirMapRaw}|sl=${slotsRaw}|sp=${srcPhasesRaw}`

    return {
        ringIdsRaw,
        ids,
        n,
        radiusPx,
        baseDeg,
        defaultDirLetter,
        dirMapRaw,
        slotsRaw,
        srcPhasesRaw,
        slots,
        srcPhases,
        dirMap,
        touchedRingByPid,
        touchedIdByPid,
        touchedSlotByPid,
        sig,

        // NEW: needed by _shopRing_applyGlueOrPlaceholder
        glueAny,
        hasGlue
    }
}

function _shopRing_ensureSigAndRing(
    ctx: SyncContext,
    native: Phaser.GameObjects.Sprite,
    cfg: any
): any | null {
    const lastSig = (native.getData(SHOP_RING_NATIVE_SIG_KEY) as any) || ""
    if (lastSig !== (cfg.sig + "")) {
        _destroyShopWeaponRingForNative(native as any)
        try { native.setData(SHOP_RING_NATIVE_SIG_KEY, cfg.sig + "") } catch { }
    }

    const ring = _ensureShopWeaponRingForNative(ctx, native, cfg.n | 0)
    return ring || null
}

function _shopRing_findGlue(): { glueAny: any; hasGlue: boolean } {
    const glueAny: any =
        (globalThis as any).weaponAnimGlue ||
        (globalThis as any).weaponAnimGlueTs ||
        (globalThis as any).weaponAnimGlueTS

    const hasGlue = !!(glueAny && typeof glueAny.syncWeaponLayersToHero === "function")
    return { glueAny, hasGlue }
}

function _shopRing_buildFocusedIndex(n: number, touchedRingByPid: any): boolean[] {
    const focusedIndex: boolean[] = new Array(n | 0)
    for (let i = 0; i < (n | 0); i++) focusedIndex[i] = false

    for (let pid = 1; pid <= 4; pid++) {
        const ri = (touchedRingByPid[pid] | 0)
        if (ri >= 0 && ri < (n | 0)) focusedIndex[ri] = true
    }
    return focusedIndex
}

function _shopRing_applyFocusVisuals(
    bg: any,
    fg: any,
    isFocused: boolean,
    shopDepth: number
): void {
    try { bg.setDepth?.((shopDepth | 0) - 1) } catch { }
    try { fg.setDepth?.((shopDepth | 0) + 1) } catch { }

    const a = isFocused ? SHOP_RING_FOCUSED_ALPHA : SHOP_RING_UNFOCUSED_ALPHA
    try { bg.setAlpha?.(a) } catch { }
    try { fg.setAlpha?.(a) } catch { }

    if (SHOP_RING_FOCUS_TINT !== undefined) {
        try { (bg as any).setTint?.(isFocused ? SHOP_RING_FOCUS_TINT : 0xffffff) } catch { }
        try { (fg as any).setTint?.(isFocused ? SHOP_RING_FOCUS_TINT : 0xffffff) } catch { }
    }
}


function _shopRing_pickBestStaticFrameColCached(args: {
    sc: any;
    native: Phaser.GameObjects.Sprite;
    bg: any;
    fg: any;
    weaponId: string;
    heroPhase: string;
    dir: any;
    heroFrameIndex: number;
    glueAny: any;
    variant: string;
}): number {
    const g: any = globalThis as any
    if (!g.__shopRingBestColCache) g.__shopRingBestColCache = Object.create(null)
    const cache: Record<string, number> = g.__shopRingBestColCache

    const key = `${args.weaponId}|${args.heroPhase}|${args.dir}|${args.variant || DEFAULT_WEAPON_VARIANT}`
    const hit = cache[key]
    if (typeof hit === "number") return hit | 0

    let bestCol = 0
    let bestScore = -1

    const maxTry = (SHOP_RING_STATIC_COL_MAX | 0) || 12
    for (let col = 0; col < maxTry; col++) {
        try {
            args.glueAny.syncWeaponLayersToHero({
                scene: args.sc,
                heroSprite: args.native,
                weaponBg: args.bg,
                weaponFg: args.fg,
                weaponId: args.weaponId,
                heroPhase: args.heroPhase,
                dir: args.dir,
                heroFrameIndex: args.heroFrameIndex,
                variant: args.variant,
                frameColOverride: col
            })
        } catch {
            continue
        }

        const score = _shopRing_scoreCurrentFramesUnionAlpha(args.bg, args.fg)
        if (score > bestScore) {
            bestScore = score
            bestCol = col | 0
        }
    }

    cache[key] = bestCol | 0
    return bestCol | 0
}

function _shopRing_scoreCurrentFramesUnionAlpha(bg: any, fg: any): number {
    try {
        const sb = _shopRing_getFrameDrawSpec(bg)
        const sf = _shopRing_getFrameDrawSpec(fg)
        if (!sb && !sf) return 0

        const w = Math.max(sb?.sw ?? 0, sf?.sw ?? 0) | 0
        const h = Math.max(sb?.sh ?? 0, sf?.sh ?? 0) | 0
        if (w <= 0 || h <= 0) return 0

        const g: any = globalThis as any
        const doc: any = (g.document as any)
        if (!doc || typeof doc.createElement !== "function") return 0

        let canvas: any = g.__shopRingScanCanvas || null
        if (!canvas) {
            canvas = doc.createElement("canvas")
            g.__shopRingScanCanvas = canvas
        }
        canvas.width = w
        canvas.height = h

        const ctx2d: any = canvas.getContext?.("2d", { willReadFrequently: true } as any)
        if (!ctx2d) return 0

        ctx2d.clearRect(0, 0, w, h)
        if (sb) ctx2d.drawImage(sb.img, sb.sx, sb.sy, sb.sw, sb.sh, 0, 0, sb.sw, sb.sh)
        if (sf) ctx2d.drawImage(sf.img, sf.sx, sf.sy, sf.sw, sf.sh, 0, 0, sf.sw, sf.sh)

        const imgData = ctx2d.getImageData(0, 0, w, h)
        const data = imgData.data

        let alphaCount = 0
        let minX = w, minY = h, maxX = -1, maxY = -1

        // Scan alpha channel; build bbox of all non-transparent pixels.
        for (let y = 0; y < h; y++) {
            let rowIdx = (y * w * 4) | 0
            for (let x = 0; x < w; x++) {
                const a = data[rowIdx + 3] | 0
                if (a > 0) {
                    alphaCount++
                    if (x < minX) minX = x
                    if (y < minY) minY = y
                    if (x > maxX) maxX = x
                    if (y > maxY) maxY = y
                }
                rowIdx += 4
            }
        }

        if (alphaCount <= 0 || maxX < 0 || maxY < 0) return 0

        const bw = (maxX - minX + 1) | 0
        const bh = (maxY - minY + 1) | 0
        const bboxArea = Math.max(1, (bw * bh) | 0)
        const fill = alphaCount / bboxArea

        // Prefer: lots of pixels (big weapon) + high fill (few holes/gaps).
        const score = (alphaCount * 1000) + Math.floor(fill * 1000000)
        return score | 0
    } catch {
        // If canvas readback fails (tainted canvas, etc.), fall back to col 0 behavior.
        return 0
    }
}

function _shopRing_getFrameDrawSpec(spr: any): null | { img: any; sx: number; sy: number; sw: number; sh: number } {
    try {
        if (!spr || !spr.frame) return null
        const fr: any = spr.frame
        const srcImg =
            fr?.source?.image ||
            fr?.texture?.source?.[0]?.image ||
            fr?.texture?.getSourceImage?.() ||
            null
        if (!srcImg) return null

        const sx = (fr.cutX ?? fr.x ?? 0) | 0
        const sy = (fr.cutY ?? fr.y ?? 0) | 0
        const sw = (fr.cutWidth ?? fr.width ?? 0) | 0
        const sh = (fr.cutHeight ?? fr.height ?? 0) | 0
        if (sw <= 0 || sh <= 0) return null

        return { img: srcImg, sx, sy, sw, sh }
    } catch {
        return null
    }
}


function _shopRing_applyGlueOrPlaceholder(args: {
    ctx: SyncContext
    cfg: ReturnType<typeof _shopRing_buildConfig>
    sc: any
    native: Phaser.GameObjects.Sprite
    bg: any
    fg: any
    weaponId: string
    heroPhase: string
    dir: any
    heroFrameIndex: number
    hasGlue: boolean
    ox: number
    oy: number
    variant: string
}): void {
    if (!args.weaponId) {
        try { args.bg.setVisible(false) } catch { }
        try { args.fg.setVisible(false) } catch { }
        return
    }

    // We are intentionally forcing: row = "U" (handled by caller via dir),
    // and frame = [0][0] by hardcoding heroFrameIndex=0 and frameColOverride=0.
    if (args.hasGlue) {
        try {
            args.cfg.glueAny.syncWeaponLayersToHero({
                scene: args.sc,
                heroSprite: args.native,
                weaponBg: args.bg,
                weaponFg: args.fg,
                weaponId: args.weaponId,
                heroPhase: args.heroPhase,
                dir: args.dir,
                heroFrameIndex: 0,               // <-- force [row][frame] = [U][0]
                variant: args.variant,
                frameColOverride: 0              // <-- force col 0
            })

            // Glue overwrites x/y -> restore ring placement AFTER glue.
            args.bg.x = (args.native.x + args.ox)
            args.bg.y = (args.native.y + args.oy)
            args.fg.x = args.bg.x
            args.fg.y = args.bg.y

            try { args.bg.setVisible(true) } catch { }
            try { args.fg.setVisible(true) } catch { }
            return
        } catch (e) {
            if (args.ctx.shouldLog) {
                console.warn("[SHOPRING][GLUE_FAIL][FORCE00]",
                    "weaponId=", args.weaponId,
                    "heroPhase=", args.heroPhase,
                    "err=", e
                )
            }
            try { args.bg.setVisible(false) } catch { }
            try { args.fg.setVisible(false) } catch { }
            return
        }
    }

    // No glue -> keep hidden (no white squares)
    try { args.bg.setVisible(false) } catch { }
    try { args.fg.setVisible(false) } catch { }
}


function _shopRing_setDebugMetadata(args: {
    bg: any;
    fg: any;
    isFocused: boolean;
    idx: number;
    touchedRingByPid: any;
    touchedIdByPid: any;
    touchedSlotByPid: any;
}): void {
    if (args.isFocused) {
        let fp = 0
        for (let pid = 1; pid <= 4; pid++) {
            if ((args.touchedRingByPid[pid] | 0) === (args.idx | 0)) { fp = pid; break }
        }
        try { args.bg.setData?.("__shopFocusedByPid", fp) } catch { }
        try { args.fg.setData?.("__shopFocusedByPid", fp) } catch { }
        try { args.bg.setData?.("__shopFocusPidWeaponId", args.touchedIdByPid[fp] || "") } catch { }
        try { args.bg.setData?.("__shopFocusPidSlot", args.touchedSlotByPid[fp] || "") } catch { }
    } else {
        try { args.bg.setData?.("__shopFocusedByPid", 0) } catch { }
        try { args.fg.setData?.("__shopFocusedByPid", 0) } catch { }
    }
}

function _shopRing_buildFocusMask(n: number, touchedRingByPid: any): boolean[] {
    const nn = Math.max(0, n | 0)
    const focusedIndex: boolean[] = new Array(nn)
    for (let i = 0; i < nn; i++) focusedIndex[i] = false

    if (!touchedRingByPid) return focusedIndex

    for (let pid = 1; pid <= 4; pid++) {
        const ri = (touchedRingByPid[pid] | 0)
        if (ri >= 0 && ri < nn) focusedIndex[ri] = true
    }

    return focusedIndex
}


function _syncShopWeaponRingIfPresent(
    ctx: SyncContext,
    s: any,
    native: Phaser.GameObjects.Sprite
): void {
    const sc = ctx.sc as any;
    if (!sc || !s || !native) return;

    const ringIdsRaw = _shopRing_readStr(s, SHOP_WPN_RING_IDS_KEY);
    if (!ringIdsRaw.trim()) {
        const lastSig = (native.getData(SHOP_RING_NATIVE_SIG_KEY) as any) || "";
        if (lastSig) {
            _destroyShopWeaponRingForNative(native as any);
            try { native.setData(SHOP_RING_NATIVE_SIG_KEY, ""); } catch { }
        }
        return;
    }

    const cfg = _shopRing_buildConfig(s, native);
    if (!cfg || cfg.n <= 0) return;

    // Destroy/rebuild ring sprites when config changes
    const lastSig = (native.getData(SHOP_RING_NATIVE_SIG_KEY) as any) || "";
    if (lastSig !== cfg.sig) {
        _destroyShopWeaponRingForNative(native as any);
        try { native.setData(SHOP_RING_NATIVE_SIG_KEY, cfg.sig); } catch { }
    }

    const ring = _ensureShopWeaponRingForNative(ctx, native, cfg.n);
    if (!ring) return;

    const shopDepth = ((native as any).depth ?? 0) | 0;
    const heroFrameIndex = _getNativeFrameIndexLoose(native as any);

    const focusedIndex = _shopRing_buildFocusMask(cfg.n, cfg.touchedRingByPid);

    for (let i = 0; i < cfg.n; i++) {
        const weaponId = (cfg.ids[i] || "").trim();
        const slot = (i < cfg.slots.length) ? (cfg.slots[i] || "").trim() : "";
        const srcPhase = (i < cfg.srcPhases.length) ? (cfg.srcPhases[i] || "").trim() : "";
        const heroPhase = (srcPhase || slot || "thrust") + "";

        // Force “Up row” rendering so we can pick columns that don’t have the hero silhouette cutout.
        const dir = _shopDirLetterToDir4(SHOP_RING_FORCE_DIR_LETTER);
        const off = _shopRing_lineOffsetForIndex(i, cfg.n);

        const ox = off.ox | 0
        const oy = off.oy | 0

        const bg = ring.bg[i] as any;
        const fg = ring.fg[i] as any;
        const variant = _weaponVariantForKey(`shopRing:${cfg.sig}:${i}`, weaponId);

        if (!weaponId) {
            try { bg.setVisible(false); } catch { }
            try { fg.setVisible(false); } catch { }
            continue;
        }

        // Position
        bg.x = (native.x + ox);
        bg.y = (native.y + oy);
        fg.x = bg.x;
        fg.y = bg.y;

        // Depth
        try { bg.setDepth?.(shopDepth - 1); } catch { }
        try { fg.setDepth?.(shopDepth + 1); } catch { }

        // Highlight
        const isFocused = !!focusedIndex[i];
        const a = isFocused ? SHOP_RING_FOCUSED_ALPHA : SHOP_RING_UNFOCUSED_ALPHA;
        try { bg.setAlpha?.(a); } catch { }
        try { fg.setAlpha?.(a); } catch { }
        if (SHOP_RING_FOCUS_TINT !== undefined) {
            try { (bg as any).setTint?.(isFocused ? SHOP_RING_FOCUS_TINT : 0xffffff); } catch { }
            try { (fg as any).setTint?.(isFocused ? SHOP_RING_FOCUS_TINT : 0xffffff); } catch { }
        }

        _shopRing_applyGlueOrPlaceholder({
            ctx,
            cfg,
            sc,
            native,
            bg,
            fg,
            weaponId,
            heroPhase,
            dir,
            heroFrameIndex,
            hasGlue: cfg.hasGlue,
            ox,
            oy,
            variant
        });

        // Debug metadata (unchanged behavior)
        if (isFocused) {
            let fp = 0;
            for (let pid = 1; pid <= 4; pid++) {
                if ((cfg.touchedRingByPid[pid] | 0) === (i | 0)) { fp = pid; break; }
            }
            try { bg.setData?.("__shopFocusedByPid", fp); } catch { }
            try { fg.setData?.("__shopFocusedByPid", fp); } catch { }
            try { bg.setData?.("__shopFocusPidWeaponId", cfg.touchedIdByPid[fp] || ""); } catch { }
            try { bg.setData?.("__shopFocusPidSlot", cfg.touchedSlotByPid[fp] || ""); } catch { }
        } else {
            try { bg.setData?.("__shopFocusedByPid", 0); } catch { }
            try { fg.setData?.("__shopFocusedByPid", 0); } catch { }
        }
    }

}

//End of shop section
// ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️ ────── 💧 ────── ❄️  SECTION  ❄️ ────── 💧 ────── ❄️

// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮
//Agility section

function _findAgiStoredCounterNativeForHero(
    heroArcade: any,
    nativeHero: Phaser.GameObjects.Sprite
): any | null {
    const owner = ((heroArcade?.data?.owner as any) | 0) | 0

    // This is the correct way to access the internal sprite list in this file.
    const all = sprites._getAllSprites()

    // 1) Preferred: exact UI kind + owner match
    for (const s of all) {
        if (!s) continue
        const nat = (s as any).native
        if (!nat) continue

        const uiKind = sprites.readDataString(s as any, "__uiKind") || ""
        if (uiKind !== "agiStoredCounter") continue

        const o = (sprites.readDataNumber(s as any, "owner") | 0) | 0
        if ((o | 0) === (owner | 0)) return nat
    }

    // 2) Fallback: nearest numeric text sprite within ~120px
    const hx = (nativeHero?.x as any) ?? 0
    const hy = (nativeHero?.y as any) ?? 0

    let bestNat: any = null
    let bestD2 = 999999999

    for (const s of all) {
        if (!s) continue
        const nat = (s as any).native
        if (!nat) continue

        // must be some kind of text sprite
        const uiKind = sprites.readDataString(s as any, "__uiKind") || ""
        if (uiKind !== "text" && uiKind !== "agiStoredCounter") continue

        const txt = sprites.readDataString(s as any, "tx_str") || ""
        if (!txt || txt.length > 5) continue
        if (!/^[0-9]+$/.test(txt)) continue

        const nx = (nat.x as any) ?? 0
        const ny = (nat.y as any) ?? 0
        const dx = nx - hx
        const dy = ny - hy
        const d2 = dx * dx + dy * dy

        if (d2 < bestD2 && d2 < (120 * 120)) {
            bestD2 = d2
            bestNat = nat
        }
    }

    return bestNat
}



function _agiBounceCounterNative(sc: Phaser.Scene, counterNative: any): void {
    if (!sc || !counterNative) return
    try { sc.tweens.killTweensOf(counterNative) } catch { /* ignore */ }

    try {
        counterNative.setScale?.(1, 1)
        sc.tweens.add({
            targets: counterNative,
            scaleX: AGI_EXEC_TICK_BOUNCE_SCALE,
            scaleY: AGI_EXEC_TICK_BOUNCE_SCALE,
            duration: AGI_EXEC_TICK_BOUNCE_MS,
            yoyo: true,
            repeat: 0
        })
    } catch { /* ignore */ }
}

function _agiSetCounterText(counterNative: any, value: number): void {
    if (!counterNative) return
    const txtObj = counterNative.getData?.("tx_text")
    if (!txtObj) return
    try { txtObj.setText?.("" + (value | 0)) } catch { /* ignore */ }
}






function _agiSpawnExecuteStreamlineFx(
    sc: Phaser.Scene,
    nativeHero: Phaser.GameObjects.Sprite,
    overlays: any,
    hitX: number,
    hitY: number
): void {
    if (!sc || !nativeHero) return

    const hx = (overlays?.weaponFg?.x ?? nativeHero.x ?? 0) as number
    const hy = (overlays?.weaponFg?.y ?? nativeHero.y ?? 0) as number
    const tx = (hitX || hitX === 0) ? (hitX as number) : (nativeHero.x ?? 0)
    const ty = (hitY || hitY === 0) ? (hitY as number) : (nativeHero.y ?? 0)

    const dx = tx - hx
    const dy = ty - hy
    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy))
    const ang = Math.atan2(dy, dx)

    // 1) Bright “streamline streak” from hero weapon -> target
    try {
        const midX = (hx + tx) * 0.5
        const midY = (hy + ty) * 0.5

        const streak = sc.add.rectangle(
            midX,
            midY,
            dist,
            AGI_EXEC_STREAMLINE_STREAK_THICK,
            AGI_EXEC_STREAMLINE_STREAK_COLOR,
            AGI_EXEC_STREAMLINE_STREAK_ALPHA
        )

        try { (streak as any).setRotation?.(ang) } catch { }
        try { (streak as any).setBlendMode?.(Phaser.BlendModes.ADD) } catch { }
        try { (streak as any).setDepth?.(999999) } catch { }

        sc.tweens.add({
            targets: streak,
            alpha: 0,
            duration: AGI_EXEC_STREAMLINE_LIFE_MS,
            onComplete: () => { try { streak.destroy() } catch { } }
        })
    } catch { /* ignore */ }

    // 2) Hero “stretch into line” (quick squash/stretch + slight rotation), then snap back
    try {
        const anyHero: any = nativeHero as any

        // Cancel any previous streamline tween so it never stacks into weird scaling.
        const prevTween: any = anyHero.__agiExecStreamlineTween
        if (prevTween) {
            try { prevTween.stop() } catch { }
            anyHero.__agiExecStreamlineTween = null
        }

        const baseScaleX = (typeof anyHero.scaleX === "number") ? anyHero.scaleX : 1
        const baseScaleY = (typeof anyHero.scaleY === "number") ? anyHero.scaleY : 1
        const baseRot = (typeof anyHero.rotation === "number") ? anyHero.rotation : 0

        // Apply a short “zip pose”
        nativeHero.setRotation(ang)
        nativeHero.setScale(baseScaleX * AGI_EXEC_STREAMLINE_SQUASH_X, baseScaleY * AGI_EXEC_STREAMLINE_SQUASH_Y)

        const t = sc.tweens.add({
            targets: nativeHero,
            scaleX: baseScaleX,
            scaleY: baseScaleY,
            rotation: baseRot,
            duration: AGI_EXEC_STREAMLINE_TWEEN_MS,
            ease: "Sine.easeOut"
        })

        anyHero.__agiExecStreamlineTween = t
    } catch { /* ignore */ }
}


function _agiPickExecuteSlashAngle(
    actionSeed: number,
    beatSeq: number
): number {
    const seed = (actionSeed | 0)
    const patIndex = Math.abs(seed) % AGI_EXEC_ANGLE_PATTERNS.length
    const pat = AGI_EXEC_ANGLE_PATTERNS[patIndex] || AGI_EXEC_ANGLE_PATTERNS[0]
    const i = Math.abs(beatSeq | 0) % pat.length
    return pat[i] || 0.78
}



function _agiSpawnExecuteSlashMarkFx(
    sc: Phaser.Scene,
    nativeHero: Phaser.GameObjects.Sprite,
    overlays: any,
    hitX: number,
    hitY: number
): void {
    if (!sc) return

    const hx = (overlays?.weaponFg?.x ?? nativeHero.x ?? 0) as number
    const hy = (overlays?.weaponFg?.y ?? nativeHero.y ?? 0) as number

    const tx = (hitX || hitX === 0) ? (hitX as number) : (nativeHero.x ?? 0)
    const ty = (hitY || hitY === 0) ? (hitY as number) : (nativeHero.y ?? 0)

    const dx = tx - hx
    const dy = ty - hy
    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy))
    const ang = Math.atan2(dy, dx)

    // Beat number: stored in Step 11 as __agiExecSlashBeatSeq on the hero
    const beatSeq = ((nativeHero.getData("__agiExecSlashBeatSeq") as any) | 0)
    const actionSeed = ((nativeHero.getData("ActionSeed") as any) | 0)
    const markAng = _agiPickExecuteSlashAngle(actionSeed, beatSeq)

    // 1) “Zip line” from hero weapon -> target (thin, fast fade)
    try {
        const midX = (hx + tx) * 0.5
        const midY = (hy + ty) * 0.5
        const dash = sc.add.rectangle(midX, midY, dist, AGI_EXEC_SLASH_DASH_THICK, AGI_EXEC_SLASH_MARK_COLOR, 0.9)
        try { (dash as any).setRotation?.(ang) } catch { }
        try { (dash as any).setBlendMode?.(Phaser.BlendModes.ADD) } catch { }
        try { (dash as any).setDepth?.(999999) } catch { }

        sc.tweens.add({
            targets: dash,
            alpha: 0,
            duration: AGI_EXEC_SLASH_DASH_FADE_MS,
            onComplete: () => { try { dash.destroy() } catch { } }
        })
    } catch { /* ignore */ }

    // 2) Slash “mark” at target (thicker, lingers so stacks are visible)
    try {
        const mark = sc.add.rectangle(tx, ty, AGI_EXEC_SLASH_MARK_LEN, AGI_EXEC_SLASH_MARK_THICK, AGI_EXEC_SLASH_MARK_COLOR, 0.95)
        try { (mark as any).setRotation?.(markAng) } catch { }
        try { (mark as any).setBlendMode?.(Phaser.BlendModes.ADD) } catch { }
        try { (mark as any).setDepth?.(999999) } catch { }

        // hold, then fade
        sc.time.delayedCall(Math.max(0, AGI_EXEC_SLASH_MARK_LIFE_MS - AGI_EXEC_SLASH_MARK_FADE_MS), () => {
            try {
                sc.tweens.add({
                    targets: mark,
                    alpha: 0,
                    duration: AGI_EXEC_SLASH_MARK_FADE_MS,
                    onComplete: () => { try { mark.destroy() } catch { } }
                })
            } catch { try { mark.destroy() } catch { } }
        })
    } catch { /* ignore */ }
}



function _agiSpawnExecuteFx(
    sc: Phaser.Scene,
    nativeHero: Phaser.GameObjects.Sprite,
    overlays: any,
    lastAdd: number,
    storedHits: number
): void {
    if (!sc) return
    const anyHero: any = nativeHero as any

    const add = Math.max(0, lastAdd | 0)
    if (add <= 0) return

    // Find destination (stored-hits counter). Fallback: above head.
    const counterNative = _findAgiStoredCounterNativeForHero((nativeHero as any).__arcadeSpriteRef, nativeHero)
        || _findAgiStoredCounterNativeForHero((anyHero.__arcadeSpriteRef as any), nativeHero)

    const destX = counterNative ? (counterNative.x || nativeHero.x) : (nativeHero.x || 0)
    const destY = counterNative ? (counterNative.y || nativeHero.y) : ((nativeHero.y || 0) - 28)

    // Collapse/disintegrate currently visible ghosts (fast fade + shrink)
    const gBg: any[] = overlays?.ghostsBg || []
    const gFg: any[] = overlays?.ghostsFg || []
    const allGhosts = ([] as any[]).concat(gBg, gFg)

    for (const g of allGhosts) {
        if (!g) continue
        if (!g.visible) continue
        try {
            sc.tweens.add({
                targets: g,
                alpha: 0,
                scaleX: 0.2,
                scaleY: 0.2,
                duration: 90,
                onComplete: () => {
                    try { g.setVisible(false) } catch { }
                    try { g.setAlpha(1) } catch { }
                    try { g.setScale(1, 1) } catch { }
                }
            })
        } catch { /* ignore */ }
    }

    // Fake "tick up" by driving the Phaser text directly (engine will be ignored visually during this moment)
    const start = Math.max(0, (storedHits | 0) - add)
    let display = start
    if (counterNative) _agiSetCounterText(counterNative, display)

    const srcX = (overlays.weaponFg?.x ?? nativeHero.x ?? 0)
    const srcY = (overlays.weaponFg?.y ?? nativeHero.y ?? 0)

    for (let i = 0; i < add; i++) {
        const delay = i * AGI_EXEC_STREAK_DT_MS

        try {
            sc.time.delayedCall(delay, () => {
                // guard: hero might be gone
                if (!nativeHero.scene) return

                // tiny “streak” sprite (rectangle) that flies to counter
                const r = sc.add.rectangle(srcX, srcY, AGI_EXEC_STREAK_SIZE, AGI_EXEC_STREAK_SIZE, 0xffffff, 1)
                try { (r as any).setBlendMode?.(Phaser.BlendModes.ADD) } catch { }
                try { (r as any).setDepth?.(((nativeHero as any).depth ?? 0) + 50) } catch { }

                sc.tweens.add({
                    targets: r,
                    x: destX,
                    y: destY,
                    duration: AGI_EXEC_STREAK_FLY_MS,
                    onComplete: () => {
                        try { r.destroy() } catch { }

                        // arrival = one “tick”
                        display++
                        if (counterNative) {
                            _agiSetCounterText(counterNative, display)
                            _agiBounceCounterNative(sc, counterNative)
                        }
                    }
                })
            })
        } catch { /* ignore */ }
    }
}



function _agiWeaponSheenStop(nativeHero: any, sc: any, weaponBg?: any, weaponFg?: any): void {
    if (!nativeHero) return
    if (!sc) return

    nativeHero.__agiSheenOn = 0

    const bg = weaponBg || nativeHero.__weaponBg
    const fg = weaponFg || nativeHero.__weaponFg

    try {
        if (bg) sc.tweens.killTweensOf(bg)
        if (fg) sc.tweens.killTweensOf(fg)
    } catch { /* ignore */ }

    try { if (bg && typeof bg.setBlendMode === "function") bg.setBlendMode(Phaser.BlendModes.NORMAL) } catch { }
    try { if (fg && typeof fg.setBlendMode === "function") fg.setBlendMode(Phaser.BlendModes.NORMAL) } catch { }

    try { if (bg && typeof bg.setAlpha === "function") bg.setAlpha(1) } catch { }
    try { if (fg && typeof fg.setAlpha === "function") fg.setAlpha(1) } catch { }
}

function _agiWeaponSheenStart(nativeHero: any, sc: any, weaponBg: any, weaponFg: any): void {
    if (!nativeHero) return
    if (!sc || !sc.tweens) return
    if (!weaponBg || !weaponFg) return

    if (nativeHero.__agiSheenOn) return
    nativeHero.__agiSheenOn = 1

    const isNpc = !!(
        nativeHero.getData?.("isNpc")
        || nativeHero.getData?.("npcLpc")
        || (nativeHero as any).__isNpc
        || (nativeHero as any).__npcLpc
    );
    const pulseMs = AGI_WPN_SHEEN_PULSE_MS * (isNpc ? 10 : 1);
    const alphaMin = isNpc ? 0.4 : AGI_WPN_SHEEN_ALPHA_MIN;

    // kill any leftovers (defensive)
    try { sc.tweens.killTweensOf(weaponBg) } catch { }
    try { sc.tweens.killTweensOf(weaponFg) } catch { }

    // Additive blend helps the “glint” read even without color changes
    try { weaponBg.setBlendMode(Phaser.BlendModes.ADD) } catch { }
    try { weaponFg.setBlendMode(Phaser.BlendModes.ADD) } catch { }

    try { weaponBg.setAlpha(AGI_WPN_SHEEN_ALPHA_MAX) } catch { }
    try { weaponFg.setAlpha(AGI_WPN_SHEEN_ALPHA_MAX) } catch { }

    try {
        sc.tweens.add({
            targets: weaponBg,
            alpha: { from: AGI_WPN_SHEEN_ALPHA_MAX, to: alphaMin },
            duration: pulseMs,
            yoyo: true,
            repeat: -1
        })
    } catch { /* ignore */ }

    try {
        sc.tweens.add({
            targets: weaponFg,
            alpha: { from: AGI_WPN_SHEEN_ALPHA_MAX, to: alphaMin },
            duration: pulseMs,
            yoyo: true,
            repeat: -1
        })
    } catch { /* ignore */ }
}


//End of agility section

// 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮 ────── 🪻 ────── 🔮  SECTION  🔮 ────── 🪻 ────── 🔮

// 🍁 ────── 🍂 ────── 🍁  SECTION  🍁 ────── 🍂 ────── 🍁 ────── 🍂 ────── 🍁 ────── 🍂 ────── 🍁  SECTION  🍁 ────── 🍂 ────── 🍁
//Beginning of main image section
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

// --------------------------------------------------------------
// MakeCode Arcade compat: Image.drawTransparentImage
// --------------------------------------------------------------

interface Image {
    drawTransparentImage(src: Image, x: number, y: number): void
}

(Image as any).prototype.drawTransparentImage = function (
    src: Image,
    x: number,
    y: number
): void {
    if (!this || !src) return

    const w = (src.width | 0)
    const h = (src.height | 0)
    const ox = x | 0
    const oy = y | 0

    for (let yy = 0; yy < h; yy++) {
        const ty = (oy + yy) | 0
        if (ty < 0 || ty >= this.height) continue
        for (let xx = 0; xx < w; xx++) {
            const tx = (ox + xx) | 0
            if (tx < 0 || tx >= this.width) continue
            const c = src.getPixel(xx, yy) | 0
            if (c) this.setPixel(tx, ty, c)
        }
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


//End of first image section

// 🍁 ────── 🍂 ────── 🍁  SECTION  🍁 ────── 🍂 ────── 🍁 ────── 🍂 ────── 🍁 ────── 🍂 ────── 🍁  SECTION  🍁 ────── 🍂 ────── 🍁


// 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥
// More constants / kinds / flags 

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
    export let Wall: number;
    export let ShopUI: number;
    export let ShopNpc: number;
    export let ShopItem: number;
    export let DecorTrigger: number;
    export let DecorSolid: number;

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
    
    private _x: number = 0;
    private _y: number = 0;
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

    get x(): number {
        return this._x;
    }

    set x(v: number) {
        this._setAxis("x", v);
    }

    get y(): number {
        return this._y;
    }

    set y(v: number) {
        this._setAxis("y", v);
    }

    private _setAxis(axis: "x" | "y", v: number): void {
        const oldVal = axis === "x" ? this._x : this._y;
        if (oldVal === v) return;
        if (DEBUG_ENEMY_POS_GUARD) _debugEnemyPosGuardOnSet(this, axis, oldVal, v);
        if (axis === "x") this._x = v;
        else this._y = v;
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

const ENEMY_POS_GUARD_ALLOWLIST: string[] = [
    "_physicsStep",
    "resolveEnemyTilemapCollisions",
    "resolveForEnemy",
    "_enemyHitRunEffects",
    "_enemyApplyAntiStuckSlide",
    "_resolveSpriteOverlap",
    "spawnEnemyOfKind",
    "spawnDummyEnemy",
    "setPosition",
    "netWorld.apply"
];

const ENEMY_POS_GUARD_LOG_LIMIT = 200;
let _enemyPosGuardLogCount = 0;
const _enemyPosGuardSeen = new Set<string>();

function _debugEnemyPosGuardPickFrame(stack: string): string {
    if (!stack) return "(no stack)";
    const lines = stack.split("\n").map((l) => l.trim());
    for (const line of lines) {
        if (!line) continue;
        if (line.includes("_debugEnemyPosGuardOnSet")) continue;
        if (line.includes("Sprite._setAxis")) continue;
        if (line.includes("Sprite.set x")) continue;
        if (line.includes("Sprite.set y")) continue;
        if (line.startsWith("Error")) continue;
        return line;
    }
    return lines[0] || "(no stack)";
}

function _debugEnemyPosGuardIsAllowed(stack: string): boolean {
    for (const allow of ENEMY_POS_GUARD_ALLOWLIST) {
        if (stack.includes(allow)) return true;
    }
    return false;
}

function _debugEnemyPosGuardOnSet(s: Sprite, axis: "x" | "y", fromVal: number, toVal: number): void {
    if (!DEBUG_ENEMY_POS_GUARD) return;
    if (!s || !s.data || !(s.data as any).__posGuardEnemy) return;

    const stack = (new Error("[ENEMY_POS_GUARD] stack")).stack || "";
    const frame = _debugEnemyPosGuardPickFrame(stack);
    const allowed = _debugEnemyPosGuardIsAllowed(stack);
    const key = `${axis}|${frame}`;

    if (!_enemyPosGuardSeen.has(key) && _enemyPosGuardLogCount < ENEMY_POS_GUARD_LOG_LIMIT) {
        _enemyPosGuardSeen.add(key);
        _enemyPosGuardLogCount++;
        console.log("[DEBUG][ENEMY_POS_GUARD]", {
            id: s.id,
            axis,
            from: fromVal,
            to: toVal,
            allowed,
            frame
        });
    }

    if (!allowed && DEBUG_ENEMY_POS_GUARD_THROW) {
        console.log(stack);
        throw new Error(`[ENEMY_POS_GUARD] ${axis} set by unregistered call site: ${frame}`);
    }
}


// 🍁 ────── 🍂 ────── 🍁  SECTION  🍁 ────── 🍂 ────── 🍁 ────── 🍂 ────── 🍁 ────── 🍂 ────── 🍁  SECTION  🍁 ────── 🍂 ────── 🍁


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







    // ---- EXTRA DEBUG FOR PIXEL SHAPES / AURAS / PROJECTILES ----

    // Master switch
    //const DEBUG_SPRITE_PIXELS = false;

    // Debug flags are defined in src/debugFlags.ts
    
    // Per-role log limits (so even when enabled, they don't spam forever)
    const ROLE_LOG_LIMITS: { [role: string]: number } = {
        HERO:       10,
        ENEMY:      10,
        PROJECTILE: 200,
        AURA:       200,
        ACTOR:      20,
        EFFECT:     100,
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
        if (kindName === "RelicEffect" || kindName.indexOf("Effect") >= 0) return "EFFECT";
        if (kindName === "HeroWeapon" || kindName.indexOf("Weapon") >= 0) return "PROJECTILE";
        if (kindName === "Player" || kindName === "Hero" || kindName === "NpcLpc") return "HERO";
        if (kindName.indexOf("Enemy") >= 0) return "ENEMY";

        // Use data flags as heuristics (engine-specific)
        if (dataKeys.indexOf(EFFECT_SKIN_DATA_KEY) >= 0 || dataKeys.indexOf("effectSkinId") >= 0) {
            return "EFFECT";
        }
        if (dataKeys.indexOf("npcLpc") >= 0) return "HERO";
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
            case "EFFECT":     enabled = DEBUG_ROLE_EFFECT;     break;
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


    
// 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥
// Intellect section within sprites namespace
// --- Projectile visual override (Phaser-side) ---------------------------------

const HERO_WEAPON_KIND_ID = 51;

// Try to discover FAMILY.INTELLECT from globalThis; fallback to 2 (your logs show family=2)
const INTELLECT_FAMILY_ID: number = (() => {
    const g: any = globalThis as any;
    const v = g?.FAMILY?.INTELLECT;
    return (typeof v === "number") ? (v | 0) : 2;
})();

// Optional: allow engine to override model later via sprite data (string).
const PROJ_PHASER_VISUAL_MODEL_KEY = "__phaserVisualModel"; // default "crystal"

// Internal bookkeeping on the Arcade sprite object (NOT sprite data)
const PROJ_PHASER_VISUAL_OBJ_KEY = "__phaserVisualObj";
const PROJ_PHASER_VISUAL_TEXKEY_KEY = "__phaserVisualTexKey";
const PROJ_PHASER_VISUAL_LOGGED_KEY = "__phaserVisualLogged";

let __projVisualTexKeyCache: { [modelLower: string]: string } = Object.create(null);
let __projVisualLoggedTextureKeysOnce = false;


// --- Intellect pulse gating (event overlap -> pulse window) -------------------

const INT_PULSE_PERIOD_MS_KEY = "__intPulsePeriodMs";          // settable; default below if missing
const INT_PULSE_NEXT_AT_MS_KEY = "__intPulseNextAtMs";          // internal
const INT_PULSE_WINDOW_END_MS_KEY = "__intPulseWindowEndMs";    // internal
const INT_PULSE_HIT_MASK_KEY = "__intPulseHitMask";             // internal

const INT_PULSE_DEFAULT_PERIOD_MS = 250;  // tweak (or write from your "Time" axis)
const INT_PULSE_WINDOW_MS = 70;           // short window so multiple enemies can be hit in same pulse


function _pickTextureKeyForModel(sc: Phaser.Scene, modelLower: string): string {
    const cached = __projVisualTexKeyCache[modelLower];
    if (cached !== undefined) return cached;

    const keys: string[] = (sc.textures && (sc.textures as any).getTextureKeys)
        ? (sc.textures as any).getTextureKeys()
        : [];

    const m = modelLower.toLowerCase();

    // Prefer keys that contain the model; bias toward weapon-ish names
    const hits = keys.filter(k => (k || "").toLowerCase().includes(m));
    const pick = (() => {
        if (!hits.length) return "";
        const prefer = hits.find(k => {
            const kl = (k || "").toLowerCase();
            return (kl.includes("weapon") || kl.includes("weap")) && (kl.includes("thrust") || kl.includes("cast") || kl.includes("proj"));
        });
        return prefer || hits[0];
    })();

    __projVisualTexKeyCache[modelLower] = pick; // cache empty too (prevents re-scan)
    return pick;
}

function _attachEnsureIntellectProjectileVisual(ctx: AttachContext): void {
    const s: any = ctx.s as any;
    const native: any = (s as any).native;

    // Only HeroWeapon projectiles (kind 51 in your logs)
    if ((s.kind | 0) !== HERO_WEAPON_KIND_ID) return;

    // If destroyed, clean up any Phaser visual we made (even if data keys are gone)
    if ((s.flags & ((sprites.Flag as any).Destroyed | 0)) && s[PROJ_PHASER_VISUAL_OBJ_KEY]) {
        try { s[PROJ_PHASER_VISUAL_OBJ_KEY].destroy?.(); } catch { }
        s[PROJ_PHASER_VISUAL_OBJ_KEY] = null;
        return;
    }

    // Opt-in marker: only projectiles that explicitly publish a model get overridden
    const modelRaw = (_readDataString0(ctx.s, PROJ_PHASER_VISUAL_MODEL_KEY, "") || "").trim();
    if (!modelRaw) return;

    const modelLower = modelRaw.toLowerCase();

    // One-time: dump texture keys that look relevant (helps confirm what Phaser loaded)
    if (!__projVisualLoggedTextureKeysOnce) {
        __projVisualLoggedTextureKeysOnce = true;
        try {
            const keys: string[] = (ctx.sc.textures as any).getTextureKeys?.() || [];
            const sample = keys.filter(k => {
                const kl = (k || "").toLowerCase();
                return kl.includes("weapon") || kl.includes("weap") || kl.includes("crystal");
            }).slice(0, 30);
            console.log("[ATTACH][PROJ][VIS] texture keys sample:", sample);
        } catch { }
    }

    const texKey = _pickTextureKeyForModel(ctx.sc, modelLower);

    // If we can't find a texture, don't hide the base (avoid invisible projectile).
    if (!texKey) {
        if (!s[PROJ_PHASER_VISUAL_LOGGED_KEY]) {
            s[PROJ_PHASER_VISUAL_LOGGED_KEY] = true;
            console.log("[ATTACH][PROJ][VIS] NO textureKey found for model=", modelLower, "→ leaving base visible");
        }
        return;
    }

    s[PROJ_PHASER_VISUAL_TEXKEY_KEY] = texKey;

    // Create Phaser-side visual if missing
    let vis: any = s[PROJ_PHASER_VISUAL_OBJ_KEY];
    if (!vis || !vis.active) {
        try {
            vis = ctx.sc.add.sprite(s.x, s.y, texKey);
            vis.setScrollFactor?.(1, 1);
            s[PROJ_PHASER_VISUAL_OBJ_KEY] = vis;

            if (!s[PROJ_PHASER_VISUAL_LOGGED_KEY]) {
                s[PROJ_PHASER_VISUAL_LOGGED_KEY] = true;
                console.log("[ATTACH][PROJ][VIS] created",
                    "| id", (s.id | 0),
                    "| model", modelLower,
                    "| texKey", texKey
                );
                // Replacement visuals are authoritative; hide the MakeCode placeholder art.
                if (native && typeof (native as any).setVisible === "function") {
                (native as any).__heHiddenByReplacement = true;
                native.setVisible(false);
                if (typeof (native as any).setAlpha === "function") native.setAlpha(0);
                }

            }
        } catch (e) {
            if (!s[PROJ_PHASER_VISUAL_LOGGED_KEY]) {
                s[PROJ_PHASER_VISUAL_LOGGED_KEY] = true;
                console.log("[ATTACH][PROJ][VIS] FAILED create sprite", e);
            }
            return;
        }
    }

    // Keep visual glued to Arcade sprite position
    vis.x = s.x;
    vis.y = s.y;

    // Match depth to base native if present
    const n: any = s.native;
    if (n && typeof n.depth === "number" && vis.setDepth) vis.setDepth(n.depth);

    // Hide base native bitmap ONLY after we have a valid Phaser visual
    if (n) {
        try { n.setAlpha?.(0); } catch { n.alpha = 0; }
        try { n.setVisible?.(false); } catch { n.visible = false; }
    }
}

// End of intellect section within sprites namespace
// 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥 ────── 🏮 ────── 🔥  SECTION  🔥 ────── 🏮 ────── 🔥

// 🌕 ────── ✨ ────── 🌕  SECTION  🌕 ────── ✨ ────── 🌕 ────── ✨ ────── 🌕 ────── ✨ ────── 🌕  SECTION  🌕 ────── ✨ ────── 🌕

// Mirror hero identity + phase/dir from the Arcade Sprite onto the Phaser native sprite.
// Also mirrors the NEW universal Action/Phase/Event timeline keys (human-readable).
// Mirror hero identity + phase/dir from the Arcade Sprite onto the Phaser native sprite.
// Also mirrors the NEW universal Action/Phase/Event timeline keys (human-readable).
function _copyHeroIdentityToNative(
    s: Sprite,
    native: Phaser.GameObjects.Sprite
): void {
    const dataAny: any = (s as any).data || {};

    const readInt = (v: any, def: number): number => {
        if (typeof v === "number" && Number.isFinite(v)) return v | 0;
        if (typeof v === "string") {
            const n = parseInt(v, 10);
            if (Number.isFinite(n)) return n | 0;
        }
        return def | 0;
    };

    const readStr = (v: any, def: string): string => (typeof v === "string") ? v : def;
    const readBool = (v: any, def: boolean): boolean => {
        if (typeof v === "boolean") return v;
        if (typeof v === "number") return !!v;
        if (typeof v === "string") return v === "1" || v.toLowerCase() === "true";
        return def;
    };

    // ------------------------
    // Legacy identity
    // ------------------------
    const heroNameRaw = dataAny.heroName;
    const heroFamilyRaw = dataAny.heroFamily;
    const phaseRaw = dataAny.phase;
    const dirRaw = dataAny.dir;

    const heroName = (typeof heroNameRaw === "string" && heroNameRaw) ? heroNameRaw : "";
    native.setData("heroName", heroName);

    const heroFamily = (typeof heroFamilyRaw === "string" && heroFamilyRaw) ? heroFamilyRaw : "";
    native.setData("heroFamily", heroFamily);

    const phase = (typeof phaseRaw === "string" && phaseRaw) ? phaseRaw : "idle";
    const dir = (typeof dirRaw === "string" && dirRaw) ? dirRaw : "down";
    native.setData("phase", phase);
    native.setData("dir", dir);
    native.setData("aimDx", readInt(dataAny.aimDx, 0));
    native.setData("aimDy", readInt(dataAny.aimDy, 0));
    native.setData("aimAng", readInt(dataAny.aimAng, 0));

    const fco = readInt(dataAny.frameColOverride, -1);
    native.setData("frameColOverride", fco);

    // ------------------------
    // NPC flags (so glue can identify NPCs without hero arrays)
    // ------------------------
    const isEnemyLpc = readBool(dataAny.enemyLpc, false);
    const isNpc = readBool(dataAny.isNpc, false) || readBool(dataAny.npcLpc, false) || isEnemyLpc;
    native.setData("isNpc", isNpc);
    native.setData("npcLpc", readBool(dataAny.npcLpc, false));
    native.setData("enemyLpc", isEnemyLpc);
    const npcRole = readStr(dataAny._npcRole, "");
    if (npcRole) native.setData("_npcRole", npcRole);
    if (DEBUG_NPC_PIPELINE && isNpc) {
        const already = native.getData ? native.getData(NPC_PIPE_COMPAT_LOG_ONCE_KEY) : 0;
        if (!already) {
            try { native.setData?.(NPC_PIPE_COMPAT_LOG_ONCE_KEY, 1); } catch { /* ignore */ }
            console.log("[NPC-PIPE][compat.identity]", {
                arcadeSpriteId: (s as any)?.id ?? 0,
                heroName,
                heroFamily,
                phase,
                dir,
                frameColOverride: fco,
                npcRole
            });
        }
    }

    // ------------------------
    // Universal Action keys
    // ------------------------
    native.setData("ActionSequence", readInt(dataAny.ActionSequence, 0));
    native.setData("ActionKind", readStr(dataAny.ActionKind, "none"));
    native.setData("ActionVariant", readInt(dataAny.ActionVariant, 0));
    native.setData("ActionSeed", readInt(dataAny.ActionSeed, 0));
    native.setData("ActionP0", readInt(dataAny.ActionP0, 0));
    native.setData("ActionP1", readInt(dataAny.ActionP1, 0));
    native.setData("ActionP2", readInt(dataAny.ActionP2, 0));
    native.setData("ActionP3", readInt(dataAny.ActionP3, 0));
    native.setData("ActionTargetId", readInt(dataAny.ActionTargetId, 0));

    // ------------------------
    // Universal Phase keys
    // ------------------------
    const phaseName = readStr(dataAny.PhaseName, phase);
    native.setData("PhaseName", phaseName);
    native.setData("PhaseStartMs", readInt(dataAny.PhaseStartMs, 0));
    native.setData("PhaseDurationMs", readInt(dataAny.PhaseDurationMs, 0));
    native.setData("PhaseFlags", readInt(dataAny.PhaseFlags, 0));
    native.setData("PhaseProgressInt", readInt(dataAny.PhaseProgressInt, 0));

    // ------------------------
    // Universal PhasePart keys
    // ------------------------
    const ppName = readStr(dataAny.PhasePartName, "");
    const ppStart = readInt(dataAny.PhasePartStartMs, 0);
    const ppDur = readInt(dataAny.PhasePartDurationMs, 0);
    const ppProg = readInt(
        (dataAny.PhasePartProgressInt !== undefined) ? dataAny.PhasePartProgressInt : dataAny.PhasePartProgress,
        0
    );

    native.setData("PhasePartName", ppName);
    native.setData("PhasePartStartMs", ppStart);
    native.setData("PhasePartDurationMs", ppDur);
    native.setData("PhasePartProgressInt", ppProg);

    // IMPORTANT ALIASES (to match older glue expectations)
    native.setData("PhasePart", ppName);
    native.setData("phasePart", ppName);
    native.setData("PhasePartProgress", ppProg);
    native.setData("phasePartProgress", ppProg);

    // ------------------------
    // Event keys
    // ------------------------
    native.setData("EventSequence", readInt(dataAny.EventSequence, 0));
    native.setData("EventMask", readInt(dataAny.EventMask, 0));

    // ------------------------
    // Weapon display controls
    // ------------------------
    native.setData("wAlw", readInt(dataAny.wAlw, 0));
    native.setData("wpnOx", readInt(dataAny.wpnOx, 0));
    native.setData("wpnOy", readInt(dataAny.wpnOy, 0));
}




// Try to apply hero animation for a hero-native sprite.
// - Only runs if heroAtlas is present in the scene registry.
// - Only calls glue when phase/dir changed since last sync (or first time).
function _tryApplyHeroAnimationForNative(s: Sprite, native: Phaser.GameObjects.Sprite): void {
    // Cache keys stored on the native Phaser sprite (do NOT collide with Arcade sprite data)
    const LAST_HERO_NAME_KEY = "__lastHeroName";
    const LAST_HERO_FAMILY_KEY = "__lastHeroFamily";
    const LAST_PHASE_NAME_KEY = "__lastHeroPhaseName";
    const LAST_DIR_KEY = "__lastHeroDir";
    const LAST_FRAME_COL_OVERRIDE_KEY = "__lastHeroFrameColOverride";
    const LAST_ACTION_KIND_KEY = "__lastHeroActionKind";
    const LAST_PHASE_PROGRESS_INT_KEY = "__lastHeroPhaseProgressInt";
    const LAST_PHASE_PART_NAME_KEY = "__lastHeroPhasePartName";
    const LAST_PHASE_PART_START_MS_KEY = "__lastHeroPhasePartStartMs";
    const LAST_PHASE_PART_DURATION_MS_KEY = "__lastHeroPhasePartDurationMs";
    const LAST_PHASE_PART_PROGRESS_INT_KEY = "__lastHeroPhasePartProgressInt";

    // Current identity/state (should already have been copied via _copyHeroIdentityToNative)
    const heroName = (native.getData("heroName") as string | undefined) || "";
    const heroFamily = (native.getData("heroFamily") as string | undefined) || "";

    // IMPORTANT: gate off the *universal* phase name, not just legacy "phase"
    const phaseName = (native.getData("PhaseName") as string | undefined) || (native.getData("phase") as string | undefined) || "idle";
    const dir = (native.getData("dir") as string | undefined) || "down";

    const fco = (native.getData("frameColOverride") as number | undefined);
    const frameColOverride = (typeof fco === "number" && Number.isFinite(fco)) ? (fco | 0) : -1;

    // These are what drive “cast-part” behavior while the phase stays constant
    const actionKind = (native.getData("ActionKind") as string | undefined) || "none";
    const phaseProgressInt = (native.getData("PhaseProgressInt") as number | undefined) | 0;

    const phasePartName = (native.getData("PhasePartName") as string | undefined) || "";
    const phasePartStartMs = (native.getData("PhasePartStartMs") as number | undefined) | 0;
    const phasePartDurationMs = (native.getData("PhasePartDurationMs") as number | undefined) | 0;
    const phasePartProgressInt = (native.getData("PhasePartProgressInt") as number | undefined) | 0;

    // Last applied
    const lastHeroName = (native.getData(LAST_HERO_NAME_KEY) as string | undefined) || "";
    const lastHeroFamily = (native.getData(LAST_HERO_FAMILY_KEY) as string | undefined) || "";
    const lastPhaseName = (native.getData(LAST_PHASE_NAME_KEY) as string | undefined) || "";
    const lastDir = (native.getData(LAST_DIR_KEY) as string | undefined) || "";
    const lastFco = (native.getData(LAST_FRAME_COL_OVERRIDE_KEY) as number | undefined);
    const lastFrameColOverride = (typeof lastFco === "number" && Number.isFinite(lastFco)) ? (lastFco | 0) : -1;

    const lastActionKind = (native.getData(LAST_ACTION_KIND_KEY) as string | undefined) || "none";
    const lastPhaseProgressInt = ((native.getData(LAST_PHASE_PROGRESS_INT_KEY) as number | undefined) ?? 0) | 0;

    const lastPhasePartName = (native.getData(LAST_PHASE_PART_NAME_KEY) as string | undefined) || "";
    const lastPhasePartStartMs = ((native.getData(LAST_PHASE_PART_START_MS_KEY) as number | undefined) ?? 0) | 0;
    const lastPhasePartDurationMs = ((native.getData(LAST_PHASE_PART_DURATION_MS_KEY) as number | undefined) ?? 0) | 0;
    const lastPhasePartProgressInt = ((native.getData(LAST_PHASE_PART_PROGRESS_INT_KEY) as number | undefined) ?? 0) | 0;

    // If nothing relevant changed, don't re-apply
    if (
        heroName === lastHeroName &&
        heroFamily === lastHeroFamily &&
        phaseName === lastPhaseName &&
        dir === lastDir &&
        frameColOverride === lastFrameColOverride &&
        actionKind === lastActionKind &&
        phaseProgressInt === lastPhaseProgressInt &&
        phasePartName === lastPhasePartName &&
        phasePartStartMs === lastPhasePartStartMs &&
        phasePartDurationMs === lastPhasePartDurationMs &&
        phasePartProgressInt === lastPhasePartProgressInt
    ) {
        return;
    }

    // Update cache first so recursive paths don't thrash
    native.setData(LAST_HERO_NAME_KEY, heroName);
    native.setData(LAST_HERO_FAMILY_KEY, heroFamily);
    native.setData(LAST_PHASE_NAME_KEY, phaseName);
    native.setData(LAST_DIR_KEY, dir);
    native.setData(LAST_FRAME_COL_OVERRIDE_KEY, frameColOverride);

    native.setData(LAST_ACTION_KIND_KEY, actionKind);
    native.setData(LAST_PHASE_PROGRESS_INT_KEY, phaseProgressInt);

    native.setData(LAST_PHASE_PART_NAME_KEY, phasePartName);
    native.setData(LAST_PHASE_PART_START_MS_KEY, phasePartStartMs);
    native.setData(LAST_PHASE_PART_DURATION_MS_KEY, phasePartDurationMs);
    native.setData(LAST_PHASE_PART_PROGRESS_INT_KEY, phasePartProgressInt);

    // Apply (heroAnimGlue)
    try {
        heroAnimGlue.tryApplyHeroAnimation(native);
    } catch (e) {
        console.log("[arcadeCompat] _tryApplyHeroAnimationForNative ERROR", e, {
            heroName,
            heroFamily,
            phaseName,
            dir,
            frameColOverride,
            actionKind,
            phaseProgressInt,
            phasePartName,
            phasePartStartMs,
            phasePartDurationMs,
            phasePartProgressInt
        });
    }
}



function _spriteDataReadString(s: any, key: string): string {
    if (!s) return "";

    const d: any = (s as any).data;
    if (!d) return "";

    // Map / DataBag style
    try {
        if (typeof d.get === "function") {
            const v = d.get(key);
            return (typeof v === "string") ? v : "";
        }
    } catch { /* ignore */ }

    // PXT-style internal storage
    try {
        if (d._data && typeof d._data[key] === "string") return d._data[key];
    } catch { /* ignore */ }

    // Plain object style
    try {
        const v = d[key];
        return (typeof v === "string") ? v : "";
    } catch { /* ignore */ }

    return "";
}

function _spriteDataReadNumber(s: any, key: string): number {
    if (!s) return 0;

    const d: any = (s as any).data;
    if (!d) return 0;

    try {
        if (typeof d.get === "function") {
            const v = d.get(key);
            return (typeof v === "number") ? (v | 0) : 0;
        }
    } catch { }

    try {
        if (d._data && typeof d._data[key] === "number") return d._data[key] | 0;
    } catch { }

    try {
        const v = d[key];
        return (typeof v === "number") ? (v | 0) : 0;
    } catch { }

    return 0;
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

    // DEBUG: one-time attach classification for projectiles
    if (DEBUG_SPRITE_ATTACH && (ctx.s as any).kind === 51 && !(ctx.s as any).__loggedAttachProj) {
        (ctx.s as any).__loggedAttachProj = true;
        const dataKeys = Object.keys(((ctx.s as any).data) || {});
        console.log("[ATTACH][PROJ] begin",
            "| id", (ctx.s as any).id,
            "| kind", (ctx.s as any).kind,
            "| flags", ((ctx.s as any).flags | 0),
            "| dataKeys", dataKeys
        );
    }

    // If we've already attached a UI-managed native (Container), early-out.
    if (_attachUiEarlyUpdateIfExisting(ctx)) {
        if (DEBUG_SPRITE_ATTACH && (ctx.s as any).kind === 51 && !(ctx.s as any).__loggedAttachProjEarlyOut) {
            (ctx.s as any).__loggedAttachProjEarlyOut = true;
            console.log("[ATTACH][PROJ] early-out: existing UI native",
                "| id", (ctx.s as any).id
            );
        }
        return;
    }

    // Create UI natives (NO pixel upload)
    if (_attachCreateStatusBar(ctx, ui)) return;
    if (_attachCreateComboMeter(ctx, ui)) return;
    if (_attachCreateAgiAimIndicator(ctx, ui)) return;
    if (_attachCreateText(ctx, ui)) return;

    // Step 5+ work lives here for now (unchanged legacy body)
    _attachNativeSpriteNonUiPath(ctx.sc, ctx.s, ctx.g, ctx.tA0);

    // NEW: Intellect projectile visual override (crystal) + hide base bitmap
    _attachEnsureIntellectProjectileVisual(ctx);

    // DEBUG: post-create snapshot for projectile
    if (DEBUG_SPRITE_ATTACH && (ctx.s as any).kind === 51 && (ctx.s as any).native && !(ctx.s as any).__loggedAttachProjAfter) {
        (ctx.s as any).__loggedAttachProjAfter = true;
        const n: any = (ctx.s as any).native;
        const sfx = n.scrollFactorX ?? 1;
        const sfy = n.scrollFactorY ?? 1;
        console.log("[ATTACH][PROJ] after non-ui attach",
            "| id", (ctx.s as any).id,
            "| nativeType", (n && n.type) ? n.type : "",
            "| tex", n.texture?.key ?? "",
            "| frame", n.frame?.name ?? "",
            "| depth", n.depth ?? 0,
            "| scrollFactor", sfx, sfy
        );
    }
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
        shouldLog: (DEBUG_SPRITE_ATTACH && _attachCallCount <= MAX_ATTACH_VERBOSE),
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

    // Flash overlay (visible only when flashOverlayUntil is set on the sprite)
    const flashRect = sc.add.rectangle(0, 0, barW, barH, onHex, 1);
    flashRect.setOrigin(0.5, 0.5);
    flashRect.setVisible(false);

    // IMPORTANT: initialize fill width based on current/max (prevents “full red forever”)
    const cur = (sb.current | 0);
    const max = Math.max(1, (sb.max | 0));
    const pct = Math.max(0, Math.min(1, cur / max));
    fillRect.width = Math.floor(innerW * pct);

    container.add(borderRect);
    container.add(bgRect);
    container.add(fillRect);
    container.add(flashRect);

    (container as any).setData("sb_border", borderRect);
    (container as any).setData("sb_bg", bgRect);
    (container as any).setData("sb_fill", fillRect);
    (container as any).setData("sb_flash", flashRect);

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



// Decor collider sprites must NEVER create/upload native textures.
// Engine marks these via sprites.setDataNumber(s, "decorCollider", 1).
const DECOR_COLLIDER_DATA_KEY = "decorCollider";
const DECOR_SKIP_NATIVE_KEY = "__decorSkipNative";

function _attachDecorSkipPath(ctx: AttachContext): boolean {
    const s = ctx.s;
    const d: any = ctx.dataAny || {};

    // Primary signal: explicit data marker
    const marked = !!d[DECOR_COLLIDER_DATA_KEY] || !!d[DECOR_SKIP_NATIVE_KEY];

    // Secondary signal: kind check (safe even if kinds don't exist yet)
    let kindIsDecor = false;
    try {
        const kind = ((s.kind as any) | 0);
        const kTrig = (((SpriteKind as any).DecorTrigger as any) | 0);
        const kSol  = (((SpriteKind as any).DecorSolid as any) | 0);
        kindIsDecor = (kind === kTrig) || (kind === kSol);
    } catch { /* ignore */ }

    if (!marked && !kindIsDecor) return false;

    // If a native somehow existed (old runs), destroy it so nothing renders.
    if ((s as any).native) {
        try { ((s as any).native as any).destroy(); } catch { /* ignore */ }
        (s as any).native = undefined as any;
    }

    // Treat as a safe intentional early-out (no textures, no pixels).
    _attachFinalizeEarlyOutOnly(ctx);
    return true;
}

// Effect sprites use Phaser textures directly; skip Arcade pixel upload/placeholder textures.
function _attachEffectSpriteNonUiPath(ctx: AttachContext): boolean {
    const s = ctx.s;
    const sc = ctx.sc;
    const dataAny: any = ctx.dataAny || {};
    const dataKeys = Object.keys(dataAny);
    const role = _classifySpriteRole((s.kind as any) | 0, dataKeys);
    if (role !== "EFFECT") return false;

    const skinRaw =
        (sprites.readDataString(s, EFFECT_SKIN_DATA_KEY) || "") ||
        (typeof dataAny[EFFECT_SKIN_DATA_KEY] === "string" ? dataAny[EFFECT_SKIN_DATA_KEY] : "") ||
        (typeof dataAny.effectSkinId === "string" ? dataAny.effectSkinId : "");
    const skin = String(skinRaw || "").trim();
    if (!skin) return false;

    const dirRaw =
        (sprites.readDataString(s, EFFECT_DIR_DATA_KEY) || "") ||
        (typeof dataAny[EFFECT_DIR_DATA_KEY] === "string" ? dataAny[EFFECT_DIR_DATA_KEY] : "");
    const dir = String(dirRaw || "").trim();

    const atlas = _getEffectAtlasFromScene(sc);
    const resolved = _resolveEffectAtlasEntry(atlas, skin, dir);
    const texKey = resolved && typeof resolved.textureKey === "string" ? resolved.textureKey : "";
    const frames = resolved && Array.isArray(resolved.frameIndices) ? resolved.frameIndices : null;
    const frame0 = (frames && frames.length > 0) ? frames[0] : undefined;
    const texReady = !!(texKey && sc.textures && sc.textures.exists(texKey));

    let native: any = (s as any).native;
    let didCreate = false;

    if (native && (native as any).destroyed) {
        try { native.destroy(); } catch { /* ignore */ }
        native = undefined;
        (s as any).native = undefined;
    }
    if (native && (!native.anims || typeof native.play !== "function")) {
        try { native.destroy(); } catch { /* ignore */ }
        native = undefined;
        (s as any).native = undefined;
    }

    if (!native) {
        const useKey = texReady ? texKey : _ensureEffectBlankTexture(sc);
        const useFrame = texReady ? frame0 : undefined;
        const n = sc.add.sprite(s.x, s.y, useKey, useFrame as any);
        n.setOrigin(0.5, 0.5);
        s.native = n;
        native = n;
        didCreate = true;
    } else {
        native.setPosition(s.x, s.y);
    }

    if (texReady) {
        try {
            const curKey = native.texture?.key;
            if (curKey !== texKey) {
                native.setTexture(texKey, frame0 as any);
                if (native.anims && native.anims.isPlaying) native.anims.stop();
            }
        } catch { /* ignore */ }
    }

    try { (s as any)._lastNonZeroPixels = 1; } catch { /* ignore */ }

    if (didCreate) _attachFinalizeCreate(ctx);
    else _attachFinalizeUpdate(ctx);

    return true;
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
        shouldLog: (DEBUG_SPRITE_ATTACH && _attachCallCount <= MAX_ATTACH_VERBOSE),
        dataAny: (s as any).data || {},
    };

    // NEW: decor collider sprites are logic-only (never attach/upload/render).
    if (_attachDecorSkipPath(ctx)) return;
    if (_attachEffectSpriteNonUiPath(ctx)) return;

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

    const src = tex.source[0];
    const texW = (src.width | 0);
    const texH = (src.height | 0);
    const offX = Math.max(0, Math.idiv((texW - (w | 0)), 2) | 0);
    const offY = Math.max(0, Math.idiv((texH - (h | 0)), 2) | 0);

    ctx2d.clearRect(0, 0, texW, texH);

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

    ctx2d.putImageData(imgData, offX, offY);
    tex.refresh();

    const tPix1 = _hostPerfNowMs();
    const dPix = (tPix1 - tPix0);

    _frameAttachPixelMs += dPix;
    _frameGroupAttachPixelMs[g] += dPix;

    return nonZero;
}





function _attachDestroyNativeIfWrongSize(ctx: AttachContext, w: number, h: number): void {
    const s = ctx.s;
    const dataAny: any = ctx.dataAny || (s as any).data || {};
    const role = _classifySpriteRole((s.kind as any) | 0, Object.keys((s as any).data || {}));
    if (role === "EFFECT" || dataAny[EFFECT_SKIN_DATA_KEY] || dataAny.effectSkinId) {
        return;
    }

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
    const dataAny: any = ctx.dataAny || {};
    const readInt = (v: any, def: number): number => {
        if (typeof v === "number" && Number.isFinite(v)) return v | 0;
        if (typeof v === "string") {
            const n = parseInt(v, 10);
            if (Number.isFinite(n)) return n | 0;
        }
        return def | 0;
    };

    let native: any = s.native;
    let didCreate = false;

    const role = _classifySpriteRole((kind as number) || 0, Object.keys((s as any).data || {}));
    const wantsSprite = (role === "ENEMY" || role === "ACTOR" || role === "EFFECT");

    if (native && wantsSprite) {
        const hasAnims = typeof native.play === "function" || !!native.anims;
        if (!hasAnims) {
            try { native.destroy(); } catch { /* ignore */ }
            s.native = undefined as any;
            native = undefined;
        }
    }

    if (!native) {
        const isEnemyLike = (role === "ENEMY" || role === "ACTOR");
        const offX = isEnemyLike ? readInt(dataAny.renderOffsX, 0) : 0;
        const offY = isEnemyLike ? readInt(dataAny.renderOffsY, 0) : 0;

        const n = wantsSprite
            ? sc.add.sprite(s.x + offX, s.y + offY, texKey)
            : sc.add.image(s.x, s.y, texKey);

        n.setOrigin(0.5, 0.5);
        s.native = n;
        native = n;
        didCreate = true;

        if (DEBUG_SPRITE_ATTACH && _attachCallCount <= MAX_ATTACH_VERBOSE) {
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
        if (role === "ENEMY" || role === "ACTOR") {
            const offX = readInt(dataAny.renderOffsX, 0);
            const offY = readInt(dataAny.renderOffsY, 0);
            native.setPosition(s.x + offX, s.y + offY);
        } else {
            native.setPosition(s.x, s.y);
        }
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



// --------------------------------------------------------------
// HERO RENDER ANCHOR (Phaser hero-native)
// Arcade sprite x/y are CENTER of the collider image (usually 16x16).
// We render the 64x64 hero so that the collider represents FEET.
// --------------------------------------------------------------

// --------------------------------------------------------------
// HERO RENDER ↔ COLLIDER ALIGNMENT (64x64 render, 16x16 collider)
// --------------------------------------------------------------
const HERO_NATIVE_ORIGIN_X = 0.5;
const HERO_NATIVE_ORIGIN_Y = 0.5; // bottom-center

// Tune: how much to move the 64x64 render UP from the collider-feet point.
// Bigger = render higher. Smaller/negative = render lower.
const HERO_NATIVE_FEET_LIFT_PX = 0;

// Optional debug
// DEBUG_HERO_NATIVE_FEET_ANCHOR flag is defined in src/debugFlags.ts


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
    const dataAny: any = (s as any).data || {};

    const readInt = (v: any, def: number): number => {
        if (typeof v === "number" && Number.isFinite(v)) return v | 0;
        if (typeof v === "string") {
            const n = parseInt(v, 10);
            if (Number.isFinite(n)) return n | 0;
        }
        return def | 0;
    };

    // OLD behavior: hero detection via isHeroSprite(s)
    const isHero = (() => {
        try { return !!(isHeroSprite as any)(s); } catch { return false; }
    })();

    if (!isHero) return false;

    // Arcade uses x/y as CENTER of its collider image (typically 16x16).
    // "Feet point" = bottom of collider = y + (colliderH/2).
    // Phaser native hero is anchored bottom-center (originY=1).
    const colliderH = ((s.image?.height ?? 16) | 0);
    const feetOffY = (colliderH >> 1); // half height from center -> bottom
    const renderOffsY = readInt(dataAny.renderOffsY, 0);
    const nx = s.x;
    const ny = (s.y + feetOffY - HERO_NATIVE_FEET_LIFT_PX - renderOffsY);

    // Pick a REAL, preloaded hero spritesheet texture key to use for the native sprite.
    // Priority:
    //   1) If we already have heroAtlas + heroName+family, use that set.textureKey (correct hero immediately).
    //   2) Else, use the first parsed hero sheet textureKey (deterministic fallback).
    // If neither exists, we hard-fail because the pipeline invariant was broken (preloadHeroSheets not run).
    const pickBootHeroTexKey = (): string => {
        const heroName = (typeof dataAny.heroName === "string") ? dataAny.heroName : "";
        const heroFamily = (typeof dataAny.heroFamily === "string") ? dataAny.heroFamily : "";

        // 1) Try to resolve the correct hero texture from the heroAtlas
        try {
            const atlas: any = sc.registry ? sc.registry.get("heroAtlas") : null;
            if (atlas && heroName && heroFamily) {
                const famLower = String(heroFamily).toLowerCase();
                const famAliases =
                    famLower === "wisdom" ? ["wisdom", "support"] :
                    famLower === "support" ? ["support", "wisdom"] :
                    [famLower];

                for (const fam of famAliases) {
                    for (const set of Object.values(atlas) as any[]) {
                        if (!set) continue;
                        if (set.heroName === heroName && String(set.family).toLowerCase() === fam) {
                            if (set.textureKey && sc.textures.exists(set.textureKey)) {
                                return String(set.textureKey);
                            }
                        }
                    }
                }
            }
        } catch { /* ignore */ }

        // 2) Deterministic fallback: first parsed hero sheet from preloadHeroSheets
        try {
            const parsed = (sc.registry ? sc.registry.get("__heroParsedSheets") : null) as any[] | null;
            if (parsed && parsed.length > 0) {
                const tk = parsed[0] && parsed[0].textureKey ? String(parsed[0].textureKey) : "";
                if (tk && sc.textures.exists(tk)) return tk;
            }
        } catch { /* ignore */ }

        throw new Error(
            "[HERO-NATIVE-BOOT] No preloaded hero spritesheet texture available. " +
            "Did you call preloadHeroSheets(scene) in preload() and let Phaser finish loading before tick?"
        );
    };

    let native: any = (s as any).native;
    if (native && (!native.anims || typeof native.anims.play !== "function")) {
        if (DEBUG_NPC_PIPELINE) {
            try {
                console.log("[NPC-PIPE][compat.upgrade_native]", {
                    arcadeSpriteId: (s as any)?.id ?? 0,
                    hadNative: true,
                    reason: "native has no anims; replacing with hero-native sprite"
                });
            } catch { /* ignore */ }
        }
        try { native.destroy(); } catch { /* ignore */ }
        native = null;
        (s as any).native = null;
    }

    if (!native) {
        const bootTexKey = pickBootHeroTexKey();

        native = sc.add.sprite(nx, ny, bootTexKey, 0);
        try { native.setOrigin(HERO_NATIVE_ORIGIN_X, HERO_NATIVE_ORIGIN_Y); } catch { /* ignore */ }
        try { native.setData("isHeroNative", true); } catch { /* ignore */ }

        if (DEBUG_HERO_NATIVE_FEET_ANCHOR && _attachCallCount <= MAX_ATTACH_VERBOSE) {
            try {
                console.log(
                    "[HERO-FEET-ANCHOR] create",
                    "| id", s.id,
                    "| arcadeXY", s.x, s.y,
                    "| colliderH", colliderH,
                    "| feetOffY", feetOffY,
                    "| liftPx", HERO_NATIVE_FEET_LIFT_PX,
                    "| renderOffsY", renderOffsY,
                    "| nativeXY", nx, ny,
                    "| origin", HERO_NATIVE_ORIGIN_X, HERO_NATIVE_ORIGIN_Y
                );
            } catch { /* ignore */ }
        }

        // Copy identity + attempt to apply correct hero animation immediately.
        try { (_copyHeroIdentityToNative as any)(s, native); } catch { /* ignore */ }
        try { (_tryApplyHeroAnimationForNative as any)(s, native); } catch { /* ignore */ }

        (s as any).native = native;

        if (_attachCallCount <= MAX_ATTACH_VERBOSE) {
            try {
                console.log(
                    "[WRAP-NATIVE] create hero-native sprite",
                    "| id", s.id,
                    "| kind", s.kind,
                    "| bootTexKey", bootTexKey,
                    "| native.width", native.width,
                    "| native.height", native.height
                );
            } catch { /* ignore */ }
        }

        _frameAttachCreateCount++;
        _frameGroupAttachCreates[g]++;
    } else {
        // Keep origin stable in case something else reset it
        try { native.setOrigin(HERO_NATIVE_ORIGIN_X, HERO_NATIVE_ORIGIN_Y); } catch { /* ignore */ }
        try { native.setData("isHeroNative", true); } catch { /* ignore */ }
        native.setPosition(nx, ny);

        // Keep identity in sync + re-apply animation if phase/dir/family changed.
        try { (_copyHeroIdentityToNative as any)(s, native); } catch { /* ignore */ }
        try { (_tryApplyHeroAnimationForNative as any)(s, native); } catch { /* ignore */ }

        _frameAttachUpdateCount++;
        _frameGroupAttachUpdates[g]++;
    }

    // For visibility logic that uses nonZero pixels, just mark as non-empty.
    try { (s as any)._lastNonZeroPixels = 1; } catch { /* ignore */ }

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
    if (DEBUG_SPRITE_ATTACH && _attachCallCount <= MAX_ATTACH_VERBOSE) {
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
    const dataAny: any = ctx.dataAny || (s as any).data || {};

    let targetW = w | 0;
    let targetH = h | 0;
    try {
        const role = _classifySpriteRole((s.kind as any) | 0, Object.keys(dataAny || {}));
        if (role === "PROJECTILE") {
            const tw = typeof dataAny.texW === "number" ? (dataAny.texW | 0) : 0;
            const th = typeof dataAny.texH === "number" ? (dataAny.texH | 0) : 0;
            if (tw > 0) targetW = Math.max(targetW, tw | 0);
            if (th > 0) targetH = Math.max(targetH, th | 0);
        }
    } catch { /* ignore */ }

    const tTex0 = _hostPerfNowMs();

    let tex = sc.textures.exists(texKey)
        ? (sc.textures.get(texKey) as Phaser.Textures.CanvasTexture)
        : null;

    if (tex) {
        const src = tex.source[0];
        const texW = (src.width | 0);
        const texH = (src.height | 0);

        if (texW !== targetW || texH !== targetH) {
            try {
                const role = _classifySpriteRole((s.kind as any) | 0, Object.keys(dataAny || {}));
                if (role === "PROJECTILE") {
                    const fx = (dataAny as any).projMaskFx as any;
                    if (fx && (fx as any).native) {
                        const fxNative = (fx as any).native;
                        _effectClearPaintMask(fxNative);
                        try { fxNative.setVisible?.(false); } catch { }
                        try { fxNative.setAlpha?.(0); } catch { }
                    }
                    if (DEBUG_EFFECT_MASKS) {
                        const key = `projTexRecreate:${s.id}:${texKey}:${texW}x${texH}->${targetW}x${targetH}`;
                        if (!__effectMaskTexOnce.has(key)) {
                            __effectMaskTexOnce.add(key);
                            console.log("[effectmask][projTexRecreate]", {
                                spriteId: s.id | 0,
                                texKey,
                                oldW: texW | 0,
                                oldH: texH | 0,
                                newW: targetW | 0,
                                newH: targetH | 0
                            });
                        }
                    }
                }
            } catch { /* ignore */ }
            if (DEBUG_WRAP_TEX) {
                console.log(
                    "[WRAP-TEX-RECREATE]",
                    "| id", s.id,
                    "| old tex w,h", texW, texH,
                    "| new img w,h", targetW, targetH
                );
            }
            sc.textures.remove(texKey);
            tex = null;
        }
    }

    if (!tex) {
        tex = sc.textures.createCanvas(texKey, targetW, targetH);

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
    // DEBUG_KIND56_CREATE_TRACE flag is defined in src/debugFlags.ts
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
        if (DEBUG_SPRITE_ATTACH) {
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
            if (DEBUG_SPRITE_ATTACH) {
                console.log(`[AURA] id=${s.id} image went fully blank -> hiding native sprite`);
            }
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

        if (DEBUG_PROJECTILE_NATIVE) {
            console.log(
                "[createProjectileFromSprite] from kind=",
                source.kind,
                "proj w=",
                img?.width,
                "h=",
                img?.height
            );
        }

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

    if (DEBUG_SPRITE_SYNC && shouldLog) {
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
        if (DEBUG_SPRITE_SYNC && ctx.shouldLog) console.log("[_syncNativeSprites] no scene yet");
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

    // Cache camera info once per tick for debugging
    const cam = (sc as any).cameras?.main;
    const camScrollX = cam ? (cam.scrollX as number) : 0;
    const camScrollY = cam ? (cam.scrollY as number) : 0;
    const camZoom = cam ? (cam.zoom as number) : 1;
    const camWV = cam ? cam.worldView : null;

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

            if (DEBUG_SPRITE_SYNC && ctx.shouldLog && (s.kind === 11 || s.kind === 12)) {
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

            try {
                const dataAny: any = (s as any).data || {};
                const role = _classifySpriteRole(s.kind, Object.keys(dataAny || {}));
                if (role === "HERO") {
                    const heroIndex = (dataAny[HERO_INDEX_DATA_KEY] as any | 0);
                    _clearHeroNativeByIndex(heroIndex, s.native);
                }
                if (role === "PROJECTILE") {
                    const fx = dataAny.projMaskFx as any;
                    if (fx) {
                        try {
                            const fxNative = (fx as any).native;
                            if (fxNative) {
                                _effectClearPaintMask(fxNative);
                                try { fxNative.setVisible?.(false); } catch { }
                                try { fxNative.setAlpha?.(0); } catch { }
                                try { fxNative.destroy(); } catch { }
                                (fx as any).native = null;
                            }
                        } catch { /* ignore */ }
                        try {
                            (fx as any).flags |= SpriteFlag.Destroyed;
                            (fx as any)._destroyed = true;
                        } catch { /* ignore */ }
                    }
                }
            } catch { }

            if (s.native && (s.native as any).destroy) {
                // Step 8: ensure weapon overlays are destroyed too
                _destroyWeaponOverlaysForHeroNative(s.native);

                // Intellect FX attachments (hero ring + projectile crystal)
                _destroyIntellectFxForNative(s.native);
                _effectClearPaintMask(s.native);

                try {
                    (s.native as any).destroy();
                } catch (e) {
                    console.warn("[_syncNativeSprites] error destroying native", s.id, e);
                }
            }
            s.native = null;

            const texKey = "sprite_" + s.id;
            if (sc.textures && sc.textures.exists(texKey)) {
                if (DEBUG_EFFECT_MASKS) {
                    const key = `projTexRemove:${s.id}:${texKey}`;
                    if (!__effectMaskTexOnce.has(key)) {
                        __effectMaskTexOnce.add(key);
                        console.log("[effectmask][projTexRemove]", {
                            spriteId: s.id | 0,
                            texKey
                        });
                    }
                }
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
            if (DEBUG_SPRITE_SYNC && ctx.shouldLog && (s.kind === 11 || s.kind === 12)) {
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
        // SHOP RING (Phaser-only): render ring weapons around shopkeeper
        // --------------------------------------------------
        const dataAny: any = (s as any).data || {};
        const ringIdsRaw = dataAny[SHOP_WPN_RING_IDS_KEY];

        if (typeof ringIdsRaw === "string" && ringIdsRaw.trim()) {
            _syncShopWeaponRingIfPresent(ctx, s, native);
        }

        // --------------------------------------------------
        // UI FAST PATH
        // --------------------------------------------------
        if (_syncUiManagedFastPath(ctx, s, native, mcToHex)) continue;

        // --------------------------------------------------
        // HERO PATH
        // --------------------------------------------------
        _syncHeroPath(ctx, s, native);

        // --------------------------------------------------
        // FOCUS OUTLINE (engine-driven)
        // --------------------------------------------------
        _syncFocusOutlineForNative(ctx, s, native);

        // --------------------------------------------------
        // ENEMY / ACTOR PATH
        // --------------------------------------------------
        if (_syncEnemyActorPath(ctx, s, native)) continue;

        // --------------------------------------------------
        // EFFECT PATH (relics, spells, generic FX)
        // --------------------------------------------------
        _syncEffectPath(ctx, s, native);

        // --------------------------------------------------
        // PROJECTILE VISUAL OVERRIDES (Phaser-only)
        // --------------------------------------------------
        if (s.kind === 51) {
            // Targeted camera-space debug, throttled to once per projectile sprite id
            const dbgKey = "__projDbgOnce_" + (s.id | 0);
            if (!(globalThis as any)[dbgKey]) {
                (globalThis as any)[dbgKey] = 1;

                const sfx = (native as any).scrollFactorX ?? 1;
                const sfy = (native as any).scrollFactorY ?? 1;
                const sx = (native.x - camScrollX) * camZoom;
                const sy = (native.y - camScrollY) * camZoom;

                let inView = false;
                if (camWV) {
                    inView =
                        (native.x >= camWV.x && native.x <= (camWV.x + camWV.width) &&
                         native.y >= camWV.y && native.y <= (camWV.y + camWV.height));
                }

                if (native && (native as any).__heHiddenByReplacement) {
                native.setVisible(false);
                if (typeof (native as any).setAlpha === "function") native.setAlpha(0);
                }


                if (DEBUG_PROJECTILE_NATIVE) {
                    console.log("[SYNC][PROJ]",
                        "| s.id", s.id,
                        "| kind", s.kind,
                        "| flags", flags,
                        "| world", (native.x | 0), (native.y | 0),
                        "| screen", (sx | 0), (sy | 0),
                        "| cam.scroll", (camScrollX | 0), (camScrollY | 0),
                        "| cam.zoom", camZoom,
                        "| inView", inView,
                        "| nativeScrollFactor", sfx, sfy,
                        "| relToCamFlag", !!(flags & SpriteFlag.RelativeToCamera),
                        "| tex", (native as any).texture?.key ?? "",
                        "| depth", (native as any).depth ?? 0
                    );
                }
            }

            _syncIntellectSpellProjectileCrystal(ctx, s, native, flags);
        }

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
        return _syncUiManagedStatusBar(ctx, s, native, mcToHex);
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
    native: Phaser.GameObjects.GameObject,
    mcToHex: (p: number) => number
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

    // ------------------------------------------------------------
    // NEW: If this status bar is attached to a sprite, match its depth
    // so it sorts with the hero/monster vs props (behind only when they are behind).
    // ------------------------------------------------------------
    try {
        const follow: any = sb.spriteToFollow;
        const followNative: any = follow ? (follow.native as any) : null;

        if (followNative) {
            // Prefer Phaser depth when available
            const followDepth =
                (typeof followNative.depth === "number") ? (followNative.depth | 0) :
                (typeof followNative.getDepth === "function") ? (followNative.getDepth() | 0) :
                0;

            const zBias = (s.z | 0); // keep Arcade z as a small tie-breaker (hp vs mana, etc.)
            const depth = ((followDepth + UI_STATUSBAR_FOLLOW_DEPTH_BIAS + zBias) | 0);

            if (typeof anyNative.setDepth === "function") anyNative.setDepth(depth);
            else anyNative.depth = depth;
        }
    } catch { /* ignore */ }

    const borderRect = anyNative.getData?.("sb_border") as Phaser.GameObjects.Rectangle | undefined;
    const bgRect = anyNative.getData?.("sb_bg") as Phaser.GameObjects.Rectangle | undefined;
    const fillRect = anyNative.getData?.("sb_fill") as Phaser.GameObjects.Rectangle | undefined;
    const flashRect = anyNative.getData?.("sb_flash") as Phaser.GameObjects.Rectangle | undefined;

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

    // Colors: reflect current sb state (HeroEngine updates onColor/offColor directly).
    try {
        const onHex = mcToHex((sb.onColor | 0) || 0);
        const offHex = mcToHex((sb.offColor | 0) || 0);
        const borderColorIdx =
            (sb.borderColor === undefined || sb.borderColor === null)
                ? (sb.offColor | 0)
                : (sb.borderColor | 0);
        const borderHex = mcToHex(borderColorIdx | 0);

        borderRect.fillColor = borderHex;
        bgRect.fillColor = offHex;
        fillRect.fillColor = onHex;
    } catch { /* ignore color update errors */ }

    fillRect.x = leftX;
    fillRect.y = 0;
    fillRect.width = Math.floor(innerW * pct);
    fillRect.height = innerH;

    // Flash overlay: visible only while flashOverlayUntil is in the future.
    if (flashRect) {
        const now = game.runtime() | 0;
        const flashUntil = sprites.readDataNumber(s, "flashOverlayUntil") | 0;
        const flashing = flashUntil > 0 && now < flashUntil;
        if (flashing) {
            const phase = ((now / 60) | 0) & 1;
            const onHex = mcToHex(phase ? 2 : 9); // red / blue
            flashRect.x = 0;
            flashRect.y = 0;
            flashRect.width = barW;
            flashRect.height = barH;
            flashRect.fillColor = onHex;
            flashRect.setVisible(true);
        } else {
            flashRect.setVisible(false);
            // Clear the data key to avoid stale checks
            try { sprites.setDataNumber(s, "flashOverlayUntil", 0); } catch { /* ignore */ }
        }
    }

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



// 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃
//Weapon section

function _ensureWeaponOverlaysForHeroNative(
    ctx: SyncContext,
    nativeHero: Phaser.GameObjects.Sprite
): {
    weaponBg: Phaser.GameObjects.Sprite;
    weaponFg: Phaser.GameObjects.Sprite;
    ghostsBg: Phaser.GameObjects.Sprite[];
    ghostsFg: Phaser.GameObjects.Sprite[];
} | null {
    const sc = ctx.sc as any;
    if (!sc) return null;

    const nativeAny: any = nativeHero as any;

    // Keep overlays anchored to the SAME origin as the hero (feet anchor)
    const heroOx = ((nativeHero as any).originX ?? 0.5) as number;
    const heroOy = ((nativeHero as any).originY ?? 0.5) as number;

    const syncOrigin = (spr: any): void => {
        if (!spr) return;
        try { spr.setOrigin?.(heroOx, heroOy); } catch { /* ignore */ }
    };

    const syncAllOrigins = (bg: any, fg: any, gbg: any[], gfg: any[]): void => {
        syncOrigin(bg);
        syncOrigin(fg);
        if (gbg && Array.isArray(gbg)) for (const g of gbg) syncOrigin(g);
        if (gfg && Array.isArray(gfg)) for (const g of gfg) syncOrigin(g);
    };

    // If overlays already exist and are alive, reuse.
    const bgExisting: any = nativeAny.__weaponBg;
    const fgExisting: any = nativeAny.__weaponFg;
    const gbgExisting: any[] = nativeAny.__weaponGhostsBg || [];
    const gfgExisting: any[] = nativeAny.__weaponGhostsFg || [];

    if (bgExisting && fgExisting) {
        const bgOk = !!bgExisting.scene && !(bgExisting as any).destroyed;
        const fgOk = !!fgExisting.scene && !(fgExisting as any).destroyed;

        // Ghosts are optional but if present must be alive too
        let ghostsOk = true;
        for (const g of gbgExisting) if (g && (!g.scene || (g as any).destroyed)) ghostsOk = false;
        for (const g of gfgExisting) if (g && (!g.scene || (g as any).destroyed)) ghostsOk = false;

        if (bgOk && fgOk && ghostsOk) {
            // IMPORTANT: keep origins synced (hero-native origin may differ)
            syncAllOrigins(bgExisting, fgExisting, gbgExisting, gfgExisting);

            // Ensure cleanup is wired once.
            if (!nativeAny.__weaponCleanupWired && typeof (nativeHero as any).once === "function") {
                nativeAny.__weaponCleanupWired = true;
                try {
                    (nativeHero as any).once("destroy", () => {
                        _destroyWeaponOverlaysForHeroNative(nativeHero);
                    });
                } catch { /* ignore */ }
            }
            return { weaponBg: bgExisting, weaponFg: fgExisting, ghostsBg: gbgExisting, ghostsFg: gfgExisting };
        }

        // Something was destroyed; cleanup and recreate.
        _destroyWeaponOverlaysForHeroNative(nativeHero);
        nativeAny.__weaponCleanupWired = false;
    }

    const glueAny: any = (globalThis as any).weaponAnimGlue || weaponAnimGlue;
    if (!glueAny || typeof glueAny.createWeaponOverlaySprites !== "function") return null;

    // Step 5 set maxGhosts to 8; keep that here.
    const created = glueAny.createWeaponOverlaySprites({ scene: sc, maxGhosts: 8 });

    const weaponBg: Phaser.GameObjects.Sprite = created.weaponBg;
    const weaponFg: Phaser.GameObjects.Sprite = created.weaponFg;
    const ghostsBg: Phaser.GameObjects.Sprite[] = created.ghostsBg || [];
    const ghostsFg: Phaser.GameObjects.Sprite[] = created.ghostsFg || [];

    // IMPORTANT: match hero origin immediately (feet anchor)
    syncAllOrigins(weaponBg, weaponFg, ghostsBg, ghostsFg);

    // ------------------------------------------------------------
    // Tag overlays so they can be filtered out of any sprite scans.
    // (Also useful later when we spawn shop ring weapons.)
    // ------------------------------------------------------------
    const tagOverlay = (spr: any, kind: string): void => {
        if (!spr) return;
        try { spr.setData?.("__isWeaponOverlay", 1); } catch { }
        try { spr.setData?.("__weaponOverlayKind", kind); } catch { }
        try { spr.setData?.("__weaponOverlayOwner", "hero"); } catch { }
        // Also stash on the object for faster checks in hot loops.
        try { spr.__isWeaponOverlay = 1; } catch { }
        try { spr.__weaponOverlayKind = kind; } catch { }
        try { spr.__weaponOverlayOwner = "hero"; } catch { }
    };

    tagOverlay(weaponBg as any, "bg");
    tagOverlay(weaponFg as any, "fg");
    for (const g of ghostsBg) tagOverlay(g as any, "ghostBg");
    for (const g of ghostsFg) tagOverlay(g as any, "ghostFg");

    // Match hero scroll factors if possible.
    try {
        const sfx = (nativeHero as any).scrollFactorX;
        const sfy = (nativeHero as any).scrollFactorY;
        if (typeof weaponBg.setScrollFactor === "function") weaponBg.setScrollFactor(sfx, sfy);
        if (typeof weaponFg.setScrollFactor === "function") weaponFg.setScrollFactor(sfx, sfy);

        for (const g of ghostsBg) try { (g as any).setScrollFactor?.(sfx, sfy); } catch { }
        for (const g of ghostsFg) try { (g as any).setScrollFactor?.(sfx, sfy); } catch { }
    } catch { /* ignore */ }

    // Defensive defaults (per-tick sync will override, but creation-time matters).
    try { (weaponBg as any).setDepth?.(((nativeHero as any).depth ?? 0) - 1); } catch { }
    try { (weaponFg as any).setDepth?.(((nativeHero as any).depth ?? 0) + 1); } catch { }
    for (const g of ghostsBg) try { (g as any).setDepth?.(((nativeHero as any).depth ?? 0) - 2); } catch { }
    for (const g of ghostsFg) try { (g as any).setDepth?.(((nativeHero as any).depth ?? 0) - 2); } catch { }

    // Hidden until Step 6 chooses to show them.
    try { weaponBg.setVisible(false); } catch { /* ignore */ }
    try { weaponFg.setVisible(false); } catch { /* ignore */ }
    for (const g of ghostsBg) try { g.setVisible(false); } catch { }
    for (const g of ghostsFg) try { g.setVisible(false); } catch { }

    nativeAny.__weaponBg = weaponBg;
    nativeAny.__weaponFg = weaponFg;
    nativeAny.__weaponGhostsBg = ghostsBg;
    nativeAny.__weaponGhostsFg = ghostsFg;

    // Wire cleanup once per hero-native
    if (!nativeAny.__weaponCleanupWired && typeof (nativeHero as any).once === "function") {
        nativeAny.__weaponCleanupWired = true;
        try {
            (nativeHero as any).once("destroy", () => {
                _destroyWeaponOverlaysForHeroNative(nativeHero);
            });
        } catch { /* ignore */ }
    }

    return { weaponBg, weaponFg, ghostsBg, ghostsFg };
}



//Backup just to compile. We need the old one please
function _destroyWeaponOverlaysForHeroNative(native: any): void {
    if (!native) return;

    const tryDestroy = (spr: any) => {
        if (!spr) return;
        try { spr.destroy?.(); } catch { }
    };

    const tryDestroyArr = (arr: any) => {
        if (!arr || !Array.isArray(arr)) return;
        for (let i = 0; i < arr.length; i++) tryDestroy(arr[i]);
        arr.length = 0;
    };

    // ------------------------------------------------------------
    // 1) Known "field" storage (your codebase has used these patterns)
    // ------------------------------------------------------------
    try {
        // If you have constants like these, great; if not, this block just won't run.
        if (typeof WEAPON_NATIVE_BG_FIELD !== "undefined") tryDestroy(native[WEAPON_NATIVE_BG_FIELD]);
        if (typeof WEAPON_NATIVE_FG_FIELD !== "undefined") tryDestroy(native[WEAPON_NATIVE_FG_FIELD]);
        if (typeof WEAPON_NATIVE_GHOSTS_FIELD !== "undefined") tryDestroyArr(native[WEAPON_NATIVE_GHOSTS_FIELD]);
    } catch { }

    // ------------------------------------------------------------
    // 2) Data manager storage (native.setData / native.getData)
    // ------------------------------------------------------------
    try {
        const bg = native.getData?.("__weaponBg");
        const fg = native.getData?.("__weaponFg");
        const ghosts = native.getData?.("__weaponGhosts");
        tryDestroy(bg);
        tryDestroy(fg);
        tryDestroyArr(ghosts);
        try { native.setData?.("__weaponBg", null); } catch { }
        try { native.setData?.("__weaponFg", null); } catch { }
        try { native.setData?.("__weaponGhosts", null); } catch { }
    } catch { }

    // ------------------------------------------------------------
    // 3) "Raw" common property names (in case refactors renamed constants)
    // ------------------------------------------------------------
    tryDestroy(native.weaponBg);
    tryDestroy(native.weaponFg);
    tryDestroyArr(native.weaponGhosts);
    try { native.weaponBg = null; } catch { }
    try { native.weaponFg = null; } catch { }
    try { native.weaponGhosts = null; } catch { }

    // ------------------------------------------------------------
    // 4) Also clean up shop ring overlays if they exist on this native
    //    (prevents leaks if shopkeeper gets destroyed)
    // ------------------------------------------------------------
    try {
        if (typeof SHOP_RING_NATIVE_BG_FIELD !== "undefined") tryDestroyArr(native[SHOP_RING_NATIVE_BG_FIELD]);
        if (typeof SHOP_RING_NATIVE_FG_FIELD !== "undefined") tryDestroyArr(native[SHOP_RING_NATIVE_FG_FIELD]);
        if (typeof SHOP_RING_NATIVE_BG_FIELD !== "undefined") native[SHOP_RING_NATIVE_BG_FIELD] = [];
        if (typeof SHOP_RING_NATIVE_FG_FIELD !== "undefined") native[SHOP_RING_NATIVE_FG_FIELD] = [];
        if (typeof SHOP_RING_NATIVE_WIRED_KEY !== "undefined") native[SHOP_RING_NATIVE_WIRED_KEY] = 0;
    } catch { }
}

function _purgePhaserWeaponOverlays(reason?: string): number {
    const sc: any = (globalThis as any).__phaserScene;
    const list: any[] = (sc && sc.children && Array.isArray(sc.children.list)) ? sc.children.list : [];
    let killed = 0;

    for (let i = list.length - 1; i >= 0; i--) {
        const obj: any = list[i];
        if (!obj || typeof obj.destroy !== "function") continue;

        let isOverlay = false;
        try {
            if (obj.getData && (obj.getData("__isWeaponOverlay") || obj.getData(SHOP_RING_TAG_IS))) {
                isOverlay = true;
            }
        } catch { }

        if (!isOverlay && (obj.__isWeaponOverlay || obj.__isShopRingWeapon)) isOverlay = true;
        if (!isOverlay) continue;

        try { obj.destroy(); killed++; } catch { }
    }

    try {
        const g: any = globalThis as any;
        if (killed && g && g.__weaponDebug) {
            console.log(`[PHASER][PURGE] overlays=${killed} reason=${reason || ""}`);
        }
    } catch { }

    return killed | 0;
}

try { (globalThis as any).__heDestroyWeaponOverlaysForNative = _destroyWeaponOverlaysForHeroNative; } catch { }
try { (globalThis as any).__hePurgeWeaponOverlays = _purgePhaserWeaponOverlays; } catch { }




const WPN_DBG_LAST_LINE_KEY = "__weaponDbgLastLine";

function _parseIntMaybe(x: any): number | undefined {
    if (typeof x === "number" && Number.isFinite(x)) return x | 0;
    if (typeof x === "string") {
        const n = parseInt(x, 10);
        if (Number.isFinite(n)) return n | 0;
    }
    return undefined;
}

function _getSpriteCols(sceneAny: any, spriteAny: any): number {
    const w = (spriteAny?.frame?.width ?? 0) | 0;
    if (w <= 0) return 1;

    const texKey = (spriteAny?.texture?.key ?? "") + "";
    if (!texKey) return 1;

    const tex = sceneAny?.textures?.get?.(texKey);
    const src: any = tex?.getSourceImage?.();
    const imgW = (src?.width ?? 0) | 0;
    if (imgW <= 0) return 1;

    const cols = Math.floor(imgW / w);
    return Math.max(1, cols | 0);
}

function _getFrameName(spriteAny: any): string {
    return ((spriteAny?.frame?.name ?? "") + "");
}

function _getFrameIndexFromSpriteIndex(spriteAny: any): number {
    return ((spriteAny?.frame?.index ?? -1) | 0);
}

function _colFromFrame(idx: number, name: string, cols: number): number {
    if (cols <= 0) return -1;
    if (idx >= 0) return (idx % cols) | 0;
    const n = _parseIntMaybe(name);
    if (n === undefined) return -1;
    return (n % cols) | 0;
}

function _forceSpriteColByName(spriteAny: any, cols: number, desiredCol: number): void {
    if (!spriteAny || cols <= 0) return;

    const nameStr = _getFrameName(spriteAny);
    const n = _parseIntMaybe(nameStr);
    if (n === undefined) return;

    const dcol = Math.max(0, Math.min(cols - 1, desiredCol | 0));
    const rowBase = (n - (n % cols)) | 0;
    const target = (rowBase + dcol) | 0;

    try { spriteAny.anims?.stop?.(); } catch { }
    try { spriteAny.setFrame(String(target)); } catch { }
}

function _fmtWpnFrameResultLine(args: {
    weaponId: string;
    weaponPhase: string;
    requestedDir: string;
    nativeDir: string;

    heroTexKey: string;
    heroFrameIndex: number;
    heroCol: number;
    heroCols: number;

    nativeFco: number;
    arcadeFcoRaw: any;

    bgTexKey: string;
    bgName: string;
    bgCol: number;
    bgCols: number;

    fgTexKey: string;
    fgName: string;
    fgCol: number;
    fgCols: number;
}): string {
    const a = args;
    const arc = (a.arcadeFcoRaw === undefined) ? "u" : String(a.arcadeFcoRaw);
    return (
        `[WPN-FRAME-RESULT] ` +
        `wpn=${a.weaponId} phase=${a.weaponPhase} reqDir=${a.requestedDir} natDir=${a.nativeDir} ` +
        `heroTex=${a.heroTexKey} hfi=${a.heroFrameIndex} hcol=${a.heroCol}/${a.heroCols} ` +
        `fcoNat=${a.nativeFco} fcoArc=${arc} ` +
        `bg=${a.bgTexKey}@${a.bgName} col=${a.bgCol}/${a.bgCols} ` +
        `fg=${a.fgTexKey}@${a.fgName} col=${a.fgCol}/${a.fgCols}`
    );
}




const WPN_TICK_LOG_MIN_MS = 250; // tweak: 100/250/500
const WPN_TICK_LOG_KEY_LAST_MS = "__wpnTickLastMs";
const WPN_TICK_LOG_KEY_LAST_SIG = "__wpnTickLastSig";

function _shouldLogWeaponTick(nativeHero: Phaser.GameObjects.Sprite, nowMs: number, sig: string): boolean {
    const anyH: any = nativeHero as any;

    // Try to use Phaser DataManager if present
    const get = (k: string): any => {
        try { return anyH.getData ? anyH.getData(k) : anyH[k]; } catch { return anyH[k]; }
    };
    const set = (k: string, v: any): void => {
        try { if (anyH.setData) anyH.setData(k, v); else anyH[k] = v; } catch { anyH[k] = v; }
    };

    const lastMs = (get(WPN_TICK_LOG_KEY_LAST_MS) as any | 0);
    const lastSig = String(get(WPN_TICK_LOG_KEY_LAST_SIG) ?? "");

    // Always log immediately on first time or on “meaningful change”
    if (!lastMs || sig !== lastSig) {
        set(WPN_TICK_LOG_KEY_LAST_MS, nowMs | 0);
        set(WPN_TICK_LOG_KEY_LAST_SIG, sig);
        return true;
    }

    // Otherwise, throttle by time
    if (((nowMs | 0) - (lastMs | 0)) >= (WPN_TICK_LOG_MIN_MS | 0)) {
        set(WPN_TICK_LOG_KEY_LAST_MS, nowMs | 0);
        // sig unchanged
        return true;
    }

    return false;
}

function _wpnNormalizeDir(dirRaw: any): "up" | "down" | "left" | "right" {
    const d = (typeof dirRaw === "string" ? dirRaw : "") as string;
    return (d === "up" || d === "down" || d === "left" || d === "right") ? d : "down";
}

function _wpnSnake(x: any): string {
    return String(x || "")
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/\s+/g, "_")
        .replace(/-+/g, "_")
        .replace(/_+/g, "_")
        .toLowerCase();
}

function _wpnInferDisplayedHeroPhase(nativeHero: Phaser.GameObjects.Sprite, fallbackPhase: string): string {
    try {
        const keyRaw = (nativeHero as any)?.anims?.currentAnim?.key;
        const key = (typeof keyRaw === "string") ? keyRaw : "";
        if (!key) return fallbackPhase;

        const k = key.toLowerCase();

        if (k.includes("thrustoversize") || k.includes("thrust_oversize") || k.includes("oversize_thrust")) return "thrustOversize";
        if (k.includes("slashoversize") || k.includes("slash_oversize") || k.includes("oversize_slash")) return "slashOversize";

        if (k.includes("onehandslash") || k.includes("one_hand_slash") || k.includes("onehand_slash")) return "oneHandSlash";
        if (k.includes("onehandbackslash") || k.includes("one_hand_backslash") || k.includes("onehand_backslash") || k.includes("backslash")) return "oneHandBackslash";
        if (k.includes("onehandhalfslash") || k.includes("one_hand_halfslash") || k.includes("onehand_halfslash") || k.includes("halfslash")) return "oneHandHalfslash";

        if (k.includes("slash") || k.includes("attack_slash")) return "slash";
        if (k.includes("thrust") || k.includes("attack_thrust")) return "thrust";
        if (k.includes("cast") || k.includes("spellcast") || k.includes("spell_cast")) return "cast";

        if (k.includes("combatidle") || k.includes("combat_idle") || k.includes("universal_combat_idle")) return "combatIdle";
        if (k.includes("run")) return "run";
        if (k.includes("walk") || k.includes("move")) return "walk";
        if (k.includes("idle") || k.includes("universal_idle")) return "idle";

        if (k.includes("watering")) return "watering";
        if (k.includes("shoot")) return "shoot";
        if (k.includes("hurt")) return "hurt";
        if (k.includes("climb")) return "climb";
        if (k.includes("jump")) return "jump";
        if (k.includes("sit")) return "sit";
        if (k.includes("emote")) return "emote";

        return fallbackPhase;
    } catch {
        return fallbackPhase;
    }
}

function _wpnMaybeLogTick(ctx: SyncContext, s: any, nativeHero: Phaser.GameObjects.Sprite): void {
    if (!DEBUG_WEAPON_SYNC) return;

    const dataAny: any = (s as any).data || {};
    const phaseRaw = (typeof dataAny.phase === "string" && dataAny.phase) ? dataAny.phase : "idle";
    const animKey = String((nativeHero as any)?.anims?.currentAnim?.key ?? "");
    const ak = String(dataAny["ActionKind"] ?? "");
    const asq = (dataAny["ActionSequence"] as any | 0);

    const part = String(
        (nativeHero.getData("PhasePartName") ??
            nativeHero.getData("PhasePart") ??
            nativeHero.getData("phasePart") ??
            "") as any
    );

    const now = (((ctx.sc as any)?.time?.now ?? Date.now()) as any | 0);

    // Signature: change any of these → log immediately (even inside throttle window)
    const sig = `asq=${asq}|ak=${ak}|phase=${phaseRaw}|part=${part}|animKey=${animKey}`;

    if (_shouldLogWeaponTick(nativeHero, now, sig)) {
        console.log(
            `[WPN][TICK] t=${now} asq=${asq} ak='${ak}' phase='${phaseRaw}' part='${part}' animKey='${animKey}' heroFrame=${_getNativeFrameIndexLoose(nativeHero)}`
        );
    }
}

function _wpnMirrorKeysForGlue(nativeHero: Phaser.GameObjects.Sprite, dataAny: any): void {
    try {
        const safeSet = (k: string, v: any) => {
            try { (nativeHero as any).setData?.(k, v); } catch { }
        };

        if (dataAny["ActionKind"] !== undefined) safeSet("ActionKind", dataAny["ActionKind"]);
        if (dataAny["ActionSequence"] !== undefined) safeSet("ActionSequence", dataAny["ActionSequence"]);
        if (dataAny["PhaseStartMs"] !== undefined) safeSet("PhaseStartMs", dataAny["PhaseStartMs"]);
        if (dataAny["PhaseDurationMs"] !== undefined) safeSet("PhaseDurationMs", dataAny["PhaseDurationMs"]);

        if (dataAny["phaseStartMs"] !== undefined && dataAny["PhaseStartMs"] === undefined) safeSet("PhaseStartMs", dataAny["phaseStartMs"]);
        if (dataAny["phaseDurationMs"] !== undefined && dataAny["PhaseDurationMs"] === undefined) safeSet("PhaseDurationMs", dataAny["phaseDurationMs"]);
    } catch { /* ignore */ }
}

function _wpnHideAllIfNoWeapon(
    anyHero: any,
    sc: any,
    overlays: {
        weaponBg: Phaser.GameObjects.Sprite;
        weaponFg: Phaser.GameObjects.Sprite;
        ghostsBg: Phaser.GameObjects.Sprite[];
        ghostsFg: Phaser.GameObjects.Sprite[];
    },
    nativeHero: Phaser.GameObjects.Sprite
): void {
    if (anyHero.__weaponVis !== 0) {
        try { overlays.weaponBg.setVisible(false); } catch { }
        try { overlays.weaponFg.setVisible(false); } catch { }

        try {
            for (const g of (overlays.ghostsBg || [])) { try { g.setVisible(false) } catch { } }
            for (const g of (overlays.ghostsFg || [])) { try { g.setVisible(false) } catch { } }
        } catch { /* ignore */ }

        try { _agiWeaponSheenStop(anyHero, sc, overlays.weaponBg, overlays.weaponFg) } catch { }

        anyHero.__weaponVis = 0;
    }
}

function _wpnSelectWeaponAndPhase(dataAny: any, nativeHero: Phaser.GameObjects.Sprite): {
    phaseRaw: string;
    displayedPhase: string;
    weaponPhase: string;
    weaponId: string;
    isComboRender: boolean;
    aState: number;
    staffCast: boolean;

    // keep these for later code paths/logging if needed
    wSlash: string;
    wThrust: string;
    wCast: string;
    wExec: string;
    wCombo: string;
} {
    const phaseRaw = (typeof dataAny.phase === "string" && dataAny.phase) ? dataAny.phase : "idle";

    const aState = (dataAny[HERO_AGI_STATE_KEY] as any | 0);

    const wSlash = (typeof dataAny[HERO_WPN_SLASH_KEY] === "string") ? String(dataAny[HERO_WPN_SLASH_KEY]) : "";
    const wThrust = (typeof dataAny[HERO_WPN_THRUST_KEY] === "string") ? String(dataAny[HERO_WPN_THRUST_KEY]) : "";
    const wCast = (typeof dataAny[HERO_WPN_CAST_KEY] === "string") ? String(dataAny[HERO_WPN_CAST_KEY]) : "";
    const wExec = (typeof dataAny[HERO_WPN_EXEC_KEY] === "string") ? String(dataAny[HERO_WPN_EXEC_KEY]) : "";
    const wCombo = (typeof dataAny[HERO_WPN_COMBO_KEY] === "string") ? String(dataAny[HERO_WPN_COMBO_KEY]) : "";
    const wInt = (typeof dataAny[HERO_WPN_INT_KEY] === "string") ? String(dataAny[HERO_WPN_INT_KEY]) : "";
    const wSup = (typeof dataAny[HERO_WPN_SUP_KEY] === "string") ? String(dataAny[HERO_WPN_SUP_KEY]) : "";

    const heroFamilyRaw = (typeof dataAny.heroFamily === "string") ? dataAny.heroFamily : "";
    const heroFamily = String(heroFamilyRaw || "").toLowerCase();

    const familyNumRaw = (dataAny.family as any);
    let familyNum = -999;
    if (typeof familyNumRaw === "number" && isFinite(familyNumRaw)) {
        familyNum = familyNumRaw | 0;
    } else if (typeof familyNumRaw === "string") {
        const n = parseInt(familyNumRaw, 10);
        if (isFinite(n)) familyNum = n | 0;
    }

    const isIntFamily =
        (familyNum === FAMILY_INTELLECT) ||
        (heroFamily === "intelligence" || heroFamily === "intellect");
    const isSupportFamily =
        (familyNum === FAMILY_HEAL) ||
        (heroFamily === "support" || heroFamily === "heal" || heroFamily === "wisdom" || heroFamily === "healing");

    const phaseRawSnake = _wpnSnake(phaseRaw);
    const castPhaseByRaw =
        phaseRawSnake === "cast" ||
        phaseRawSnake === "spellcast" ||
        phaseRawSnake === "spell_cast";
    const isComboRender =
        phaseRawSnake === "combo" ||
        phaseRawSnake === "combat_idle" ||
        phaseRawSnake === "combatidle";

    const displayedPhase = _wpnInferDisplayedHeroPhase(nativeHero, phaseRaw);

    let weaponId = "";
    let weaponPhase = isComboRender ? "combo" : displayedPhase;
    let staffCast = false;

    // WeaponId selection follows DISPLAYED (except combo + execute).
    if (isComboRender) {
        weaponId = wCombo || wSlash || wThrust || wExec || wCast;
        weaponPhase = "combo";
    }
    else if (aState === AGI_STATE_EXECUTING) {
        weaponId = wExec || wSlash;
    }
    else {
        const dpSnake = _wpnSnake(displayedPhase);
        const castPhaseByDisplay =
            dpSnake === "cast" ||
            dpSnake === "spellcast" ||
            dpSnake === "spell_cast";

        if (
            dpSnake === "slash" ||
            dpSnake === "attack_slash" ||
            dpSnake.startsWith("one_hand_") ||
            dpSnake.startsWith("onehand_") ||
            dpSnake.includes("backslash") ||
            dpSnake.includes("halfslash")
        ) {
            weaponId = wSlash;
        } else if (dpSnake === "thrust" || dpSnake === "attack_thrust") {
            weaponId = wThrust;
        } else if (dpSnake === "shoot" || dpSnake === "bow") {
            weaponId = wCast;
            weaponPhase = "shoot";
        } else if (castPhaseByDisplay || castPhaseByRaw) {
            if (isIntFamily || isSupportFamily) {
                staffCast = true;
                const staffId = isIntFamily ? wInt : wSup;
                weaponId = staffId || wCast;
                weaponPhase = "thrust";
            } else {
                weaponId = wCast;
            }
        } else {
            // IMPORTANT per your requirement:
            // no weapon for run / idle / etc (combat idle handled by combo render token)
            weaponId = "";
        }
    }

    return { phaseRaw, displayedPhase, weaponPhase, weaponId, isComboRender, aState, staffCast, wSlash, wThrust, wCast, wExec, wCombo };
}

function _wpnShouldAimRotate(weaponPhase: string): boolean {
    const p = _wpnSnake(weaponPhase);
    if (
        p === "thrust" ||
        p === "attack_thrust" ||
        p === "slash" ||
        p === "attack_slash" ||
        p.includes("slash")
    ) {
        return true;
    }
    return false;
}

function _wpnResolveRenderDirForAim(
    requestedDir: "up" | "down" | "left" | "right",
    actionKind: string,
    aimDx1000: number,
    aimDy1000: number
): "up" | "down" | "left" | "right" {
    const ak = (actionKind || "").toLowerCase();
    if ((ak.startsWith("strength") || ak.startsWith("agility")) && _wpnAimIsDiagonal(aimDx1000, aimDy1000)) {
        return (aimDx1000 >= 0) ? "right" : "left";
    }
    return requestedDir;
}

function _wpnDirBaseRad(dir: "up" | "down" | "left" | "right"): number {
    switch (dir) {
        case "up": return -Math.PI / 2;
        case "down": return Math.PI / 2;
        case "left": return Math.PI;
        case "right": return 0;
        default: return 0;
    }
}

function _wpnWrapRad(r: number): number {
    let v = r;
    while (v > Math.PI) v -= Math.PI * 2;
    while (v < -Math.PI) v += Math.PI * 2;
    return v;
}

function _wpnAimDeltaRad(
    baseDir: "up" | "down" | "left" | "right",
    aimAngleMdeg: number,
    aimDx1000: number,
    aimDy1000: number
): number {
    const baseRad = _wpnDirBaseRad(baseDir);
    const targetRad = (aimAngleMdeg !== 0)
        ? ((aimAngleMdeg * Math.PI) / 180000)
        : Math.atan2(aimDy1000, aimDx1000);
    return _wpnWrapRad(targetRad - baseRad);
}

function _wpnAimIsDiagonal(aimDx1000: number, aimDy1000: number): boolean {
    return (aimDx1000 | 0) !== 0 && (aimDy1000 | 0) !== 0;
}

function _wpnTipDirKeyFromAim(
    aimDx1000: number,
    aimDy1000: number,
    fallbackDir: "up" | "down" | "left" | "right"
): string {
    const dx = (aimDx1000 | 0);
    const dy = (aimDy1000 | 0);
    if (!dx && !dy) return fallbackDir;
    if (!dx) return dy >= 0 ? "down" : "up";
    if (!dy) return dx >= 0 ? "right" : "left";
    const sx = dx >= 0 ? 1 : -1;
    const sy = dy >= 0 ? 1 : -1;
    if (sx > 0 && sy > 0) return "down_right";
    if (sx > 0 && sy < 0) return "up_right";
    if (sx < 0 && sy > 0) return "down_left";
    return "up_left";
}

function _wpnTipDirVec(key: string): { nx: number; ny: number } {
    switch (key) {
        case "up": return { nx: 0, ny: -1 };
        case "down": return { nx: 0, ny: 1 };
        case "left": return { nx: -1, ny: 0 };
        case "right": return { nx: 1, ny: 0 };
        case "up_left": return { nx: -0.7071, ny: -0.7071 };
        case "up_right": return { nx: 0.7071, ny: -0.7071 };
        case "down_left": return { nx: -0.7071, ny: 0.7071 };
        case "down_right": return { nx: 0.7071, ny: 0.7071 };
        default: return { nx: 0, ny: -1 };
    }
}

function _wpnApplyAimGhost(args: {
    overlays: any;
    baseDir: "up" | "down" | "left" | "right";
    aimDx1000: number;
    aimDy1000: number;
    aimAngleMdeg: number;
    enabled: boolean;
}): void {
    const ghostsBg: any[] = args.overlays?.ghostsBg || [];
    const ghostsFg: any[] = args.overlays?.ghostsFg || [];
    const maxPairs = Math.min(ghostsBg.length | 0, ghostsFg.length | 0);
    if (maxPairs <= 0) return;

    const gIdx = Math.max(0, maxPairs - 1);
    const gbg = ghostsBg[gIdx];
    const gfg = ghostsFg[gIdx];

    if (!gbg || !gfg) return;

    if (!args.enabled || !_wpnAimIsDiagonal(args.aimDx1000, args.aimDy1000)) {
        try { gbg.setVisible(false); } catch { }
        try { gfg.setVisible(false); } catch { }
        return;
    }

    const bgAny: any = args.overlays.weaponBg as any;
    const fgAny: any = args.overlays.weaponFg as any;
    const bgKey = bgAny?.texture?.key ? String(bgAny.texture.key) : "";
    const fgKey = fgAny?.texture?.key ? String(fgAny.texture.key) : "";
    const bgVisible = !!bgAny?.visible;
    const fgVisible = !!fgAny?.visible;
    if (!bgVisible || !fgVisible || !bgKey || !fgKey || bgKey === "__MISSING" || fgKey === "__MISSING") {
        try { gbg.setVisible(false); } catch { }
        try { gfg.setVisible(false); } catch { }
        return;
    }

    const ang = _wpnAimDeltaRad(args.baseDir, args.aimAngleMdeg | 0, args.aimDx1000 | 0, args.aimDy1000 | 0);
    const dx = (args.aimDx1000 | 0) / 1000;
    const dy = (args.aimDy1000 | 0) / 1000;
    const ox = Math.round(dx * WPN_AIM_GHOST_OFFSET_PX);
    const oy = Math.round(dy * WPN_AIM_GHOST_OFFSET_PX);

    const applyGhost = (g: any, src: any, alpha: number, depthBias: number) => {
        if (!g || !src) return;
        try { g.setTexture(src.texture.key); } catch { }
        const frameName = (src.frame?.name ?? src.frame?.index ?? 0) as any;
        try { g.setFrame(frameName); } catch { }
        g.x = (src.x ?? 0) + ox;
        g.y = (src.y ?? 0) + oy;
        g.scaleX = src.scaleX ?? 1;
        g.scaleY = src.scaleY ?? 1;
        g.rotation = (src.rotation ?? 0) + ang;
        if (typeof g.setFlipX === "function") g.setFlipX(!!src.flipX);
        if (typeof g.setFlipY === "function") g.setFlipY(!!src.flipY);
        const d = (src.depth ?? 0) + depthBias;
        try { g.setDepth(d); } catch { }
        try { g.setAlpha(alpha); } catch { }
        try { g.setVisible(true); } catch { }
        try { g.setBlendMode?.(Phaser.BlendModes.ADD); } catch { }
    };

    applyGhost(gbg, bgAny, Math.max(0, Math.min(1, WPN_AIM_GHOST_ALPHA - 0.1)), -1);
    applyGhost(gfg, fgAny, Math.max(0, Math.min(1, WPN_AIM_GHOST_ALPHA)), 1);
}

function _wpnComputeHeroFrameInfo(sc: any, dataAny: any, nativeHero: Phaser.GameObjects.Sprite): {
    nativeDir: string;
    rawNativeFco: any;
    nativeFco: number;
    arcadeFcoRaw: any;

    heroFrameIndex: number;
    heroCols: number;
    heroCol: number;
    heroTexKey: string;
} {
    const anyHero: any = nativeHero as any;

    const nativeDir = ((nativeHero.getData("dir") as string | undefined) || "") + "";
    const rawNativeFco = nativeHero.getData("frameColOverride") as any;
    const nativeFco = _parseIntMaybe(rawNativeFco) ?? -1;
    const arcadeFcoRaw = (dataAny.frameColOverride as any);

    // ✅ CRITICAL: Use TEXTURE FRAME INDEX (spritesheet frame id)
    const heroFrameIndex = _getTextureFrameIndex(anyHero);

    const heroCols = _getSpriteCols(sc, anyHero);
    const heroCol = _colFromFrame(heroFrameIndex, _getFrameName(anyHero), heroCols);
    const heroTexKey = (anyHero.texture?.key ?? "") + "";

    return { nativeDir, rawNativeFco, nativeFco, arcadeFcoRaw, heroFrameIndex, heroCols, heroCol, heroTexKey };
}

function _wpnPostGlueComputeWeaponFrameInfoAndApplyFco(sc: any, overlays: any, nativeFco: number): {
    bgTexKey: string;
    fgTexKey: string;

    bgCols: number;
    fgCols: number;

    bgName: string;
    fgName: string;

    bgCol: number;
    fgCol: number;
} {
    const bgAny: any = overlays.weaponBg as any;
    const fgAny: any = overlays.weaponFg as any;

    const bgCols = _getSpriteCols(sc, bgAny);
    const fgCols = _getSpriteCols(sc, fgAny);

    let bgName = _getFrameName(bgAny);
    let fgName = _getFrameName(fgAny);

    let bgCol = _colFromFrame(_getTextureFrameIndex(bgAny), bgName, bgCols);
    let fgCol = _colFromFrame(_getTextureFrameIndex(fgAny), fgName, fgCols);

    const bgTexKey = (bgAny.texture?.key ?? "") + "";
    const fgTexKey = (fgAny.texture?.key ?? "") + "";

    if (nativeFco >= 0) {
        _forceSpriteColByName(bgAny, bgCols, nativeFco);
        _forceSpriteColByName(fgAny, fgCols, nativeFco);

        bgName = _getFrameName(bgAny);
        fgName = _getFrameName(fgAny);
        bgCol = _colFromFrame(_getTextureFrameIndex(bgAny), bgName, bgCols);
        fgCol = _colFromFrame(_getTextureFrameIndex(fgAny), fgName, fgCols);
    }

    return { bgTexKey, fgTexKey, bgCols, fgCols, bgName, fgName, bgCol, fgCol };
}

function _wpnStep6_7_8_Effects(sc: any, dataAny: any, nativeHero: Phaser.GameObjects.Sprite, overlays: any): void {
    const anyHero: any = nativeHero as any;

    // Step 6/7/8 ... (UNCHANGED)
    const isNpc = !!(dataAny && (dataAny.isNpc || dataAny.npcLpc || dataAny.enemyLpc || dataAny._npcRole));

    const chgActive = ((dataAny["aChgOn"] as any | 0) !== 0)
    const pendingAdd = (dataAny["aPend"] as any | 0)
    const isExecW = ((dataAny["aExW"] as any | 0) !== 0)

    const ghostCount = (isNpc ? 0 : ((chgActive && !isExecW) ? Math.max(0, pendingAdd | 0) : 0));
    try {
        const glueAny: any = (globalThis as any).weaponAnimGlue || weaponAnimGlue;
        glueAny.setWeaponGhostCountExact({
            weaponBg: overlays.weaponBg,
            weaponFg: overlays.weaponFg,
            ghostsBg: overlays.ghostsBg,
            ghostsFg: overlays.ghostsFg,
            ghostCount,
            dir: _wpnNormalizeDir((dataAny.dir as any)),
            spacingPx: 10
        });
    } catch { }

    if (chgActive && isExecW) {
        _agiWeaponSheenStart(anyHero, sc, overlays.weaponBg as any, overlays.weaponFg as any)
    } else {
        _agiWeaponSheenStop(anyHero, sc, overlays.weaponBg as any, overlays.weaponFg as any)
    }

    const execSeq = (dataAny[HERO_AGI_V4_EXECUTE_SEQ_KEY] as any | 0)
    const lastSeq = (anyHero.__agiLastExecSeq as any | 0)

    if ((execSeq | 0) !== 0 && (execSeq | 0) !== (lastSeq | 0)) {
        anyHero.__agiLastExecSeq = execSeq | 0

        const lastAdd = (dataAny[HERO_AGI_V4_LAST_ADD_KEY] as any | 0)

        let storedHits = (dataAny[HERO_AGI_V4_STORED_HITS_KEY] as any | 0)
        if (!storedHits && storedHits !== 0) storedHits = 0
        if ((storedHits | 0) === 0 && (dataAny[HERO_AGI_PKT_COUNT_FALLBACK_KEY] !== undefined)) {
            storedHits = (dataAny[HERO_AGI_PKT_COUNT_FALLBACK_KEY] as any | 0)
        }

        _agiSpawnExecuteFx(sc, nativeHero, overlays, lastAdd | 0, storedHits | 0)
    }

    const evtSeq = (dataAny["EventSequence"] as any | 0)
    const evtMask = (dataAny["EventMask"] as any | 0)
    const lastEvtSeq = (anyHero.__lastEventSeq as any | 0)

    if ((evtSeq | 0) !== 0 && (evtSeq | 0) !== (lastEvtSeq | 0)) {
        anyHero.__lastEventSeq = evtSeq | 0

        if (((evtMask | 0) & EVENT_MASK_AGI_EXEC_SLASH) !== 0) {
            const ex = (dataAny["EventP0"] as any | 0)
            const ey = (dataAny["EventP1"] as any | 0)

            nativeHero.setData("__agiExecSlashBeatSeq", evtSeq | 0)
            nativeHero.setData("__agiExecSlashBeatLocalStartMs", (sc.time?.now ?? Date.now()) as any)

            _agiSpawnExecuteStreamlineFx(sc, nativeHero, overlays, ex | 0, ey | 0)
            _agiSpawnExecuteSlashMarkFx(sc, nativeHero, overlays, ex | 0, ey | 0)
        }

        if (((evtMask | 0) & EVENT_MASK_SHOP_SWAP) !== 0) {
            const nowMs = (sc.time?.now ?? Date.now()) as number
            anyHero.__shopSwapFxStartMs = nowMs | 0
            anyHero.__shopSwapFxEndMs = (nowMs + SHOP_SWAP_FX_MS) | 0
        }
    }

    const swapEnd = (anyHero.__shopSwapFxEndMs as any | 0)
    if (swapEnd > 0) {
        const nowMs = (sc.time?.now ?? Date.now()) as number
        if (nowMs < swapEnd) {
            if (!anyHero.__agiSheenOn) {
                const startMs = (anyHero.__shopSwapFxStartMs as any | 0)
                const t = (startMs > 0) ? ((nowMs - startMs) / SHOP_SWAP_FX_PULSE_MS) : 0
                const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2)
                const alpha = SHOP_SWAP_FX_ALPHA_MIN + (SHOP_SWAP_FX_ALPHA_MAX - SHOP_SWAP_FX_ALPHA_MIN) * pulse
                try { overlays.weaponBg.setAlpha(alpha) } catch { }
                try { overlays.weaponFg.setAlpha(alpha) } catch { }
            }
        } else {
            anyHero.__shopSwapFxStartMs = 0
            anyHero.__shopSwapFxEndMs = 0
            if (!anyHero.__agiSheenOn) {
                try { overlays.weaponBg.setAlpha(1) } catch { }
                try { overlays.weaponFg.setAlpha(1) } catch { }
            }
        }
    }
}

function _wpnDebugFollowAndFrameResultLog(args: {
    ctx: SyncContext;
    dataAny: any;
    nativeHero: Phaser.GameObjects.Sprite;

    phaseRaw: string;
    displayedPhase: string;
    weaponPhase: string;
    weaponId: string;
    requestedDir: "up" | "down" | "left" | "right";

    aState: number;

    nativeDir: string;
    nativeFco: number;
    arcadeFcoRaw: any;

    heroTexKey: string;
    heroFrameIndex: number;
    heroCol: number;
    heroCols: number;

    bgTexKey: string;
    fgTexKey: string;
    bgName: string;
    fgName: string;
    bgCol: number;
    fgCol: number;
    bgCols: number;
    fgCols: number;

    overlays: any;
}): void {
    if (!DEBUG_WEAPON_SYNC) return;

    const { dataAny, nativeHero, overlays } = args;

    // combined log (KEPT) + reports both animation + texture frame index sources
    try {
        const animKeyRaw = (nativeHero as any)?.anims?.currentAnim?.key;
        const animKey = (typeof animKeyRaw === "string") ? animKeyRaw : "";

        const mismatch =
            String(args.phaseRaw) !== String(args.displayedPhase) ||
            String(args.displayedPhase) !== String(args.weaponPhase);

        const anyHero: any = nativeHero as any;

        const heroTexFrame = _getTextureFrameIndex(anyHero);
        const heroFrameName = _getFrameName(anyHero);

        const bgAny2: any = overlays.weaponBg as any;
        const fgAny2: any = overlays.weaponFg as any;

        const bgFrameName2 = _getFrameName(bgAny2);
        const fgFrameName2 = _getFrameName(fgAny2);
        const bgTexFrame2 = _getTextureFrameIndex(bgAny2);
        const fgTexFrame2 = _getTextureFrameIndex(fgAny2);

        const line2 =
            `[WPN][FOLLOW]` +
            ` phaseRaw='${args.phaseRaw}'` +
            ` animKey='${animKey}'` +
            ` displayed='${args.displayedPhase}'` +
            ` weaponPhase='${args.weaponPhase}'` +
            ` weaponId='${args.weaponId}'` +
            ` dir='${args.requestedDir}'` +
            ` heroFrame=${heroTexFrame}('${heroFrameName}')` +
            ` bgFrame=${bgTexFrame2}('${bgFrameName2}')` +
            ` fgFrame=${fgTexFrame2}('${fgFrameName2}')` +
            ` aState=${args.aState | 0}` +
            ` fco=${args.nativeFco}`;

        const last2 = nativeHero.getData("__wpnFollowLastLine") as any;
        if (mismatch || last2 !== line2) {
            console.log(line2);
            nativeHero.setData("__wpnFollowLastLine", line2);
        }
    } catch { }

    const line = _fmtWpnFrameResultLine({
        weaponId: args.weaponId,
        weaponPhase: args.weaponPhase,
        requestedDir: args.requestedDir,
        nativeDir: args.nativeDir,
        heroTexKey: args.heroTexKey,
        heroFrameIndex: args.heroFrameIndex,
        heroCol: args.heroCol,
        heroCols: args.heroCols,
        nativeFco: args.nativeFco,
        arcadeFcoRaw: args.arcadeFcoRaw,
        bgTexKey: args.bgTexKey,
        bgName: args.bgName,
        bgCol: args.bgCol,
        bgCols: args.bgCols,
        fgTexKey: args.fgTexKey,
        fgName: args.fgName,
        fgCol: args.fgCol,
        fgCols: args.fgCols
    });

    const last = nativeHero.getData(WPN_DBG_LAST_LINE_KEY) as any;
    if (last !== line) {
        console.log(line);
        nativeHero.setData(WPN_DBG_LAST_LINE_KEY, line);
    }
}



function _syncWeaponOverlaysForHeroNative(
    ctx: SyncContext,
    s: any,
    nativeHero: Phaser.GameObjects.Sprite
): void {

    // --- DEBUG tick log (unchanged behavior) ---
    _wpnMaybeLogTick(ctx, s, nativeHero);

    const sc = ctx.sc as any;
    if (!sc) return;

    const anyHero: any = nativeHero as any;
    anyHero.__arcadeSpriteRef = s; // needed for Step 8 counter targeting

    const overlays = _ensureWeaponOverlaysForHeroNative(ctx, nativeHero);
    if (!overlays) return;

    const dataAny: any = (s as any).data || {};

    // Inputs
    const requestedDir = _wpnNormalizeDir((typeof dataAny.dir === "string" ? dataAny.dir : "down"));

    // Decide weaponId + weaponPhase based on DISPLAYED animation (and combo/execute rules)
    const sel = _wpnSelectWeaponAndPhase(dataAny, nativeHero);
    const phaseRaw = sel.phaseRaw;
    const displayedPhase = sel.displayedPhase;
    const weaponPhase = sel.weaponPhase;
    const weaponId = sel.weaponId;
    const aState = sel.aState;
    const staffCast = sel.staffCast;
    const heroIndex = (dataAny[HERO_INDEX_DATA_KEY] as any | 0);
    const weaponVariant = _weaponVariantForHero(heroIndex, weaponId);
    const aimDx1000 = (dataAny[HERO_AIM_DIR_X1000_KEY] as any | 0);
    const aimDy1000 = (dataAny[HERO_AIM_DIR_Y1000_KEY] as any | 0);
    const aimAngleMdeg = (dataAny[HERO_AIM_ANGLE_MDEG_KEY] as any | 0);
    const actionKind = (typeof dataAny.ActionKind === "string") ? String(dataAny.ActionKind) : "";
    const renderDir = _wpnResolveRenderDirForAim(requestedDir as any, actionKind, aimDx1000 | 0, aimDy1000 | 0);
    const allowAimRotate = (WPN_AIM_RENDER_MODE === "rotate") && (!staffCast) && _wpnShouldAimRotate(weaponPhase);

    // Mirror keys for glue (unchanged)
    _wpnMirrorKeysForGlue(nativeHero, dataAny);

    // Hide everything if no weapon (unchanged)
    if (!weaponId) {
        _wpnHideAllIfNoWeapon(anyHero, sc, overlays, nativeHero);
        return;
    }

    // Hero frame + override info (unchanged)
    const hfi = _wpnComputeHeroFrameInfo(sc, dataAny, nativeHero);
    const nativeDir = hfi.nativeDir;
    const nativeFco = hfi.nativeFco;
    const arcadeFcoRaw = hfi.arcadeFcoRaw;

    const heroFrameIndex = hfi.heroFrameIndex;
    const heroCols = hfi.heroCols;
    const heroCol = hfi.heroCol;
    const heroTexKey = hfi.heroTexKey;

    let staffOffsetX = 0;
    let staffOffsetY = 0;
    let staffFrameDirOverride: "up" | undefined;
    let staffFrameColOverride: number | undefined;

    if (staffCast) {
        staffFrameDirOverride = "up";
        const staffKey = String(weaponId || "").toLowerCase();
        staffFrameColOverride = (STAFF_CAST_FRAME_COL_BY_ID[staffKey] ?? 0) | 0;

        const dir = requestedDir;
        const xSign = (dir === "down" || dir === "right") ? 1 : -1;

        const clipLenRaw = nativeHero.getData("HeroFollowClipLen");
        const frameRaw = nativeHero.getData("HeroFollowFrameInClip");
        const clipLen = (typeof clipLenRaw === "number" && clipLenRaw > 0) ? (clipLenRaw | 0) : STAFF_CAST_DEFAULT_CLIP_LEN;
        const frameInClip = (typeof frameRaw === "number" && frameRaw >= 0) ? (frameRaw | 0) : 0;

        const retreatStart = Math.max(0, (clipLen | 0) - STAFF_CAST_RETURN_FRAMES);
        let retreatScale = 1;
        if (frameInClip >= retreatStart) {
            const denom = Math.max(1, (clipLen | 0) - retreatStart - 1);
            const t = Math.max(0, Math.min(1, (frameInClip - retreatStart) / denom));
            retreatScale = 1 - t;
        }

        const nowMs = (sc?.time?.now ?? Date.now()) as number;
        const hover = Math.sin((nowMs / STAFF_CAST_HOVER_PERIOD_MS) * Math.PI * 2) * STAFF_CAST_HOVER_AMP_PX;

        staffOffsetX = (STAFF_CAST_X_OFF_PX * xSign) * retreatScale;
        staffOffsetY = (STAFF_CAST_BASE_Y_OFF_PX + hover) * retreatScale;
    }

    const glueAny: any = (globalThis as any).weaponAnimGlue || weaponAnimGlue;
    const glueFrameColOverride = staffCast ? staffFrameColOverride : ((nativeFco >= 0) ? nativeFco : undefined);
    const glueFrameDirOverride = staffCast ? staffFrameDirOverride : undefined;

    // Glue sync (unchanged)
    glueAny.syncWeaponLayersToHero({
        scene: sc,
        heroSprite: nativeHero,
        weaponBg: overlays.weaponBg,
        weaponFg: overlays.weaponFg,
        weaponId,
        heroPhase: weaponPhase,
        dir: renderDir as any,
        heroFrameIndex,
        variant: weaponVariant,
        frameColOverride: glueFrameColOverride,
        frameDirOverride: glueFrameDirOverride,
        posOffsetX: staffOffsetX,
        posOffsetY: staffOffsetY,
        aimDx1000,
        aimDy1000,
        aimAngleMdeg,
        allowAimRotate
    });

    // Post-glue: compute actual weapon frame cols/names + apply nativeFco if present (unchanged)
    const nativeFcoForWeapon = staffCast ? -1 : nativeFco;
    const wfi = _wpnPostGlueComputeWeaponFrameInfoAndApplyFco(sc, overlays, nativeFcoForWeapon);

    // Cache weapon tip offset (hero-relative) for gameplay projectiles.
    try {
        const tipDirKey = _wpnTipDirKeyFromAim(aimDx1000, aimDy1000, renderDir as any);
        const tipVec = _wpnTipDirVec(tipDirKey);
        const fgAny: any = overlays.weaponFg as any;
        if (fgAny && heroAnimGlue?.getSpriteTipOffsetForNativeVec) {
            const tip = heroAnimGlue.getSpriteTipOffsetForNativeVec(
                fgAny,
                tipDirKey,
                tipVec.nx,
                tipVec.ny
            );
            if (tip) {
                const baseX = (nativeHero.x ?? 0) as number;
                const baseY = (nativeHero.y ?? 0) as number;
                const wTipX = ((fgAny.x ?? baseX) + (tip.dx || 0)) - baseX;
                const wTipY = ((fgAny.y ?? baseY) + (tip.dy || 0)) - baseY;
                sprites.setDataNumber(s, HERO_DATA.VIS_WTIP_X, wTipX);
                sprites.setDataNumber(s, HERO_DATA.VIS_WTIP_Y, wTipY);
                try {
                    (s as any).data = (s as any).data || {};
                    (s as any).data.visWTipX = wTipX;
                    (s as any).data.visWTipY = wTipY;
                } catch { /* ignore */ }
            }
        }
    } catch { /* ignore */ }

    // Step 6/7/8 ... (UNCHANGED behavior; just moved)
    _wpnStep6_7_8_Effects(sc, dataAny, nativeHero, overlays);

    _wpnApplyAimGhost({
        overlays,
        baseDir: renderDir as any,
        aimDx1000,
        aimDy1000,
        aimAngleMdeg,
        enabled: (WPN_AIM_RENDER_MODE === "ghost") && (!staffCast) && _wpnShouldAimRotate(weaponPhase)
    });

    // DEBUG follow + frame result logs (unchanged)
    _wpnDebugFollowAndFrameResultLog({
        ctx,
        dataAny,
        nativeHero,

        phaseRaw,
        displayedPhase,
        weaponPhase,
        weaponId,
        requestedDir,

        aState,

        nativeDir,
        nativeFco,
        arcadeFcoRaw,

        heroTexKey,
        heroFrameIndex,
        heroCol,
        heroCols,

        bgTexKey: wfi.bgTexKey,
        fgTexKey: wfi.fgTexKey,
        bgName: wfi.bgName,
        fgName: wfi.fgName,
        bgCol: wfi.bgCol,
        fgCol: wfi.fgCol,
        bgCols: wfi.bgCols,
        fgCols: wfi.fgCols,

        overlays
    });

    // Final visibility + state (unchanged)
    try { overlays.weaponBg.setVisible(true) } catch { }
    try { overlays.weaponFg.setVisible(true) } catch { }

    (nativeHero as any).__weaponVis = 1;
}


// 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃
// 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃
// 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃
// 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃 ────── 🌿 ────── 🍃  SECTION  🍃 ────── 🌿 ────── 🍃

//End of weapon section

// ------------------------------------------------------------
// World depth policy (y-sort)
// ------------------------------------------------------------
const WORLD_DEPTH_Y_SCALE = 100;

function _applyWorldDepthForNative(s: any, native: any): void {
  if (!native) return;

  // Don’t interfere with UI-managed natives
  if (native.getData && native.getData("uiManaged")) return;

  const eb = _getEngineCollisionBounds(s as any);
  const yPx =
    (eb && typeof eb.centerY === "number") ? (eb.centerY | 0) :
    (typeof native.y === "number") ? (native.y | 0) :
    (typeof s.y === "number") ? (s.y | 0) :
    0;

  const zBias = (typeof s.z === "number") ? (s.z | 0) : 0;
  const depth = ((yPx * WORLD_DEPTH_Y_SCALE) + zBias) | 0;

  try {
    if (native.setDepth) native.setDepth(depth);
    else native.depth = depth;
  } catch {}
}


export function syncHeroAuraForNative(
  native: Phaser.GameObjects.Sprite,
  auraActive: boolean,
  auraColorIndex: number,
  auraRadius?: number
)

function _applyHeroAuraGlow(nativeHero: any, auraActive: boolean, auraGlow: boolean, sc: any): void {
    if (!nativeHero) return;
    const auraAny: any = (nativeHero as any).__heroAuraImage;
    if (!auraAny) return;

    if (!auraActive || !auraGlow) {
        try { auraAny.setAlpha(1) } catch { }
        return;
    }

    const nowMs = (sc?.time?.now ?? Date.now()) as number;
    const t = (nowMs / SHOP_AURA_GLOW_PERIOD_MS) * Math.PI * 2;
    const pulse = 0.5 + 0.5 * Math.sin(t);
    const alpha = SHOP_AURA_GLOW_ALPHA_MIN + (SHOP_AURA_GLOW_ALPHA_MAX - SHOP_AURA_GLOW_ALPHA_MIN) * pulse;
    try { auraAny.setAlpha(alpha) } catch { }
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

    const dataAny: any = (s as any).data || {};
    const isEnemyLpc = !!dataAny.enemyLpc;
    if (role !== "HERO" && !isEnemyLpc) return;

    const nativeAny: any = s.native;
    if (!(nativeAny && nativeAny.getData && nativeAny.getData("isHeroNative"))) return;

    // ✅ IMPORTANT: set depth BEFORE weapon/auras read heroDepth
    _applyWorldDepthForNative(s, nativeAny);

    _copyHeroIdentityToNative(
        s as Sprite,
        nativeAny as Phaser.GameObjects.Sprite
    );

    _tryApplyHeroAnimationForNative(
        s,
        nativeAny as Phaser.GameObjects.Sprite
    );

    if (role === "HERO" && !isEnemyLpc) {
        const heroIndex = (dataAny[HERO_INDEX_DATA_KEY] as any | 0);
        _setHeroNativeByIndex(heroIndex, nativeAny);
    }

    const auraActive = !!(s.data && (s.data as any)["auraActive"]);
    const auraColor = ((s.data && (s.data as any)["auraColor"]) as any | 0);
    const auraGlow = !!(s.data && (s.data as any)["auraGlow"]);
    const auraRadius = ((s.data && (s.data as any)["auraRadius"]) as any | 0);

    heroAnimGlue.syncHeroAuraForNative(
        s.native,
        auraActive,
        auraColor,
        auraRadius
    );
    try {
        if (auraActive) {
            const k = "__heroAuraLogOnce_" + (nativeAny?.texture?.key ?? "") + ":" + (nativeAny?.frame?.name ?? "");
            const g: any = globalThis as any;
            if (!g[k]) {
                g[k] = 1;
                const auraImg: any = (nativeAny as any).__heroAuraImage;
                console.log("[AURA][HERO][RENDER]", {
                    heroTex: (nativeAny as any)?.texture?.key ?? "",
                    heroFrame: (nativeAny as any)?.frame?.name,
                    auraTex: auraImg?.texture?.key ?? "",
                    auraFrame: auraImg?.frame?.name,
                    visible: !!auraImg?.visible,
                    alpha: auraImg?.alpha ?? 0,
                    depth: auraImg?.depth ?? 0
                });
            }
        }
    } catch { /* ignore */ }
    _applyHeroAuraGlow(nativeAny, auraActive, auraGlow, ctx.sc);

    if (DEBUG_NPC_PIPELINE) {
        const isNpc = !!dataAny.isNpc || !!dataAny.npcLpc || !!dataAny._npcRole;
        if (isNpc) {
            const already = (s as any).getData ? (s as any).getData(NPC_PIPE_WEAPON_CALL_LOG_ONCE_KEY) : (dataAny[NPC_PIPE_WEAPON_CALL_LOG_ONCE_KEY] as any);
            if (!already) {
                try { (s as any).setData?.(NPC_PIPE_WEAPON_CALL_LOG_ONCE_KEY, 1); } catch { dataAny[NPC_PIPE_WEAPON_CALL_LOG_ONCE_KEY] = 1; }
                console.log("[NPC-PIPE][weapon.call]", {
                    heroName: String(dataAny.heroName || ""),
                    heroFamily: String(dataAny.heroFamily || ""),
                    phase: String(dataAny.phase || ""),
                    dir: String(dataAny.dir || ""),
                    wSlash: String(dataAny[HERO_WPN_SLASH_KEY] || ""),
                    wThrust: String(dataAny[HERO_WPN_THRUST_KEY] || ""),
                    wCast: String(dataAny[HERO_WPN_CAST_KEY] || ""),
                    wExec: String(dataAny[HERO_WPN_EXEC_KEY] || ""),
                    wCombo: String(dataAny[HERO_WPN_COMBO_KEY] || ""),
                    wInt: String(dataAny[HERO_WPN_INT_KEY] || ""),
                    wSup: String(dataAny[HERO_WPN_SUP_KEY] || "")
                });
            }
        }
    }

    try {
        const dataAny: any = (s as any).data || {};
        const heroIndex = (dataAny[HERO_INDEX_DATA_KEY] as any | 0);
        const wCast = (typeof dataAny[HERO_WPN_CAST_KEY] === "string") ? String(dataAny[HERO_WPN_CAST_KEY]) : "";
        if (wCast) _heroCastWeaponByIndex[heroIndex] = wCast;
    } catch { }

    _syncWeaponOverlaysForHeroNative(
        ctx,
        s,
        nativeAny as Phaser.GameObjects.Sprite
    );

    _syncHeroIntellectCastCrystals(
        ctx,
        s,
        nativeAny as Phaser.GameObjects.Sprite
    );
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
    const isEnemyLpc = !!data.enemyLpc;

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

    // ✅ Keep enemies y-sorted against props
    _applyWorldDepthForNative(s, nativeAny);

    if (!nativeAny || typeof nativeAny.setData !== "function") {
        return true;
    }

    nativeAny.setData("monsterId", monsterId);
    nativeAny.setData("name",      monsterId);
    nativeAny.setData("phase",     phase);
    nativeAny.setData("dir",       dir);

    if (!isEnemyLpc) {
        const glueAny: any = (globalThis as any).monsterAnimGlue || monsterAnimGlue;
        const enemySprite = nativeAny as Phaser.GameObjects.Sprite;

        if (glueAny && typeof glueAny.tryAttachMonsterSprite === "function") {
            glueAny.tryAttachMonsterSprite(enemySprite);
        } else if (glueAny && typeof glueAny.applyMonsterAnimationForSprite === "function") {
            glueAny.applyMonsterAnimationForSprite(enemySprite);
        }

        // Mirror aura sizing/foot data from native sprite onto Arcade sprite data
        // so engine-side nav/collision can anchor to the rendered feet.
        try {
            const dataAny: any = (s as any).data || {};
            const nativeData: any = nativeAny?.data;
            if (nativeData && typeof nativeData.get === "function") {
                const auraFrameW = nativeData.get("__monsterAuraFrameW");
                const auraFrameH = nativeData.get("__monsterAuraFrameH");
                const auraFoot = nativeData.get("__monsterAuraFootBottom");
                const auraOutline = nativeData.get("__monsterAuraOutline");
                const auraOutlineSides = nativeData.get("__monsterAuraOutlineSides");
                const auraMinX = nativeData.get("__monsterAuraMinX");
                const auraMinY = nativeData.get("__monsterAuraMinY");
                const auraMaxX = nativeData.get("__monsterAuraMaxX");
                const auraMaxY = nativeData.get("__monsterAuraMaxY");
                const auraCenterX = nativeData.get("__monsterAuraCenterX");
                const auraCenterY = nativeData.get("__monsterAuraCenterY");
                if (typeof auraFrameW === "number" && auraFrameW > 0 && dataAny.__monsterAuraFrameW !== (auraFrameW | 0)) {
                    dataAny.__monsterAuraFrameW = auraFrameW | 0;
                }
                if (typeof auraFrameH === "number" && auraFrameH > 0 && dataAny.__monsterAuraFrameH !== (auraFrameH | 0)) {
                    dataAny.__monsterAuraFrameH = auraFrameH | 0;
                }
                if (typeof auraFoot === "number" && auraFoot > 0 && dataAny.__monsterAuraFootBottom !== (auraFoot | 0)) {
                    dataAny.__monsterAuraFootBottom = auraFoot | 0;
                }
                if (Array.isArray(auraOutline) && dataAny.__monsterAuraOutline !== auraOutline) {
                    dataAny.__monsterAuraOutline = auraOutline;
                }
                if (typeof auraOutlineSides === "number" && dataAny.__monsterAuraOutlineSides !== (auraOutlineSides | 0)) {
                    dataAny.__monsterAuraOutlineSides = auraOutlineSides | 0;
                }
                if (typeof auraMinX === "number" && dataAny.__monsterAuraMinX !== (auraMinX | 0)) {
                    dataAny.__monsterAuraMinX = auraMinX | 0;
                }
                if (typeof auraMinY === "number" && dataAny.__monsterAuraMinY !== (auraMinY | 0)) {
                    dataAny.__monsterAuraMinY = auraMinY | 0;
                }
                if (typeof auraMaxX === "number" && dataAny.__monsterAuraMaxX !== (auraMaxX | 0)) {
                    dataAny.__monsterAuraMaxX = auraMaxX | 0;
                }
                if (typeof auraMaxY === "number" && dataAny.__monsterAuraMaxY !== (auraMaxY | 0)) {
                    dataAny.__monsterAuraMaxY = auraMaxY | 0;
                }
                if (typeof auraCenterX === "number" && dataAny.__monsterAuraCenterX !== (auraCenterX | 0)) {
                    dataAny.__monsterAuraCenterX = auraCenterX | 0;
                }
                if (typeof auraCenterY === "number" && dataAny.__monsterAuraCenterY !== (auraCenterY | 0)) {
                    dataAny.__monsterAuraCenterY = auraCenterY | 0;
                }
            }
        } catch { /* ignore */ }
    }

    // Enemy hit flash/punch (purely visual).
    try {
        const now = game.runtime() | 0;
        const flashUntil = sprites.readDataNumber(s, "__hitFlashUntil") | 0;
        const punchUntil = sprites.readDataNumber(s, "__hitPunchUntil") | 0;
        const punchMs = sprites.readDataNumber(s, "__hitPunchMs") | 0;
        const punchScaleX1000 = sprites.readDataNumber(s, "__hitPunchScaleX1000") | 0;
        const atkOffX = sprites.readDataNumber(s, "__atkVisOffX") | 0;
        const atkOffY = sprites.readDataNumber(s, "__atkVisOffY") | 0;
        const atkScaleX1000 = sprites.readDataNumber(s, "__atkVisScaleX1000") | 0;
        const atkScale = (atkScaleX1000 > 0) ? (atkScaleX1000 / 1000) : 1;

        if (typeof nativeAny.__hitBaseScaleX !== "number") {
            nativeAny.__hitBaseScaleX = (typeof nativeAny.scaleX === "number") ? nativeAny.scaleX : 1;
            nativeAny.__hitBaseScaleY = (typeof nativeAny.scaleY === "number") ? nativeAny.scaleY : 1;
        }

        const baseX = nativeAny.__hitBaseScaleX || 1;
        const baseY = nativeAny.__hitBaseScaleY || 1;

        if (punchUntil > now && punchMs > 0 && punchScaleX1000 > 0) {
            const t = (punchUntil - now) / punchMs;
            const amp = punchScaleX1000 / 1000;
            const pulse = 1 + amp * Math.sin(t * Math.PI);
            const sx = baseX * atkScale * pulse;
            const sy = baseY * atkScale * pulse;
            if (typeof nativeAny.setScale === "function") nativeAny.setScale(sx, sy);
            else { nativeAny.scaleX = sx; nativeAny.scaleY = sy; }
            nativeAny.__hitPunchActive = true;
        } else {
            if (nativeAny.__hitPunchActive || atkScale !== 1 || nativeAny.__atkTeleScaleActive) {
                const sx = baseX * atkScale;
                const sy = baseY * atkScale;
                if (typeof nativeAny.setScale === "function") nativeAny.setScale(sx, sy);
                else { nativeAny.scaleX = sx; nativeAny.scaleY = sy; }
            }
            nativeAny.__hitPunchActive = false;
        }
        nativeAny.__atkTeleScaleActive = (atkScale !== 1);

        if (atkOffX || atkOffY) {
            const basePosX = nativeAny.x;
            const basePosY = nativeAny.y;
            nativeAny.x = basePosX + atkOffX;
            nativeAny.y = basePosY + atkOffY;
            nativeAny.__atkTeleOffsetActive = true;
        } else if (nativeAny.__atkTeleOffsetActive) {
            // Base position will be reapplied by the sync loop; just clear the flag.
            nativeAny.__atkTeleOffsetActive = false;
        }

        if (flashUntil > now) {
            if (!nativeAny.__hitFlashActive) {
                if (typeof nativeAny.setTintFill === "function") nativeAny.setTintFill(0xffffff);
                else if (typeof nativeAny.setTint === "function") nativeAny.setTint(0xffffff);
                nativeAny.__hitFlashActive = true;
            }
        } else if (nativeAny.__hitFlashActive) {
            if (typeof nativeAny.clearTint === "function") nativeAny.clearTint();
            nativeAny.__hitFlashActive = false;
        }
    } catch { /* ignore */ }

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
// PURPOSE: Apply effect animation data onto native sprites (Phaser-side anim glue).
// READS:
//   - sprites.readDataString(s, "effectSkin" | "effectDir")
//   - role classification via _classifySpriteRole(kind, dataKeys)
// WRITES:
//   - nativeAny.setData("effectSkin"|"effectDir")
//   - triggers effectAnimGlue hook (side effect on native anim)
// PERF:
//   - Called: per-frame for EFFECT sprites
// SAFETY:
//   - Must tolerate missing native.setData / missing glue hook
// ---------------------------------------------------------------------
function _effectClearPaintMask(nativeAny: any): void {
    if (!nativeAny) return;
    if (DEBUG_EFFECT_MASKS && nativeAny.__effectPaintMaskType === "hero") {
        try {
            const id = (nativeAny.__arcadeSpriteId | 0) || 0;
            const key = "clear:" + id;
            if (!__effectMaskClearOnce.has(key)) {
                __effectMaskClearOnce.add(key);
                console.log("[effectmask][clear]", {
                    spriteId: id,
                    maskType: String(nativeAny.__effectPaintMaskType || "")
                });
            }
        } catch { /* ignore */ }
    }
    try { nativeAny.clearMask?.(true); } catch { }
    try {
        const g: any = nativeAny.__effectPaintMaskG;
        if (g && typeof g.destroy === "function") g.destroy();
    } catch { }
    try {
        const m: any = nativeAny.__effectPaintMask;
        if (m && typeof m.destroy === "function") m.destroy();
    } catch { }
    try { nativeAny.__effectPaintMask = undefined; } catch { }
    try { nativeAny.__effectPaintMaskG = undefined; } catch { }
    try { nativeAny.__effectPaintBrushPx = undefined; } catch { }
    try { nativeAny.__effectPaintMaskType = undefined; } catch { }
    try { nativeAny.__effectPaintMaskHeroId = undefined; } catch { }
    try { nativeAny.__effectPaintMaskSpriteId = undefined; } catch { }
}

function _effectAutoBrushPx(s: any, nativeAny: any): number {
    let base = 0;
    try {
        const img: any = (s as any).image;
        const w = (img?.width ?? 0) | 0;
        const h = (img?.height ?? 0) | 0;
        base = Math.min(w, h);
    } catch { }
    if (!base || base <= 0) {
        const dw = (nativeAny?.displayWidth ?? nativeAny?.width ?? 0) as number;
        const dh = (nativeAny?.displayHeight ?? nativeAny?.height ?? 0) as number;
        base = Math.min(dw || 0, dh || 0) | 0;
    }
    let r = Math.round(base * 0.25);
    if (!Number.isFinite(r) || r <= 0) r = 4;
    if (r < 4) r = 4;
    return r | 0;
}

function _effectEnsurePaintMask(sc: Phaser.Scene, nativeAny: any, brushPx: number): void {
    if (!nativeAny || !sc) return;
    if (nativeAny.__effectPaintMaskType === "hero") return;
    const px = Math.max(1, brushPx | 0);
    let g: Phaser.GameObjects.Graphics | undefined = nativeAny.__effectPaintMaskG;
    if (!g || !(g as any).scene || (g as any).destroyed) {
        try { _effectClearPaintMask(nativeAny); } catch { }
        g = sc.add.graphics();
        g.setVisible(false);
        nativeAny.__effectPaintMaskG = g;
    }
    const lastPx = nativeAny.__effectPaintBrushPx | 0;
    if ((lastPx | 0) !== (px | 0)) {
        g.clear();
        g.fillStyle(0xffffff, 1);
        g.fillCircle(0, 0, px);
        nativeAny.__effectPaintBrushPx = px | 0;
    }
    g.x = nativeAny.x;
    g.y = nativeAny.y;

    if (!nativeAny.__effectPaintMask) {
        const mask = g.createGeometryMask();
        nativeAny.setMask(mask);
        nativeAny.__effectPaintMask = mask;
        nativeAny.__effectPaintMaskType = "circle";
    }
}

function _ensureHeroAuraMaskImage(heroNative: any, radius: number): any | null {
    if (!heroNative) return null;
    const scene: any = heroNative.scene || (globalThis as any).__phaserScene;
    if (!scene) return null;

    const heroTexKey = heroNative.texture?.key ? String(heroNative.texture.key) : "";
    if (!heroTexKey) return null;

    const frameName =
        (heroNative.frame && (heroNative.frame.name !== undefined))
            ? heroNative.frame.name
            : undefined;
    if (frameName === undefined) return null;

    const r = radius | 0;
    let maskTexKey = "";
    let maskUsesFrame = false;
    try {
        const frameKey = String(frameName);
        const key = `__heroAuraMaskFx__${heroTexKey}::${frameKey}::r${r}`;
        if (!scene.textures.exists(key)) {
            const maskBits = heroAnimGlue.getOrBuildHeroAuraMaskBits(scene, heroTexKey, frameKey, r);
            heroAnimGlue.renderAuraTextureFromMaskBits(scene, key, maskBits, [255, 255, 255, 255]);
        }
        if (scene.textures.exists(key)) {
            maskTexKey = key;
            maskUsesFrame = false;
        }
    } catch { /* ignore */ }

    if (!maskTexKey) {
        const auraTexKey = auraKey(heroTexKey, r);
        if (!scene.textures || !scene.textures.exists(auraTexKey)) return null;
        const auraTex = scene.textures.get(auraTexKey);
        const auraFrame = auraTex.get(frameName as any);
        if (!auraFrame) return null;
        maskTexKey = auraTexKey;
        maskUsesFrame = true;
    }

    const cacheKey = `__heroAuraMaskImage_r${r}`;
    let maskImg: any = (heroNative as any)[cacheKey];
    if (!maskImg || !(maskImg as any).scene || (maskImg as any).destroyed) {
        maskImg = scene.add.image(
            heroNative.x,
            heroNative.y,
            maskTexKey,
            maskUsesFrame ? (frameName as any) : undefined
        );
        (heroNative as any)[cacheKey] = maskImg;
        if (typeof heroNative.originX === "number" && typeof heroNative.originY === "number") {
            maskImg.setOrigin(heroNative.originX, heroNative.originY);
        }
        maskImg.setVisible(false);
    } else {
        if (maskUsesFrame) maskImg.setTexture(maskTexKey, frameName as any);
        else maskImg.setTexture(maskTexKey);
    }

    maskImg.x = heroNative.x;
    maskImg.y = heroNative.y;
    maskImg.scaleX = (heroNative.scaleX ?? 1) as number;
    maskImg.scaleY = (heroNative.scaleY ?? 1) as number;
    maskImg.rotation = (heroNative.rotation ?? 0) as number;
    if (typeof maskImg.setFlipX === "function") {
        maskImg.setFlipX(!!heroNative.flipX);
    }
    if (typeof maskImg.setFlipY === "function") {
        maskImg.setFlipY(!!heroNative.flipY);
    }
    if (DEBUG_EFFECT_MASKS) {
        try {
            const key = maskTexKey + "::" + String(maskUsesFrame ? frameName : "__BASE");
            if (!__effectMaskKeyOnce.has(key)) {
                __effectMaskKeyOnce.add(key);
                console.log("[effectmask][mask]", {
                    key,
                    heroTex: heroTexKey,
                    heroFrame: frameName,
                    radius: r | 0,
                    maskTex: maskTexKey,
                    maskUsesFrame: !!maskUsesFrame,
                    w: (maskImg.width ?? 0) | 0,
                    h: (maskImg.height ?? 0) | 0
                });
            }
        } catch { /* ignore */ }
    }
    return maskImg;
}

function _effectEnsureHeroOutlineMask(nativeAny: any, heroNative: any): boolean {
    if (!nativeAny || !heroNative) return false;
    const radius = (nativeAny.__effectMaskRadius | 0);
    const auraImg: any = _ensureHeroAuraMaskImage(heroNative, radius | 0);
    if (!auraImg || !(auraImg as any).scene || (auraImg as any).destroyed) {
        if (DEBUG_EFFECT_MASKS) {
            try {
                const heroTex = heroNative?.texture?.key ?? "";
                const heroFrame = heroNative?.frame?.name ?? "";
                const key = "heroMissing:" + heroTex + ":" + heroFrame + ":r" + (radius | 0);
                if (!__effectMaskKeyOnce.has(key)) {
                    __effectMaskKeyOnce.add(key);
                    console.log("[effectmask][maskMissing]", {
                        heroTex,
                        heroFrame,
                        radius: radius | 0
                    });
                }
            } catch { /* ignore */ }
        }
        return false;
    }
    const auraFrame = (auraImg as any).frame;
    const auraTex = auraFrame?.texture || (auraImg as any).texture;
    if (!auraFrame || !auraTex || (auraTex as any).destroyed) {
        _effectClearPaintMask(nativeAny);
        return false;
    }

    const heroId = (heroNative as any).__heroNativeMaskId || (heroNative as any).name || heroNative;
    const lastType = nativeAny.__effectPaintMaskType;
    const lastHero = nativeAny.__effectPaintMaskHeroId;

    const wantInvert = !!nativeAny.__effectMaskInvert;
    if (lastType === "hero" && lastHero === heroId && nativeAny.__effectPaintMask) {
        try { nativeAny.__effectPaintMask.invertAlpha = wantInvert; } catch { }
        try { nativeAny.setMask?.(nativeAny.__effectPaintMask); } catch { }
        return true;
    }

    _effectClearPaintMask(nativeAny);

    try {
        const mask = auraImg.createBitmapMask();
        try { mask.invertAlpha = wantInvert; } catch { }
        nativeAny.setMask(mask);
        nativeAny.__effectPaintMask = mask;
        nativeAny.__effectPaintMaskType = "hero";
        nativeAny.__effectPaintMaskHeroId = heroId;
        return true;
    } catch {
        _effectClearPaintMask(nativeAny);
        return false;
    }
}

function _effectEnsureSpriteMask(nativeAny: any, maskNative: any): boolean {
    if (!nativeAny || !maskNative) return false;
    if (typeof (maskNative as any).createBitmapMask !== "function") {
        _effectClearPaintMask(nativeAny);
        return false;
    }
    if ((maskNative as any).destroyed || !(maskNative as any).scene) {
        _effectClearPaintMask(nativeAny);
        return false;
    }
    const frame = (maskNative as any).frame;
    const tex = frame?.texture || (maskNative as any).texture;
    if (!frame || !tex) {
        _effectClearPaintMask(nativeAny);
        return false;
    }
    if ((tex as any).destroyed) {
        _effectClearPaintMask(nativeAny);
        return false;
    }
    const scene = (maskNative as any).scene || (globalThis as any).__phaserScene;
    if (!scene) {
        _effectClearPaintMask(nativeAny);
        return false;
    }

    const texKey = String((tex as any).key || "");
    const frameName = (frame && frame.name !== undefined) ? frame.name : undefined;
    if (!texKey || frameName === undefined) {
        _effectClearPaintMask(nativeAny);
        return false;
    }
    if (!scene.textures || !scene.textures.exists(texKey)) {
        _effectClearPaintMask(nativeAny);
        return false;
    }
    const texEntry = scene.textures.get(texKey);
    const texFrame = texEntry?.get(frameName as any);
    if (!texEntry || !texFrame) {
        _effectClearPaintMask(nativeAny);
        return false;
    }
    const texSrc = texEntry?.source ? texEntry.source[0] : null;
    if (texSrc && !texSrc.glTexture && typeof (texEntry as any).refresh === "function") {
        try { (texEntry as any).refresh(); } catch { /* ignore */ }
    }
    if (texSrc && !texSrc.glTexture) {
        if (DEBUG_EFFECT_MASKS) {
            try {
                const key = "maskTexMissing:" + texKey + ":" + String(frameName);
                if (!__effectMaskKeyOnce.has(key)) {
                    __effectMaskKeyOnce.add(key);
                    console.log("[effectmask][maskMissing]", {
                        tex: texKey,
                        frame: String(frameName)
                    });
                }
            } catch { /* ignore */ }
        }
        _effectClearPaintMask(nativeAny);
        return false;
    }

    let maskImg: any = nativeAny.__effectMaskSpriteImg;
    if (!maskImg || !(maskImg as any).scene || (maskImg as any).destroyed) {
        maskImg = scene.add.image(maskNative.x, maskNative.y, texKey, frameName as any);
        maskImg.setVisible(false);
        nativeAny.__effectMaskSpriteImg = maskImg;
        if (!nativeAny.__effectMaskSpriteImgBound && typeof nativeAny.once === "function") {
            nativeAny.__effectMaskSpriteImgBound = 1;
            try {
                nativeAny.once("destroy", () => {
                    try { maskImg.destroy(); } catch { }
                });
            } catch { /* ignore */ }
        }
    } else {
        try { maskImg.setTexture(texKey, frameName as any); } catch { }
    }

    maskImg.x = maskNative.x;
    maskImg.y = maskNative.y;
    maskImg.scaleX = (maskNative.scaleX ?? 1) as number;
    maskImg.scaleY = (maskNative.scaleY ?? 1) as number;
    maskImg.rotation = (maskNative.rotation ?? 0) as number;
    if (typeof maskNative.originX === "number" && typeof maskNative.originY === "number") {
        try { maskImg.setOrigin(maskNative.originX, maskNative.originY); } catch { }
    }
    if (typeof maskImg.setFlipX === "function") {
        maskImg.setFlipX(!!maskNative.flipX);
    }
    if (typeof maskImg.setFlipY === "function") {
        maskImg.setFlipY(!!maskNative.flipY);
    }

    const maskId = (maskImg as any).__effectMaskSpriteId || (maskImg as any).name || maskImg;
    const lastType = nativeAny.__effectPaintMaskType;
    const lastMask = nativeAny.__effectPaintMaskSpriteId;
    if (lastType === "sprite" && lastMask === maskId && nativeAny.__effectPaintMask) {
        try { nativeAny.setMask?.(nativeAny.__effectPaintMask); } catch { }
        return true;
    }

    _effectClearPaintMask(nativeAny);

    try {
        const mask = maskImg.createBitmapMask();
        nativeAny.setMask(mask);
        nativeAny.__effectPaintMask = mask;
        nativeAny.__effectPaintMaskType = "sprite";
        nativeAny.__effectPaintMaskSpriteId = maskId;
        return true;
    } catch {
        _effectClearPaintMask(nativeAny);
        return false;
    }
}

function _effectApplyScale(nativeAny: any, scale: number, hasScale: boolean, pulseMult: number): void {
    if (!nativeAny) return;
    if (nativeAny.__effectBaseScaleX == null) {
        nativeAny.__effectBaseScaleX = (typeof nativeAny.scaleX === "number") ? nativeAny.scaleX : 1;
        nativeAny.__effectBaseScaleY = (typeof nativeAny.scaleY === "number") ? nativeAny.scaleY : 1;
    }
    const baseX = nativeAny.__effectBaseScaleX || 1;
    const baseY = nativeAny.__effectBaseScaleY || 1;
    const base = (hasScale && Number.isFinite(scale) && scale > 0) ? scale : 1;
    const pulse = (Number.isFinite(pulseMult) && pulseMult > 0) ? pulseMult : 1;
    const finalScale = base * pulse;
    const scaleOk = finalScale > 0 && Number.isFinite(finalScale);
    if (scaleOk) {
        const sx = baseX * finalScale;
        const sy = baseY * finalScale;
        if (typeof nativeAny.setScale === "function") nativeAny.setScale(sx, sy);
        else { nativeAny.scaleX = sx; nativeAny.scaleY = sy; }
        nativeAny.__effectScaleApplied = finalScale;
        return;
    }
    if (nativeAny.__effectScaleApplied) {
        if (typeof nativeAny.setScale === "function") nativeAny.setScale(baseX, baseY);
        else { nativeAny.scaleX = baseX; nativeAny.scaleY = baseY; }
        nativeAny.__effectScaleApplied = 0;
    }
}

function _effectBlendModeFromString(modeRaw: string): number | null {
    const mode = String(modeRaw || "").trim().toLowerCase();
    if (!mode) return null;
    switch (mode) {
        case "add":
        case "additive":
            return Phaser.BlendModes.ADD;
        case "screen":
            return Phaser.BlendModes.SCREEN;
        case "multiply":
        case "mul":
            return Phaser.BlendModes.MULTIPLY;
        case "normal":
        case "none":
        case "opaque":
            return Phaser.BlendModes.NORMAL;
        default:
            return null;
    }
}

function _syncEffectPath(
    ctx: SyncContext,
    s: any,
    native: any
): void {
    const dataKeys = Object.keys(s.data || {});
    const role = _classifySpriteRole(s.kind, dataKeys);
    if (role !== "EFFECT") return;

    if (!(s as any).data) (s as any).data = {};
    const data: any = (s as any).data;

    const skin = sprites.readDataString(s, EFFECT_SKIN_DATA_KEY) || "";
    const dir = sprites.readDataString(s, EFFECT_DIR_DATA_KEY) || "";
    const dbgId = sprites.readDataNumber(s, EFFECT_DEBUG_ID_KEY) | 0;
    const offX = sprites.readDataNumber(s, EFFECT_OFFX_DATA_KEY);
    const offY = sprites.readDataNumber(s, EFFECT_OFFY_DATA_KEY);
    const tintRaw = sprites.readDataNumber(s, EFFECT_TINT_DATA_KEY);
    const hasAlpha = Object.prototype.hasOwnProperty.call(data, EFFECT_ALPHA_DATA_KEY);
    const hasBlend = Object.prototype.hasOwnProperty.call(data, EFFECT_BLEND_DATA_KEY);
    const hasForceTop = Object.prototype.hasOwnProperty.call(data, EFFECT_FORCE_TOP_DATA_KEY);
    const hasFrameWindowMs = Object.prototype.hasOwnProperty.call(data, EFFECT_FRAME_WINDOW_MS_DATA_KEY);
    const hasFps = Object.prototype.hasOwnProperty.call(data, EFFECT_FPS_DATA_KEY);
    const hasRepeat = Object.prototype.hasOwnProperty.call(data, EFFECT_REPEAT_DATA_KEY);
    const hasScale = Object.prototype.hasOwnProperty.call(data, EFFECT_SCALE_DATA_KEY);
    const hasBrush = Object.prototype.hasOwnProperty.call(data, EFFECT_BRUSH_PX_DATA_KEY);
    const hasPopMs = Object.prototype.hasOwnProperty.call(data, EFFECT_POP_MS_DATA_KEY);
    const hasPopScale = Object.prototype.hasOwnProperty.call(data, EFFECT_POP_SCALE_DATA_KEY);
    const hasPopStart = Object.prototype.hasOwnProperty.call(data, EFFECT_POP_START_MS_DATA_KEY);
    const hasAlignBottom = Object.prototype.hasOwnProperty.call(data, EFFECT_ALIGN_BOTTOM_Y_DATA_KEY);
    const hasIntroMs = Object.prototype.hasOwnProperty.call(data, EFFECT_INTRO_MS_DATA_KEY);
    const hasIntroScale = Object.prototype.hasOwnProperty.call(data, EFFECT_INTRO_SCALE_DATA_KEY);
    const hasIntroStart = Object.prototype.hasOwnProperty.call(data, EFFECT_INTRO_START_MS_DATA_KEY);
    const hasAnimDelay = Object.prototype.hasOwnProperty.call(data, EFFECT_ANIM_DELAY_MS_DATA_KEY);
    const hasAnimDelayStart = Object.prototype.hasOwnProperty.call(data, EFFECT_ANIM_DELAY_START_MS_DATA_KEY);
    const hasMaskInvert = Object.prototype.hasOwnProperty.call(data, EFFECT_MASK_INVERT_DATA_KEY);
    const hasMaskRadius = Object.prototype.hasOwnProperty.call(data, EFFECT_MASK_RADIUS_DATA_KEY);
    const hasMaskRadiusPx = Object.prototype.hasOwnProperty.call(data, EFFECT_MASK_RADIUS_PX_DATA_KEY);
    const alpha = hasAlpha ? sprites.readDataNumber(s, EFFECT_ALPHA_DATA_KEY) : 0;
    const blend = hasBlend ? (sprites.readDataString(s, EFFECT_BLEND_DATA_KEY) || "") : "";
    const forceTopRaw = hasForceTop ? sprites.readDataNumber(s, EFFECT_FORCE_TOP_DATA_KEY) : 0;
    const forceTop = (forceTopRaw | 0) !== 0;
    const frameWindowMs = hasFrameWindowMs ? sprites.readDataNumber(s, EFFECT_FRAME_WINDOW_MS_DATA_KEY) : 0;
    const fps = hasFps ? sprites.readDataNumber(s, EFFECT_FPS_DATA_KEY) : 0;
    const repeat = hasRepeat ? sprites.readDataNumber(s, EFFECT_REPEAT_DATA_KEY) : 0;
    const scale = hasScale ? sprites.readDataNumber(s, EFFECT_SCALE_DATA_KEY) : 0;
    const brushPx = hasBrush ? sprites.readDataNumber(s, EFFECT_BRUSH_PX_DATA_KEY) : 0;
    const popMs = hasPopMs ? sprites.readDataNumber(s, EFFECT_POP_MS_DATA_KEY) : 0;
    const popScale = hasPopScale ? sprites.readDataNumber(s, EFFECT_POP_SCALE_DATA_KEY) : 0;
    const popStartRaw = hasPopStart ? sprites.readDataNumber(s, EFFECT_POP_START_MS_DATA_KEY) : 0;
    const alignBottomY = hasAlignBottom ? sprites.readDataNumber(s, EFFECT_ALIGN_BOTTOM_Y_DATA_KEY) : 0;
    const introMs = hasIntroMs ? sprites.readDataNumber(s, EFFECT_INTRO_MS_DATA_KEY) : 0;
    const introScale = hasIntroScale ? sprites.readDataNumber(s, EFFECT_INTRO_SCALE_DATA_KEY) : 0;
    const introStartRaw = hasIntroStart ? sprites.readDataNumber(s, EFFECT_INTRO_START_MS_DATA_KEY) : 0;
    const animDelayMs = hasAnimDelay ? sprites.readDataNumber(s, EFFECT_ANIM_DELAY_MS_DATA_KEY) : 0;
    const animDelayStartRaw = hasAnimDelayStart ? sprites.readDataNumber(s, EFFECT_ANIM_DELAY_START_MS_DATA_KEY) : 0;
    const maskInvertRaw = hasMaskInvert ? sprites.readDataNumber(s, EFFECT_MASK_INVERT_DATA_KEY) : 0;
    const maskRadiusRaw = hasMaskRadius ? sprites.readDataNumber(s, EFFECT_MASK_RADIUS_DATA_KEY) : 0;
    const maskRadiusPxRaw = hasMaskRadiusPx ? sprites.readDataNumber(s, EFFECT_MASK_RADIUS_PX_DATA_KEY) : 0;
    const maskInvert = (maskInvertRaw | 0) !== 0;
    const modeRaw = (sprites.readDataString(s, EFFECT_MODE_DATA_KEY) || "").trim().toLowerCase();
    const tint = Number.isFinite(tintRaw) ? (tintRaw as number) | 0 : 0;

    if (skin) {
        data[EFFECT_SKIN_DATA_KEY] = skin;
        (s as any)._lastNonZeroPixels = 1;
    }
    if (dir) data[EFFECT_DIR_DATA_KEY] = dir;
    if (Number.isFinite(offX)) data[EFFECT_OFFX_DATA_KEY] = offX;
    if (Number.isFinite(offY)) data[EFFECT_OFFY_DATA_KEY] = offY;
    if (tint) data[EFFECT_TINT_DATA_KEY] = tint;
    if (hasAlpha) data[EFFECT_ALPHA_DATA_KEY] = alpha;
    if (hasBlend) data[EFFECT_BLEND_DATA_KEY] = blend;
    if (hasForceTop) data[EFFECT_FORCE_TOP_DATA_KEY] = forceTopRaw;
    if (hasFrameWindowMs) data[EFFECT_FRAME_WINDOW_MS_DATA_KEY] = frameWindowMs;
    if (hasFps) data[EFFECT_FPS_DATA_KEY] = fps;
    if (hasRepeat) data[EFFECT_REPEAT_DATA_KEY] = repeat;
    if (hasScale) data[EFFECT_SCALE_DATA_KEY] = scale;
    if (hasBrush) data[EFFECT_BRUSH_PX_DATA_KEY] = brushPx;
    if (modeRaw) data[EFFECT_MODE_DATA_KEY] = modeRaw;
    if (hasPopMs) data[EFFECT_POP_MS_DATA_KEY] = popMs;
    if (hasPopScale) data[EFFECT_POP_SCALE_DATA_KEY] = popScale;
    if (hasPopStart) data[EFFECT_POP_START_MS_DATA_KEY] = popStartRaw;
    if (hasAlignBottom) data[EFFECT_ALIGN_BOTTOM_Y_DATA_KEY] = alignBottomY;
    if (hasIntroMs) data[EFFECT_INTRO_MS_DATA_KEY] = introMs;
    if (hasIntroScale) data[EFFECT_INTRO_SCALE_DATA_KEY] = introScale;
    if (hasIntroStart) data[EFFECT_INTRO_START_MS_DATA_KEY] = introStartRaw;
    if (hasAnimDelay) data[EFFECT_ANIM_DELAY_MS_DATA_KEY] = animDelayMs;
    if (hasAnimDelayStart) data[EFFECT_ANIM_DELAY_START_MS_DATA_KEY] = animDelayStartRaw;
    if (hasMaskInvert) data[EFFECT_MASK_INVERT_DATA_KEY] = maskInvertRaw;
    if (hasMaskRadius) data[EFFECT_MASK_RADIUS_DATA_KEY] = maskRadiusRaw;
    if (hasMaskRadiusPx) data[EFFECT_MASK_RADIUS_PX_DATA_KEY] = maskRadiusPxRaw;

    const nativeAny: any = s.native;
    if (!nativeAny || typeof nativeAny.setData !== "function") {
        try {
            const g: any = globalThis as any;
            if (g && g.__heEffectDebug && g.__heEffectDebug.enabled && dbgId > 0) {
                g.__heEffectDebug.mark(dbgId, "sync", {
                    spriteId: s.id | 0,
                    skin,
                    dir,
                    native: false
                });
            }
        } catch { }
        return;
    }

    if (nativeAny.__arcadeSpriteId == null) {
        nativeAny.__arcadeSpriteId = s.id | 0;
    }

    if (skin) nativeAny.setData(EFFECT_SKIN_DATA_KEY, skin);
    if (dir) nativeAny.setData(EFFECT_DIR_DATA_KEY, dir);
    if (tint) nativeAny.setData(EFFECT_TINT_DATA_KEY, tint);
    if (hasAlpha) nativeAny.setData(EFFECT_ALPHA_DATA_KEY, alpha);
    if (hasBlend) nativeAny.setData(EFFECT_BLEND_DATA_KEY, blend);
    if (hasForceTop) nativeAny.setData(EFFECT_FORCE_TOP_DATA_KEY, forceTopRaw);
    if (hasFrameWindowMs) nativeAny.setData(EFFECT_FRAME_WINDOW_MS_DATA_KEY, frameWindowMs);
    if (hasFps) nativeAny.setData(EFFECT_FPS_DATA_KEY, fps);
    if (hasRepeat) nativeAny.setData(EFFECT_REPEAT_DATA_KEY, repeat);
    if (hasScale) nativeAny.setData(EFFECT_SCALE_DATA_KEY, scale);
    if (hasBrush) nativeAny.setData(EFFECT_BRUSH_PX_DATA_KEY, brushPx);
    nativeAny.setData(EFFECT_MODE_DATA_KEY, modeRaw);
    if (hasPopMs) nativeAny.setData(EFFECT_POP_MS_DATA_KEY, popMs);
    if (hasPopScale) nativeAny.setData(EFFECT_POP_SCALE_DATA_KEY, popScale);
    if (hasPopStart) nativeAny.setData(EFFECT_POP_START_MS_DATA_KEY, popStartRaw);
    if (hasAlignBottom) nativeAny.setData(EFFECT_ALIGN_BOTTOM_Y_DATA_KEY, alignBottomY);
    if (hasIntroMs) nativeAny.setData(EFFECT_INTRO_MS_DATA_KEY, introMs);
    if (hasIntroScale) nativeAny.setData(EFFECT_INTRO_SCALE_DATA_KEY, introScale);
    if (hasIntroStart) nativeAny.setData(EFFECT_INTRO_START_MS_DATA_KEY, introStartRaw);
    if (hasAnimDelay) nativeAny.setData(EFFECT_ANIM_DELAY_MS_DATA_KEY, animDelayMs);
    if (hasAnimDelayStart) nativeAny.setData(EFFECT_ANIM_DELAY_START_MS_DATA_KEY, animDelayStartRaw);
    if (hasMaskInvert) nativeAny.setData(EFFECT_MASK_INVERT_DATA_KEY, maskInvertRaw);
    if (hasMaskRadius) nativeAny.setData(EFFECT_MASK_RADIUS_DATA_KEY, maskRadiusRaw);
    if (hasMaskRadiusPx) nativeAny.setData(EFFECT_MASK_RADIUS_PX_DATA_KEY, maskRadiusPxRaw);

    if (offX || offY) {
        nativeAny.x = (s.x as number) + (offX || 0);
        nativeAny.y = (s.y as number) + (offY || 0);
    }

    const glueAny: any = (globalThis as any).effectAnimGlue || effectAnimGlue;
    const effectSprite = nativeAny as Phaser.GameObjects.Sprite;

    try {
        const g: any = globalThis as any;
        if (g && g.__heEffectDebug && g.__heEffectDebug.enabled && dbgId > 0) {
            g.__heEffectDebug.mark(dbgId, "sync", {
                spriteId: s.id | 0,
                skin,
                dir,
                native: true
            });
        }
    } catch { }

    if (glueAny && typeof glueAny.tryAttachEffectSprite === "function") {
        glueAny.tryAttachEffectSprite(effectSprite);
    } else if (glueAny && typeof glueAny.applyEffectAnimationForSprite === "function") {
        glueAny.applyEffectAnimationForSprite(effectSprite);
    }

    if (hasMaskInvert) {
        nativeAny.__effectMaskInvert = maskInvert;
    }
    if (hasMaskRadius) {
        nativeAny.__effectMaskRadius = maskRadiusRaw | 0;
    } else if (nativeAny.__effectMaskRadius == null) {
        nativeAny.__effectMaskRadius = 0;
    }
    if (hasMaskRadiusPx) {
        nativeAny.__effectMaskRadiusPx = maskRadiusPxRaw | 0;
    } else if (nativeAny.__effectMaskRadiusPx == null) {
        nativeAny.__effectMaskRadiusPx = 0;
    }

    const hasHeroIndexKey = Object.prototype.hasOwnProperty.call(data, PROJ_HERO_INDEX_KEY);
    const heroIndexForDebug = hasHeroIndexKey ? sprites.readDataNumber(s, PROJ_HERO_INDEX_KEY) : -1;
    const heroRefForMask = sprites.readDataSprite(s, EFFECT_HERO_REF_DATA_KEY);
    const maskSpriteRef = sprites.readDataSprite(s, EFFECT_MASK_SPRITE_REF_DATA_KEY);
    const maskSpriteNative =
        (maskSpriteRef && !(maskSpriteRef.flags & SpriteFlag.Destroyed) && (maskSpriteRef as any).native)
            ? (maskSpriteRef as any).native
            : null;

    const wantsProjectileMask =
        modeRaw === "projectile" ||
        modeRaw === "proj" ||
        modeRaw === "sprite";
    const wantsHeroMaskOnly =
        wantsProjectileMask ||
        modeRaw === "silhouette" ||
        modeRaw === "mask" ||
        modeRaw === "outline";
    const wantsPaint =
        wantsHeroMaskOnly ||
        modeRaw === "paint" ||
        modeRaw === "painted" ||
        modeRaw === "reveal" ||
        modeRaw === "painted_reveal";

    if (DEBUG_EFFECT_MASKS) {
        try {
            const key = "init:" + String(s.id | 0);
            if (!__effectMaskInitOnce.has(key)) {
                __effectMaskInitOnce.add(key);
                console.log("[effectmask][init]", {
                    spriteId: s.id | 0,
                    skin,
                    dir,
                    mode: modeRaw || "",
                    wantsPaint: wantsPaint ? 1 : 0,
                    wantsHeroMaskOnly: wantsHeroMaskOnly ? 1 : 0,
                    heroIndex: heroIndexForDebug | 0,
                    hasHeroIndex: hasHeroIndexKey ? 1 : 0,
                    hasHeroRef: heroRefForMask ? 1 : 0,
                    hasMaskSprite: maskSpriteRef ? 1 : 0,
                    maskSpriteId: maskSpriteRef ? ((maskSpriteRef as any).id | 0) : 0,
                    maskRadius: maskRadiusRaw | 0,
                    maskRadiusPx: maskRadiusPxRaw | 0,
                    forceTop: forceTop ? 1 : 0
                });
            }
        } catch { /* ignore */ }
    }
    if (wantsPaint) {
        let usedHeroMask = false;
        let maskType = "none";
        if (wantsProjectileMask) {
            try {
                if (maskSpriteNative && _effectEnsureSpriteMask(nativeAny, maskSpriteNative)) {
                    usedHeroMask = true;
                    maskType = "sprite";
                    if (typeof maskSpriteNative.originX === "number" && typeof maskSpriteNative.originY === "number") {
                        try { nativeAny.setOrigin?.(maskSpriteNative.originX, maskSpriteNative.originY); } catch { }
                    }
                }
            } catch { }
        }
        const maskRadiusPx = (nativeAny.__effectMaskRadiusPx | 0);
        if (!usedHeroMask && !wantsProjectileMask && (maskRadiusPx | 0) > 0) {
            try {
                if (nativeAny.__effectPaintMaskType === "hero") _effectClearPaintMask(nativeAny);
            } catch { }
            _effectEnsurePaintMask(ctx.sc as any, nativeAny, maskRadiusPx | 0);
            usedHeroMask = true;
            maskType = "circle";
        }
        if (!usedHeroMask && !wantsProjectileMask) {
            try {
                let heroNative = hasHeroIndexKey ? _getHeroNativeByIndex(heroIndexForDebug | 0) : null;
                if (!heroNative && heroRefForMask && (heroRefForMask as any).native) {
                    const refNative = (heroRefForMask as any).native;
                    if (refNative && refNative.getData && refNative.getData("isHeroNative")) {
                        heroNative = refNative;
                        if (DEBUG_EFFECT_MASKS) {
                            try {
                                const key = "heroRef:" + String(s.id | 0);
                                if (!__effectMaskSyncOnce.has(key)) {
                                    __effectMaskSyncOnce.add(key);
                                    console.log("[effectmask][heroRef]", {
                                        spriteId: s.id | 0,
                                        heroIndex: heroIndexForDebug | 0
                                    });
                                }
                            } catch { /* ignore */ }
                        }
                    }
                }
                if (heroNative) {
                    if (_effectEnsureHeroOutlineMask(nativeAny, heroNative)) {
                        usedHeroMask = true;
                        maskType = "hero";
                        if (typeof heroNative.originX === "number" && typeof heroNative.originY === "number") {
                            try { nativeAny.setOrigin?.(heroNative.originX, heroNative.originY); } catch { }
                        }
                        if (Number.isFinite(heroNative.x as any)) nativeAny.x = heroNative.x;
                        if (Number.isFinite(heroNative.y as any)) nativeAny.y = heroNative.y;
                    }
                }
            } catch { }
        }
        if (!usedHeroMask) {
            if (nativeAny.__effectPaintMaskType) {
                _effectClearPaintMask(nativeAny);
            }
            if (!wantsHeroMaskOnly) {
                const brush = (hasBrush && (brushPx | 0) > 0) ? (brushPx | 0) : _effectAutoBrushPx(s, nativeAny);
                _effectEnsurePaintMask(ctx.sc as any, nativeAny, brush | 0);
                }
            if (wantsHeroMaskOnly) {
                nativeAny.setVisible?.(false);
                nativeAny.setAlpha?.(0);
                if (DEBUG_EFFECT_MASKS) {
                    try {
                        const key = "hide:" + String(s.id | 0);
                        if (!__effectMaskHideOnce.has(key)) {
                            __effectMaskHideOnce.add(key);
                            console.log("[effectmask][hide]", {
                                spriteId: s.id | 0,
                                heroIndex: heroIndexForDebug | 0,
                                mode: modeRaw || "",
                                maskType
                            });
                        }
                    } catch { /* ignore */ }
                }
                return;
            }
        }
        if (DEBUG_EFFECT_MASKS) {
            try {
                const key = "sync:" + String(s.id | 0);
                if (!__effectMaskSyncOnce.has(key)) {
                    __effectMaskSyncOnce.add(key);
                    const maskAttached = !!nativeAny.__effectPaintMask;
                    console.log("[effectmask][sync]", {
                        spriteId: s.id | 0,
                        heroIndex: heroIndexForDebug | 0,
                        mode: modeRaw || "",
                        maskType,
                        maskAttached: maskAttached ? 1 : 0,
                        maskRadius: maskRadiusRaw | 0,
                        maskRadiusPx: maskRadiusPxRaw | 0,
                        maskSpriteId: maskSpriteRef ? ((maskSpriteRef as any).id | 0) : 0,
                        wantsHeroMaskOnly: wantsHeroMaskOnly ? 1 : 0
                    });
                }
            } catch { /* ignore */ }
        }
    } else {
        if (DEBUG_EFFECT_MASKS) {
            try {
                const key = "skip:" + String(s.id | 0);
                if (!__effectMaskSkipOnce.has(key)) {
                    __effectMaskSkipOnce.add(key);
                    console.log("[effectmask][skip]", {
                        spriteId: s.id | 0,
                        mode: modeRaw || "",
                        wantsPaint: wantsPaint ? 1 : 0
                    });
                }
            } catch { /* ignore */ }
        }
        _effectClearPaintMask(nativeAny);
    }
    let nowMs = 0;
    const _nowMs = (): number => {
        if (nowMs) return nowMs | 0;
        nowMs = (ctx.sc && (ctx.sc as any).time && typeof (ctx.sc as any).time.now === "number")
            ? ((ctx.sc as any).time.now | 0)
            : (Date.now() | 0);
        return nowMs | 0;
    };

    let popMult = 1;
    if (hasPopMs && (popMs | 0) > 0) {
        let startMs = popStartRaw | 0;
        const curMs = _nowMs();
        if (!(startMs > 0)) {
            startMs = curMs | 0;
            data[EFFECT_POP_START_MS_DATA_KEY] = startMs | 0;
            try { nativeAny.setData(EFFECT_POP_START_MS_DATA_KEY, startMs | 0); } catch { }
        }
        const dur = Math.max(1, popMs | 0);
        const t = Math.max(0, Math.min(1, (curMs - startMs) / dur));
        const pulse = Math.sin(Math.PI * t);
        const amp = (hasPopScale && Number.isFinite(popScale)) ? popScale : 0.25;
        popMult = 1 + (amp * pulse);
    }

    let introMult = 1;
    if (hasIntroMs && (introMs | 0) > 0) {
        let startMs = introStartRaw | 0;
        const curMs = _nowMs();
        if (!(startMs > 0)) {
            startMs = curMs | 0;
            data[EFFECT_INTRO_START_MS_DATA_KEY] = startMs | 0;
            try { nativeAny.setData(EFFECT_INTRO_START_MS_DATA_KEY, startMs | 0); } catch { }
        }
        const dur = Math.max(1, introMs | 0);
        const t = Math.max(0, Math.min(1, (curMs - startMs) / dur));
        const startScale = (hasIntroScale && Number.isFinite(introScale) && introScale > 0)
            ? introScale
            : 0.25;
        introMult = startScale + ((1 - startScale) * t);
    }

    const totalMult = popMult * introMult;
    _effectApplyScale(nativeAny, scale, hasScale, totalMult);

    if (hasAlignBottom && (alignBottomY | 0) !== 0) {
        const dispH = (nativeAny.displayHeight ?? nativeAny.height ?? 0) as number;
        if (Number.isFinite(dispH) && dispH > 0) {
            const offYAdj = Number.isFinite(offY as any) ? (offY as number) : 0;
            nativeAny.y = (alignBottomY | 0) - (dispH * 0.5) + offYAdj;
        }
    }

    if (hasBlend) {
        const mode = _effectBlendModeFromString(blend);
        const lastMode = (nativeAny as any).__effectBlendMode;
        try {
            if (mode == null) {
                if (lastMode != null && typeof nativeAny.setBlendMode === "function") {
                    nativeAny.setBlendMode(Phaser.BlendModes.NORMAL);
                    (nativeAny as any).__effectBlendMode = null;
                }
            } else if (lastMode !== mode) {
                if (typeof nativeAny.setBlendMode === "function") nativeAny.setBlendMode(mode);
                (nativeAny as any).__effectBlendMode = mode;
            }
        } catch { /* ignore */ }
    }

    try {
        const lastTint = (nativeAny as any).__effectTint | 0;
        if (tint) {
            if ((lastTint | 0) !== (tint | 0)) {
                if (typeof nativeAny.setTint === "function") nativeAny.setTint(tint | 0);
                (nativeAny as any).__effectTint = tint | 0;
            }
        } else if (lastTint) {
            if (typeof nativeAny.clearTint === "function") nativeAny.clearTint();
            (nativeAny as any).__effectTint = 0;
        }
    } catch { /* ignore */ }
}

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

    if (DEBUG_SPRITE_SYNC && ctx.shouldLog) {
        console.log(
            "[SYNC] PIXEL-DESTROY",
            "| id", s.id,
            "| kind", s.kind,
            "| flags", flags,
            "| lastNonZero", lastNonZero
        );
    }

    try {
        const dataAny: any = (s as any).data || {};
        const role = _classifySpriteRole(s.kind, Object.keys(dataAny || {}));
        if (role === "HERO") {
            const heroIndex = (dataAny[HERO_INDEX_DATA_KEY] as any | 0);
            _clearHeroNativeByIndex(heroIndex, s.native);
        }
    } catch { }

    if (s.native && (s.native as any).destroy) {
        // Step 8: ensure weapon overlays are destroyed too
        _destroyWeaponOverlaysForHeroNative(s.native);

        // Intellect FX attachments (hero ring + projectile crystal)
        _destroyIntellectFxForNative(s.native);
        _effectClearPaintMask(s.native);

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
    if (!native) return;

    // ------------------------------------------------------------
    // Compute visibility inputs (existing behavior)
    // ------------------------------------------------------------
    const lastNonZero = (s as any)._lastNonZeroPixels ?? -1;
    const hasInvisibleFlag = !!(flags & SpriteFlag.Invisible);
    const autoHideByPixels = lastNonZero === 0;

    // ------------------------------------------------------------
    // UI-managed flag (needed early so we don't y-sort UI)
    // ------------------------------------------------------------
    const isUiManaged = !!(native && typeof native.getData === "function" && native.getData("uiManaged"));
    const dataAny: any = (s as any).data || {};
    const dataKeys = Object.keys(dataAny || {});
    const role = _classifySpriteRole((s.kind as any) | 0, dataKeys);
    const forceTop = (role === "EFFECT") && (((dataAny[EFFECT_FORCE_TOP_DATA_KEY] as any) | 0) !== 0);

    // ------------------------------------------------------------
    // Y-SORT DEPTH (NEW): apply only to non-UI native sprites
    // ------------------------------------------------------------
    if (!isUiManaged) {
        if (forceTop) {
            const depth = (EFFECT_FORCE_TOP_DEPTH + ((s as any).z | 0)) | 0;
            try {
                if (native.setDepth) native.setDepth(depth);
                else native.depth = depth;
            } catch { /* ignore */ }
        } else {
            _applyWorldDepthForNative(s, native);
        }
    }

    // ------------------------------------------------------------
    // DEBUG SNAPSHOT (heroes only, cast only)
    // ------------------------------------------------------------
    const nativeAny: any = native as any;
    const isHeroNative = !!(nativeAny && nativeAny.getData && nativeAny.getData("isHeroNative"));
    const heroName = (nativeAny && nativeAny.getData) ? ((nativeAny.getData("heroName") as any) || "") : "";
    const phase = (nativeAny && nativeAny.getData) ? ((nativeAny.getData("phase") as any) || "") : "";
    const dir = (nativeAny && nativeAny.getData) ? ((nativeAny.getData("dir") as any) || "") : "";
    const forceInvisibleVal =
        (nativeAny && nativeAny.getData) ? (nativeAny.getData(NATIVE_FORCE_INVISIBLE_KEY) as any) : undefined;
    const effectAlphaRaw =
        (nativeAny && nativeAny.getData) ? (nativeAny.getData(EFFECT_ALPHA_DATA_KEY) as any) : undefined;
    const effectAlphaNum = Number(effectAlphaRaw);
    const hasEffectAlpha = Number.isFinite(effectAlphaNum) && effectAlphaNum > 0 && effectAlphaNum <= 1;

    const shouldLogHero =
        !!DEBUG_INT_HERO_VIS &&
        isHeroNative &&
        phase === "cast" &&
        (!DEBUG_INT_HERO_NAME_FILTER || heroName === DEBUG_INT_HERO_NAME_FILTER);

    if (shouldLogHero) {
        console.log(
            "[PROVE][HERO-VIS][BEFORE]",
            "| id", s?.id,
            "| heroName", heroName,
            "| phase", phase,
            "| dir", dir,
            "| flags", flags,
            "| hasInvisibleFlag", hasInvisibleFlag,
            "| _lastNonZeroPixels", lastNonZero,
            "| autoHideByPixels", autoHideByPixels,
            "| __forceInvisible", forceInvisibleVal,
            "| native.visible", native.visible,
            "| native.alpha", native.alpha,
            "| native.depth", (nativeAny.depth ?? undefined),
            "| texKey", (nativeAny.texture && nativeAny.texture.key) ? nativeAny.texture.key : "",
            "| frame", (nativeAny.frame && (nativeAny.frame.name !== undefined)) ? nativeAny.frame.name : undefined,
            "| animKey", (nativeAny.anims && nativeAny.anims.currentAnim) ? nativeAny.anims.currentAnim.key : "",
            "| isPlaying", (nativeAny.anims && nativeAny.anims.isPlaying) ? true : false
        );
    }

    // ============================================================
    // PHASER-ONLY FORCE INVISIBLE (used for intellect spell projectile replacement)
    // ============================================================
    const forceInvisible = !!(
        native &&
        typeof native.getData === "function" &&
        native.getData(NATIVE_FORCE_INVISIBLE_KEY)
    );
    if (forceInvisible) {
        if (shouldLogHero) {
            console.log(
                "[PROVE][HERO-VIS][HIDDEN]",
                "REASON=__forceInvisible",
                "| id", s?.id,
                "| heroName", heroName,
                "| phase", phase,
                "| __forceInvisible", native.getData(NATIVE_FORCE_INVISIBLE_KEY)
            );
            // stack helps prove who set it (sometimes setData callsite is discoverable in devtools)
            const st = (new Error("[PROVE][HERO-VIS] __forceInvisible stack")).stack;
            if (st) console.log(st);
        }
        native.visible = false;
        native.alpha = 0;
        return;
    }

    // ------------------------------------------------------------
    // UI-managed visibility path (existing behavior)
    // ------------------------------------------------------------
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
        native.alpha = shouldBeVisible ? (hasEffectAlpha ? effectAlphaNum : 1) : 0;

        if (shouldLogHero) {
            console.log(
                "[PROVE][HERO-VIS][AFTER]",
                "| id", s?.id,
                "| heroName", heroName,
                "| phase", phase,
                "| RESULT visible", native.visible,
                "| alpha", native.alpha,
                "| REASON", (native.visible ? "visible" : ("uiManaged + " + (hasInvisibleFlag ? "InvisibleFlag" : "") + (autoHideByPixels ? " autoHideByPixels" : "")))
            );
        }
        return;
    }

    // ------------------------------------------------------------
    // Normal visibility path (existing behavior)
    // ------------------------------------------------------------
    const shouldBeVisible = !hasInvisibleFlag && !autoHideByPixels;
    native.visible = shouldBeVisible;
    native.alpha = shouldBeVisible ? (hasEffectAlpha ? effectAlphaNum : 1) : 0;

    if (shouldLogHero) {
        console.log(
            "[PROVE][HERO-VIS][AFTER]",
            "| id", s?.id,
            "| heroName", heroName,
            "| phase", phase,
            "| RESULT visible", native.visible,
            "| alpha", native.alpha,
            "| REASON",
            (native.visible ? "visible" :
                ("normal + " +
                    (hasInvisibleFlag ? "InvisibleFlag" : "") +
                    (autoHideByPixels ? " autoHideByPixels" : "")))
        );

        if (!native.visible) {
            const st = (new Error("[PROVE][HERO-VIS] hidden (normal path) stack")).stack;
            if (st) console.log(st);
        }
    }

    if (DEBUG_EFFECT_MASKS && role === "EFFECT") {
        try {
            const key = "vis:" + String(s.id | 0);
            if (!__effectMaskVisOnce.has(key)) {
                __effectMaskVisOnce.add(key);
                console.log("[effectmask][vis]", {
                    spriteId: s.id | 0,
                    visible: !!native.visible,
                    alpha: (native.alpha ?? 0),
                    depth: (native as any).depth ?? 0,
                    tex: (native as any).texture?.key ?? "",
                    frame: (native as any).frame?.name ?? "",
                    displayW: (native as any).displayWidth ?? (native as any).width ?? 0,
                    displayH: (native as any).displayHeight ?? (native as any).height ?? 0,
                    mode: String(dataAny[EFFECT_MODE_DATA_KEY] || ""),
                    maskType: String((native as any).__effectPaintMaskType || ""),
                    maskAttached: (native as any).__effectPaintMask ? 1 : 0,
                    forceTop: forceTop ? 1 : 0
                });
            }
        } catch { /* ignore */ }
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

    // Debug collider overlay (independent of perf logging)
    if (ctx.sc) {
        _debugDrawEnemyWallColliders(ctx.sc);
        _debugDrawEffectBounds(ctx.sc);
    }

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

    const shouldLogPerformance = false

    if (shouldLogPerformance) { console.log(
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
    }

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

// DEBUG_OVERLAPS and MAX_OVERLAP_DEBUG_LOGS are defined in src/debugFlags.ts
let _overlapDebugCount = 0;
let _processEventsCallCount = 0;

let _dbgColliderGfxWalls: Phaser.GameObjects.Graphics | null = null;
let _dbgColliderGfxEnemies: Phaser.GameObjects.Graphics | null = null;
let _dbgColliderGfxHeroes: Phaser.GameObjects.Graphics | null = null;
let _dbgColliderGfxDecor: Phaser.GameObjects.Graphics | null = null;
let _dbgEffectGfx: Phaser.GameObjects.Graphics | null = null;
let _dbgLoggedEnemyColliderOnce = false;
let _dbgLoggedHeroColliderOnce = false;

function _heroCollisionOffsetY(s: Sprite): number {
    if (!s) return 0;
    const dataAny: any = (s as any).data || {};
    const kind = (s.kind as number) | 0;
    const isEnemy = kind === SpriteKind.Enemy || !!dataAny.enemyLpc;
    const isNpc = !!dataAny.isNpc || !!dataAny.npcLpc || kind === (SpriteKind as any).NpcLpc;
    const isHero = isHeroSprite(s);
    if (!isHero && !isNpc && !isEnemy) return 0;
    if (isHero) {
        try {
            const g: any = (globalThis as any);
            const internals = g ? g.__HeroEnginePhaserInternals : null;
            if (internals && typeof internals.getHeroCollisionOffsetY === "function") {
                return (internals.getHeroCollisionOffsetY() | 0) | 0;
            }
        } catch { /* ignore */ }
    }
    const colH = (sprites.readDataNumber(s, "colH") | 0) || (s.height | 0);
    const spriteH = (s.height | 0) || ((s.image && (s.image.height | 0)) || 0);
    if (spriteH <= 0 || colH <= 0) return 0;
    return Math.max(0, ((spriteH - colH) >> 1) | 0);
}

function _debugEnsureColliderGfx(sc: Phaser.Scene): void {
    if (!_dbgColliderGfxWalls) {
        _dbgColliderGfxWalls = sc.add.graphics();
        try { (_dbgColliderGfxWalls as any).setDepth?.(999999); } catch { }
    }
    if (!_dbgColliderGfxEnemies) {
        _dbgColliderGfxEnemies = sc.add.graphics();
        try { (_dbgColliderGfxEnemies as any).setDepth?.(999999); } catch { }
    }
    if (!_dbgColliderGfxHeroes) {
        _dbgColliderGfxHeroes = sc.add.graphics();
        try { (_dbgColliderGfxHeroes as any).setDepth?.(999999); } catch { }
    }
    if (!_dbgColliderGfxDecor) {
        _dbgColliderGfxDecor = sc.add.graphics();
        try { (_dbgColliderGfxDecor as any).setDepth?.(999999); } catch { }
    }
}

function _debugEnsureEffectGfx(sc: Phaser.Scene): void {
    if (_dbgEffectGfx) return;
    _dbgEffectGfx = sc.add.graphics();
    try { (_dbgEffectGfx as any).setDepth?.(999999); } catch { }
}

function _debugDrawEffectBounds(sc: Phaser.Scene): void {
    if (!DEBUG_DRAW_EFFECT_BOUNDS) return;
    _debugEnsureEffectGfx(sc);
    const g = _dbgEffectGfx!;
    g.clear();

    const atlas = _getEffectAtlasFromScene(sc);
    const alpha = DEBUG_COLLIDER_ALPHA;

    for (const s of _allSprites) {
        const dataAny: any = (s as any).data || {};
        const role = _classifySpriteRole((s.kind as any) | 0, Object.keys(dataAny || {}));
        if (role !== "EFFECT") continue;
        const native: any = (s as any).native;
        if (!native) continue;

        const nx = (native.x ?? s.x ?? 0) as number;
        const ny = (native.y ?? s.y ?? 0) as number;
        const dw = (native.displayWidth ?? native.width ?? 0) as number;
        const dh = (native.displayHeight ?? native.height ?? 0) as number;
        if (dw > 0 && dh > 0) {
            g.lineStyle(1, DEBUG_COLLIDER_EFFECT_FRAME_COLOR, alpha);
            g.strokeRect(nx - dw / 2, ny - dh / 2, dw, dh);
        }

        const skin = (sprites.readDataString(s, EFFECT_SKIN_DATA_KEY) || "").trim();
        const dir = (sprites.readDataString(s, EFFECT_DIR_DATA_KEY) || "").trim();
        const resolved = _resolveEffectAtlasEntry(atlas, skin, dir);
        if (!resolved || !resolved.collisionBounds) continue;

        const bounds = resolved.collisionBounds;
        const frameW = (resolved.frameW | 0) || 0;
        const frameH = (resolved.frameH | 0) || 0;
        if (frameW <= 0 || frameH <= 0) continue;

        const scaleX = (dw > 0) ? (dw / frameW) : 1;
        const scaleY = (dh > 0) ? (dh / frameH) : 1;
        const frameCx = (frameW - 1) / 2;
        const frameCy = (frameH - 1) / 2;
        const cx = nx + ((bounds.centerX - frameCx) * scaleX);
        const cy = ny + ((bounds.centerY - frameCy) * scaleY);
        const bw = (bounds.w || frameW) * scaleX;
        const bh = (bounds.h || frameH) * scaleY;

        g.lineStyle(1, DEBUG_COLLIDER_EFFECT_PIXEL_COLOR, alpha);
        g.strokeRect(cx - bw / 2, cy - bh / 2, bw, bh);
    }
}

function _debugDrawEnemyWallColliders(sc: Phaser.Scene): void {
    if (
        !DEBUG_DRAW_WALL_COLLIDERS &&
        !DEBUG_DRAW_ENEMY_WALL_COLLIDERS &&
        !DEBUG_DRAW_ENEMY_SPRITE_BOUNDS &&
        !DEBUG_DRAW_ENEMY_COLLIDER_BOUNDS &&
        !DEBUG_DRAW_ENEMY_HITBOX &&
        !DEBUG_DRAW_ENEMY_NATIVE_BOUNDS &&
        !DEBUG_DRAW_ENEMY_NAV_FOOTPRINT &&
        !DEBUG_DRAW_ENEMY_AURA_BOUNDS &&
        !DEBUG_DRAW_DECOR_COLLIDERS &&
        !DEBUG_DRAW_EFFECT_BOUNDS &&
        !DEBUG_DRAW_HERO_WALL_COLLIDERS &&
        !DEBUG_DRAW_HERO_SPRITE_BOUNDS &&
        !DEBUG_DRAW_HERO_COLLIDER_BOUNDS &&
        !DEBUG_DRAW_HERO_HITBOX &&
        !DEBUG_DRAW_HERO_NATIVE_BOUNDS &&
        !DEBUG_DRAW_HERO_NAV_FOOTPRINT
    ) return;
    _debugEnsureColliderGfx(sc);
    const gWalls = _dbgColliderGfxWalls!;
    const gEnemies = _dbgColliderGfxEnemies!;
    const gHeroes = _dbgColliderGfxHeroes!;
    const gDecor = _dbgColliderGfxDecor!;
    gWalls.clear();
    gEnemies.clear();
    gHeroes.clear();
    gDecor.clear();

    const g: any = globalThis as any;
    const internals: any = g ? g.__HeroEnginePhaserInternals : null;

    // Walls: outline solid tiles as best-effort (assume non-zero tile id is solid for debug).
    if (DEBUG_DRAW_WALL_COLLIDERS && internals && typeof internals.getWorldTileMap === "function" && typeof internals.getWorldTileSize === "function") {
        const map = internals.getWorldTileMap() as number[][] | null;
        const tileSize = internals.getWorldTileSize() | 0;
        if (map && tileSize > 0) {
            gWalls.lineStyle(1, DEBUG_COLLIDER_WALL_COLOR, DEBUG_COLLIDER_ALPHA);
            for (let r = 0; r < map.length; r++) {
                const row = map[r];
                if (!row) continue;
                for (let c = 0; c < row.length; c++) {
                    const v = row[c] | 0;
                    if (v === 0) continue;
                    const x = c * tileSize;
                    const y = r * tileSize;
                    gWalls.strokeRect(x, y, tileSize, tileSize);
                }
            }
        }
    }

    // Decor colliders: draw trigger/solid bounds from decor collider sprites.
    if (DEBUG_DRAW_DECOR_COLLIDERS) {
        const kTrig = (((SpriteKind as any).DecorTrigger ?? DECOR_KIND_TRIGGER_FALLBACK) | 0);
        const kSol = (((SpriteKind as any).DecorSolid ?? DECOR_KIND_SOLID_FALLBACK) | 0);
        for (let i = 0; i < _allSprites.length; i++) {
            const s = _allSprites[i];
            if (!s) continue;
            const kind = (s.kind as number) | 0;
            const marked = (sprites.readDataNumber(s, DECOR_DATA_IS_COLLIDER) | 0) !== 0;
            const kindIsDecor = (kind === kTrig) || (kind === kSol);
            if (!marked && !kindIsDecor) continue;

            const w = s.width | 0;
            const h = s.height | 0;
            if (w <= 0 || h <= 0) continue;

            const left = (typeof (s as any).left === "number")
                ? ((s as any).left | 0)
                : (((s.x | 0) - (w >> 1)) | 0);
            const top = (typeof (s as any).top === "number")
                ? ((s as any).top | 0)
                : (((s.y | 0) - (h >> 1)) | 0);

            const role = sprites.readDataNumber(s, DECOR_DATA_ROLE) | 0;
            const color = (role === 1) ? DEBUG_COLLIDER_HIT_COLOR : DEBUG_COLLIDER_DECOR_COLOR;
            gDecor.lineStyle(1, color, DEBUG_COLLIDER_ALPHA);
            gDecor.strokeRect(left, top, w, h);
        }
    }

    // Enemies: outline the feet-based collision footprint used for wall checks.
    if (
        DEBUG_DRAW_ENEMY_WALL_COLLIDERS ||
        DEBUG_DRAW_ENEMY_SPRITE_BOUNDS ||
        DEBUG_DRAW_ENEMY_COLLIDER_BOUNDS ||
        DEBUG_DRAW_ENEMY_HITBOX ||
        DEBUG_DRAW_ENEMY_NATIVE_BOUNDS ||
        DEBUG_DRAW_ENEMY_NAV_FOOTPRINT ||
        DEBUG_DRAW_ENEMY_AURA_BOUNDS
    ) {
        for (let i = 0; i < _allSprites.length; i++) {
            const s = _allSprites[i];
            if (!s) continue;
            const role = _classifySpriteRole((s.kind as number) || 0, Object.keys((s as any).data || {}));
            if (role !== "ENEMY") continue;
            const auraH = sprites.readDataNumber(s, "__monsterAuraFrameH") | 0;
            const auraFoot = sprites.readDataNumber(s, "__monsterAuraFootBottom") | 0;
            const auraW = sprites.readDataNumber(s, "__monsterAuraFrameW") | 0;
            const auraCenterX = sprites.readDataNumber(s, "__monsterAuraCenterX") | 0;
            const auraCenterY = sprites.readDataNumber(s, "__monsterAuraCenterY") | 0;
            const auraMaxY = sprites.readDataNumber(s, "__monsterAuraMaxY") | 0;

            const cw = (sprites.readDataNumber(s, "colW") | 0) || (s.width | 0);
            const ch = (sprites.readDataNumber(s, "colH") | 0) || (s.height | 0);
            const img: any = (s as any).image;
            const dispH = (((img && img.height) ? (img.height | 0) : ((s.height | 0) || 0)) | 0) || (ch | 0);
            let offY = Math.idiv((dispH - (ch | 0)) | 0, 2) | 0;
            if (offY < 0) offY = 0;

            const footX = s.x | 0;
            let footY = 0;
            if (auraMaxY > 0 && auraH > 0) {
                const centerY = (auraCenterY || Math.idiv(auraH | 0, 2) | 0) | 0;
                footY = (((s.y | 0) - centerY + (auraMaxY | 0)) | 0);
            } else if (auraFoot > 0 && auraH > 0) {
                const halfAuraH = Math.idiv(auraH | 0, 2) | 0;
                footY = (((s.y | 0) - halfAuraH + (auraFoot | 0)) | 0);
            } else {
                footY = (((s.y | 0) + offY + (Math.idiv((ch | 0), 2) | 0) - 1) | 0);
            }

            const spriteW = s.width | 0;
            const spriteH = s.height | 0;
            const spriteLeft = ((s.x | 0) - (spriteW >> 1)) | 0;
            const spriteTop = ((s.y | 0) - (spriteH >> 1)) | 0;

            const colW = cw | 0;
            const colH = ch | 0;
            const colLeft = ((s.x | 0) - (colW >> 1)) | 0;
            const colTop = ((s.y | 0) - (colH >> 1)) | 0;

            const hitBounds = _getEngineCollisionBounds(s);
            const hitLeft = hitBounds ? (hitBounds.left | 0) : spriteLeft;
            const hitTop = hitBounds ? (hitBounds.top | 0) : spriteTop;
            const hitRight = hitBounds ? (hitBounds.right | 0) : ((spriteLeft + spriteW - 1) | 0);
            const hitBottom = hitBounds ? (hitBounds.bottom | 0) : ((spriteTop + spriteH - 1) | 0);
            const hitW = ((hitRight - hitLeft + 1) | 0);
            const hitH = ((hitBottom - hitTop + 1) | 0);

            const fw = Math.min(cw | 0, DEBUG_ENEMY_WALL_FOOTPRINT_PX | 0) | 0;
            const fh = Math.min(ch | 0, DEBUG_ENEMY_WALL_FOOTPRINT_PX | 0) | 0;
            const wallLeft = (footX - (fw >> 1)) | 0;
            const wallTop = (footY - fh + 1) | 0;

            const navW = Math.min(cw | 0, DEBUG_ENEMY_FOOTPRINT_MAX_PX | 0) | 0;
            const navH = Math.min(ch | 0, DEBUG_ENEMY_FOOTPRINT_MAX_PX | 0) | 0;
            const navLeft = (footX - (navW >> 1)) | 0;
            const navTop = (footY - navH + 1) | 0;

            const auraLeft = (auraW > 0 ? ((s.x | 0) - ((auraCenterX || (auraW >> 1)) | 0)) : 0) | 0;
            const auraTop = (auraH > 0 ? ((s.y | 0) - ((auraCenterY || (auraH >> 1)) | 0)) : 0) | 0;

            if (DEBUG_DRAW_ENEMY_SPRITE_BOUNDS) {
                gEnemies.lineStyle(1, DEBUG_COLLIDER_SPRITE_COLOR, DEBUG_COLLIDER_ALPHA);
                gEnemies.strokeRect(spriteLeft, spriteTop, spriteW, spriteH);
            }
            if (DEBUG_DRAW_ENEMY_COLLIDER_BOUNDS) {
                gEnemies.lineStyle(1, DEBUG_COLLIDER_BODY_COLOR, DEBUG_COLLIDER_ALPHA);
                gEnemies.strokeRect(colLeft, colTop, colW, colH);
            }
            if (DEBUG_DRAW_ENEMY_HITBOX) {
                gEnemies.lineStyle(1, DEBUG_COLLIDER_HIT_COLOR, DEBUG_COLLIDER_ALPHA);
                gEnemies.strokeRect(hitLeft, hitTop, hitW, hitH);
            }
            if (DEBUG_DRAW_ENEMY_NATIVE_BOUNDS) {
                const native: any = (s as any).native;
                if (native && typeof native.getBounds === "function") {
                    const b = native.getBounds();
                    gEnemies.lineStyle(1, DEBUG_COLLIDER_NATIVE_COLOR, DEBUG_COLLIDER_ALPHA);
                    gEnemies.strokeRect(b.x, b.y, b.width, b.height);
                }
            }
            if (DEBUG_DRAW_ENEMY_AURA_BOUNDS && auraW > 0 && auraH > 0) {
                const auraOutline = (s as any).data ? (s as any).data.__monsterAuraOutline : null;
                gEnemies.lineStyle(1, DEBUG_COLLIDER_AURA_COLOR, DEBUG_COLLIDER_ALPHA);
                if (Array.isArray(auraOutline) && auraOutline.length >= 3) {
                    let moved = false;
                    gEnemies.beginPath();
                    for (let p = 0; p < auraOutline.length; p++) {
                        const pt = auraOutline[p];
                        if (!Array.isArray(pt) || pt.length < 2) continue;
                        const px = (auraLeft + (pt[0] | 0)) | 0;
                        const py = (auraTop + (pt[1] | 0)) | 0;
                        if (!moved) {
                            gEnemies.moveTo(px, py);
                            moved = true;
                        } else {
                            gEnemies.lineTo(px, py);
                        }
                    }
                    if (moved) {
                        gEnemies.closePath();
                        gEnemies.strokePath();
                    }
                } else {
                    gEnemies.strokeRect(auraLeft, auraTop, auraW, auraH);
                }
            }
            if (DEBUG_DRAW_ENEMY_NAV_FOOTPRINT && navW > 0 && navH > 0) {
                gEnemies.lineStyle(1, DEBUG_COLLIDER_NAV_COLOR, DEBUG_COLLIDER_ALPHA);
                gEnemies.strokeRect(navLeft, navTop, navW, navH);
            }
            if (DEBUG_DRAW_ENEMY_WALL_COLLIDERS) {
                gEnemies.lineStyle(1, DEBUG_COLLIDER_ENEMY_COLOR, DEBUG_COLLIDER_ALPHA);
                gEnemies.strokeRect(wallLeft, wallTop, fw, fh);
            }

            if (!_dbgLoggedEnemyColliderOnce) {
                _dbgLoggedEnemyColliderOnce = true;
                console.log("[DEBUG][ENEMY_COLLIDER]", {
                    id: sprites.readDataString(s, "monsterId") || sprites.readDataString(s, "id") || s.id,
                    pos: { x: s.x | 0, y: s.y | 0 },
                    aura: {
                        frameW: auraW | 0,
                        frameH: auraH | 0,
                        footBottom: auraFoot | 0,
                        centerX: auraCenterX | 0,
                        centerY: auraCenterY | 0,
                        minX: sprites.readDataNumber(s, "__monsterAuraMinX") | 0,
                        minY: sprites.readDataNumber(s, "__monsterAuraMinY") | 0,
                        maxX: sprites.readDataNumber(s, "__monsterAuraMaxX") | 0,
                        maxY: auraMaxY | 0,
                    },
                    sprite: { left: spriteLeft, top: spriteTop, right: spriteLeft + spriteW - 1, bottom: spriteTop + spriteH - 1, w: spriteW, h: spriteH },
                    collider: { left: colLeft, top: colTop, right: colLeft + colW - 1, bottom: colTop + colH - 1, w: colW, h: colH },
                    hitbox: { left: hitLeft, top: hitTop, right: hitRight, bottom: hitBottom, w: hitW, h: hitH },
                    nav: { left: navLeft, top: navTop, right: navLeft + navW - 1, bottom: navTop + navH - 1, w: navW, h: navH },
                    wall: { left: wallLeft, top: wallTop, right: wallLeft + fw - 1, bottom: wallTop + fh - 1, w: fw, h: fh },
                });
            }
        }
    }

    // Heroes: outline collider + footprint bounds.
    if (
        DEBUG_DRAW_HERO_WALL_COLLIDERS ||
        DEBUG_DRAW_HERO_SPRITE_BOUNDS ||
        DEBUG_DRAW_HERO_COLLIDER_BOUNDS ||
        DEBUG_DRAW_HERO_HITBOX ||
        DEBUG_DRAW_HERO_NATIVE_BOUNDS ||
        DEBUG_DRAW_HERO_NAV_FOOTPRINT
    ) {
        for (let i = 0; i < _allSprites.length; i++) {
            const s = _allSprites[i];
            if (!s) continue;
            const dataAny: any = (s as any).data || {};
            if (dataAny.enemyLpc) continue;

            let isHero = false;
            try {
                isHero = isHeroSprite(s);
            } catch {
                const kind = (s.kind as number) | 0;
                if (kind === SpriteKind.Player || kind === (SpriteKind as any).Hero) isHero = true;
                if (dataAny.heroName || dataAny.heroFamily || dataAny.heroIndex != null) isHero = true;
                if (dataAny.isNpc || dataAny.npcLpc || kind === (SpriteKind as any).NpcLpc) isHero = false;
            }
            if (!isHero) continue;

            const kind = (s.kind as number) | 0;
            if (dataAny.isNpc || dataAny.npcLpc || kind === (SpriteKind as any).NpcLpc) continue;

            const colW = (sprites.readDataNumber(s, "colW") | 0) || (s.width | 0);
            const colH = (sprites.readDataNumber(s, "colH") | 0) || (s.height | 0);
            const offY = _heroCollisionOffsetY(s);

            const spriteW = s.width | 0;
            const spriteH = s.height | 0;
            const spriteLeft = ((s.x | 0) - (spriteW >> 1)) | 0;
            const spriteTop = ((s.y | 0) - (spriteH >> 1)) | 0;

            const colLeft = ((s.x | 0) - (colW >> 1)) | 0;
            const colTop = (((s.y | 0) + (offY | 0)) - (colH >> 1)) | 0;

            const hitBounds = _getEngineCollisionBounds(s);
            const hitLeft = hitBounds ? (hitBounds.left | 0) : colLeft;
            const hitTop = hitBounds ? (hitBounds.top | 0) : colTop;
            const hitRight = hitBounds ? (hitBounds.right | 0) : ((colLeft + colW - 1) | 0);
            const hitBottom = hitBounds ? (hitBounds.bottom | 0) : ((colTop + colH - 1) | 0);
            const hitW = ((hitRight - hitLeft + 1) | 0);
            const hitH = ((hitBottom - hitTop + 1) | 0);

            const footX = s.x | 0;
            const footY = (((s.y | 0) + (offY | 0) + (Math.idiv((colH | 0), 2) | 0) - 1) | 0);
            const wallLeft = (footX - (colW >> 1)) | 0;
            const wallTop = (footY - colH + 1) | 0;

            const navLeft = wallLeft;
            const navTop = wallTop;

            if (DEBUG_DRAW_HERO_SPRITE_BOUNDS) {
                gHeroes.lineStyle(1, DEBUG_COLLIDER_SPRITE_COLOR, DEBUG_COLLIDER_ALPHA);
                gHeroes.strokeRect(spriteLeft, spriteTop, spriteW, spriteH);
            }
            if (DEBUG_DRAW_HERO_COLLIDER_BOUNDS) {
                gHeroes.lineStyle(1, DEBUG_COLLIDER_BODY_COLOR, DEBUG_COLLIDER_ALPHA);
                gHeroes.strokeRect(colLeft, colTop, colW, colH);
            }
            if (DEBUG_DRAW_HERO_HITBOX) {
                gHeroes.lineStyle(1, DEBUG_COLLIDER_HIT_COLOR, DEBUG_COLLIDER_ALPHA);
                gHeroes.strokeRect(hitLeft, hitTop, hitW, hitH);
            }
            if (DEBUG_DRAW_HERO_NATIVE_BOUNDS) {
                const native: any = (s as any).native;
                if (native && typeof native.getBounds === "function") {
                    const b = native.getBounds();
                    gHeroes.lineStyle(1, DEBUG_COLLIDER_NATIVE_COLOR, DEBUG_COLLIDER_ALPHA);
                    gHeroes.strokeRect(b.x, b.y, b.width, b.height);
                }
            }
            if (DEBUG_DRAW_HERO_NAV_FOOTPRINT) {
                gHeroes.lineStyle(1, DEBUG_COLLIDER_NAV_COLOR, DEBUG_COLLIDER_ALPHA);
                gHeroes.strokeRect(navLeft, navTop, colW, colH);
            }
            if (DEBUG_DRAW_HERO_WALL_COLLIDERS) {
                gHeroes.lineStyle(1, DEBUG_COLLIDER_ENEMY_COLOR, DEBUG_COLLIDER_ALPHA);
                gHeroes.strokeRect(wallLeft, wallTop, colW, colH);
            }

            if (!_dbgLoggedHeroColliderOnce) {
                _dbgLoggedHeroColliderOnce = true;
                console.log("[DEBUG][HERO_COLLIDER]", {
                    id: sprites.readDataString(s, "name") || sprites.readDataString(s, "heroName") || s.id,
                    pos: { x: s.x | 0, y: s.y | 0 },
                    sprite: { left: spriteLeft, top: spriteTop, right: spriteLeft + spriteW - 1, bottom: spriteTop + spriteH - 1, w: spriteW, h: spriteH },
                    collider: { left: colLeft, top: colTop, right: colLeft + colW - 1, bottom: colTop + colH - 1, w: colW, h: colH },
                    hitbox: { left: hitLeft, top: hitTop, right: hitRight, bottom: hitBottom, w: hitW, h: hitH },
                    wall: { left: wallLeft, top: wallTop, right: wallLeft + colW - 1, bottom: wallTop + colH - 1, w: colW, h: colH },
                });
            }
        }
    }
}


function _syncFocusOutlineForNative(
    ctx: SyncContext,
    s: any,
    native: any
): void {
    if (!s) return;

    const active = _readDataNumber0(s, FOCUS_OUTLINE_ACTIVE_KEY, 0) | 0;
    const color = _readDataNumber0(s, FOCUS_OUTLINE_COLOR_KEY, 1) | 0;
    const radius = _readDataNumber0(s, FOCUS_OUTLINE_RADIUS_KEY, 2) | 0;
    const depthBias = _readDataNumber0(s, FOCUS_OUTLINE_DEPTH_BIAS_KEY, 1) | 0;

    // Decor props: target the prop display object and use true outline from pre-baked aura sheets.
    try {
        const decorName = (sprites.readDataString(s, DECOR_DATA_NAME) || "");
        if (decorName) {
            const r = (sprites.readDataNumber(s, DECOR_DATA_TILE_R) | 0);
            const c = (sprites.readDataNumber(s, DECOR_DATA_TILE_C) | 0);
            const renderer: any = ctx?.sc?.registry ? ctx.sc.registry.get("__worldTileRenderer") : null;
            try {
                const k = `__focusOutlineDecorSync__${decorName}:${r},${c}:${active}`;
                const g: any = globalThis as any;
                if (!g[k]) {
                    g[k] = 1;
                    if (DECOR_DEBUG) {
                        console.log("[FOCUS][DECOR][SYNC]", {
                            name: decorName,
                            r,
                            c,
                            active,
                            radius,
                            depthBias,
                            renderer: !!renderer
                        });
                    }
                }
            } catch { /* ignore */ }
            if (renderer) {
                let propObjs: any[] | null =
                    (typeof renderer.tryGetPropDisplaysAtAnchor === "function"
                        ? renderer.tryGetPropDisplaysAtAnchor(r, c)
                        : null);
                if (!propObjs || !propObjs.length) {
                    const single =
                        (typeof renderer.tryGetPropDisplayAtAnchor === "function"
                            ? renderer.tryGetPropDisplayAtAnchor(r, c)
                            : null) ||
                        (typeof renderer.tryGetPropDisplayAt === "function"
                            ? renderer.tryGetPropDisplayAt(r, c)
                            : null);
                    propObjs = single ? [single] : null;
                }
                if (propObjs && propObjs.length) {
                    for (let i = 0; i < propObjs.length; i++) {
                        const obj = propObjs[i];
                        if (obj && (obj as any).__propOutlineOverrideActive) return;
                    }
                    for (let i = 0; i < propObjs.length; i++) {
                        const obj = propObjs[i];
                        if (!obj) continue;
                        heroAnimGlue.syncOutlineForNative(obj, active !== 0, color, radius, depthBias);
                    }
                    return;
                }
            }
        }
    } catch { /* ignore */ }

    if (!native) return;
    if (native.getData && native.getData("uiManaged")) return;

    // Everything else: fallback to heroAnimGlue outline.
    heroAnimGlue.syncOutlineForNative(native, active !== 0, color, radius, depthBias);
}


function _syncFocusOutlineForNativeOLDCODETODELETE(
    ctx: SyncContext,
    s: any,
    native: any
): void {
    if (!native || !s) return;
    if (native.getData && native.getData("uiManaged")) return;

    const active = _readDataNumber0(s, FOCUS_OUTLINE_ACTIVE_KEY, 0) | 0;
    const color = _readDataNumber0(s, FOCUS_OUTLINE_COLOR_KEY, 1) | 0;
    const radius = _readDataNumber0(s, FOCUS_OUTLINE_RADIUS_KEY, 2) | 0;
    const depthBias = _readDataNumber0(s, FOCUS_OUTLINE_DEPTH_BIAS_KEY, 1) | 0;

    let targetNative: any = native;
    try {
        const name = (sprites.readDataString(s, DECOR_DATA_NAME) || "");
        if (name) {
            const r = (sprites.readDataNumber(s, DECOR_DATA_TILE_R) | 0);
            const c = (sprites.readDataNumber(s, DECOR_DATA_TILE_C) | 0);
            const renderer: any = ctx?.sc?.registry ? ctx.sc.registry.get("__worldTileRenderer") : null;
            if (renderer && typeof renderer.tryGetPropDisplayAt === "function") {
                const propObj = renderer.tryGetPropDisplayAt(r, c);
                  if (propObj) {
                      targetNative = propObj;
                      if (name.toLowerCase().includes("chest")) {
                          (targetNative as any).__forceOutlineBuild = FORCE_PROP_PREBAKED_OUTLINE;
                      }
                      if (name.toLowerCase().includes("chest")) {
                          const frameIndex = _decor_tryGetPropFrameIndexAt(renderer, r, c);
                          const primaryKey = _decor_getPrimaryTileTextureKey(renderer);
                          const propTexKey = propObj?.texture?.key ?? "";
                          const propFrame = propObj?.frame?.name ?? null;
                          if (DEBUG_PROP_OUTLINE_VERBOSE) {
                              console.log("[FOCUS][CHEST][PROP-FRAME]", {
                                  name,
                                  r,
                                  c,
                                  propTexKey,
                                  propFrame,
                                  frameIndex,
                                  primaryKey,
                                  auraTexKey: propTexKey ? auraKey(propTexKey, 0) : ""
                              });
                          }
                      }
                      const k = "__focusOutlineDecorOnce_" + String(name) + ":" + (r | 0) + "," + (c | 0);
                      const g: any = globalThis as any;
                    if (!g[k]) {
                        g[k] = 1;
                        if (DECOR_DEBUG) {
                            console.log("[FOCUS][DECOR] outline target resolved", { name, r, c, tex: propObj.texture?.key ?? "" });
                        }
                    }
                } else {
                    console.log("[AURA][PROPS] no prop display for decor", { name, r, c });
                }
            }
        }
    } catch { /* ignore */ }

    heroAnimGlue.syncOutlineForNative(targetNative, active !== 0, color, radius, depthBias);
}

function _getEngineCollisionBounds(s: Sprite): any | null {
    try {
        const g: any = (globalThis as any);
        const internals = g ? g.__HeroEnginePhaserInternals : null;
        if (internals && typeof internals.getCollisionBoundsForSprite === "function") {
            return internals.getCollisionBoundsForSprite(s);
        }
    } catch { /* ignore */ }
    return null;
}

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
            if (DEBUG_OVERLAPS && _onOverlapLogCount < MAX_ON_OVERLAP_LOGS) {
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

            const ebA = _getEngineCollisionBounds(a);
            const ebB = _getEngineCollisionBounds(b);

            const offYA = _heroCollisionOffsetY(a);
            const offYB = _heroCollisionOffsetY(b);

            const leftA   = ebA ? ebA.left   : (a.x - aw / 2);
            const rightA  = ebA ? ebA.right  : (a.x + aw / 2);
            const topA    = ebA ? ebA.top    : ((a.y + offYA) - ah / 2);
            const bottomA = ebA ? ebA.bottom : ((a.y + offYA) + ah / 2);

            const leftB   = ebB ? ebB.left   : (b.x - bw / 2);
            const rightB  = ebB ? ebB.right  : (b.x + bw / 2);
            const topB    = ebB ? ebB.top    : ((b.y + offYB) - bh / 2);
            const bottomB = ebB ? ebB.bottom : ((b.y + offYB) + bh / 2);

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
        if (DEBUG_OVERLAPS && _checkHandlerLogCount < MAX_CHECK_HANDLER_LOGS) {
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

//End of sprites namespace

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
            if (DEBUG_COMPAT_BACKGROUND) {
                console.log(
                    "[scene.setBackgroundColor] no Phaser scene yet, colorIndex=",
                    colorIndex,
                    "clampedIdx=",
                    idx
                );
            }
            _lastBgIndexLogged = idx;
        }
        return;
    }

    const rgb = MAKECODE_PALETTE[idx] || [0, 0, 0];
    const hex = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];

    // Only log when the background index actually changes
    if (idx !== _lastBgIndexLogged) {
        if (DEBUG_COMPAT_BACKGROUND) {
            console.log(
                "[scene.setBackgroundColor] index=",
                idx,
                "rgb=",
                rgb,
                "hex=",
                hex.toString(16)
            );
        }
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
        if (DEBUG_COMPAT_TILEMAP_STUB) {
            console.log("[tiles.setCurrentTilemap] (stub) current =", tm);
        }
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
    if (DEBUG_COMPAT_TILEMAP_STUB) {
        console.log("[tilemap] (stub) requested map id =", id, "expr =", expr);
    }
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

        // NEW: Decor ingestion + decal overlay sync (safe no-op if missing/unchanged)
        decor_maybeSyncFromEngineInternals();

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
        AB: Button;
        R: Button;
        Jump: Button;
        Interact: Button;
        up: Button;
        down: Button;
        left: Button;
        right: Button;
    }

    class BasicController implements Controller {
        A = new BasicButton();
        B = new BasicButton();
        AB = new BasicButton();
        R = new BasicButton();
        Jump = new BasicButton();
        Interact = new BasicButton();
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

    const _controllersBySlot: Record<number, BasicController> = Object.create(null);

    function _ensureControllerForSlot(slot: number): BasicController | null {
        const s = slot | 0;
        if (s <= 0) return null;
        let ctrl = _controllersBySlot[s];
        if (!ctrl) {
            ctrl = new BasicController();
            _controllersBySlot[s] = ctrl;
        }
        return ctrl;
    }

    export const player1: BasicController = _ensureControllerForSlot(1)!;
    export const player2: BasicController = _ensureControllerForSlot(2)!;
    export const player3: BasicController = _ensureControllerForSlot(3)!;
    export const player4: BasicController = _ensureControllerForSlot(4)!;

        // =====================================================================================
        // TODO_NPLAYER_BRIDGE
        // TEMPORARY FIXED-LANE CONTROLLER BRIDGE (player1..player4 exports).
        // All non-engine code must route through these helpers so later we delete/replace ONE place.
        // =====================================================================================
        export function _getControllerForSlot(slot: number): BasicController | null {
            return _ensureControllerForSlot(slot);
        }

        export function _getControllerSlotCount(): number {
            return Object.keys(_controllersBySlot).length;
        }


        // Which global player (1–4) this client controls.
        // All keyboard input will apply to THIS controller.
        let _localPlayerSlot = 1; // any positive slot id

        export function setLocalPlayerSlot(playerId: number): void {
            const slot = playerId | 0;
            if (slot <= 0) return;
            _ensureControllerForSlot(slot);
            _localPlayerSlot = slot;
            if (DEBUG_COMPAT_CONTROLLER) {
                console.log("[controller] local player slot set to", _localPlayerSlot);
            }
        }


        export function _getLocalController(): BasicController {
            const ctrl = _getControllerForSlot(_localPlayerSlot);
            return ctrl || player1;
        }



    
    // NEW: helper for game._tick – update all controllers once per frame
        export function _updateAllControllers(): void {
            // TODO_NPLAYER_BRIDGE
            // Update all exported controller lanes (currently fixed to player1..player4).
            for (const key of Object.keys(_controllersBySlot)) {
                const slot = key | 0;
                const ctrl: any = _controllersBySlot[slot];
                if (ctrl && typeof ctrl._updateSpriteVelocity === "function") {
                    ctrl._updateSpriteVelocity();
                }
            }
        }






    let _keyboardWired = false;
    let _keyboardScene: any = null;
    let _keyboardInput: any = null;
    let _keyboardUpdateHandler: (() => void) | null = null;
    let _keyboardReleaseAll: (() => void) | null = null;
    let _keyboardBlurWired = false;

    let _gamepadWired = false;
    let _gamepadScene: any = null;
    let _gamepadInput: any = null;
    let _gamepadReleaseAll: (() => void) | null = null;
    let _inputFirstPressLogged = false;
    let _inputFirstReleaseLogged = false;

    // Send a local input event (button pressed/released) to the network.
    function _sendLocalInput(button: string, pressed: boolean) {
        // Always keep local controller state in sync so the engine can read it.
        const ctrl = _getLocalController() as any;
        const btn = ctrl ? ctrl[button] : null;
        if (btn && typeof btn._setPressed === "function") {
            btn._setPressed(pressed);
        }

        if (DEBUG_INPUT_EDGE_LOGS) {
            console.log("[input.edge]", { button, pressed });
        }

        const net: any = (globalThis as any).__net;
        if (net && typeof net.sendInput === "function") {
            net.sendInput(button, pressed);
        }
    }

        // Hook Phaser keyboard into the "local" player.
        // SAME keys on every client: arrows + Q/W/E/R + Space + F.
    export function _wireKeyboard(scene: any): void {
        const kb = scene && scene.input && scene.input.keyboard;
        if (!kb) {
            console.warn("[controller._wireKeyboard] no keyboard plugin on scene", scene);
            return;
        }
        if (!kb.manager) {
            if (DEBUG_COMPAT_CONTROLLER) {
                console.warn("[controller._wireKeyboard] keyboard manager not ready; retrying");
            }
            try {
                const g: any = (globalThis as any);
                if (!scene.__heKeyboardRetryCount) scene.__heKeyboardRetryCount = 0;
                if (scene.__heKeyboardRetryCount < 10) {
                    scene.__heKeyboardRetryCount++;
                    if (scene.time && typeof scene.time.delayedCall === "function") {
                        scene.time.delayedCall(0, () => _wireKeyboard(scene));
                    } else if (g && typeof g.setTimeout === "function") {
                        g.setTimeout(() => _wireKeyboard(scene), 0);
                    }
                }
            } catch (_e) { /* ignore */ }
            return;
        }

        if (_keyboardWired && _keyboardScene === scene && _keyboardInput === kb) {
            if (DEBUG_COMPAT_CONTROLLER) {
                console.log("[controller._wireKeyboard] already wired, skipping");
            }
            return;
        }

        if (_keyboardReleaseAll) {
            _keyboardReleaseAll();
        }
        if (_keyboardScene && _keyboardUpdateHandler && _keyboardScene.events && typeof _keyboardScene.events.off === "function") {
            _keyboardScene.events.off("update", _keyboardUpdateHandler);
        }

        _keyboardWired = true;
        _keyboardScene = scene;
        _keyboardInput = kb;

        if (DEBUG_COMPAT_CONTROLLER) {
            console.log("[controller._wireKeyboard] wiring keyboard controls for LOCAL player (network-aware)");
        }

        const keyMap: any = kb.addKeys({
            left: "LEFT",
            right: "RIGHT",
            up: "UP",
            down: "DOWN",
            A: "Q",
            B: "W",
            AB: "E",
            R: "R",
            Jump: "SPACE",
            Interact: "F",
        });

        const bindings = [
            { key: keyMap?.left, button: "left" },
            { key: keyMap?.right, button: "right" },
            { key: keyMap?.up, button: "up" },
            { key: keyMap?.down, button: "down" },
            { key: keyMap?.A, button: "A" },
            { key: keyMap?.B, button: "B" },
            { key: keyMap?.AB, button: "AB" },
            { key: keyMap?.R, button: "R" },
            { key: keyMap?.Jump, button: "Jump" },
            { key: keyMap?.Interact, button: "Interact" },
        ];

        const state: Record<string, boolean> = {
            left: false,
            right: false,
            up: false,
            down: false,
            A: false,
            B: false,
            AB: false,
            R: false,
            Jump: false,
            Interact: false,
        };

        const syncKeys = () => {
            for (const b of bindings) {
                const down = !!(b.key && b.key.isDown);
                if (state[b.button] !== down) {
                    state[b.button] = down;
                    _sendLocalInput(b.button, down);
                }
            }
        };

        const releaseAll = () => {
            for (const b of bindings) {
                if (state[b.button]) {
                    state[b.button] = false;
                    _sendLocalInput(b.button, false);
                }
            }
        };

        _keyboardReleaseAll = releaseAll;
        _keyboardUpdateHandler = syncKeys;

        // Prime state so we don't depend on keyup reliability.
        syncKeys();

        if (scene && scene.events && typeof scene.events.on === "function") {
            scene.events.on("update", syncKeys);
        }

        if (!_keyboardBlurWired && typeof window !== "undefined" && typeof window.addEventListener === "function") {
            _keyboardBlurWired = true;
            window.addEventListener("blur", () => {
                if (_keyboardReleaseAll) _keyboardReleaseAll();
            });
        }
    }

    // Hook Phaser gamepad into the "local" player (first connected pad).
    // Maps: face buttons -> A/B/AB/R, bumpers -> Interact/Jump, D-pad/stick -> arrows.
    export function _wireGamepad(scene: any): void {
        const gp = scene && scene.input && scene.input.gamepad;
        if (!gp || typeof gp.on !== "function") {
            console.warn("[controller._wireGamepad] no gamepad plugin on scene", scene);
            return;
        }

        if (_gamepadWired && _gamepadScene === scene && _gamepadInput === gp) {
            if (DEBUG_COMPAT_CONTROLLER) {
                console.log("[controller._wireGamepad] already wired, skipping");
            }
            return;
        }

        if (_gamepadReleaseAll) {
            _gamepadReleaseAll();
        }

        _gamepadWired = true;
        _gamepadScene = scene;
        _gamepadInput = gp;

        if (DEBUG_COMPAT_CONTROLLER) {
            console.log("[controller._wireGamepad] wiring first gamepad for LOCAL player (network-aware)");
        }

        const DEADZONE = 0.35;
        let pad: any = null;
        let updateHandler: (() => void) | null = null;

        const axisState = { left: false, right: false, up: false, down: false };
        const btnNames: Record<number, string> = {
            0: "A",        // South
            1: "B",        // East
            2: "AB",       // West
            3: "R",        // North
            4: "Interact", // LB
            5: "Jump",     // RB
            12: "up",
            13: "down",
            14: "left",
            15: "right",
        };

        const emit = (name: string, pressed: boolean) => _sendLocalInput(name, pressed);

        const releaseAll = () => {
            emit("A", false);
            emit("B", false);
            emit("AB", false);
            emit("R", false);
            emit("Jump", false);
            emit("Interact", false);
            emit("up", false);
            emit("down", false);
            emit("left", false);
            emit("right", false);
            axisState.left = axisState.right = axisState.up = axisState.down = false;
            if (updateHandler && scene?.events?.off) {
                scene.events.off("update", updateHandler);
                updateHandler = null;
            }
        };
        _gamepadReleaseAll = releaseAll;

        const syncAxes = () => {
            if (!pad || !pad.axes) return;
            const ax = pad.axes[0] && typeof pad.axes[0].getValue === "function" ? pad.axes[0].getValue() : 0;
            const ay = pad.axes[1] && typeof pad.axes[1].getValue === "function" ? pad.axes[1].getValue() : 0;

            const next = {
                left: ax < -DEADZONE,
                right: ax > DEADZONE,
                up: ay < -DEADZONE,
                down: ay > DEADZONE,
            };

            (["left", "right", "up", "down"] as const).forEach((k) => {
                if (axisState[k] !== next[k]) {
                    axisState[k] = next[k];
                    emit(k, next[k]);
                }
            });
        };

        const attachPad = (p: any) => {
            if (!p) return;
            pad = p;

            p.on("down", (index: number) => {
                const name = btnNames[index];
                if (name) emit(name, true);
            });
            p.on("up", (index: number) => {
                const name = btnNames[index];
                if (name) emit(name, false);
                // In case the D-pad shares axes, re-sync to avoid stuck states.
                syncAxes();
            });
            p.on("disconnected", () => {
                releaseAll();
                pad = null;
            });

            updateHandler = () => syncAxes();
            if (scene && scene.events && typeof scene.events.on === "function") {
                scene.events.on("update", updateHandler);
            }

            // Prime axis state immediately.
            syncAxes();
        };

        if (typeof gp.getPad === "function" && gp.total > 0) {
            attachPad(gp.getPad(0));
        }

        gp.on("connected", (p: any) => {
            if (!pad) attachPad(p);
        });
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
    // DEBUG_NET_APPLY_FOLLOWER flag is defined in src/debugFlags.ts



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
    if (!isHost && DEBUG_NET_APPLY_FOLLOWER) {
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
        if (!isHost && DEBUG_NET_APPLY_FOLLOWER) {
            try {
                console.log("[netWorld.apply.follower]", {
                    sprites: snapSprites.length,
                    timeMs: snap.timeMs,
                    runtimeMs: snap.runtimeMs,
                    bgIndex: (snap as any).bgIndex ?? null
                });
            } catch (_e) { /* ignore */ }
        }

    // Track which IDs are present in the snapshot so we can prune leftovers
    const keepIds: { [id: number]: 1 } = {};

    const _snapIsNpc = (snap: any): boolean => {
        if (!snap || !snap.data) return false;
        const d: any = snap.data;
        if (!!d.isNpc || !!d.npcLpc) return true;
        if (typeof d._npcRole === "string" && d._npcRole.trim()) return true;
        return false;
    };

    for (const s of snapSprites) {
        if (!s) continue;

        const id = s.id | 0;
        keepIds[id] = 1;

        const isNpcSnap = _snapIsNpc(s);
        const npcKind = ((SpriteKind as any).NpcLpc != null) ? ((SpriteKind as any).NpcLpc | 0) : 0;
        const desiredKind = (isNpcSnap && npcKind) ? npcKind : (s.kind | 0);

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
                    desiredKind,
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
        target.kind = desiredKind;
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

        if (isNpcSnap) {
            try {
                const he: any = (globalThis as any).HeroEngine;
                if (he && typeof he.registerNpcLpc === "function") {
                    he.registerNpcLpc(target);
                }
            } catch { /* ignore */ }
        }
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


;(globalThis as any).netWorld = netWorld;



// ===============================================
// STEP 5: DEBUG SAVE / LOAD WORLD STATE HELPERS
// ===============================================

// Usage from DevTools:
//   const json = (window as any).debugSaveWorldState();
//   // ... later ...
//   (window as any).debugLoadWorldState(json);

;(globalThis as any).debugSaveWorldState = function (): string {
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
    if (!g.__playerNames) g.__playerNames = [null, null, null, null];

    g.__playerNames[slotIndex] = name || null;
    if (name && typeof name === "string") {
        g.__localHeroProfileName = name;
    }

    // This client controls this slot (1–4)
    if ((globalThis as any).controller &&
        typeof (globalThis as any).controller.setLocalPlayerSlot === "function") {
        (globalThis as any).controller.setLocalPlayerSlot(slotIndex + 1);
    }

    console.log("[players] registered LOCAL player slot", slotIndex + 1, "name=", name);
}



// =====================================================================================
// NET: HELLO identity + desired profile (required by server Step 3+)
// =====================================================================================
export function img(lit: TemplateStringsArray) {
    return parseMakeCodeImage(lit);
}
(globalThis as any).img = img;


export function initNetwork(): void {
    const g: any = (globalThis as any);

    // arcadeCompat.net.ts installs this once it is imported (main.ts already imports it)
    const fn = g.__net_initNetwork;

    if (typeof fn === "function") {
        fn();
        return;
    }

    console.warn("[NET] initNetwork missing: did arcadeCompat.net load?");
}
