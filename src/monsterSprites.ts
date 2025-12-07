// src/monsterSprites.ts
import type Phaser from "phaser";

// Internal direction type (matches what your engine already uses)
export type Dir = "up" | "down" | "left" | "right";

export type MonsterAnimPhase = "walk" | "attack" | "death";

/**
 * One PNG sheet for one "phase" (walk, attack, death) of a monster.
 * Assumptions:
 *   - The sheet is a grid: 4 rows (one per direction), N columns (frames).
 *   - Rows are ordered by some direction order, e.g. "NESW" or "ULDR".
 *   - If directionOrderHint is omitted AND we can't parse it from key,
 *     we default to U L D R (up, left, down, right).
 */
export interface MonsterSheetSpec {
    /** Phaser texture key AND (usually) the filename base, e.g. "dragon_walk_32x32_NESW" */
    key: string;

    /** Animation phase this sheet represents */
    phase: MonsterAnimPhase;

    /** Frame size in pixels */
    frameWidth: number;
    frameHeight: number;

    /** URL passed to Phaser loader (usually imported from an asset file) */
    url: string;

    /**
     * Optional: direction order code, e.g. "NESW", "SWEN", "ULDR", etc.
     * If omitted, we try to parse from key; if that fails, we default to ULDR.
     */
    directionOrderHint?: string;

    /**
     * Optional: row offset if the 4 directions start lower in the sheet.
     * Default = 0 → directions are rows 0..3. If set to 4, directions are rows 4..7, etc.
     */
    rowOffset?: number;
}

/**
 * A monster is usually multiple sheets (walk / attack / death).
 */
export interface MonsterSpec {
    /** Logical monster id (goblin, dragon_red, etc.) */
    id: string;

    /** All sheets that belong to this monster */
    sheets: MonsterSheetSpec[];
}

// -------------------------
// Output structures
// -------------------------

export interface DirectionalFrames {
    up?: number[];
    down?: number[];
    left?: number[];
    right?: number[];
}

export interface PhaseFrames {
    sheetKey: string;          // which spritesheet these frames come from
    dirs: DirectionalFrames;   // frames for each direction
}

export interface MonsterFramesByPhase {
    walk?: PhaseFrames;
    attack?: PhaseFrames;
    death?: PhaseFrames;
}

/** Final “bank” you can stick on globalThis or pass into HeroEngine */
export type MonsterFrameBank = Record<string, MonsterFramesByPhase>;

// -------------------------
// Helpers
// -------------------------

/**
 * Try to infer direction order from:
 *   1) sheet.directionOrderHint, OR
 *   2) last underscore segment of sheet.key, e.g. "dragon_walk_32x32_NESW"
 * If nothing useful is found, default to ULDR (up, left, down, right).
 */
function inferDirectionOrder(sheet: MonsterSheetSpec): Dir[] {
    const tryCode = (sheet.directionOrderHint || sheet.key.split("_").pop() || "").toUpperCase();

    if (/^[NESW]{4}$/.test(tryCode)) {
        // Map N/E/S/W to our internal Dir names
        return tryCode.split("").map((ch) => {
            switch (ch) {
                case "N": return "up";
                case "S": return "down";
                case "E": return "right";
                case "W": return "left";
                default:  return "down"; // should never happen due to regex
            }
        });
    }

    if (/^[ULDR]{4}$/.test(tryCode)) {
        // Optional: ULDR (Up, Left, Down, Right)
        return tryCode.split("").map((ch) => {
            switch (ch) {
                case "U": return "up";
                case "D": return "down";
                case "L": return "left";
                case "R": return "right";
                default:  return "down";
            }
        });
    }

    // Fallback: the "Arcade style": up, left, down, right
    return ["up", "left", "down", "right"];
}

/**
 * Compute how many columns (frames per row) a spritesheet has,
 * using Phaser's texture info.
 */
