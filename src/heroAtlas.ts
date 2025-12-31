// src/heroAtlas.ts
//URLs of NPCs for backup:
// Shopkeeper Wizard: https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=teen&body=Body_color_fur_tan&head=Human_male_fur_tan&expression=Closing_Eyes_fur_tan&furry_ears=Wolf_Ears_fur_tan&nose=Straight_nose_fur_tan&eyebrows=Thin_Eyebrows_black&hair=Cornrows_light%20brown&sleeves=Original_Shortsleeves_Overlay_black&clothes=TShirt_Buttoned_red&cape=Tattered_lavender&belt=Leather_Belt_charcoal&legs=Cuffed_Pants_gray&shoes=Basic_Shoes_white&shoes_toe=Plated_Toe_gold&weapon=Gnarled_staff_silver
// 
import type Phaser from "phaser";

export type HeroDir = "up" | "down" | "left" | "right";

/**
 * We use "phase" for heroes the same way we do for monsters,
 * but with the richer LPC animation vocabulary.
 *
 * These names deliberately match the Universal LPC generator:
 * Spellcast, Thrust, Walk, Slash, Shoot, Hurt, Climb, Idle, Jump,
 * Sit, Emote, Run, Watering, Combat Idle, etc.
 */
export type HeroPhase =
    | "cast"
    | "cast_produce"
    | "cast_drive"
    | "cast_land"
    | "thrust"
    | "walk"
    | "slash"
    | "shoot"
    | "hurt"
    | "climb"
    | "idle"
    | "jump"
    | "sit"
    | "emote"
    | "run"
    | "watering"
    | "combatIdle"
    | "oneHandSlash"
    | "oneHandBackslash"
    | "oneHandHalfslash"
    // explicit oversize phases
    | "thrustOversize"
    | "slashOversize";


    export type HeroFamily = "base" | "strength" | "agility" | "intelligence" | "support";

/**
 * One concrete animation clip for a single (phase, dir) pair
 * on a single hero sheet.
 */
export interface HeroAnimDef {
    sheetId: string;
    heroName: string;
    family: HeroFamily;

    phase: HeroPhase;
    dir: HeroDir;

    /** Phaser texture key for the spritesheet */
    textureKey: string;

    /** Frame indices inside the sheet (like monsters) */
    frameIndices: number[];

    /** Suggested playback parameters */
    frameRate: number;
    repeat: number;   // -1 = loop, 0 = play once
    yoyo: boolean;    // true = play forward then backward (for guard slash, etc.)
}

/**
 * All animations for a single hero sheet (e.g. "JasonHeroStrength").
 * We expose a canonical phase→dir mapping; "oversize" vs normal
 * is already resolved here.
 */
export interface HeroAnimSet {
    /** e.g. "JasonHeroStrength" (file base name) */
    id: string;

    /** Logical hero name, e.g. "Jason" */
    heroName: string;

    /** Move family: strength / agility / intelligence / support */
    family: HeroFamily;

    /** Texture key used when we loaded the 64×64 spritesheet */
    textureKey: string;

    /** Optional 192×192 oversize texture key (same PNG, different frame grid) */
    oversizeTextureKey?: string;

    /** Base LPC frame size; currently always 64x64 for heroes */
    frameWidth: number;
    frameHeight: number;

    /** Whether the sheet has extra oversize rows for thrust / slash */
    hasThrustOversize: boolean;
    hasSlashOversize: boolean;

    /** Canonical animations by phase+dir */
    phases: {
        [P in HeroPhase]?: Partial<Record<HeroDir, HeroAnimDef>>;
    };
}

export type HeroAtlas = Record<string, HeroAnimSet>;

// ----------------------------------------------------------
// Global hero animation debug flags
// ----------------------------------------------------------

const HERO_DEBUG_SECTION_FLAGS: Record<string, boolean> = {
    discoverSheets: true,
    classifySheet: true,
    buildSet: true,
    firstSetDump: true,
    lookup: true,
    apply: true
};

function isHeroAnimDebugEnabled(scene: Phaser.Scene): boolean {
    // Global toggle via Phaser registry; default off.
    // Set in HeroScene.create():  scene.registry.set("heroAnimDebug", true);
    return !!scene.registry.get("heroAnimDebug");
}


const HERO_ATLAS_DEBUG = {
    enabled: false //true
};

function heroAtlasDebug(scene: Phaser.Scene): boolean {
    return !!scene.registry.get("heroAnimDebug") && HERO_ATLAS_DEBUG.enabled;
}

function logHeroAtlas(scene: Phaser.Scene, msg: string): void {
    if (!heroAtlasDebug(scene)) return;
    // eslint-disable-next-line no-console
    console.log("[HeroAnim]", msg);
}

