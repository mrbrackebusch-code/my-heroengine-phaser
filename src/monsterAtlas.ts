// src/monsterAtlas.ts
import type Phaser from "phaser";

export type Dir = "up" | "down" | "left" | "right";
export type Phase = "walk" | "attack" | "death";

export interface PhaseDirFrames {
    [dir: string]: number[] | undefined; // keys will be Dir
}

export interface MonsterAnimSet {
    /** e.g. "imp blue", "spider green yellow dot" */
    id: string;
    frameWidth: number;
    frameHeight: number;
    /** All Phaser texture keys used for this monster (one per sheet) */
    textureKeys: string[];
    /** Frames per phase + direction */
    phases: {
        walk?: PhaseDirFrames;
        attack?: PhaseDirFrames;
        death?: PhaseDirFrames;
    };
}

/** Lookup table; also gets simple aliases (e.g. last word: "blue") */
export type MonsterAtlas = Record<string, MonsterAnimSet>;

/* ------------------------------------------------------------------
   1. Vite glob: grab all monster PNGs at build time
------------------------------------------------------------------ */

const monsterPngs = import.meta.glob(
    "../assets/monsters/*.png",
    { as: "url", eager: true }
) as Record<string, string>;

interface ParsedSheet {
    id: string;              // "imp blue", "spider green", etc.
    width: number;
    height: number;
    dirs?: Dir[];            // undefined = single-row, no directions
    sharedDeathRows: number; // 0, 1, 2...
    phaseStarts: Partial<Record<Phase, number>>; // 1-based column indices
    rowCountOverride?: number;                   // e.g. 1Row
    textureKey: string;      // Phaser texture key
    url: string;             // URL from Vite
    /** true if we want to fully skip this sheet in the generic pipeline */
    skip: boolean;
}

/* ------------------------------------------------------------------
   2. Filename parsing helpers
------------------------------------------------------------------ */

const DIR_LETTERS = new Set(["U", "D", "L", "R", "N", "E", "S", "W"]);

function mapLetterToDir(ch: string): Dir {
    switch (ch) {
        case "U":
        case "N":
            return "up";
        case "D":
        case "S":
            return "down";
        case "L":
        case "W":
            return "left";
        case "R":
        case "E":
            return "right";
        default:
            return "down";
    }
}

function toPhase(name: string): Phase | null {
    const lower = name.toLowerCase();
    if (lower === "walk") return "walk";
    if (lower === "attack") return "attack";
    if (lower === "death") return "death";
    return null;
}

/**
 * Parse a single filename (no path, no extension) into ParsedSheet.
 * Returns null if this file should be ignored by the generic pipeline.
 */
