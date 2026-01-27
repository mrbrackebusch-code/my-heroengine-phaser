import type Phaser from "phaser";
import { auraKey } from "./auraConfig";
import { DEBUG_AURA_MASK_BIN_LOGS } from "./debugFlags";
import { AURA_MASK_INDEX, type AuraMaskIndexEntry } from "./generated/auraMaskIndex";
import { queueBinaryOnce } from "./loaderCache";

export type AuraMaskFrameView = {
  w: number;
  h: number;
  bits: Uint32Array;
  wordOffset: number;
  wordsPerFrame: number;
};

const __maskBinCache = new Map<string, Uint32Array>();
const __maskBinErrors = new Set<string>();
let __maskBinScene: Phaser.Scene | null = null;

const __maskBinUrls = import.meta.glob("../assets/**/auras/_mask.bin", {
  as: "url",
  eager: true
}) as Record<string, string>;

const __binUrlByRel: Record<string, string> = Object.create(null);
for (const [p, url] of Object.entries(__maskBinUrls)) {
  const rel = p.replace(/^..\/assets\//, "assets/").replace(/\\/g, "/");
  __binUrlByRel[rel] = url;
}

function _readBinWordsFromCache(binRel: string): Uint32Array | null {
  const cached = __maskBinCache.get(binRel);
  if (cached) return cached;
  const scene = __maskBinScene;
  if (!scene || !(scene as any).cache?.binary) return null;
  const key = _binCacheKey(binRel);
  const data = (scene as any).cache.binary.get(key) as ArrayBuffer | null;
  if (!data) return null;
  const arr = _decodeBinToWords(binRel, data);
  if (!arr) return null;
  __maskBinCache.set(binRel, arr);
  return arr;
}

function _decodeBinToWords(binRel: string, data: ArrayBuffer): Uint32Array | null {
  try {
    const view = new DataView(data);
    if (view.byteLength < 8) return null;
    const m0 = view.getUint8(0);
    const m1 = view.getUint8(1);
    const m2 = view.getUint8(2);
    const m3 = view.getUint8(3);
    if (m0 !== 0x41 || m1 !== 0x4d || m2 !== 0x53 || m3 !== 0x4b) {
      if (DEBUG_AURA_MASK_BIN_LOGS && !__maskBinErrors.has(binRel)) {
        __maskBinErrors.add(binRel);
        console.warn("[AURA-MASK][BIN] bad magic for " + binRel);
      }
      return null;
    }
    const headerLen = view.getUint32(4, true) >>> 0;
    let dataOffset = (8 + headerLen) >>> 0;
    if ((dataOffset & 3) !== 0) dataOffset = (dataOffset + (4 - (dataOffset & 3))) >>> 0;
    if (dataOffset > view.byteLength) return null;
    const byteLen = view.byteLength - dataOffset;
    if ((byteLen & 3) !== 0) return null;
    return new Uint32Array(data, dataOffset, byteLen >>> 2);
  } catch (err) {
    if (DEBUG_AURA_MASK_BIN_LOGS && !__maskBinErrors.has(binRel)) {
      __maskBinErrors.add(binRel);
      console.warn("[AURA-MASK][BIN] decode failed " + binRel + " err=" + String(err));
    }
    return null;
  }
}

function _binCacheKey(binRel: string): string {
  return "aura-mask|" + binRel;
}

function _getMaskEntry(texKey: string): AuraMaskIndexEntry | null {
  const key = String(texKey || "");
  if (!key) return null;
  return (AURA_MASK_INDEX as Record<string, AuraMaskIndexEntry>)[key] || null;
}

export function preloadAuraMaskBins(scene: Phaser.Scene): void {
  if (!scene) return;
  __maskBinScene = scene;
  const bins = new Set<string>();
  for (const entry of Object.values(AURA_MASK_INDEX)) {
    if (!entry || !entry.bin) continue;
    bins.add(entry.bin);
  }
  for (const binRel of bins) {
    const url = __binUrlByRel[binRel];
    if (!url) continue;
    const key = _binCacheKey(binRel);
    queueBinaryOnce(scene, key, url);
  }
}

function _parseFrameIndex(frameName: string, frameRef?: any): number {
  if (frameRef && Number.isFinite(frameRef.index)) return frameRef.index | 0;
  if (frameName == null) return -1;
  const n = parseInt(String(frameName), 10);
  return Number.isFinite(n) ? (n | 0) : -1;
}

export function getAuraMaskFrameView(texKey: string, frameIndex: number): AuraMaskFrameView | null {
  const entry = _getMaskEntry(texKey);
  if (!entry) return null;
  const fi = frameIndex | 0;
  const maxFrames = (entry.cols * entry.rows) | 0;
  if (fi < 0 || fi >= maxFrames) return null;
  const wordOffset = ((entry.wordOffset | 0) + (fi * (entry.wordsPerFrame | 0))) | 0;
  const words = _readBinWordsFromCache(entry.bin);
  if (!words) return null;
  return {
    w: entry.w | 0,
    h: entry.h | 0,
    bits: words,
    wordOffset,
    wordsPerFrame: entry.wordsPerFrame | 0,
  };
}

export function getAuraMaskBitsForFrame(
  texKey: string,
  frameIndex: number
): { w: number; h: number; bits: Uint32Array } | null {
  const view = getAuraMaskFrameView(texKey, frameIndex);
  if (!view) return null;
  const start = view.wordOffset | 0;
  const end = (start + view.wordsPerFrame) | 0;
  const bits = view.bits.slice(start, end);
  return { w: view.w | 0, h: view.h | 0, bits };
}

export function getAuraMaskBitsForKey(
  texKey: string,
  frameName: string,
  radius: number,
  frameRef?: any
): { w: number; h: number; bits: Uint32Array } | null {
  const idx = _parseFrameIndex(frameName, frameRef);
  if (idx < 0) return null;
  const direct = getAuraMaskBitsForFrame(texKey, idx);
  if (direct) return direct;
  const auraTk = auraKey(String(texKey || ""), radius | 0);
  if (auraTk && auraTk !== texKey) {
    const fromAura = getAuraMaskBitsForFrame(auraTk, idx);
    if (fromAura) return fromAura;
  }
  const fn = (frameRef && frameRef.name != null) ? String(frameRef.name)
    : (frameName != null ? String(frameName) : "");
  if (fn && fn !== texKey && /[^0-9]/.test(fn)) {
    const directFn = getAuraMaskBitsForFrame(fn, idx);
    if (directFn) return directFn;
    const auraFn = auraKey(fn, radius | 0);
    if (auraFn && auraFn !== fn) {
      const fromAuraFn = getAuraMaskBitsForFrame(auraFn, idx);
      if (fromAuraFn) return fromAuraFn;
    }
  }
  return null;
}