function formatHeroFrameDebug(
    frameIndices: number[],
    frameW: number,
    frameH: number,
    cols: number
): string {
    if (!frameIndices || frameIndices.length === 0) return "none";

    const parts: string[] = [];
    for (const idx of frameIndices) {
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        const pxX = col * frameW;
        const pxY = row * frameH;
        parts.push(`#${idx}->r${row},c${col}@(${pxX},${pxY})`);
    }
    return parts.join(", ");
}





function heroLog(
    scene: Phaser.Scene,
    section: keyof typeof HERO_DEBUG_SECTION_FLAGS,
    message: string
): void {
    if (!isHeroAnimDebugEnabled(scene)) return;
    if (!HERO_DEBUG_SECTION_FLAGS[section]) return;
    // eslint-disable-next-line no-console
    console.log("[HeroAnim]", message);
}



// Deep dump of a single HeroAnimSet – all phases/dirs + frame indices.
// cols64 = number of 64×64 columns (e.g. 13), oversizeCols = number of 192×192 columns (e.g. 8).
function debugLogHeroAnimSet(
    scene: Phaser.Scene,
    set: HeroAnimSet,
    cols64: number,
    oversizeCols: number
): void {
    if (!heroAtlasDebug(scene)) return;

    const dirs: HeroDir[] = ["up", "left", "down", "right"];
    const phaseBits: string[] = [];

    for (const phaseKey of Object.keys(set.phases) as HeroPhase[]) {
        const dirMap = set.phases[phaseKey];
        if (!dirMap) continue;

        for (const dir of dirs) {
            const def = dirMap[dir];
            if (!def) continue;

            // Decide which grid this anim is using: 64×64 or 192×192
            let frameW = HERO_FRAME_W;
            let frameH = HERO_FRAME_H;
            let cols = cols64;

            if (set.oversizeTextureKey &&
                def.textureKey === set.oversizeTextureKey &&
                oversizeCols > 0) {

                // Oversize 192×192 grid
                frameW = HERO_OVERSIZE_FRAME_W;
                frameH = HERO_OVERSIZE_FRAME_H;
                cols = oversizeCols;
            }

            const framesDebug = formatHeroFrameDebug(def.frameIndices, frameW, frameH, cols);

            phaseBits.push(
                `${phaseKey}/${dir} tex=${def.textureKey}` +
                ` fps=${def.frameRate} repeat=${def.repeat} yoyo=${def.yoyo}` +
                ` frames=[${framesDebug}]`
            );
        }
    }

    heroLog(
        scene,
        "buildSet",
        `[heroAtlas.deepDump] id=${set.id} hero=${set.heroName} family=${set.family} | ` +
            phaseBits.join(" | ")
    );
}



// Optional runtime switch if we ever need fine-grained control
export function setHeroAnimDebugSectionFlag(
    section: keyof typeof HERO_DEBUG_SECTION_FLAGS,
    enabled: boolean
): void {
    HERO_DEBUG_SECTION_FLAGS[section] = enabled;
}

// ----------------------------------------------------------
// 1. Discover hero spritesheets
// ----------------------------------------------------------


const heroAuraPngs = import.meta.glob(
    "../assets/auras/*.png",
    { as: "url", eager: true }
) as Record<string, string>;



// Mirrors monsterAtlas: we eagerly glob all hero PNGs in ../assets/heroes.
const heroPngs = import.meta.glob(
    "../assets/heroes/*.png",
    { as: "url", eager: true }
) as Record<string, string>;

interface ParsedHeroSheet {
    /** Full id / base name, e.g. "JasonHeroStrength" */
    id: string;
    /** Hero name part, e.g. "Jason" */
    heroName: string;
    /** Family (Strength, Agility, Intelligence, Support) */
    family: HeroFamily;
    /** Phaser texture key we will use (64×64 grid) */
    textureKey: string;
    /** URL from Vite */
    url: string;
}

export const HERO_FRAME_W = 64;
export const HERO_FRAME_H = 64;
/** Universal LPC sheets are 13 columns wide in 64×64 space. */
export const HERO_SHEET_COLS = 13;

const HERO_OVERSIZE_SCALE = 3;
const HERO_OVERSIZE_FRAME_W = HERO_FRAME_W * HERO_OVERSIZE_SCALE; // 192
const HERO_OVERSIZE_FRAME_H = HERO_FRAME_H * HERO_OVERSIZE_SCALE; // 192;

/**
 * Parse a filename like "JasonHeroStrength" into
 *   heroName = "Jason"
 *   family   = "strength"
 */
