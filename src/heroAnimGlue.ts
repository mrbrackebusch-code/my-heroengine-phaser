// src/heroAnimGlue.ts
import type Phaser from "phaser";
import type { HeroDir, HeroPhase, HeroAnimSet } from "./heroAtlas";

import {
    findHeroAnimSet,
    getHeroAtlasFromScene,
    normalizeHeroPhase,
    type HeroAnimSet,
    type HeroDir,
    type HeroFrameDef,
    type HeroPhase
} from "./heroAtlas";


// Data keys we will use on hero sprites.
// (Kept separate from monster keys.)
const HERO_NAME_KEY   = "heroName";
const HERO_FAMILY_KEY = "heroFamily";
const HERO_PHASE_KEY  = "phase";   // same key name as monsters, different value set
const HERO_DIR_KEY    = "dir";

// Internal bookkeeping keys on the Phaser sprite
const LAST_ANIM_KEY  = "__heroLastAnimKey";
const LAST_PHASE_KEY = "__heroLastPhase";
const LAST_DIR_KEY   = "__heroLastDir";

// Store the current "rest" phase so we know what to snap back to
const HERO_REST_PHASE_KEY = "__heroRestPhase";
// Store the animationcomplete handler so we can detach/replace it cleanly
const HERO_ANIMCOMPLETE_HANDLER_KEY = "__heroAnimCompleteHandler";

const HERO_FRAME_COL_OVERRIDE_KEY = "frameColOverride"


// Local phase window tracking (because engine PhaseStartMs is Arcade time, not Phaser time)
const HERO_LOCAL_PHASE_ACTIONSEQ_KEY = "__heroLocalPhaseActionSequence";
const HERO_LOCAL_PHASE_LOCAL_START_KEY = "__heroLocalPhaseLocalStartMs";
const HERO_LOCAL_PHASE_LOCAL_DUR_KEY = "__heroLocalPhaseLocalDurMs";



const HERO_ACTION_KIND_KEY = "ActionKind";
const HERO_ACTION_SEQUENCE_KEY = "ActionSequence";
const HERO_PHASE_DURATION_MS_KEY = "PhaseDurationMs";
const HERO_PHASE_PROGRESS_INT_KEY = "PhaseProgressInt";

const HERO_BASE_SCALE_X_KEY = "__heroBaseScaleX";
const HERO_BASE_SCALE_Y_KEY = "__heroBaseScaleY";


const HERO_PHASE_NAME_KEY = "PhaseName"
const HERO_PHASE_START_MS_KEY = "PhaseStartMs"

// Debug toggles
const DEBUG_HERO_ANIM_GLUE = true
const DEBUG_HERO_ANIM_GLUE_ONLY_PROBLEMS = false  // if true: logs only when something is missing/invalid
const DEBUG_HERO_ANIM_GLUE_FOCUS_ON_INTELLECT = true // reduces spam by focusing on intellect/cast

//const HERO_PHASE_NAME_KEY = "PhaseName" // authoritative phase window key from HeroEngineInPhaser


// ============================================================
// DEBUG: Prove hero animation application during cast
// ============================================================
const DEBUG_INT_HERO_ANIM = false; //Debug flag
const DEBUG_INT_HERO_NAME_FILTER = "Jason"; // "" = all



// ============================================================
// DEBUG: Prove hero animation application / restart / looping
// ============================================================
const DEBUG_PROVE_HERO_CAST_ANIM = false; //Debug flag
// "" logs all heroes; set to "Jason" to filter.
const DEBUG_PROVE_HERO_NAME_FILTER = "Jason";



const CAST_PART_FRAME_RULES: Record<string, { start: number; end: number; hold?: number }> = {
    // indices within the cast clip (0..6)
    produce: { start: 0, end: 3 },
    drive:   { start: 4, end: 4, hold: 4 },
    land:    { start: 5, end: 6 }
};

function _clamp01(x: number): number {
    if (x < 0) return 0;
    if (x > 1) return 1;
    return x;
}




// Global + per-file logging flag
const HERO_GLUE_DEBUG = {
    enabled: true //Debug flag
};


function heroGlueDebug(scene: Phaser.Scene): boolean {
    // Global master switch lives in the registry (same as atlas).
    return !!scene.registry.get("heroAnimDebug") && HERO_GLUE_DEBUG.enabled;
}

// Always output a single wall-of-text string.
// If payload is an object, JSON.stringify it so copy/paste gets everything.
function logGlue(scene: Phaser.Scene, tag: string, payload?: any): void {
    if (!heroGlueDebug(scene)) return;

    let line = tag;
    if (payload !== undefined) {
        if (typeof payload === "string") {
            line += " " + payload;
        } else {
            try {
                line += " " + JSON.stringify(payload);
            } catch {
                line += " [unstringifiable payload]";
            }
        }
    }

    // eslint-disable-next-line no-console
    console.log("[HeroAnimGlue]", line);
}



const HERO_CAST_CLOCK_OFFSET_MS_KEY = "__heroCastClockOffsetMs";
const HERO_CAST_CLOCK_ANCHOR_START_MS_KEY = "__heroCastClockAnchorStartMs";


// --- ADD THESE CONSTANTS (standalone; outside functions) --------------------

// Authoritative per-phase-part fields published by HeroEngineInPhaser
const HERO_PHASE_PART_NAME_KEY = "PhasePartName";
const HERO_PHASE_PART_START_MS_KEY = "PhasePartStartMs";
const HERO_PHASE_PART_DURATION_MS_KEY = "PhasePartDurationMs";

// Local tracking for part timing (Arcade time -> Phaser time bridge)
const HERO_LOCAL_PART_ACTIONSEQ_KEY = "__heroLocalPartActionSequence";
const HERO_LOCAL_PART_PARTNAME_KEY = "__heroLocalPartName";
const HERO_LOCAL_PART_PARTSTART_KEY = "__heroLocalPartStartMsArcade";
const HERO_LOCAL_PART_LOCALSTART_KEY = "__heroLocalPartLocalStartMs";




// ---------------------------------------------------------------------------
// Identity deferral + proof logging (NEW)
// ---------------------------------------------------------------------------
const HERO_ANIM_DEFER_KEY_FIRST_SEEN_MS = "heroAnimGlue.defer.firstSeenMs";
const HERO_ANIM_DEFER_KEY_NO_NAME_LOGGED = "heroAnimGlue.defer.noHeroNameLogged";
const HERO_ANIM_DEFER_KEY_RESOLVED_LOGGED = "heroAnimGlue.defer.resolvedLogged";

// How long we tolerate a sprite existing without a heroName (ms).
const HERO_ANIM_IDENTITY_GRACE_MS = 900;

// If true: after grace window, we throw (crash) to force attention.
// Default false so startup ordering doesn’t explode.
const HERO_ANIM_THROW_IF_IDENTITY_NEVER_RESOLVES = false;




// Tiny util (old code referenced clampInt; ensure it exists)
function clampInt(v: number, lo: number, hi: number): number {
    v |= 0;
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
}

// ---------------------------------------------------------------------------
// NEW: Cast phase-part frame control (produce/drive/land)
// ---------------------------------------------------------------------------
// --- FULL REPLACEMENT: _tryCastPartFrameControl ----------------------------
function _tryCastPartFrameControl(
    scene: Phaser.Scene,
    sprite: Phaser.GameObjects.Sprite,
    req: any,
    def: any,
    shouldProve: boolean
): boolean {
    if (!req || req.phase !== "cast") return false;

    const partNameRaw = (req.phasePartName || "").toString().trim().toLowerCase();
    if (!partNameRaw) return false;

    const rule = CAST_PART_FRAME_RULES[partNameRaw];
    if (!rule) return false;

    const frames: number[] = (def && Array.isArray(def.frameIndices)) ? def.frameIndices : [];
    if (frames.length <= 0) return false;

    const startMs =
        (typeof req.phasePartStartMs === "number" && Number.isFinite(req.phasePartStartMs))
            ? (req.phasePartStartMs | 0)
            : 0;

    const durMs =
        (typeof req.phasePartDurationMs === "number" &&
            Number.isFinite(req.phasePartDurationMs) &&
            req.phasePartDurationMs > 0)
            ? (req.phasePartDurationMs | 0)
            : 1;

    const sceneNowMs =
        (scene.time && typeof scene.time.now === "number")
            ? (scene.time.now | 0)
            : 0;

    // ------------------------------------------------------------
    // CLOCK ALIGNMENT (the bug you're hitting)
    // startMs comes from HeroEngine timebase; sceneNowMs is Phaser.
    // We learn an offset the first tick we see a given startMs:
    //   engineNowMs = sceneNowMs - offset
    // so that engineNowMs ~= startMs at the moment we begin observing.
    // ------------------------------------------------------------
    const prevAnchorStartMs = (sprite as any).getData
        ? ((sprite as any).getData(HERO_CAST_CLOCK_ANCHOR_START_MS_KEY) as number | undefined)
        : undefined;

    let offsetMs = (sprite as any).getData
        ? ((sprite as any).getData(HERO_CAST_CLOCK_OFFSET_MS_KEY) as number | undefined)
        : undefined;

    if (prevAnchorStartMs !== startMs || typeof offsetMs !== "number" || !Number.isFinite(offsetMs)) {
        // Re-anchor when part start changes (new part) or first time.
        offsetMs = sceneNowMs - startMs;

        if ((sprite as any).setData) {
            (sprite as any).setData(HERO_CAST_CLOCK_OFFSET_MS_KEY, offsetMs);
            (sprite as any).setData(HERO_CAST_CLOCK_ANCHOR_START_MS_KEY, startMs);
        }
    }

    const engineNowMs = sceneNowMs - (offsetMs | 0);

    let clipIdx = 0;

    if (typeof rule.hold === "number") {
        clipIdx = rule.hold | 0;
    } else {
        let elapsed = engineNowMs - startMs;
        if (elapsed < 0) elapsed = 0;
        if (elapsed > durMs) elapsed = durMs;

        const span = (rule.end - rule.start + 1);
        if (span <= 1) {
            clipIdx = rule.start | 0;
        } else {
            // elapsed in [0..durMs] → local in [0..span-1]
            let local = Math.floor((elapsed * span) / durMs); // 0..span
            if (local > (span - 1)) local = span - 1;
            clipIdx = (rule.start + local) | 0;
        }

        if (shouldProve) {
            // eslint-disable-next-line no-console
            console.log(
                `[PROVE][HERO-ANIM][CAST-PART-TIME] | part=${partNameRaw} ` +
                `sceneNowMs=${sceneNowMs} engineNowMs=${engineNowMs} offsetMs=${offsetMs} ` +
                `startMs=${startMs} durMs=${durMs} elapsedMs=${Math.max(0, Math.min(durMs, engineNowMs - startMs))} ` +
                `rule=${rule.start}..${rule.end} span=${span} clipIdx=${clipIdx}`
            );
        }
    }

    // Clamp to actual available frames
    const maxIdx = frames.length - 1;
    if (clipIdx < 0) clipIdx = 0;
    if (clipIdx > maxIdx) clipIdx = maxIdx;

    const frameIndex = frames[clipIdx];

    // Stop looping spellcast; we are driving frames manually.
    if (sprite.anims && sprite.anims.isPlaying) {
        sprite.anims.stop();
    }

    sprite.setFrame(frameIndex);

    if (shouldProve) {
        // eslint-disable-next-line no-console
        console.log(
            `[PROVE][HERO-ANIM][CAST-PART-APPLY] | part=${partNameRaw} ` +
            `clipIdx=${clipIdx} frameIndex=${frameIndex} startMs=${startMs} durMs=${durMs}`
        );
    }

    return true;
}


