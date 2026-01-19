// src/effectAtlas.ts
import type Phaser from "phaser";
import { DEBUG_EFFECT_ATLAS } from "./debugFlags";
import { queueSpritesheetOnce } from "./loaderCache";

export type EffectDir = "up" | "down" | "left" | "right" | "none";

export type EffectPalette = {
    colors: number[];
    tint: number;
};

export interface EffectResolved {
    id: string;
    textureKey: string;
    url: string;
    frameIndices: number[];
    frameRate: number;
    repeat: number;
    frameW: number;
    frameH: number;
    palette?: EffectPalette;
    collisionBounds?: EffectCollisionBounds;
}

export type EffectCollisionBounds = {
    frameIndex: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    w: number;
    h: number;
    centerX: number;
    centerY: number;
};

export type EffectAtlas = Record<string, EffectResolved>;

export interface EffectSheetDef {
    id: string;
    baseName: string;
    textureKey: string;
    url: string;
    frameW: number;
    frameH: number;
}

const effectPngs = import.meta.glob("../assets/effects/**/*.png", {
    as: "url",
    eager: true
}) as Record<string, string>;

const EFFECT_DEFAULT_FPS = 12;
const EFFECT_DEFAULT_REPEAT = 0;
const EFFECT_PALETTE_MAX_COLORS = 8;
const EFFECT_PALETTE_ALPHA_MIN = 12;
const EFFECT_SKIP_EMPTY_FRAMES = true;
const EFFECT_EMPTY_ALPHA_MIN = 8;
const EFFECT_FORCE_LAST_FRAME_IDS = new Set<string>(["arrow"]);

function basenameNoExt(p: string): string {
    const file = p.split(/[\\/]/).pop() || p;
    return file.replace(/\.png$/i, "");
}

function parseSizeFromName(name: string): { id: string; frameW: number; frameH: number } | null {
    const match = /^(.*?)(?:\s+)(\d+)x(\d+)$/i.exec(name);
    if (!match) return null;
    const id = String(match[1] || "").trim();
    if (!id) return null;
    const frameW = parseInt(match[2], 10) | 0;
    const frameH = parseInt(match[3], 10) | 0;
    if (frameW <= 0 || frameH <= 0) return null;
    return { id, frameW, frameH };
}

const EFFECT_SHEETS: EffectSheetDef[] = [];
const EFFECT_SHEET_BY_ID = new Map<string, EffectSheetDef>();
const EFFECT_DUPLICATE_IDS: string[] = [];
const EFFECT_MISSING_SIZE: string[] = [];

for (const [path, url] of Object.entries(effectPngs)) {
    if (/[\\/](?:auras)[\\/]/i.test(path)) continue;
    const baseName = basenameNoExt(path);
    const size = parseSizeFromName(baseName);
    if (!size) {
        EFFECT_MISSING_SIZE.push(baseName);
        continue;
    }

    if (EFFECT_SHEET_BY_ID.has(size.id)) {
        EFFECT_DUPLICATE_IDS.push(size.id);
        continue;
    }

    const sheet: EffectSheetDef = {
        id: size.id,
        baseName,
        textureKey: `effects.${size.id}`,
        url,
        frameW: size.frameW,
        frameH: size.frameH
    };

    EFFECT_SHEET_BY_ID.set(size.id, sheet);
    EFFECT_SHEETS.push(sheet);
}

function _warnEffectSheetIssues(): void {
    if (EFFECT_DUPLICATE_IDS.length) {
        console.warn("[effectAtlas] duplicate effect ids:", EFFECT_DUPLICATE_IDS.join(", "));
    }
    if (EFFECT_MISSING_SIZE.length) {
        throw new Error(
            "[effectAtlas] effect sheets must include WxH in filename (tiles are the only exception). Missing: " +
            EFFECT_MISSING_SIZE.join(", ")
        );
    }
}