function parseHeroFilename(baseName: string, url: string): ParsedHeroSheet | null {
    // Expect pattern "<Name>Hero" OR "<Name>Hero<Family>"
    const heroIndex = baseName.indexOf("Hero");
    if (heroIndex <= 0) return null;

    const heroName = baseName.slice(0, heroIndex);
    if (!heroName) return null;

    const familyPart = baseName.slice(heroIndex + 4); // after "Hero" (may be "")

    let family: HeroFamily | null = null;

    if (!familyPart) {
        // New single-sheet naming: "JasonHero" => family="base"
        family = "base";
    } else {
        const famLower = familyPart.toLowerCase();

        if (famLower.startsWith("base")) family = "base";
        else if (famLower.startsWith("strength")) family = "strength";
        else if (famLower.startsWith("agility")) family = "agility";
        else if (famLower.startsWith("intelligence")) family = "intelligence";
        else if (famLower.startsWith("support")) family = "support";
        else return null;
    }

    const textureKey = baseName;

    return {
        id: baseName,
        heroName,
        family,
        textureKey,
        url
    };
}

/**
 * Preload all hero spritesheets. Call this from HeroScene.preload().
 *
 * Important: we load TWO views of the same PNG:
 *   - 64×64 grid (canonical LPC)
 *   - 192×192 grid (3×3 oversize blocks, used only for oversize phases)
 *
 * We don't know image dimensions yet at preload time, so we always
 * register the 192×192 variant; sheets without oversize will just
 * never use those frames in the atlas.
 */

export function preloadHeroSheets(scene: Phaser.Scene): void {
    const parsedSheets: ParsedHeroSheet[] = [];

    for (const [path, url] of Object.entries(heroPngs)) {
        const fileNameWithExt = path.split(/[\\/]/).pop() || "";
        if (!fileNameWithExt.toLowerCase().endsWith(".png")) continue;
        const baseName = fileNameWithExt.slice(0, -4);

        const parsed = parseHeroFilename(baseName, url);
        if (parsed) parsedSheets.push(parsed);
    }

    heroLog(
        scene,
        "discoverSheets",
        `[heroAtlas.preloadHeroSheets] discovered hero sheets count=${parsedSheets.length} ids=[${parsedSheets
            .map(s => s.id)
            .join(", ")}]`
    );

    for (const sheet of parsedSheets) {
        // Canonical 64×64 LPC grid
        scene.load.spritesheet(sheet.textureKey, sheet.url, {
            frameWidth: HERO_FRAME_W,
            frameHeight: HERO_FRAME_H
        });

        // Oversize 192×192 grid view (3×3 over the same image).
        // Whether we USE it is decided later by buildHeroAtlas (oversize rows detection).
        scene.load.spritesheet(sheet.textureKey + "_192", sheet.url, {
            frameWidth: HERO_OVERSIZE_FRAME_W,
            frameHeight: HERO_OVERSIZE_FRAME_H
        });
    }

    // Stash the parsed list so buildHeroAtlas can reuse without reparsing.
    (scene.registry as any).set("__heroParsedSheets", parsedSheets);

    // Build aura url lookup by baseName (filename without .png)
    const auraUrlById = new Map<string, string>();
    for (const [p, url] of Object.entries(heroAuraPngs)) {
        const file = p.split(/[\\/]/).pop() || "";
        if (!file.toLowerCase().endsWith(".png")) continue;
        const base = file.slice(0, -4); // no .png
        auraUrlById.set(base, url);
    }

    for (const sheet of parsedSheets) {
        // --------------------------
        // REQUIRED 64×64 aura sheet
        // --------------------------
        const auraBase64 = `${sheet.id}_aura_r2`;
        const auraUrl64 = auraUrlById.get(auraBase64);
        if (!auraUrl64) {
            throw new Error(
                `[AURA-MISSING] Missing aura spritesheet for ${sheet.id}. ` +
                `Expected assets/auras/${auraBase64}.png. ` +
                `Run: npm run gen-auras`
            );
        }

        scene.load.spritesheet(`${sheet.textureKey}_aura_r2`, auraUrl64, {
            frameWidth: HERO_FRAME_W,
            frameHeight: HERO_FRAME_H
        });

        // --------------------------
        // OPTIONAL 192×192 aura sheet
        // (only load if present on disk)
        // --------------------------
        const auraBase192 = `${sheet.id}_192_aura_r2`;
        const auraUrl192 = auraUrlById.get(auraBase192);
        if (auraUrl192) {
            scene.load.spritesheet(`${sheet.textureKey}_192_aura_r2`, auraUrl192, {
                frameWidth: HERO_OVERSIZE_FRAME_W,
                frameHeight: HERO_OVERSIZE_FRAME_H
            });
        }
    }
}



// ----------------------------------------------------------
// 2. Helpers for frame indexing / normalization
// ----------------------------------------------------------

function buildFrames(
    row: number,
    cols: number[],
    sheetCols: number
): number[] {
    const frames: number[] = [];
    for (const c of cols) {
        frames.push(row * sheetCols + c);
    }
    return frames;
}


function buildOversizeFrames(
    rowBig: number,
    colsBig: number[],
    oversizeCols: number
): number[] {
    const frames: number[] = [];
    for (const c of colsBig) {
        frames.push(rowBig * oversizeCols + c);
    }
    return frames;
}

