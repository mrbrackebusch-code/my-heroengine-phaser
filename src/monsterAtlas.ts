// src/monsterAtlas.ts
import type Phaser from "phaser";
import { DEBUG_MONSTER_SHEET_PARSE, DEBUG_MONSTER_SPRITES } from "./debugFlags";

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
    /** Optional aura spritesheet texture key (same frame grid) */
    auraTextureKey?: string;
    /** Frames per phase + direction */
    phases: {
        walk?: PhaseDirFrames;
        attack?: PhaseDirFrames;
        death?: PhaseDirFrames;
    };
    /** Optional: which texture key to use for each phase */
    phaseTexture?: Partial<Record<Phase, string>>;
}

export type MonsterAtlas = Record<string, MonsterAnimSet>;

const monsterPngs = {
    ...import.meta.glob(
        "../assets/enemies/monsters/*.png",
        { as: "url", eager: true }
    ),
    ...import.meta.glob(
        "../assets/enemies/bosses/*.png",
        { as: "url", eager: true }
    ),
} as Record<string, string>;

const monsterAuraPngs = {
    ...import.meta.glob(
        "../assets/enemies/monsters/auras/*.png",
        { as: "url", eager: true }
    ),
    ...import.meta.glob(
        "../assets/enemies/bosses/auras/*.png",
        { as: "url", eager: true }
    ),
} as Record<string, string>;

interface ParsedSheet {
    id: string;
    width: number;
    height: number;
    dirs?: Dir[];
    dirToken?: string;
    walkFrames: number;
    attackFrames: number[];
    deathFrames: number;
    deathRows: number;
    textureKey: string;
    url: string;
    sourcePath: string;
    skip: boolean;
}

const DIR_LETTERS = new Set(["U", "D", "L", "R", "N", "E", "S", "W"]);
const CANON_DIRS: Dir[] = ["up", "left", "down", "right"];

function mapLetterToDir(ch: string): Dir {
    switch (ch) {
        case "U":
        case "N": return "up";
        case "D":
        case "S": return "down";
        case "L":
        case "W": return "left";
        case "R":
        case "E": return "right";
        default: return "down";
    }
}

