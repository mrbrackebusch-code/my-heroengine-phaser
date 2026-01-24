// src/effectAtlas.ts
import type Phaser from "phaser";
import { DEBUG_EFFECT_ATLAS } from "./debugFlags";
import { queueSpritesheetOnce } from "./loaderCache";
import { EFFECT_ATLAS_META } from "./generated/effectAtlasMeta";

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

type EffectAtlasMetaEntry = {
    frameIndices?: number[];
    emptyCount?: number;
    palette?: EffectPalette;
    collisionBounds?: EffectCollisionBounds;
};

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
const EFFECT_DEBUG_SLOW_MS = 20;
const EFFECT_PALETTE_SAMPLE_TARGET = 20000;
const EFFECT_PALETTE_SAMPLE_MAX_STRIDE = 8;
const EFFECT_YIELD_EVERY_MS = 12;

type EffectSheetPixels = {
    data: Uint8ClampedArray;
    w: number;
    h: number;
};

function _perfNow(): number {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
        return performance.now();
    }
    return Date.now();
}

function _loadingNote(msg: string): void {
    try {
        const g: any = globalThis as any;
        const fn = g.__heLoadingNote;
        if (typeof fn === "function") fn(msg);
    } catch { }
}

function basenameNoExt(p: string): string {
    const file = p.split(/[\\/]/).pop() || p;
    return file.replace(/\.png$/i, "");
}

function parseSizeFromName(name: string): { id: string; frameW: number; frameH: number } | null {
    const match = /^(.*?)(?:\s+)(\d+)x(\d+)(.*)?$/i.exec(name);
    if (!match) return null;
    const base = String(match[1] || "").trim();
    const suffix = String(match[4] || "").trim();
    if (!base) return null;
    if (suffix && !/^_aura_r\d+$/i.test(suffix)) return null;
    const id = (base + (suffix || "")).trim();
    if (!id) return null;
    const frameW = parseInt(match[2], 10) | 0;
    const frameH = parseInt(match[3], 10) | 0;
    if (frameW <= 0 || frameH <= 0) return null;
    return { id, frameW, frameH };
}

let _scratchCanvas: HTMLCanvasElement | null = null;
let _scratchCtx: CanvasRenderingContext2D | null = null;

function _readSheetPixels(source: HTMLImageElement | HTMLCanvasElement): EffectSheetPixels | null {
    try {
        if (typeof document === "undefined") return null;
        const w = (source as any).width | 0;
        const h = (source as any).height | 0;
        if (w <= 0 || h <= 0) return null;
        if (!_scratchCanvas) _scratchCanvas = document.createElement("canvas");
        if (!_scratchCtx) {
            _scratchCtx = _scratchCanvas.getContext("2d", { willReadFrequently: true } as any);
        }
        const ctx = _scratchCtx;
        if (!ctx || !_scratchCanvas) return null;
        if (_scratchCanvas.width !== w) _scratchCanvas.width = w;
        if (_scratchCanvas.height !== h) _scratchCanvas.height = h;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(source as any, 0, 0);
        const img = ctx.getImageData(0, 0, w, h);
        return { data: img.data, w, h };
    } catch {
        return null;
    }
}

function _paletteSampleStride(totalPixels: number): number {
    const target = EFFECT_PALETTE_SAMPLE_TARGET | 0;
    if (totalPixels <= target || target <= 0) return 1;
    const stride = Math.ceil(Math.sqrt(totalPixels / target));
    if (!Number.isFinite(stride) || stride <= 1) return 1;
    return Math.max(1, Math.min(EFFECT_PALETTE_SAMPLE_MAX_STRIDE, stride | 0));
}

function _paletteFromCounts(counts: Map<number, number>, maxColors: number): EffectPalette | null {
    if (!counts || counts.size <= 0) return null;
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
}