/**
 * Read and normalize the animation request from a hero sprite.
 */
// --- FULL REPLACEMENT: readHeroAnimRequest ---------------------------------


// --- FULL REPLACEMENT: readHeroAnimRequest ---------------------------------
function readHeroAnimRequest(sprite: Phaser.GameObjects.Sprite): {
    heroName: string | undefined;
    family: string | undefined;
    phase: HeroPhase | null;
    dir: HeroDir;
    frameColOverride: number; // -1 means "no override"

    actionKind: string | undefined;
    actionSequence: number;
    phaseDurationMs: number;
    phaseProgressInt: number; // 0..1000, -1 if missing

    // Authoritative phase-part window (for selected-frame control)
    phasePartName: string | undefined;
    phasePartStartMs: number;
    phasePartDurationMs: number;
} {
    const anySprite = sprite as any;

    const heroNameRaw = anySprite.getData ? (anySprite.getData(HERO_NAME_KEY) as any) : undefined;
    const familyRaw = anySprite.getData ? (anySprite.getData(HERO_FAMILY_KEY) as any) : undefined;

    const phaseLegacyRaw = anySprite.getData ? (anySprite.getData(HERO_PHASE_KEY) as any) : undefined;
    const phaseNameRaw = anySprite.getData ? (anySprite.getData(HERO_PHASE_NAME_KEY) as any) : undefined;

    const dirRaw = anySprite.getData ? (anySprite.getData(HERO_DIR_KEY) as any) : undefined;

    const frameColOverrideRaw = anySprite.getData ? (anySprite.getData(HERO_FRAME_COL_OVERRIDE_KEY) as any) : undefined;

    const actionKindRaw = anySprite.getData ? (anySprite.getData(HERO_ACTION_KIND_KEY) as any) : undefined;
    const actionSeqRaw = anySprite.getData ? (anySprite.getData(HERO_ACTION_SEQUENCE_KEY) as any) : undefined;

    const phaseDurRaw = anySprite.getData ? (anySprite.getData(HERO_PHASE_DURATION_MS_KEY) as any) : undefined;
    const phaseProgRaw = anySprite.getData ? (anySprite.getData(HERO_PHASE_PROGRESS_INT_KEY) as any) : undefined;

    const partNameRaw = anySprite.getData ? (anySprite.getData(HERO_PHASE_PART_NAME_KEY) as any) : undefined;
    const partStartRaw = anySprite.getData ? (anySprite.getData(HERO_PHASE_PART_START_MS_KEY) as any) : undefined;
    const partDurRaw = anySprite.getData ? (anySprite.getData(HERO_PHASE_PART_DURATION_MS_KEY) as any) : undefined;

    const heroName = (() => {
        if (heroNameRaw == null) return undefined;
        const s = String(heroNameRaw).trim();
        return s.length ? s : undefined;
    })();

    const family = (() => {
        if (familyRaw == null) return undefined;
        const f0 = String(familyRaw).trim().toLowerCase();
        const f = f0.replace(/[\s_-]+/g, "");
        if (f === "base") return "base";
        if (f === "strength") return "strength";
        if (f === "agility") return "agility";
        if (f === "intelligence" || f === "intellect") return "intelligence";
        if (f === "support") return "support";
        return undefined;
    })();

    const phaseEffectiveRaw =
        (phaseNameRaw && String(phaseNameRaw).trim().length) ? phaseNameRaw : phaseLegacyRaw;

    const phase = (() => {
        if (!phaseEffectiveRaw) return null;
        const p0 = String(phaseEffectiveRaw).trim().toLowerCase();
        const p = p0.replace(/[\s_-]+/g, "");

        if (p === "cast" || p === "spellcast" || p === "spell") return "cast";
        if (p === "thrust" || p === "spear") return "thrust";
        if (p === "walk" || p === "walking") return "walk";
        if (p === "slash" || p === "sword") return "slash";
        if (p === "shoot" || p === "bow") return "shoot";
        if (p === "hurt" || p === "hit") return "hurt";
        if (p === "climb" || p === "climbing") return "climb";
        if (p === "idle") return "idle";
        if (p === "jump") return "jump";
        if (p === "sit") return "sit";
        if (p === "emote" || p === "emotion") return "emote";
        if (p === "run" || p === "running") return "run";
        if (p === "watering" || p === "water") return "watering";
        if (p === "combatidle") return "combatIdle";
        if (p === "onehandslash" || p === "1handslash") return "oneHandSlash";
        if (p === "onehandbackslash" || p === "1handbackslash") return "oneHandBackslash";
        if (p === "onehandhalfslash" || p === "1handhalfslash" || p === "halfslash") return "oneHandHalfslash";
        if (p === "thrustoversize") return "thrustOversize";
        if (p === "slashoversize") return "slashOversize";
        return null;
    })();

    const dir: HeroDir = (() => {
        if (!dirRaw) return "down";
        const d0 = String(dirRaw).trim().toLowerCase();
        const d = d0.replace(/[\s_-]+/g, "");
        if (d === "up" || d === "n" || d === "north") return "up";
        if (d === "down" || d === "s" || d === "south") return "down";
        if (d === "left" || d === "w" || d === "west") return "left";
        if (d === "right" || d === "e" || d === "east") return "right";
        return "down";
    })();

    const frameColOverride = (() => {
        const n = Number(frameColOverrideRaw);
        if (!Number.isFinite(n)) return -1;
        return (n | 0);
    })();

    const actionKind = (() => {
        if (actionKindRaw == null) return undefined;
        const s = String(actionKindRaw).trim();
        if (!s.length) return undefined;
        const sl = s.toLowerCase();
        if (sl === "none" || sl === "null" || sl === "undefined") return undefined;
        return s;
    })();

    const actionSequence = (() => {
        const n = Number(actionSeqRaw);
        if (!Number.isFinite(n)) return 0;
        return (n | 0);
    })();

    const phaseDurationMs = (() => {
        const n = Number(phaseDurRaw);
        if (!Number.isFinite(n)) return 0;
        return (n | 0);
    })();

    const phaseProgressInt = (() => {
        const n = Number(phaseProgRaw);
        if (!Number.isFinite(n)) return -1;
        const v = (n | 0);
        if (v < 0) return 0;
        if (v > 1000) return 1000;
        return v;
    })();

    const phasePartName = (() => {
        if (partNameRaw == null) return undefined;
        const s = String(partNameRaw).trim();
        return s.length ? s : undefined;
    })();

    const phasePartStartMs = (() => {
        const n = Number(partStartRaw);
        if (!Number.isFinite(n)) return 0;
        return (n | 0);
    })();

    const phasePartDurationMs = (() => {
        const n = Number(partDurRaw);
        if (!Number.isFinite(n)) return 0;
        return (n | 0);
    })();

    return {
        heroName,
        family,
        phase,
        dir,
        frameColOverride,

        actionKind,
        actionSequence,
        phaseDurationMs,
        phaseProgressInt,

        phasePartName,
        phasePartStartMs,
        phasePartDurationMs
    };
}

/**
 * For now, every "active" animation returns to idle.
 * Later we can get fancier (e.g. climb→idle, jump→idle, etc.).
 */
