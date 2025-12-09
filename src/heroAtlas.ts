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

        // Oversize 192×192 grid (3×3 over the same image).
        // Atlas will only actually use this if we detect extra rows.
        scene.load.spritesheet(sheet.textureKey + "_192", sheet.url, {
            frameWidth: HERO_OVERSIZE_FRAME_W,
            frameHeight: HERO_OVERSIZE_FRAME_H
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
            `[heroAtlas.buildHeroAtlas] classify sheet id=${sheet.id} hero=${sheet.heroName} family=${sheet.family} texWidth=${texWidth} texHeight=${texHeight} totalRows=${totalRows64} cols64=${cols64} oversizeCols=${oversizeCols} hasThrustOversize=${hasThrustOversize} hasSlashOversize=${hasSlashOversize}`
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
            const frameIndices = buildFrames(row64, usedCols64);
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

        // --------------------------------------------------
        // Core ULPC rows (64×64 grid):
        //   0–3   : cast (7 frames)
        //   4–7   : thrust (8 frames)
        //   8–11  : walk (9 frames)
        //   12–15 : slash (6 frames)
        //   22–25 : idle (2 frames)
        //
        // Oversize blocks (192×192 grid) conceptually:
        //   thrustOversize: first 12 extra 64-rows → 4 big rows
        //   slashOversize : next  12 extra 64-rows → 4 big rows
        //
        // We do NOT let oversize override canonical thrust/slash here.
        // --------------------------------------------------

        // Spellcast (canonical, 64×64)
        // ULDR = rows 0,1,2,3
        const castCols = [0, 1, 2, 3, 4, 5, 6];
        addPhaseDir("cast", "up", 0, castCols, 10, 0, false);
        addPhaseDir("cast", "left", 1, castCols, 10, 0, false);
        addPhaseDir("cast", "down", 2, castCols, 10, 0, false);
        addPhaseDir("cast", "right", 3, castCols, 10, 0, false);

        // Thrust (canonical, 64×64 only)
        // ULDR = rows 4,5,6,7
        const thrustCols = [0, 1, 2, 3, 4, 5, 6, 7];
        addPhaseDir("thrust", "up", 4, thrustCols, 10, 0, false);
        addPhaseDir("thrust", "left", 5, thrustCols, 10, 0, false);
        addPhaseDir("thrust", "down", 6, thrustCols, 10, 0, false);
        addPhaseDir("thrust", "right", 7, thrustCols, 10, 0, false);

        // Walk (canonical, 64×64)
        // ULDR = rows 8,9,10,11
        const walkCols = [0, 1, 2, 3, 4, 5, 6, 7, 8];
        addPhaseDir("walk", "up", 8, walkCols, 8, -1, false);
        addPhaseDir("walk", "left", 9, walkCols, 8, -1, false);
        addPhaseDir("walk", "down", 10, walkCols, 8, -1, false);
        addPhaseDir("walk", "right", 11, walkCols, 8, -1, false);

        // Slash (canonical, 64×64)
        // For guard-return behaviour we prefer one-hand halfslash rows
        // (50–53) if present; otherwise classic slash rows (12–15).
        let slashRowBase64 = 12;
        let slashCols64: number[] = [0, 1, 2, 3, 4, 5];
        let slashYoyo = true;

        if (totalRows64 >= 54) {
            // One-hand halfslash rows at 64×64: 50–53 (ULDR)
            slashRowBase64 = 50;
            slashCols64 = [0, 1, 2, 3, 4, 5];
            slashYoyo = true;
        }

        addPhaseDir("slash", "up", slashRowBase64 + 0, slashCols64, 12, 0, slashYoyo);
        addPhaseDir("slash", "left", slashRowBase64 + 1, slashCols64, 12, 0, slashYoyo);
        addPhaseDir("slash", "down", slashRowBase64 + 2, slashCols64, 12, 0, slashYoyo);
        addPhaseDir("slash", "right", slashRowBase64 + 3, slashCols64, 12, 0, slashYoyo);

        // Idle (canonical, 64×64)
        const idleCols = [0, 1];
        addPhaseDir("idle", "up", 22, idleCols, 3, -1, false);
        addPhaseDir("idle", "left", 23, idleCols, 3, -1, false);
        addPhaseDir("idle", "down", 24, idleCols, 3, -1, false);
        addPhaseDir("idle", "right", 25, idleCols, 3, -1, false);

        // ----------------------------
        // Oversize phases (192×192)
        // ----------------------------
        const baseBigRow = BASE_ROWS_64 / HERO_OVERSIZE_SCALE; // 54/3 = 18

        if (hasThrustOversize && oversizeTextureKey && oversizeCols > 0) {
            // First oversize block: thrustOversize
            // 12 extra 64-rows → 4 big rows → ULDR = big rows 18,19,20,21
            const thrustOversizeRowBaseBig = baseBigRow; // 18
            const thrustOversizeColsBig = [0, 1, 2, 3, 4, 5, 6, 7];

            addOversizePhaseDir("thrustOversize", "up", thrustOversizeRowBaseBig + 0, thrustOversizeColsBig, 10, 0, false);
            addOversizePhaseDir("thrustOversize", "left", thrustOversizeRowBaseBig + 1, thrustOversizeColsBig, 10, 0, false);
            addOversizePhaseDir("thrustOversize", "down", thrustOversizeRowBaseBig + 2, thrustOversizeColsBig, 10, 0, false);
            addOversizePhaseDir("thrustOversize", "right", thrustOversizeRowBaseBig + 3, thrustOversizeColsBig, 10, 0, false);
        }

        if (hasSlashOversize && oversizeTextureKey && oversizeCols > 0) {
            // Second oversize block: slashOversize
            // Next 12 extra 64-rows → next 4 big rows → ULDR = big rows 22,23,24,25
            const slashOversizeRowBaseBig = baseBigRow + 4; // 22
            const slashOversizeColsBig = [0, 1, 2, 3, 4, 5];

            addOversizePhaseDir("slashOversize", "up", slashOversizeRowBaseBig + 0, slashOversizeColsBig, 12, 0, true);
            addOversizePhaseDir("slashOversize", "left", slashOversizeRowBaseBig + 1, slashOversizeColsBig, 12, 0, true);
            addOversizePhaseDir("slashOversize", "down", slashOversizeRowBaseBig + 2, slashOversizeColsBig, 12, 0, true);
            addOversizePhaseDir("slashOversize", "right", slashOversizeRowBaseBig + 3, slashOversizeColsBig, 12, 0, true);
        }

        // --------------------------------------------------
        // Debug: summarize LEFT-only frame ranges in 64×64
        // (and oversize 192×192 if available).
        // --------------------------------------------------
        const leftCast = phases.cast?.left;
        const leftThrust = phases.thrust?.left;
        const leftWalk = phases.walk?.left;
        const leftSlash = phases.slash?.left;
        const leftIdle = phases.idle?.left;
        const leftThrustOver = phases.thrustOversize?.left;
        const leftSlashOver = phases.slashOversize?.left;

        const summarize64 = (label: string, def?: HeroAnimDef): string => {
            if (!def || def.frameIndices.length === 0) return "";
            // We only log as [row][firstCol]..[row][lastCol] for 64×64
            const first = def.frameIndices[0];
            const last = def.frameIndices[def.frameIndices.length - 1];
            const rowFirst = Math.floor(first / HERO_SHEET_COLS);
            const colFirst = first % HERO_SHEET_COLS;
            const rowLast = Math.floor(last / HERO_SHEET_COLS);
            const colLast = last % HERO_SHEET_COLS;
            return ` | ${label} [${rowFirst}][${colFirst}]..[${rowLast}][${colLast}] (${def.frameIndices.length} frames)`;
        };

        const summarize192 = (label: string, def?: HeroAnimDef): string => {
            if (!def || def.frameIndices.length === 0 || !oversizeTextureKey) return "";
            const first = def.frameIndices[0];
            const last = def.frameIndices[def.frameIndices.length - 1];
            const rowFirstBig = Math.floor(first / oversizeCols);
            const colFirstBig = first % oversizeCols;
            const rowLastBig = Math.floor(last / oversizeCols);
            const colLastBig = last % oversizeCols;
            const smallRowStart = rowFirstBig * HERO_OVERSIZE_SCALE;
            const smallRowEnd = smallRowStart + (HERO_OVERSIZE_SCALE - 1);
            return ` | ${label}192 [Rbig=${rowFirstBig},C=${colFirstBig}]..[Rbig=${rowLastBig},C=${colLastBig}] (${def.frameIndices.length} frames, rows64≈${smallRowStart}..${smallRowEnd})`;
        };

        let summary = `sheet=${sheet.id} hero=${sheet.heroName} family=${sheet.family}`;
        summary += summarize64("cast", leftCast);
        summary += summarize64("thrust", leftThrust);
        summary += summarize64("walk", leftWalk);
        summary += summarize64("slash", leftSlash);
        summary += summarize64("idle", leftIdle);
        summary += summarize192("thrustOversize", leftThrustOver);
        summary += summarize192("slashOversize", leftSlashOver);

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
            `[heroAtlas.buildHeroAtlas] first hero anim set id=${first.id} hero=${first.heroName} family=${first.family} phases=[${phasesList}]`
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
