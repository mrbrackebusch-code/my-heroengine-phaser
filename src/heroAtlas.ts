// src/heroAtlas.ts
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

export type HeroFamily = "strength" | "agility" | "intelligence" | "support";

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

    /** Texture key used when we loaded the spritesheet */
    textureKey: string;

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
    apply: true,
    frameRanges: true
};

function isHeroAnimDebugEnabled(scene: Phaser.Scene): boolean {
    // Global toggle via Phaser registry; default off.
    // Set in HeroScene.create():  scene.registry.set("heroAnimDebug", true);
    return !!scene.registry.get("heroAnimDebug");
}

function heroLog(
    scene: Phaser.Scene,
    section: keyof typeof HERO_DEBUG_SECTION_FLAGS,
    msg: string
): void {
    if (!isHeroAnimDebugEnabled(scene)) return;
    if (!HERO_DEBUG_SECTION_FLAGS[section]) return;
    // eslint-disable-next-line no-console
    console.log("[HeroAnim]", msg);
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
    /** Phaser texture key we will use */
    textureKey: string;
    /** URL from Vite */
    url: string;
}

export const HERO_FRAME_W = 64;
export const HERO_FRAME_H = 64;
/** Universal LPC sheets are 13 columns wide. */
export const HERO_SHEET_COLS = 13;

/**
 * Parse a filename like "JasonHeroStrength" into
 *   heroName = "Jason"
 *   family   = "strength"
 */
function parseHeroFilename(baseName: string, url: string): ParsedHeroSheet | null {
    // Expect pattern "<Name>Hero<Family>"
    const heroIndex = baseName.indexOf("Hero");
    if (heroIndex <= 0 || heroIndex + 4 >= baseName.length) {
        return null;
    }

    const heroName = baseName.slice(0, heroIndex);
    const familyPart = baseName.slice(heroIndex + 4); // after "Hero"

    const famLower = familyPart.toLowerCase();
    let family: HeroFamily | null = null;

    if (famLower.startsWith("strength")) family = "strength";
    else if (famLower.startsWith("agility")) family = "agility";
    else if (famLower.startsWith("intelligence")) family = "intelligence";
    else if (famLower.startsWith("support")) family = "support";

    if (!family) return null;

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
 * We intentionally keep it very similar to monsterAtlas.preloadMonsterSheets.
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

    const ids = parsedSheets.map(s => s.id).join(", ");
    heroLog(
        scene,
        "discoverSheets",
        `[heroAtlas.preloadHeroSheets] discovered hero sheets count=${parsedSheets.length} ids=[${ids}]`
    );

    for (const sheet of parsedSheets) {
        scene.load.spritesheet(sheet.textureKey, sheet.url, {
            frameWidth: HERO_FRAME_W,
            frameHeight: HERO_FRAME_H
        });
    }

    // Stash the parsed list so buildHeroAtlas can reuse without reparsing.
    (scene.registry as any).set("__heroParsedSheets", parsedSheets);
}

// ----------------------------------------------------------
// 2. Helpers for frame indexing / normalization
// ----------------------------------------------------------