function parseMonsterFilename(baseName: string, url: string): ParsedSheet | null {
    // Special-case skip: projectile, golem puddle/pile, raw wolf/bat/etc.
    if (baseName.startsWith("slime projectile")) return null;
    if (baseName.startsWith("LPC_Monster_Death_Animations")) return null;

    // Golem puddle/pile: you said this is a special manual case
    if (baseName.startsWith("golem death ")) {
        return {
            id: "golem", width: 64, height: 64,
            dirs: undefined,
            sharedDeathRows: 0,
            phaseStarts: {},
            rowCountOverride: 2,
            textureKey: baseName,
            url,
            skip: true
        };
    }

    const tokens = baseName.split(" ").filter(t => t.length > 0);
    if (tokens.length < 2) return null;

    // Find size token: something like 64x64, 48x64, 128x128, etc.
    const sizeIndex = tokens.findIndex(t => /^\d+x\d+$/.test(t));
    if (sizeIndex === -1) {
        // Non-canonical name (e.g. "bat", "wolf light brown")
        return null;
    }

    const idTokens = tokens.slice(0, sizeIndex);
    const id = idTokens.join(" ");

    const [wStr, hStr] = tokens[sizeIndex].split("x");
    const width = parseInt(wStr, 10);
    const height = parseInt(hStr, 10);

    const restTokens = tokens.slice(sizeIndex + 1);

    let dirs: Dir[] | undefined = undefined;
    let sharedDeathRows = 0;
    let rowCountOverride: number | undefined = undefined;
    const phaseStarts: Partial<Record<Phase, number>> = {};

    let i = 0;

    // Detect direction token if present
    if (restTokens[i] && /^[A-Z]+/.test(restTokens[i])) {
        const dirToken = restTokens[i];
        i++;

        // Extract direction letters prefix
        const letters: string[] = [];
        for (const ch of dirToken) {
            if (DIR_LETTERS.has(ch)) letters.push(ch);
            else break;
        }

        if (letters.length > 0) {
            dirs = letters.map(mapLetterToDir);

            const suffix = dirToken.slice(letters.length); // e.g. "Death2" or "Death"
            if (suffix.startsWith("Death")) {
                const nStr = suffix.slice("Death".length);
                sharedDeathRows = nStr.length > 0 ? parseInt(nStr, 10) : 1;
            }
        } else {
            // No valid direction prefix → treat as no dirs
        }
    }

    // Parse the remaining tokens for <number><Phase> and <number>Row
    for (; i < restTokens.length; i++) {
        const token = restTokens[i];

        // Break compound tokens like "1Walk4Attack"
        const re = /(\d+)(Walk|Attack|Death|Row)/gi;
        let m: RegExpExecArray | null;
        while ((m = re.exec(token)) !== null) {
            const num = parseInt(m[1], 10);
            const label = m[2];

            if (label.toLowerCase() === "row") {
                rowCountOverride = num;
            } else {
                const ph = toPhase(label);
                if (ph) {
                    // 1-based column index
                    phaseStarts[ph] = num;
                }
            }
        }
    }

    const textureKey = baseName; // use filename (no extension) as texture key

    // Imp deaths: e.g. "imp blue 64x64 1Death"
    // No dirs token → single-row, single-direction sheet. That’s fine.
    // White golem: has "1Row" override.

    return {
        id,
        width,
        height,
        dirs,
        sharedDeathRows,
        phaseStarts,
        rowCountOverride,
        textureKey,
        url,
        skip: false
    };
}

/* ------------------------------------------------------------------
   3. Build a list of ParsedSheet entries from the glob
------------------------------------------------------------------ */

const PARSED_SHEETS: ParsedSheet[] = [];

for (const [path, url] of Object.entries(monsterPngs)) {
    const fileNameWithExt = path.split(/[\\/]/).pop() || "";
    if (!fileNameWithExt.toLowerCase().endsWith(".png")) continue;
    const baseName = fileNameWithExt.slice(0, -4); // drop ".png"

    const parsed = parseMonsterFilename(baseName, url);
    if (parsed) {
        PARSED_SHEETS.push(parsed);
    }
}



/* ------------------------------------------------------------------
   4. Frame extraction helpers
------------------------------------------------------------------ */

/**
 * Quick heuristic: treat a frame as "empty" if its center pixel alpha is 0.
 * This is intentionally cheap. It correctly filters trailing blank cells
 * in longer rows, which is your main use case.
 */

function isFrameEmpty(
    scene: Phaser.Scene,
    textureKey: string,
    frameIndex: number,
    frameWidth: number,
    frameHeight: number
): boolean {
    // TEMP: disable empty-frame detection.
    // LPC monsters often don't intersect the single sample point we were using,
    // so this was incorrectly treating valid frames as empty and dropping them.
    return false;
}






/**
 * Build frames for a sheet, given its ParsedSheet and a phase.
 * Returns per-direction frame arrays.
 */