function _extractPaletteFromSource(
    source: HTMLImageElement | HTMLCanvasElement,
    maxColors: number,
    alphaMin: number
): EffectPalette | null {
    try {
        if (typeof document === "undefined") return null;
        const w = (source as any).width | 0;
        const h = (source as any).height | 0;
        if (w <= 0 || h <= 0) return null;

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(source as any, 0, 0);

        const img = ctx.getImageData(0, 0, w, h);
        const data = img.data;
        const counts = new Map<number, number>();
        for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3] | 0;
            if (a < (alphaMin | 0)) continue;
            const r = data[i] | 0;
            const g = data[i + 1] | 0;
            const b = data[i + 2] | 0;
            const color = ((r << 16) | (g << 8) | b) >>> 0;
            counts.set(color, (counts.get(color) || 0) + 1);
        }

        if (!counts.size) return null;

        const entries = Array.from(counts.entries()).map(([color, count]) => ({ color, count }));
        entries.sort((a, b) => b.count - a.count);

        const colors: number[] = [];
        const limit = Math.max(1, maxColors | 0);
        for (let i = 0; i < entries.length && colors.length < limit; i++) {
            colors.push(entries[i].color >>> 0);
        }

        let tint = 0;
        for (let i = 0; i < entries.length; i++) {
            const c = entries[i].color >>> 0;
            const r = (c >> 16) & 0xff;
            const g = (c >> 8) & 0xff;
            const b = c & 0xff;
            const luma = ((r * 299 + g * 587 + b * 114) / 1000) | 0;
            if (luma >= 30 && luma <= 230) {
                tint = c;
                break;
            }
        }

        if (!tint) tint = colors.length ? (colors[0] >>> 0) : 0xffffff;
        return { colors, tint: tint >>> 0 };
    } catch {
        return null;
    }
}

function _computeNonEmptyFrameIndices(
    source: HTMLImageElement | HTMLCanvasElement,
    frameW: number,
    frameH: number,
    alphaMin: number
): { indices: number[]; emptyCount: number } {
    try {
        if (typeof document === "undefined") return { indices: [], emptyCount: 0 };
        const w = (source as any).width | 0;
        const h = (source as any).height | 0;
        if (w <= 0 || h <= 0) return { indices: [], emptyCount: 0 };

        const cols = Math.floor(w / frameW);
        const rows = Math.floor(h / frameH);
        if (cols <= 0 || rows <= 0) return { indices: [], emptyCount: 0 };

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true } as any);
        if (!ctx) return { indices: [], emptyCount: 0 };
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(source as any, 0, 0);

        const img = ctx.getImageData(0, 0, w, h);
        const data = img.data;

        const indices: number[] = [];
        let emptyCount = 0;
        const aMin = alphaMin | 0;

        for (let r = 0; r < rows; r++) {
            const baseY = r * frameH;
            for (let c = 0; c < cols; c++) {
                const baseX = c * frameW;
                let hasPixel = false;
                for (let y = 0; y < frameH && !hasPixel; y++) {
                    const row = (baseY + y) * w + baseX;
                    let idx = (row << 2) + 3;
                    for (let x = 0; x < frameW; x++) {
                        if (data[idx] >= aMin) {
                            hasPixel = true;
                            break;
                        }
                        idx += 4;
                    }
                }
                if (hasPixel) indices.push(r * cols + c);
                else emptyCount++;
            }
        }

        return { indices, emptyCount };
    } catch {
        return { indices: [], emptyCount: 0 };
    }
}

function _computeFrameBounds(
    source: HTMLImageElement | HTMLCanvasElement,
    frameW: number,
    frameH: number,
    frameIndex: number,
    alphaMin: number
): EffectCollisionBounds | null {
    try {
        if (typeof document === "undefined") return null;
        const w = (source as any).width | 0;
        const h = (source as any).height | 0;
        if (w <= 0 || h <= 0) return null;
        if (frameW <= 0 || frameH <= 0) return null;

        const cols = Math.floor(w / frameW);
        const rows = Math.floor(h / frameH);
        if (cols <= 0 || rows <= 0) return null;

        const maxIndex = (cols * rows) - 1;
        const idx = Math.max(0, Math.min(maxIndex, frameIndex | 0)) | 0;
        const row = Math.idiv(idx, cols) | 0;
        const col = (idx % cols) | 0;
        const baseX = (col * frameW) | 0;
        const baseY = (row * frameH) | 0;

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true } as any);
        if (!ctx) return null;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(source as any, 0, 0);

        const img = ctx.getImageData(0, 0, w, h);
        const data = img.data;
        const aMin = alphaMin | 0;

        let minX = frameW;
        let minY = frameH;
        let maxX = -1;
        let maxY = -1;

        for (let y = 0; y < frameH; y++) {
            const rowStart = (baseY + y) * w + baseX;
            let idxAlpha = (rowStart << 2) + 3;
            for (let x = 0; x < frameW; x++) {
                if (data[idxAlpha] >= aMin) {
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                }
                idxAlpha += 4;
            }
        }

        if (maxX < minX || maxY < minY) return null;

        const wBox = (maxX - minX + 1) | 0;
        const hBox = (maxY - minY + 1) | 0;
        const centerX = Math.round((minX + maxX) / 2) | 0;
        const centerY = Math.round((minY + maxY) / 2) | 0;

        return {
            frameIndex: idx,
            minX: minX | 0,
            minY: minY | 0,
            maxX: maxX | 0,
            maxY: maxY | 0,
            w: wBox | 0,
            h: hBox | 0,
            centerX,
            centerY
        };
    } catch {
        return null;
    }
}