export function normalizeHeroDir(dirRaw: any): HeroDir {
    if (!dirRaw) return "down";
    const d = String(dirRaw).toLowerCase();
    if (d === "up" || d === "n" || d === "north") return "up";
    if (d === "down" || d === "s" || d === "south") return "down";
    if (d === "left" || d === "w" || d === "west") return "left";
    if (d === "right" || d === "e" || d === "east") return "right";
    return "down";
}

export function normalizeHeroPhase(phaseRaw: any): HeroPhase | null {
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

    // oversize phases are requested explicitly by name
    if (p === "thrustoversize") return "thrustOversize";
    if (p === "slashoversize") return "slashOversize";

    return null;
}




// ----------------------------------------------------------
// 3. Build HeroAtlas (once textures are loaded)
// ----------------------------------------------------------

export function buildHeroAtlas(scene: Phaser.Scene): HeroAtlas {
    const atlas: HeroAtlas = {};

    const parsedSheets = (scene.registry.get("__heroParsedSheets") || []) as ParsedHeroSheet[];

    const BASE_ROWS_64 = 54; // classic ULPC rows before any oversize blocks

    for (const sheet of parsedSheets) {
        const tex = scene.textures.get(sheet.textureKey);
        const source = tex.getSourceImage() as any;
        const texWidth = source ? source.width : HERO_FRAME_W * HERO_SHEET_COLS;
        const texHeight = source ? source.height : HERO_FRAME_H * BASE_ROWS_64;

        const totalRows64 = Math.floor(texHeight / HERO_FRAME_H);
        const extraRows64 = Math.max(0, totalRows64 - BASE_ROWS_64);

        // Each oversize block is 12 extra 64×64 rows:
        //   12 rows = 4 big 192×192 rows (3 small rows per big row)
        const hasThrustOversize = extraRows64 >= 12;
        const hasSlashOversize = extraRows64 >= 24;

        const cols64 = texWidth / HERO_FRAME_W;
        const oversizeCols = Math.floor(texWidth / HERO_OVERSIZE_FRAME_W); // 1536/192=8 for Jason sheets

        heroLog(
            scene,
            "classifySheet",
            `[heroAtlas.buildHeroAtlas] classify sheet id=${sheet.id} hero=${sheet.heroName} ` +
            `family=${sheet.family} texWidth=${texWidth} texHeight=${texHeight} ` +
            `totalRows=${totalRows64} cols64=${cols64} oversizeCols=${oversizeCols} ` +
            `hasThrustOversize=${hasThrustOversize} hasSlashOversize=${hasSlashOversize}`
        );

        const oversizeTextureKey = hasThrustOversize || hasSlashOversize
            ? sheet.textureKey + "_192"
            : undefined;

        const animSet: HeroAnimSet = {
            id: sheet.id,
            heroName: sheet.heroName,
            family: sheet.family,
            textureKey: sheet.textureKey,
            oversizeTextureKey,
            frameWidth: HERO_FRAME_W,
            frameHeight: HERO_FRAME_H,
            hasThrustOversize,
            hasSlashOversize,
            phases: {}
        };

        const phases = animSet.phases;

        // --------------------------------------------------
        // Small helpers for this sheet
        // --------------------------------------------------
        const addPhaseDir = (
            phase: HeroPhase,
            dir: HeroDir,
            row64: number,
            usedCols64: number[],
            fps: number,
            repeat: number,
            yoyo: boolean
        ) => {
            if (row64 >= totalRows64) return;

            // Use the real per-sheet column count (cols64).
            const frameIndices = buildFrames(row64, usedCols64, cols64);
            if (frameIndices.length === 0) return;

            if (!phases[phase]) phases[phase] = {};
            phases[phase]![dir] = {
                sheetId: animSet.id,
                heroName: animSet.heroName,
                family: animSet.family,
                phase,
                dir,
                textureKey: animSet.textureKey,
                frameIndices,
                frameRate: fps,
                repeat,
                yoyo
            };
        };

        const addOversizePhaseDir = (
            phase: HeroPhase,
            dir: HeroDir,
            rowBig: number,
            usedColsBig: number[],
            fps: number,
            repeat: number,
            yoyo: boolean
        ) => {
            if (!oversizeTextureKey) return;
            if (oversizeCols <= 0) return;

            const frameIndices = buildOversizeFrames(rowBig, usedColsBig, oversizeCols);
            if (frameIndices.length === 0) return;

            if (!phases[phase]) phases[phase] = {};
            phases[phase]![dir] = {
                sheetId: animSet.id,
                heroName: animSet.heroName,
                family: animSet.family,
                phase,
                dir,
                textureKey: oversizeTextureKey,
                frameIndices,
                frameRate: fps,
                repeat,
                yoyo
            };
        };

        // Convenience generators for column ranges on this sheet
        const cols0to = (n: number) => {
            const out: number[] = [];
            for (let i = 0; i <= n && i < cols64; i++) out.push(i);
            return out;
        };

        // --------------------------------------------------
        // Core ULPC 64×64 rows (0-based indexing)
        //
        //  0–3   : cast (spell)
        //  4–7   : thrust
        //  8–11  : walk
        // 12–15  : slash
        // 16–19  : shoot (bow)
        // 20     : hurt (single-row band, reused for all dirs)
        // 21     : climb (single-row band, reused for all dirs)
        // 22–25  : idle
        // 26–29  : jump
        // 30–33  : sit
        // 34–37  : emote
        // 38–41  : run
        // 42–45  : combat idle
        // 50–53  : one-hand slash/backslash
        // 54–57  : one-hand halfslash
        //
        // Watering reuses the thrust band with a special pattern:
        //   frames = [0,1,4,4,4,5] in the thrust row.
        //
        // Oversize 192×192 rows are derived from extra rows below BASE_ROWS_64.
        // --------------------------------------------------

        // Spellcast
        // ULDR = rows 0,1,2,3
        const castCols = cols0to(6); // 7 frames
        addPhaseDir("cast", "up",    0, castCols, 10, 0, false);
        addPhaseDir("cast", "left",  1, castCols, 10, 0, false);
        addPhaseDir("cast", "down",  2, castCols, 10, 0, false);
        addPhaseDir("cast", "right", 3, castCols, 10, 0, false);

        // Thrust (canonical, 64×64)
        // ULDR = rows 4,5,6,7
        const thrustCols = cols0to(7); // 8 frames
        addPhaseDir("thrust", "up",    4, thrustCols, 10, 0, false);
        addPhaseDir("thrust", "left",  5, thrustCols, 10, 0, false);
        addPhaseDir("thrust", "down",  6, thrustCols, 10, 0, false);
        addPhaseDir("thrust", "right", 7, thrustCols, 10, 0, false);


        // Watering – NOT its own rows.
        // Reuses the thrust band with pattern [0,1,4,4,4,5].
        const wateringCols = [0, 1, 4, 4, 4, 5];
        addPhaseDir("watering", "up",    4, wateringCols, 10, 0, false);
        addPhaseDir("watering", "left",  5, wateringCols, 10, 0, false);
        addPhaseDir("watering", "down",  6, wateringCols, 10, 0, false);
        addPhaseDir("watering", "right", 7, wateringCols, 10, 0, false);


        // Walk (canonical, 64×64)
        // ULDR = rows 8,9,10,11
        const walkCols = cols0to(8); // 9 frames
        addPhaseDir("walk", "up",    8,  walkCols, 8, -1, false);
        addPhaseDir("walk", "left",  9,  walkCols, 8, -1, false);
        addPhaseDir("walk", "down",  10, walkCols, 8, -1, false);
        addPhaseDir("walk", "right", 11, walkCols, 8, -1, false);

        // Slash (two-handed classic, 64×64)
        // ULDR = rows 12,13,14,15
        const slashRowBase64 = 12;
        const slashCols64 = cols0to(5); // 6 frames
        const slashYoyo = true;

        addPhaseDir("slash", "up",    slashRowBase64 + 0, slashCols64, 12, 0, slashYoyo);
        addPhaseDir("slash", "left",  slashRowBase64 + 1, slashCols64, 12, 0, slashYoyo);
        addPhaseDir("slash", "down",  slashRowBase64 + 2, slashCols64, 12, 0, slashYoyo);
        addPhaseDir("slash", "right", slashRowBase64 + 3, slashCols64, 12, 0, slashYoyo);

        
        // Shoot (bow) – rows 16–19, usually up to ~13 frames
        const shootCols = cols0to(12); // 13 frames max
        addPhaseDir("shoot", "up",    16, shootCols, 10, 0, false);
        addPhaseDir("shoot", "left",  17, shootCols, 10, 0, false);
        addPhaseDir("shoot", "down",  18, shootCols, 10, 0, false);
        addPhaseDir("shoot", "right", 19, shootCols, 10, 0, false);

        // Hurt – single-row band (generator only draws one facing;
        // we just reuse it for all dirs). 6 frames.
        const hurtCols = cols0to(5);
        addPhaseDir("hurt", "up",    20, hurtCols, 8, 0, false);
        addPhaseDir("hurt", "left",  20, hurtCols, 8, 0, false);
        addPhaseDir("hurt", "down",  20, hurtCols, 8, 0, false);
        addPhaseDir("hurt", "right", 20, hurtCols, 8, 0, false);

        // Climb – single-row band, 6 frames
        const climbCols = cols0to(5); // 6 frames (0–5)
        addPhaseDir("climb", "up",    21, climbCols, 10, -1, false);
        addPhaseDir("climb", "left",  21, climbCols, 10, -1, false);
        addPhaseDir("climb", "down",  21, climbCols, 10, -1, false);
        addPhaseDir("climb", "right", 21, climbCols, 10, -1, false);

        // Idle – rows 22–25
        const idleCols = cols0to(1); // 2 frames
        addPhaseDir("idle", "up",    22, idleCols, 3, -1, false);
        addPhaseDir("idle", "left",  23, idleCols, 3, -1, false);
        addPhaseDir("idle", "down",  24, idleCols, 3, -1, false);
        addPhaseDir("idle", "right", 25, idleCols, 3, -1, false);

        // Jump – rows 26–29, 5 frames
        const jumpCols = cols0to(4); // 5 frames (0–4)
        addPhaseDir("jump", "up",    26, jumpCols, 10, 0, false);
        addPhaseDir("jump", "left",  27, jumpCols, 10, 0, false);
        addPhaseDir("jump", "down",  28, jumpCols, 10, 0, false);
        addPhaseDir("jump", "right", 29, jumpCols, 10, 0, false);

        // Sit – rows 30–33, 3 frames
        const sitCols = cols0to(2); // 3 frames (0–2)
        addPhaseDir("sit", "up",    30, sitCols, 4, -1, false);
        addPhaseDir("sit", "left",  31, sitCols, 4, -1, false);
        addPhaseDir("sit", "down",  32, sitCols, 4, -1, false);
        addPhaseDir("sit", "right", 33, sitCols, 4, -1, false);

        // Emote – rows 34–37, 3 frames
        const emoteCols = cols0to(2); // 3 frames (0–2)
        addPhaseDir("emote", "up",    34, emoteCols, 6, 0, false);
        addPhaseDir("emote", "left",  35, emoteCols, 6, 0, false);
        addPhaseDir("emote", "down",  36, emoteCols, 6, 0, false);
        addPhaseDir("emote", "right", 37, emoteCols, 6, 0, false);

        // Run – rows 38–41, 8 frames
        const runCols = cols0to(7); // 8 frames (0–7)
        addPhaseDir("run", "up",    38, runCols, 12, -1, false);
        addPhaseDir("run", "left",  39, runCols, 12, -1, false);
        addPhaseDir("run", "down",  40, runCols, 12, -1, false);
        addPhaseDir("run", "right", 41, runCols, 12, -1, false);




        // Combat idle – rows 46–49
        const combatIdleCols = idleCols.length > 1 ? idleCols : walkCols;
        addPhaseDir("combatIdle", "up",    42, combatIdleCols, 6, -1, false);
        addPhaseDir("combatIdle", "left",  43, combatIdleCols, 6, -1, false);
        addPhaseDir("combatIdle", "down",  44, combatIdleCols, 6, -1, false);
        addPhaseDir("combatIdle", "right", 45, combatIdleCols, 6, -1, false);

        // --------------------------------------------------
        // One-hand slash / backslash / halfslash
        //
        // For the wide Jason sheets that have oversize blocks:
        //   - canonical 64×64 one-hand rows are ABOVE the oversize block:
        //       46–49 : one-hand slash/backslash
        //       50–53 : one-hand halfslash
        //   - oversize rows start at 54.
        //
        // For classic 13-col LPC sheets (no oversize):
        //   - 50–53 : one-hand slash/backslash
        //   - 54–57 : one-hand halfslash.
        //
        // We detect this per-sheet using the oversize flags.
        // --------------------------------------------------
        const oneHandSlashRowBase = (hasThrustOversize || hasSlashOversize) ? 46 : 50;
        const halfslashRowBase    = (hasThrustOversize || hasSlashOversize) ? 50 : 54;

        const oneHandSlashCols     = cols0to(6);   // 7 frames: 0..6
        const oneHandBackslashCols = cols0to(12);  // 13 frames: 0..12
        const halfslashCols        = cols0to(5);   // 6 frames: 0..5

        // One-hand slash: first 7 frames of the band
        addPhaseDir("oneHandSlash", "up",    oneHandSlashRowBase + 0, oneHandSlashCols, 12, 0, false);
        addPhaseDir("oneHandSlash", "left",  oneHandSlashRowBase + 1, oneHandSlashCols, 12, 0, false);
        addPhaseDir("oneHandSlash", "down",  oneHandSlashRowBase + 2, oneHandSlashCols, 12, 0, false);
        addPhaseDir("oneHandSlash", "right", oneHandSlashRowBase + 3, oneHandSlashCols, 12, 0, false);

        // One-hand backslash: full 13-frame row
        addPhaseDir("oneHandBackslash", "up",    oneHandSlashRowBase + 0, oneHandBackslashCols, 12, 0, false);
        addPhaseDir("oneHandBackslash", "left",  oneHandSlashRowBase + 1, oneHandBackslashCols, 12, 0, false);
        addPhaseDir("oneHandBackslash", "down",  oneHandSlashRowBase + 2, oneHandBackslashCols, 12, 0, false);
        addPhaseDir("oneHandBackslash", "right", oneHandSlashRowBase + 3, oneHandBackslashCols, 12, 0, false);

        // One-hand halfslash: 6-frame band
        addPhaseDir("oneHandHalfslash", "up",    halfslashRowBase + 0, halfslashCols, 12, 0, false);
        addPhaseDir("oneHandHalfslash", "left",  halfslashRowBase + 1, halfslashCols, 12, 0, false);
        addPhaseDir("oneHandHalfslash", "down",  halfslashRowBase + 2, halfslashCols, 12, 0, false);
        addPhaseDir("oneHandHalfslash", "right", halfslashRowBase + 3, halfslashCols, 12, 0, false);





        // ----------------------------
        // Oversize phases (192×192)
        // ----------------------------
        const baseBigRow = BASE_ROWS_64 / HERO_OVERSIZE_SCALE; // 54/3 = 18

        if (hasThrustOversize && oversizeTextureKey && oversizeCols > 0) {
            // First oversize block: thrustOversize
            // 12 extra 64-rows → 4 big rows → ULDR = big rows 18,19,20,21
            const thrustOversizeRowBaseBig = baseBigRow; // 18
            const thrustOversizeColsBig = cols0to(7);    // up to 8 big frames

            addOversizePhaseDir("thrustOversize", "up",    thrustOversizeRowBaseBig + 0, thrustOversizeColsBig, 10, 0, false);
            addOversizePhaseDir("thrustOversize", "left",  thrustOversizeRowBaseBig + 1, thrustOversizeColsBig, 10, 0, false);
            addOversizePhaseDir("thrustOversize", "down",  thrustOversizeRowBaseBig + 2, thrustOversizeColsBig, 10, 0, false);
            addOversizePhaseDir("thrustOversize", "right", thrustOversizeRowBaseBig + 3, thrustOversizeColsBig, 10, 0, false);
        }

        if (hasSlashOversize && oversizeTextureKey && oversizeCols > 0) {
            // Second oversize block: slashOversize
            // Next 12 extra 64-rows → next 4 big rows → ULDR = big rows 22,23,24,25
            const slashOversizeRowBaseBig = baseBigRow + 4; // 22
            const slashOversizeColsBig = cols0to(5);        // 6 big frames

            addOversizePhaseDir("slashOversize", "up",    slashOversizeRowBaseBig + 0, slashOversizeColsBig, 12, 0, false);
            addOversizePhaseDir("slashOversize", "left",  slashOversizeRowBaseBig + 1, slashOversizeColsBig, 12, 0, false);
            addOversizePhaseDir("slashOversize", "down",  slashOversizeRowBaseBig + 2, slashOversizeColsBig, 12, 0, false);
            addOversizePhaseDir("slashOversize", "right", slashOversizeRowBaseBig + 3, slashOversizeColsBig, 12, 0, false);
        }

        // --------------------------------------------------
        // Phase aliases: ONLY fill holes; don't overwrite
        // real data. This way older / partial sheets still
        // get something reasonable for every tester phase.
        // --------------------------------------------------
        const aliasPhase = (target: HeroPhase, source: HeroPhase) => {
            const src = phases[source];
            if (!src) return;
            if (phases[target]) return; // don't clobber real data
            phases[target] = { ...src };
        };

        // Movement / stance variants
        aliasPhase("run", "walk");           // if run rows missing, reuse walk
        aliasPhase("combatIdle", "idle");    // if combat idle missing, reuse idle

        // Spell / bow / utility
        aliasPhase("shoot", "cast");         // if shoot rows missing, reuse cast band
        aliasPhase("watering", "cast");      // if watering pattern missing, reuse cast

        // Damage / recovery
        aliasPhase("hurt", "idle");          // if hurt band missing, reuse idle

        // Misc poses
        aliasPhase("climb", "walk");
        aliasPhase("jump", "walk");
        aliasPhase("sit", "idle");
        aliasPhase("emote", "idle");

        // One-hand sword variants – fallbacks
        aliasPhase("oneHandSlash", "slash");             // if dedicated band missing
        aliasPhase("oneHandBackslash", "oneHandSlash");  // name alias if band missing
        aliasPhase("oneHandHalfslash", "slash");         // if halfslash band missing

        // Cast phase-parts (spellcast split)
        // These are logical sub-phases controlled by heroAnimGlue frame-selection.
        // Atlas-wise they can reuse the base "cast" clip; the key must exist.
        aliasPhase("cast_produce", "cast");
        aliasPhase("cast_drive", "cast");
        aliasPhase("cast_land", "cast");


        // --------------------------------------------------
        // Debug: summarize LEFT-only frame ranges in 64×64
        // (and oversize 192×192 if available).
        // --------------------------------------------------
        const leftCast        = phases.cast?.left;
        const leftThrust      = phases.thrust?.left;
        const leftWalk        = phases.walk?.left;
        const leftSlash       = phases.slash?.left;
        const leftIdle        = phases.idle?.left;
        const leftThrustOver  = phases.thrustOversize?.left;
        const leftSlashOver   = phases.slashOversize?.left;

        // Deep dump all phases/dirs for this hero so we can see exactly
        // which texture + frame indices are being used.
        debugLogHeroAnimSet(scene, animSet, cols64, oversizeCols);

        const summarize64 = (label: string, def?: HeroAnimDef): string => {
            if (!def || def.frameIndices.length === 0) return "";
            const first = def.frameIndices[0];
            const last  = def.frameIndices[def.frameIndices.length - 1];

            const rowFirst = Math.floor(first / cols64);
            const colFirst = first % cols64;
            const rowLast  = Math.floor(last / cols64);
            const colLast  = last % cols64;

            return ` | ${label} [${rowFirst}][${colFirst}]..[${rowLast}][${colLast}] (${def.frameIndices.length} frames)`;
        };

        const summarize192 = (label: string, def?: HeroAnimDef): string => {
            if (!def || def.frameIndices.length === 0 || !oversizeTextureKey) return "";
            const first = def.frameIndices[0];
            const last  = def.frameIndices[def.frameIndices.length - 1];
            const rowFirstBig = Math.floor(first / oversizeCols);
            const colFirstBig = first % oversizeCols;
            const rowLastBig  = Math.floor(last / oversizeCols);
            const colLastBig  = last % oversizeCols;
            const smallRowStart = rowFirstBig * HERO_OVERSIZE_SCALE;
            const smallRowEnd   = smallRowStart + (HERO_OVERSIZE_SCALE - 1);
            return ` | ${label}192 [Rbig=${rowFirstBig},C=${colFirstBig}]..[Rbig=${rowLastBig},C=${colLastBig}] ` +
                   `(${def.frameIndices.length} frames, rows64≈${smallRowStart}..${smallRowEnd})`;
        };

        let summary = `sheet=${sheet.id} hero=${sheet.heroName} family=${sheet.family}`;
        summary += summarize64("cast",         leftCast);
        summary += summarize64("thrust",       leftThrust);
        summary += summarize64("walk",         leftWalk);
        summary += summarize64("slash",        leftSlash);
        summary += summarize64("idle",         leftIdle);
        summary += summarize192("thrustOversize", leftThrustOver);
        summary += summarize192("slashOversize",  leftSlashOver);

        heroLog(scene, "buildSet", `[heroAtlas.buildHeroAtlas] frame ranges (LEFT only) ${summary}`);

        atlas[animSet.id] = animSet;
    }

    // Dump just the first hero set in full detail for sanity.
    const firstKey = Object.keys(atlas)[0];
    if (firstKey) {
        const first = atlas[firstKey];
        const phasesList = Object.keys(first.phases).join(", ");
        heroLog(
            scene,
            "firstSetDump",
            `[heroAtlas.buildHeroAtlas] first hero anim set id=${first.id} ` +
            `hero=${first.heroName} family=${first.family} phases=[${phasesList}]`
        );
    }

    // Cache in registry so heroAnimGlue can grab it quickly.
    (scene.registry as any).set("heroAtlas", atlas);

    return atlas;
}