function _analyzeSheetData(
    pixels: EffectSheetPixels,
    frameW: number,
    frameH: number,
    cols: number,
    rows: number
): { frameIndices: number[]; emptyCount: number; palette: EffectPalette | null } {
    const data = pixels.data;
    const w = pixels.w | 0;
    const h = pixels.h | 0;
    const frameIndices: number[] = [];
    let emptyCount = 0;

    if (w <= 0 || h <= 0 || frameW <= 0 || frameH <= 0 || cols <= 0 || rows <= 0) {
        return { frameIndices, emptyCount, palette: null };
    }

    const wantPalette = (EFFECT_PALETTE_MAX_COLORS | 0) > 0;
    const counts = wantPalette ? new Map<number, number>() : null;
    const scanW = cols * frameW;
    const scanH = rows * frameH;
    const stride = wantPalette ? _paletteSampleStride(scanW * scanH) : 1;
    let sampleCountdown = 0;
    const checkEmpty = !!EFFECT_SKIP_EMPTY_FRAMES;
    const aMinPalette = EFFECT_PALETTE_ALPHA_MIN | 0;
    const aMinEmpty = EFFECT_EMPTY_ALPHA_MIN | 0;

    for (let r = 0; r < rows; r++) {
        const baseY = r * frameH;
        for (let c = 0; c < cols; c++) {
            const baseX = c * frameW;
            const frameIndex = r * cols + c;
            let hasPixel = !checkEmpty;
            for (let y = 0; y < frameH; y++) {
                const rowStart = (baseY + y) * w + baseX;
                let idx = (rowStart << 2);
                for (let x = 0; x < frameW; x++) {
                    const a = data[idx + 3] | 0;
                    if (wantPalette) {
                        let sampleOk = true;
                        if (stride > 1) {
                            sampleOk = (sampleCountdown === 0);
                            sampleCountdown++;
                            if (sampleCountdown >= stride) sampleCountdown = 0;
                        }
                        if (sampleOk && a >= aMinPalette) {
                            const rC = data[idx] | 0;
                            const gC = data[idx + 1] | 0;
                            const bC = data[idx + 2] | 0;
                            const color = ((rC << 16) | (gC << 8) | bC) >>> 0;
                            counts!.set(color, (counts!.get(color) || 0) + 1);
                        }
                    }
                    if (checkEmpty && a >= aMinEmpty) hasPixel = true;
                    idx += 4;
                }
            }
            if (!checkEmpty || hasPixel) {
                frameIndices.push(frameIndex);
            } else {
                emptyCount++;
            }
        }
    }

    if (checkEmpty && frameIndices.length === 0) {
        const total = cols * rows;
        for (let i = 0; i < total; i++) frameIndices.push(i);
        emptyCount = 0;
    }

    const palette = wantPalette && counts ? _paletteFromCounts(counts, EFFECT_PALETTE_MAX_COLORS) : null;
    return { frameIndices, emptyCount, palette };
}

function _computeFrameBoundsFromData(
    pixels: EffectSheetPixels,
    frameW: number,
    frameH: number,
    frameIndex: number,
    alphaMin: number
): EffectCollisionBounds | null {
    const data = pixels.data;
    const w = pixels.w | 0;
    const h = pixels.h | 0;
    if (w <= 0 || h <= 0) return null;
    if (frameW <= 0 || frameH <= 0) return null;

    const cols = Math.floor(w / frameW);
    const rows = Math.floor(h / frameH);
    if (cols <= 0 || rows <= 0) return null;

    const maxIndex = (cols * rows) - 1;
    const idx = Math.max(0, Math.min(maxIndex, frameIndex | 0)) | 0;
    const row = Math.floor(idx / cols) | 0;
    const col = (idx % cols) | 0;
    const baseX = (col * frameW) | 0;
    const baseY = (row * frameH) | 0;

    let minX = frameW;
    let minY = frameH;
    let maxX = -1;
    let maxY = -1;
    const aMin = alphaMin | 0;

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
}

function _yieldToMainThread(): Promise<void> {
    return new Promise((resolve) => {
        if (typeof requestAnimationFrame === "function") {
            requestAnimationFrame(() => resolve());
        } else {
            setTimeout(() => resolve(), 0);
        }
    });
}

const EFFECT_SHEETS: EffectSheetDef[] = [];
const EFFECT_MISSING_SIZE: string[] = [];

for (const [path, url] of Object.entries(effectPngs)) {
    const baseName = basenameNoExt(path);
    const size = parseSizeFromName(baseName);
    if (!size) {
        EFFECT_MISSING_SIZE.push(baseName);
        continue;
    }

    const safeKey = baseName.replace(/\s+/g, "_");
    const sheet: EffectSheetDef = {
        id: size.id,
        baseName,
        textureKey: `effects.${safeKey}`,
        url,
        frameW: size.frameW,
        frameH: size.frameH
    };

    EFFECT_SHEETS.push(sheet);
}