function buildFramesForSheet(
    scene: Phaser.Scene,
    sheet: ParsedSheet,
    phase: Phase
): PhaseDirFrames | undefined {
    const startCol = sheet.phaseStarts[phase];
    if (!startCol) return undefined;

    const tex = scene.textures.get(sheet.textureKey);
    if (!tex) {
        console.warn("[monsterAtlas] Texture not found:", sheet.textureKey);
        return undefined;
    }

    const source = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const cols = Math.floor(source.width / sheet.width);

    // Compute end column: until next phase start or end-of-row
    const starts = Object.entries(sheet.phaseStarts)
        .map(([ph, col]) => ({ ph: ph as Phase, col: col! }))
        .sort((a, b) => a.col - b.col);
    let endCol = cols; // 1-based exclusive

    for (const s of starts) {
        if (s.col > startCol) {
            endCol = s.col;
            break;
        }
    }

    const colStart0 = startCol - 1;       // convert to 0-based
    const colEnd0 = endCol - 1;           // exclusive in loop

    const dirFrames: PhaseDirFrames = {};
    const allDirs: Dir[] = ["up", "down", "left", "right"];

    // Case 1: sheet has explicit directions (ULDR/DRUL/etc.)
    if (sheet.dirs && sheet.dirs.length > 0 && !sheet.rowCountOverride) {
        const dirRows = sheet.dirs.length;
        const totalSharedRows = sheet.sharedDeathRows;

        // For death: shared rows appended to each directional row
        let sharedDeathIndices: number[] = [];
        if (phase === "death" && totalSharedRows > 0) {
            const sharedStartRow = dirRows; // 0-based row index
            for (let r = 0; r < totalSharedRows; r++) {
                const row = sharedStartRow + r;
                for (let c = colStart0; c < colEnd0; c++) {
                    const idx = row * cols + c;
                    if (!isFrameEmpty(scene, sheet.textureKey, idx, sheet.width, sheet.height)) {
                        sharedDeathIndices.push(idx);
                    }
                }
            }
        }

        // Build per-direction
        for (let i = 0; i < sheet.dirs.length; i++) {
            const dir = sheet.dirs[i];
            const row = i; // 0-based

            const frames: number[] = [];
            for (let c = colStart0; c < colEnd0; c++) {
                const idx = row * cols + c;
                if (!isFrameEmpty(scene, sheet.textureKey, idx, sheet.width, sheet.height)) {
                    frames.push(idx);
                }
            }

            if (phase === "death" && sharedDeathIndices.length > 0) {
                frames.push(...sharedDeathIndices);
            }

            if (frames.length > 0) {
                dirFrames[dir] = frames;
            }
        }
    }
    // Case 2: single-row / single-direction sheets (imp deaths, 1Row, etc.)
    else {
        const frames: number[] = [];
        const row = 0;
        for (let c = colStart0; c < colEnd0; c++) {
            const idx = row * cols + c;
            if (!isFrameEmpty(scene, sheet.textureKey, idx, sheet.width, sheet.height)) {
                frames.push(idx);
            }
        }
        if (frames.length === 0) return undefined;

        // Replicate same animation for all 4 directions
        for (const dir of allDirs) {
            dirFrames[dir] = frames.slice();
        }
    }

    return dirFrames;
}

/** Fill in missing directions by copying from an available one. */
function fillMissingDirections(phaseFrames: PhaseDirFrames): void {
    const order: Dir[] = ["down", "right", "left", "up"];
    const availableDir = order.find(d => phaseFrames[d] && phaseFrames[d]!.length > 0);
    if (!availableDir) return;

    for (const d of order) {
        if (!phaseFrames[d]) {
            phaseFrames[d] = phaseFrames[availableDir]!.slice();
        }
    }
}

