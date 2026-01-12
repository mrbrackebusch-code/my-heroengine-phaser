// src/effectAtlas.ts
import type Phaser from "phaser";

export type EffectDir = "up" | "down" | "left" | "right" | "none";

export type EffectClipLayout =
    | { kind: "frames"; frames: number[] }
    | { kind: "row"; row: number; startCol?: number; count: number; step?: number }
    | { kind: "grid"; startRow: number; startCol: number; rows: number; cols: number; count?: number; order?: "row" | "col" }
    | { kind: "sheet"; order?: "row" | "col" };

export interface EffectClipDef {
    layout: EffectClipLayout;
    frameRate: number;
    repeat: number; // -1 loop, 0 play once
}

export interface EffectDirDef {
    sheetId: string;
    clip: EffectClipDef;
}

export interface EffectSkinDef {
    id: string;
    dirs: Partial<Record<EffectDir, EffectDirDef>>;
    defaultDir?: EffectDir;
}

export interface EffectClipResolved {
    textureKey: string;
    frameIndices: number[];
    frameRate: number;
    repeat: number;
}

export interface EffectSkinResolved {
    id: string;
    defaultDir: EffectDir;
    dirs: Partial<Record<EffectDir, EffectClipResolved>>;
}

export type EffectAtlas = Record<string, EffectSkinResolved>;

export interface EffectSheetDef {
    id: string;
    file: string;
    frameW: number;
    frameH: number;
}

const effectPngs = import.meta.glob("../assets/animations/*.png", {
    as: "url",
    eager: true
}) as Record<string, string>;

function basenameNoExt(p: string): string {
    const file = p.split(/[\\/]/).pop() || p;
    return file.replace(/\.png$/i, "");
}

function resolveEffectUrl(file: string): string {
    const wanted = file.toLowerCase();
    for (const [path, url] of Object.entries(effectPngs)) {
        const base = basenameNoExt(path).toLowerCase();
        if (base + ".png" === wanted || base === wanted.replace(/\.png$/i, "")) {
            return url;
        }
    }
    return "";
}

const EFFECT_SHEETS: Record<string, EffectSheetDef> = {
    firelion_down: { id: "firelion_down", file: "firelion_down.png", frameW: 64, frameH: 64 },
    firelion_left: { id: "firelion_left", file: "firelion_left.png", frameW: 64, frameH: 64 },
    firelion_right: { id: "firelion_right", file: "firelion_right.png", frameW: 64, frameH: 64 },
    firelion_up: { id: "firelion_up", file: "firelion_up.png", frameW: 64, frameH: 64 },
    spikes: { id: "spikes", file: "spikes.png", frameW: 64, frameH: 64 },
    lightningclaw: { id: "lightningclaw", file: "lightningclaw.png", frameW: 64, frameH: 64 }
};

const EFFECT_SKINS: EffectSkinDef[] = [
    {
        id: "firelion",
        defaultDir: "down",
        dirs: {
            down: { sheetId: "firelion_down", clip: { layout: { kind: "sheet" }, frameRate: 12, repeat: -1 } },
            up: { sheetId: "firelion_up", clip: { layout: { kind: "sheet" }, frameRate: 12, repeat: -1 } },
            left: { sheetId: "firelion_left", clip: { layout: { kind: "sheet" }, frameRate: 12, repeat: -1 } },
            right: { sheetId: "firelion_right", clip: { layout: { kind: "sheet" }, frameRate: 12, repeat: -1 } }
        }
    },
    {
        id: "lightningclaw",
        defaultDir: "down",
        dirs: {
            down: { sheetId: "lightningclaw", clip: { layout: { kind: "sheet" }, frameRate: 14, repeat: 0 } }
        }
    },
    {
        id: "ring_pulse",
        defaultDir: "down",
        dirs: {
            down: { sheetId: "lightningclaw", clip: { layout: { kind: "sheet" }, frameRate: 14, repeat: 0 } }
        }
    },
    {
        id: "spikes_earth_single",
        defaultDir: "none",
        dirs: {
            none: { sheetId: "spikes", clip: { layout: { kind: "row", row: 0, startCol: 0, count: 10 }, frameRate: 12, repeat: 0 } }
        }
    },
    {
        id: "spikes_earth_multi",
        defaultDir: "none",
        dirs: {
            none: { sheetId: "spikes", clip: { layout: { kind: "row", row: 1, startCol: 0, count: 10 }, frameRate: 12, repeat: 0 } }
        }
    },
    {
        id: "spikes_ice_single",
        defaultDir: "none",
        dirs: {
            none: { sheetId: "spikes", clip: { layout: { kind: "row", row: 2, startCol: 0, count: 10 }, frameRate: 12, repeat: 0 } }
        }
    },
    {
        id: "spikes_ice_multi",
        defaultDir: "none",
        dirs: {
            none: { sheetId: "spikes", clip: { layout: { kind: "row", row: 3, startCol: 0, count: 10 }, frameRate: 12, repeat: 0 } }
        }
    }
];