function parseMonsterFilename(baseName: string, url: string, sourcePath: string): ParsedSheet | null {
    const fail = (msg: string): never => {
        throw new Error(`[monsterAtlas.parse] ${msg}: ${sourcePath || baseName}`);
    };

    if (baseName.startsWith("LPC_Monster_Death_Animations")) {
        fail("legacy LPC monster sheet not supported in new naming scheme");
    }

    const tokens = baseName.split(" ").filter(t => t.length > 0);
    if (tokens.length < 2) fail("filename is too short to parse");

    const sizeIndex = tokens.findIndex(t => /^\d+x\d+$/.test(t));
    if (sizeIndex === -1) fail("missing WxH token");

    const idTokens = tokens.slice(0, sizeIndex);
    if (idTokens.length === 0) fail("missing monster name");
    const id = idTokens.join(" ");

    const [wStr, hStr] = tokens[sizeIndex].split("x");
    const width = parseInt(wStr, 10);
    const height = parseInt(hStr, 10);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        fail("invalid WxH token");
    }

    const restTokens = tokens.slice(sizeIndex + 1);
    if (restTokens.length === 0) fail("missing DIRS token");

    let dirs: Dir[] | undefined = undefined;
    let dirToken: string | undefined = undefined;
    let walkFrames = 0;
    let deathFrames = 0;
    let deathRows = 0;
    const attackMap = new Map<number, number>();

    let i = 0;
    if (restTokens[i] && /^[A-Za-z]+$/.test(restTokens[i]) && !restTokens[i].includes("=")) {
        const token = restTokens[i].toUpperCase();
        const letters = token.split("").filter(ch => DIR_LETTERS.has(ch));
        if (letters.length !== 4) fail("DIRS token must be exactly 4 letters (e.g., ULDR)");
        const unique = new Set(letters);
        if (unique.size !== 4) fail("DIRS token must use each direction once");
        dirs = letters.map(mapLetterToDir);
        dirToken = token;
        i++;
    } else {
        fail("DIRS token missing or malformed");
    }

    const seenKeys = new Set<string>();

    for (; i < restTokens.length; i++) {
        const token = restTokens[i];
        if (!token.includes("=")) {
            fail(`unexpected token "${token}" (expected key=value)`);
        }
        const parts = token.split("=");
        if (parts.length < 2) continue;
        const key = parts[0].trim().toLowerCase();
        const val = parseInt(parts.slice(1).join("=").trim(), 10);
        if (!Number.isFinite(val)) continue;
        if (seenKeys.has(key)) fail(`duplicate token "${key}"`);
        seenKeys.add(key);

        if (key === "w") {
            walkFrames = val;
        } else if (key === "d") {
            deathFrames = val;
        } else if (key === "drows") {
            deathRows = val;
        } else if (key.startsWith("a")) {
            const idxRaw = key.slice(1);
            const idx = idxRaw.length > 0 ? parseInt(idxRaw, 10) : 1;
            if (Number.isFinite(idx) && idx > 0) {
                attackMap.set(idx, val);
            }
        } else {
            fail(`unknown token "${key}"`);
        }
    }

    if (!seenKeys.has("w")) fail("missing required w=<walkFrames>");
    if (!seenKeys.has("drows")) fail("missing required drows=<0|1|4>");
    if (![0, 1, 4].includes(deathRows)) fail("drows must be 0, 1, or 4");

    const attackFrames: number[] = [];
    const attackKeys = Array.from(attackMap.keys()).sort((a, b) => a - b);
    if (attackKeys.length > 0) {
        for (let idx = 1; idx <= attackKeys[attackKeys.length - 1]; idx++) {
            if (!attackMap.has(idx)) fail(`missing a${idx}=<frames> token`);
        }
    }
    for (const k of attackKeys) {
        const v = attackMap.get(k);
        if (v != null) attackFrames.push(v);
    }

    if (walkFrames <= 0) fail("walk frames must be > 0");

    if (DEBUG_MONSTER_SHEET_PARSE) {
        console.log("[monsterAtlas.parse]", {
            base: baseName,
            id,
            size: `${width}x${height}`,
            dirs: dirs && dirs.length > 0 ? dirs : CANON_DIRS,
            dirToken,
            walkFrames,
            attackFrames,
            deathFrames,
            deathRows
        });
    }

    return {
        id,
        width,
        height,
        dirs,
        dirToken,
        walkFrames,
        attackFrames,
        deathFrames,
        deathRows,
        textureKey: baseName,
        url,
        sourcePath,
        skip: false
    };
}

const PARSED_SHEETS: ParsedSheet[] = [];

type FrameOverride = {
    phase: Phase;
    dir?: Dir;
    maxFrames?: number;
    trimTail?: number;
};

// Special-case per-sheet frame overrides for irregular sheets.
const SHEET_FRAME_OVERRIDES: Record<string, FrameOverride[]> = {
    // "slime 64x64 ULDR 1Walk.png" – rows 0 (U) and 2 (D) have 2 fewer frames.
    "slime 64x64 ULDR 1Walk": [
        { phase: "walk", dir: "up", trimTail: 2 },
        { phase: "walk", dir: "down", trimTail: 2 }
    ]
};

for (const [path, url] of Object.entries(monsterPngs)) {
    const fileNameWithExt = path.split(/[\\/]/).pop() || "";
    if (!fileNameWithExt.toLowerCase().endsWith(".png")) continue;
    const baseName = fileNameWithExt.slice(0, -4);
    const parsed = parseMonsterFilename(baseName, url, path);
    if (!parsed) {
        throw new Error(`[monsterAtlas.parse] invalid monster sheet filename: ${path}`);
    }
    PARSED_SHEETS.push(parsed);
}

function isFrameEmpty(): boolean {
    return false;
}