/**
 * Helper to get the hero atlas from a scene, building it on first use
 * if necessary (assuming preloadHeroSheets was called in preload()).
 */
export function getHeroAtlasFromScene(scene: Phaser.Scene): HeroAtlas | undefined {
    let atlas = scene.registry.get("heroAtlas") as HeroAtlas | undefined;
    if (!atlas) {
        atlas = buildHeroAtlas(scene);
    }
    return atlas;
}

/**
 * Locate the HeroAnimSet for a given hero + family combination.
 * This keeps the glue simple: it only has to give us heroName / heroFamily.
 */
export function findHeroAnimSet(
    atlas: HeroAtlas,
    heroNameRaw: any,
    familyRaw: any
): HeroAnimSet | undefined {
    const heroName = String(heroNameRaw || "").trim();
    const famLower = String(familyRaw || "").toLowerCase();

    if (!heroName) return undefined;

    let family: HeroFamily | null = null;
    if (famLower === "base") family = "base";
    else if (famLower === "strength") family = "strength";
    else if (famLower === "agility") family = "agility";
    else if (famLower === "intelligence") family = "intelligence";
    else if (famLower === "support") family = "support";

    // 1) Exact match (legacy behavior)
    if (family) {
        for (const set of Object.values(atlas)) {
            if (set.heroName === heroName && set.family === family) {
                return set;
            }
        }
    }

    // 2) Fallback to base sheet (new single-sheet world)
    for (const set of Object.values(atlas)) {
        if (set.heroName === heroName && set.family === "base") {
            return set;
        }
    }

    // 3) Final fallback: first set with matching heroName
    for (const set of Object.values(atlas)) {
        if (set.heroName === heroName) {
            return set;
        }
    }

    return undefined;
}