export function preloadEffectSheets(scene: Phaser.Scene): void {
    for (const sheet of Object.values(EFFECT_SHEETS)) {
        const url = resolveEffectUrl(sheet.file);
        if (!url) {
            console.warn("[effectAtlas] missing url for", sheet.file);
            continue;
        }
        scene.load.spritesheet(sheet.id, url, {
            frameWidth: sheet.frameW,
            frameHeight: sheet.frameH
        });
    }
}

function resolveFrames(
    layout: EffectClipLayout,
    cols: number,
    rows: number
): number[] {
    if (layout.kind === "frames") {
        return layout.frames.slice();
    }

    if (layout.kind === "row") {
        const startCol = layout.startCol ?? 0;
        const step = layout.step ?? 1;
        const out: number[] = [];
        for (let i = 0; i < layout.count; i++) {
            const col = startCol + i * step;
            if (col < 0 || col >= cols) break;
            out.push(layout.row * cols + col);
        }
        return out;
    }

    if (layout.kind === "grid") {
        const out: number[] = [];
        const order = layout.order ?? "row";
        const maxCount = layout.count ?? (layout.rows * layout.cols);
        let pushed = 0;

        const push = (r: number, c: number) => {
            if (pushed >= maxCount) return;
            const rr = layout.startRow + r;
            const cc = layout.startCol + c;
            if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) return;
            out.push(rr * cols + cc);
            pushed++;
        };

        if (order === "col") {
            for (let c = 0; c < layout.cols; c++) {
                for (let r = 0; r < layout.rows; r++) push(r, c);
            }
        } else {
            for (let r = 0; r < layout.rows; r++) {
                for (let c = 0; c < layout.cols; c++) push(r, c);
            }
        }

        return out;
    }

    const total = rows * cols;
    const out: number[] = [];
    const order = layout.order ?? "row";
    if (order === "col") {
        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < rows; r++) {
                out.push(r * cols + c);
            }
        }
    } else {
        for (let i = 0; i < total; i++) out.push(i);
    }
    return out;
}

export function buildEffectAtlas(scene: Phaser.Scene): EffectAtlas {
    const atlas: EffectAtlas = {};

    for (const skin of EFFECT_SKINS) {
        const resolved: EffectSkinResolved = {
            id: skin.id,
            defaultDir: skin.defaultDir ?? "down",
            dirs: {}
        };

        for (const [dirKey, dirDef] of Object.entries(skin.dirs)) {
            const dir = dirKey as EffectDir;
            const sheet = EFFECT_SHEETS[dirDef.sheetId];
            if (!sheet) continue;

            const tex = scene.textures.get(sheet.id);
            const source = tex?.getSourceImage?.() as HTMLImageElement | HTMLCanvasElement | undefined;
            if (!source) continue;

            const cols = Math.floor(source.width / sheet.frameW);
            const rows = Math.floor(source.height / sheet.frameH);
            if (cols <= 0 || rows <= 0) continue;

            const frameIndices = resolveFrames(dirDef.clip.layout, cols, rows);
            if (!frameIndices.length) continue;

            resolved.dirs[dir] = {
                textureKey: sheet.id,
                frameIndices,
                frameRate: dirDef.clip.frameRate,
                repeat: dirDef.clip.repeat
            };
        }

        atlas[skin.id] = resolved;
    }

    try {
        scene.registry.set("effectAtlas", atlas);
        (globalThis as any).__effectAtlas = atlas;
    } catch { }

    return atlas;
}