function getRestPhase(_phase: HeroPhase): HeroPhase {
    return "idle";
}


/**
 * Choose the best concrete phase for this hero set:
 * - If run is requested but missing, fall back to walk if available.
 * - If thrust/slash are requested and oversize variants exist, use those.
 */
/**
 * Choose the best concrete phase for this hero set:
 * - If run is requested but missing, fall back to walk if available.
 * - (Oversize phase substitution is disabled; weapons own size now.)
 */
function getEffectivePhaseForSet(set: HeroAnimSet, phase: HeroPhase): HeroPhase {
    // Map run → walk if run is not defined but walk is.
    if (phase === "run") {
        const runMap = set.phases["run"];
        if (!runMap || Object.keys(runMap).length === 0) {
            const walkMap = set.phases["walk"];
            if (walkMap && Object.keys(walkMap).length > 0) {
                return "walk";
            }
        }
    }

    return phase;
}



/**
 * Detailed frame-debug string:
 *   #idx->rROW,cCOL@(pxX,pxY)
 */
function formatFrameDebug(frameIndices: number[]): string {
    if (!frameIndices || frameIndices.length === 0) return "none";

    const parts: string[] = [];
    for (const idx of frameIndices) {
        const row = Math.floor(idx / HERO_SHEET_COLS);
        const col = idx % HERO_SHEET_COLS;
        const pxX = col * HERO_FRAME_W;
        const pxY = row * HERO_FRAME_H;
        parts.push(`#${idx}->r${row},c${col}@(${pxX},${pxY})`);
    }
    return parts.join(", ");
}


// ------------------------------------------------------------
// Split helpers (NO behavior change; refactor only)
// ------------------------------------------------------------

type _HeroAnimRequest = ReturnType<typeof readHeroAnimRequest>;

function _shouldProveHeroAnim(req: _HeroAnimRequest): boolean {
    return (
        !!DEBUG_PROVE_HERO_CAST_ANIM &&
        req.phase === "cast" &&
        (!DEBUG_PROVE_HERO_NAME_FILTER || req.heroName === DEBUG_PROVE_HERO_NAME_FILTER)
    );
}

function _proveLogHeroAnimReq(sprite: Phaser.GameObjects.Sprite, req: _HeroAnimRequest): void {
    const anySprite0 = sprite as any;
    console.log(
        "[PROVE][HERO-ANIM][REQ]",
        "| heroName", req.heroName,
        "| family", req.family,
        "| phase", req.phase,
        "| dir", req.dir,
        "| fco", (req.frameColOverride | 0),
        "| actionKind", req.actionKind,
        "| phaseProgressInt", req.phaseProgressInt,
        "| texKey(cur)", (anySprite0.texture && anySprite0.texture.key) ? anySprite0.texture.key : "",
        "| frame(cur)", (anySprite0.frame && (anySprite0.frame.name !== undefined)) ? anySprite0.frame.name : undefined,
        "| animKey(cur)", (anySprite0.anims && anySprite0.anims.currentAnim) ? anySprite0.anims.currentAnim.key : "",
        "| isPlaying(cur)", (anySprite0.anims && anySprite0.anims.isPlaying) ? true : false,
        "| visible(cur)", (anySprite0.visible === true),
        "| alpha(cur)", (anySprite0.alpha !== undefined ? anySprite0.alpha : undefined),
    );
}

function _requireHeroNameAndPhaseOrLog(scene: Phaser.Scene, req: _HeroAnimRequest): boolean {
    if (!req.heroName || !req.phase) {
        logGlue(scene, "applyHeroAnimationForSprite: missing heroName/phase", {
            heroName: req.heroName,
            family: req.family,
            phase: req.phase,
            frameColOverride: req.frameColOverride,
            actionKind: req.actionKind
        });
        return false;
    }
    return true;
}

function _findHeroSetOrLog(
    scene: Phaser.Scene,
    atlas: any,
    req: _HeroAnimRequest
): any | null {
    const set = findHeroAnimSet(atlas, req.heroName, req.family);
    if (!set) {
        logGlue(scene, "applyHeroAnimationForSprite: no HeroAnimSet for hero (family optional)", {
            heroName: req.heroName,
            family: req.family
        });
        return null;
    }
    return set;
}

function _proveLogEffectivePhase(
    req: _HeroAnimRequest,
    set: any,
    effectivePhase: any,
    dirMap: any
): void {
    console.log(
        "[PROVE][HERO-ANIM][EFFECTIVE]",
        "| heroName", req.heroName,
        "| requestedPhase", req.phase,
        "| effectivePhase", effectivePhase,
        "| hasDirMap", !!dirMap,
        "| setId", set.id
    );
}

function _proveLogFallback(
    reason: string,
    req: _HeroAnimRequest,
    effectivePhase: any,
    restPhase: any,
    allowFallback: boolean
): void {
    console.log(
        "[PROVE][HERO-ANIM][FALLBACK]",
        `REASON=${reason}`,
        "| heroName", req.heroName,
        "| requestedPhase", req.phase,
        "| effectivePhase", effectivePhase,
        "| fallbackRestPhase", restPhase,
        "| allowFallback", allowFallback
    );
}

function _resolveDirMapOrFallback(
    scene: Phaser.Scene,
    sprite: Phaser.GameObjects.Sprite,
    req: _HeroAnimRequest,
    set: any,
    effectivePhase: any,
    allowFallback: boolean,
    shouldProve: boolean
): any | null {
    const anySprite = sprite as any;
    const dirMap = set.phases[effectivePhase];

    if (!dirMap) {
        logGlue(scene, "applyHeroAnimationForSprite: no phase for set", {
            heroName: req.heroName,
            family: req.family,
            requestedPhase: req.phase,
            effectivePhase,
            setId: set.id
        });

        if (allowFallback && req.phase !== "idle") {
            const restPhase = getRestPhase(req.phase);
            if (shouldProve) _proveLogFallback("noDirMap", req, effectivePhase, restPhase, allowFallback);
            if (anySprite.setData) anySprite.setData(HERO_PHASE_KEY, restPhase);
            applyHeroAnimationForSpriteInternal(sprite, /*allowFallback*/ false);
        }
        return null;
    }

    return dirMap;
}

function _resolveDefOrFallback(
    scene: Phaser.Scene,
    sprite: Phaser.GameObjects.Sprite,
    req: _HeroAnimRequest,
    set: any,
    effectivePhase: any,
    dirMap: any,
    allowFallback: boolean,
    shouldProve: boolean
): any | null {
    const anySprite = sprite as any;
    const def = dirMap[req.dir];

    if (!def) {
        logGlue(scene, "applyHeroAnimationForSprite: no dir for phase", {
            heroName: req.heroName,
            family: req.family,
            requestedPhase: req.phase,
            effectivePhase,
            requestedDir: req.dir,
            setId: set.id
        });

        if (allowFallback && req.phase !== "idle") {
            const restPhase = getRestPhase(req.phase);
            if (shouldProve) _proveLogFallback("noDefForDir", req, effectivePhase, restPhase, allowFallback);
            if (anySprite.setData) anySprite.setData(HERO_PHASE_KEY, restPhase);
            applyHeroAnimationForSpriteInternal(sprite, /*allowFallback*/ false);
        }
        return null;
    }

    return def;
}

function _proveLogDef(req: _HeroAnimRequest, def: any): void {
    console.log(
        "[PROVE][HERO-ANIM][DEF]",
        "| heroName", req.heroName,
        "| def.phase", def.phase,
        "| def.dir", def.dir,
        "| def.textureKey", def.textureKey,
        "| framesLen", ((def.frameIndices as any)?.length ?? -1),
        "| frameRate", def.frameRate,
        "| repeat", def.repeat,
        "| yoyo", def.yoyo
    );
}

function _restoreBaseScaleIfPresent(sprite: Phaser.GameObjects.Sprite): void {
    const anySprite = sprite as any;
    const bx = Number(anySprite.getData?.(HERO_BASE_SCALE_X_KEY));
    const by = Number(anySprite.getData?.(HERO_BASE_SCALE_Y_KEY));
    if (Number.isFinite(bx) && bx !== 0) (sprite as any).scaleX = bx;
    if (Number.isFinite(by) && by !== 0) (sprite as any).scaleY = by;
}