function applyFrameOverrides(
    sheet: ParsedSheet,
    phase: Phase,
    dirFrames: PhaseDirFrames
): void {
    const overrides =
        SHEET_FRAME_OVERRIDES[sheet.textureKey] ||
        SHEET_FRAME_OVERRIDES[sheet.id];
    if (!overrides || overrides.length === 0) return;

    for (const ov of overrides) {
        if (ov.phase !== phase) continue;
        const dirs: Dir[] = ov.dir ? [ov.dir] : (Object.keys(dirFrames) as Dir[]);
        for (const d of dirs) {
            const frames = dirFrames[d];
            if (!frames || frames.length === 0) continue;

            let out = frames;
            if (typeof ov.maxFrames === "number") {
                out = out.slice(0, Math.max(0, ov.maxFrames));
            }
            if (typeof ov.trimTail === "number" && ov.trimTail > 0) {
                out = out.slice(0, Math.max(0, out.length - ov.trimTail));
            }
            dirFrames[d] = out;
        }
    }
}

function buildFramesForSheet(
    scene: Phaser.Scene,
    sheet: ParsedSheet,
    phase: Phase
): PhaseDirFrames | undefined {
    const tex = scene.textures.get(sheet.textureKey);
    if (!tex) return undefined;

    const source = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const cols = Math.floor(source.width / sheet.width);
    const rows = Math.floor(source.height / sheet.height);
    if (cols <= 0 || rows <= 0) return undefined;

    const dirOrder =
        sheet.dirs && sheet.dirs.length >= 4
            ? sheet.dirs.slice(0, 4)
            : CANON_DIRS;

    const attackCount = sheet.attackFrames.length | 0;
    const deathRows = sheet.deathRows | 0;
    const expectedRows = (4 * (1 + attackCount)) + (deathRows > 0 ? deathRows : 0);
    if (expectedRows > 0 && rows !== expectedRows) {
        throw new Error(
            `[monsterAtlas.frames] row count mismatch for ${sheet.textureKey}: expected ${expectedRows}, got ${rows}`
        );
    }

    const maxTokenFrames = Math.max(
        sheet.walkFrames | 0,
        ...sheet.attackFrames.map(v => v | 0),
        sheet.deathFrames | 0
    );
    if (maxTokenFrames > cols) {
        throw new Error(
            `[monsterAtlas.frames] column count too small for ${sheet.textureKey}: cols=${cols}, maxFrames=${maxTokenFrames}`
        );
    }

    if (DEBUG_MONSTER_SHEET_PARSE) {
        console.log("[monsterAtlas.frames]", {
            id: sheet.id,
            phase,
            cols,
            rows,
            expectedRows,
            walkFrames: sheet.walkFrames,
            attackFrames: sheet.attackFrames,
            deathFrames: sheet.deathFrames,
            deathRows: sheet.deathRows,
            dirs: dirOrder
        });
        if (expectedRows > 0 && rows !== expectedRows) {
            console.log("[monsterAtlas.frames] row mismatch", {
                id: sheet.id,
                phase,
                rows,
                expectedRows
            });
        }
    }

    const rowFrames = (row: number, frameCount: number): number[] => {
        if (row < 0 || row >= rows) return [];
        const count = frameCount > 0 ? Math.min(frameCount | 0, cols) : cols;
        const frames: number[] = [];
        for (let c = 0; c < count; c++) {
            frames.push(row * cols + c);
        }
        return frames;
    };

    const buildBlock = (rowStart: number, frameCount: number): PhaseDirFrames | undefined => {
        if ((rowStart + 3) >= rows) {
            throw new Error(
                `[monsterAtlas.frames] row block exceeds sheet for ${sheet.textureKey}: rowStart=${rowStart}, rows=${rows}`
            );
        }
        const out: PhaseDirFrames = {};
        for (let i = 0; i < 4; i++) {
            const row = rowStart + i;
            const dir = dirOrder[i] || CANON_DIRS[i];
            const frames = rowFrames(row, frameCount);
            if (frames.length > 0) out[dir] = frames;
        }
        return Object.keys(out).length > 0 ? out : undefined;
    };

    if (phase === "walk") {
        const walk = buildBlock(0, sheet.walkFrames);
        if (!walk) return undefined;
        applyFrameOverrides(sheet, phase, walk);
        return walk;
    }

    if (phase === "attack") {
        if (attackCount <= 0) return undefined;
        const out: PhaseDirFrames = {};
        for (let i = 0; i < attackCount; i++) {
            const framesPerRow = sheet.attackFrames[i] | 0;
            const block = buildBlock(4 * (1 + i), framesPerRow);
            if (!block) continue;
            for (const [dir, arr] of Object.entries(block)) {
                if (!arr || arr.length === 0) continue;
                if (!out[dir]) out[dir] = [];
                out[dir]!.push(...arr);
            }
        }
        if (Object.keys(out).length === 0) return undefined;
        applyFrameOverrides(sheet, phase, out);
        return out;
    }

    if (phase === "death") {
        if (deathRows <= 0) return undefined;
        const baseRow = 4 * (1 + attackCount);
        const frameCount = sheet.deathFrames > 0 ? sheet.deathFrames : cols;

        if (deathRows === 1) {
            const frames = rowFrames(baseRow, frameCount);
            if (frames.length === 0) return undefined;
            const out: PhaseDirFrames = {};
            for (const dir of CANON_DIRS) {
                out[dir] = frames.slice();
            }
            applyFrameOverrides(sheet, phase, out);
            return out;
        }

        if (deathRows === 4) {
            const block = buildBlock(baseRow, frameCount);
            if (!block) return undefined;
            applyFrameOverrides(sheet, phase, block);
            return block;
        }

        return undefined;
    }

    return undefined;
}

