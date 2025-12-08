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

export type MonsterAtlas = Record<string, MonsterAnimSet>;

const monsterPngs = import.meta.glob(
    "../assets/monsters/*.png",
    { as: "url", eager: true }
) as Record<string, string>;

interface ParsedSheet {
    id: string;
    width: number;
    height: number;
    dirs?: Dir[];
    sharedDeathRows: number;
    phaseStarts: Partial<Record<Phase, number>>;
    rowCountOverride?: number;
    textureKey: string;
    url: string;
    skip: boolean;
}

const DIR_LETTERS = new Set(["U", "D", "L", "R", "N", "E", "S", "W"]);

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

function toPhase(name: string): Phase | null {
    const lower = name.toLowerCase();
    if (lower === "walk") return "walk";
    if (lower === "attack") return "attack";
    if (lower === "death") return "death";
    return null;
}

function parseMonsterFilename(baseName: string, url: string): ParsedSheet | null {
    if (baseName.startsWith("LPC_Monster_Death_Animations")) return null;

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

    const sizeIndex = tokens.findIndex(t => /^\d+x\d+$/.test(t));
    if (sizeIndex === -1) return null;

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

    if (restTokens[i] && /^[A-Z]+/.test(restTokens[i])) {
        const dirToken = restTokens[i];
        i++;

        const letters: string[] = [];
        for (const ch of dirToken) {
            if (DIR_LETTERS.has(ch)) letters.push(ch);
            else break;
        }

        if (letters.length > 0) {
            dirs = letters.map(mapLetterToDir);

            const suffix = dirToken.slice(letters.length);
            if (suffix.startsWith("Death")) {
                const nStr = suffix.slice("Death".length);
                sharedDeathRows = nStr.length > 0 ? parseInt(nStr, 10) : 1;
            }
        }
    }

    for (; i < restTokens.length; i++) {
        const token = restTokens[i];
        const re = /(\d+)(Walk|Attack|Death|Row)/gi;
        let m: RegExpExecArray | null;
        while ((m = re.exec(token)) !== null) {
            const num = parseInt(m[1], 10);
            const label = m[2];
            if (label.toLowerCase() === "row") {
                rowCountOverride = num;
            } else {
                const ph = toPhase(label);
                if (ph) phaseStarts[ph] = num;
            }
        }
    }

    return {
        id,
        width,
        height,
        dirs,
        sharedDeathRows,
        phaseStarts,
        rowCountOverride,
        textureKey: baseName,
        url,
        skip: false
    };
}

const PARSED_SHEETS: ParsedSheet[] = [];

for (const [path, url] of Object.entries(monsterPngs)) {
    const fileNameWithExt = path.split(/[\\/]/).pop() || "";
    if (!fileNameWithExt.toLowerCase().endsWith(".png")) continue;
    const baseName = fileNameWithExt.slice(0, -4);
    const parsed = parseMonsterFilename(baseName, url);
    if (parsed) PARSED_SHEETS.push(parsed);
}

function isFrameEmpty(): boolean {
    return false;
}

function buildFramesForSheet(
    scene: Phaser.Scene,
    sheet: ParsedSheet,
    phase: Phase
): PhaseDirFrames | undefined {
    const startCol = sheet.phaseStarts[phase];
    if (!startCol) return undefined;

    const tex = scene.textures.get(sheet.textureKey);
    if (!tex) return undefined;

    const source = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const cols = Math.floor(source.width / sheet.width);

    const starts = Object.entries(sheet.phaseStarts)
        .map(([ph, col]) => ({ ph: ph as Phase, col: col! }))
        .sort((a, b) => a.col - b.col);

    let endCol = cols;
    for (const s of starts) {
        if (s.col > startCol) {
            endCol = s.col;
            break;
        }
    }

    const colStart0 = startCol - 1;
    const colEnd0 = endCol - 1;

    const dirFrames: PhaseDirFrames = {};
    const allDirs: Dir[] = ["up", "down", "left", "right"];

    if (sheet.dirs && sheet.dirs.length > 0 && !sheet.rowCountOverride) {
        const dirRows = sheet.dirs.length;
        const totalSharedRows = sheet.sharedDeathRows;

        let sharedDeath: number[] = [];
        if (phase === "death" && totalSharedRows > 0) {
            const sharedStart = dirRows;
            for (let r = 0; r < totalSharedRows; r++) {
                const row = sharedStart + r;
                for (let c = colStart0; c < colEnd0; c++) {
                    sharedDeath.push(row * cols + c);
                }
            }
        }

        for (let i = 0; i < sheet.dirs.length; i++) {
            const row = i;
            const dir = sheet.dirs[i];
            const frames: number[] = [];
            for (let c = colStart0; c < colEnd0; c++) {
                frames.push(row * cols + c);
            }
            if (phase === "death" && sharedDeath.length > 0) {
                frames.push(...sharedDeath);
            }
            if (frames.length > 0) dirFrames[dir] = frames;
        }
    } else {
        const row = 0;
        const frames: number[] = [];
        for (let c = colStart0; c < colEnd0; c++) {
            frames.push(row * cols + c);
        }
        if (frames.length === 0) return undefined;

        for (const dir of allDirs) {
            dirFrames[dir] = frames.slice();
        }
    }

    return dirFrames;
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
    console.log("[monsterAtlas.preloadMonsterSheets] sheets to load:",
        PARSED_SHEETS.map(s =>
            `${s.textureKey} (id="${s.id}", ${s.width}x${s.height}, skip=${!!s.skip})`
        )
    );

    for (const sheet of PARSED_SHEETS) {
        scene.load.spritesheet(sheet.textureKey, sheet.url, {
            frameWidth: sheet.width,
            frameHeight: sheet.height
        });
    }
}

/* ------------------------------------------------------------------
   5. FULLY PATCHED buildMonsterAtlas
------------------------------------------------------------------ */

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

        // ------------------------------------------------------
        // PATCH: Select the correct sheets for each phase
        // ------------------------------------------------------
        const walkSheets   = sheets.filter(s => s.phaseStarts.walk);
        const attackSheets = sheets.filter(s => s.phaseStarts.attack);
        const deathSheets  = sheets.filter(s => s.phaseStarts.death);

        function preferDirectional(list: ParsedSheet[]): ParsedSheet[] {
            return list.sort((a, b) => {
                const aDir = a.dirs ? 1 : 0;
                const bDir = b.dirs ? 1 : 0;
                return bDir - aDir;
            });
        }

        preferDirectional(walkSheets);
        preferDirectional(attackSheets);
        preferDirectional(deathSheets);

        const selected = new Set<ParsedSheet>();
        if (walkSheets.length > 0) selected.add(walkSheets[0]);
        if (attackSheets.length > 0) selected.add(attackSheets[0]);
        if (deathSheets.length > 0) selected.add(deathSheets[0]);

        const orderedSheets = Array.from(selected);

        const first = orderedSheets[0];

        const animSet: MonsterAnimSet = {
            id,
            frameWidth: first.width,
            frameHeight: first.height,
            textureKeys: orderedSheets.map(s => s.textureKey),
            phases: {}
        };

        // Build phases only from selected sheets
        for (const sheet of orderedSheets) {
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

        for (const phase of ["walk", "attack", "death"] as Phase[]) {
            const pf = animSet.phases[phase];
            if (pf) fillMissingDirections(pf);
        }

        fillMissingPhases(animSet);

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

            console.log(
                "[monsterAtlas.build] anims for",
                id,
                "| walk=", walkDirs,
                "| attack=", attackDirs,
                "| death=", deathDirs
            );
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