function _tryStrengthChargeThrob(
    scene: Phaser.Scene,
    sprite: Phaser.GameObjects.Sprite,
    req: _HeroAnimRequest,
    def: any,
    shouldProve: boolean
): boolean {
    const anySprite = sprite as any;

    if (!(req.actionKind === "strength_charge" && def.phase === "slash")) {
        return false;
    }

    const frames: number[] = (def.frameIndices || []) as any;
    if (!(frames && frames.length)) return false;

    const nowLocal = (scene as any)?.time?.now ?? Date.now();

    // p in [0..1] if provided (else assume mid)
    const p = (req.phaseProgressInt >= 0) ? Math.max(0, Math.min(1, req.phaseProgressInt / 1000)) : 0.5;

    // Alternate between col 0 and col 1 with a period that tightens slightly as we near full charge
    // (so it feels more “tense” as it fills)
    const periodMs = Math.max(80, Math.min(220, Math.floor(220 - 120 * p)));
    const bit = ((Math.floor(nowLocal / periodMs) | 0) & 1) ? 1 : 0;

    // If we only have 1 frame, stick to 0. Otherwise 0/1.
    let col = (frames.length >= 2) ? bit : 0;

    // Near full charge, bias to the “pulled back” look (col 1) if it exists
    if (p >= 0.95 && frames.length >= 2) col = 1;

    const frameIndex = frames[Math.max(0, Math.min(col, frames.length - 1))];

    if (shouldProve) {
        console.log(
            "[PROVE][HERO-ANIM][CHARGE-THROB]",
            "| heroName", req.heroName,
            "| nowLocal", nowLocal,
            "| p", p,
            "| periodMs", periodMs,
            "| bit", bit,
            "| col", col,
            "| frameIndex", frameIndex,
            "| textureKey", def.textureKey
        );
    }

    // Stop playback and force frame
    if (sprite.anims) sprite.anims.stop();
    sprite.setTexture(def.textureKey, frameIndex);

    // Pulse scale (weapon layers copy hero scale so this makes the sword throb too)
    const baseX = ((): number => {
        const v = Number(anySprite.getData?.(HERO_BASE_SCALE_X_KEY));
        if (Number.isFinite(v) && v !== 0) return v;
        const cur = (sprite as any).scaleX;
        if (typeof cur === "number" && Number.isFinite(cur) && cur !== 0) {
            try { anySprite.setData(HERO_BASE_SCALE_X_KEY, cur); } catch { }
            return cur;
        }
        try { anySprite.setData(HERO_BASE_SCALE_X_KEY, 1); } catch { }
        return 1;
    })();

    const baseY = ((): number => {
        const v = Number(anySprite.getData?.(HERO_BASE_SCALE_Y_KEY));
        if (Number.isFinite(v) && v !== 0) return v;
        const cur = (sprite as any).scaleY;
        if (typeof cur === "number" && Number.isFinite(cur) && cur !== 0) {
            try { anySprite.setData(HERO_BASE_SCALE_Y_KEY, cur); } catch { }
            return cur;
        }
        try { anySprite.setData(HERO_BASE_SCALE_Y_KEY, 1); } catch { }
        return 1;
    })();

    const wob = 0.03; // 3% scale throb
    const s = 1 + wob * Math.sin(nowLocal / 90);
    (sprite as any).scaleX = baseX * s;
    (sprite as any).scaleY = baseY * s;

    // Remove any prior animationcomplete handler (charge should not auto-snap)
    const prevHandler = anySprite[HERO_ANIMCOMPLETE_HANDLER_KEY] as
        | ((anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => void)
        | undefined;
    if (prevHandler) {
        sprite.off("animationcomplete", prevHandler);
        anySprite[HERO_ANIMCOMPLETE_HANDLER_KEY] = undefined;
    }

    // Maintain rest phase bookkeeping for later snap
    if (anySprite.setData) {
        anySprite.setData(LAST_ANIM_KEY, "");
        anySprite.setData(LAST_PHASE_KEY, def.phase);
        anySprite.setData(LAST_DIR_KEY, def.dir);
        anySprite.setData(HERO_REST_PHASE_KEY, getRestPhase(def.phase));
    }

    return true;
}

function _tryHoldSingleFrame(
    scene: Phaser.Scene,
    sprite: Phaser.GameObjects.Sprite,
    req: _HeroAnimRequest,
    def: any,
    shouldProve: boolean
): boolean {
    const anySprite = sprite as any;

    if (!((req.frameColOverride | 0) >= 0)) return false;

    const frames: number[] = (def.frameIndices || []) as any;
    if (!frames.length) {
        logGlue(scene, "applyHeroAnimationForSprite: HOLD requested but def has no frames", {
            heroName: req.heroName,
            family: req.family,
            phase: def.phase,
            dir: def.dir,
            textureKey: def.textureKey
        });
        return true; // handled (by logging + return)
    }

    const col = Math.max(0, Math.min(req.frameColOverride | 0, frames.length - 1));
    const frameIndex = frames[col];

    if (shouldProve) {
        console.log(
            "[PROVE][HERO-ANIM][HOLD]",
            "| heroName", req.heroName,
            "| phase", def.phase,
            "| dir", def.dir,
            "| fco", (req.frameColOverride | 0),
            "| col", col,
            "| frameIndex", frameIndex,
            "| textureKey", def.textureKey
        );
    }

    if (sprite.anims) sprite.anims.stop();
    sprite.setTexture(def.textureKey, frameIndex);

    const prevHandler = anySprite[HERO_ANIMCOMPLETE_HANDLER_KEY] as
        | ((anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => void)
        | undefined;
    if (prevHandler) {
        sprite.off("animationcomplete", prevHandler);
        anySprite[HERO_ANIMCOMPLETE_HANDLER_KEY] = undefined;
    }

    if (anySprite.setData) {
        anySprite.setData(LAST_ANIM_KEY, "");
        anySprite.setData(LAST_PHASE_KEY, def.phase);
        anySprite.setData(LAST_DIR_KEY, def.dir);
    }

    return true;
}

function _proveLogNoop(req: _HeroAnimRequest, animKey: string, def: any): void {
    console.log(
        "[PROVE][HERO-ANIM][NOOP]",
        "| heroName", req.heroName,
        "| animKey", animKey,
        "| def.phase", def.phase,
        "| def.dir", def.dir,
        "| already playing"
    );
}

function _proveLogCreate(req: _HeroAnimRequest, animKey: string, def: any): void {
    console.log(
        "[PROVE][HERO-ANIM][CREATE]",
        "| heroName", req.heroName,
        "| animKey", animKey,
        "| textureKey", def.textureKey,
        "| framesLen", ((def.frameIndices as any)?.length ?? -1),
        "| frameRate", def.frameRate,
        "| repeat", def.repeat,
        "| yoyo", def.yoyo
    );
}

function _proveLogPlayBefore(
    sprite: Phaser.GameObjects.Sprite,
    req: _HeroAnimRequest,
    animKey: string,
    restPhase: any
): void {
    console.log(
        "[PROVE][HERO-ANIM][PLAY]",
        "| heroName", req.heroName,
        "| animKey", animKey,
        "| restPhase", restPhase,
        "| visible(before)", sprite.visible,
        "| alpha(before)", (sprite as any).alpha,
        "| curAnimKey(before)", (sprite.anims && sprite.anims.currentAnim) ? sprite.anims.currentAnim.key : "",
        "| isPlaying(before)", (sprite.anims && sprite.anims.isPlaying) ? true : false
    );
}

function _proveLogPlayAfter(
    sprite: Phaser.GameObjects.Sprite,
    req: _HeroAnimRequest,
    animKey: string
): void {
    console.log(
        "[PROVE][HERO-ANIM][PLAY-AFTER]",
        "| heroName", req.heroName,
        "| animKey", animKey,
        "| curAnimKey(after)", (sprite.anims && sprite.anims.currentAnim) ? sprite.anims.currentAnim.key : "",
        "| isPlaying(after)", (sprite.anims && sprite.anims.isPlaying) ? true : false,
        "| visible(after)", sprite.visible,
        "| alpha(after)", (sprite as any).alpha
    );
}

function _proveLogComplete(
    req: _HeroAnimRequest,
    animKey: string,
    phaseAtApply: any,
    effectivePhase: any,
    def: any
): void {
    console.log(
        "[PROVE][HERO-ANIM][COMPLETE]",
        "| heroName", req.heroName,
        "| animKey", animKey,
        "| phase(atComplete)", phaseAtApply,
        "| effectivePhase", effectivePhase,
        "| def.phase", def.phase,
        "| def.dir", def.dir
    );
}

function _proveLogCompleteSnap(
    req: _HeroAnimRequest,
    curPhase: any,
    targetRestPhase: any,
    curDir: any
): void {
    console.log(
        "[PROVE][HERO-ANIM][COMPLETE-SNAP]",
        "| heroName", req.heroName,
        "| curPhase", curPhase,
        "| targetRestPhase", targetRestPhase,
        "| curDir", curDir
    );
}

function _detachPrevAnimCompleteHandler(sprite: Phaser.GameObjects.Sprite): void {
    const anySprite = sprite as any;
    const prevHandler = anySprite[HERO_ANIMCOMPLETE_HANDLER_KEY] as
        | ((anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => void)
        | undefined;
    if (prevHandler) sprite.off("animationcomplete", prevHandler);
}

function _attachAnimCompleteHandler(
    sprite: Phaser.GameObjects.Sprite,
    req: _HeroAnimRequest,
    animKey: string,
    restPhase: any,
    phaseAtApply: any,
    effectivePhase: any,
    def: any,
    shouldProve: boolean
): void {
    const anySprite = sprite as any;

    const handler = (anim: Phaser.Animations.Animation) => {
        if (anim.key !== animKey) return;

        if (shouldProve) _proveLogComplete(req, animKey, phaseAtApply, effectivePhase, def);

        const curDir = anySprite.getData ? (anySprite.getData(HERO_DIR_KEY) as HeroDir | undefined) : undefined;
        if (!curDir) return;

        const targetRestPhase =
            (anySprite.getData && (anySprite.getData(HERO_REST_PHASE_KEY) as HeroPhase | undefined)) || restPhase;

        const curPhase = anySprite.getData ? (anySprite.getData(HERO_PHASE_KEY) as HeroPhase | undefined) : undefined;
        if (!targetRestPhase || curPhase === targetRestPhase) return;

        if (shouldProve) _proveLogCompleteSnap(req, curPhase, targetRestPhase, curDir);

        if (anySprite.setData) {
            anySprite.setData(HERO_PHASE_KEY, targetRestPhase);
            anySprite.setData(HERO_DIR_KEY, curDir);
        }

        applyHeroAnimationForSpriteInternal(sprite, /*allowFallback*/ false);
    };

    anySprite[HERO_ANIMCOMPLETE_HANDLER_KEY] = handler;
    sprite.on("animationcomplete", handler);
}

function _playDefaultAnimPath(
    scene: Phaser.Scene,
    sprite: Phaser.GameObjects.Sprite,
    req: _HeroAnimRequest,
    set: any,
    def: any,
    effectivePhase: any,
    allowFallback: boolean, // unused here but kept to mirror the old signature intent
    shouldProve: boolean
): void {
    const anySprite = sprite as any;

    const animKey = buildHeroAnimKey(set.heroName, def);

    const lastAnimKey = anySprite.getData ? (anySprite.getData(LAST_ANIM_KEY) as string | undefined) : undefined;
    const lastPhase = anySprite.getData ? (anySprite.getData(LAST_PHASE_KEY) as HeroPhase | undefined) : undefined;
    const lastDir = anySprite.getData ? (anySprite.getData(LAST_DIR_KEY) as HeroDir | undefined) : undefined;

    if (
        lastAnimKey === animKey &&
        lastPhase === def.phase &&
        lastDir === def.dir &&
        sprite.anims &&
        sprite.anims.currentAnim &&
        sprite.anims.currentAnim.key === animKey &&
        sprite.anims.isPlaying
    ) {
        if (shouldProve) _proveLogNoop(req, animKey, def);
        return;
    }

    if (!scene.anims.exists(animKey)) {
        if (shouldProve) _proveLogCreate(req, animKey, def);
        scene.anims.create({
            key: animKey,
            frames: scene.anims.generateFrameNumbers(def.textureKey, { frames: def.frameIndices }),
            frameRate: def.frameRate,
            repeat: def.repeat,
            yoyo: def.yoyo
        });
    }

    const restPhase = getRestPhase(def.phase);
    if (anySprite.setData) anySprite.setData(HERO_REST_PHASE_KEY, restPhase);

    if (shouldProve) _proveLogPlayBefore(sprite, req, animKey, restPhase);
    sprite.anims.play(animKey, true);
    if (shouldProve) _proveLogPlayAfter(sprite, req, animKey);

    if (anySprite.setData) {
        anySprite.setData(LAST_ANIM_KEY, animKey);
        anySprite.setData(LAST_PHASE_KEY, def.phase);
        anySprite.setData(LAST_DIR_KEY, def.dir);
    }

    _detachPrevAnimCompleteHandler(sprite);
    _attachAnimCompleteHandler(
        sprite,
        req,
        animKey,
        restPhase,
        /*phaseAtApply*/ req.phase,
        effectivePhase,
        def,
        shouldProve
    );
}



// ------------------------------------------------------------
// Main function (split; NO behavior change)
// ------------------------------------------------------------
// --- FULL REPLACEMENT: applyHeroAnimationForSpriteInternal ------------------
function applyHeroAnimationForSpriteInternal(
    sprite: Phaser.GameObjects.Sprite,
    allowFallback: boolean
): void {
    const scene = sprite.scene;
    const atlas = getHeroAtlasFromScene(scene);
    if (!atlas) {
        logGlue(scene, "applyHeroAnimationForSprite: no atlas");
        return;
    }

    const req = readHeroAnimRequest(sprite);
    const shouldProve = _shouldProveHeroAnim(req);

    if (shouldProve) _proveLogHeroAnimReq(sprite, req);

    if (!_requireHeroNameAndPhaseOrLog(scene, req)) return;

    const set = _findHeroSetOrLog(scene, atlas, req);
    if (!set) return;

    // ------------------------------------------------------------
    // NEW: part-aware phase selection (cast → cast_produce/drive/land)
    // ------------------------------------------------------------
    const phasePartName =
        (req as any).phasePartName && typeof (req as any).phasePartName === "string"
            ? ((req as any).phasePartName as string)
            : "";

    const requestedPhaseForLookup =
        (req.phase === "cast" && phasePartName)
            ? `${req.phase}_${phasePartName}`
            : req.phase;

    const effectivePhase = getEffectivePhaseForSet(set, requestedPhaseForLookup);
    const dirMap = set.phases[effectivePhase];

    if (shouldProve) _proveLogEffectivePhase(req, set, effectivePhase, dirMap);

    const resolvedDirMap = _resolveDirMapOrFallback(
        scene,
        sprite,
        req,
        set,
        effectivePhase,
        allowFallback,
        shouldProve
    );
    if (!resolvedDirMap) return;

    const def = _resolveDefOrFallback(
        scene,
        sprite,
        req,
        set,
        effectivePhase,
        resolvedDirMap,
        allowFallback,
        shouldProve
    );
    if (!def) return;

    if (shouldProve) _proveLogDef(req, def);

    // ------------------------------------------------------------
    // Strength charge throb (early return on success)
    // ------------------------------------------------------------
    if (_tryStrengthChargeThrob(scene, sprite, req, def, shouldProve)) {
        return;
    } else {
        _restoreBaseScaleIfPresent(sprite);
    }

    // ------------------------------------------------------------
    // Hold single-frame path (early return)
    // ------------------------------------------------------------
    if (_tryHoldSingleFrame(scene, sprite, req, def, shouldProve)) {
        return;
    }

    // ------------------------------------------------------------
    // Cast part frame control (early return)
    // ------------------------------------------------------------
    if (_tryCastPartFrameControl(scene, sprite, req, def, shouldProve)) {
        return;
    }

    // ------------------------------------------------------------
    // Default anim-based path
    // ------------------------------------------------------------
    _playDefaultAnimPath(scene, sprite, req, set, def, effectivePhase, allowFallback, shouldProve);
}





// ---------------------------------------------------------------------------
// Core glue: internal worker with a flag to avoid infinite fallback recursion
// ---------------------------------------------------------------------------




/**
 * Public entry point – just calls the internal worker with fallback enabled.
 */
export function applyHeroAnimationForSprite(sprite: Phaser.GameObjects.Sprite): void {
    applyHeroAnimationForSpriteInternal(sprite, /*allowFallback*/ true);
}

/**
 * Convenience helper: call this whenever your hero's logical state
 * changes (phase/dir/family/name), and the glue will update the animation.
 */
export function tryApplyHeroAnimation(sprite: Phaser.GameObjects.Sprite): void {
    applyHeroAnimationForSprite(sprite);
}

function buildHeroAnimKey(heroName: string, def: { phase: string; dir: string }): string {
    return `hero_${heroName}_${def.phase}_${def.dir}`;
}





// ================================================================
// Hero Aura (Phaser-side) — true silhouette outline from LPC pixels
// ================================================================

/**
 * Cache of generated outline textures:
 * key = `${textureKey}::${frameName}::r${radius}`
 */
const __heroAuraOutlineCache = new Map<string, string>();


// ---- PERF: aura outline generation ----
let __auraPerf_lastReportMs = 0;
let __auraPerf_calls = 0;
let __auraPerf_hits = 0;
let __auraPerf_misses = 0;
let __auraPerf_buildMs = 0;
let __auraPerf_totalMs = 0;


type HeroAuraMetrics = {
    innerR: number;      // max radius from center to any solid pixel
    leadUp: number;      // max distance toward up
    leadDown: number;    // max distance toward down
    leadLeft: number;    // max distance toward left
    leadRight: number;   // max distance toward right
    w: number;
    h: number;
};

const __heroAuraMetricsCache = new Map<string, HeroAuraMetrics>();


/** Per-hero aura sprite (native Phaser object), keyed by the native hero sprite */
const __heroAuraSpriteByHero = new WeakMap<Phaser.GameObjects.Sprite, Phaser.GameObjects.Image>();

/**
 * MakeCode Arcade 16-color palette (approx) → Phaser tint (0xRRGGBB).
 * If your aura colors are custom, feel free to override this mapping.
 */
const __arcadePaletteTint: number[] = [
    0x000000, // 0 black
    0xffffff, // 1 white
    0xff2121, // 2 red
    0xff93c4, // 3 pink
    0xff8135, // 4 orange
    0xfff609, // 5 yellow
    0x249ca3, // 6 teal
    0x78dc52, // 7 green
    0x003fad, // 8 blue
    0x87f2ff, // 9 light blue
    0x8e2ec4, // 10 purple
    0xa4839f, // 11 lavender/gray
    0x5c406c, // 12 dark purple
    0xe5cdc4, // 13 tan
    0x91463d, // 14 brown
    0x000000, // 15 (unused-ish)
];

function __tintForArcadeColorIndex(idx: number): number {
    idx = (idx | 0) & 0xf;
    return __arcadePaletteTint[idx] ?? 0xffffff;
}

function __outlineKeyForFrame(textureKey: string, frameName: string | number, radius: number): string {
    return textureKey + "::" + String(frameName) + "::r" + radius;
}

/**
 * Generates (and caches) a white outline texture for a given hero frame.
 * The returned value is the Phaser texture key to use for the outline.
 *
 * This is a TRUE silhouette outline: it is derived from the alpha of the LPC frame pixels.
 */
function __getOrBuildHeroOutlineTexture(
    scene: Phaser.Scene,
    textureKey: string,
    frameName: string | number,
    radius: number
): string {
    const cacheKey = __outlineKeyForFrame(textureKey, frameName, radius);

    const tPerf0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    __auraPerf_calls++;


    const existingTexKey = __heroAuraOutlineCache.get(cacheKey);
//    if (existingTexKey && scene.textures.exists(existingTexKey)) return existingTexKey;

    if (existingTexKey && scene.textures.exists(existingTexKey)) {
        __auraPerf_hits++;
        const tPerf1 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
        __auraPerf_totalMs += (tPerf1 - tPerf0);
        return existingTexKey;
    }
    __auraPerf_misses++;


    const frame = scene.textures.getFrame(textureKey, frameName);
    if (!frame) {
        // Fallback: if the frame can't be found, just reuse the hero frame (won't be an outline).
        return textureKey;
    }

    // Unique texture key for the outline canvas
    const outTexKey = "__heroAuraOutline__" + cacheKey;

    const cw = frame.width | 0;
    const ch = frame.height | 0;

    // If already created but missing from map, just return it.
    if (scene.textures.exists(outTexKey)) {
        __heroAuraOutlineCache.set(cacheKey, outTexKey);
        return outTexKey;
    }

    const ctex = scene.textures.createCanvas(outTexKey, cw, ch);
    const canvas = ctex.getSourceImage() as any;
    const ctx = canvas.getContext("2d", { willReadFrequently: true } as any);
    if (!ctx) {
        __heroAuraOutlineCache.set(cacheKey, outTexKey);
        return outTexKey;
    }

    // Draw the source frame into the canvas so we can read its pixels.
    ctx.clearRect(0, 0, cw, ch);
    const src: any = (frame as any).source?.image;
    const cutX = (frame as any).cutX | 0;
    const cutY = (frame as any).cutY | 0;

    try {
        // Draw the frame region into (0,0)-(cw,ch)
        ctx.drawImage(src, cutX, cutY, cw, ch, 0, 0, cw, ch);
    } catch {
        // If drawImage fails, leave blank.
    }

    const img = ctx.getImageData(0, 0, cw, ch);
    const data = img.data;

    // Build a binary mask of "solid" pixels from alpha (>0).
    const solid = new Uint8Array(cw * ch);

    // ------------------------------------------------------------
    // Silhouette metrics (from `solid[]`) for Strength + other FX
    // ------------------------------------------------------------
    const cx = (cw - 1) / 2;
    const cy = (ch - 1) / 2;

    let maxR = 0;
    let leadUp = 0, leadDown = 0, leadLeft = 0, leadRight = 0;



    for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
            const i = (y * cw + x) * 4;
            solid[y * cw + x] = data[i + 3] > 0 ? 1 : 0;
        }
    }


    for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
            if (!solid[y * cw + x]) continue;

            const dx = x - cx;
            const dy = y - cy;

            const r = Math.sqrt(dx * dx + dy * dy);
            if (r > maxR) maxR = r;

            // cardinal projections
            if (dx > leadRight) leadRight = dx;
            if (-dx > leadLeft) leadLeft = -dx;
            if (dy > leadDown) leadDown = dy;
            if (-dy > leadUp) leadUp = -dy;
        }
    }

    __heroAuraMetricsCache.set(cacheKey, {
        innerR: maxR,
        leadUp,
        leadDown,
        leadLeft,
        leadRight,
        w: cw,
        h: ch
    });



    // Outline pixel = NOT solid, but within 'radius' of a solid pixel.
    const outline = new Uint8Array(cw * ch);
    for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
            const idx = y * cw + x;
            if (solid[idx]) continue;

            let near = false;
            for (let dy = -radius; dy <= radius && !near; dy++) {
                const yy = y + dy;
                if (yy < 0 || yy >= ch) continue;
                for (let dx = -radius; dx <= radius && !near; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const xx = x + dx;
                    if (xx < 0 || xx >= cw) continue;
                    if (solid[yy * cw + xx]) near = true;
                }
            }
            if (near) outline[idx] = 1;
        }
    }

    // Write out a WHITE outline with alpha=255 (tint will color it).
    for (let i = 0; i < outline.length; i++) {
        const p = i * 4;
        if (outline[i]) {
            data[p + 0] = 255;
            data[p + 1] = 255;
            data[p + 2] = 255;
            data[p + 3] = 255;
        } else {
            data[p + 0] = 0;
            data[p + 1] = 0;
            data[p + 2] = 0;
            data[p + 3] = 0;
        }
    }

    ctx.putImageData(img, 0, 0);
    ctex.refresh();

    __heroAuraOutlineCache.set(cacheKey, outTexKey);



    const tPerf1 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    __auraPerf_buildMs += (tPerf1 - tPerf0);
    __auraPerf_totalMs += (tPerf1 - tPerf0);

    // Report once/sec (keep it small)
    if (!__auraPerf_lastReportMs) __auraPerf_lastReportMs = tPerf1;
    if (tPerf1 - __auraPerf_lastReportMs >= 1000) {
        console.log(
            "[perf.auraOutline]",
            "calls=", __auraPerf_calls,
            "hit=", __auraPerf_hits,
            "miss=", __auraPerf_misses,
            "buildMs≈", __auraPerf_buildMs.toFixed(2),
            "totalMs≈", __auraPerf_totalMs.toFixed(2)
        );
        __auraPerf_lastReportMs = tPerf1;
        __auraPerf_calls = 0;
        __auraPerf_hits = 0;
        __auraPerf_misses = 0;
        __auraPerf_buildMs = 0;
        __auraPerf_totalMs = 0;
    }


    return outTexKey;
}