function fillMissingDirections(phaseFrames: PhaseDirFrames): void {
    const order: Dir[] = ["down", "right", "left", "up"];
    const base = order.find(d => phaseFrames[d] && phaseFrames[d]!.length > 0);
    if (!base) return;
    for (const d of order) {
        if (!phaseFrames[d]) phaseFrames[d] = phaseFrames[base]!.slice();
    }
}

function fillMissingPhases(set: MonsterAnimSet): void {
    const walk = set.phases.walk;
    if (!walk) return;

    if (!set.phases.attack) {
        set.phases.attack = {};
        for (const dir of ["up", "down", "left", "right"] as Dir[]) {
            if (walk[dir]) set.phases.attack[dir] = walk[dir]!.slice();
        }
    }

    if (!set.phases.death) {
        set.phases.death = {};
        for (const dir of ["up", "down", "left", "right"] as Dir[]) {
            if (walk[dir]) set.phases.death[dir] = [walk[dir]![walk[dir]!.length - 1]];
        }
    }
}

export function preloadMonsterSheets(scene: Phaser.Scene): void {
    if (DEBUG_MONSTER_SPRITES) {
    console.log("[monsterAtlas.preloadMonsterSheets] sheets to load:",
        PARSED_SHEETS.map(s =>
            `${s.textureKey} (id="${s.id}", ${s.width}x${s.height}, skip=${!!s.skip})`
        )
    );
    }

    // Build aura lookup by baseName (filename without .png) from aura subfolders.
    const auraUrlByBase = new Map<string, string>();
    for (const [p, url] of Object.entries(monsterAuraPngs)) {
        const file = p.split(/[\\/]/).pop() || "";
        if (!file.toLowerCase().endsWith(".png")) continue;
        const base = file.slice(0, -4); // strip .png
        auraUrlByBase.set(base, url);
    }
    
    for (const sheet of PARSED_SHEETS) {
        scene.load.spritesheet(sheet.textureKey, sheet.url, {
            frameWidth: sheet.width,
            frameHeight: sheet.height
        });

        // Optional: matching aura sheet (same grid), if present.
        const auraBase = `${sheet.textureKey}_aura_r2`;
        const auraUrl = auraUrlByBase.get(auraBase);
        if (auraUrl) {
            scene.load.spritesheet(auraBase, auraUrl, {
                frameWidth: sheet.width,
                frameHeight: sheet.height
            });
        }
    }
}

/* ------------------------------------------------------------------
   5. FULLY PATCHED buildMonsterAtlas
------------------------------------------------------------------ */

// Debug flag lives in src/debugFlags.ts

