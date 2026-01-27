// src/heroAnimGlue.ts
import type Phaser from "phaser";

import {
    findHeroAnimSet,
    getHeroAtlasFromScene,
    normalizeHeroPhase,
    type HeroAnimSet,
    type HeroDir,
    type HeroFrameDef,
    type HeroPhase
} from "./heroAtlas";
import {
    DEBUG_HERO_ANIM_GLUE,
    DEBUG_HERO_ANIM_GLUE_FOCUS_ON_INTELLECT,
    DEBUG_HERO_ANIM_GLUE_ONLY_PROBLEMS,
    DEBUG_HERO_ANIM_FRAMES,
    DEBUG_HERO_ANIM_FRAMES_ONLY_CHANGES,
    DEBUG_HERO_ANIM_FRAMES_STRENGTH_ONLY,
    DEBUG_HERO_ANIM_FRAMES_THROTTLE_MS,
    DEBUG_HERO_ANIM_STRENGTH_TRACE,
    DEBUG_INT_HERO_ANIM,
    DEBUG_INT_HERO_NAME_FILTER,
    DEBUG_NPC_PIPELINE,
    DEBUG_PROP_OUTLINE_EXAGGERATE,
    DEBUG_PROP_OUTLINE_EXAGGERATE_TINT,
    DEBUG_PROP_OUTLINE_ONELOG,
    DEBUG_PROP_OUTLINE_PREFER_CAMERA_SNAPSHOT,
    DEBUG_PROP_OUTLINE_PREFER_PIXEL_PROBE,
    DEBUG_PROP_OUTLINE_VERBOSE,
    DEBUG_PROVE_HERO_CAST_ANIM,
    DEBUG_PROVE_HERO_NAME_FILTER,
    DEBUG_TURN_SHOULD_PROVE_ON,
    DEBUG_EFFECT_MASKS,
    FORCE_PROP_SCALE_OUTLINE,
} from "./debugFlags";
import {
    STR_SWING_FORWARD_FRAME_MS,
    STR_SWING_RESET_FRAME_COLS,
    STR_SWING_RESET_FRAME_MS,
    STR_SWING_RESET_INTRO_MS,
    STR_SWING_RESET_OUTRO_MS,
    STR_SWING_WINDUP_FRAME_MS,
} from "./strengthAnimTiming";
import { DEFAULT_AURA_RADIUS, auraKey, pickAuraRadius } from "./auraConfig";


// Data keys we will use on hero sprites.
// (Kept separate from monster keys.)
const HERO_NAME_KEY   = "heroName";
const HERO_FAMILY_KEY = "heroFamily";
const HERO_PHASE_KEY  = "phase";   // same key name as monsters, different value set
const HERO_DIR_KEY    = "dir";
const HERO_AIM_DIR_X1000_KEY = "aimDx";
const HERO_AIM_DIR_Y1000_KEY = "aimDy";
const HERO_AIM_ANGLE_MDEG_KEY = "aimAng";

// Internal bookkeeping keys on the Phaser sprite
const LAST_ANIM_KEY  = "__heroLastAnimKey";
const LAST_PHASE_KEY = "__heroLastPhase";
const LAST_DIR_KEY   = "__heroLastDir";

// Store the current "rest" phase so we know what to snap back to
const HERO_REST_PHASE_KEY = "__heroRestPhase";
// Store the animationcomplete handler so we can detach/replace it cleanly
const HERO_ANIMCOMPLETE_HANDLER_KEY = "__heroAnimCompleteHandler";

const HERO_FRAME_COL_OVERRIDE_KEY = "frameColOverride"
const HERO_ANIM_HOLD_KEY = "animHold"
const HERO_FRAME_LOG_LAST_IDX_KEY = "__heroFrameLogIdx";
const HERO_FRAME_LOG_LAST_MS_KEY = "__heroFrameLogAt";
const HERO_STR_TRACE_ACTIVE_KEY = "__strTraceActive";
const HERO_STR_TRACE_SEQ_KEY = "__strTraceSeq";
const HERO_STR_TRACE_START_MS_KEY = "__strTraceStartMs";
const HERO_STR_TRACE_START_KIND_KEY = "__strTraceStartKind";
const HERO_STR_TRACE_ENTRIES_KEY = "__strTraceEntries";
const HERO_STR_TRACE_LAST_FRAME_KEY = "__strTraceLastFrame";

const HERO_AIM_TILT_MAX_DEG = 8;
const HERO_AIM_TILT_MAX_RAD = (HERO_AIM_TILT_MAX_DEG * Math.PI) / 180;
const HERO_AIM_TILT_UP_DEG = 30;
const HERO_AIM_TILT_SIDE_DEG = 45;

// Strength swing reset tuning (manual frame timeline)
const STR_RESET_ENABLE = true;
const STR_CUSTOM_TIMELINE_ENABLE = true;
const STR_CUSTOM_PART_KEY = "__strCustomPart";
const STR_CUSTOM_PART_START_MS_KEY = "__strCustomPartStartMs";
const STR_CUSTOM_PART_SEQ_KEY = "__strCustomPartSeq";
const STR_RESET_MIN_MS = (() => {
    const ms = STR_SWING_RESET_FRAME_MS;
    if (ms && ms.length) {
        let sum = 0;
        for (let i = 0; i < ms.length; i++) sum += Math.max(1, ms[i] | 0);
        return Math.max(1, sum | 0);
    }
    return 1;
})();
const STR_RESET_WOBBLE_SCALE = 0.02;
const STR_RESET_WOBBLE_MS = 200;


// Local phase window tracking (because engine PhaseStartMs is Arcade time, not Phaser time)
const HERO_LOCAL_PHASE_ACTIONSEQ_KEY = "__heroLocalPhaseActionSequence";
const HERO_LOCAL_PHASE_LOCAL_START_KEY = "__heroLocalPhaseLocalStartMs";
const HERO_LOCAL_PHASE_LOCAL_DUR_KEY = "__heroLocalPhaseLocalDurMs";

// --- ADD: weapon-follow contract keys published on the hero sprite ---
const HERO_FOLLOW_FRAME_IN_CLIP_KEY = "HeroFollowFrameInClip"; // 0..clipLen-1
const HERO_FOLLOW_CLIP_LEN_KEY = "HeroFollowClipLen";          // N


const HERO_ACTION_KIND_KEY = "ActionKind";
const HERO_ACTION_SEQUENCE_KEY = "ActionSequence";
const HERO_PHASE_DURATION_MS_KEY = "PhaseDurationMs";
const HERO_PHASE_PROGRESS_INT_KEY = "PhaseProgressInt";

const HERO_BASE_SCALE_X_KEY = "__heroBaseScaleX";
const HERO_BASE_SCALE_Y_KEY = "__heroBaseScaleY";


const HERO_PHASE_NAME_KEY = "PhaseName"
const HERO_PHASE_START_MS_KEY = "PhaseStartMs"

// Debug flags live in src/debugFlags.ts

// Strength swing segmentation (engine publishes these as an addon channel)
const STR_SEG_NAME_KEY = "STR_SEG_NAME";
const STR_SEG_START_MS_KEY = "STR_SEG_START_MS";
const STR_SEG_DUR_MS_KEY = "STR_SEG_DUR_MS";
const STR_SEG_PROGRESS_INT_KEY = "STR_SEG_PROGRESS_INT";
const STR_SWING_SKIP_WINDUP_KEY = "SS_SKIP_WINDUP";
const STR_SWING_START_COL_KEY = "SS_START_COL";


// Debug flags live in src/debugFlags.ts


// --- ADD: canonical frame contract keys (additive; do NOT replace existing follow keys) ---
const HERO_CANON_ABS_FRAME_KEY = "HeroCanonAbsFrame";              // absolute spritesheet frame index currently displayed
const HERO_CANON_FRAME_IN_CANON_CLIP_KEY = "HeroCanonFrameInCanonClip"; // 0..canonClipLen-1 (best-effort)
const HERO_CANON_CLIP_LEN_KEY = "HeroCanonClipLen";                // N (best-effort)
const HERO_CANON_CLIP_PHASE_KEY = "HeroCanonClipPhase";            // e.g. "thrust" or "slash"
const HERO_CANON_CLIP_DIR_KEY = "HeroCanonClipDir";                // e.g. "right"


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

// NPC-specific logging (off by default)
const NPC_ANIM_LOG_ONCE_KEY = "__npcAnimLogged";


function heroGlueDebug(scene: Phaser.Scene): boolean {
    // Global master switch lives in the registry (same as atlas).
    return !!scene.registry.get("heroAnimDebug") && HERO_GLUE_DEBUG.enabled;
}