function getSheetColumns(
    scene: Phaser.Scene,
    sheet: MonsterSheetSpec
): number {
    const tex = scene.textures.get(sheet.key);
    if (!tex) {
        throw new Error(`[monsterSprites] Texture not found for key: ${sheet.key}`);
    }

    const src = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const width = src.width;
    return Math.floor(width / sheet.frameWidth);
}

/**
 * Build frame indices for 4 directions for a given sheet.
 * Each row is one direction.
 */
function buildDirectionalFramesForSheet(
    scene: Phaser.Scene,
    sheet: MonsterSheetSpec
): PhaseFrames {
    const dirs = inferDirectionOrder(sheet);      // Dir[4]
    const cols = getSheetColumns(scene, sheet);   // frames per row
    const rowOffset = sheet.rowOffset ?? 0;

    const dirFrames: DirectionalFrames = {};

    for (let i = 0; i < 4; i++) {
        const dir = dirs[i];          // "up" | "down" | "left" | "right"
        const row = rowOffset + i;    // actual row index in the sheet

        const baseIndex = row * cols;
        const frames: number[] = [];

        for (let col = 0; col < cols; col++) {
            frames.push(baseIndex + col);
        }

        // Attach to the right direction slot
        (dirFrames as any)[dir] = frames;
    }

    return {
        sheetKey: sheet.key,
        dirs: dirFrames
    };
}

// -------------------------
// Public API
// -------------------------

/**
 * Call this in HeroScene.preload() to register all monster sheets with Phaser.
 */
export function preloadMonsterSheets(
    scene: Phaser.Scene,
    monsters: MonsterSpec[]
): void {
    for (const monster of monsters) {
        for (const sheet of monster.sheets) {
            scene.load.spritesheet(sheet.key, sheet.url, {
                frameWidth: sheet.frameWidth,
                frameHeight: sheet.frameHeight
            });
        }
    }
}

/**
 * Call this in HeroScene.create() *after* preload finishes.
 * It slices the sheets into arrays of frame indices per phase + direction.
 */
export function buildMonsterFrameBank(
    scene: Phaser.Scene,
    monsters: MonsterSpec[]
): MonsterFrameBank {
    const bank: MonsterFrameBank = {};

    for (const monster of monsters) {
        const perPhase: MonsterFramesByPhase = {};

        for (const sheet of monster.sheets) {
            const phaseFrames = buildDirectionalFramesForSheet(scene, sheet);

            (perPhase as any)[sheet.phase] = phaseFrames;
        }

        bank[monster.id] = perPhase;
    }

    return bank;
}

/**
 * Optional helper: create Phaser animations for each monster/phase/direction.
 * Anim keys: `${monsterId}_${phase}_${dir}`
 * e.g. "goblin_walk_left"
 */
export function createMonsterAnimations(
    scene: Phaser.Scene,
    bank: MonsterFrameBank
): void {
    for (const monsterId of Object.keys(bank)) {
        const phases = bank[monsterId];

        for (const phase of ["walk", "attack", "death"] as MonsterAnimPhase[]) {
            const pf = (phases as any)[phase] as PhaseFrames | undefined;
            if (!pf) continue;

            const sheetKey = pf.sheetKey;
            const dirs = pf.dirs;

            const repeat = phase === "death" ? 0 : -1;
            const frameRate = phase === "walk" ? 8 : 10;

            for (const dir of ["up", "down", "left", "right"] as Dir[]) {
                const frames = (dirs as any)[dir] as number[] | undefined;
                if (!frames || frames.length === 0) continue;

                const animKey = `${monsterId}_${phase}_${dir}`;

                // Avoid duplicate recreation if you call this more than once
                if (scene.anims.exists(animKey)) continue;

                scene.anims.create({
                    key: animKey,
                    frames: frames.map((frameIndex) => ({
                        key: sheetKey,
                        frame: frameIndex
                    })),
                    frameRate,
                    repeat
                });
            }
        }
    }
}