// ------------------------------------------------------------
// 1-bit outline mask caching (packed bitset)
// Keyed by: texKey|frameName|r
// ------------------------------------------------------------

type MaskEntry = {
    w: number;
    h: number;
    // Packed bits: bit i means pixel i is ON
    bits: Uint32Array;
};

const __auraMaskCache = new Map<string, MaskEntry>();

function __maskKey(texKey: string, frameName: string, r: number): string {
    return `${texKey}|${frameName}|r=${r}`;
}

function __bitIndex(x: number, y: number, w: number): number {
    return y * w + x;
}

function __getBit(bits: Uint32Array, i: number): boolean {
    return (bits[i >>> 5] & (1 << (i & 31))) !== 0;
}

function __setBit(bits: Uint32Array, i: number): void {
    bits[i >>> 5] |= (1 << (i & 31));
}

function __allocBits(w: number, h: number): Uint32Array {
    const n = w * h;
    const words = (n + 31) >>> 5;
    return new Uint32Array(words);
}

// Draw a Phaser frame into a canvas and return ImageData
function __readFrameImageData(scene: Phaser.Scene, texKey: string, frameName: string): ImageData {
    const tex = scene.textures.get(texKey);
    const frame = tex.get(frameName);

    const w = frame.width;
    const h = frame.height;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.clearRect(0, 0, w, h);

    // Draw the frame region from its source image
    const src = (frame as any).source?.image as HTMLImageElement | HTMLCanvasElement | undefined;
    if (!src) {
        throw new Error(`[auraMask] no frame source image for ${texKey}:${frameName}`);
    }

    // Phaser Frame has cutX/cutY or x/y depending on build; support both
    const sx = (frame as any).cutX ?? (frame as any).x ?? 0;
    const sy = (frame as any).cutY ?? (frame as any).y ?? 0;

    ctx.drawImage(src, sx, sy, w, h, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
}

// Build a 1-bit mask from alpha>0 pixels, then dilate by radius r
function __buildDilatedMaskBitsFromImage(img: ImageData, r: number): MaskEntry {
    const w = img.width;
    const h = img.height;

    // Base mask: alpha>0
    const base = __allocBits(w, h);
    const data = img.data;

    // alpha channel index = 3
    for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
            const a = data[(row + x) * 4 + 3];
            if (a !== 0) __setBit(base, __bitIndex(x, y, w));
        }
    }

    if (r <= 0) return { w, h, bits: base };

    // Dilation: for each ON pixel, turn on neighbors in radius r
    // (Simple square kernel; matches your r=2 use and is fast enough)
    const out = __allocBits(w, h);

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = __bitIndex(x, y, w);
            if (!__getBit(base, i)) continue;

            const y0 = Math.max(0, y - r);
            const y1 = Math.min(h - 1, y + r);
            const x0 = Math.max(0, x - r);
            const x1 = Math.min(w - 1, x + r);

            for (let yy = y0; yy <= y1; yy++) {
                const row = yy * w;
                for (let xx = x0; xx <= x1; xx++) {
                    __setBit(out, row + xx);
                }
            }
        }
    }

    return { w, h, bits: out };
}