function buildFrames(row: number, cols: number[]): number[] {
    const frames: number[] = [];
    for (const c of cols) {
        frames.push(row * HERO_SHEET_COLS + c);
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

    return null;
}

// ----------------------------------------------------------
// 3. Build HeroAtlas (once textures are loaded)
// ----------------------------------------------------------

export function buildHeroAtlas(scene: Phaser.Scene): HeroAtlas {
    const atlas: HeroAtlas = {};

    const parsedSheets = (scene.registry.get("__heroParsedSheets") || []) as ParsedHeroSheet[];

    for (const sheet of parsedSheets) {
        const tex = scene.textures.get(sheet.textureKey);
        const source = tex.getSourceImage() as any;
        const texWidth = source ? source.width : HERO_FRAME_W * HERO_SHEET_COLS;
        const texHeight = source ? source.height : HERO_FRAME_H * 54;

        const BASE_ROWS = 54;
        const totalRows = Math.floor(texHeight / HERO_FRAME_H);
        const extraRows = Math.max(0, totalRows - BASE_ROWS);

        // each oversize block adds 12 rows (thrust, then slash)
        const hasThrustOversize = extraRows >= 12;
        const hasSlashOversize  = extraRows >= 24;

        heroLog(
            scene,
            "classifySheet",
            `[heroAtlas.buildHeroAtlas] classify sheet id=${sheet.id} hero=${sheet.heroName} family=${sheet.family} texWidth=${texWidth} texHeight=${texHeight} totalRows=${totalRows} hasThrustOversize=${hasThrustOversize} hasSlashOversize=${hasSlashOversize}`
        );

        const animSet: HeroAnimSet = {
            id: sheet.id,
            heroName: sheet.heroName,
            family: sheet.family,
            textureKey: sheet.textureKey,
            frameWidth: HERO_FRAME_W,
            frameHeight: HERO_FRAME_H,
            hasThrustOversize,
            hasSlashOversize,
            phases: {}
        };

        const phases = animSet.phases;

        const addPhaseDir = (
            phase: HeroPhase,
            dir: HeroDir,
            row: number,
            usedCols: number[],
            fps: number,
            repeat: number,
            yoyo: boolean
        ) => {
            if (row >= totalRows) return;
            const frameIndices = buildFrames(row, usedCols);
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

        // --------------------------------------------------
        // Core ULPC rows (from your anim_map expectations):
        //   0–3   : cast (7 frames)
        //   4–7   : thrust (8 frames)
        //   8–11  : walk (9 frames)
        //   12–15 : slash (6 frames)
        //   22–25 : idle (2 frames)
        //
        // Oversize rows we care about:
        //   54–57 : thrust oversize (if present)
        //   58–61 : slash oversize (if present)
        //   50–53 : one-hand halfslash (used for guard yoyo if present)
        // --------------------------------------------------

        // Spellcast
        addPhaseDir("cast", "up",    0, [0,1,2,3,4,5,6], 10, 0, false);
        addPhaseDir("cast", "left",  1, [0,1,2,3,4,5,6], 10, 0, false);
        addPhaseDir("cast", "down",  2, [0,1,2,3,4,5,6], 10, 0, false);
        addPhaseDir("cast", "right", 3, [0,1,2,3,4,5,6], 10, 0, false);

        // Thrust — canonical "thrust" phase
        const thrustRowBase = hasThrustOversize ? 54 : 4;
        const thrustCols     = [0,1,2,3,4,5,6,7];

        addPhaseDir("thrust", "up",    thrustRowBase + 0, thrustCols, 10, 0, false);
        addPhaseDir("thrust", "left",  thrustRowBase + 1, thrustCols, 10, 0, false);
        addPhaseDir("thrust", "down",  thrustRowBase + 2, thrustCols, 10, 0, false);
        addPhaseDir("thrust", "right", thrustRowBase + 3, thrustCols, 10, 0, false);

        // If oversize exists, also expose explicit oversize phase
        if (hasThrustOversize) {
            addPhaseDir("thrustOversize", "up",    54, thrustCols, 10, 0, false);
            addPhaseDir("thrustOversize", "left",  55, thrustCols, 10, 0, false);
            addPhaseDir("thrustOversize", "down",  56, thrustCols, 10, 0, false);
            addPhaseDir("thrustOversize", "right", 57, thrustCols, 10, 0, false);
        }

        // Walk
        const walkCols = [0,1,2,3,4,5,6,7,8];
        addPhaseDir("walk", "up",    8,  walkCols, 8, -1, false);
        addPhaseDir("walk", "left",  9,  walkCols, 8, -1, false);
        addPhaseDir("walk", "down", 10,  walkCols, 8, -1, false);
        addPhaseDir("walk", "right", 11, walkCols, 8, -1, false);

        // Slash — canonical "slash" phase.
        // For guard-return behaviour, we prefer the one-hand halfslash rows
        // (50–53) and play them with yoyo = true when available.
        let slashRowBase = 12;
        let slashCols: number[] = [0,1,2,3,4,5];
        let slashYoyo = true;

        if (totalRows >= 54) {
            // Use one-hand halfslash if present (rows 50–53)
            slashRowBase = 50;
            slashCols = [0,1,2,3,4,5];
            slashYoyo = true;
        }

        // Oversize slash rows (58–61) override if present.
        if (hasSlashOversize) {
            slashRowBase = 58;
            slashCols = [0,1,2,3,4,5];
            slashYoyo = true;
        }

        addPhaseDir("slash", "up",    slashRowBase + 0, slashCols, 12, 0, slashYoyo);
        addPhaseDir("slash", "left",  slashRowBase + 1, slashCols, 12, 0, slashYoyo);
        addPhaseDir("slash", "down",  slashRowBase + 2, slashCols, 12, 0, slashYoyo);
        addPhaseDir("slash", "right", slashRowBase + 3, slashCols, 12, 0, slashYoyo);

        if (hasSlashOversize) {
            addPhaseDir("slashOversize", "up",    58, slashCols, 12, 0, slashYoyo);
            addPhaseDir("slashOversize", "left",  59, slashCols, 12, 0, slashYoyo);
            addPhaseDir("slashOversize", "down",  60, slashCols, 12, 0, slashYoyo);
            addPhaseDir("slashOversize", "right", 61, slashCols, 12, 0, slashYoyo);
        }

        // Idle
        const idleCols = [0,1];
        addPhaseDir("idle", "up",    22, idleCols, 3, -1, false);
        addPhaseDir("idle", "left",  23, idleCols, 3, -1, false);
        addPhaseDir("idle", "down",  24, idleCols, 3, -1, false);
        addPhaseDir("idle", "right", 25, idleCols, 3, -1, false);

        // --- Frame range summary (LEFT only) for this sheet ---
        const phaseOrder: HeroPhase[] = [
            "cast",
            "thrust",
            "walk",
            "slash",
            "shoot",
            "hurt",
            "climb",
            "idle",
            "jump",
            "sit",
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

        const leftSummaries: string[] = [];

        for (const ph of phaseOrder) {
            const dirMap = phases[ph];
            if (!dirMap) continue;
            const def = dirMap["left"];
            if (!def || !def.frameIndices || def.frameIndices.length === 0) continue;

            const frames = def.frameIndices;
            const first = frames[0];
            const last = frames[frames.length - 1];

            const firstRow = Math.floor(first / HERO_SHEET_COLS);
            const firstCol = first % HERO_SHEET_COLS;
            const lastRow  = Math.floor(last / HERO_SHEET_COLS);
            const lastCol  = last % HERO_SHEET_COLS;

            leftSummaries.push(
                `${ph} [${firstRow}][${firstCol}]..[${lastRow}][${lastCol}] (${frames.length} frames)`
            );
        }

        if (leftSummaries.length > 0) {
            const msg =
                `[heroAtlas.buildHeroAtlas] frame ranges (LEFT only) ` +
                `sheet=${animSet.id} hero=${animSet.heroName} family=${animSet.family} | ` +
                leftSummaries.join(" | ");
            heroLog(scene, "frameRanges", msg);
        }

        atlas[animSet.id] = animSet;
    }

    // Dump just the first hero set in quick summary form
    const firstKey = Object.keys(atlas)[0];
    if (firstKey) {
        const first = atlas[firstKey];
        const phasesPresent = Object.keys(first.phases).join(", ");
        heroLog(
            scene,
            "firstSetDump",
            `[heroAtlas.buildHeroAtlas] first hero anim set id=${first.id} hero=${first.heroName} family=${first.family} phases=[${phasesPresent}]`
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

    let family: HeroFamily | null = null;
    if (famLower === "strength") family = "strength";
    else if (famLower === "agility") family = "agility";
    else if (famLower === "intelligence") family = "intelligence";
    else if (famLower === "support") family = "support";

    if (!heroName || !family) return undefined;

    for (const set of Object.values(atlas)) {
        if (set.heroName === heroName && set.family === family) {
            return set;
        }
    }

    return undefined;
}