export function preloadEffectSheets(scene: Phaser.Scene): void {
    _warnEffectSheetIssues();

    if (!EFFECT_SHEETS.length) {
        console.warn("[effectAtlas] no effect sheets found with WxH in name under assets/effects");
        return;
    }

    for (const sheet of EFFECT_SHEETS) {
        queueSpritesheetOnce(
            scene,
            sheet.textureKey,
            sheet.url,
            sheet.frameW,
            sheet.frameH
        );
    }
}

export function buildEffectAtlas(scene: Phaser.Scene): EffectAtlas {
    const atlas: EffectAtlas = {};

    for (const sheet of EFFECT_SHEETS) {
        const tex = scene.textures.get(sheet.textureKey);
        const source = tex?.getSourceImage?.() as HTMLImageElement | HTMLCanvasElement | undefined;
        if (!source) continue;

        const remW = source.width % sheet.frameW;
        const remH = source.height % sheet.frameH;
        if (remW || remH) {
            console.warn(
                "[effectAtlas] sheet not divisible by frame size",
                sheet.baseName,
                `size=${source.width}x${source.height}`,
                `frame=${sheet.frameW}x${sheet.frameH}`
            );
        }

        const cols = Math.floor(source.width / sheet.frameW);
        const rows = Math.floor(source.height / sheet.frameH);
        if (cols <= 0 || rows <= 0) continue;

        const frameCount = cols * rows;
        let frameIndices: number[] = [];
        for (let i = 0; i < frameCount; i++) frameIndices.push(i);

        let emptySkipped = 0;
        if (EFFECT_SKIP_EMPTY_FRAMES) {
            const trimmed = _computeNonEmptyFrameIndices(
                source,
                sheet.frameW,
                sheet.frameH,
                EFFECT_EMPTY_ALPHA_MIN
            );
            if (trimmed.indices.length) {
                frameIndices = trimmed.indices;
                emptySkipped = trimmed.emptyCount | 0;
            }
        }
        if (EFFECT_FORCE_LAST_FRAME_IDS.has(sheet.id)) {
            const lastIndex = Math.max(0, frameCount - 1);
            frameIndices = [lastIndex];
        }

        let collisionBounds: EffectCollisionBounds | undefined;
        if (frameCount > 0) {
            const collisionFrameIndex = frameIndices.length ? (frameIndices[0] | 0) : 0;
            const bounds = _computeFrameBounds(
                source,
                sheet.frameW,
                sheet.frameH,
                collisionFrameIndex,
                EFFECT_EMPTY_ALPHA_MIN
            );
            if (bounds) collisionBounds = bounds;
        }

        const palette = _extractPaletteFromSource(
            source,
            EFFECT_PALETTE_MAX_COLORS,
            EFFECT_PALETTE_ALPHA_MIN
        );

        if (DEBUG_EFFECT_ATLAS) {
            console.log("[effectAtlas] sheet", {
                id: sheet.id,
                tex: sheet.textureKey,
                size: `${source.width}x${source.height}`,
                frame: `${sheet.frameW}x${sheet.frameH}`,
                cols,
                rows,
                frames: frameIndices.length,
                emptySkipped
            });
        }

        atlas[sheet.id] = {
            id: sheet.id,
            textureKey: sheet.textureKey,
            url: sheet.url,
            frameIndices,
            frameRate: EFFECT_DEFAULT_FPS,
            repeat: EFFECT_DEFAULT_REPEAT,
            frameW: sheet.frameW,
            frameH: sheet.frameH,
            palette: palette || undefined,
            collisionBounds
        };
    }

    try {
        scene.registry.set("effectAtlas", atlas);
        (globalThis as any).__effectAtlas = atlas;
    } catch { }

    return atlas;
}

export function getMissingEffectSizeNames(): string[] {
    return EFFECT_MISSING_SIZE.slice();
}