// Exported: get/build and cache 1-bit mask for a specific frame
export function getOrBuildHeroAuraMaskBits(
    scene: Phaser.Scene,
    texKey: string,
    frameName: string,
    r: number
): MaskEntry {
    const key = __maskKey(texKey, frameName, r);
    const hit = __auraMaskCache.get(key);
    if (hit) return hit;

    const img = __readFrameImageData(scene, texKey, frameName);
    const entry = __buildDilatedMaskBitsFromImage(img, r);
    __auraMaskCache.set(key, entry);
    return entry;
}





// Exported: async prewarm all frames of a texture into 1-bit mask cache
// AND pre-create the white aura textures that syncHeroAuraForNative() uses.
export async function prewarmHeroAuraMasksAsync(
    scene: Phaser.Scene,
    texKey: string,
    r: number,
    onProgress?: (done: number, total: number) => void,
    budgetMsPerTick = 6
): Promise<void> {

    console.log("[aura.prewarm] texKey=", texKey, "frames=", total, "radius=", r);

    const tex = scene.textures.get(texKey);

    // Prefer numeric spritesheet frames: 0..(frameTotal-1)
    const base = tex.get("__BASE");
    const total = (base && typeof (base as any).frameTotal === "number")
    ? (base as any).frameTotal
    : (tex.getFrameNames?.() ?? []).filter((n: any) => String(n) !== "__BASE").length;

    const frameNames: string[] = [];
    for (let fi = 0; fi < total; fi++) frameNames.push(String(fi));



//    const tex = scene.textures.get(texKey);
//    const frameNames = (tex.getFrameNames?.() ?? [])
//        .filter((n: any) => String(n) !== "__BASE")
//        .map(String);

//    const total = frameNames.length;
    let done = 0;

    let i = 0;
    while (i < frameNames.length) {
        const t0 = performance.now();

        while (i < frameNames.length) {
            const frameName = frameNames[i++];

            // 1) bits cache
            const mask = getOrBuildHeroAuraMaskBits(scene, texKey, frameName, r);

            // 2) texture cache (white base, tint at runtime)
            const outTexKey = `__heroAuraBits__${texKey}::${frameName}::r${r}`;
            if (!scene.textures.exists(outTexKey)) {
                renderAuraTextureFromMaskBits(scene, outTexKey, mask, [255, 255, 255, 255]);
            }

            done++;
            onProgress?.(done, total);

            if (performance.now() - t0 > budgetMsPerTick) break;
        }

        // yield to keep UI responsive
        await new Promise<void>((resolve) => scene.time.delayedCall(0, () => resolve()));
    }
}