function _warnEffectSheetIssues(): void {
    if (EFFECT_MISSING_SIZE.length) {
        throw new Error(
            "[effectAtlas] effect sheets must include WxH in filename (tiles are the only exception). Missing: " +
            EFFECT_MISSING_SIZE.join(", ")
        );
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

export async function buildEffectAtlas(scene: Phaser.Scene): Promise<EffectAtlas> {
    const atlas: EffectAtlas = {};
    const primaryById = new Map<string, EffectSheetDef>();
    const slowSheets: Array<{ name: string; ms: number }> = [];
    const total = EFFECT_SHEETS.length | 0;
    let idx = 0;
    let lastYieldAt = _perfNow();

    const maybeYield = async () => {
        const now = _perfNow();
        if ((now - lastYieldAt) < EFFECT_YIELD_EVERY_MS) return;
        await _yieldToMainThread();
        lastYieldAt = _perfNow();
    };

    for (const sheet of EFFECT_SHEETS) {
        idx++;
        _loadingNote(`Effects: ${idx}/${total} ${sheet.baseName}`);
        const t0 = _perfNow();
        const area = (sheet.frameW | 0) * (sheet.frameH | 0);
        const cur = primaryById.get(sheet.id);
        if (!cur || (area > ((cur.frameW | 0) * (cur.frameH | 0)))) {
            primaryById.set(sheet.id, sheet);
        }

        const tex = scene.textures.get(sheet.textureKey);
        const source = tex?.getSourceImage?.() as HTMLImageElement | HTMLCanvasElement | undefined;
        if (!source) continue;

        const meta = (EFFECT_ATLAS_META as Record<string, EffectAtlasMetaEntry>)[sheet.baseName];
        const pixels = meta ? null : _readSheetPixels(source);
        const sheetW = (pixels ? pixels.w : (source.width | 0)) | 0;
        const sheetH = (pixels ? pixels.h : (source.height | 0)) | 0;
        const remW = sheetW % sheet.frameW;
        const remH = sheetH % sheet.frameH;
        if (remW || remH) {
            console.warn(
                "[effectAtlas] sheet not divisible by frame size",
                sheet.baseName,
                `size=${sheetW}x${sheetH}`,
                `frame=${sheet.frameW}x${sheet.frameH}`
            );
        }

        const cols = Math.floor(sheetW / sheet.frameW);
        const rows = Math.floor(sheetH / sheet.frameH);
        if (cols <= 0 || rows <= 0) continue;

        const frameCount = cols * rows;
        let frameIndices: number[] = [];
        let emptySkipped = 0;
        let palette: EffectPalette | null = null;
        let collisionBounds: EffectCollisionBounds | undefined;

        if (meta) {
            if (Array.isArray(meta.frameIndices)) frameIndices = meta.frameIndices.slice();
            emptySkipped = (meta.emptyCount | 0) || 0;
            palette = meta.palette || null;
            collisionBounds = meta.collisionBounds || undefined;
        } else if (pixels) {
            const analysis = _analyzeSheetData(
                pixels,
                sheet.frameW,
                sheet.frameH,
                cols,
                rows
            );
            frameIndices = analysis.frameIndices;
            emptySkipped = analysis.emptyCount | 0;
            palette = analysis.palette;
        }

        if (!frameIndices.length) {
            for (let i = 0; i < frameCount; i++) frameIndices.push(i);
        }
        if (!emptySkipped) {
            emptySkipped = Math.max(0, (frameCount | 0) - (frameIndices.length | 0)) | 0;
        }
        if (EFFECT_FORCE_LAST_FRAME_IDS.has(sheet.id)) {
            const lastIndex = Math.max(0, frameCount - 1);
            frameIndices = [lastIndex];
        }

        if (!collisionBounds && frameCount > 0 && pixels) {
            const collisionFrameIndex = frameIndices.length ? (frameIndices[0] | 0) : 0;
            const bounds = _computeFrameBoundsFromData(
                pixels,
                sheet.frameW,
                sheet.frameH,
                collisionFrameIndex,
                EFFECT_EMPTY_ALPHA_MIN
            );
            if (bounds) collisionBounds = bounds;
        }

        atlas[sheet.baseName] = {
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

        if (DEBUG_EFFECT_ATLAS) {
            console.log("[effectAtlas] sheet", {
                id: sheet.id,
                variant: sheet.baseName,
                tex: sheet.textureKey,
                size: `${sheetW}x${sheetH}`,
                frame: `${sheet.frameW}x${sheet.frameH}`,
                cols,
                rows,
                frames: frameIndices.length,
                emptySkipped
            });
        }

        const dt = _perfNow() - t0;
        if (dt >= EFFECT_DEBUG_SLOW_MS) {
            slowSheets.push({ name: sheet.baseName, ms: dt });
        }
        await maybeYield();
    }

    for (const [id, sheet] of primaryById.entries()) {
        const primary = atlas[sheet.baseName];
        if (primary) atlas[id] = primary;
    }

    if (slowSheets.length) {
        slowSheets.sort((a, b) => b.ms - a.ms);
        const top = slowSheets.slice(0, 4);
        const summary = top.map((s) => `${s.name} ${s.ms.toFixed(0)}ms`).join(", ");
        _loadingNote(`Effects slow: ${summary}`);
        if (DEBUG_EFFECT_ATLAS) {
            console.log("[effectAtlas] slow sheets (ms)", slowSheets);
        }
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
