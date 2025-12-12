// src/heroAnimGlue.ts
import type Phaser from "phaser";
import type { HeroDir, HeroPhase, HeroAnimSet } from "./heroAtlas";
import {
    getHeroAtlasFromScene,
    findHeroAnimSet,
    HERO_FRAME_W,
    HERO_FRAME_H,
    HERO_SHEET_COLS
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

// Global + per-file logging flag
const HERO_GLUE_DEBUG = {
    enabled: true
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

/**
 * Read and normalize the animation request from a hero sprite.
 */
function readHeroAnimRequest(sprite: Phaser.GameObjects.Sprite): {
    heroName: string | undefined;
    family: string | undefined;
    phase: HeroPhase | null;
    dir: HeroDir;
} {
    const anySprite = sprite as any;
    const scene = sprite.scene;

    const heroName = anySprite.getData
        ? (anySprite.getData(HERO_NAME_KEY) as string | undefined)
        : undefined;
    const family = anySprite.getData
        ? (anySprite.getData(HERO_FAMILY_KEY) as string | undefined)
        : undefined;
    const phaseRaw = anySprite.getData
        ? (anySprite.getData(HERO_PHASE_KEY) as string | undefined)
        : undefined;
    const dirRaw = anySprite.getData
        ? (anySprite.getData(HERO_DIR_KEY) as string | undefined)
        : undefined;

    // Local normalization (mirrors heroAtlas.normalizeHeroPhase)
    const phase = ((): HeroPhase | null => {
        if (!phaseRaw) return null;
        const p = String(phaseRaw).toLowerCase();
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
        if (p === "combatidle" || p === "combat_idle" || p === "combat-idle") return "combatIdle";
        if (p === "onehandslash" || p === "1handslash") return "oneHandSlash";
        if (p === "onehandbackslash" || p === "1handbackslash") return "oneHandBackslash";
        if (p === "onehandhalfslash" || p === "1handhalfslash" || p === "halfslash") return "oneHandHalfslash";
        if (p === "thrustoversize") return "thrustOversize";
        if (p === "slashoversize") return "slashOversize";
        return null;
    })();

    const dir: HeroDir = ((): HeroDir => {
        if (!dirRaw) return "down";
        const d = String(dirRaw).toLowerCase();
        if (d === "up" || d === "n" || d === "north") return "up";
        if (d === "down" || d === "s" || d === "south") return "down";
        if (d === "left" || d === "w" || d === "west") return "left";
        if (d === "right" || d === "e" || d === "east") return "right";
        return "down";
    })();

    logGlue(scene, "readHeroAnimRequest", {
        heroName,
        family,
        phaseRaw,
        normalizedPhase: phase,
        dirRaw,
        normalizedDir: dir
    });

    return { heroName, family, phase, dir };
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
function getEffectivePhaseForSet(set: HeroAnimSet, phase: HeroPhase): HeroPhase {
    // 1) Map run → walk if run is not defined but walk is.
    if (phase === "run") {
        const runMap = set.phases["run"];
        if (!runMap || Object.keys(runMap).length === 0) {
            const walkMap = set.phases["walk"];
            if (walkMap && Object.keys(walkMap).length > 0) {
                return "walk";
            }
        }
    }

    // 2) Prefer oversize thrust/slash if defined
    if (phase === "thrust" || phase === "slash") {
        const oversizePhase: HeroPhase = (phase === "thrust" ? "thrustOversize" : "slashOversize");
        const overMap = set.phases[oversizePhase];
        if (overMap && Object.keys(overMap).length > 0) {
            return oversizePhase;
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

// ---------------------------------------------------------------------------
// Core glue: internal worker with a flag to avoid infinite fallback recursion
// ---------------------------------------------------------------------------

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

    const { heroName, family, phase, dir } = readHeroAnimRequest(sprite);
    if (!heroName || !family || !phase) {
        logGlue(scene, "applyHeroAnimationForSprite: missing heroName/family/phase", {
            heroName,
            family,
            phase
        });
        return;
    }

    const set = findHeroAnimSet(atlas, heroName, family);
    if (!set) {
        logGlue(scene, "applyHeroAnimationForSprite: no HeroAnimSet for hero + family", {
            heroName,
            family
        });
        return;
    }

    const anySprite = sprite as any;

    // NEW: pick the best concrete phase (run→walk, thrust/slash→oversize if available)
    const effectivePhase = getEffectivePhaseForSet(set, phase);

    const dirMap = set.phases[effectivePhase];

    // If this phase is not present in the atlas, fall back to idle once.
    if (!dirMap) {
        logGlue(scene, "applyHeroAnimationForSprite: no phase for set", {
            heroName,
            family,
            requestedPhase: phase,
            effectivePhase,
            setId: set.id
        });
        

        if (allowFallback && phase !== "idle") {
            const restPhase = getRestPhase(phase);
            if (anySprite.setData) {
                anySprite.setData(HERO_PHASE_KEY, restPhase);
            }
            logGlue(
                scene,
                "applyHeroAnimationForSprite: falling back to rest phase",
                { heroName, family, requestedPhase: phase, restPhase }
            );
            applyHeroAnimationForSpriteInternal(sprite, /*allowFallback*/ false);
        }

        return;
    }

        const def = dirMap[dir];
        if (!def) {
            logGlue(scene, "applyHeroAnimationForSprite: no dir for phase", {
                heroName,
                family,
                requestedPhase: phase,
                effectivePhase,
                requestedDir: dir,
                setId: set.id
            });

            if (allowFallback && phase !== "idle") {
                const restPhase = getRestPhase(phase);
                if (anySprite.setData) {
                    anySprite.setData(HERO_PHASE_KEY, restPhase);
                }
                logGlue(
                    scene,
                    "applyHeroAnimationForSprite: falling back (no dir) to rest phase",
                    { heroName, family, requestedPhase: phase, effectivePhase, requestedDir: dir, restPhase }
                );
                applyHeroAnimationForSpriteInternal(sprite, /*allowFallback*/ false);
            }
            return;
        }


    const lastPhase = anySprite.getData
        ? (anySprite.getData(LAST_PHASE_KEY) as HeroPhase | undefined)
        : undefined;
    const lastDir = anySprite.getData
        ? (anySprite.getData(LAST_DIR_KEY) as HeroDir | undefined)
        : undefined;

    const animKey = `hero_${set.id}_${def.phase}_${def.dir}`;

    // If nothing changed and the anim is already playing, do nothing.
    if (lastPhase === def.phase && lastDir === def.dir && sprite.anims && sprite.anims.currentAnim) {
        if (sprite.anims.currentAnim.key === animKey) {
            return;
        }
    }

    // *** THIS IS THE BIG FRAME-LEVEL LOG YOU ASKED FOR ***
    const frameDebug = formatFrameDebug(def.frameIndices);
    logGlue(
        scene,
        "resolved anim",
        `sheet=${set.id} hero=${heroName} family=${family} phase=${def.phase} dir=${def.dir} key=${animKey} fps=${def.frameRate} repeat=${def.repeat} yoyo=${def.yoyo} frames=${frameDebug}`
    );

    // Create Phaser animation on demand.
    if (!scene.anims.exists(animKey)) {
        scene.anims.create({
            key: animKey,
            frames: scene.anims.generateFrameNumbers(def.textureKey, {
                frames: def.frameIndices
            }),
            frameRate: def.frameRate,
            repeat: def.repeat,
            yoyo: def.yoyo
        });
    }

    // Remember the "rest" phase we want to go back to when this finishes.
    const restPhase = getRestPhase(def.phase);
    if (anySprite.setData) {
        anySprite.setData(HERO_REST_PHASE_KEY, restPhase);
    }

    // Play the anim
    sprite.anims.play(animKey, true);

    // Track last played phase/dir
    if (anySprite.setData) {
        anySprite.setData(LAST_ANIM_KEY, animKey);
        anySprite.setData(LAST_PHASE_KEY, def.phase);
        anySprite.setData(LAST_DIR_KEY, def.dir);
    }

    // Wire / replace the animationcomplete handler to snap back to restPhase
    const prevHandler = anySprite[HERO_ANIMCOMPLETE_HANDLER_KEY] as
        | ((anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => void)
        | undefined;

    if (prevHandler) {
        sprite.off("animationcomplete", prevHandler);
    }

    const handler = (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
        // Only care about this sprite's own animations
        if (anim.key !== animKey) return;

        const curPhase = anySprite.getData
            ? (anySprite.getData(HERO_PHASE_KEY) as HeroPhase | undefined)
            : undefined;
        const curDir = anySprite.getData
            ? (anySprite.getData(HERO_DIR_KEY) as HeroDir | undefined)
            : undefined;

        if (!curDir) return;

        const targetRestPhase =
            (anySprite.getData && (anySprite.getData(HERO_REST_PHASE_KEY) as HeroPhase | undefined)) ||
            restPhase;

        if (!targetRestPhase || curPhase === targetRestPhase) return;

        if (anySprite.setData) {
            anySprite.setData(HERO_PHASE_KEY, targetRestPhase);
            anySprite.setData(HERO_DIR_KEY, curDir);
        }

        logGlue(
            scene,
            "animationcomplete → rest",
            { heroName, family, phase: def.phase, dir: def.dir, restPhase: targetRestPhase, restDir: curDir }
        );

        // Re-apply without allowing a second fallback loop
        applyHeroAnimationForSpriteInternal(sprite, /*allowFallback*/ false);
    };

    anySprite[HERO_ANIMCOMPLETE_HANDLER_KEY] = handler;
    sprite.on("animationcomplete", handler);
}

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



// ================================================================
// Hero Aura (Phaser-side) — true silhouette outline from LPC pixels
// ================================================================

/**
 * Cache of generated outline textures:
 * key = `${textureKey}::${frameName}::r${radius}`
 */
const __heroAuraOutlineCache = new Map<string, string>();

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
    const existingTexKey = __heroAuraOutlineCache.get(cacheKey);
    if (existingTexKey && scene.textures.exists(existingTexKey)) return existingTexKey;

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
    for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
            const i = (y * cw + x) * 4;
            solid[y * cw + x] = data[i + 3] > 0 ? 1 : 0;
        }
    }

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
    return outTexKey;
}

/**
 * Sync aura for a native Phaser hero sprite.
 *
 * - auraActive=false: hides aura if present
 * - auraActive=true : ensures a TRUE outline exists, matches current hero frame, and follows the hero
 */
export function syncHeroAuraForNative(
    native: Phaser.GameObjects.Sprite,
    auraActive: boolean,
    auraColorIndex: number
): void {
    const scene = native.scene;
    const radius = 2;

    let aura = __heroAuraSpriteByHero.get(native);

    if (!auraActive) {
        if (aura) aura.setVisible(false);
        return;
    }

    // Ensure aura object exists
    if (!aura) {
        aura = scene.add.image(native.x, native.y, native.texture.key, native.frame.name);
        aura.setOrigin(native.originX, native.originY);
        // Put just behind the hero; bump this above if you want it in front.
        aura.setDepth(native.depth - 0.01);
        __heroAuraSpriteByHero.set(native, aura);
    }

    // Ensure aura uses a TRUE outline texture for the current frame
    const outlineTexKey = __getOrBuildHeroOutlineTexture(scene, native.texture.key, native.frame.name, radius);

    // If outlineTexKey == native.texture.key fallback, use frame name; otherwise outline texture is single-frame
    if (outlineTexKey === native.texture.key) {
        aura.setTexture(native.texture.key, native.frame.name);
    } else {
        aura.setTexture(outlineTexKey);
    }

    // Match transform
    aura.setVisible(true);
    aura.x = native.x;
    aura.y = native.y;
    aura.rotation = native.rotation;
    aura.scaleX = native.scaleX;
    aura.scaleY = native.scaleY;
    aura.setFlipX(native.flipX);
    aura.setFlipY(native.flipY);

    // Color + translucency
    aura.setTint(__tintForArcadeColorIndex(auraColorIndex));
    aura.setAlpha(0.85);
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