// Create (only once) a Phaser texture from a cached 1-bit mask
export function renderAuraTextureFromMaskBits(
    scene: Phaser.Scene,
    outTexKey: string,
    mask: MaskEntry,
    rgba: [number, number, number, number] // alpha 0..255
): void {
    if (scene.textures.exists(outTexKey)) return; // IMPORTANT: don't recreate

    const { w, h, bits } = mask;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const img = ctx.createImageData(w, h);
    const data = img.data;

    const [r, g, b, a] = rgba;

    const n = w * h;
    for (let i = 0; i < n; i++) {
        if (!__getBit(bits, i)) continue;
        const p = i * 4;
        data[p + 0] = r;
        data[p + 1] = g;
        data[p + 2] = b;
        data[p + 3] = a;
    }

    ctx.putImageData(img, 0, 0);
    scene.textures.addCanvas(outTexKey, canvas);
}








export function prewarmHeroAuraOutlines(
    scene: Phaser.Scene,
    texKey: string,
    radius: number,
    budgetMsPerTick: number = 6
): void {
    const tex = scene.textures.get(texKey);
    if (!tex) {
        console.log("[aura.prewarm] missing texture:", texKey);
        return;
    }

    // Phaser frame names include "__BASE" sometimes; skip it
    const frames = (tex.getFrameNames ? tex.getFrameNames() : []) as (string | number)[];
    const frameNames = frames.filter((f) => String(f) !== "__BASE");

    console.log("[aura.prewarm] start tex=", texKey, "frames=", frameNames.length, "r=", radius);

    let i = 0;
    const step = () => {
        const t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();

        while (i < frameNames.length) {
            const frameName = frameNames[i++];
            __getOrBuildHeroOutlineTexture(scene, texKey, frameName, radius);

            const t1 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
            if ((t1 - t0) >= budgetMsPerTick) break;
        }

        if (i < frameNames.length) {
            // continue next tick
            scene.time.delayedCall(0, step);
        } else {
            console.log("[aura.prewarm] done tex=", texKey, "frames=", frameNames.length, "r=", radius);
        }
    };

    scene.time.delayedCall(0, step);
}



export async function prewarmHeroAuraOutlinesAsync(
    scene: Phaser.Scene,
    heroTexKey: string,
    radius: number,
    onProgress?: (done: number, total: number) => void,
    budgetMsPerTick: number = 6
): Promise<void> {
    if (!scene) throw new Error("[prewarmHeroAuraOutlinesAsync] missing scene");
    if (!heroTexKey) return;

    const auraTexKey = `${heroTexKey}_aura_r${radius}`;

    if (!scene.textures.exists(heroTexKey)) {
        throw new Error(`[AURA-PREWARM] Hero texture missing: ${heroTexKey}`);
    }
    if (!scene.textures.exists(auraTexKey)) {
        throw new Error(
            `[AURA-MISSING] Texture not loaded: ${auraTexKey}. Run: npm run gen-auras`
        );
    }

    const heroTex = scene.textures.get(heroTexKey);
    const auraTex = scene.textures.get(auraTexKey);

    const heroFrames = (heroTex.getFrameNames ? heroTex.getFrameNames() : []) as any[];
    const frameNames = heroFrames.filter((f: any) => String(f) !== "__BASE");

    const total = frameNames.length || 1;
    let done = 0;

    const tick = async (): Promise<void> => {
        const tStart = performance.now();

        while (done < frameNames.length) {
            const fn = frameNames[done];

            // Validate aura has matching frame
            const af = auraTex.get(fn);
            if (!af) {
                throw new Error(
                    `[AURA-FRAME-MISSING] ${auraTexKey} missing frame=${String(fn)} (heroTex=${heroTexKey})`
                );
            }

            // Touch the frame so Phaser caches internals
            // (no pixels, just frame lookup)
            done++;
            if (onProgress) onProgress(done, total);

            if ((performance.now() - tStart) >= budgetMsPerTick) break;
        }

        if (done < frameNames.length) {
            await new Promise<void>((resolve) => {
                scene.time.delayedCall(0, () => resolve());
            });
            return tick();
        }
    };

    await tick();
}






/**
 * Sync aura for a native Phaser hero sprite.
 *
 * - auraActive=false: hides aura if present
 * - auraActive=true : ensures a TRUE outline exists, matches current hero frame, and follows the hero
 *
 * Uses 1-bit mask cache + renders a white aura texture (then tint).
 */

export function syncHeroAuraForNative(
    native: any,
    auraActive: boolean,
    auraColorIndex: number
): void {
    try {
        if (!native) return;

        const scene: Phaser.Scene | undefined = (globalThis as any).__phaserScene;
        if (!scene) return;

        // If aura is off, hide and bail.
        const auraAny: any = (native as any).__heroAuraImage;
        if (!auraActive) {
            if (auraAny) auraAny.setVisible(false);
            return;
        }

        // Spritesheet-only mode: aura texture must already be generated + loaded.
        const heroTexKey = native.texture?.key ? String(native.texture.key) : "";
        if (!heroTexKey) return;

        const radius = 2; // hard-locked to r2 in this pipeline
        const auraTexKey = `${heroTexKey}_aura_r${radius}`;

        if (!scene.textures.exists(auraTexKey)) {
            throw new Error(
                `[AURA-MISSING] Texture not loaded: ${auraTexKey}. Run: npm run gen-auras`
            );
        }

        // Use the SAME frame name/index as the hero.
        const heroFrameName =
            (native.frame && (native.frame.name !== undefined))
                ? native.frame.name
                : undefined;

        const auraTex = scene.textures.get(auraTexKey);
        const auraFrame =
            (heroFrameName !== undefined)
                ? auraTex.get(heroFrameName as any)
                : null;

        if (!auraFrame) {
            throw new Error(
                `[AURA-FRAME-MISSING] ${auraTexKey} missing frame=${String(heroFrameName)} (heroTex=${heroTexKey})`
            );
        }

        // Create aura image once.
        let auraImg: Phaser.GameObjects.Image;
        if (!auraAny || !(auraAny as any).scene) {
            auraImg = scene.add.image(native.x, native.y, auraTexKey, heroFrameName as any);
            (native as any).__heroAuraImage = auraImg;

            // Match origin if present (Sprite has origin; Image too)
            if (typeof native.originX === "number" && typeof native.originY === "number") {
                auraImg.setOrigin(native.originX, native.originY);
            }
        } else {
            auraImg = auraAny as Phaser.GameObjects.Image;
            auraImg.setTexture(auraTexKey, heroFrameName as any);
        }

        // Follow transforms
        auraImg.x = native.x;
        auraImg.y = native.y;

        // Depth policy (Step 7): aura behind weapon BG (heroDepth - 1)
        const heroDepth = (native as any).depth ?? 0;
        auraImg.setDepth(heroDepth - 2);

        auraImg.setVisible(true);
        auraImg.alpha = 1;

        // Match scale/flip/rotation
        auraImg.scaleX = native.scaleX ?? 1;
        auraImg.scaleY = native.scaleY ?? 1;
        auraImg.rotation = native.rotation ?? 0;

        if (typeof (auraImg as any).setFlipX === "function") {
            (auraImg as any).setFlipX(!!native.flipX);
        }
        if (typeof (auraImg as any).setFlipY === "function") {
            (auraImg as any).setFlipY(!!native.flipY);
        }

        // Tint
        if (typeof auraImg.setTint === "function") {
            const tintHex = __tintForArcadeColorIndex(auraColorIndex | 0);
            if (tintHex !== 0) auraImg.setTint(tintHex);
            else auraImg.clearTint();
        }
    } catch (e) {
        // Preserve your existing “fail loudly” behavior for missing textures,
        // but don’t hard-crash the whole game loop for non-critical issues.
        throw e;
    }
}