function isNpcHeroSprite(sprite: Phaser.GameObjects.Sprite): boolean {
    const anySprite: any = sprite as any;
    const getData = anySprite && typeof anySprite.getData === "function" ? anySprite.getData.bind(anySprite) : null;
    if (!getData) return false;
    const isNpc = !!getData("isNpc") || !!getData("npcLpc");
    const role = String(getData("_npcRole") || "");
    const heroName = String(getData("heroName") || "");
    if (isNpc || role) return true;
    return heroName === "Shopkeeper" || heroName === "Statue";
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

        const SHOULD_LOG_CASTTIME = false;
        if (SHOULD_LOG_CASTTIME) {
        if (shouldProve) {
            // eslint-disable-next-line no-console
            console.log(
                `[PROVE][HERO-ANIM][CAST-PART-TIME] | part=${partNameRaw} ` +
                `sceneNowMs=${sceneNowMs} engineNowMs=${engineNowMs} offsetMs=${offsetMs} ` +
                `startMs=${startMs} durMs=${durMs} elapsedMs=${Math.max(0, Math.min(durMs, engineNowMs - startMs))} ` +
                `rule=${rule.start}..${rule.end} span=${span} clipIdx=${clipIdx}`
            );
        }
    };
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

    const SHOULD_LOG_APPLY = false;
    if (SHOULD_LOG_APPLY) {
    if (shouldProve) {
        // eslint-disable-next-line no-console
        console.log(
            `[PROVE][HERO-ANIM][CAST-PART-APPLY] | part=${partNameRaw} ` +
            `clipIdx=${clipIdx} frameIndex=${frameIndex} startMs=${startMs} durMs=${durMs}`
        );
    }
    };
    return true;
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

function _heroAimIsDiagonal(dx1000: number, dy1000: number): boolean {
    return (dx1000 | 0) !== 0 && (dy1000 | 0) !== 0;
}

function _heroShouldUseSideDirForAim(phase: HeroPhase | null, actionKind?: string): boolean {
    const ak = (actionKind || "").toLowerCase();
    if (ak.startsWith("strength") || ak.startsWith("agility")) return true;
    if (!phase) return false;
    if (phase === "slash" || phase === "thrust") return true;
    if (phase === "oneHandSlash" || phase === "oneHandBackslash" || phase === "oneHandHalfslash") return true;
    if (phase === "slashOversize" || phase === "thrustOversize") return true;
    return false;
}

// ------------------------------------------------------------
// Split helpers (NO behavior change; refactor only)
// ------------------------------------------------------------

type _HeroAnimRequest = ReturnType<typeof readHeroAnimRequest>;

function _shouldProveHeroAnim(req: _HeroAnimRequest): boolean {
    if (        !!DEBUG_PROVE_HERO_CAST_ANIM &&
        req.phase === "cast" &&
        (!DEBUG_PROVE_HERO_NAME_FILTER || req.heroName === DEBUG_PROVE_HERO_NAME_FILTER)) {
            return true;
        };
    if ( DEBUG_TURN_SHOULD_PROVE_ON ) {
        return true;
    };

    return false;
}

const SHOULD_LOG_REQ = false;

function _debugHeroAnimFrame(
    scene: Phaser.Scene,
    sprite: Phaser.GameObjects.Sprite,
    req: _HeroAnimRequest,
    def?: any
): void {
    if (!DEBUG_HERO_ANIM_FRAMES) return;
    const actionKind = (req.actionKind || "").toLowerCase();
    if (DEBUG_HERO_ANIM_FRAMES_STRENGTH_ONLY) {
        if (!(actionKind.startsWith("strength") || req.phase === "slash")) return;
    }
    const anySprite = sprite as any;
    const frame = sprite.frame as any;
    const frameIndex = (frame?.index ?? frame?.name ?? -1);
    const lastIdx = anySprite.getData ? (anySprite.getData(HERO_FRAME_LOG_LAST_IDX_KEY) as any) : undefined;
    const nowMs = (scene as any)?.time?.now ?? Date.now();
    const lastMs = anySprite.getData ? (anySprite.getData(HERO_FRAME_LOG_LAST_MS_KEY) as any) : undefined;
    const throttle = DEBUG_HERO_ANIM_FRAMES_THROTTLE_MS | 0;
    const onlyChanges = !!DEBUG_HERO_ANIM_FRAMES_ONLY_CHANGES;
    if (onlyChanges && (lastIdx === frameIndex)) {
        if (!(throttle > 0 && typeof lastMs === "number" && (nowMs - lastMs) >= throttle)) {
            return;
        }
    }
    if (throttle > 0 && typeof lastMs === "number" && (nowMs - lastMs) < throttle) return;

    if (anySprite.setData) {
        try { anySprite.setData(HERO_FRAME_LOG_LAST_IDX_KEY, frameIndex); } catch {}
        try { anySprite.setData(HERO_FRAME_LOG_LAST_MS_KEY, nowMs); } catch {}
    }

    const animKey = (sprite.anims && sprite.anims.currentAnim) ? sprite.anims.currentAnim.key : "";
    const segName = (req as any).strSegName ?? "";
    const partName = (req as any).phasePartName ?? "";
    const msg =
        "[HERO-ANIM][FRAME]" +
        " heroName=" + (req.heroName || "") +
        " family=" + (req.family || "") +
        " phase=" + (req.phase || "") +
        " part=" + (partName || "") +
        " seg=" + (segName || "") +
        " dir=" + (req.dir || "") +
        " actionKind=" + (req.actionKind || "") +
        " fco=" + (req.frameColOverride | 0) +
        " animKey=" + (animKey || "") +
        " tex=" + (def?.textureKey ?? (sprite.texture?.key ?? "")) +
        " frameIndex=" + (frameIndex ?? -1) +
        " frameName=" + (frame?.name ?? "") +
        " t=" + (nowMs | 0);
    console.log(msg);
}

function _debugStrengthFrameTrace(
    scene: Phaser.Scene,
    sprite: Phaser.GameObjects.Sprite,
    req: _HeroAnimRequest
): void {
    if (!DEBUG_HERO_ANIM_STRENGTH_TRACE) return;
    const actionKindRaw = (req.actionKind || "");
    const actionKind = actionKindRaw.toLowerCase();
    const isStrength = actionKind.startsWith("strength");
    const anySprite = sprite as any;
    if (!anySprite.getData || !anySprite.setData) return;

    const nowMs = (scene as any)?.time?.now ?? Date.now();
    const frame = sprite.frame as any;
    const frameIndex = (frame?.index ?? frame?.name ?? -1);
    const actionSeq = (req.actionSequence | 0);

    const active = !!anySprite.getData(HERO_STR_TRACE_ACTIVE_KEY);
    const activeSeq = Number(anySprite.getData(HERO_STR_TRACE_SEQ_KEY));

    const flush = (endKind: string): void => {
        const entries = anySprite.getData(HERO_STR_TRACE_ENTRIES_KEY);
        const frames = Array.isArray(entries) ? entries : [];
        const startMs = Number(anySprite.getData(HERO_STR_TRACE_START_MS_KEY));
        const startKind = String(anySprite.getData(HERO_STR_TRACE_START_KIND_KEY) || "");
        const heroName = req.heroName || "";
        const seq = Number(anySprite.getData(HERO_STR_TRACE_SEQ_KEY));
        const phase = req.phase || "";
        const part = String((req as any).phasePartName || "");
        const seg = String((req as any).strSegName || "");
        const durMs = (req.phaseDurationMs | 0);
        const partDur = (req as any).phasePartDurationMs | 0;
        const msg =
            "[HERO-ANIM][STRENGTH-TRACE]" +
            " heroName=" + heroName +
            " actionSeq=" + (Number.isFinite(seq) ? (seq | 0) : -1) +
            " phase=" + phase +
            " part=" + part +
            " seg=" + seg +
            " durMs=" + durMs +
            " partDurMs=" + partDur +
            " startKind=" + (startKind || "") +
            " endKind=" + (endKind || "") +
            " start=" + (Number.isFinite(startMs) ? (startMs | 0) : -1) +
            " end=" + (nowMs | 0) +
            " frames=" + frames.join(",");
        console.log(msg);
        anySprite.setData(HERO_STR_TRACE_ACTIVE_KEY, 0);
        anySprite.setData(HERO_STR_TRACE_SEQ_KEY, 0);
        anySprite.setData(HERO_STR_TRACE_START_MS_KEY, 0);
        anySprite.setData(HERO_STR_TRACE_START_KIND_KEY, "");
        anySprite.setData(HERO_STR_TRACE_ENTRIES_KEY, []);
        anySprite.setData(HERO_STR_TRACE_LAST_FRAME_KEY, undefined);
    };

    if (!isStrength) {
        if (active) flush(actionKindRaw || "");
        return;
    }

    if (!active || (Number.isFinite(activeSeq) && activeSeq !== (actionSeq | 0))) {
        if (active) flush(actionKindRaw || "");
        anySprite.setData(HERO_STR_TRACE_ACTIVE_KEY, 1);
        anySprite.setData(HERO_STR_TRACE_SEQ_KEY, actionSeq | 0);
        anySprite.setData(HERO_STR_TRACE_START_MS_KEY, nowMs | 0);
        anySprite.setData(HERO_STR_TRACE_START_KIND_KEY, actionKindRaw || "");
        anySprite.setData(HERO_STR_TRACE_ENTRIES_KEY, []);
        anySprite.setData(HERO_STR_TRACE_LAST_FRAME_KEY, undefined);
    }

    const lastFrame = anySprite.getData(HERO_STR_TRACE_LAST_FRAME_KEY);
    if (lastFrame === frameIndex) return;
    const entries = anySprite.getData(HERO_STR_TRACE_ENTRIES_KEY);
    if (Array.isArray(entries)) {
        entries.push(`${frameIndex}@${nowMs | 0}`);
    } else {
        anySprite.setData(HERO_STR_TRACE_ENTRIES_KEY, [`${frameIndex}@${nowMs | 0}`]);
    }
    anySprite.setData(HERO_STR_TRACE_LAST_FRAME_KEY, frameIndex);
}

function _proveLogHeroAnimReq(sprite: Phaser.GameObjects.Sprite, req: _HeroAnimRequest): void {
    if (SHOULD_LOG_REQ ) {
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
};
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

const SHOULD_LOG_EFFECTIVE = false; //Debug flag

function _proveLogEffectivePhase(
    req: _HeroAnimRequest,
    set: any,
    effectivePhase: any,
    dirMap: any
): void {
    if (SHOULD_LOG_EFFECTIVE) {
    console.log(
        "[PROVE][HERO-ANIM][EFFECTIVE]",
        "| heroName", req.heroName,
        "| requestedPhase", req.phase,
        "| effectivePhase", effectivePhase,
        "| hasDirMap", !!dirMap,
        "| setId", set.id
    );
};

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

const SHOULD_LOG_DEF = false;

function _proveLogDef(req: _HeroAnimRequest, def: any): void {
    if (SHOULD_LOG_DEF) {
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
};
}

function _restoreBaseScaleIfPresent(sprite: Phaser.GameObjects.Sprite): void {
    const anySprite = sprite as any;
    const bx = Number(anySprite.getData?.(HERO_BASE_SCALE_X_KEY));
    const by = Number(anySprite.getData?.(HERO_BASE_SCALE_Y_KEY));
    if (Number.isFinite(bx) && bx !== 0) (sprite as any).scaleX = bx;
    if (Number.isFinite(by) && by !== 0) (sprite as any).scaleY = by;
}


function _ensureHeroAnimPlayingThenPause(args: {
    sprite: Phaser.GameObjects.Sprite;
    expectedAnimKey: string;
}): void {
    const spr: any = args.sprite as any;
    const anims: any = spr?.anims;
    if (!anims) return;

    const curKey = String(anims.currentAnim?.key ?? "");
    if (curKey !== args.expectedAnimKey) {
        // Force correct base animation for the current phase/dir
        if (DEBUG_HERO_ANIM_STRENGTH_TRACE) {
            console.log("[STR][ANIM_PLAY] expected=" + args.expectedAnimKey + " prev=" + curKey);
        }
        try { anims.play(args.expectedAnimKey, true); } catch { /* ignore */ }
    } else {
        // If it's the right key but not actually active, re-play to restore currentAnim frames
        if (!anims.currentAnim) {
            if (DEBUG_HERO_ANIM_STRENGTH_TRACE) {
                console.log("[STR][ANIM_PLAY] expected=" + args.expectedAnimKey + " prev=none");
            }
            try { anims.play(args.expectedAnimKey, true); } catch { /* ignore */ }
        }
    }

    // IMPORTANT: pause, don't stop
    try { anims.pause(); } catch { /* ignore */ }
}


// --- ADD: publish "frame within clip" contract for weaponAnimGlue ---
function _publishHeroFollowFrameKeys(
    sprite: Phaser.GameObjects.Sprite,
    def: any
): void {
    const anySprite: any = sprite as any;
    if (!anySprite?.setData) return;

    const frames: number[] = (def && Array.isArray(def.frameIndices)) ? (def.frameIndices as number[]) : [];
    const clipLen = frames.length | 0;

    // --- compute abs frame currently displayed (shared by both contracts) ---
    let abs = 0;
    try {
        abs = _getTextureFrameIndex(anySprite) | 0;
    } catch {
        abs = 0;
    }

    // ============================================================
    // 1) EXISTING weapon-follow contract (MUST NOT CHANGE BEHAVIOR)
    // ============================================================
    if (clipLen <= 0) {
        try {
            anySprite.setData(HERO_FOLLOW_CLIP_LEN_KEY, 0);
            anySprite.setData(HERO_FOLLOW_FRAME_IN_CLIP_KEY, 0);
        } catch { /* ignore */ }

        // Also publish canonical info as empty.
        try {
            anySprite.setData(HERO_CANON_ABS_FRAME_KEY, abs | 0);
            anySprite.setData(HERO_CANON_CLIP_LEN_KEY, 0);
            anySprite.setData(HERO_CANON_FRAME_IN_CANON_CLIP_KEY, 0);
            anySprite.setData(HERO_CANON_CLIP_PHASE_KEY, String(def?.phase ?? ""));
            anySprite.setData(HERO_CANON_CLIP_DIR_KEY, String(def?.dir ?? ""));
        } catch { /* ignore */ }

        return;
    }

    // Find clip index for the displayed absolute frame.
    // (O(N) is fine at your clip sizes; keep this to preserve current semantics.)
    let idxInClip = -1;
    for (let i = 0; i < clipLen; i++) {
        if ((frames[i] | 0) === (abs | 0)) { idxInClip = i; break; }
    }

    // If Phaser hasn’t advanced yet (e.g., immediately after play()),
    // treat it as frame 0 of the clip rather than publishing garbage.
    if (idxInClip < 0) idxInClip = 0;

    try {
        anySprite.setData(HERO_FOLLOW_CLIP_LEN_KEY, clipLen);
        anySprite.setData(HERO_FOLLOW_FRAME_IN_CLIP_KEY, idxInClip | 0);
    } catch { /* ignore */ }

    // ============================================================
    // 2) ADDITIVE canonical contract (absolute frame meaning)
    // ============================================================
    // The canonical definition is: “what absolute spritesheet frame index am I on”
    // PLUS: best-effort idx within this def’s frameIndices (same scan result).
    try {
        anySprite.setData(HERO_CANON_ABS_FRAME_KEY, abs | 0);
        anySprite.setData(HERO_CANON_CLIP_LEN_KEY, clipLen);
        anySprite.setData(HERO_CANON_FRAME_IN_CANON_CLIP_KEY, idxInClip | 0);
        anySprite.setData(HERO_CANON_CLIP_PHASE_KEY, String(def?.phase ?? ""));
        anySprite.setData(HERO_CANON_CLIP_DIR_KEY, String(def?.dir ?? ""));
    } catch { /* ignore */ }
}



function _getTextureFrameIndex(native: any): number {
    // Prefer the animation’s current frame texture frame id (this is the real spritesheet frame number)
    try {
        const cf = native?.anims?.currentFrame as any;
        if (cf) {
            const tf = (cf.textureFrame as any);
            if (typeof tf === "number" && isFinite(tf)) return (tf | 0);
            if (typeof tf === "string") {
                const n = parseInt(tf, 10);
                if (isFinite(n)) return (n | 0);
            }

            // Some Phaser builds expose the underlying Texture Frame as cf.frame
            const fr2 = (cf.frame as any);
            const idx2 = fr2?.index;
            if (typeof idx2 === "number" && isFinite(idx2)) return (idx2 | 0);
            const name2 = fr2?.name;
            if (typeof name2 === "number" && isFinite(name2)) return (name2 | 0);
            if (typeof name2 === "string") {
                const n2 = parseInt(name2, 10);
                if (isFinite(n2)) return (n2 | 0);
            }
        }
    } catch { /* ignore */ }

    // Fallback: sprite.frame (Texture Frame)
    try {
        const fr = native?.frame as any;
        if (fr) {
            const idxA = fr.index;
            if (typeof idxA === "number" && isFinite(idxA)) return (idxA | 0);

            const idxB = fr.name;
            if (typeof idxB === "number" && isFinite(idxB)) return (idxB | 0);

            if (typeof idxB === "string") {
                const n = parseInt(idxB, 10);
                if (isFinite(n)) return (n | 0);
            }
        }
    } catch { /* ignore */ }

    return 0;
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

    // Strength swing segmentation addon channel
    strSegName: string | undefined;
    strSegStartMs: number;
    strSegDurationMs: number;
    strSegProgressInt: number; // 0..1000, -1 if missing

    // Optional: pause current animation without forcing a frame
    animHold: boolean;
} {
    const anySprite = sprite as any;

    const heroNameRaw = anySprite.getData ? (anySprite.getData(HERO_NAME_KEY) as any) : undefined;
    const familyRaw = anySprite.getData ? (anySprite.getData(HERO_FAMILY_KEY) as any) : undefined;

    const phaseLegacyRaw = anySprite.getData ? (anySprite.getData(HERO_PHASE_KEY) as any) : undefined;
    const phaseNameRaw = anySprite.getData ? (anySprite.getData(HERO_PHASE_NAME_KEY) as any) : undefined;

    const dirRaw = anySprite.getData ? (anySprite.getData(HERO_DIR_KEY) as any) : undefined;
    const aimDxRaw = anySprite.getData ? (anySprite.getData(HERO_AIM_DIR_X1000_KEY) as any) : undefined;
    const aimDyRaw = anySprite.getData ? (anySprite.getData(HERO_AIM_DIR_Y1000_KEY) as any) : undefined;
    const aimAngRaw = anySprite.getData ? (anySprite.getData(HERO_AIM_ANGLE_MDEG_KEY) as any) : undefined;

    const frameColOverrideRaw = anySprite.getData ? (anySprite.getData(HERO_FRAME_COL_OVERRIDE_KEY) as any) : undefined;
    const animHoldRaw = anySprite.getData ? (anySprite.getData(HERO_ANIM_HOLD_KEY) as any) : undefined;

    const actionKindRaw = anySprite.getData ? (anySprite.getData(HERO_ACTION_KIND_KEY) as any) : undefined;
    const actionSeqRaw = anySprite.getData ? (anySprite.getData(HERO_ACTION_SEQUENCE_KEY) as any) : undefined;

    const phaseDurRaw = anySprite.getData ? (anySprite.getData(HERO_PHASE_DURATION_MS_KEY) as any) : undefined;
    const phaseProgRaw = anySprite.getData ? (anySprite.getData(HERO_PHASE_PROGRESS_INT_KEY) as any) : undefined;

    const partNameRaw = anySprite.getData ? (anySprite.getData(HERO_PHASE_PART_NAME_KEY) as any) : undefined;
    const partStartRaw = anySprite.getData ? (anySprite.getData(HERO_PHASE_PART_START_MS_KEY) as any) : undefined;
    const partDurRaw = anySprite.getData ? (anySprite.getData(HERO_PHASE_PART_DURATION_MS_KEY) as any) : undefined;

    // Strength segmentation addon keys
    const strSegNameRaw = anySprite.getData ? (anySprite.getData(STR_SEG_NAME_KEY) as any) : undefined;
    const strSegStartRaw = anySprite.getData ? (anySprite.getData(STR_SEG_START_MS_KEY) as any) : undefined;
    const strSegDurRaw = anySprite.getData ? (anySprite.getData(STR_SEG_DUR_MS_KEY) as any) : undefined;
    const strSegProgRaw = anySprite.getData ? (anySprite.getData(STR_SEG_PROGRESS_INT_KEY) as any) : undefined;

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
        if (f === "support" || f === "wisdom" || f === "heal" || f === "healing") return "wisdom";
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
        if (p === "death" || p === "dead") return "hurt";
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

    const animHold = !!animHoldRaw;

    let dir: HeroDir = (() => {
        if (!dirRaw) return "down";
        const d0 = String(dirRaw).trim().toLowerCase();
        const d = d0.replace(/[\s_-]+/g, "");
        if (d === "up" || d === "n" || d === "north") return "up";
        if (d === "down" || d === "s" || d === "south") return "down";
        if (d === "left" || d === "w" || d === "west") return "left";
        if (d === "right" || d === "e" || d === "east") return "right";
        return "down";
    })();

    const aimDx1000 = (() => {
        const n = Number(aimDxRaw);
        if (!Number.isFinite(n)) return 0;
        return (n | 0);
    })();
    const aimDy1000 = (() => {
        const n = Number(aimDyRaw);
        if (!Number.isFinite(n)) return 0;
        return (n | 0);
    })();
    const aimAngleMdeg = (() => {
        const n = Number(aimAngRaw);
        if (!Number.isFinite(n)) return 0;
        return (n | 0);
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

    const useSideForAim = _heroShouldUseSideDirForAim(phase, actionKind);
    let aimTiltRad = 0;
    if (useSideForAim && ((aimDx1000 | 0) !== 0 || (aimDy1000 | 0) !== 0 || (aimAngleMdeg | 0) !== 0)) {
        let angDeg = 0;
        if ((aimDx1000 | 0) !== 0 || (aimDy1000 | 0) !== 0) {
            angDeg = (Math.atan2(aimDy1000, aimDx1000) * 180) / Math.PI;
        } else {
            // aimAngleMdeg uses math coords (0 right, 90 up); flip to screen coords (0 right, 90 down).
            angDeg = -((aimAngleMdeg | 0) / 1000);
        }
        // Normalize to [0,360)
        angDeg = ((angDeg % 360) + 360) % 360;
        const delta = (baseDeg: number): number => {
            let d = ((angDeg - baseDeg + 540) % 360) - 180;
            if (d < -180) d += 360;
            if (d > 180) d -= 360;
            return d;
        };
        const dRight = delta(0);
        const dDown = delta(90);
        const dLeft = delta(180);
        const dUp = delta(270);
        let baseDir: HeroDir = "right";
        let baseDelta = dRight;
        let best = Math.abs(dRight);
        if (Math.abs(dDown) < best) { best = Math.abs(dDown); baseDir = "down"; baseDelta = dDown; }
        if (Math.abs(dLeft) < best) { best = Math.abs(dLeft); baseDir = "left"; baseDelta = dLeft; }
        if (Math.abs(dUp) < best) { best = Math.abs(dUp); baseDir = "up"; baseDelta = dUp; }
        dir = baseDir;
        const maxTilt = (baseDir === "up" || baseDir === "down") ? HERO_AIM_TILT_UP_DEG : HERO_AIM_TILT_SIDE_DEG;
        let tiltDeg = baseDelta;
        if (tiltDeg > maxTilt) tiltDeg = maxTilt;
        if (tiltDeg < -maxTilt) tiltDeg = -maxTilt;
        aimTiltRad = (tiltDeg * Math.PI) / 180;
    }

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

    const strSegName = (() => {
        if (strSegNameRaw == null) return undefined;
        const s0 = String(strSegNameRaw).trim().toLowerCase();
        return s0.length ? s0 : undefined;
    })();

    const strSegStartMs = (() => {
        const n = Number(strSegStartRaw);
        if (!Number.isFinite(n)) return 0;
        return (n | 0);
    })();

    const strSegDurationMs = (() => {
        const n = Number(strSegDurRaw);
        if (!Number.isFinite(n)) return 0;
        return (n | 0);
    })();

    const strSegProgressInt = (() => {
        const n = Number(strSegProgRaw);
        if (!Number.isFinite(n)) return -1;
        const v = (n | 0);
        if (v < 0) return 0;
        if (v > 1000) return 1000;
        return v;
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
        phasePartDurationMs,

        strSegName,
        strSegStartMs,
        strSegDurationMs,
        strSegProgressInt,

        animHold,

        aimDx1000,
        aimDy1000,
        aimAngleMdeg,
        aimTiltRad
    };
}

/**
 * For now, every "active" animation returns to idle.
 * Later we can get fancier (e.g. climb→idle, jump→idle, etc.).
 */
function getRestPhase(_phase: HeroPhase): HeroPhase {
    return "idle";
}




function _tryStrengthChargeThrob(
    scene: Phaser.Scene,
    sprite: Phaser.GameObjects.Sprite,
    req: _HeroAnimRequest,
    def: any,
    shouldProve: boolean
): boolean {
    if (STR_CUSTOM_TIMELINE_ENABLE) return false;
    const anySprite = sprite as any;
    const PAUSED_KEY = "__strChPaused";

    // Only for strength charge while in slash phase
    if (!(req.actionKind === "strength_charge" && def.phase === "slash")) {
        const wasPaused = !!anySprite.getData?.(PAUSED_KEY);
        if (wasPaused) {
            const animState: any = sprite.anims as any;
            if (animState && typeof animState.resume === "function") {
                try { animState.resume(); } catch { /* ignore */ }
            }
            try { anySprite.setData?.(PAUSED_KEY, 0); } catch {}
        }
        try { anySprite.setData?.("strCh_holdCol", undefined); } catch {}
        _restoreBaseScaleIfPresent(sprite);
        return false;
    }

    const partRaw = (typeof (req as any).phasePartName === "string") ? String((req as any).phasePartName) : "";
    const part = partRaw.trim().toLowerCase();

    // Accept "charging", "charge", "charge_hold", etc. (but NOT "prepareToCharge")
    const partLooksLikeCharging =
        part === "charging" ||
        part === "charge" ||
        part.startsWith("charging_") ||
        part.includes("charge_hold");

    // Fallback: if engine forgot to label part, still allow hold while locked during strength_charge+slash
    const isLocked = (() => {
        if (partLooksLikeCharging) return true;
        if (part.length) return false;
        return (req.phaseProgressInt | 0) >= 0;
    })();

    if (!(partLooksLikeCharging || isLocked)) {
        const wasPaused = !!anySprite.getData?.(PAUSED_KEY);
        if (wasPaused) {
            const animState: any = sprite.anims as any;
            if (animState && typeof animState.resume === "function") {
                try { animState.resume(); } catch { /* ignore */ }
            }
            try { anySprite.setData?.(PAUSED_KEY, 0); } catch {}
        }
        try { anySprite.setData?.("strCh_holdCol", undefined); } catch {}
        _restoreBaseScaleIfPresent(sprite);
        return false;
    }

    const animKey = buildHeroAnimKey(req.heroName!, def);

    // Throttle prove spam (optional)
    if (shouldProve) {
        const nowLocal = (scene as any)?.time?.now ?? Date.now();
        const LOG_LAST_MS_KEY = "__strCh_proveLastMs";
        const lastMs = Number(anySprite.getData?.(LOG_LAST_MS_KEY));
        if (!Number.isFinite(lastMs) || (nowLocal - lastMs) >= 250) {
            try { anySprite.setData?.(LOG_LAST_MS_KEY, nowLocal); } catch {}
            const ca = (sprite.anims && sprite.anims.currentAnim) ? sprite.anims.currentAnim.key : "";
            console.log(
                "[PROVE][CHARGE-THROB][ENTER]",
                "| t", nowLocal,
                "| heroName", req.heroName,
                "| actionKind", req.actionKind,
                "| phase", def.phase,
                "| part", partRaw,
                "| phaseProg", req.phaseProgressInt,
                "| animKey", animKey,
                "| currentAnim", ca
            );
        }
    }

    if (!scene.anims.exists(animKey)) {
        scene.anims.create({
            key: animKey,
            frames: scene.anims.generateFrameNumbers(def.textureKey, { frames: def.frameIndices }),
            frameRate: def.frameRate,
            repeat: def.repeat,
            yoyo: def.yoyo
        });
    }

    const frames: number[] = (def.frameIndices || []) as any;
    if (!(frames && frames.length)) return false;

    const nowLocal = (scene as any)?.time?.now ?? Date.now();

    const heroCols = (() => {
        try {
            const hf: any = (sprite as any).frame;
            const tileW = (hf?.width ?? 0) | 0;
            const texKey = String((sprite as any).texture?.key ?? "");
            const heroTex = scene.textures.get(texKey);
            const src: any = heroTex?.getSourceImage?.();
            const w = (src?.width ?? 0) | 0;
            return tileW > 0 ? Math.max(1, Math.floor(w / tileW)) : 1;
        } catch {
            return 1;
        }
    })();

    // Use your existing key, but now it means: "the fixed pose index we hold"
    const HOLD_COL_KEY = "strCh_holdCol";
    let holdIdx = anySprite.getData?.(HOLD_COL_KEY);
    if ((req.frameColOverride | 0) >= 0) {
        holdIdx = (req.frameColOverride | 0);
        try { anySprite.setData?.(HOLD_COL_KEY, holdIdx); } catch {}
    }

    if (!(typeof holdIdx === "number" && Number.isFinite(holdIdx))) {
        // Preserve your old intent: derive a stable column from the current frame
        const curFrameIndex = _getTextureFrameIndex(anySprite);
        const baseCol = clampInt((curFrameIndex | 0) % heroCols, 0, Math.max(0, heroCols - 1));

        // Map that into the animation's frame list
        holdIdx = clampInt(baseCol | 0, 0, frames.length - 1);

        try { anySprite.setData?.(HOLD_COL_KEY, holdIdx); } catch {}
    }

    // Fixed pose frame (NO alternation)
    const idxInFrames = clampInt(holdIdx | 0, 0, frames.length - 1);
    const poseFrameIndex = frames[idxInFrames];

    // Force correct animation key so weapon glue still sees slash anim key
    const curKey = (sprite.anims && sprite.anims.currentAnim) ? sprite.anims.currentAnim.key : "";
    if (!curKey || curKey !== animKey) {
        try { sprite.anims.play(animKey, true); } catch { return false; }
    }

    // Pause so it doesn't advance (REAL fallback)
    const animState: any = sprite.anims as any;
    if (animState && typeof animState.pause === "function") {
        try { animState.pause(); } catch { /* ignore */ }
    } else {
        try { sprite.anims.stop(); } catch { /* ignore */ }
    }

    try {
        const holdColRaw = anySprite.getData?.(HERO_CANON_FRAME_IN_CANON_CLIP_KEY);
        const holdCol = Number(holdColRaw);
        if (Number.isFinite(holdCol)) {
            const anim = sprite.anims.currentAnim as any;
            const aframes = anim?.frames as any[] | undefined;
            if (aframes && aframes.length) {
                const safeIdx = clampInt(holdCol | 0, 0, aframes.length - 1);
                sprite.anims.setCurrentFrame(aframes[safeIdx]);
            }
        }
    } catch { /* ignore */ }
    try { anySprite.setData?.(PAUSED_KEY, 1); } catch {}

    // Set the SAME pose frame in the animation timeline (preferred), fallback to setTexture
    try {
        const anim = sprite.anims.currentAnim as any;
        const aframes = anim?.frames as any[] | undefined;
        if (aframes && aframes.length) {
            const safeIdx = clampInt(idxInFrames, 0, aframes.length - 1);
            sprite.anims.setCurrentFrame(aframes[safeIdx]);
        } else {
            sprite.setTexture(def.textureKey, poseFrameIndex);
        }
    } catch {
        sprite.setTexture(def.textureKey, poseFrameIndex);
    }

    // ✅ Throb = scale pulse only (kept)
    const baseX = (() => {
        const v = Number(anySprite.getData?.(HERO_BASE_SCALE_X_KEY));
        if (Number.isFinite(v) && v !== 0) return v;
        const cur = (sprite as any).scaleX;
        if (typeof cur === "number" && Number.isFinite(cur) && cur !== 0) {
            try { anySprite.setData(HERO_BASE_SCALE_X_KEY, cur); } catch {}
            return cur;
        }
        try { anySprite.setData(HERO_BASE_SCALE_X_KEY, 1); } catch {}
        return 1;
    })();

    const baseY = (() => {
        const v = Number(anySprite.getData?.(HERO_BASE_SCALE_Y_KEY));
        if (Number.isFinite(v) && v !== 0) return v;
        const cur = (sprite as any).scaleY;
        if (typeof cur === "number" && Number.isFinite(cur) && cur !== 0) {
            try { anySprite.setData(HERO_BASE_SCALE_Y_KEY, cur); } catch {}
            return cur;
        }
        try { anySprite.setData(HERO_BASE_SCALE_Y_KEY, 1); } catch {}
        return 1;
    })();

    const wob = 0.03;
    const s = 1 + wob * Math.sin(nowLocal / 140); // slightly slower than /90
    (sprite as any).scaleX = baseX * s;
    (sprite as any).scaleY = baseY * s;

    // Prevent auto-snap on complete during hold
    const prevHandler = anySprite[HERO_ANIMCOMPLETE_HANDLER_KEY] as
        | ((anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => void)
        | undefined;
    if (prevHandler) {
        sprite.off("animationcomplete", prevHandler);
        anySprite[HERO_ANIMCOMPLETE_HANDLER_KEY] = undefined;
    }

    if (anySprite.setData) {
        anySprite.setData(LAST_ANIM_KEY, animKey);
        anySprite.setData(LAST_PHASE_KEY, def.phase);
        anySprite.setData(LAST_DIR_KEY, def.dir);
        anySprite.setData(HERO_REST_PHASE_KEY, getRestPhase(def.phase));
    }

    // Keep follow-frame contract coherent for weapon glue
    try { _publishHeroFollowFrameKeys(sprite, def); } catch {}

    return true;
}

function _strengthProgressToElapsed(progressInt: number, durMs: number): number {
    const p = clampInt(progressInt | 0, 0, 1000);
    const d = Math.max(1, durMs | 0);
    return Math.round((d * p) / 1000) | 0;
}

function _pickStrengthFrameBySchedule(
    elapsedMs: number,
    frames: number[],
    frameMs?: number[]
): number {
    if (!frames || frames.length === 0) return 0;
    const mult = (typeof (globalThis as any).STR_DEBUG_FRAME_MS_MULT === "number")
        ? ((globalThis as any).STR_DEBUG_FRAME_MS_MULT | 0)
        : 1;
    const scaleMs = (v: number): number => {
        const base = Math.max(1, v | 0);
        if (mult > 1) return Math.max(1, (base * mult) | 0);
        return base;
    };
    const ms = (frameMs && frameMs.length === frames.length) ? frameMs : null;
    const elapsed = Math.max(0, elapsedMs | 0);
    if (!ms) {
        const slice = Math.max(1, Math.idiv(Math.max(1, frames.length), Math.max(1, frames.length)));
        const idx = Math.min(frames.length - 1, Math.idiv(elapsed, slice));
        return frames[idx] | 0;
    }
    let acc = 0;
    for (let i = 0; i < frames.length; i++) {
        acc += scaleMs(ms[i] | 0);
        if (elapsed < acc) return frames[i] | 0;
    }
    return frames[frames.length - 1] | 0;
}

function _strengthPickFrameFromProgress(
    frameCols: number[],
    progressInt: number,
    durMs: number
): number {
    if (!frameCols || !frameCols.length) return 0;
    const elapsed = _strengthProgressToElapsed(progressInt | 0, durMs | 0);
    const slice = Math.max(1, Math.idiv(Math.max(1, durMs | 0), Math.max(1, frameCols.length)));
    const idx = Math.min(frameCols.length - 1, Math.idiv(elapsed | 0, slice));
    return frameCols[idx] | 0;
}

function _applyStrengthFrameCol(
    scene: Phaser.Scene,
    sprite: Phaser.GameObjects.Sprite,
    req: _HeroAnimRequest,
    def: any,
    frameCol: number,
    shouldProve: boolean,
    tag: string
): void {
    const frames: number[] = (def.frameIndices || []) as any;
    if (!frames.length) return;
    const col = clampInt(frameCol | 0, 0, frames.length - 1);
    const frameIndex = frames[col];
    const animKey = buildHeroAnimKey(req.heroName!, def);

    if (!scene.anims.exists(animKey)) {
        scene.anims.create({
            key: animKey,
            frames: scene.anims.generateFrameNumbers(def.textureKey, { frames: def.frameIndices }),
            frameRate: def.frameRate,
            repeat: def.repeat,
            yoyo: def.yoyo
        });
    }

    _ensureHeroAnimPlayingThenPause({ sprite, expectedAnimKey: animKey });

    try {
        const anim = sprite.anims.currentAnim as any;
        const aframes = anim?.frames as any[] | undefined;
        if (aframes && aframes.length) {
            const safeIdx = clampInt(col | 0, 0, aframes.length - 1);
            sprite.anims.setCurrentFrame(aframes[safeIdx]);
        } else {
            sprite.setTexture(def.textureKey, frameIndex);
        }
    } catch {
        sprite.setTexture(def.textureKey, frameIndex);
    }
    if (DEBUG_HERO_ANIM_STRENGTH_TRACE) {
        const anims: any = (sprite as any).anims;
        const curKey = String(anims?.currentAnim?.key ?? "");
        const playing = anims?.isPlaying ? 1 : 0;
        const paused = (anims?.isPaused || anims?.paused) ? 1 : 0;
        console.log("[STR][APPLY] tag=" + tag +
            " col=" + (col | 0) +
            " frameIndex=" + (frameIndex ?? -1) +
            " phase=" + (req.phase || "") +
            " part=" + String((req as any).phasePartName || "") +
            " actionKind=" + (req.actionKind || "") +
            " animKey=" + animKey +
            " curKey=" + curKey +
            " playing=" + playing +
            " paused=" + paused);
    }

    const anySprite: any = sprite as any;
    if (anySprite.setData) {
        anySprite.setData(LAST_ANIM_KEY, animKey);
        anySprite.setData(LAST_PHASE_KEY, def.phase);
        anySprite.setData(LAST_DIR_KEY, def.dir);
        anySprite.setData(HERO_REST_PHASE_KEY, getRestPhase(def.phase));
    }

    if (shouldProve) {
        console.log(
            "[PROVE][STR-CUSTOM]",
            "| tag", tag,
            "| heroName", req.heroName,
            "| frameCol", col,
            "| frameIndex", frameIndex,
            "| part", String((req as any).phasePartName || ""),
            "| seg", String((req as any).strSegName || "")
        );
    }
}

function _tryStrengthCustomTimeline(
    scene: Phaser.Scene,
    sprite: Phaser.GameObjects.Sprite,
    req: _HeroAnimRequest,
    def: any,
    shouldProve: boolean
): boolean {
    if (!STR_CUSTOM_TIMELINE_ENABLE) return false;
    const actionKind = (req.actionKind || "").toLowerCase();
    if (!(actionKind === "strength_charge" || actionKind === "strength_swing")) return false;
    if (def.phase !== "slash") return false;

    const frames: number[] = Array.isArray(def.frameIndices) ? def.frameIndices : [];
    if (frames.length < 6) return false;

    const partRaw = String((req as any).phasePartName || "");
    const part = partRaw.trim().toLowerCase();
    const partDur = (req as any).phasePartDurationMs | 0;
    const partProg = (req as any).phasePartProgress | 0;
    const phaseDur = (req.phaseDurationMs | 0);
    const fallbackProg = clampInt(req.phaseProgressInt | 0, 0, 1000);
    const safePartDur = (partDur > 0) ? (partDur | 0) : Math.max(1, phaseDur | 0);
    const safePartProg = (partDur > 0) ? (partProg | 0) : (fallbackProg | 0);
    const anySprite: any = sprite as any;
    const nowLocal = (scene as any)?.time?.now ?? Date.now();
    const seq = req.actionSequence | 0;
    const partTag = `${actionKind}:${part || "none"}`;
    const prevTag = anySprite.getData ? String(anySprite.getData(STR_CUSTOM_PART_KEY) || "") : "";
    const prevSeq = anySprite.getData ? (anySprite.getData(STR_CUSTOM_PART_SEQ_KEY) | 0) : -1;
    if (prevTag !== partTag || prevSeq !== (seq | 0)) {
        try {
            anySprite.setData?.(STR_CUSTOM_PART_KEY, partTag);
            anySprite.setData?.(STR_CUSTOM_PART_SEQ_KEY, seq | 0);
            anySprite.setData?.(STR_CUSTOM_PART_START_MS_KEY, nowLocal | 0);
        } catch {}
    }
    const partStartMs = (() => {
        const n = Number(anySprite.getData?.(STR_CUSTOM_PART_START_MS_KEY));
        return Number.isFinite(n) ? (n | 0) : (nowLocal | 0);
    })();
    const elapsedLocal = clampInt((nowLocal | 0) - (partStartMs | 0), 0, safePartDur | 0);

    if (actionKind === "strength_charge") {
        const fco = (req.frameColOverride | 0);
        if (part === "preparetocharge") {
            const col = (fco >= 0)
                ? fco
                : _pickStrengthFrameBySchedule(elapsedLocal | 0, [0, 1, 2], STR_SWING_WINDUP_FRAME_MS);
            _applyStrengthFrameCol(scene, sprite, req, def, col, shouldProve, "charge.prepare");
        } else {
            const col = (fco >= 0) ? fco : 2;
            _applyStrengthFrameCol(scene, sprite, req, def, col, shouldProve, "charge.hold");
        }
        return true;
    }

    // strength_swing
    const isReset = (part === "strengthreset" || part === "reset");
    if (isReset) {
        const resetMs = Math.max(1, safePartDur | 0);
        const frames = (STR_SWING_RESET_FRAME_COLS && STR_SWING_RESET_FRAME_COLS.length)
            ? STR_SWING_RESET_FRAME_COLS
            : [1, 2, 1, 0];
        const baseMs = (STR_SWING_RESET_FRAME_MS && STR_SWING_RESET_FRAME_MS.length === frames.length)
            ? STR_SWING_RESET_FRAME_MS
            : frames.map(() => Math.max(1, Math.idiv(resetMs | 0, Math.max(1, frames.length))));
        const msList = baseMs.map((v) => Math.max(1, v | 0));
        const baseSum = msList.reduce((a, b) => a + b, 0);
        const extra = Math.max(0, (resetMs - baseSum) | 0);
        if (extra > 0 && msList.length > 1) msList[1] = (msList[1] + extra) | 0;
        const col = _pickStrengthFrameBySchedule(elapsedLocal | 0, frames, msList);
        _applyStrengthFrameCol(scene, sprite, req, def, col, shouldProve, "swing.reset");
        if (col === (frames[1] | 0) && extra > 0) {
            const anySprite: any = sprite as any;
            const baseX = (() => {
                const v = Number(anySprite.getData?.(HERO_BASE_SCALE_X_KEY));
                if (Number.isFinite(v) && v !== 0) return v;
                const cur = (sprite as any).scaleX;
                if (typeof cur === "number" && Number.isFinite(cur) && cur !== 0) {
                    try { anySprite.setData(HERO_BASE_SCALE_X_KEY, cur); } catch {}
                    return cur;
                }
                try { anySprite.setData(HERO_BASE_SCALE_X_KEY, 1); } catch {}
                return 1;
            })();
            const baseY = (() => {
                const v = Number(anySprite.getData?.(HERO_BASE_SCALE_Y_KEY));
                if (Number.isFinite(v) && v !== 0) return v;
                const cur = (sprite as any).scaleY;
                if (typeof cur === "number" && Number.isFinite(cur) && cur !== 0) {
                    try { anySprite.setData(HERO_BASE_SCALE_Y_KEY, cur); } catch {}
                    return cur;
                }
                try { anySprite.setData(HERO_BASE_SCALE_Y_KEY, 1); } catch {}
                return 1;
            })();
            const nowLocal = (scene as any)?.time?.now ?? Date.now();
            const wob = STR_RESET_WOBBLE_SCALE;
            const s = 1 + (wob * Math.sin(nowLocal / STR_RESET_WOBBLE_MS));
            (sprite as any).scaleX = baseX * s;
            (sprite as any).scaleY = baseY * (1 - (wob * 0.6));
        } else {
            _restoreBaseScaleIfPresent(sprite);
        }
        return true;
    }

    const col = _pickStrengthFrameBySchedule(elapsedLocal | 0, [3, 4, 5], STR_SWING_FORWARD_FRAME_MS);
    _applyStrengthFrameCol(scene, sprite, req, def, col, shouldProve, "swing.slash");
    return true;
}

function _tryStrengthSwingResetTimeline(
    scene: Phaser.Scene,
    sprite: Phaser.GameObjects.Sprite,
    req: _HeroAnimRequest,
    def: any,
    shouldProve: boolean
): boolean {
    if (STR_CUSTOM_TIMELINE_ENABLE) return false;
    if (!STR_RESET_ENABLE) return false;
    if (!(req.actionKind === "strength_swing" && def.phase === "slash")) return false;

    const totalMs = (req.phaseDurationMs | 0);
    if (!(totalMs > 0)) return false;

    const frames: number[] = Array.isArray(def.frameIndices) ? def.frameIndices : [];
    if (frames.length < 2) return false;

    const fps = (def.frameRate | 0) > 0 ? (def.frameRate | 0) : 12;
    let slashMs = Math.min(totalMs, Math.max(1, Math.round((frames.length / fps) * 1000)));
    if (totalMs > (STR_RESET_MIN_MS | 0)) {
        const maxSlash = Math.max(0, (totalMs - (STR_RESET_MIN_MS | 0)) | 0);
        if (slashMs > maxSlash) slashMs = maxSlash;
    }
    const resetMs = Math.max(0, (totalMs - slashMs) | 0);

    let introMs = Math.max(1, STR_SWING_RESET_INTRO_MS | 0);
    let outroMs = Math.max(1, STR_SWING_RESET_OUTRO_MS | 0);
    if ((introMs + outroMs) > resetMs && resetMs > 0) {
        const scale = resetMs / (introMs + outroMs);
        introMs = Math.max(1, Math.round(introMs * scale));
        outroMs = Math.max(1, resetMs - introMs);
    }
    const holdMs = Math.max(0, (resetMs - introMs - outroMs) | 0);

    const phaseProg = Math.max(0, Math.min(1000, (req.phaseProgressInt | 0)));
    const elapsedMs = Math.round((totalMs * phaseProg) / 1000);

    let frameIndex = frames[0];
    let inHold = false;

    if (elapsedMs < slashMs) {
        const idx = Math.min(frames.length - 1, Math.floor((elapsedMs / Math.max(1, slashMs)) * frames.length));
        frameIndex = frames[idx | 0];
    } else {
        const resetElapsed = (elapsedMs - slashMs) | 0;
        if (resetMs <= 0) {
            frameIndex = frames[frames.length - 1];
        } else if (resetElapsed < introMs) {
            const half = Math.max(1, Math.round(introMs / 2));
            frameIndex = (resetElapsed < half) ? (frames[1] ?? frames[0]) : (frames[2] ?? frames[1] ?? frames[0]);
        } else if (resetElapsed < (introMs + holdMs)) {
            frameIndex = (frames[2] ?? frames[1] ?? frames[0]);
            inHold = true;
        } else {
            const outroElapsed = resetElapsed - introMs - holdMs;
            const half = Math.max(1, Math.round(outroMs / 2));
            frameIndex = (outroElapsed < half) ? (frames[1] ?? frames[0]) : (frames[0]);
        }
    }

    const animKey = buildHeroAnimKey(req.heroName!, def);
    if (!scene.anims.exists(animKey)) {
        scene.anims.create({
            key: animKey,
            frames: scene.anims.generateFrameNumbers(def.textureKey, { frames: def.frameIndices }),
            frameRate: def.frameRate,
            repeat: def.repeat,
            yoyo: def.yoyo
        });
    }

    const curKey = (sprite.anims && sprite.anims.currentAnim) ? sprite.anims.currentAnim.key : "";
    if (!curKey || curKey !== animKey) {
        try { sprite.anims.play(animKey, true); } catch { return false; }
    }

    const animState: any = sprite.anims as any;
    if (animState && typeof animState.pause === "function") {
        try { animState.pause(); } catch { /* ignore */ }
    } else {
        try { sprite.anims.stop(); } catch { /* ignore */ }
    }

    try {
        const anim = sprite.anims.currentAnim as any;
        const aframes = anim?.frames as any[] | undefined;
        if (aframes && aframes.length) {
            const idx = Math.max(0, Math.min(aframes.length - 1, aframes.findIndex((f: any) => f.index === frameIndex || f.frame?.name === frameIndex)));
            const safeIdx = idx >= 0 ? idx : Math.max(0, Math.min(aframes.length - 1, 0));
            sprite.anims.setCurrentFrame(aframes[safeIdx]);
        } else {
            sprite.setTexture(def.textureKey, frameIndex);
        }
    } catch {
        sprite.setTexture(def.textureKey, frameIndex);
    }

    if (inHold) {
        const baseX = (() => {
            const v = Number((sprite as any).getData?.(HERO_BASE_SCALE_X_KEY));
            if (Number.isFinite(v) && v !== 0) return v;
            const cur = (sprite as any).scaleX;
            if (typeof cur === "number" && Number.isFinite(cur) && cur !== 0) {
                try { (sprite as any).setData?.(HERO_BASE_SCALE_X_KEY, cur); } catch {}
                return cur;
            }
            try { (sprite as any).setData?.(HERO_BASE_SCALE_X_KEY, 1); } catch {}
            return 1;
        })();
        const baseY = (() => {
            const v = Number((sprite as any).getData?.(HERO_BASE_SCALE_Y_KEY));
            if (Number.isFinite(v) && v !== 0) return v;
            const cur = (sprite as any).scaleY;
            if (typeof cur === "number" && Number.isFinite(cur) && cur !== 0) {
                try { (sprite as any).setData?.(HERO_BASE_SCALE_Y_KEY, cur); } catch {}
                return cur;
            }
            try { (sprite as any).setData?.(HERO_BASE_SCALE_Y_KEY, 1); } catch {}
            return 1;
        })();
        const nowLocal = (scene as any)?.time?.now ?? Date.now();
        const wob = STR_RESET_WOBBLE_SCALE;
        const s = 1 + (wob * Math.sin(nowLocal / STR_RESET_WOBBLE_MS));
        (sprite as any).scaleX = baseX * s;
        (sprite as any).scaleY = baseY * (1 - (wob * 0.6));
    } else {
        _restoreBaseScaleIfPresent(sprite);
    }

    if ((sprite as any).setData) {
        (sprite as any).setData(LAST_ANIM_KEY, animKey);
        (sprite as any).setData(LAST_PHASE_KEY, def.phase);
        (sprite as any).setData(LAST_DIR_KEY, def.dir);
        (sprite as any).setData(HERO_REST_PHASE_KEY, getRestPhase(def.phase));
    }

    try { _publishHeroFollowFrameKeys(sprite, def); } catch {}
    if (shouldProve) {
        console.log(
            "[PROVE][STR-RESET]",
            "| heroName", req.heroName,
            "| frame", frameIndex,
            "| elapsed", elapsedMs,
            "| total", totalMs,
            "| slashMs", slashMs,
            "| resetMs", resetMs,
            "| holdMs", holdMs,
            "| inHold", inHold ? 1 : 0
        );
    }

    return true;
}

function _applyHeroAimTilt(sprite: Phaser.GameObjects.Sprite, req: _HeroAnimRequest): void {
    const anySprite: any = sprite as any;
    const baseKey = "__heroBaseRotation";
    if (anySprite[baseKey] == null) {
        anySprite[baseKey] = sprite.rotation ?? 0;
    }
    const baseRot = Number(anySprite[baseKey]) || 0;
    const tilt = Number((req as any).aimTiltRad) || 0;
    sprite.rotation = baseRot + tilt;
}

function _maybeStrengthStartFrameIndex(
    sprite: Phaser.GameObjects.Sprite,
    req: _HeroAnimRequest,
    def: any
): number | null {
    if (!(req.actionKind === "strength_swing" && def.phase === "slash")) return null;
    const anySprite = sprite as any;
    const skipWindup = (anySprite.getData?.(STR_SWING_SKIP_WINDUP_KEY) | 0) !== 0;
    if (!skipWindup) return null;

    const startColRaw = anySprite.getData?.(STR_SWING_START_COL_KEY);
    const startCol = Number(startColRaw);
    if (!Number.isFinite(startCol)) return null;
    try { anySprite.setData?.(STR_SWING_START_COL_KEY, 0); } catch { /* ignore */ }

    const frames: number[] = Array.isArray(def.frameIndices) ? def.frameIndices : [];
    if (!frames.length) return null;

    const col = startCol | 0;
    if (col < 0) return null;
    const idx = clampInt(col | 0, 0, frames.length - 1);
    return idx | 0;
}

function _playDefaultAnimPath(
    scene: Phaser.Scene,
    sprite: Phaser.GameObjects.Sprite,
    req: _HeroAnimRequest,
    set: any,
    def: any,
    effectivePhase: any,
    allowFallback: boolean, // unused here but kept to mirror the old signature intent
    shouldProve: boolean,
    startFrameIndex: number | null
): void {
    const anySprite = sprite as any;

    const animKey = buildHeroAnimKey(set.heroName, def);

    const lastAnimKey = anySprite.getData ? (anySprite.getData(LAST_ANIM_KEY) as string | undefined) : undefined;
    const lastPhase = anySprite.getData ? (anySprite.getData(LAST_PHASE_KEY) as HeroPhase | undefined) : undefined;
    const lastDir = anySprite.getData ? (anySprite.getData(LAST_DIR_KEY) as HeroDir | undefined) : undefined;

    // --- helper: stretch current animation to match engine duration ---
    const _applyPhaseTimeScaleIfPossible = (): void => {
        const durMs = (req.phaseDurationMs | 0);
        if (!(durMs > 0)) return;

        // Need a current anim to scale.
        const curAnim = (sprite.anims && sprite.anims.currentAnim) ? sprite.anims.currentAnim : null;
        if (!curAnim) return;

        const framesLen = Array.isArray(def.frameIndices) ? (def.frameIndices.length | 0) : 0;
        const fps = (def.frameRate | 0) > 0 ? (def.frameRate | 0) : 0;
        if (!(framesLen > 0 && fps > 0)) return;

        // Approx authored duration for one pass through frames.
        // (Good enough for your thrust/cast/walk/run cases; slash yoyo/repeat cases still behave nicely.)
        const authoredMs = Math.max(1, Math.floor((framesLen / fps) * 1000));

        // If anim repeats (-1) or has repeat cycles, we do NOT try to time-scale to a fixed duration.
        // This is specifically for finite action clips (repeat=0 typical).
        const rep = (def.repeat | 0);
        if (rep !== 0) return;

        // Want clip to occupy entire engine phase window
        let desiredMs = Math.max(1, durMs);
        // Strength charge prep should use the prep-part duration, not the full charge window.
        if (req.actionKind === "strength_charge") {
            const part = String((req as any).phasePartName || "").trim().toLowerCase();
            if (part === "preparetocharge") {
                const partDur = Number((req as any).phasePartDurationMs) | 0;
                if (partDur > 0) desiredMs = partDur;
            }
        }

        // Phaser uses timeScale where 1.0 = normal speed.
        // If desired is longer than authored → timeScale < 1.
        const ts = authoredMs / desiredMs;

        const safe = Math.max(0.02, Math.min(5, ts)); // clamp so we don't freeze or explode
        try {
            (sprite.anims as any).timeScale = safe;
        } catch {}

        const SHOULD_LOG_TIMESCALE = false;
        if (SHOULD_LOG_TIMESCALE) {
        if (shouldProve) {
            console.log(
                "[PROVE][HERO-ANIM][TIMESCALE]",
                "| heroName", req.heroName,
                "| animKey", animKey,
                "| framesLen", framesLen,
                "| fps", fps,
                "| authoredMs≈", authoredMs,
                "| desiredMs", desiredMs,
                "| timeScale", safe
            );
        }
    };

    };

    if (
        startFrameIndex == null &&
        lastAnimKey === animKey &&
        lastPhase === def.phase &&
        lastDir === def.dir &&
        sprite.anims &&
        sprite.anims.currentAnim &&
        sprite.anims.currentAnim.key === animKey &&
        sprite.anims.isPlaying
    ) {
        // ✅ Even if "noop", publish follow keys so weapons always see fresh data.
        _publishHeroFollowFrameKeys(sprite, def);

        // ✅ Also keep timeScale aligned to the engine duration.
        _applyPhaseTimeScaleIfPossible();

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
    if (startFrameIndex != null) {
        const framesLen = Array.isArray(def.frameIndices) ? (def.frameIndices.length | 0) : 0;
        const startIdx = framesLen > 0 ? clampInt(startFrameIndex | 0, 0, framesLen - 1) : 0;
        sprite.anims.play({ key: animKey, startFrame: startIdx }, true);
    } else {
        sprite.anims.play(animKey, true);
    }

    // ✅ Immediately apply timeScale so it doesn't finish early.
    _applyPhaseTimeScaleIfPossible();

    if (shouldProve) _proveLogPlayAfter(sprite, req, animKey);

    if (anySprite.setData) {
        anySprite.setData(LAST_ANIM_KEY, animKey);
        anySprite.setData(LAST_PHASE_KEY, def.phase);
        anySprite.setData(LAST_DIR_KEY, def.dir);
    }

    // ✅ Publish "frame within clip" contract right away (weapons follow immediately).
    _publishHeroFollowFrameKeys(sprite, def);

    _detachPrevAnimCompleteHandler(sprite);
    const actionKind = (req.actionKind || "").toLowerCase();
    if (actionKind !== "death") {
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
}



// ------------------------------------------------------------
// Main function (split; NO behavior change)
// ------------------------------------------------------------
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
    // Part-aware phase selection
    // - Cast: uses PhasePartName (existing behavior)
    // - Strength swing: uses STR_SEG_NAME addon channel (NEW, non-breaking)
    // ------------------------------------------------------------
    const castPartName =
        (req as any).phasePartName && typeof (req as any).phasePartName === "string"
            ? ((req as any).phasePartName as string)
            : "";

    const strengthSegName =
        (req as any).strSegName && typeof (req as any).strSegName === "string"
            ? ((req as any).strSegName as string)
            : "";

    let requestedPhaseForLookup: any = req.phase;

    if (req.phase === "cast" && castPartName) {
        requestedPhaseForLookup = `${req.phase}_${castPartName}`;
    } else if (!STR_CUSTOM_TIMELINE_ENABLE && req.actionKind === "strength_swing" && req.phase === "slash" && strengthSegName) {
        // This only affects atlas lookup; engine PhasePartName stays "swing".
        requestedPhaseForLookup = `${req.phase}_${strengthSegName}`;
    }

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

    if (DEBUG_NPC_PIPELINE && isNpcHeroSprite(sprite)) {
        const anySprite: any = sprite as any;
        const already = anySprite.getData ? anySprite.getData(NPC_ANIM_LOG_ONCE_KEY) : 0;
        if (!already) {
            try { anySprite.setData?.(NPC_ANIM_LOG_ONCE_KEY, 1); } catch { /* ignore */ }
            console.log("[NPC-PIPE][anim.map]", {
                heroName: req.heroName,
                family: req.family,
                phase: req.phase,
                dir: req.dir,
                actionKind: req.actionKind,
                frameColOverride: req.frameColOverride,
                textureKey: def.textureKey,
                defPhase: def.phase,
                defDir: def.dir,
                npcRole: anySprite.getData ? (anySprite.getData("_npcRole") || "") : ""
            });
        }
    }

    _applyHeroAimTilt(sprite, req);

    // ------------------------------------------------------------
    // Strength charge throb (early return on success)
    // ------------------------------------------------------------
    if (_tryStrengthChargeThrob(scene, sprite, req, def, shouldProve)) {
        _publishHeroFollowFrameKeys(sprite, def);
        _debugHeroAnimFrame(scene, sprite, req, def);
        _debugStrengthFrameTrace(scene, sprite, req);
        return;
    } else {
        _restoreBaseScaleIfPresent(sprite);
    }

    // ------------------------------------------------------------
    // Strength custom timeline (early return)
    // ------------------------------------------------------------
    if (_tryStrengthCustomTimeline(scene, sprite, req, def, shouldProve)) {
        _publishHeroFollowFrameKeys(sprite, def);
        _debugHeroAnimFrame(scene, sprite, req, def);
        _debugStrengthFrameTrace(scene, sprite, req);
        return;
    }

    // ------------------------------------------------------------
    // Strength swing reset timeline (early return)
    // ------------------------------------------------------------
    if (_tryStrengthSwingResetTimeline(scene, sprite, req, def, shouldProve)) {
        _publishHeroFollowFrameKeys(sprite, def);
        _debugHeroAnimFrame(scene, sprite, req, def);
        _debugStrengthFrameTrace(scene, sprite, req);
        return;
    }

    // ------------------------------------------------------------
    // Hold single-frame path (early return)
    // ------------------------------------------------------------
    if (_tryHoldSingleFrame(scene, sprite, req, def, shouldProve)) {
        _publishHeroFollowFrameKeys(sprite, def);
        _debugHeroAnimFrame(scene, sprite, req, def);
        _debugStrengthFrameTrace(scene, sprite, req);
        return;
    }

    // ------------------------------------------------------------
    // Pause/resume current anim without forcing a frame (early return)
    // ------------------------------------------------------------
    if (_tryAnimHold(scene, sprite, req, def, shouldProve)) {
        _publishHeroFollowFrameKeys(sprite, def);
        _debugHeroAnimFrame(scene, sprite, req, def);
        _debugStrengthFrameTrace(scene, sprite, req);
        return;
    }

    // ------------------------------------------------------------
    // Cast part frame control (early return)
    // ------------------------------------------------------------
    if (_tryCastPartFrameControl(scene, sprite, req, def, shouldProve)) {
        _publishHeroFollowFrameKeys(sprite, def);
        _debugHeroAnimFrame(scene, sprite, req, def);
        _debugStrengthFrameTrace(scene, sprite, req);
        return;
    }

    // ------------------------------------------------------------
    // Default anim-based path
    // ------------------------------------------------------------
    const startFrameIndex = _maybeStrengthStartFrameIndex(sprite, req, def);
    _playDefaultAnimPath(scene, sprite, req, set, def, effectivePhase, allowFallback, shouldProve, startFrameIndex);
    _debugHeroAnimFrame(scene, sprite, req, def);
    _debugStrengthFrameTrace(scene, sprite, req);
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

    const animKey = buildHeroAnimKey(req.heroName!, def);
    if (!scene.anims.exists(animKey)) {
        scene.anims.create({
            key: animKey,
            frames: scene.anims.generateFrameNumbers(def.textureKey, { frames: def.frameIndices }),
            frameRate: def.frameRate,
            repeat: def.repeat,
            yoyo: def.yoyo
        });
    }

    const curKey = (sprite.anims && sprite.anims.currentAnim) ? sprite.anims.currentAnim.key : "";
    if (!curKey || curKey !== animKey) {
        try { sprite.anims.play(animKey, true); } catch { return true; }
    }

    const animState: any = sprite.anims as any;
    if (animState && typeof animState.pause === "function") {
        try { animState.pause(); } catch { /* ignore */ }
    } else {
        try { sprite.anims.stop(); } catch { /* ignore */ }
    }

    try {
        const anim = sprite.anims.currentAnim as any;
        const aframes = anim?.frames as any[] | undefined;
        if (aframes && aframes.length) {
            const safeIdx = clampInt(col | 0, 0, aframes.length - 1);
            sprite.anims.setCurrentFrame(aframes[safeIdx]);
        } else {
            sprite.setTexture(def.textureKey, frameIndex);
        }
    } catch {
        sprite.setTexture(def.textureKey, frameIndex);
    }

    const prevHandler = anySprite[HERO_ANIMCOMPLETE_HANDLER_KEY] as
        | ((anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => void)
        | undefined;
    if (prevHandler) {
        sprite.off("animationcomplete", prevHandler);
        anySprite[HERO_ANIMCOMPLETE_HANDLER_KEY] = undefined;
    }

    if (anySprite.setData) {
        anySprite.setData(LAST_ANIM_KEY, animKey);
        anySprite.setData(LAST_PHASE_KEY, def.phase);
        anySprite.setData(LAST_DIR_KEY, def.dir);
    }

    return true;
}

function _tryAnimHold(
    scene: Phaser.Scene,
    sprite: Phaser.GameObjects.Sprite,
    req: _HeroAnimRequest,
    def: any,
    shouldProve: boolean
): boolean {
    const hold = !!(req as any).animHold;
    const animKey = buildHeroAnimKey(req.heroName!, def);
    const anySprite = sprite as any;
    const animState: any = sprite.anims as any;
    const curAnim = (animState && animState.currentAnim) ? animState.currentAnim : null;
    const curKey = curAnim ? curAnim.key : "";
    const isPaused = !!(animState && animState.isPaused);

    const applyPhaseTimeScaleIfPossible = (): void => {
        const durMs = (req.phaseDurationMs | 0);
        if (!(durMs > 0)) return;
        const framesLen = Array.isArray(def.frameIndices) ? (def.frameIndices.length | 0) : 0;
        const fps = (def.frameRate | 0) > 0 ? (def.frameRate | 0) : 0;
        if (!(framesLen > 0 && fps > 0)) return;
        const rep = (def.repeat | 0);
        if (rep !== 0) return;
        const authoredMs = Math.max(1, Math.floor((framesLen / fps) * 1000));
        let desiredMs = Math.max(1, durMs);
        if (req.actionKind === "strength_charge") {
            const part = String((req as any).phasePartName || "").trim().toLowerCase();
            if (part === "preparetocharge") {
                const partDur = Number((req as any).phasePartDurationMs) | 0;
                if (partDur > 0) desiredMs = partDur;
            }
        }
        const ts = authoredMs / desiredMs;
        const safe = Math.max(0.02, Math.min(5, ts));
        try { (sprite.anims as any).timeScale = safe; } catch {}
    };

    if (!hold) {
        if (isPaused && curKey === animKey) {
            try { animState.resume(); } catch { /* ignore */ }
            applyPhaseTimeScaleIfPossible();
            return true;
        }
        return false;
    }

    if (!scene.anims.exists(animKey)) {
        scene.anims.create({
            key: animKey,
            frames: scene.anims.generateFrameNumbers(def.textureKey, { frames: def.frameIndices }),
            frameRate: def.frameRate,
            repeat: def.repeat,
            yoyo: def.yoyo
        });
    }

    if (!curKey || curKey !== animKey) {
        try { sprite.anims.play(animKey, true); } catch { return true; }
        applyPhaseTimeScaleIfPossible();
    }

    if (animState && typeof animState.pause === "function") {
        try { animState.pause(); } catch { /* ignore */ }
    } else {
        try { sprite.anims.stop(); } catch { /* ignore */ }
    }

    if (shouldProve) {
        console.log(
            "[PROVE][HERO-ANIM][HOLD-PAUSE]",
            "| heroName", req.heroName,
            "| phase", def.phase,
            "| dir", def.dir,
            "| animKey", animKey
        );
    }

    if (anySprite.setData) {
        anySprite.setData(LAST_ANIM_KEY, animKey);
        anySprite.setData(LAST_PHASE_KEY, def.phase);
        anySprite.setData(LAST_DIR_KEY, def.dir);
    }

    return true;
}
const SHOULD_LOG_NOOP = false;

function _proveLogNoop(req: _HeroAnimRequest, animKey: string, def: any): void {
    if (SHOULD_LOG_NOOP) {
    console.log(
        "[PROVE][HERO-ANIM][NOOP]",
        "| heroName", req.heroName,
        "| animKey", animKey,
        "| def.phase", def.phase,
        "| def.dir", def.dir,
        "| already playing"
    );
};
}

const SHOULD_LOG_CREATE = false; //Debug flag

function _proveLogCreate(req: _HeroAnimRequest, animKey: string, def: any): void {
    if (SHOULD_LOG_CREATE) {
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
};

}

const SHOULD_LOG_BEFORE = false; //Debug flag
function _proveLogPlayBefore(
    sprite: Phaser.GameObjects.Sprite,
    req: _HeroAnimRequest,
    animKey: string,
    restPhase: any
): void {
    if (SHOULD_LOG_BEFORE) {
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
};

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

    // --- local clock anchor for this action sequence ---
    const scene = sprite.scene;
    const sceneNowMs =
        (scene?.time && typeof scene.time.now === "number")
            ? (scene.time.now | 0)
            : 0;

    const actionSeq = (req.actionSequence | 0);

    const prevSeq = Number(anySprite.getData?.(HERO_LOCAL_PHASE_ACTIONSEQ_KEY));
    let localStart = Number(anySprite.getData?.(HERO_LOCAL_PHASE_LOCAL_START_KEY));
    let localDur = Number(anySprite.getData?.(HERO_LOCAL_PHASE_LOCAL_DUR_KEY));

    const durMs = (req.phaseDurationMs | 0);
    if (prevSeq !== actionSeq || !Number.isFinite(localStart) || localStart <= 0 || !Number.isFinite(localDur) || localDur <= 0) {
        // Anchor whenever action sequence changes, or first-time.
        localStart = sceneNowMs;
        localDur = durMs > 0 ? durMs : 1;
        try {
            anySprite.setData?.(HERO_LOCAL_PHASE_ACTIONSEQ_KEY, actionSeq);
            anySprite.setData?.(HERO_LOCAL_PHASE_LOCAL_START_KEY, localStart);
            anySprite.setData?.(HERO_LOCAL_PHASE_LOCAL_DUR_KEY, localDur);
        } catch { /* ignore */ }
    }

    const handler = (anim: Phaser.Animations.Animation) => {
        if (anim.key !== animKey) return;

        // Guard: if we are still “inside” the engine phase window, ignore early completes.
        const curPhase = anySprite.getData ? (anySprite.getData(HERO_PHASE_KEY) as HeroPhase | undefined) : undefined;

        const now2 =
            (sprite.scene?.time && typeof sprite.scene.time.now === "number")
                ? (sprite.scene.time.now | 0)
                : 0;

        const localStart2 = Number(anySprite.getData?.(HERO_LOCAL_PHASE_LOCAL_START_KEY));
        const localDur2 = Number(anySprite.getData?.(HERO_LOCAL_PHASE_LOCAL_DUR_KEY));

        const inWindow =
            Number.isFinite(localStart2) &&
            Number.isFinite(localDur2) &&
            localDur2 > 0 &&
            (now2 - (localStart2 | 0)) < (localDur2 | 0) - 5; // small slack

        if (curPhase === phaseAtApply && inWindow) {
            if (shouldProve) {
                console.log(
                    "[PROVE][HERO-ANIM][COMPLETE-IGNORED]",
                    "| heroName", req.heroName,
                    "| animKey", animKey,
                    "| phase", curPhase,
                    "| nowLocal", now2,
                    "| localStart", localStart2,
                    "| localDur", localDur2
                );
            }
            return;
        }

        if (shouldProve) _proveLogComplete(req, animKey, phaseAtApply, effectivePhase, def);

        const curDir = anySprite.getData ? (anySprite.getData(HERO_DIR_KEY) as HeroDir | undefined) : undefined;
        if (!curDir) return;

        const targetRestPhase =
            (anySprite.getData && (anySprite.getData(HERO_REST_PHASE_KEY) as HeroPhase | undefined)) || restPhase;

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

// Log once per aura sheet to confirm lookup path for props/tiles.
const __outlineAuraLogOnce = new Set<string>();


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



      let solidCount = 0;
      for (let y = 0; y < ch; y++) {
          for (let x = 0; x < cw; x++) {
              const i = (y * cw + x) * 4;
              solid[y * cw + x] = data[i + 3] > 0 ? 1 : 0;
              if (solid[y * cw + x]) solidCount++;
          }
      }
      const isFullSolid = (solidCount === (cw * ch));

      if (isFullSolid) {
          // Full-opaque tile: draw a 1px border so outline is visible.
          ctx.clearRect(0, 0, cw, ch);
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1;
          ctx.strokeRect(0, 0, cw, ch);
          ctex.refresh();
          __heroAuraOutlineCache.set(cacheKey, outTexKey);
          return outTexKey;
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
const __effectMaskStatsOnce = new Set<string>();

function __countBits32(v: number): number {
    let x = v >>> 0;
    x = x - ((x >>> 1) & 0x55555555);
    x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
    return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}
const __outlineAuraFrameHasAlpha = new Map<string, boolean>();
const __outlineAuraFrameStats = new Map<string, {
    alphaCount: number;
    maxAlpha: number;
    avgR: number;
    avgG: number;
    avgB: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}>();
const __outlineAuraWhiteCache = new Map<string, string>();

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
    if (!frame) {
        throw new Error(`[auraMask] frame not found for ${texKey}:${frameName}`);
    }

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

// Draw a Phaser frame object into a canvas and return ImageData.
function __readFrameImageDataFromFrame(frame: Phaser.Textures.Frame): ImageData {
    const w = frame.width;
    const h = frame.height;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.clearRect(0, 0, w, h);

    let src = (frame as any).source?.image as HTMLImageElement | HTMLCanvasElement | undefined;
    if (!src) {
        const texAny: any = (frame as any).texture;
        src = (texAny?.getSourceImage?.() as HTMLImageElement | HTMLCanvasElement | undefined)
            || (texAny?.source && texAny.source[0] ? texAny.source[0].image : undefined);
    }
    if (!src) {
        const texKey = (frame as any).texture?.key ?? "?";
        const frameName = (frame as any).name ?? "?";
        throw new Error(`[auraMask] no frame source image for ${texKey}:${frameName}`);
    }

    const sx = (frame as any).cutX ?? (frame as any).x ?? 0;
    const sy = (frame as any).cutY ?? (frame as any).y ?? 0;

    ctx.drawImage(src, sx, sy, w, h, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
}

function __getOrBuildPrebakedOutlineTexture(
    scene: Phaser.Scene,
    texKey: string,
    frameName: string,
    radius: number,
    pad: number
): string | null {
    try {
        const baseImg = __readFrameImageData(scene, texKey, frameName);
        const w = baseImg.width | 0;
        const h = baseImg.height | 0;
        const outW = w + (pad * 2);
        const outH = h + (pad * 2);

        const cacheKey = `__prebakedOutline__${texKey}::${frameName}::r${radius}::p${pad}`;
        if (scene.textures.exists(cacheKey)) return cacheKey;

        const outlineKey = __getOrBuildHeroOutlineTexture(scene, texKey, frameName, radius);
        if (!outlineKey) return null;
        const outlineImg = __readFrameImageData(scene, outlineKey, "__BASE");

        const ctex = scene.textures.createCanvas(cacheKey, outW, outH);
        const canvas = ctex.getSourceImage() as any;
        const ctx = canvas.getContext("2d", { willReadFrequently: true } as any);
        if (!ctx) return null;

        // Draw scaled outline to make it slightly larger than the base.
        const outlineCanvas = document.createElement("canvas");
        outlineCanvas.width = outlineImg.width | 0;
        outlineCanvas.height = outlineImg.height | 0;
        const octx = outlineCanvas.getContext("2d", { willReadFrequently: true } as any);
        if (octx) {
            octx.putImageData(outlineImg, 0, 0);
            ctx.clearRect(0, 0, outW, outH);
            ctx.drawImage(outlineCanvas, 0, 0, outW, outH);
        }

        // Paint base sprite over the outline at pad offset.
        ctx.putImageData(baseImg, pad, pad);
        ctex.refresh();
        __logAuraBuildProbeOnce(scene, texKey, frameName, outlineKey, cacheKey, baseImg, outlineImg, outW, outH, pad);
        return cacheKey;
    } catch {
        return null;
    }
}

function __logOutlinePixelDiffOnce(
    scene: Phaser.Scene,
    baseKey: string,
    baseFrame: string,
    outlineKey: string,
    outlineFrame: string
): void {
    try {
        if (!DEBUG_PROP_OUTLINE_VERBOSE) return;
        const g: any = globalThis as any;
        const k = `__outlinePixelDiff__${baseKey}::${baseFrame}__${outlineKey}::${outlineFrame}`;
        if (g[k]) return;
        g[k] = 1;

        const baseImg = __readFrameImageData(scene, baseKey, baseFrame);
        const outImg = __readFrameImageData(scene, outlineKey, outlineFrame);
        const bw = baseImg.width | 0;
        const bh = baseImg.height | 0;
        const ow = outImg.width | 0;
        const oh = outImg.height | 0;
        const sx = Math.max(1, (bw / 4) | 0);
        const sy = Math.max(1, (bh / 4) | 0);
        let diff = 0;
        let samples = 0;
        for (let y = 0; y < bh; y += sy) {
            for (let x = 0; x < bw; x += sx) {
                const bi = (y * bw + x) * 4;
                const oi = (Math.min(y, oh - 1) * ow + Math.min(x, ow - 1)) * 4;
                const br = baseImg.data[bi + 0] | 0;
                const bg = baseImg.data[bi + 1] | 0;
                const bb = baseImg.data[bi + 2] | 0;
                const ba = baseImg.data[bi + 3] | 0;
                const or = outImg.data[oi + 0] | 0;
                const og = outImg.data[oi + 1] | 0;
                const ob = outImg.data[oi + 2] | 0;
                const oa = outImg.data[oi + 3] | 0;
                if (br !== or || bg !== og || bb !== ob || ba !== oa) diff++;
                samples++;
            }
        }
        console.log("[AURA][PROPS][PIXEL-DIFF]", {
            baseKey,
            baseFrame,
            outlineKey,
            outlineFrame,
            baseSize: { w: bw, h: bh },
            outlineSize: { w: ow, h: oh },
            samples,
            diff
        });
    } catch { /* ignore */ }
}

function __logFrameAlphaCountOnce(scene: Phaser.Scene, texKey: string, frameName: string): void {
    try {
        if (!DEBUG_PROP_OUTLINE_VERBOSE) return;
        const g: any = globalThis as any;
        const k = `__frameAlphaCount__${texKey}::${frameName}`;
        if (g[k]) return;
        g[k] = 1;

        const img = __readFrameImageData(scene, texKey, frameName);
        const data = img.data;
        let count = 0;
        let maxA = 0;
        for (let i = 3; i < data.length; i += 4) {
            const a = data[i] | 0;
            if (a > 0) {
                count++;
                if (a > maxA) maxA = a;
            }
        }
        console.log("[AURA][PROPS][ALPHA-COUNT]", {
            texKey,
            frameName,
            w: img.width | 0,
            h: img.height | 0,
            alphaCount: count,
            maxAlpha: maxA
        });
    } catch { /* ignore */ }
}

function __sampleFrameColorStats(img: ImageData): {
    sampleCount: number;
    unique: number;
    top: Array<{ rgb: string; count: number }>;
} {
    const data = img.data;
    const w = img.width | 0;
    const h = img.height | 0;
    const sx = Math.max(1, (w / 8) | 0);
    const sy = Math.max(1, (h / 8) | 0);
    const counts = new Map<number, number>();
    let sampleCount = 0;
    for (let y = 0; y < h; y += sy) {
        for (let x = 0; x < w; x += sx) {
            const i = (y * w + x) * 4;
            const a = data[i + 3] | 0;
            if (a === 0) continue;
            const r = data[i + 0] | 0;
            const g = data[i + 1] | 0;
            const b = data[i + 2] | 0;
            const key = (r << 16) | (g << 8) | b;
            counts.set(key, (counts.get(key) ?? 0) + 1);
            sampleCount++;
        }
    }
    const top = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k, c]) => ({
            rgb: "#" + k.toString(16).padStart(6, "0"),
            count: c
        }));
    return { sampleCount, unique: counts.size, top };
}

function __summarizeImageStats(img: ImageData): {
    w: number;
    h: number;
    alphaCount: number;
    maxAlpha: number;
    colorSamples: { sampleCount: number; unique: number; top: Array<{ rgb: string; count: number }> };
} {
    const data = img.data;
    let alphaCount = 0;
    let maxAlpha = 0;
    for (let i = 3; i < data.length; i += 4) {
        const a = data[i] | 0;
        if (a > 0) {
            alphaCount++;
            if (a > maxAlpha) maxAlpha = a;
        }
    }
    return {
        w: img.width | 0,
        h: img.height | 0,
        alphaCount,
        maxAlpha,
        colorSamples: __sampleFrameColorStats(img)
    };
}

function __summarizeRawData(
    data: Uint8ClampedArray,
    w: number,
    h: number
): {
    alphaCount: number;
    maxAlpha: number;
    colorSamples: { sampleCount: number; unique: number; top: Array<{ rgb: string; count: number }> };
} {
    let alphaCount = 0;
    let maxAlpha = 0;
    for (let i = 3; i < data.length; i += 4) {
        const a = data[i] | 0;
        if (a > 0) {
            alphaCount++;
            if (a > maxAlpha) maxAlpha = a;
        }
    }
    const img = new ImageData(data, w, h);
    return {
        alphaCount,
        maxAlpha,
        colorSamples: __sampleFrameColorStats(img)
    };
}

function __logAuraBuildProbeOnce(
    scene: Phaser.Scene,
    baseKey: string,
    baseFrame: string,
    outlineKey: string,
    outKey: string,
    baseImg: ImageData,
    outlineImg: ImageData,
    outW: number,
    outH: number,
    pad: number
): void {
    try {
        if (!DEBUG_PROP_OUTLINE_VERBOSE) return;
        const g: any = globalThis as any;
        const k = `__auraBuildProbe__${baseKey}::${baseFrame}`;
        if (g[k]) return;
        g[k] = 1;

        const baseData = baseImg.data;
        const outlineData = outlineImg.data;
        let baseAlpha = 0;
        let outlineAlpha = 0;
        let baseMaxA = 0;
        let outlineMaxA = 0;
        for (let i = 3; i < baseData.length; i += 4) {
            const a = baseData[i] | 0;
            if (a > 0) {
                baseAlpha++;
                if (a > baseMaxA) baseMaxA = a;
            }
        }
        for (let i = 3; i < outlineData.length; i += 4) {
            const a = outlineData[i] | 0;
            if (a > 0) {
                outlineAlpha++;
                if (a > outlineMaxA) outlineMaxA = a;
            }
        }

        const baseSample = __sampleFrameColorStats(baseImg);
        const outlineSample = __sampleFrameColorStats(outlineImg);

        console.log("[AURA][PROPS][BUILD-PROBE]", {
            base: {
                key: baseKey,
                frame: baseFrame,
                w: baseImg.width | 0,
                h: baseImg.height | 0,
                alphaCount: baseAlpha,
                maxAlpha: baseMaxA,
                colorSamples: baseSample
            },
            outline: {
                key: outlineKey,
                frame: "__BASE",
                w: outlineImg.width | 0,
                h: outlineImg.height | 0,
                alphaCount: outlineAlpha,
                maxAlpha: outlineMaxA,
                colorSamples: outlineSample
            },
            composite: {
                key: outKey,
                outW,
                outH,
                pad
            }
        });
    } catch { /* ignore */ }
}

function __captureScreenStats(
    scene: Phaser.Scene,
    rect: { x: number; y: number; w: number; h: number },
    cb: (stats: any, data: Uint8ClampedArray) => void
): void {
    try {
        const cam: any = scene.cameras?.main;
        const renderer: any = (scene as any).game?.renderer;
        const useCam = !!(cam && typeof cam.snapshotArea === "function");
        const useRenderer = !useCam && !!(renderer && typeof renderer.snapshotArea === "function");
        if (!useCam && !useRenderer) {
            if (DEBUG_PROP_OUTLINE_VERBOSE) console.log("[AURA][PROPS][SCREEN-SAMPLE][ERROR]", {
                reason: "no snapshotArea",
                hasCamera: !!cam,
                hasRenderer: !!renderer
            });
            return;
        }
        const snapshot = useCam ? cam.snapshotArea.bind(cam) : renderer.snapshotArea.bind(renderer);
        const source = useCam ? "camera" : "renderer";
        snapshot(rect.x, rect.y, rect.w, rect.h, (image: any) => {
            try {
                const canvas = document.createElement("canvas");
                canvas.width = rect.w;
                canvas.height = rect.h;
                const ctx = canvas.getContext("2d");
                if (!ctx) return;
                ctx.drawImage(image, 0, 0);
                const img = ctx.getImageData(0, 0, rect.w, rect.h);
                const data = img.data;
                let alphaCount = 0;
                let maxAlpha = 0;
                const colors = new Map<number, number>();
                for (let i = 0; i < data.length; i += 4) {
                    const a = data[i + 3] | 0;
                    if (a > 0) {
                        alphaCount++;
                        if (a > maxAlpha) maxAlpha = a;
                    }
                    const r = data[i + 0] | 0;
                    const g = data[i + 1] | 0;
                    const b = data[i + 2] | 0;
                    const key = (r << 16) | (g << 8) | b;
                    colors.set(key, (colors.get(key) ?? 0) + 1);
                }
                const top = Array.from(colors.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([k, c]) => ({
                        rgb: "#" + k.toString(16).padStart(6, "0"),
                        count: c
                    }));
                cb({
                    rect,
                    source,
                    totalPixels: (rect.w * rect.h) | 0,
                    alphaCount,
                    maxAlpha,
                    uniqueColors: colors.size,
                    topColors: top
                }, data);
            } catch { /* ignore */ }
        });
    } catch { /* ignore */ }
}

function __scheduleScreenSampleProbe(
    scene: Phaser.Scene,
    native: any,
    baseKey: string,
    baseFrame: string,
    outlineKey: string | null,
    outlineFrame: string | null,
    applySwap: () => void
): void {
    let logged = false;
    const baseKeyStr = String(baseKey);
    const baseFrameStr = String(baseFrame);
    let baseStats: any = null;
    let outlineStats: any = null;
    let source = "none";
    let rect: any = null;
    try {
        if (!DEBUG_PROP_OUTLINE_ONELOG) {
            applySwap();
            return;
        }
        const g: any = globalThis as any;
        const k = `__propOutlineOneLog__${baseKeyStr}::${baseFrameStr}`;
        if (g[k]) {
            applySwap();
            return;
        }
        const logOnce = (screen: any) => {
            if (g[k] || logged) return;
            logged = true;
            g[k] = 1;
            const payload = {
                base: { key: baseKeyStr, frame: baseFrameStr, stats: baseStats },
                outline: { key: outlineKey, frame: outlineFrame, stats: outlineStats },
                screen
            };
            try {
                console.log("[AURA][PROPS][ONELOG] " + JSON.stringify(payload));
            } catch {
                console.log("[AURA][PROPS][ONELOG] " + String(payload));
            }
        };

        try {
            const baseImg = __readFrameImageData(scene, baseKeyStr, baseFrameStr);
            baseStats = __summarizeImageStats(baseImg);
        } catch { /* ignore */ }
        try {
            if (outlineKey && outlineFrame) {
                const outImg = __readFrameImageData(scene, outlineKey, outlineFrame);
                outlineStats = __summarizeImageStats(outImg);
            }
        } catch { /* ignore */ }

        const cam: any = scene.cameras?.main;
        const renderer: any = (scene as any).game?.renderer;
        const camSnapshotArea = (cam && typeof cam.snapshotArea === "function") ? cam.snapshotArea.bind(cam) : null;
        const camSnapshotFull = (cam && typeof cam.snapshot === "function") ? cam.snapshot.bind(cam) : null;
        const rendererSnapshot = (renderer && typeof renderer.snapshotArea === "function") ? renderer.snapshotArea.bind(renderer) : null;
        const rendererSnapshotPixel = (renderer && typeof renderer.snapshotPixel === "function") ? renderer.snapshotPixel.bind(renderer) : null;
        const camInfo = {
            hasSnapshotArea: !!camSnapshotArea,
            hasSnapshot: !!camSnapshotFull,
            hasRendererSnapshot: !!rendererSnapshot,
            hasRendererSnapshotPixel: !!rendererSnapshotPixel
        };
        let snapshot: any = null;
        let snapshotIsFull = false;
        let fallbackReason = "";
        if (DEBUG_PROP_OUTLINE_PREFER_CAMERA_SNAPSHOT) {
            if (camSnapshotArea) {
                snapshot = camSnapshotArea;
                snapshotIsFull = false;
                source = "camera";
            } else if (camSnapshotFull) {
                snapshot = camSnapshotFull;
                snapshotIsFull = true;
                source = "camera";
                fallbackReason = "cameraAreaUnavailable";
            } else if (rendererSnapshot) {
                snapshot = rendererSnapshot;
                snapshotIsFull = false;
                source = "renderer";
                fallbackReason = "cameraUnavailable";
            }
        } else {
            if (camSnapshotArea) {
                snapshot = camSnapshotArea;
                snapshotIsFull = false;
                source = "camera";
            } else if (camSnapshotFull) {
                snapshot = camSnapshotFull;
                snapshotIsFull = true;
                source = "camera";
            } else if (rendererSnapshot) {
                snapshot = rendererSnapshot;
                snapshotIsFull = false;
                source = "renderer";
            }
        }

        const zoom = cam?.zoom ?? 1;
        const fw = (native.frame?.width ?? native.width ?? 32) | 0;
        const fh = (native.frame?.height ?? native.height ?? 32) | 0;
        const sx = (native.scaleX ?? 1) * zoom;
        const sy = (native.scaleY ?? 1) * zoom;
        const ox = (native.originX ?? 0.5);
        const oy = (native.originY ?? 0.5);
        const w = Math.max(4, Math.round(fw * sx));
        const h = Math.max(4, Math.round(fh * sy));
        const screenX = cam ? (native.x - cam.scrollX) * zoom : native.x;
        const screenY = cam ? (native.y - cam.scrollY) * zoom : native.y;
        let x = Math.round(screenX - w * ox) - 4;
        let y = Math.round(screenY - h * oy) - 4;
        let sw = Math.round(w + 8);
        let sh = Math.round(h + 8);
        const rw = (scene.scale?.width ?? 0) | 0;
        const rh = (scene.scale?.height ?? 0) | 0;
        if (rw > 0 && rh > 0) {
            if (x < 0) { sw += x; x = 0; }
            if (y < 0) { sh += y; y = 0; }
            if (x + sw > rw) sw = rw - x;
            if (y + sh > rh) sh = rh - y;
        }
        rect = { x, y, w: Math.max(1, sw), h: Math.max(1, sh) };

        const maybeLogPixelProbe = () => {
            if (!DEBUG_PROP_OUTLINE_PREFER_PIXEL_PROBE || !rendererSnapshotPixel) return false;
            const renderW =
                (renderer?.width ?? renderer?.canvas?.width ?? scene.scale?.width ?? 0) | 0;
            const renderH =
                (renderer?.height ?? renderer?.canvas?.height ?? scene.scale?.height ?? 0) | 0;
            const outlineW = outlineStats?.w ?? fw;
            const outlineH = outlineStats?.h ?? fh;
            const probeScaleX = (native.scaleX ?? 1) * (DEBUG_PROP_OUTLINE_EXAGGERATE ? 2 : 1);
            const probeScaleY = (native.scaleY ?? 1) * (DEBUG_PROP_OUTLINE_EXAGGERATE ? 2 : 1);
            const outW = Math.max(2, Math.round(outlineW * probeScaleX));
            const outH = Math.max(2, Math.round(outlineH * probeScaleY));
            const left = Math.round(screenX - outW * ox);
            const top = Math.round(screenY - outH * oy);
            const right = left + outW - 1;
            const bottom = top + outH - 1;

            const midX = Math.round((left + right) / 2);
            const midY = Math.round((top + bottom) / 2);
            const inset2 = Math.min(6, Math.max(2, Math.round(Math.min(outW, outH) * 0.1)));

            const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
            const maxX = Math.max(0, renderW - 1);
            const maxY = Math.max(0, renderH - 1);
            const makeRing = (inset: number, tag: string) => ([
                { name: `tl${tag}`, x: left + inset, y: top + inset },
                { name: `tr${tag}`, x: right - inset, y: top + inset },
                { name: `bl${tag}`, x: left + inset, y: bottom - inset },
                { name: `br${tag}`, x: right - inset, y: bottom - inset },
                { name: `tm${tag}`, x: midX, y: top + inset },
                { name: `bm${tag}`, x: midX, y: bottom - inset },
                { name: `lm${tag}`, x: left + inset, y: midY },
                { name: `rm${tag}`, x: right - inset, y: midY }
            ]);
            const pts: Array<{ name: string; x: number; y: number }> = [
                ...makeRing(1, "1"),
                ...makeRing(inset2, "2"),
                { name: "c", x: Math.round(screenX), y: Math.round(screenY) }
            ]
                .map((p) => ({
                    name: p.name,
                    x: clamp(p.x, maxX),
                    y: clamp(p.y, maxY)
                }))
                .filter((p, idx, arr) => arr.findIndex((q) => q.x === p.x && q.y === p.y) === idx);

            if (!renderW || !renderH || pts.length === 0) {
                applySwap();
                const screen: any = {
                    available: true,
                    source: "rendererPixel",
                    rect,
                    camera: camInfo,
                    error: "pixelProbeNoPoints",
                    bounds: { renderW, renderH }
                };
                if (fallbackReason) screen.fallbackReason = fallbackReason;
                logOnce(screen);
                return true;
            }

            const toColor = (c: any) => {
                if (!c || typeof c !== "object") return null;
                const r = (c.r ?? c.red ?? 0) | 0;
                const g = (c.g ?? c.green ?? 0) | 0;
                const b = (c.b ?? c.blue ?? 0) | 0;
                const a = (c.a ?? c.alpha ?? 255) | 0;
                const hex = "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
                return { r, g, b, a, hex };
            };

            const sampleList = (points: Array<{ name: string; x: number; y: number }>, out: any[], done: () => void, idx = 0) => {
                if (idx >= points.length) {
                    done();
                    return;
                }
                const p = points[idx];
                try {
                    rendererSnapshotPixel(p.x, p.y, (color: any) => {
                        out.push({ name: p.name, x: p.x, y: p.y, color: toColor(color) });
                        scene.time?.delayedCall?.(0, () => sampleList(points, out, done, idx + 1));
                    });
                } catch {
                    out.push({ name: p.name, x: p.x, y: p.y, color: null, error: "snapshotPixelFailed" });
                    scene.time?.delayedCall?.(0, () => sampleList(points, out, done, idx + 1));
                }
            };

            const before: any[] = [];
            const after: any[] = [];
            sampleList(pts, before, () => {
                applySwap();
                sampleList(pts, after, () => {
                    let changed = 0;
                    for (let i = 0; i < pts.length; i++) {
                        const b = before[i]?.color;
                        const a = after[i]?.color;
                        if (!b || !a) continue;
                        if (b.r !== a.r || b.g !== a.g || b.b !== a.b || b.a !== a.a) changed++;
                    }
                    const screen: any = {
                        available: true,
                        source: "rendererPixel",
                        rect,
                        camera: camInfo,
                        pixelProbe: {
                            bounds: { renderW, renderH },
                            outlineSize: { w: outW, h: outH },
                            scale: { x: probeScaleX, y: probeScaleY },
                            points: pts,
                            before,
                            after,
                            changed
                        }
                    };
                    if (fallbackReason) screen.fallbackReason = fallbackReason;
                    logOnce(screen);
                });
            });
            return true;
        };

        if (maybeLogPixelProbe()) return;

        const scheduleFallback = () => {
            const fn = () => {
                if (logged) return;
                applySwap();
                const screen: any = { available: !!snapshot, source, rect, error: "snapshotTimeout", camera: camInfo };
                if (fallbackReason) screen.fallbackReason = fallbackReason;
                logOnce(screen);
            };
            try {
                scene.time?.delayedCall?.(750, fn);
            } catch {
                try { setTimeout(fn, 750); } catch { /* ignore */ }
            }
        };

        if (!snapshot) {
            applySwap();
            const screen: any = { available: false, source, rect, camera: camInfo };
            if (fallbackReason) screen.fallbackReason = fallbackReason;
            logOnce(screen);
            return;
        }

        const captureSnapshot = (cb: (image: any) => void) => {
            try {
                if (snapshotIsFull) snapshot(cb);
                else snapshot(rect.x, rect.y, rect.w, rect.h, cb);
            } catch {
                cb(null);
            }
        };

        const extractImageData = (image: any, useFull: boolean, cropRect?: { x: number; y: number; w: number; h: number }) => {
            const iw = (image?.width ?? image?.naturalWidth ?? rect.w) | 0;
            const ih = (image?.height ?? image?.naturalHeight ?? rect.h) | 0;
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, iw);
            canvas.height = Math.max(1, ih);
            const ctx = canvas.getContext("2d");
            if (!ctx) return null;
            ctx.drawImage(image, 0, 0);
            let rx = 0;
            let ry = 0;
            let rw = rect.w;
            let rh = rect.h;
            if (useFull) {
                if (cropRect) {
                    rx = cropRect.x | 0;
                    ry = cropRect.y | 0;
                    rw = cropRect.w | 0;
                    rh = cropRect.h | 0;
                } else {
                    rx = rect.x | 0;
                    ry = rect.y | 0;
                    rw = rect.w | 0;
                    rh = rect.h | 0;
                }
                if (rx < 0) { rw += rx; rx = 0; }
                if (ry < 0) { rh += ry; ry = 0; }
                if (rx + rw > iw) rw = iw - rx;
                if (ry + rh > ih) rh = ih - ry;
                rw = Math.max(1, rw);
                rh = Math.max(1, rh);
            }
            const img = ctx.getImageData(rx, ry, rw, rh);
            return { img, rect: { x: rx, y: ry, w: rw, h: rh } };
        };

        scheduleFallback();
        captureSnapshot((image: any) => {
            try {
                if (!image) {
                    applySwap();
                    const screen: any = { available: true, source, rect, error: "noImageBefore", camera: camInfo };
                    if (fallbackReason) screen.fallbackReason = fallbackReason;
                    logOnce(screen);
                    return;
                }
                const beforeExtract = extractImageData(image, snapshotIsFull);
                if (!beforeExtract) {
                    applySwap();
                    const screen: any = { available: true, source, rect, error: "noCtxBefore", camera: camInfo };
                    if (fallbackReason) screen.fallbackReason = fallbackReason;
                    logOnce(screen);
                    return;
                }
                if (snapshotIsFull && beforeExtract.rect) rect = beforeExtract.rect;
                const beforeStats = __summarizeRawData(beforeExtract.img.data, rect.w, rect.h);
                const beforeData = beforeExtract.img.data.slice(0);
                applySwap();
                scene.time?.delayedCall?.(0, () => {
                    captureSnapshot((image2: any) => {
                        try {
                            if (!image2) {
                                const screen: any = { available: true, source, rect, before: beforeStats, error: "noImageAfter", camera: camInfo };
                                if (fallbackReason) screen.fallbackReason = fallbackReason;
                                logOnce(screen);
                                return;
                            }
                            const afterExtract = extractImageData(image2, snapshotIsFull, beforeExtract.rect);
                            if (!afterExtract) {
                                const screen: any = { available: true, source, rect, before: beforeStats, error: "noCtxAfter", camera: camInfo };
                                if (fallbackReason) screen.fallbackReason = fallbackReason;
                                logOnce(screen);
                                return;
                            }
                            const afterStats = __summarizeRawData(afterExtract.img.data, rect.w, rect.h);
                            let changed = 0;
                            const n = Math.min(beforeData.length, afterExtract.img.data.length);
                            for (let i = 0; i < n; i++) {
                                if (beforeData[i] !== afterExtract.img.data[i]) changed++;
                            }
                            const screen: any = {
                                available: true,
                                source,
                                rect,
                                before: beforeStats,
                                after: afterStats,
                                diff: { totalBytes: n, changedBytes: changed },
                                camera: camInfo
                            };
                            if (fallbackReason) screen.fallbackReason = fallbackReason;
                            logOnce(screen);
                        } catch { /* ignore */ }
                    });
                });
            } catch { /* ignore */ }
        });
    } catch { /* ignore */ }
}

function __getOrBuildAuraWhiteTexture(scene: Phaser.Scene, texKey: string, frameName: string): string | null {
    try {
        const img = __readFrameImageData(scene, texKey, frameName);
        const w = img.width | 0;
        const h = img.height | 0;
        const data = img.data;

        let allOpaque = true;
        let sumLum = 0;
        let minLum = 255;
        let maxLum = 0;
        const pxCount = Math.max(1, (w * h) | 0);
        for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3] | 0;
            if (a === 0) allOpaque = false;
            const r = data[i + 0] | 0;
            const g = data[i + 1] | 0;
            const b = data[i + 2] | 0;
            const lum = ((r * 54 + g * 183 + b * 19) >> 8);
            sumLum += lum;
            if (lum < minLum) minLum = lum;
            if (lum > maxLum) maxLum = lum;
        }
        const avgLum = (sumLum / pxCount);
        const isFlatLum = allOpaque && (minLum === maxLum);
        const invertLum = allOpaque && avgLum > 200 && !isFlatLum;
        const forceFull = false;

        let minX = 9999, minY = 9999, maxX = -1, maxY = -1;
        let maskCount = 0;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i + 0] | 0;
            const g = data[i + 1] | 0;
            const b = data[i + 2] | 0;
            const a = data[i + 3] | 0;
            let alpha = a;
            if (allOpaque) {
                const lum = (r * 54 + g * 183 + b * 19) >> 8;
                alpha = invertLum ? (255 - lum) : lum;
            }
            if (alpha) {
                maskCount++;
                const p = (i >> 2);
                const x = (p % w) | 0;
                const y = ((p / w) | 0);
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }

        if (forceFull) {
            minX = 0;
            minY = 0;
            maxX = w - 1;
            maxY = h - 1;
        }

        const area = Math.max(1, (w * h) | 0);
        const sparseMask = (!forceFull && (maskCount / area) < 0.25);
        const allowBoxRing = false;
        const ringThickness = allowBoxRing ? ((forceFull || sparseMask) ? 2 : 1) : 0;
        let ringPad = allowBoxRing ? ((forceFull || sparseMask) ? 2 : 1) : 0;
        if (allowBoxRing && ringPad < ringThickness) ringPad = ringThickness;

        const ringMode = allowBoxRing ? (forceFull ? "full" : (sparseMask ? "sparse" : "normal")) : "none";
        const cacheKey = `${texKey}::${frameName}::white::box${ringPad}::t${ringThickness}::m${ringMode}`;
        const cached = __outlineAuraWhiteCache.get(cacheKey);
        if (cached && scene.textures.exists(cached)) return cached;

        const outKey = `__auraWhite__${texKey}::${frameName}::box${ringPad}::t${ringThickness}::m${ringMode}`;
        const outW = w + (ringPad * 2);
        const outH = h + (ringPad * 2);
        if (scene.textures.exists(outKey)) {
            __outlineAuraWhiteCache.set(cacheKey, outKey);
            return outKey;
        }

        const ctex = scene.textures.createCanvas(outKey, outW, outH);
        const canvas = ctex.getSourceImage() as any;
        const ctx = canvas.getContext("2d", { willReadFrequently: true } as any);
        if (!ctx) return null;

        const out = ctx.createImageData(outW, outH);
        const outData = out.data;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i + 0] | 0;
            const g = data[i + 1] | 0;
            const b = data[i + 2] | 0;
            const a = data[i + 3] | 0;
            let alpha = a;
            if (allOpaque) {
                // Aura sheets may be opaque with black background. Use luminance as alpha.
                const lum = (r * 54 + g * 183 + b * 19) >> 8;
                alpha = invertLum ? (255 - lum) : lum;
            }
            if (alpha) {
                const p = (i >> 2);
                const x = (p % w) | 0;
                const y = ((p / w) | 0);

                const ox = x + ringPad;
                const oy = y + ringPad;
                const outIndex = (oy * outW + ox) * 4;
                outData[outIndex + 0] = 255;
                outData[outIndex + 1] = 255;
                outData[outIndex + 2] = 255;
                outData[outIndex + 3] = alpha;
            }
        }

        if (allowBoxRing && ringThickness > 0 && maxX >= minX) {
            const useFullBounds = forceFull || sparseMask;
            const baseLeft = (useFullBounds ? 0 : Math.max(0, minX - 1)) + ringPad;
            const baseRight = (useFullBounds ? (w - 1) : Math.min(w - 1, maxX + 1)) + ringPad;
            const baseTop = (useFullBounds ? 0 : Math.max(0, minY - 1)) + ringPad;
            const baseBottom = (useFullBounds ? (h - 1) : Math.min(h - 1, maxY + 1)) + ringPad;
            const expand = ringPad;
            const outerLeft = Math.max(0, baseLeft - expand);
            const outerRight = Math.min(outW - 1, baseRight + expand);
            const outerTop = Math.max(0, baseTop - expand);
            const outerBottom = Math.min(outH - 1, baseBottom + expand);
            for (let t = 0; t < ringThickness; t++) {
                const left = Math.max(0, outerLeft + t);
                const right = Math.min(outW - 1, outerRight - t);
                const top = Math.max(0, outerTop + t);
                const bottom = Math.min(outH - 1, outerBottom - t);
                if (right < left || bottom < top) break;
                for (let x = left; x <= right; x++) {
                    let i = (top * outW + x) * 4;
                    outData[i + 0] = 255; outData[i + 1] = 255; outData[i + 2] = 255; outData[i + 3] = 255;
                    i = (bottom * outW + x) * 4;
                    outData[i + 0] = 255; outData[i + 1] = 255; outData[i + 2] = 255; outData[i + 3] = 255;
                }
                for (let y = top; y <= bottom; y++) {
                    let i = (y * outW + left) * 4;
                    outData[i + 0] = 255; outData[i + 1] = 255; outData[i + 2] = 255; outData[i + 3] = 255;
                    i = (y * outW + right) * 4;
                    outData[i + 0] = 255; outData[i + 1] = 255; outData[i + 2] = 255; outData[i + 3] = 255;
                }
            }
            if (forceFull) {
                if (DEBUG_PROP_OUTLINE_VERBOSE) console.log("[AURA][PROPS] flat aura frame; forced outward box ring", {
                    texKey,
                    frameName,
                    w,
                    h,
                    ringPad,
                    minLum,
                    maxLum,
                    avgLum: Math.round(avgLum)
                });
            }
        }

        ctx.putImageData(out, 0, 0);
        ctex.refresh();
        if (!forceFull && allOpaque && invertLum) {
            if (DEBUG_PROP_OUTLINE_VERBOSE) console.log("[AURA][PROPS] opaque aura detected; using inverted luminance", {
                texKey,
                frameName,
                minLum,
                maxLum,
                avgLum: Math.round(avgLum)
            });
        }
        __outlineAuraWhiteCache.set(cacheKey, outKey);
        return outKey;
    } catch {
        return null;
    }
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
    if (DEBUG_EFFECT_MASKS && !__effectMaskStatsOnce.has(key)) {
        __effectMaskStatsOnce.add(key);
        let maskCount = 0;
        const bits = entry.bits;
        for (let i = 0; i < bits.length; i++) {
            maskCount += __countBits32(bits[i] >>> 0);
        }
        const area = Math.max(1, (entry.w | 0) * (entry.h | 0));
        const ratio = maskCount / area;
        console.log("[effectmask][maskStats]", {
            key,
            texKey,
            frame: frameName,
            radius: r | 0,
            w: entry.w | 0,
            h: entry.h | 0,
            maskCount,
            ratio: +ratio.toFixed(4)
        });
    }
    return entry;
}

// Exported: get/build and cache 1-bit mask for a specific native frame object.
export function getOrBuildHeroAuraMaskBitsForFrame(
    scene: Phaser.Scene,
    frame: Phaser.Textures.Frame,
    r: number,
    texKeyOverride?: string
): MaskEntry {
    const texKey = texKeyOverride || (frame as any).texture?.key || "";
    const frameName = (frame as any).name !== undefined ? String((frame as any).name) : "__BASE";
    const key = __maskKey(texKey, frameName, r);
    const hit = __auraMaskCache.get(key);
    if (hit) return hit;

    let img: ImageData;
    try {
        img = __readFrameImageDataFromFrame(frame);
    } catch (err) {
        // Fallback to texture lookup when the frame source isn't directly readable.
        img = __readFrameImageData(scene, texKey, frameName);
        if (DEBUG_EFFECT_MASKS && !__effectMaskStatsOnce.has(key)) {
            __effectMaskStatsOnce.add(key);
            console.warn("[effectmask][frameFallback]", {
                key,
                texKey,
                frame: frameName,
                radius: r | 0,
                err: String((err as any)?.message || err || "unknown")
            });
        }
    }
    const entry = __buildDilatedMaskBitsFromImage(img, r);
    __auraMaskCache.set(key, entry);
    if (DEBUG_EFFECT_MASKS && !__effectMaskStatsOnce.has(key)) {
        __effectMaskStatsOnce.add(key);
        let maskCount = 0;
        const bits = entry.bits;
        for (let i = 0; i < bits.length; i++) {
            maskCount += __countBits32(bits[i] >>> 0);
        }
        const area = Math.max(1, (entry.w | 0) * (entry.h | 0));
        const ratio = maskCount / area;
        console.log("[effectmask][maskStats]", {
            key,
            texKey,
            frame: frameName,
            radius: r | 0,
            w: entry.w | 0,
            h: entry.h | 0,
            maskCount,
            ratio: +ratio.toFixed(4)
        });
    }
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

    const auraRadius = pickAuraRadius(radius);
    const auraTexKey = auraKey(heroTexKey, auraRadius);

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
    auraColorIndex: number,
    auraRadius?: number
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

        const requestedRadius = (typeof auraRadius === "number" && isFinite(auraRadius))
            ? (auraRadius | 0)
            : DEFAULT_AURA_RADIUS;
        const radius = pickAuraRadius(requestedRadius);
        const auraTexKey = auraKey(heroTexKey, radius);

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

// Generic outline helper for non-hero focus highlights (Phaser-side).
export function syncOutlineForNative(
    native: any,
    active: boolean,
    colorIndex: number,
    radius: number,
    depthBias: number
): void {
    try {
        if (!native) return;

        const scene: Phaser.Scene | undefined = (globalThis as any).__phaserScene;
        if (!scene) return;

          const outlineAny: any = (native as any).__focusOutlineImage;
          const forceOutlineBuild = !!(native as any).__forceOutlineBuild;
          const restoreSwap = () => {
              const origKey = (native as any).__outlineSwapOrigKey;
              const origFrame = (native as any).__outlineSwapOrigFrame;
              if (origKey) {
                  try { native.setTexture(origKey, origFrame ?? origKey); } catch { /* ignore */ }
              }
              const origTint = (native as any).__outlineSwapOrigTint;
              const hadTint = (native as any).__outlineSwapHadTint;
              try {
                  if (hadTint) native.setTint(origTint ?? 0xffffff);
                  else native.clearTint?.();
              } catch { /* ignore */ }
              try {
                  const baseSX = (native as any).__outlineSwapOrigScaleX;
                  const baseSY = (native as any).__outlineSwapOrigScaleY;
                  if (typeof baseSX === "number") native.scaleX = baseSX;
                  if (typeof baseSY === "number") native.scaleY = baseSY;
              } catch { /* ignore */ }
              (native as any).__outlineSwapOrigKey = null;
              (native as any).__outlineSwapOrigFrame = null;
              (native as any).__outlineSwapOrigTint = null;
              (native as any).__outlineSwapHadTint = null;
              (native as any).__outlineSwapOrigScaleX = null;
              (native as any).__outlineSwapOrigScaleY = null;
              (native as any).__outlineSwapApplied = null;
          };
          if (!forceOutlineBuild && (native as any).__outlineSwapOrigKey) {
              restoreSwap();
          }
          if (!active) {
              if (forceOutlineBuild) {
                  restoreSwap();
              }
              if (outlineAny) outlineAny.setVisible(false);
              return;
          }

        const texKey = native.texture?.key ? String(native.texture.key) : "";
        if (!texKey) return;

        const frameName =
            (native.frame && (native.frame.name !== undefined))
                ? native.frame.name
                : undefined;
        if (frameName === undefined) return;

          const requestedRadius = (radius | 0) > 0 ? (radius | 0) : DEFAULT_AURA_RADIUS;
          const auraRadius = pickAuraRadius(requestedRadius);
          let outlineTexKey = "";
          let useFrameName = true;
          if (forceOutlineBuild) {
              throw new Error("[AURA] forceOutlineBuild is disabled; precomputed auras required.");
          }
          const canUseAuraSheet = true;
          const auraTexKey = auraKey(texKey, auraRadius);
          if (!scene.textures.exists(auraTexKey)) {
              throw new Error(
                  `[AURA-MISSING] Texture not loaded: ${auraTexKey}. Run: npm run gen-auras`
              );
          }
          const auraTex = scene.textures.get(auraTexKey);
          const auraFrame = auraTex.get(frameName as any);
          if (!auraFrame) {
              throw new Error(
                  `[AURA-FRAME-MISSING] ${auraTexKey} missing frame=${String(frameName)} (baseTex=${texKey})`
              );
          }
          if (canUseAuraSheet) {
                const auraFrameName = frameName as any;
                if (auraFrameName !== undefined) {
                    const alphaKey = auraTexKey + "::" + String(frameName);
                    let hasAlpha = __outlineAuraFrameHasAlpha.get(alphaKey);
                    if (hasAlpha === undefined) {
                        hasAlpha = false;
                          let alphaCount = 0;
                          let maxAlpha = 0;
                          let sumR = 0;
                          let sumG = 0;
                          let sumB = 0;
                          let minX = 9999, minY = 9999, maxX = -1, maxY = -1;
                          let allOpaque = true;
                          let maskCount = 0;
                          let minLum = 255;
                          let maxLum = 0;
                          let flatLum = false;
                          try {
                              const img = __readFrameImageData(scene, auraTexKey, String(frameName));
                              const data = img.data;
                              const w = img.width | 0;
                              const h = img.height | 0;
                              for (let i = 3; i < data.length; i += 4) {
                                  const p = (i - 3) >> 2;
                                  const r = data[i - 3] | 0;
                                  const g = data[i - 2] | 0;
                                  const b = data[i - 1] | 0;
                                  sumR += r;
                                  sumG += g;
                                  sumB += b;
                                  const a = data[i] | 0;
                                  if (a === 0) allOpaque = false;
                                  if (a > 0) {
                                      alphaCount++;
                                      if (a > maxAlpha) maxAlpha = a;
                                  }
                                  const lum = (r * 54 + g * 183 + b * 19) >> 8;
                                  if (lum < minLum) minLum = lum;
                                  if (lum > maxLum) maxLum = lum;
                              }
                              if (allOpaque) {
                                  for (let i = 0; i < data.length; i += 4) {
                                      const p = (i >> 2);
                                      const r = data[i + 0] | 0;
                                      const g = data[i + 1] | 0;
                                      const b = data[i + 2] | 0;
                                      const lum = (r * 54 + g * 183 + b * 19) >> 8;
                                      if (lum > 0) {
                                          hasAlpha = true;
                                          maskCount++;
                                          const x = (p % w) | 0;
                                          const y = ((p / w) | 0);
                                          if (x < minX) minX = x;
                                          if (y < minY) minY = y;
                                          if (x > maxX) maxX = x;
                                          if (y > maxY) maxY = y;
                                      }
                                  }
                              } else if (alphaCount > 0) {
                                  hasAlpha = true;
                                  for (let i = 3; i < data.length; i += 4) {
                                      const a = data[i] | 0;
                                      if (a > 0) {
                                          const p = (i - 3) >> 2;
                                          const x = (p % w) | 0;
                                          const y = ((p / w) | 0);
                                          if (x < minX) minX = x;
                                          if (y < minY) minY = y;
                                          if (x > maxX) maxX = x;
                                          if (y > maxY) maxY = y;
                                      }
                                  }
                              }
                              flatLum = (allOpaque && minLum === maxLum);
                              if (flatLum) {
                                  // Still treat as valid so we can force a ring mask for flat frames.
                                  hasAlpha = true;
                              }
                          } catch { /* ignore */ }
                          __outlineAuraFrameHasAlpha.set(alphaKey, hasAlpha);
                          const totalPx = Math.max(1, (32 * 32));
                          __outlineAuraFrameStats.set(alphaKey, {
                              alphaCount,
                              maxAlpha,
                              avgR: Math.round(sumR / totalPx),
                              avgG: Math.round(sumG / totalPx),
                              avgB: Math.round(sumB / totalPx),
                              maskCount,
                              allOpaque,
                              minLum,
                              maxLum,
                              flatLum,
                              minX,
                              minY,
                              maxX,
                              maxY
                          });
                    }

                      if (hasAlpha) {
                          // Force a white mask from aura alpha so tinting always works.
                          const whiteKey = __getOrBuildAuraWhiteTexture(scene, auraTexKey, String(frameName));
                          if (whiteKey) {
                              outlineTexKey = whiteKey;
                              useFrameName = false;
                              if (DEBUG_PROP_OUTLINE_VERBOSE) console.log("[AURA][PROPS] using white aura mask (forced)", { auraTexKey, frameName, whiteKey });
                          } else {
                              outlineTexKey = auraTexKey;
                          }
                          if (!__outlineAuraLogOnce.has(auraTexKey)) {
                              __outlineAuraLogOnce.add(auraTexKey);
                              if (DEBUG_PROP_OUTLINE_VERBOSE) console.log("[AURA][PROPS] using aura sheet", { texKey, auraTexKey });
                          }
                          const stats = __outlineAuraFrameStats.get(alphaKey);
                          if (DEBUG_PROP_OUTLINE_VERBOSE) console.log("[AURA][PROPS] aura pixels detected", {
                              texKey,
                              auraTexKey,
                              frame: frameName,
                              alphaCount: stats?.alphaCount ?? 0,
                              maskCount: stats?.maskCount ?? 0,
                              allOpaque: !!stats?.allOpaque,
                              minLum: stats?.minLum ?? 0,
                              maxLum: stats?.maxLum ?? 0,
                              flatLum: !!stats?.flatLum
                          });
                          if (DEBUG_PROP_OUTLINE_VERBOSE) console.log("[AURA][PROPS] aura frame ok", {
                              texKey,
                              auraTexKey,
                              frame: frameName,
                              w: (auraFrame?.width ?? 0) | 0,
                              h: (auraFrame?.height ?? 0) | 0,
                              alphaCount: stats?.alphaCount ?? 0,
                              maxAlpha: stats?.maxAlpha ?? 0,
                              avgRGB: stats ? { r: stats.avgR, g: stats.avgG, b: stats.avgB } : null,
                              maskCount: stats?.maskCount ?? 0,
                              allOpaque: !!stats?.allOpaque,
                              minLum: stats?.minLum ?? 0,
                              maxLum: stats?.maxLum ?? 0,
                              flatLum: !!stats?.flatLum,
                              bb: stats ? { minX: stats.minX, minY: stats.minY, maxX: stats.maxX, maxY: stats.maxY } : null
                          });
                      } else {
                          throw new Error(
                              `[AURA-FRAME-EMPTY] ${auraTexKey} has no opaque pixels for frame=${String(frameName)}`
                          );
                      }
                  }
        }

          if (!outlineTexKey) {
              throw new Error(
                  `[AURA-MISSING] No outline texture available for ${texKey} frame=${String(frameName)} (aura=${auraTexKey})`
              );
          }

          let outlineImg: Phaser.GameObjects.Image;
          const baseFrameName = "__BASE";
          const forceRecreate = canUseAuraSheet;
          if (forceRecreate && outlineAny && (outlineAny as any).scene) {
              try { outlineAny.destroy?.(); } catch { /* ignore */ }
              (native as any).__focusOutlineImage = null;
          }

          if (!outlineAny || !(outlineAny as any).scene || forceRecreate) {
              // Match hero aura path: use Image for outlines.
              const newObj = scene.add.image(
                  native.x,
                  native.y,
                  outlineTexKey,
                  useFrameName ? (frameName as any) : baseFrameName
              );
              outlineImg = newObj as any;
              (native as any).__focusOutlineImage = outlineImg;

              if (typeof native.originX === "number" && typeof native.originY === "number") {
                  outlineImg.setOrigin(native.originX, native.originY);
              }
          } else {
              outlineImg = outlineAny as Phaser.GameObjects.Image;
              outlineImg.setTexture(outlineTexKey, useFrameName ? (frameName as any) : baseFrameName);
          }

        // Ensure Sprite outline doesn't try to play animations
        try { (outlineImg as any).anims?.stop?.(); } catch { /* ignore */ }

          outlineImg.x = native.x;
          outlineImg.y = native.y;

          if (outlineImg && DEBUG_PROP_OUTLINE_VERBOSE) {
              const g: any = globalThis as any;
              const k = `__outlineRenderProbeOnce__${String(texKey)}::${String(frameName)}`;
              if (!g[k]) {
                  g[k] = 1;
                  try {
                      // Confirm the outline object has nonzero bounds.
                      const b = (outlineImg as any).getBounds ? (outlineImg as any).getBounds() : null;
                      console.log("[AURA][PROPS][RENDER-PROBE]", {
                          texKey: String(texKey),
                          frameName: String(frameName),
                          forceOutlineBuild,
                          outlineClass: outlineImg?.constructor?.name ?? "",
                          hasTexture: !!(outlineImg as any).texture?.key,
                          width: (outlineImg as any).width ?? 0,
                          height: (outlineImg as any).height ?? 0,
                          displayWidth: (outlineImg as any).displayWidth ?? 0,
                          displayHeight: (outlineImg as any).displayHeight ?? 0,
                          bounds: b ? { x: b.x | 0, y: b.y | 0, w: b.width | 0, h: b.height | 0 } : null
                      });
                  } catch { /* ignore */ }
              }
          }

          const baseDepth = (native as any).depth ?? 0;
            let outlineDepth = (baseDepth + (depthBias | 0)) | 0;
            if (forceOutlineBuild) outlineDepth = baseDepth + 1000;
            const isRingTex = String(outlineTexKey).includes("::ring");
            if (isRingTex) outlineDepth = 9999999;
            if (DEBUG_PROP_OUTLINE_EXAGGERATE && canUseAuraSheet && !forceOutlineBuild) {
                outlineDepth = 9999999;
            }
            outlineImg.setDepth(outlineDepth);

        const outlineFrameName = useFrameName ? String(frameName) : "__BASE";
        let shouldLogOnce = false;
        if (!forceOutlineBuild && DEBUG_PROP_OUTLINE_ONELOG) {
            try {
                const g: any = globalThis as any;
                const k = `__propOutlineOneLog__${String(texKey)}::${String(frameName)}`;
                shouldLogOnce = !g[k];
            } catch { /* ignore */ }
        }
        if (shouldLogOnce) {
            outlineImg.setVisible(false);
            __scheduleScreenSampleProbe(
                scene,
                native,
                String(texKey),
                String(frameName),
                outlineTexKey,
                outlineFrameName,
                () => {
                    outlineImg.setVisible(true);
                }
            );
        } else {
            outlineImg.setVisible(true);
        }
        outlineImg.alpha = 1;

          outlineImg.scaleX = native.scaleX ?? 1;
          outlineImg.scaleY = native.scaleY ?? 1;
          if (!forceOutlineBuild && (canUseAuraSheet && FORCE_PROP_SCALE_OUTLINE)) {
              const fw = (native.frame?.width ?? 0) | 0;
              const fh = (native.frame?.height ?? 0) | 0;
              if (fw > 0 && fh > 0) {
                  const sx = (fw + 4) / fw;
                  const sy = (fh + 4) / fh;
                  outlineImg.scaleX = (native.scaleX ?? 1) * sx;
                  outlineImg.scaleY = (native.scaleY ?? 1) * sy;
              }
          }
          if (isRingTex) {
              outlineImg.scaleX = (native.scaleX ?? 1) * 3;
              outlineImg.scaleY = (native.scaleY ?? 1) * 3;
          }
          if (DEBUG_PROP_OUTLINE_EXAGGERATE && canUseAuraSheet && !forceOutlineBuild) {
              const boost = 2;
              outlineImg.scaleX = (outlineImg.scaleX ?? 1) * boost;
              outlineImg.scaleY = (outlineImg.scaleY ?? 1) * boost;
              outlineImg.alpha = 1;
          }
        outlineImg.rotation = native.rotation ?? 0;
        if (typeof (outlineImg as any).setScrollFactor === "function") {
            (outlineImg as any).setScrollFactor(native.scrollFactorX ?? 1, native.scrollFactorY ?? 1);
        }
          if (!canUseAuraSheet) {
              try {
                  (outlineImg as any).setBlendMode?.((Phaser as any)?.BlendModes?.NORMAL ?? 0);
                  (outlineImg as any).setPipeline?.("TextureTintPipeline");
                  (outlineImg as any).cameraFilter = 0;
                  (outlineImg as any).renderFlags = 15;
              } catch { /* ignore */ }
          }

        if (typeof (outlineImg as any).setFlipX === "function") {
            (outlineImg as any).setFlipX(!!native.flipX);
        }
        if (typeof (outlineImg as any).setFlipY === "function") {
            (outlineImg as any).setFlipY(!!native.flipY);
        }

          if (typeof outlineImg.setTint === "function") {
              const tintHex = __tintForArcadeColorIndex(colorIndex | 0);
              if (tintHex !== 0) outlineImg.setTint(tintHex);
              else outlineImg.clearTint();
              if (isRingTex) outlineImg.setTint(0xff00ff);
              if (forceOutlineBuild) outlineImg.setTint(0xffffff);
              if (DEBUG_PROP_OUTLINE_EXAGGERATE && canUseAuraSheet && !forceOutlineBuild) {
                  outlineImg.setTint(DEBUG_PROP_OUTLINE_EXAGGERATE_TINT);
                  outlineImg.alpha = 1;
                  try { (outlineImg as any).setBlendMode?.((Phaser as any)?.BlendModes?.ADD ?? 1); } catch { /* ignore */ }
              }
          }

          if (canUseAuraSheet) {
              // If the prop is in a container, move the outline into the same container.
              try {
                  const parent = (native as any)?.parentContainer;
                  if (parent) {
                      parent.add(outlineImg);
                      if (DEBUG_PROP_OUTLINE_EXAGGERATE && typeof parent.bringToTop === "function") {
                          parent.bringToTop(outlineImg);
                      }
                  }
              } catch { /* ignore */ }

              // Minimal one-time proof log (no debug visuals).
              if (DEBUG_PROP_OUTLINE_VERBOSE) {
                  try {
                      const anyImg: any = outlineImg as any;
                      if (!anyImg.__focusOutlineOnce) {
                          anyImg.__focusOutlineOnce = true;
                          console.log("[AURA][PROPS][FINAL]", {
                              outlineTexKey: outlineImg.texture?.key ?? "",
                              outlineFrame: outlineImg.frame?.name ?? "",
                              x: outlineImg.x | 0,
                              y: outlineImg.y | 0,
                              depth: (outlineImg as any).depth ?? 0,
                              visible: !!(outlineImg as any).visible,
                              alpha: outlineImg.alpha,
                              isSprite: typeof (outlineImg as any).anims?.stop === "function",
                              outlineSize: {
                                  w: (outlineImg as any).width ?? 0,
                                  h: (outlineImg as any).height ?? 0,
                                  dw: (outlineImg as any).displayWidth ?? 0,
                                  dh: (outlineImg as any).displayHeight ?? 0,
                                  sx: (outlineImg as any).scaleX ?? 1,
                                  sy: (outlineImg as any).scaleY ?? 1
                              },
                              outlineBlend: (outlineImg as any).blendMode ?? 0,
                              outlinePipeline: (outlineImg as any).pipeline?.name ?? "",
                              outlineCamFilter: (outlineImg as any).cameraFilter ?? 0,
                              outlineMask: !!(outlineImg as any).mask,
                              nativeTexKey: native.texture?.key ?? "",
                              nativeFrame: native.frame?.name ?? "",
                              nativeX: native.x | 0,
                              nativeY: native.y | 0,
                              nativeDepth: (native as any).depth ?? 0,
                              nativeVisible: !!(native as any).visible,
                              nativeAlpha: (native as any).alpha ?? 1,
                              nativeSize: {
                                  w: (native as any).width ?? 0,
                                  h: (native as any).height ?? 0,
                                  dw: (native as any).displayWidth ?? 0,
                                  dh: (native as any).displayHeight ?? 0,
                                  sx: (native as any).scaleX ?? 1,
                                  sy: (native as any).scaleY ?? 1
                              },
                              nativeScale: {
                                  x: (native.scaleX ?? 1),
                                  y: (native.scaleY ?? 1)
                              },
                              nativeScrollFactor: {
                                  x: (native.scrollFactorX ?? 1),
                                  y: (native.scrollFactorY ?? 1)
                              },
                              outlineScrollFactor: {
                                  x: (outlineImg as any).scrollFactorX ?? 1,
                                  y: (outlineImg as any).scrollFactorY ?? 1
                              },
                              nativeHasParent: !!(native as any).parentContainer,
                              outlineHasParent: !!(outlineImg as any).parentContainer,
                              nativeInDisplayList: !!(native as any).displayList,
                              outlineInDisplayList: !!(outlineImg as any).displayList,
                              sceneKey: scene?.sys?.settings?.key ?? "",
                              nativeSceneKey: (native as any).scene?.sys?.settings?.key ?? ""
                          });
                      }
                  } catch { /* ignore */ }
              }
          }
    } catch (e) {
        if (e instanceof Error && String(e.message || "").includes("[AURA-")) {
            throw e;
        }
        // Non-critical: focus outline should never crash the game loop.
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

    const auraRadius = pickAuraRadius(radius);
    const auraTexKey = auraKey(heroTexKey, auraRadius);
    if (!scene.textures.exists(auraTexKey)) return 0;

    const frameName = (native.frame && (native.frame.name !== undefined)) ? native.frame.name : undefined;
    const auraTex = scene.textures.get(auraTexKey);
    const af = (frameName !== undefined) ? auraTex.get(frameName as any) : null;
    if (!af) return 0;

    const w = af.width | 0;
    const h = af.height | 0;

    // Inner radius ≈ half of aura frame minus the halo thickness
    const inner = Math.floor(Math.min(w, h) / 2) - (auraRadius | 0);
    return inner > 0 ? inner : 0;
}

const __spriteTipCache = new Map<string, { dx: number; dy: number }>();

export function getSpriteTipOffsetForNativeVec(
    native: Phaser.GameObjects.Sprite,
    dirKey: string,
    nx: number,
    ny: number
): { dx: number; dy: number } | null {
    const scene: Phaser.Scene | undefined = (globalThis as any).__phaserScene;
    if (!scene || !native) return null;
    if (!dirKey || (!nx && !ny)) return null;

    const texKey = native.texture?.key ? String(native.texture.key) : "";
    if (!texKey) return null;
    const frameName =
        (native.frame && (native.frame.name !== undefined))
            ? String(native.frame.name)
            : "";
    if (!frameName) return null;

    const ox = (typeof native.originX === "number") ? native.originX : 0.5;
    const oy = (typeof native.originY === "number") ? native.originY : 0.5;
    const key = `${texKey}|${frameName}|${dirKey}|${Math.round(ox * 1000)}|${Math.round(oy * 1000)}`;
    const cached = __spriteTipCache.get(key);
    if (cached) return cached;

    const img = __readFrameImageData(scene, texKey, frameName);
    const w = img.width | 0;
    const h = img.height | 0;
    if (w <= 0 || h <= 0) return null;

    const data = img.data;
    let bestDot = -1e9;
    let bestDx = 0;
    let bestDy = 0;
    for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
            const i = (row + x) * 4;
            const a = data[i + 3] | 0;
            if (a <= 0) continue;
            const px = (x + 0.5) - (ox * w);
            const py = (y + 0.5) - (oy * h);
            const dot = (px * nx) + (py * ny);
            if (dot > bestDot) {
                bestDot = dot;
                bestDx = px;
                bestDy = py;
            }
        }
    }

    if (bestDot <= -1e8) return null;

    let dx = bestDx;
    let dy = bestDy;
    const sx = (typeof native.scaleX === "number") ? native.scaleX : 1;
    const sy = (typeof native.scaleY === "number") ? native.scaleY : 1;
    dx *= sx;
    dy *= sy;
    if ((native as any).flipX) dx = -dx;
    if ((native as any).flipY) dy = -dy;

    const out = { dx, dy };
    __spriteTipCache.set(key, out);
    return out;
}



// ----------------------------------------------------------
//  Simple debug / smoke-test entry point
// ----------------------------------------------------------

export interface DebugHeroAnimOptions {
    heroName?: string;
    family?: "strength" | "agility" | "intelligence" | "support" | "wisdom";
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