export function buildMonsterAtlas(scene: Phaser.Scene): MonsterAtlas {
    const byMonster = new Map<string, ParsedSheet[]>();

    // Aura lookup (baseName -> url) for optional attachment.
    const auraUrlByBase = new Map<string, string>();
    for (const [p, url] of Object.entries(monsterAuraPngs)) {
        const file = p.split(/[\\/]/).pop() || "";
        if (!file.toLowerCase().endsWith(".png")) continue;
        const base = file.slice(0, -4); // strip .png
        auraUrlByBase.set(base, url);
    }

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

        const orderedSheets = sheets.slice().sort((a, b) => {
            const scoreA = (a.walkFrames | 0) + (a.attackFrames.length * 10) + ((a.deathRows | 0) * 5);
            const scoreB = (b.walkFrames | 0) + (b.attackFrames.length * 10) + ((b.deathRows | 0) * 5);
            return scoreB - scoreA;
        });

        const sheet = orderedSheets[0];
        if (!sheet) {
            console.warn("[monsterAtlas.build] no usable sheets for monster id:", id, "sheets=", sheets.map(s => s.textureKey));
            continue;
        }

        if (DEBUG_MONSTER_SHEET_PARSE && orderedSheets.length > 1) {
            console.log("[monsterAtlas.build] multiple sheets for", id, "picked", sheet.textureKey, "all", orderedSheets.map(s => s.textureKey));
        }

        const animSet: MonsterAnimSet = {
            id,
            frameWidth: sheet.width,
            frameHeight: sheet.height,
            textureKeys: orderedSheets.map(s => s.textureKey),
            auraTextureKey: undefined,
            phases: {}
        };

        const phaseTexture: Partial<Record<Phase, string>> = {};

        const walkFrames = buildFramesForSheet(scene, sheet, "walk");
        if (walkFrames) {
            animSet.phases.walk = walkFrames;
            phaseTexture.walk = sheet.textureKey;
        }

        const attackFrames = buildFramesForSheet(scene, sheet, "attack");
        if (attackFrames) {
            animSet.phases.attack = attackFrames;
            phaseTexture.attack = sheet.textureKey;
        }

        const deathFrames = buildFramesForSheet(scene, sheet, "death");
        if (deathFrames) {
            animSet.phases.death = deathFrames;
            phaseTexture.death = sheet.textureKey;
        }

        animSet.phaseTexture = phaseTexture;

        // Optional aura spritesheet (matches any of the chosen sheet bases).
        const auraCandidate =
            auraUrlByBase.get(`${sheet.textureKey}_aura_r2`) ||
            auraUrlByBase.get(`${id}_aura_r2`);
        if (auraCandidate) {
            // Texture key matches the load key in preloadMonsterSheets.
            animSet.auraTextureKey = `${sheet.textureKey}_aura_r2`;
        }

        for (const phase of ["walk", "attack", "death"] as Phase[]) {
            const pf = animSet.phases[phase];
            if (pf) fillMissingDirections(pf);
        }

        fillMissingPhases(animSet);

        if (DEBUG_MONSTER_SHEET_PARSE) {
            const countFrames = (pf?: PhaseDirFrames): number => {
                if (!pf) return 0;
                let best = 0;
                for (const arr of Object.values(pf)) {
                    const len = arr ? arr.length : 0;
                    if (len > best) best = len;
                }
                return best;
            };
            console.log("[monsterAtlas.build.frames]", {
                id,
                walk: countFrames(animSet.phases.walk),
                attack: countFrames(animSet.phases.attack),
                death: countFrames(animSet.phases.death),
            });
        }

        if (animSet.phases.walk) {
            atlas[id] = animSet;

            const parts = id.split(" ");
            const last = parts[parts.length - 1];
            if (last && !atlas[last]) atlas[last] = animSet;

            const walkDirs =
                animSet.phases.walk
                    ? Object.keys(animSet.phases.walk)
                    : [];

            const attackDirs =
                animSet.phases.attack
                    ? Object.keys(animSet.phases.attack)
                    : [];

            const deathDirs =
                animSet.phases.death
                    ? Object.keys(animSet.phases.death)
                    : [];

            if (DEBUG_MONSTER_SPRITES) {
            console.log(
                "[monsterAtlas.build] anims for",
                id,
                "| walk=", walkDirs,
                "| attack=", attackDirs,
                "| death=", deathDirs
            );
        }
        
        }
    }

    return atlas;
}

export function getMonsterAnimForSprite(
    atlas: MonsterAtlas,
    sprite: Phaser.GameObjects.Sprite
): MonsterAnimSet | undefined {
    const name = sprite.getData("name") as string | undefined;
    if (!name) return undefined;
    return atlas[name] || atlas[name.toLowerCase()] || atlas[name.toUpperCase()];
}