export function getHeroAuraLeadForNativeDir(
    native: Phaser.GameObjects.Sprite,
    dir: "up" | "down" | "left" | "right",
    radius: number
): number {
    // In spritesheet-only mode we do NOT do directional pixel lead scans.
    // We approximate lead as (innerR + radius) from the aura frame size.
    const innerR = getHeroAuraInnerRForNative(native, radius);
    if (innerR > 0) return innerR + (radius | 0);

    // Fallback: half of native display size
    const w = (native.displayWidth || native.width || 0);
    const h = (native.displayHeight || native.height || 0);
    const half = Math.floor(Math.min(w, h) / 2);
    return half > 0 ? half : 0;
}


export function getHeroAuraInnerRForNative(
    native: Phaser.GameObjects.Sprite,
    radius: number
): number {
    const scene: Phaser.Scene | undefined = (globalThis as any).__phaserScene;
    if (!scene || !native) return 0;

    const heroTexKey = native.texture?.key ? String(native.texture.key) : "";
    if (!heroTexKey) return 0;

    const auraTexKey = `${heroTexKey}_aura_r${radius}`;
    if (!scene.textures.exists(auraTexKey)) return 0;

    const frameName = (native.frame && (native.frame.name !== undefined)) ? native.frame.name : undefined;
    const auraTex = scene.textures.get(auraTexKey);
    const af = (frameName !== undefined) ? auraTex.get(frameName as any) : null;
    if (!af) return 0;

    const w = af.width | 0;
    const h = af.height | 0;

    // Inner radius ≈ half of aura frame minus the halo thickness
    const inner = Math.floor(Math.min(w, h) / 2) - (radius | 0);
    return inner > 0 ? inner : 0;
}



// ----------------------------------------------------------
//  Simple debug / smoke-test entry point
// ----------------------------------------------------------

export interface DebugHeroAnimOptions {
    heroName?: string;
    family?: "strength" | "agility" | "intelligence" | "support";
    phase?: HeroPhase;
    dir?: HeroDir;
    x?: number;
    y?: number;
}

/**
 * Debug helper: create a hero sprite in the middle of the scene and
 * immediately play the requested animation, using the HeroAtlas +
 * data-driven glue path.
 */
export function debugSpawnHeroWithAnim(
    scene: Phaser.Scene,
    opts: DebugHeroAnimOptions = {}
): Phaser.GameObjects.Sprite | undefined {
    const atlas = getHeroAtlasFromScene(scene);
    if (!atlas) {
        logGlue(scene, "debugSpawnHeroWithAnim: no atlas");
        return undefined;
    }

    const allSets: HeroAnimSet[] = Object.values(atlas);
    if (allSets.length === 0) {
        logGlue(scene, "debugSpawnHeroWithAnim: atlas empty");
        return undefined;
    }

    let heroName = opts.heroName;
    let family = opts.family;

    if (!heroName || !family) {
        // Default to the first discovered hero
        const first = allSets[0];
        heroName = heroName || first.heroName;
        family = family || first.family;
    }

    const phase: HeroPhase = opts.phase || "idle";
    const dir: HeroDir = opts.dir || "down";

    const x = opts.x ?? (scene.cameras.main?.width || 160) / 2;
    const y = opts.y ?? (scene.cameras.main?.height || 120) / 2;

    const set = findHeroAnimSet(atlas, heroName!, family!);
    if (!set) {
        logGlue(scene, "debugSpawnHeroWithAnim: could not find HeroAnimSet", {
            heroName,
            family
        });
        return undefined;
    }

    const sprite = scene.add.sprite(x, y, set.textureKey, 0);


    // Force the debug hero to render on top of everything.
    sprite.setDepth(9999);
    sprite.setVisible(true);
    (sprite as any).alpha = 1;



    const anySprite = sprite as any;
    if (anySprite.setData) {
        anySprite.setData(HERO_NAME_KEY, heroName);
        anySprite.setData(HERO_FAMILY_KEY, family);
        anySprite.setData(HERO_PHASE_KEY, phase);
        anySprite.setData(HERO_DIR_KEY, dir);
        anySprite.setData(HERO_REST_PHASE_KEY, "idle");
    }


    logGlue(scene, "debugSpawnHeroWithAnim: spriteState", {
        textureKey: sprite.texture.key,
        frameIndex: (sprite.frame as any)?.index,
        x: sprite.x,
        y: sprite.y,
        depth: sprite.depth,
        visible: sprite.visible,
        alpha: (sprite as any).alpha
    });


    logGlue(scene, "debugSpawnHeroWithAnim: created sprite", {
        heroName,
        family,
        phase,
        dir,
        x,
        y
    });

    applyHeroAnimationForSprite(sprite);

    return sprite;
}

// ----------------------------------------------------------
// Hero animation tester: cycle phases + dirs with keyboard
// ----------------------------------------------------------

const PRIMARY_PHASES: HeroPhase[] = [
    // 1–0 mapping:
    // 1
    "cast",
    // 2
    "thrust",
    // 3
    "walk",
    // 4
    "slash",
    // 5
    "shoot",
    // 6
    "hurt",
    // 7
    "climb",
    // 8
    "idle",
    // 9
    "jump",
    // 0
    "sit"
];

const EXTRA_PHASES: HeroPhase[] = [
    "emote",
    "run",
    "watering",
    "combatIdle",
    "oneHandSlash",
    "oneHandBackslash",
    "oneHandHalfslash",
    "thrustOversize",
    "slashOversize"
];

const TEST_DIRS: HeroDir[] = ["up", "left", "down", "right"];

export function installHeroAnimTester(scene: Phaser.Scene): void {
    const atlas = getHeroAtlasFromScene(scene);
    if (!atlas) {
        logGlue(scene, "installHeroAnimTester: no atlas");
        return;
    }


    const allSets = Object.values(atlas);
    if (allSets.length === 0) {
        logGlue(scene, "installHeroAnimTester: atlas empty");
        return;
    }

    // Prefer a Strength hero (so we see both thrust+slash oversize),
    // fall back to "first" if none.
    let first = allSets[0];
    const strengthSet = allSets.find(s => s.family === "strength");
    if (strengthSet) first = strengthSet;






    // Spawn a debug hero in the middle, default idle/down
    const sprite = debugSpawnHeroWithAnim(scene, {
        heroName: first.heroName,
        family: first.family,
        phase: "idle",
        dir: "down"
    });
    if (!sprite) return;

    const anySprite = sprite as any;

    let usingPrimary = false;
    let phaseIndex = 7; // "idle" in PRIMARY_PHASES
    let dirIndex = 2;   // "down"

    const apply = () => {
        const phaseSet = usingPrimary ? PRIMARY_PHASES : EXTRA_PHASES;
        const clampedIndex = Math.max(0, Math.min(phaseIndex, phaseSet.length - 1));
        const phase = phaseSet[clampedIndex];
        const dir = TEST_DIRS[dirIndex];

        if (anySprite.setData) {
            anySprite.setData(HERO_PHASE_KEY, phase);
            anySprite.setData(HERO_DIR_KEY, dir);
            anySprite.setData(HERO_REST_PHASE_KEY, "idle");
        }

        logGlue(scene, "tester.apply", {
            set: usingPrimary ? "primary" : "extra",
            phaseIndex,
            clampedIndex,
            phase,
            dir
        });
        applyHeroAnimationForSprite(sprite);
    };

    apply(); // initial

    const kb = scene.input.keyboard;

    kb.on("keydown", (ev: KeyboardEvent) => {
        switch (ev.code) {
            case "Digit1":
                phaseIndex = 0;
                break;
            case "Digit2":
                phaseIndex = 1;
                break;
            case "Digit3":
                phaseIndex = 2;
                break;
            case "Digit4":
                phaseIndex = 3;
                break;
            case "Digit5":
                phaseIndex = 4;
                break;
            case "Digit6":
                phaseIndex = 5;
                break;
            case "Digit7":
                phaseIndex = 6;
                break;
            case "Digit8":
                phaseIndex = 7;
                break;
            case "Digit9":
                phaseIndex = 8;
                break;
            case "Digit0":
                phaseIndex = 9;
                break;

            case "ArrowUp":
                dirIndex = 0;
                break;
            case "ArrowLeft":
                dirIndex = 1;
                break;
            case "ArrowDown":
                dirIndex = 2;
                break;
            case "ArrowRight":
                dirIndex = 3;
                break;

            case "KeyQ":
                usingPrimary = !usingPrimary;
                // Clamp phase index if we switch to shorter extra set
                if (!usingPrimary && phaseIndex >= EXTRA_PHASES.length) {
                    phaseIndex = EXTRA_PHASES.length - 1;
                }
                break;

            default:
                return;
        }

        apply();
    });

    logGlue(scene, "installHeroAnimTester: controls ready", {
        primaryPhases: PRIMARY_PHASES,
        extraPhases: EXTRA_PHASES,
        dirs: TEST_DIRS,
        controls: "1–0 phase, arrows dir, Q toggle primary/extra set"
    });
}




// Optional: global helper so you can flip the per-file debug without rebuild.
(globalThis as any).setHeroAnimDebugEnabled = (on: boolean) => {
    HERO_GLUE_DEBUG.enabled = !!on;
};