/** Fill in missing phases using Walk as fallback (Attack & Death). */
function fillMissingPhases(set: MonsterAnimSet): void {
    const { phases } = set;
    const walk = phases.walk;

    if (!phases.attack && walk) {
        phases.attack = {};
        for (const dir of ["up", "down", "left", "right"] as Dir[]) {
            const src = walk[dir];
            if (src && src.length > 0) {
                phases.attack[dir] = src.slice();
            }
        }
    }

    if (!phases.death && walk) {
        phases.death = {};
        for (const dir of ["up", "down", "left", "right"] as Dir[]) {
            const src = walk[dir];
            if (src && src.length > 0) {
                phases.death[dir] = [src[src.length - 1]]; // simple: freeze last walk frame
            }
        }
    }
}

/* ------------------------------------------------------------------
   5. Public API
------------------------------------------------------------------ */

/**
 * Call this in HeroScene.preload() to queue all monster sheets.
 */
export function preloadMonsterSheets(scene: Phaser.Scene): void {

    console.log(
        "[monsterAtlas.preloadMonsterSheets] sheets to load:",
        PARSED_SHEETS.map(s =>
            `${s.textureKey} (id="${s.id}", ${s.width}x${s.height}, skip=${!!s.skip})`
        )
    );
    
    for (const sheet of PARSED_SHEETS) {
        // Even "skip" sheets might still need to load, but generic system won't use them.
        scene.load.spritesheet(sheet.textureKey, sheet.url, {
            frameWidth: sheet.width,
            frameHeight: sheet.height
        });
    }
}

/**
 * Build the MonsterAtlas AFTER preload completes (e.g. in HeroScene.create()).
 * This parses sheet metadata into usable frame arrays for each monster.
 */
export function buildMonsterAtlas(scene: Phaser.Scene): MonsterAtlas {
    const byMonster = new Map<string, ParsedSheet[]>();

    for (const sheet of PARSED_SHEETS) {
        if (sheet.skip) continue;
        let list = byMonster.get(sheet.id);
        if (!list) {
            list = [];
            byMonster.set(sheet.id, list);
        }
        list.push(sheet);
    }

    const atlas: MonsterAtlas = {};

    for (const [id, sheets] of byMonster.entries()) {
        const first = sheets[0];

        const animSet: MonsterAnimSet = {
            id,
            frameWidth: first.width,
            frameHeight: first.height,
            textureKeys: sheets.map(s => s.textureKey),
            phases: {}
        };

        // Build phases from each sheet and merge
        for (const sheet of sheets) {
            for (const phase of ["walk", "attack", "death"] as Phase[]) {
                if (!sheet.phaseStarts[phase]) continue;
                const frames = buildFramesForSheet(scene, sheet, phase);
                if (!frames) continue;

                if (!animSet.phases[phase]) {
                    animSet.phases[phase] = {};
                }
                const dest = animSet.phases[phase]!;

                for (const [dir, arr] of Object.entries(frames)) {
                    if (!arr || arr.length === 0) continue;
                    if (!dest[dir]) dest[dir] = [];
                    dest[dir]!.push(...arr);
                }
            }
        }

        // Normalize directions for each phase
        for (const phase of ["walk", "attack", "death"] as Phase[]) {
            const pf = animSet.phases[phase];
            if (pf) fillMissingDirections(pf);
        }

        // Fill missing phases from Walk
        fillMissingPhases(animSet);

        // Only register monsters that ended up with at least a walk animation
        if (animSet.phases.walk) {
            atlas[id] = animSet;

            // Simple alias: also register by last word (e.g. "blue")
            const words = id.split(" ");
            const last = words[words.length - 1];
            if (last && !atlas[last]) {
                atlas[last] = animSet;
            }
        }
    }

    return atlas;
}

/**
 * Helper: get animations for a sprite whose data field "name"
 * holds something like "blue", "imp blue", "spider green", etc.
 */
export function getMonsterAnimForSprite(
    atlas: MonsterAtlas,
    sprite: Phaser.GameObjects.Sprite
): MonsterAnimSet | undefined {
    const name = sprite.getData("name") as string | undefined;
    if (!name) return undefined;
    return atlas[name] || atlas[name.toLowerCase()] || atlas[name.toUpperCase()];
}
