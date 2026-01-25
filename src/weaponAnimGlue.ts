// src/weaponAnimGlue.ts
// Phaser-side weapon overlay sprites (BG/FG sandwich + optional ghost trails)
// and deterministic frame resolution utilities.

import type Phaser from "phaser";
import {
  DEBUG_NPC_PIPELINE,
  DEBUG_WPN_PIXEL_LOG,
  DEBUG_WPN_FORCE_ORIGINALS_BY_FAMILY,
  DEBUG_WPN_COMPARE_ORIGINALS_RUNTIME,
  WEAPON_DEBUG,
  WEAPON_DEBUG_VERBOSE
} from "./debugFlags";

import {
  type Dir4,
  type WeaponId,
  type WeaponMode,
  type WeaponSheetRef,
  getWeaponAtlasFrameForSheet,
  getWeaponOriginalRefKey,
  getWeaponSheetMeta,
  ensureWeaponSheetsLoaded,
  resolveWeaponLayerPair,
  resolveWeaponSheet,
  resolveAnyWeaponLayerPair,
  tileForWeaponMode,
  weaponModeForHeroPhase
} from "./weaponAtlas";

// ----------------------------------------------------------
// Constants / knobs
// ----------------------------------------------------------

const DIR_ORDER: Dir4[] = ["up", "left", "down", "right"]; // matches heroAtlas conventions

// Optional positional nudges (in pixels), if you later want slight hand offsets.
const WEAPON_OFFSET_BY_DIR: Record<Dir4, { x: number; y: number }> = {
  up: { x: 0, y: 0 },
  down: { x: 0, y: 0 },
  left: { x: 0, y: 0 },
  right: { x: 0, y: 0 }
};

// Staff-family phase overrides. This keeps "which anim token to ask for"
// centralized and independent from atlas layout details.
const FAMILY_PHASE_OVERRIDE_BY_WEAPON: Record<string, Record<string, string>> = {
  wisdom: { simple: "cast" },
  support: { simple: "cast" },
  heal: { simple: "cast" },
  healing: { simple: "cast" },
  intelligence: { simple: "cast" },
  intellect: { simple: "cast" }
};

const FAMILY_PHASE_OVERRIDE_DEFAULT: Record<string, string> = {
  wisdom: "thrust",
  support: "thrust",
  heal: "thrust",
  healing: "thrust",
  intelligence: "thrust",
  intellect: "thrust"
};

function _normFamily(family: string): string {
  return String(family || "").trim().toLowerCase();
}

function _isCastLikePhase(phase: string): boolean {
  const p = String(phase || "").trim().toLowerCase();
  return p === "cast" || p === "spellcast" || p === "spell_cast";
}

function _phaseOverrideForFamily(family: string, weaponId: string, heroPhase: string): string | null {
  const fam = _normFamily(family);
  if (!fam || !_isCastLikePhase(heroPhase)) return null;
  const wid = String(weaponId || "").trim().toLowerCase();
  const perWeapon = FAMILY_PHASE_OVERRIDE_BY_WEAPON[fam];
  if (perWeapon && perWeapon[wid]) return perWeapon[wid];
  return FAMILY_PHASE_OVERRIDE_DEFAULT[fam] ?? null;
}

const DEBUG_ORIGINALS_BY_FAMILY: Record<string, { weaponId: string; heroPhase: string; variant: string }> = {
  strength: { weaponId: "arming", heroPhase: "slash", variant: "base" },
  agility: { weaponId: "spear", heroPhase: "thrust", variant: "base" },
  intelligence: { weaponId: "gnarled", heroPhase: "thrust", variant: "base" },
  intellect: { weaponId: "gnarled", heroPhase: "thrust", variant: "base" },
  wisdom: { weaponId: "simple", heroPhase: "cast", variant: "base" },
  support: { weaponId: "simple", heroPhase: "cast", variant: "base" },
  heal: { weaponId: "simple", heroPhase: "cast", variant: "base" },
  healing: { weaponId: "simple", heroPhase: "cast", variant: "base" }
};

function _isAttackLikePhase(phase: string): boolean {
  const p = String(phase || "").trim().toLowerCase();
  if (!p) return false;
  return (
    p.includes("slash") ||
    p.includes("thrust") ||
    p.includes("cast") ||
    p.includes("spellcast") ||
    p.includes("shoot") ||
    p.includes("attack_")
  );
}

function _debugOriginalOverrideForFamily(family: string, heroPhase: string): { weaponId: string; heroPhase: string; variant: string } | null {
  if (!DEBUG_WPN_FORCE_ORIGINALS_BY_FAMILY) return null;
  if (!_isAttackLikePhase(heroPhase)) return null;
  const fam = _normFamily(family);
  return fam ? (DEBUG_ORIGINALS_BY_FAMILY[fam] ?? null) : null;
}


// ----------------------------------------------------------
// Debug: gated, once-per-key logging for resolve failures/success
// Enable with: ?weaponDebug=1 (and optionally &weaponDebugVerbose=1)
// main.ts sets globalThis.__weaponDebug / __weaponDebugVerbose.
// ----------------------------------------------------------

const _WEAPON_RESOLVE_MISS_ONCE = new Set<string>();
const _WEAPON_RESOLVE_HIT_ONCE = new Set<string>();
const _WEAPON_TEX_MISS_ONCE = new Set<string>();



// Internal per-hero bookkeeping for weapon pacing (stored on the Phaser hero sprite).
const WPN_LOCAL_PHASE_ACTIONSEQ_KEY = "__wpnLocalPhaseActionSequence";
const WPN_LOCAL_PHASE_ENGINE_START_KEY = "__wpnLocalPhaseEngineStartMs";
const WPN_LOCAL_PHASE_LOCAL_START_KEY = "__wpnLocalPhaseLocalStartMs";
const WPN_LOCAL_PHASE_LOCAL_DUR_KEY = "__wpnLocalPhaseLocalDurMs";


// --- ADD: weapon-follow contract keys published on the hero sprite ---
const HERO_FOLLOW_FRAME_IN_CLIP_KEY = "HeroFollowFrameInClip"; // 0..clipLen-1
const HERO_FOLLOW_CLIP_LEN_KEY = "HeroFollowClipLen";          // N


// Internal execute-beat bookkeeping (stored on Phaser hero sprite).
const WPN_LOCAL_EXEC_BEAT_SEQ_KEY = "__agiExecSlashBeatSeq";
const WPN_LOCAL_EXEC_BEAT_LOCAL_START_KEY = "__agiExecSlashBeatLocalStartMs";

// How long the execute yo-yo should run after each beat (ms)
const WPN_EXEC_YOYO_WINDOW_MS = 420;

// How fast to flip between the two “pretty” cols during execute (ms)
const WPN_EXEC_YOYO_STEP_MS = 90;


const _WEAPON_PLACED_ONCE = new Set<string>();
const _WEAPON_HIDDEN_ONCE = new Set<string>();
const _WPN_ROW_LOG_ONCE = new Set<string>();
const _WPN_PIXEL_RESOLVE_ONCE = new Set<string>();
const _WPN_PIXEL_PLACE_ONCE = new Set<string>();
const _WPN_PIXEL_COMPARE_ONCE = new Set<string>();
const _WPN_ORIG_REF_MISS_ONCE = new Set<string>();
const _WPN_FAMILY_OVERRIDE_ONCE = new Set<string>();
const _WPN_DEBUG_ORIGINALS_ONCE = new Set<string>();
const _WPN_PIXEL_CTX_CACHE = new Map<string, { src: any; w: number; h: number; ctx: CanvasRenderingContext2D }>();

const WPN_ORIG_GHOST_BG_KEY = "__wpnOrigGhostBg";
const WPN_ORIG_GHOST_FG_KEY = "__wpnOrigGhostFg";
const WPN_ORIG_GHOST_ALPHA = 0.45;
const WPN_ORIG_GHOST_TINT = 0x00ffff;


// ------------------------------------------------------------
// WEAPON DEBUG FLAGS (code switch — no browser console toggles)
// ------------------------------------------------------------
// Debug flags live in src/debugFlags.ts

// NPC-specific logging (off by default)
const NPC_WEAPON_LOG_ONCE_KEY = "__npcWeaponLogged";

function _weaponDebugEnabled(): boolean {
  // Code flag wins (no console commands needed).
  if (WEAPON_DEBUG) return true;

  // Keep globalThis escape hatch (harmless if unused).
  try {
    return !!(globalThis as any).WEAPON_DEBUG;
  } catch {
    return false;
  }
}

function _weaponDebugVerbose(): boolean {
  if (WEAPON_DEBUG_VERBOSE) return true;

  try {
    return !!(globalThis as any).WEAPON_DEBUG_VERBOSE;
  } catch {
    return false;
  }
}

function _weaponPixelPaletteDebugEnabled(): boolean {
  if (!DEBUG_WPN_PIXEL_LOG) return false;
  return _weaponDebugEnabled() || _weaponDebugVerbose();
}

function _weaponPixelCompareDebugEnabled(): boolean {
  if (!DEBUG_WPN_COMPARE_ORIGINALS_RUNTIME) return false;
  return _weaponDebugEnabled() || _weaponDebugVerbose();
}

function _weaponPixelDebugEnabled(): boolean {
  return _weaponPixelPaletteDebugEnabled();
}

function _toHex2(v: number): string {
  const n = Math.max(0, Math.min(255, v | 0));
  return n.toString(16).padStart(2, "0");
}

function _rgbaToHex(r: number, g: number, b: number, a: number): string {
  return "#" + _toHex2(r) + _toHex2(g) + _toHex2(b) + _toHex2(a);
}

function _getPixelCtxForSource(texKey: string, src: any): { ctx: CanvasRenderingContext2D; w: number; h: number } | null {
  try {
    const w = (src?.width ?? 0) | 0;
    const h = (src?.height ?? 0) | 0;
    if (w <= 0 || h <= 0) return null;

    if (src && typeof src.getContext === "function") {
      const ctx = src.getContext("2d") as CanvasRenderingContext2D | null;
      if (ctx) return { ctx, w, h };
    }

    const cached = _WPN_PIXEL_CTX_CACHE.get(texKey);
    if (cached && cached.src === src && cached.w === w && cached.h === h) {
      return { ctx: cached.ctx, w: cached.w, h: cached.h };
    }

    if (typeof document === "undefined" || !document.createElement) return null;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true } as any) as CanvasRenderingContext2D | null;
    if (!ctx) return null;
    ctx.drawImage(src, 0, 0);
    _WPN_PIXEL_CTX_CACHE.set(texKey, { src, w, h, ctx });
    return { ctx, w, h };
  } catch {
    return null;
  }
}

type PixelPalette = {
  total: number;
  transparent: number;
  unique: number;
  uniqueOpaque: number;
  top: Array<{ hex: string; count: number }>;
  truncated: boolean;
};

function _rgbaFromUint(u: number): { r: number; g: number; b: number; a: number } {
  const n = u >>> 0;
  return {
    r: (n >>> 24) & 0xff,
    g: (n >>> 16) & 0xff,
    b: (n >>> 8) & 0xff,
    a: n & 0xff
  };
}

function _scanFramePalette(scene: Phaser.Scene, texKey: string, frameIndex: number, frameW: number, frameH: number): {
  palette: PixelPalette | null;
  error?: string;
  debug?: { srcW: number; srcH: number; cutX: number; cutY: number; frameW: number; frameH: number };
} {
  try {
    const textures: any = scene?.textures;
    if (!textures || typeof textures.exists !== "function" || !textures.exists(texKey)) {
      return { palette: null, error: "missing_texture" };
    }
    const tex = textures.get(texKey);
    if (!tex) return { palette: null, error: "missing_texture" };
    const frame = tex.get(frameIndex);
    if (!frame) return { palette: null, error: "missing_frame" };
    const src: any = frame?.source?.image ?? tex?.getSourceImage?.();
    if (!src) return { palette: null, error: "missing_source" };
    const ctxInfo = _getPixelCtxForSource(texKey, src);
    if (!ctxInfo) return { palette: null, error: "no_context" };
    const cutX = (frame.cutX ?? 0) | 0;
    const cutY = (frame.cutY ?? 0) | 0;
    const w = Math.max(0, frameW | 0);
    const h = Math.max(0, frameH | 0);
    if (w === 0 || h === 0) return { palette: null, error: "bad_frame_size" };
    const srcW = ctxInfo.w | 0;
    const srcH = ctxInfo.h | 0;
    if (cutX < 0 || cutY < 0 || (cutX + w) > srcW || (cutY + h) > srcH) {
      return {
        palette: null,
        error: "oob",
        debug: { srcW, srcH, cutX, cutY, frameW: w, frameH: h }
      };
    }

    const img = ctxInfo.ctx.getImageData(cutX, cutY, w, h);
    const data = img.data;
    const counts = new Map<number, number>();
    let transparent = 0;
    const total = w * h;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] | 0;
      const g = data[i + 1] | 0;
      const b = data[i + 2] | 0;
      const a = data[i + 3] | 0;
      if (a === 0) transparent++;
      const key = (((r << 24) | (g << 16) | (b << 8) | a) >>> 0);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const entries = Array.from(counts.entries());
    entries.sort((a, b) => (b[1] - a[1]));
    const maxTop = 8;
    const top: Array<{ hex: string; count: number }> = [];
    for (let i = 0; i < entries.length && i < maxTop; i++) {
      const [key, count] = entries[i];
      const c = _rgbaFromUint(key);
      top.push({ hex: _rgbaToHex(c.r, c.g, c.b, c.a), count });
    }

    let uniqueOpaque = 0;
    for (const [key] of entries) {
      if ((key & 0xff) !== 0) uniqueOpaque++;
    }

    const palette: PixelPalette = {
      total,
      transparent,
      unique: entries.length,
      uniqueOpaque,
      top,
      truncated: entries.length > maxTop
    };

    return { palette };
  } catch {
    return { palette: null, error: "scan_failed" };
  }
}

function _fmtPixelPalette(palette: PixelPalette | null): string {
  if (!palette) return "";
  const topStr = palette.top.map((t) => `${t.hex}:${t.count}`).join(",");
  return (
    "palette=uniq=" + palette.unique +
    " uniqOpaque=" + palette.uniqueOpaque +
    " total=" + palette.total +
    " transparent=" + palette.transparent +
    (topStr ? (" top=" + topStr) : "") +
    (palette.truncated ? " truncated=1" : "")
  );
}

function _logWeaponPixelResolveOnce(sig: string, line: string): void {
  if (_WPN_PIXEL_RESOLVE_ONCE.has(sig)) return;
  _WPN_PIXEL_RESOLVE_ONCE.add(sig);
  console.log("[WPN-PIX-RESOLVE] " + line);
}

function _logWeaponPixelPlaceOnce(sig: string, line: string): void {
  if (_WPN_PIXEL_PLACE_ONCE.has(sig)) return;
  _WPN_PIXEL_PLACE_ONCE.add(sig);
  console.log("[WPN-PIX-PLACE] " + line);
}

function _logWeaponPixelCompareOnce(sig: string, line: string): void {
  if (_WPN_PIXEL_COMPARE_ONCE.has(sig)) return;
  _WPN_PIXEL_COMPARE_ONCE.add(sig);
  console.log("[WPN-PIX-CMP] " + line);
}

function _logWeaponOriginalRefMissingOnce(sig: string, line: string): void {
  if (_WPN_ORIG_REF_MISS_ONCE.has(sig)) return;
  _WPN_ORIG_REF_MISS_ONCE.add(sig);
  console.log("[WPN-ORIG-REF-MISS] " + line);
}

function _diffFrameRegions(args: {
  origCtx: CanvasRenderingContext2D;
  origW: number;
  origH: number;
  origX: number;
  origY: number;
  atlasCtx: CanvasRenderingContext2D;
  atlasW: number;
  atlasH: number;
  atlasX: number;
  atlasY: number;
  frameW: number;
  frameH: number;
}): { diffPixels: number; totalPixels: number; error?: string } {
  const frameW = args.frameW | 0;
  const frameH = args.frameH | 0;
  const totalPixels = Math.max(0, frameW * frameH);
  if (frameW <= 0 || frameH <= 0) return { diffPixels: -1, totalPixels, error: "bad_frame_size" };

  const ox = args.origX | 0;
  const oy = args.origY | 0;
  const ax = args.atlasX | 0;
  const ay = args.atlasY | 0;

  if (ox < 0 || oy < 0 || ox + frameW > args.origW || oy + frameH > args.origH) {
    return { diffPixels: -1, totalPixels, error: "orig_oob" };
  }
  if (ax < 0 || ay < 0 || ax + frameW > args.atlasW || ay + frameH > args.atlasH) {
    return { diffPixels: -1, totalPixels, error: "atlas_oob" };
  }

  try {
    const oImg = args.origCtx.getImageData(ox, oy, frameW, frameH);
    const aImg = args.atlasCtx.getImageData(ax, ay, frameW, frameH);
    const od = oImg.data;
    const ad = aImg.data;
    let diff = 0;
    for (let i = 0; i < od.length; i += 4) {
      if (od[i] !== ad[i] || od[i + 1] !== ad[i + 1] || od[i + 2] !== ad[i + 2] || od[i + 3] !== ad[i + 3]) {
        diff++;
      }
    }
    return { diffPixels: diff, totalPixels };
  } catch {
    return { diffPixels: -1, totalPixels, error: "read_failed" };
  }
}

function _compareWeaponFrameToOriginal(args: {
  scene: Phaser.Scene;
  weaponId: string;
  heroPhase: string;
  usedPhase: string;
  variant: string;
  dir: string;
  layer: string;
  sheetKey: string;
  atlasKey: string;
  atlasImage: string;
  atlasFrame?: { x: number; y: number; w: number; h: number };
  frameIndex: number;
  frameW: number;
  frameH: number;
  cols: number;
  rows: number;
  x?: number;
  y?: number;
  depth?: number;
}): void {
  if (!_weaponPixelCompareDebugEnabled()) return;

  const textures: any = args.scene?.textures;
  if (!textures || typeof textures.exists !== "function") return;

  const origKey = getWeaponOriginalRefKey(args.sheetKey);
  if (!origKey || !textures.exists(origKey)) {
    const missLine = "key=" + args.sheetKey + " origKey=" + origKey;
    _logWeaponOriginalRefMissingOnce(args.sheetKey, missLine);
    return;
  }

  const atlasInfo = args.atlasFrame;
  if (!atlasInfo) {
    const sig = `cmp|${args.sheetKey}|${args.frameIndex}|noatlas`;
    const line = "key=" + args.sheetKey + " frame=" + (args.frameIndex | 0) + " error=no_atlas_frame";
    _logWeaponPixelCompareOnce(sig, line);
    return;
  }

  const origTex: any = textures.get(origKey);
  const atlasTex: any = textures.get(args.sheetKey);
  const origSrc: any = origTex?.getSourceImage?.();
  const atlasSrc: any = atlasTex?.getSourceImage?.();
  const origCtxInfo = _getPixelCtxForSource(origKey, origSrc);
  const atlasCtxInfo = _getPixelCtxForSource(args.sheetKey, atlasSrc);
  if (!origCtxInfo || !atlasCtxInfo) {
    const sig = `cmp|${args.sheetKey}|${args.frameIndex}|nctx`;
    const line =
      "key=" + args.sheetKey +
      " origKey=" + origKey +
      " frame=" + (args.frameIndex | 0) +
      " error=no_ctx";
    _logWeaponPixelCompareOnce(sig, line);
    return;
  }

  const cols = Math.max(1, args.cols | 0);
  const rows = Math.max(1, args.rows | 0);
  const frameIndex = Math.max(0, args.frameIndex | 0);
  const row = Math.max(0, Math.min(rows - 1, ((frameIndex / cols) | 0)));
  const col = Math.max(0, Math.min(cols - 1, (frameIndex % cols) | 0));

  const frameW = args.frameW | 0;
  const frameH = args.frameH | 0;
  const ox = col * frameW;
  const oy = row * frameH;
  const ax = (atlasInfo.x | 0) + ox;
  const ay = (atlasInfo.y | 0) + oy;

  const diff = _diffFrameRegions({
    origCtx: origCtxInfo.ctx,
    origW: origCtxInfo.w,
    origH: origCtxInfo.h,
    origX: ox,
    origY: oy,
    atlasCtx: atlasCtxInfo.ctx,
    atlasW: atlasCtxInfo.w,
    atlasH: atlasCtxInfo.h,
    atlasX: ax,
    atlasY: ay,
    frameW,
    frameH
  });

  const sig = `cmp|${args.sheetKey}|${frameIndex}`;
  const line =
    "weaponId=" + args.weaponId +
    " heroPhase=" + args.heroPhase +
    " usedPhase=" + args.usedPhase +
    (args.dir ? (" dir=" + args.dir) : "") +
    " variant=" + args.variant +
    " layer=" + args.layer +
    " key=" + args.sheetKey +
    " origKey=" + origKey +
    " frame=" + frameIndex +
    " row=" + row +
    " col=" + col +
    " diff=" + diff.diffPixels +
    " total=" + diff.totalPixels +
    " match=" + (diff.diffPixels === 0 ? 1 : 0) +
    (diff.error ? (" error=" + diff.error) : "") +
    (args.atlasKey ? (" atlas=" + args.atlasKey) : "") +
    (args.atlasImage ? (" atlasImg=" + args.atlasImage) : "") +
    " atlasAbs=" + ax + "," + ay +
    " origAbs=" + ox + "," + oy +
    (Number.isFinite(args.x as number) ? (" x=" + Math.round(args.x as number)) : "") +
    (Number.isFinite(args.y as number) ? (" y=" + Math.round(args.y as number)) : "") +
    (Number.isFinite(args.depth as number) ? (" depth=" + Math.round(args.depth as number)) : "");
  _logWeaponPixelCompareOnce(sig, line);
}

function _buildWeaponPixelLine(args: {
  weaponId: string;
  heroPhase: string;
  usedPhase: string;
  variant: string;
  dir?: string;
  layer: string;
  sheetKey: string;
  frameIndex: number;
  frameW: number;
  frameH: number;
  cols: number;
  rows: number;
  row: number;
  col: number;
  atlasKey: string;
  atlasImage?: string;
  atlasFrame?: { x: number; y: number; w: number; h: number };
  palette: PixelPalette | null;
  error?: string;
}): string {
  const atlasFrame = args.atlasFrame
    ? `${args.atlasFrame.x},${args.atlasFrame.y},${args.atlasFrame.w},${args.atlasFrame.h}`
    : "";
  const paletteStr = _fmtPixelPalette(args.palette);
  const oob = (args as any).oobInfo;
  const oobStr = oob
    ? (" oob=src(" + oob.srcW + "x" + oob.srcH + ") cut(" + oob.cutX + "," + oob.cutY + ") frame(" + oob.frameW + "x" + oob.frameH + ")")
    : "";
  return (
    "weaponId=" + args.weaponId +
    " heroPhase=" + args.heroPhase +
    " usedPhase=" + args.usedPhase +
    (args.dir ? (" dir=" + args.dir) : "") +
    " variant=" + args.variant +
    " layer=" + args.layer +
    " key=" + args.sheetKey +
    " frame=" + (args.frameIndex | 0) +
    " row=" + (args.row | 0) +
    " col=" + (args.col | 0) +
    " tile=" + (args.frameW | 0) + "x" + (args.frameH | 0) +
    " cols=" + (args.cols | 0) +
    " rows=" + (args.rows | 0) +
    (args.atlasKey ? (" atlas=" + args.atlasKey) : "") +
    (args.atlasImage ? (" atlasImg=" + args.atlasImage) : "") +
    (atlasFrame ? (" atlasFrame=" + atlasFrame) : "") +
    (args.error ? (" error=" + args.error) : "") +
    oobStr +
    (paletteStr ? (" " + paletteStr) : "")
  );
}

function isNpcHeroSprite(sprite: Phaser.GameObjects.Sprite): boolean {
  const anySprite: any = sprite as any;
  const getData = (anySprite && typeof anySprite.getData === "function") ? anySprite.getData.bind(anySprite) : null;
  if (!getData) return false;
  const isNpc = !!getData("isNpc") || !!getData("npcLpc");
  const role = String(getData("_npcRole") || "");
  const heroName = String(getData("heroName") || "");
  if (isNpc || role) return true;
  return heroName === "Shopkeeper" || heroName === "Statue";
}

const _WPN_PLACE_ONCE = new Set<string>();

function _logWeaponPlace(dbgVerbose: boolean, sig: string, line: string): void {
  if (!dbgVerbose) {
    if (_WPN_PLACE_ONCE.has(sig)) return;
    _WPN_PLACE_ONCE.add(sig);
  }
  console.log(line);
}


function _logWeaponResolveMissOnce(key: string, payload: any): void {
  if (_WEAPON_RESOLVE_MISS_ONCE.has(key)) return;
  _WEAPON_RESOLVE_MISS_ONCE.add(key);
  console.warn("[WPN-RESOLVE-MISS] " + _fmtWeaponResolveMissOneLine(payload));
}
function _logWeaponResolveHitOnce(key: string, payload: any): void {
  if (_WEAPON_RESOLVE_HIT_ONCE.has(key)) return;
  _WEAPON_RESOLVE_HIT_ONCE.add(key);
  console.log("[WPN-RESOLVE-HIT] " + _fmtWeaponResolveHitOneLine(payload));
}

function _logWeaponPlacedOnce(key: string, payload: any): void {
  if (_WEAPON_PLACED_ONCE.has(key)) return;
  _WEAPON_PLACED_ONCE.add(key);
  console.log("[WPN-PLACED] " + _fmtWeaponPlacedOneLine(payload));
}

function _logWeaponHiddenOnce(key: string, payload: any): void {
  if (_WEAPON_HIDDEN_ONCE.has(key)) return;
  _WEAPON_HIDDEN_ONCE.add(key);
  console.log("[WPN-HIDDEN] " + _fmtWeaponHiddenOneLine(payload));
}

function _logWeaponMissingTexOnce(key: string, payload: any): void {
  if (_WEAPON_TEX_MISS_ONCE.has(key)) return;
  _WEAPON_TEX_MISS_ONCE.add(key);
  console.warn("[WPN-MISSING-TEX] " + _fmtWeaponMissingTexOneLine(payload));
}

function _logWeaponFamilyOverrideOnce(key: string, payload: string): void {
  if (_WPN_FAMILY_OVERRIDE_ONCE.has(key)) return;
  _WPN_FAMILY_OVERRIDE_ONCE.add(key);
  console.log("[WPN-FAMILY-OVERRIDE] " + payload);
}

function _logWeaponDebugOriginalsOnce(key: string, payload: string): void {
  if (_WPN_DEBUG_ORIGINALS_ONCE.has(key)) return;
  _WPN_DEBUG_ORIGINALS_ONCE.add(key);
  console.log("[WPN-DEBUG-ORIGINALS] " + payload);
}



function _weaponPhaseFromNativeDisplayedAnim(nativeHero: Phaser.GameObjects.Sprite): string {
    const anyHero: any = nativeHero as any;

    // Prefer Phaser anim key because it represents what is ACTUALLY being rendered.
    const k =
        (anyHero?.anims?.currentAnim?.key as any) ||
        (anyHero?.anims?.getName?.() as any) ||
        "";

    const key = String(k || "").trim();
    if (!key) return "";

    const low = key.toLowerCase();

    // Look for canonical heroAtlas phase tokens inside the key.
    // (Order matters: check more-specific before less-specific.)
    const PHASES: string[] = [
        "thrustoversize",
        "slashoversize",
        "onehandbackslash",
        "onehandhalfslash",
        "onehandslash",
        "combatidle",
        "watering",
        "spellcast",
        "cast",
        "thrust",
        "slash",
        "shoot",
        "hurt",
        "climb",
        "jump",
        "sit",
        "emote",
        "run",
        "walk",
        "idle",
    ];

    for (const p of PHASES) {
        if (low.includes(p)) {
            // Return the properly-cased token weaponAtlas / weaponAnimGlue expect.
            // (Match your heroAtlas naming.)
            if (p === "combatidle") return "combatIdle";
            if (p === "onehandslash") return "oneHandSlash";
            if (p === "onehandbackslash") return "oneHandBackslash";
            if (p === "onehandhalfslash") return "oneHandHalfslash";
            if (p === "thrustoversize") return "thrustOversize";
            if (p === "slashoversize") return "slashOversize";
            if (p === "spellcast") return "cast"; // treat spellcast as cast for weapons
            return p; // already fine for most (cast/thrust/slash/walk/idle/etc.)
        }
    }

    return "";
}



export function syncStandaloneWeaponLayers(args: {
  scene: Phaser.Scene;

  weaponBg: Phaser.GameObjects.Sprite;
  weaponFg: Phaser.GameObjects.Sprite;

  weaponId: WeaponId;
  sourcePhase: string;   // from shop ring source phase (or slot)
  variant?: string;

  dir: Dir4;
  frameColOverride?: number; // fixed pose column (recommended for shop ring)
  time01?: number;           // optional 0..1 phase progress (if you ever want it)

  x: number;
  y: number;

  baseDepth: number;

  highlight?: boolean;
}): WeaponRenderResolve | null {
  const mode: WeaponMode = weaponModeForHeroPhase(args.sourcePhase);

  // Phase fallback chain (same idea as syncWeaponLayersToHero)
  const rawPhase = String(args.sourcePhase || "").trim();
  const snake = rawPhase
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();

  const phaseTry: string[] = [args.sourcePhase];

  if (snake === "combat_idle" || snake === "combatidle") {
    phaseTry.push("idle", "slash", "attack_slash", "thrust", "walk");
  } else if (snake === "idle") {
    phaseTry.push("combatIdle", "slash", "attack_slash", "thrust", "walk");
  }

  let pair: ReturnType<typeof resolveWeaponLayerPair> = null;
  let usedPhase = args.sourcePhase;

  for (const p of phaseTry) {
    const attempt = resolveWeaponLayerPair({
      weaponId: args.weaponId,
      heroPhase: p,
      mode,
      variant: args.variant
    });
    if (attempt) {
      pair = attempt;
      usedPhase = p;
      break;
    }
  }

  // Last resort: any anim for this weapon
  if (!pair) {
    const anyPair = resolveAnyWeaponLayerPair({
      weaponId: args.weaponId,
      variant: args.variant
    });
    if (anyPair) {
      pair = anyPair as any;
      usedPhase = "__any__";
    }
  }

  if (!pair) {
    try { args.weaponBg.setVisible(false); } catch { }
    try { args.weaponFg.setVisible(false); } catch { }
    return null;
  }

  const heroDepth = (args.baseDepth | 0);

  const applyOne = (
    spr: Phaser.GameObjects.Sprite,
    layerRef: WeaponSheetRef | undefined,
    depth: number,
    layerLabel: "bg" | "fg"
  ): WeaponResolvedLayer | undefined => {
    if (!layerRef) {
      try { spr.setVisible(false); } catch { }
      return undefined;
    }

    const textures: any = args.scene?.textures;
    if (textures && typeof textures.exists === "function" && !textures.exists(layerRef.key)) {
      if (dbgOn) {
        const atlasDbg = _atlasDebugFields(args.scene, [layerRef.key]);
        const loaderDbg = _loaderDebugFields(args.scene);
        _logWeaponMissingTexOnce(missKey + "|layer:" + layerRef.key, {
          weaponId: args.weaponId,
          heroPhase: args.sourcePhase,
          usedPhase,
          mode,
          variant: args.variant ?? "base",
          dir: args.dir,
          heroFrameIndex: -1,
          missing: [layerRef.key],
          keys: [layerRef.key],
          atlasKeys: atlasDbg.atlasKeys,
          atlasExists: atlasDbg.atlasExists,
          atlasFrames: atlasDbg.atlasFrames,
          atlasImages: atlasDbg.atlasImages,
          loaderLoading: loaderDbg.loaderLoading,
          loaderList: loaderDbg.loaderList,
          loaderInflight: loaderDbg.loaderInflight,
          loaderQueue: loaderDbg.loaderQueue
        });
      }
      ensureWeaponSheetsLoaded(args.scene, args.weaponId, args.variant);
      try { spr.setVisible(false); } catch { }
      return undefined;
    }

    if (spr.texture?.key !== layerRef.key) spr.setTexture(layerRef.key);

    const paletteDbg = _weaponPixelPaletteDebugEnabled();
    const compareDbg = _weaponPixelCompareDebugEnabled();
    const debugNeedsMeta = paletteDbg || compareDbg;
    let gridCols = 0;
    let gridRows = 0;
    let atlasKey = "";
    let atlasImage = "";
    let atlasFrame: { x: number; y: number; w: number; h: number } | undefined;
    if (debugNeedsMeta) {
      const meta = getWeaponSheetMeta(layerRef.key);
      const atlasInfo = getWeaponAtlasFrameForSheet(layerRef.key);
      atlasKey = meta?.atlasKey ?? atlasInfo?.atlasKey ?? "";
      atlasImage = atlasInfo?.image ?? "";
      atlasFrame = atlasInfo?.frame;
      const grid = getSheetGrid(args.scene, layerRef);
      gridCols = Math.max(1, grid.cols | 0);
      gridRows = Math.max(1, grid.rows | 0);
    }
    if (paletteDbg) {
      const sample0 = _scanFramePalette(args.scene, layerRef.key, 0, layerRef.frameW | 0, layerRef.frameH | 0);
      const line0 = _buildWeaponPixelLine({
        weaponId: String(args.weaponId || ""),
        heroPhase: String(args.sourcePhase || ""),
        usedPhase: String(usedPhase || ""),
        variant: String(args.variant ?? "base"),
        dir: String(args.dir || ""),
        layer: layerLabel,
        sheetKey: layerRef.key,
        frameIndex: 0,
        frameW: layerRef.frameW | 0,
        frameH: layerRef.frameH | 0,
        cols: gridCols,
        rows: gridRows,
        row: 0,
        col: 0,
        atlasKey,
        atlasImage,
        atlasFrame,
        palette: sample0.palette,
        error: sample0.error,
        oobInfo: sample0.debug
      });
      _logWeaponPixelResolveOnce(`resolve|${layerRef.key}`, line0);
    }

    // Choose a fixed column (recommended), else map time01 -> col, else 0.
    let col = 0;
    if (args.frameColOverride !== undefined && args.frameColOverride !== null) {
      col = (args.frameColOverride | 0);
    } else if (args.time01 !== undefined && args.time01 !== null) {
      const grid = getSheetGrid(args.scene, layerRef);
      const weaponCols = Math.max(1, grid.cols | 0);
      const t = Math.max(0, Math.min(1, Number(args.time01) || 0));
      col = Math.round(t * Math.max(0, weaponCols - 1)) | 0;
    } else {
      col = 0;
    }

    const frameIndex = resolveWeaponFrameIndexForDirAndCol({
      scene: args.scene,
      sheet: layerRef,
      dir: args.dir,
      colIndex: col
    });

    spr.setFrame(frameIndex);
    spr.x = args.x;
    spr.y = args.y;

    spr.setDepth(depth);
    try { spr.setVisible(true); } catch { }

    if (compareDbg || paletteDbg) {
      const cols = Math.max(1, gridCols | 0);
      const rows = Math.max(1, gridRows | 0);
      const row = Math.max(0, ((frameIndex / cols) | 0));
      const colNow = Math.max(0, (frameIndex % cols) | 0);

      if (compareDbg) {
        _compareWeaponFrameToOriginal({
          scene: args.scene,
          weaponId: String(args.weaponId || ""),
          heroPhase: String(args.sourcePhase || ""),
          usedPhase: String(usedPhase || ""),
          variant: String(args.variant ?? "base"),
          dir: String(args.dir || ""),
          layer: layerLabel,
          sheetKey: layerRef.key,
          atlasKey,
          atlasImage,
          atlasFrame,
          frameIndex,
          frameW: layerRef.frameW | 0,
          frameH: layerRef.frameH | 0,
          cols,
          rows,
          x: args.x,
          y: args.y,
          depth
        });
      }

      if (paletteDbg) {
        const sample = _scanFramePalette(args.scene, layerRef.key, frameIndex, layerRef.frameW | 0, layerRef.frameH | 0);
        const line = _buildWeaponPixelLine({
          weaponId: String(args.weaponId || ""),
          heroPhase: String(args.sourcePhase || ""),
          usedPhase: String(usedPhase || ""),
          variant: String(args.variant ?? "base"),
          dir: String(args.dir || ""),
          layer: layerLabel,
          sheetKey: layerRef.key,
          frameIndex,
          frameW: layerRef.frameW | 0,
          frameH: layerRef.frameH | 0,
          cols,
          rows,
          row,
          col: colNow,
          atlasKey,
          atlasImage,
          atlasFrame,
          palette: sample.palette,
          error: sample.error,
          oobInfo: sample.debug
        }) + " heroFrameIndex=-1 frameColOverride=" + (args.frameColOverride ?? -1);
        const sig = `place|${layerRef.key}|${frameIndex}|${args.dir}|${args.variant ?? ""}|${args.sourcePhase}`;
        _logWeaponPixelPlaceOnce(sig, line);
      }
    }

    return { key: layerRef.key, frameIndex };
  };

  const bgDepth = heroDepth - 1;
  const fgDepth = heroDepth + 1;

  const bg = applyOne(args.weaponBg, (pair as any).bg, bgDepth, "bg");
  const fg = applyOne(args.weaponFg, (pair as any).fg, fgDepth, "fg");

  // Optional highlight knob (simple: alpha bump; keep your tint logic in arcadeCompat if you prefer)
  if (args.highlight != null) {
    const a = args.highlight ? 1.0 : 0.7;
    try { args.weaponBg.setAlpha(a); } catch { }
    try { args.weaponFg.setAlpha(a); } catch { }
  }

  return {
    weaponId: args.weaponId,
    heroPhase: args.sourcePhase,
    dir: args.dir,
    variant: args.variant ?? "base",
    mode,
    resolvedAnim: (pair as any).anim,
    resolvedTile: (pair as any).tile,
    x: args.x,
    y: args.y,
    heroDepth,
    bgDepth,
    fgDepth,
    bg,
    fg
  };
}




// ----------------------------------------------------------
// Sprite factory
// ----------------------------------------------------------

export function createWeaponOverlaySprites(args: {
  scene: Phaser.Scene;
  maxGhosts: number;
}): {
  weaponBg: Phaser.GameObjects.Sprite;
  weaponFg: Phaser.GameObjects.Sprite;
  // Back-compat aliases (older glue expected a single weapon sprite)
  weapon: Phaser.GameObjects.Sprite;
  ghostsBg: Phaser.GameObjects.Sprite[];
  ghostsFg: Phaser.GameObjects.Sprite[];
  ghosts: Phaser.GameObjects.Sprite[];
} {
  const { scene } = args;

  // Create with a dummy texture; we'll swap texture+frame on first sync.
  const weaponBg = scene.add.sprite(0, 0, "__MISSING", 0);
  const weaponFg = scene.add.sprite(0, 0, "__MISSING", 0);
  weaponBg.setVisible(false);
  weaponFg.setVisible(false);

  const ghostsBg: Phaser.GameObjects.Sprite[] = [];
  const ghostsFg: Phaser.GameObjects.Sprite[] = [];
  const n = Math.max(0, args.maxGhosts | 0);
  for (let i = 0; i < n; i++) {
    const gb = scene.add.sprite(0, 0, "__MISSING", 0);
    const gf = scene.add.sprite(0, 0, "__MISSING", 0);
    gb.setVisible(false);
    gf.setVisible(false);
    gb.setAlpha(0.25);
    gf.setAlpha(0.35);
    ghostsBg.push(gb);
    ghostsFg.push(gf);
  }

  return {
    weaponBg,
    weaponFg,
    weapon: weaponFg,
    ghostsBg,
    ghostsFg,
    ghosts: ghostsFg
  };
}

// ----------------------------------------------------------
// Frame/grid helpers
// ----------------------------------------------------------

function dirIndex(dir: Dir4): number {
  const i = DIR_ORDER.indexOf(dir);
  return i >= 0 ? i : 0;
}

function clampInt(v: number, lo: number, hi: number): number {
  v |= 0;
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

type SheetGrid = { cols: number; rows: number; total: number };
const GRID_CACHE = new Map<string, SheetGrid>();

function _weaponRowForDir(_scene: Phaser.Scene, _ref: WeaponSheetRef, dir: Dir4, rows: number): number {
  return rows >= 4 ? dirIndex(dir) : 0;
}

function getSheetGrid(scene: Phaser.Scene, ref: WeaponSheetRef): SheetGrid {
  const key = ref.key;
  const cached = GRID_CACHE.get(key);
  if (cached) return cached;

  const refCols = (ref.cols ?? 0) | 0;
  const refRows = (ref.rows ?? 0) | 0;
  let cols = refCols;
  let rows = refRows;
  let total = 0;

  if (cols > 0 && rows > 0) {
    total = cols * rows;
  } else {
    const tex = scene.textures.get(key);
    const src: any = tex?.getSourceImage?.();
    const w = (src?.width ?? 0) | 0;
    const h = (src?.height ?? 0) | 0;
    const tile = ref.frameW | 0;
    cols = tile > 0 ? Math.max(1, Math.floor(w / tile)) : 1;
    rows = tile > 0 ? Math.max(1, Math.floor(h / tile)) : 1;
    total = cols * rows;
  }

  const grid = { cols, rows, total };
  GRID_CACHE.set(key, grid);
  return grid;
}



function _fmtWeaponResolveHitOneLine(payload: any): string {
  const weaponId = payload?.weaponId ?? "";
  const heroPhase = payload?.heroPhase ?? "";
  const mode = payload?.mode ?? "";
  const variant = payload?.variant ?? "";
  const bg = payload?.bg ?? "";
  const fg = payload?.fg ?? "";

  // Keep this stable + grep-friendly
  return (
    "weaponId=" + weaponId +
    " heroPhase=" + heroPhase +
    " mode=" + mode +
    " variant=" + variant +
    " bg=" + bg +
    " fg=" + fg
  );
}

function _fmtWeaponResolveMissOneLine(payload: any): string {
  const weaponId = payload?.weaponId ?? "";
  const heroPhase = payload?.heroPhase ?? "";
  const mode = payload?.mode ?? "";
  const variant = payload?.variant ?? "";
  const reason = payload?.reason ?? "";
  const bg = payload?.bg ?? "";
  const fg = payload?.fg ?? "";

  // Keep this stable + grep-friendly
  return (
    "weaponId=" + weaponId +
    " heroPhase=" + heroPhase +
    " mode=" + mode +
    " variant=" + variant +
    " reason=" + reason +
    " bg=" + bg +
    " fg=" + fg
  );
}

function _fmtWeaponHiddenOneLine(payload: any): string {
  const note = payload?.note ?? "";
  const weaponId = payload?.weaponId ?? "";
  const heroPhase = payload?.heroPhase ?? "";
  const usedPhase = payload?.usedPhase ?? "";
  const mode = payload?.mode ?? "";
  const dir = payload?.dir ?? "";
  const variant = payload?.variant ?? "";
  const x = payload?.x ?? "";
  const y = payload?.y ?? "";
  const bgRef = payload?.bgRef ?? "";
  const fgRef = payload?.fgRef ?? "";

  // Keep this stable + grep-friendly
  return (
    "note=" + note +
    " weaponId=" + weaponId +
    " heroPhase=" + heroPhase +
    " usedPhase=" + usedPhase +
    " mode=" + mode +
    " dir=" + dir +
    " variant=" + variant +
    " x=" + x +
    " y=" + y +
    " bgRef=" + bgRef +
    " fgRef=" + fgRef
  );
}

function _atlasDebugFields(scene: Phaser.Scene | undefined, keys: string[] | undefined): {
  atlasKeys: string;
  atlasExists: string;
  atlasFrames: string;
  atlasImages: string;
} {
  const list = Array.isArray(keys) ? keys.filter(Boolean).map((k) => String(k)) : [];
  if (!scene || list.length === 0) {
    return { atlasKeys: "", atlasExists: "", atlasFrames: "", atlasImages: "" };
  }
  const textures: any = scene.textures as any;
  const atlasKeys: string[] = [];
  const atlasExists: string[] = [];
  const atlasFrames: string[] = [];
  const atlasImages: string[] = [];
  for (const key of list) {
    const meta = getWeaponSheetMeta(key);
    const atlasInfo = getWeaponAtlasFrameForSheet(key);
    const atlasKey = String(atlasInfo?.atlasKey || meta?.atlasKey || "");
    atlasKeys.push(key + ":" + atlasKey);
    const exists = atlasKey && textures && typeof textures.exists === "function" && textures.exists(atlasKey) ? 1 : 0;
    atlasExists.push(key + ":" + exists);
    if (atlasInfo?.frame) {
      const f = atlasInfo.frame;
      atlasFrames.push(key + ":" + [f.x | 0, f.y | 0, f.w | 0, f.h | 0].join(","));
    }
    if (atlasInfo?.image) atlasImages.push(key + ":" + String(atlasInfo.image));
  }
  return {
    atlasKeys: atlasKeys.join(","),
    atlasExists: atlasExists.join(","),
    atlasFrames: atlasFrames.join(","),
    atlasImages: atlasImages.join(",")
  };
}

function _loaderDebugFields(scene: Phaser.Scene | undefined): {
  loaderLoading: string;
  loaderList: string;
  loaderInflight: string;
  loaderQueue: string;
} {
  const loader: any = scene?.load as any;
  if (!loader) {
    return { loaderLoading: "", loaderList: "", loaderInflight: "", loaderQueue: "" };
  }
  const loading = (typeof loader.isLoading === "function") ? (loader.isLoading() ? 1 : 0) : 0;
  const listSize = Number.isFinite(loader?.list?.size) ? loader.list.size : "";
  const inflightSize = Number.isFinite(loader?.inflight?.size) ? loader.inflight.size : "";
  const queueSize = Number.isFinite(loader?.queue?.size) ? loader.queue.size : "";
  return {
    loaderLoading: String(loading),
    loaderList: String(listSize),
    loaderInflight: String(inflightSize),
    loaderQueue: String(queueSize)
  };
}

function _fmtWeaponMissingTexOneLine(payload: any): string {
  const weaponId = payload?.weaponId ?? "";
  const heroPhase = payload?.heroPhase ?? "";
  const usedPhase = payload?.usedPhase ?? "";
  const mode = payload?.mode ?? "";
  const variant = payload?.variant ?? "";
  const bgKey = payload?.bgKey ?? "";
  const fgKey = payload?.fgKey ?? "";
  const missingKey = payload?.missingKey ?? "";
  const missing = Array.isArray(payload?.missing) ? payload.missing.join(",") : (payload?.missing ?? "");
  const keys = Array.isArray(payload?.keys) ? payload.keys.join(",") : (payload?.keys ?? "");
  const queued = Number.isFinite(payload?.queued) ? String(payload.queued) : "";
  const total = Number.isFinite(payload?.total) ? String(payload.total) : "";
  const atlasKeys = payload?.atlasKeys ?? "";
  const atlasExists = payload?.atlasExists ?? "";
  const atlasFrames = payload?.atlasFrames ?? "";
  const atlasImages = payload?.atlasImages ?? "";
  const loaderLoading = payload?.loaderLoading ?? "";
  const loaderList = payload?.loaderList ?? "";
  const loaderInflight = payload?.loaderInflight ?? "";
  const loaderQueue = payload?.loaderQueue ?? "";

  // Keep this stable + grep-friendly
  return (
    "weaponId=" + weaponId +
    " heroPhase=" + heroPhase +
    " usedPhase=" + usedPhase +
    " mode=" + mode +
    " variant=" + variant +
    " bgKey=" + bgKey +
    " fgKey=" + fgKey +
    " missingKey=" + missingKey +
    " missing=" + missing +
    " keys=" + keys +
    " atlasKeys=" + atlasKeys +
    " atlasExists=" + atlasExists +
    " atlasFrames=" + atlasFrames +
    " atlasImages=" + atlasImages +
    " loaderLoading=" + loaderLoading +
    " loaderList=" + loaderList +
    " loaderInflight=" + loaderInflight +
    " loaderQueue=" + loaderQueue +
    " queued=" + queued +
    " total=" + total
  );
}

function _fmtNpcWeaponMapOneLine(payload: any): string {
  const heroName = payload?.heroName ?? "";
  const heroFamily = payload?.heroFamily ?? "";
  const npcRole = payload?.npcRole ?? "";
  const weaponId = payload?.weaponId ?? "";
  const heroPhase = payload?.heroPhase ?? "";
  const usedPhase = payload?.usedPhase ?? "";
  const dir = payload?.dir ?? "";
  const heroFrameIndex = payload?.heroFrameIndex ?? "";
  const bg = payload?.bg ?? "";
  const fg = payload?.fg ?? "";

  // Keep this stable + grep-friendly
  return (
    "heroName=" + heroName +
    " heroFamily=" + heroFamily +
    " npcRole=" + npcRole +
    " weaponId=" + weaponId +
    " heroPhase=" + heroPhase +
    " usedPhase=" + usedPhase +
    " dir=" + dir +
    " heroFrameIndex=" + heroFrameIndex +
    " bg=" + bg +
    " fg=" + fg
  );
}

function _fmtWeaponPlacedOneLine(payload: any): string {
  const weaponId = payload?.weaponId ?? "";
  const heroName = payload?.heroName ?? "";
  const heroFamily = payload?.heroFamily ?? "";
  const heroPhase = payload?.heroPhase ?? "";
  const usedPhase = payload?.usedPhase ?? "";
  const mode = payload?.mode ?? "";
  const dir = payload?.dir ?? "";
  const variant = payload?.variant ?? "";
  const heroFrameIndex = payload?.heroFrameIndex ?? "";
  const frameColOverride = payload?.frameColOverride ?? "";
  const x = payload?.x ?? "";
  const y = payload?.y ?? "";
  const heroDepth = payload?.heroDepth ?? "";
  const bgDepth = payload?.bgDepth ?? "";
  const fgDepth = payload?.fgDepth ?? "";
  const bgVisible = payload?.bgVisible ?? "";
  const fgVisible = payload?.fgVisible ?? "";
  const bgKey = payload?.bgKey ?? "";
  const bgFrame = payload?.bgFrame ?? "";
  const fgKey = payload?.fgKey ?? "";
  const fgFrame = payload?.fgFrame ?? "";

  // Keep this stable + grep-friendly
  return (
    "weaponId=" + weaponId +
    " heroName=" + heroName +
    " heroFamily=" + heroFamily +
    " heroPhase=" + heroPhase +
    " usedPhase=" + usedPhase +
    " mode=" + mode +
    " dir=" + dir +
    " variant=" + variant +
    " heroFrameIndex=" + heroFrameIndex +
    " frameColOverride=" + frameColOverride +
    " x=" + x +
    " y=" + y +
    " heroDepth=" + heroDepth +
    " bgDepth=" + bgDepth +
    " fgDepth=" + fgDepth +
    " bgVisible=" + bgVisible +
    " fgVisible=" + fgVisible +
    " bgKey=" + bgKey +
    " bgFrame=" + bgFrame +
    " fgKey=" + fgKey +
    " fgFrame=" + fgFrame
  );
}



// ----------------------------------------------------------
// Core “sync to hero” frame mapping
// ----------------------------------------------------------

// Returned by syncWeaponLayersToHero / syncWeaponToHero.
// Useful later for single-frame poses, ghost copies, and free-floating weapon effects.
export type WeaponResolvedLayer = {
  key: string;
  frameIndex: number;
};

export type WeaponFrameOverrideMode = "weaponCol" | "heroClip" | "absFrame";

export type WeaponRenderResolve = {
  weaponId: WeaponId;
  heroPhase: string;
  dir: Dir4;
  variant: string;
  // We keep mode for observability/debug, but tile selection is handled by weaponAtlas.
  mode: WeaponMode;
  // The resolved anim token inside the atlas (e.g. "slash" or "thrust_oversize" normalized).
  resolvedAnim: string;
  // Tile size that the atlas resolved (64/128/192).
  resolvedTile: number;
  // Final draw position used.
  x: number;
  y: number;
  // Depth plan.
  heroDepth: number;
  bgDepth: number;
  fgDepth: number;
  // Layers (if present in the pack)
  bg?: WeaponResolvedLayer;
  fg?: WeaponResolvedLayer;
};

// If you want a fixed *column* (single frame) independent of hero animation progress,
// use this helper and then set sprite.setFrame(result).
export function resolveWeaponFrameIndexForDirAndCol(args: {
  scene: Phaser.Scene;
  sheet: WeaponSheetRef;
  dir: Dir4;
  colIndex: number; // 0..(cols-1)
}): number {
  const grid = getSheetGrid(args.scene, args.sheet);
  const weaponCols = grid.cols;
  const weaponRows = grid.rows;
  const row = _weaponRowForDir(args.scene, args.sheet, args.dir, weaponRows);
  const col = clampInt(args.colIndex | 0, 0, Math.max(0, weaponCols - 1));
  const idx = row * weaponCols + col;
  return clampInt(idx, 0, Math.max(0, grid.total - 1));
}






export function resolveWeaponFrameIndexForLayer(args: {
  scene: Phaser.Scene;
  sheet: WeaponSheetRef;
  dir: Dir4;
  heroSprite: Phaser.GameObjects.Sprite;
  heroFrameIndex: number;
  frameColOverride?: number;
  frameColOverrideMode?: WeaponFrameOverrideMode;
}): number {
  const grid = getSheetGrid(args.scene, args.sheet);
  const weaponCols = grid.cols;
  const weaponRows = grid.rows;

  const row = _weaponRowForDir(args.scene, args.sheet, args.dir, weaponRows);

  if (_weaponDebugVerbose()) {
    const refRows = (args.sheet.rows ?? 0) | 0;
    const refCols = (args.sheet.cols ?? 0) | 0;
    const rawCol = (args.frameColOverride ?? -9999) | 0;
    const colKey = (rawCol === -9999) ? "auto" : String(rawCol);
    const sig = `${args.sheet.key}|${args.dir}|${row}|${weaponRows}|${weaponCols}|${colKey}`;
    if (!_WPN_ROW_LOG_ONCE.has(sig)) {
      _WPN_ROW_LOG_ONCE.add(sig);
      console.log("[WPN-ROW]", {
        key: args.sheet.key,
        dir: args.dir,
        row,
        rows: weaponRows,
        cols: weaponCols,
        refRows,
        refCols,
        frameColOverride: (args.frameColOverride ?? null)
      });
    }
  }

  const anyHero: any = args.heroSprite as any;

  const getData = (k: string): any => {
    try {
      if (anyHero && typeof anyHero.getData === "function") return anyHero.getData(k);
      return anyHero?.data?.values?.[k];
    } catch {
      return undefined;
    }
  };

  // Explicit override (mode controls meaning)
  if (args.frameColOverride !== undefined && args.frameColOverride !== null) {
    const rawCol = args.frameColOverride | 0;
    const mode = args.frameColOverrideMode ?? "weaponCol";

    if (mode === "absFrame") {
      const total = Math.max(0, grid.total - 1);
      const idx = (rawCol < 0) ? total : clampInt(rawCol, 0, total);
      return clampInt(idx, 0, Math.max(0, grid.total - 1));
    }

    if (mode === "heroClip") {
      const clenRaw = getData(HERO_FOLLOW_CLIP_LEN_KEY);
      const clipLen = (typeof clenRaw === "number" && Number.isFinite(clenRaw) && clenRaw > 0) ? (clenRaw | 0) : 0;
      if (clipLen > 1 && weaponCols > 1) {
        const safeF = clampInt((rawCol < 0) ? (clipLen - 1) : rawCol, 0, clipLen - 1);
        const den = Math.max(1, clipLen - 1);
        const wden = Math.max(1, weaponCols - 1);
        const weaponCol = clampInt(Math.round((safeF * wden) / den), 0, weaponCols - 1);
        const idx = row * weaponCols + weaponCol;
        return clampInt(idx, 0, Math.max(0, grid.total - 1));
      }
      // Fallback to weaponCol if clip length isn't available.
    }

    // Default: treat override as weapon column.
    const col = (rawCol < 0)
      ? Math.max(0, weaponCols - 1)
      : clampInt(rawCol, 0, Math.max(0, weaponCols - 1));
    const idx = row * weaponCols + col;
    return clampInt(idx, 0, Math.max(0, grid.total - 1));
  }

  const nowLocal =
    (args.scene as any)?.time?.now ??
    (args.scene as any)?.game?.loop?.time ??
    Date.now();

  // ------------------------------------------------------------
  // Execute yo-yo override (3<->4) based on beat timestamp
  // ------------------------------------------------------------
  const actionKindRaw = getData("ActionKind");
  const actionKind = (typeof actionKindRaw === "string") ? actionKindRaw : "";

  if (actionKind === "agility_execute" && weaponCols > 1) {
    const beatStartRaw = getData(WPN_LOCAL_EXEC_BEAT_LOCAL_START_KEY);
    const beatStart = (typeof beatStartRaw === "number" && Number.isFinite(beatStartRaw)) ? beatStartRaw : 0;

    if (beatStart > 0) {
      const dt = Math.max(0, nowLocal - beatStart);
      if (dt <= WPN_EXEC_YOYO_WINDOW_MS) {
        let colA = 3;
        let colB = 4;

        if (weaponCols <= 4) {
          colB = Math.max(0, weaponCols - 1);
          colA = Math.max(0, weaponCols - 2);
        }

        colA = clampInt(colA, 0, weaponCols - 1);
        colB = clampInt(colB, 0, weaponCols - 1);

        const step = (Math.floor(dt / Math.max(1, WPN_EXEC_YOYO_STEP_MS)) | 0);
        const flip = (step & 1) ? 1 : 0;

        const col = flip ? colB : colA;
        const idx = row * weaponCols + col;
        return clampInt(idx, 0, Math.max(0, grid.total - 1));
      }
    }
  }

  // ------------------------------------------------------------
  // ✅ NEW PREFERRED PATH:
  // Use hero-published "frame within clip" and clip length.
  // This is the correct semantic alignment for weapon sheets.
  // ------------------------------------------------------------
  const fincRaw = getData("HeroFollowFrameInClip");
  const clenRaw = getData("HeroFollowClipLen");

  const frameInClip = (typeof fincRaw === "number" && Number.isFinite(fincRaw)) ? (fincRaw | 0) : -1;
  const clipLen = (typeof clenRaw === "number" && Number.isFinite(clenRaw) && clenRaw > 0) ? (clenRaw | 0) : 0;

  if (frameInClip >= 0 && clipLen > 1 && weaponCols > 1) {
    const safeClipLen = Math.max(1, clipLen);
    const safeF = clampInt(frameInClip, 0, safeClipLen - 1);

    // Map 0..clipLen-1 -> 0..weaponCols-1 (endpoint aligned)
    const den = Math.max(1, safeClipLen - 1);
    const wden = Math.max(1, weaponCols - 1);
    const weaponCol = clampInt(Math.round((safeF * wden) / den), 0, weaponCols - 1);

    const idx = row * weaponCols + weaponCol;
    return clampInt(idx, 0, Math.max(0, grid.total - 1));
  }

  // If weapon has only 1 col, it’s always 0
  if (weaponCols <= 1) {
    const idx = row * weaponCols + 0;
    return clampInt(idx, 0, Math.max(0, grid.total - 1));
  }

  // ------------------------------------------------------------
  // OLD FALLBACK (kept): absolute-sheet-column scaling
  // ------------------------------------------------------------
  try {
    const hf: any = (args.heroSprite as any).frame;
    const heroTileW = (hf?.width ?? 0) | 0;

    const heroTexKey = String((args.heroSprite as any).texture?.key ?? "");
    const heroTex = args.scene.textures.get(heroTexKey);
    const heroSrc: any = heroTex?.getSourceImage?.();
    const heroW = (heroSrc?.width ?? 0) | 0;

    const heroCols = heroTileW > 0 ? Math.max(1, Math.floor(heroW / heroTileW)) : 1;

    const heroCol = clampInt((args.heroFrameIndex | 0) % heroCols, 0, heroCols - 1);

    const heroDen = Math.max(1, heroCols - 1);
    const weaponDen = Math.max(1, weaponCols - 1);

    const weaponCol = clampInt(
      Math.round((heroCol * weaponDen) / heroDen),
      0,
      weaponCols - 1
    );

    const idx = row * weaponCols + weaponCol;
    return clampInt(idx, 0, Math.max(0, grid.total - 1));
  } catch {
    // fall through
  }

  // ------------------------------------------------------------
  // Final fallback: time-based (if needed)
  // ------------------------------------------------------------
  if (weaponCols > 1) {
    const actionSeq = (Number(getData("ActionSequence")) || 0) | 0;
    const phaseDurMs = (Number(getData("PhaseDurationMs")) || 0) | 0;

    if (actionSeq && phaseDurMs > 0) {
      const dt = Math.max(0, (nowLocal | 0) - (Number(getData(WPN_LOCAL_PHASE_LOCAL_START_KEY)) || nowLocal));
      const p = Math.max(0, Math.min(1, dt / Math.max(1, phaseDurMs)));
      const col = clampInt(Math.round(p * Math.max(0, weaponCols - 1)), 0, weaponCols - 1);
      const idx = row * weaponCols + col;
      return clampInt(idx, 0, Math.max(0, grid.total - 1));
    }
  }

  const idx = row * weaponCols + 0;
  return clampInt(idx, 0, Math.max(0, grid.total - 1));
}




export function syncWeaponLayersToHero(args: {
  scene: Phaser.Scene;
  heroSprite: Phaser.GameObjects.Sprite;
  weaponBg: Phaser.GameObjects.Sprite;
  weaponFg: Phaser.GameObjects.Sprite;
  weaponId: WeaponId; // == MODEL
  heroPhase: string;
  dir: Dir4;
  heroFrameIndex: number;
  variant?: string; // without leading "v"
  frameColOverride?: number;
  frameColOverrideMode?: WeaponFrameOverrideMode;
  frameDirOverride?: Dir4;
  posOffsetX?: number;
  posOffsetY?: number;
  aimDx1000?: number;
  aimDy1000?: number;
  aimAngleMdeg?: number;
  allowAimRotate?: boolean;
}): WeaponRenderResolve | null {
  let model = String(args.weaponId || "").trim();
  if (!model) {
    args.weaponBg.setVisible(false);
    args.weaponFg.setVisible(false);
    return null;
  }

  const heroAny: any = args.heroSprite as any;
  const heroFamilyLower = _normFamily(String(heroAny.getData?.("heroFamily") || ""));
  let heroPhase = String(args.heroPhase || "");
  let variant = args.variant;
  const dbgOn = _weaponDebugEnabled();
  const dbgVerbose = _weaponDebugVerbose();

  const dbgOrigOverride = _debugOriginalOverrideForFamily(heroFamilyLower, heroPhase);
  if (dbgOrigOverride) {
    const requestedWeaponId = model;
    const requestedPhase = heroPhase;
    model = dbgOrigOverride.weaponId;
    heroPhase = dbgOrigOverride.heroPhase;
    variant = dbgOrigOverride.variant;
    if (dbgOn) {
      const sig = `dbgorig|${heroFamilyLower}|${requestedWeaponId}|${requestedPhase}|${model}|${heroPhase}`;
      _logWeaponDebugOriginalsOnce(
        sig,
        "family=" + heroFamilyLower +
        " requestedWeaponId=" + requestedWeaponId +
        " requestedPhase=" + requestedPhase +
        " forcedWeaponId=" + model +
        " forcedPhase=" + heroPhase +
        " forcedVariant=" + (variant ?? "base")
      );
    }
  }

  const mode: WeaponMode = weaponModeForHeroPhase(heroPhase);
  const missKey = `${model}|${heroPhase}|${mode}|${variant ?? ""}`;

  const heroDepth = heroAny.depth ?? 0;
  const off = WEAPON_OFFSET_BY_DIR[args.dir] ?? { x: 0, y: 0 };
  const aimDx1000 = (typeof args.aimDx1000 === "number") ? (args.aimDx1000 | 0) : 0;
  const aimDy1000 = (typeof args.aimDy1000 === "number") ? (args.aimDy1000 | 0) : 0;
  const aimAngleMdeg = (typeof args.aimAngleMdeg === "number") ? (args.aimAngleMdeg | 0) : 0;
  const baseDir = (args.frameDirOverride ?? args.dir) as Dir4;
  const aimIsDiag = (aimDx1000 !== 0 && aimDy1000 !== 0);
  const useAimRotate = !!args.allowAimRotate && aimIsDiag;

  function _dirBaseRad(dir: Dir4): number {
    switch (dir) {
      case "up": return -Math.PI / 2;
      case "down": return Math.PI / 2;
      case "left": return Math.PI;
      case "right": return 0;
      default: return 0;
    }
  }

  function _wrapRad(r: number): number {
    let v = r;
    while (v > Math.PI) v -= Math.PI * 2;
    while (v < -Math.PI) v += Math.PI * 2;
    return v;
  }

  let aimRot = 0;
  if (useAimRotate) {
    const baseRad = _dirBaseRad(baseDir);
    const targetRad = (aimAngleMdeg !== 0)
      ? ((aimAngleMdeg * Math.PI) / 180000)
      : Math.atan2(aimDy1000, aimDx1000);
    aimRot = _wrapRad(targetRad - baseRad);
    // NOTE: If we later add body lean, use the same aim angle in heroAnimGlue.
  }

  // Optional per-hero weapon offset (lets us “fake” extra placement)
  const wpnOx = heroAny.getData?.("wpnOx") ?? 0;
  const wpnOy = heroAny.getData?.("wpnOy") ?? 0;

  // IMPORTANT:
  // Arcade sprites use x/y as the CENTER of their collider image.
  // If the Phaser hero-native is "feet anchored" (originY=1.0), then
  // heroSprite.x/y are NOT the center anymore.
  // Weapons/overlays were authored assuming center anchoring (legacy behavior),
  // so we compute the hero's visual CENTER in world coords and attach weapons there.
  const heroOx = (typeof heroAny.originX === "number") ? (heroAny.originX as number) : 0.5;
  const heroOy = (typeof heroAny.originY === "number") ? (heroAny.originY as number) : 0.5;
  const heroW = ((typeof heroAny.displayWidth === "number" && heroAny.displayWidth > 0)
    ? heroAny.displayWidth
    : (typeof heroAny.width === "number" ? heroAny.width : 0)) as number;
  const heroH = ((typeof heroAny.displayHeight === "number" && heroAny.displayHeight > 0)
    ? heroAny.displayHeight
    : (typeof heroAny.height === "number" ? heroAny.height : 0)) as number;

  const heroCx = args.heroSprite.x + (0.5 - heroOx) * heroW;
  const heroCy = args.heroSprite.y + (0.5 - heroOy) * heroH;

  const extraX = (typeof args.posOffsetX === "number") ? args.posOffsetX : 0;
  const extraY = (typeof args.posOffsetY === "number") ? args.posOffsetY : 0;

  let x = heroCx + (wpnOx | 0) + off.x + extraX;
  let y = heroCy + (wpnOy | 0) + off.y + extraY;

  // For debug reuse across blocks
  let dbgHeroName = "";
  let dbgHeroFamily = "";

  const paletteDbg = _weaponPixelPaletteDebugEnabled();
  const compareDbg = _weaponPixelCompareDebugEnabled();

  const _getHeroData = (k: string): any => {
    try {
      if (heroAny && typeof heroAny.getData === "function") return heroAny.getData(k);
      return heroAny?.data?.values?.[k];
    } catch {
      return undefined;
    }
  };
  const _setHeroData = (k: string, v: any): void => {
    try {
      if (heroAny && typeof heroAny.setData === "function") {
        heroAny.setData(k, v);
        return;
      }
      if (heroAny?.data?.values) heroAny.data.values[k] = v;
    } catch {
      // ignore
    }
  };

  const _ghostKeyForLayer = (layer: "bg" | "fg"): string =>
    layer === "bg" ? WPN_ORIG_GHOST_BG_KEY : WPN_ORIG_GHOST_FG_KEY;

  const _hideGhostsIfDisabled = (): void => {
    if (compareDbg) return;
    const bgGhost = _getHeroData(WPN_ORIG_GHOST_BG_KEY) as Phaser.GameObjects.Sprite | undefined;
    const fgGhost = _getHeroData(WPN_ORIG_GHOST_FG_KEY) as Phaser.GameObjects.Sprite | undefined;
    try { bgGhost?.setVisible(false); } catch { /* ignore */ }
    try { fgGhost?.setVisible(false); } catch { /* ignore */ }
  };
  _hideGhostsIfDisabled();

  const _getOrCreateGhost = (layer: "bg" | "fg"): Phaser.GameObjects.Sprite | null => {
    if (!compareDbg) return null;
    const keyName = _ghostKeyForLayer(layer);
    let ghost = _getHeroData(keyName) as Phaser.GameObjects.Sprite | undefined;
    if (ghost && ghost.scene !== args.scene) ghost = undefined;
    if (!ghost) {
      ghost = args.scene.add.sprite(heroCx, heroCy, args.heroSprite.texture.key);
      ghost.setAlpha(WPN_ORIG_GHOST_ALPHA);
      ghost.setTint(WPN_ORIG_GHOST_TINT);
      ghost.setVisible(false);
      _setHeroData(keyName, ghost);
      try {
        args.heroSprite.once("destroy", () => {
          try { ghost?.destroy(); } catch { /* ignore */ }
        });
      } catch {
        // ignore
      }
    }
    return ghost;
  };

  const _syncOriginalGhost = (
    layer: "bg" | "fg",
    layerRef: WeaponSheetRef,
    frameIndex: number,
    gx: number,
    gy: number,
    depth: number
  ): void => {
    if (!compareDbg) return;
    const textures: any = args.scene?.textures;
    const origKey = getWeaponOriginalRefKey(layerRef.key);
    const ghost = _getOrCreateGhost(layer);
    if (!ghost || !textures || typeof textures.exists !== "function" || !origKey || !textures.exists(origKey)) {
      try { ghost?.setVisible(false); } catch { /* ignore */ }
      if (origKey && (!textures || !textures.exists(origKey))) {
        _logWeaponOriginalRefMissingOnce(layerRef.key, "key=" + layerRef.key + " origKey=" + origKey);
      }
      return;
    }
    if (ghost.texture?.key !== origKey) ghost.setTexture(origKey);
    ghost.setFrame(frameIndex);
    ghost.x = gx;
    ghost.y = gy;
    try { (ghost as any).setOrigin?.(0.5, 0.5); } catch { /* ignore */ }
    ghost.scaleX = heroAny.scaleX ?? 1;
    ghost.scaleY = heroAny.scaleY ?? 1;
    const baseRot = heroAny.rotation ?? 0;
    (ghost as any).rotation = baseRot + (useAimRotate ? aimRot : 0);
    if (typeof (ghost as any).setFlipX === "function") (ghost as any).setFlipX(!!heroAny.flipX);
    if (typeof (ghost as any).setFlipY === "function") (ghost as any).setFlipY(!!heroAny.flipY);
    ghost.setDepth(depth + (layer === "fg" ? 0.25 : -0.25));
    ghost.setAlpha(WPN_ORIG_GHOST_ALPHA);
    ghost.setTint(WPN_ORIG_GHOST_TINT);
    ghost.setVisible(true);
  };

  const applyOne = (
    spr: Phaser.GameObjects.Sprite,
    layerRef: WeaponSheetRef | undefined,
    depth: number,
    layerLabel: "bg" | "fg"
  ): WeaponResolvedLayer | undefined => {
    if (!layerRef) {
      spr.setVisible(false);
      return undefined;
    }

    const textures: any = args.scene?.textures;
    if (textures && typeof textures.exists === "function" && !textures.exists(layerRef.key)) {
      const loadStatus = ensureWeaponSheetsLoaded(args.scene, model, variant);
      if (dbgOn && !loadStatus.ready) {
        const atlasDbg = _atlasDebugFields(args.scene, [layerRef.key]);
        const loaderDbg = _loaderDebugFields(args.scene);
        _logWeaponMissingTexOnce(missKey + "|layer:" + layerRef.key, {
          weaponId: model,
          heroPhase,
          usedPhase,
          mode,
          variant: variant ?? "base",
          dir: args.dir,
          heroFrameIndex: args.heroFrameIndex,
          missing: [layerRef.key],
          keys: [layerRef.key],
          atlasKeys: atlasDbg.atlasKeys,
          atlasExists: atlasDbg.atlasExists,
          atlasFrames: atlasDbg.atlasFrames,
          atlasImages: atlasDbg.atlasImages,
          loaderLoading: loaderDbg.loaderLoading,
          loaderList: loaderDbg.loaderList,
          loaderInflight: loaderDbg.loaderInflight,
          loaderQueue: loaderDbg.loaderQueue,
          queued: loadStatus.queued,
          total: loadStatus.total
        });
      }
      try { spr.setVisible(false); } catch { }
      return undefined;
    }

    if (spr.texture?.key !== layerRef.key) spr.setTexture(layerRef.key);

    const debugNeedsMeta = paletteDbg || compareDbg;
    let gridCols = 0;
    let gridRows = 0;
    let atlasKey = "";
    let atlasImage = "";
    let atlasFrame: { x: number; y: number; w: number; h: number } | undefined;
    if (debugNeedsMeta) {
      const meta = getWeaponSheetMeta(layerRef.key);
      const atlasInfo = getWeaponAtlasFrameForSheet(layerRef.key);
      atlasKey = meta?.atlasKey ?? atlasInfo?.atlasKey ?? "";
      atlasImage = atlasInfo?.image ?? "";
      atlasFrame = atlasInfo?.frame;
      const grid = getSheetGrid(args.scene, layerRef);
      gridCols = Math.max(1, grid.cols | 0);
      gridRows = Math.max(1, grid.rows | 0);
    }

    const frameIndex = resolveWeaponFrameIndexForLayer({
      scene: args.scene,
      sheet: layerRef,
      dir: args.frameDirOverride ?? args.dir,
      heroSprite: args.heroSprite,
      heroFrameIndex: args.heroFrameIndex,
      frameColOverride: args.frameColOverride,
      frameColOverrideMode: args.frameColOverrideMode
    });
    spr.setFrame(frameIndex);

    // Tight nudge: down-slash cols 4/5 need a tiny hand alignment fix.
    let nudgeX = 0;
    let nudgeY = 0;
    if (baseDir === "down") {
      const phaseLower = String(heroPhase || "").toLowerCase();
      if (phaseLower.includes("slash") && String(model || "").toLowerCase() === "arming") {
        const grid = getSheetGrid(args.scene, layerRef);
        const cols = grid.cols | 0;
        if (cols > 0) {
          const col = Math.max(0, (frameIndex % cols) | 0);
          if (col === 4 || col === 5) {
            nudgeX = 2;
            nudgeY = -2;
          }
        }
      }
    }

    spr.x = x + nudgeX;
    spr.y = y + nudgeY;

    // Legacy weapon overlays were authored around center anchoring.
    // Keep that stable even if the hero-native is feet-anchored.
    try { (spr as any).setOrigin?.(0.5, 0.5); } catch { /* ignore */ }

    spr.scaleX = heroAny.scaleX ?? 1;
    spr.scaleY = heroAny.scaleY ?? 1;
    const baseRot = heroAny.rotation ?? 0;
    (spr as any).rotation = baseRot + (useAimRotate ? aimRot : 0);

    if (typeof (spr as any).setFlipX === "function") (spr as any).setFlipX(!!heroAny.flipX);
    if (typeof (spr as any).setFlipY === "function") (spr as any).setFlipY(!!heroAny.flipY);

    spr.setDepth(depth);
    spr.setVisible(true);

    _syncOriginalGhost(layerLabel, layerRef, frameIndex, spr.x, spr.y, depth);

    if (compareDbg || paletteDbg) {
      const cols = Math.max(1, gridCols | 0);
      const rows = Math.max(1, gridRows | 0);
      const row = Math.max(0, ((frameIndex / cols) | 0));
      const colNow = Math.max(0, (frameIndex % cols) | 0);

      if (compareDbg) {
        _compareWeaponFrameToOriginal({
          scene: args.scene,
          weaponId: String(model || ""),
          heroPhase: String(heroPhase || ""),
          usedPhase: String(usedPhase || ""),
          variant: String(variant ?? "base"),
          dir: String(args.dir || ""),
          layer: layerLabel,
          sheetKey: layerRef.key,
          atlasKey,
          atlasImage,
          atlasFrame,
          frameIndex,
          frameW: layerRef.frameW | 0,
          frameH: layerRef.frameH | 0,
          cols,
          rows,
          x: spr.x,
          y: spr.y,
          depth
        });
      }

      if (paletteDbg) {
        const sample = _scanFramePalette(args.scene, layerRef.key, frameIndex, layerRef.frameW | 0, layerRef.frameH | 0);
        const line = _buildWeaponPixelLine({
          weaponId: String(model || ""),
          heroPhase: String(heroPhase || ""),
          usedPhase: String(usedPhase || ""),
          variant: String(variant ?? "base"),
          dir: String(args.dir || ""),
          layer: layerLabel,
          sheetKey: layerRef.key,
          frameIndex,
          frameW: layerRef.frameW | 0,
          frameH: layerRef.frameH | 0,
          cols,
          rows,
          row,
          col: colNow,
          atlasKey,
          atlasImage,
          atlasFrame,
          palette: sample.palette,
          error: sample.error,
          oobInfo: sample.debug
        }) + " heroFrameIndex=" + (args.heroFrameIndex | 0) + " frameColOverride=" + (args.frameColOverride ?? -1);
        const sig = `place|${layerRef.key}|${frameIndex}|${args.dir}|${variant ?? ""}|${heroPhase}`;
        _logWeaponPixelPlaceOnce(sig, line);
      }
    }

    return { key: layerRef.key, frameIndex };
  };

  // -----------------------------
  // phase fallback chain
  // -----------------------------
  const rawPhase = String(heroPhase || "").trim();
  const snake = rawPhase
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();

  const overridePhase = _phaseOverrideForFamily(heroFamilyLower, model, rawPhase);
  const phaseTry: string[] = [];
  const pushPhase = (p: string | null | undefined) => {
    const v = String(p || "").trim();
    if (!v) return;
    if (!phaseTry.includes(v)) phaseTry.push(v);
  };

  pushPhase(overridePhase);
  pushPhase(heroPhase);

  if (dbgOn && overridePhase && overridePhase !== heroPhase) {
    const sig = `${heroFamilyLower}|${model}|${heroPhase}|${overridePhase}`;
    _logWeaponFamilyOverrideOnce(
      sig,
      `family=${heroFamilyLower} weaponId=${model} heroPhase=${heroPhase} override=${overridePhase}`
    );
  }

  if (snake === "combat_idle" || snake === "combatidle") {
    pushPhase("idle");
    pushPhase("slash");
    pushPhase("attack_slash");
    pushPhase("thrust");
    pushPhase("walk");
  } else if (snake === "idle") {
    pushPhase("combatIdle");
    pushPhase("slash");
    pushPhase("attack_slash");
    pushPhase("thrust");
    pushPhase("walk");
  }

  let pair: ReturnType<typeof resolveWeaponLayerPair> = null;
  let usedPhase = heroPhase;

  for (const p of phaseTry) {
    const attempt = resolveWeaponLayerPair({
      weaponId: model,
      heroPhase: p,
      mode,
      variant
    });
    if (attempt) {
      pair = attempt;
      usedPhase = p;
      break;
    }
  }

  // Final fallback: if the specific phase(s) don't exist, pick ANY anim for this weapon.
  if (!pair) {
    const anyPair = resolveAnyWeaponLayerPair({
      weaponId: model,
      variant
    });
    if (anyPair) {
      pair = anyPair as any;
      usedPhase = "__any__";
    }
  }

  if (!pair) {
    args.weaponBg.setVisible(false);
    args.weaponFg.setVisible(false);

    if (dbgOn) {
      _logWeaponResolveMissOnce(missKey, {
        weaponId: model,
        heroPhase,
        mode,
        variant: variant ?? "base",
        note: "resolve failed (phase candidates + any-anim fallback all missed)"
      });
    }
    return null;
  }

  const textures = args.scene?.textures as any;
  if (textures && typeof textures.exists === "function") {
    const keys = [
      (pair as any).bg?.key,
      (pair as any).fg?.key
    ].filter(Boolean) as string[];
    const missing = keys.some((key) => !textures.exists(key));
    if (missing) {
      const loadStatus = ensureWeaponSheetsLoaded(args.scene, model, variant);
      if (dbgOn && !loadStatus.ready) {
        const atlasDbg = _atlasDebugFields(args.scene, keys);
        const loaderDbg = _loaderDebugFields(args.scene);
        _logWeaponMissingTexOnce(missKey, {
          weaponId: model,
          heroPhase,
          usedPhase,
          mode,
          variant: variant ?? "base",
          dir: args.dir,
          heroFrameIndex: args.heroFrameIndex,
          missing: keys.filter((k) => !textures.exists(k)),
          keys,
          atlasKeys: atlasDbg.atlasKeys,
          atlasExists: atlasDbg.atlasExists,
          atlasFrames: atlasDbg.atlasFrames,
          atlasImages: atlasDbg.atlasImages,
          loaderLoading: loaderDbg.loaderLoading,
          loaderList: loaderDbg.loaderList,
          loaderInflight: loaderDbg.loaderInflight,
          loaderQueue: loaderDbg.loaderQueue,
          queued: loadStatus.queued,
          total: loadStatus.total
        });
      }
      args.weaponBg.setVisible(false);
      args.weaponFg.setVisible(false);
      return null;
    }
  }

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    if (dbgOn) {
      console.log("[WPN-PLACE-CLAMP]", {
        weaponId: model,
        heroPhase,
        usedPhase,
        x,
        y,
        heroCx,
        heroCy
      });
    }
    x = heroCx;
    y = heroCy;
  }

  if (dbgOn && dbgVerbose) {
    _logWeaponResolveHitOnce(missKey, {
      weaponId: model,
      heroPhase: `${heroPhase}->${usedPhase}`,
      mode,
      variant: variant ?? "base",
      bg: (pair as any).bg?.key ?? null,
      fg: (pair as any).fg?.key ?? null,
      anim: (pair as any).anim ?? null
    });
  }

  if (paletteDbg) {
    const logResolve = (layerRef: WeaponSheetRef | undefined, layerLabel: "bg" | "fg"): void => {
      if (!layerRef) return;
      const grid = getSheetGrid(args.scene, layerRef);
      const cols = Math.max(1, grid.cols | 0);
      const rows = Math.max(1, grid.rows | 0);
      const atlasInfo = getWeaponAtlasFrameForSheet(layerRef.key);
      const atlasKey = atlasInfo?.atlasKey ?? "";
      const atlasImage = atlasInfo?.image ?? "";
      const atlasFrame = atlasInfo?.frame;
      const sample0 = _scanFramePalette(args.scene, layerRef.key, 0, layerRef.frameW | 0, layerRef.frameH | 0);
      const line0 = _buildWeaponPixelLine({
        weaponId: String(model || ""),
        heroPhase: String(heroPhase || ""),
        usedPhase: String(usedPhase || ""),
        variant: String(variant ?? "base"),
        dir: String(args.dir || ""),
        layer: layerLabel,
        sheetKey: layerRef.key,
        frameIndex: 0,
        frameW: layerRef.frameW | 0,
        frameH: layerRef.frameH | 0,
        cols,
        rows,
        row: 0,
        col: 0,
        atlasKey,
        atlasImage,
        atlasFrame,
        palette: sample0.palette,
        error: sample0.error,
        oobInfo: sample0.debug
      });
      _logWeaponPixelResolveOnce(`resolve|${layerRef.key}`, line0);
    };
    logResolve((pair as any).bg, "bg");
    logResolve((pair as any).fg, "fg");
  }

  // Sandwich: bg behind hero, fg in front
  const bgDepth = heroDepth - 1;
  const fgDepth = heroDepth + 1;
  const bg = applyOne(args.weaponBg, (pair as any).bg, bgDepth, "bg");
  const fg = applyOne(args.weaponFg, (pair as any).fg, fgDepth, "fg");

  // Ensure depth ordering is applied immediately so weapons render above/below hero as intended.
  const dlAny: any = args.scene?.sys?.displayList;
  if (dlAny) {
    try {
      if (typeof dlAny.depthSort === "function") dlAny.depthSort();
      else if (typeof dlAny.queueDepthSort === "function") dlAny.queueDepthSort();
      else if (typeof dlAny.sortChildrenFlag === "boolean") dlAny.sortChildrenFlag = true;
    } catch { /* ignore */ }
  }

  if (DEBUG_NPC_PIPELINE && isNpcHeroSprite(args.heroSprite)) {
    const already = heroAny.getData ? heroAny.getData(NPC_WEAPON_LOG_ONCE_KEY) : 0;
    if (!already && (bg || fg)) {
      try { heroAny.setData?.(NPC_WEAPON_LOG_ONCE_KEY, 1); } catch { /* ignore */ }
      const heroName = String(heroAny.getData?.("heroName") || "");
      const heroFamily = String(heroAny.getData?.("heroFamily") || "");
      const npcRole = String(heroAny.getData?.("_npcRole") || "");
      console.log(
        "[NPC-PIPE][weapon.map] " +
        _fmtNpcWeaponMapOneLine({
          heroName,
          heroFamily,
          npcRole,
          weaponId: model,
          heroPhase,
          usedPhase,
          dir: args.dir,
          heroFrameIndex: args.heroFrameIndex,
          bg: bg?.key ?? null,
          fg: fg?.key ?? null
        })
      );
    }
  }

  // ---------------------------------
  // DEBUG: placement log (once per key)
  // ---------------------------------
  if (dbgOn) {
    const safeGet = (spr: any, key: string, defVal: any) => {
      try {
        if (spr && typeof spr.getData === "function") {
          const v = spr.getData(key);
          return (v === undefined || v === null) ? defVal : v;
        }
        const dv = spr?.data?.values?.[key];
        return (dv === undefined || dv === null) ? defVal : dv;
      } catch {
        return defVal;
      }
    };

    dbgHeroName = String(safeGet(args.heroSprite as any, "heroName", "") || "");
    dbgHeroFamily = String(safeGet(args.heroSprite as any, "heroFamily", "") || "");
    const placedKey = `${model}|${dbgHeroName}|${dbgHeroFamily}|${heroPhase}|${usedPhase}|${args.dir}|${variant ?? ""}|${args.frameColOverride ?? -1}`;

    const bgVis = !!(args.weaponBg as any).visible;
    const fgVis = !!(args.weaponFg as any).visible;

    _logWeaponPlacedOnce(placedKey, {
      weaponId: model,
      heroName: dbgHeroName,
      heroFamily: dbgHeroFamily,
      heroPhase,
      usedPhase,
      mode,
      dir: args.dir,
      heroFrameIndex: args.heroFrameIndex,
      frameColOverride: args.frameColOverride ?? -1,
      variant: variant ?? "base",
      x,
      y,
      heroDepth,
      bgDepth,
      fgDepth,
      bgVisible: bgVis,
      fgVisible: fgVis,
      bgKey: bg?.key ?? null,
      bgFrame: bg?.frameIndex ?? null,
      fgKey: fg?.key ?? null,
      fgFrame: fg?.frameIndex ?? null
    });

    if (!bgVis && !fgVis) {
      _logWeaponHiddenOnce(placedKey, {
        note: "resolved pair but both layers ended up invisible (missing refs?)",
        weaponId: model,
        heroPhase,
        usedPhase,
        mode,
        dir: args.dir,
        variant: variant ?? "base",
        x,
        y,
        bgRef: (pair as any).bg?.key ?? null,
        fgRef: (pair as any).fg?.key ?? null
      });
    }
  }

  // ------------------------------------------------------------
  // FINAL DEBUG: “weapon should be obviously here” placement log
  // (uses the SAME computed x/y + wpnOx/wpnOy + WEAPON_OFFSET_BY_DIR)
  // ------------------------------------------------------------
  if (dbgOn) {
    const bgStr = bg ? `${bg.key}#${bg.frameIndex}` : "none";
    const fgStr = fg ? `${fg.key}#${fg.frameIndex}` : "none";

    // Signature: keep it stable and “once per placement signature” unless verbose
    const sig =
      `WPN|wid=${model}|hero=${dbgHeroName}|fam=${dbgHeroFamily}` +
      `|phase=${heroPhase}->${usedPhase}|dir=${args.dir}` +
      `|v=${variant ?? ""}|fco=${args.frameColOverride ?? -1}` +
      `|hfi=${args.heroFrameIndex}|x=${x | 0}|y=${y | 0}|bg=${bgStr}|fg=${fgStr}`;

    _logWeaponPlace(
      dbgVerbose,
      sig,
      `[WPN-PLACE] wid=${model} hero=${dbgHeroName} fam=${dbgHeroFamily} ` +
      `phase=${heroPhase} used=${usedPhase} mode=${mode} dir=${args.dir} heroFrame=${args.heroFrameIndex} ` +
      `heroXY=${((args.heroSprite.x) | 0)},${((args.heroSprite.y) | 0)} heroOrigin=${heroOx.toFixed(2)},${heroOy.toFixed(2)} ` +
      `heroCenter=${(heroCx | 0)},${(heroCy | 0)} ` +
      `wpnOxOy=${(wpnOx | 0)},${(wpnOy | 0)} off=${(off.x | 0)},${(off.y | 0)} ` +
      `WXY=${(x | 0)},${(y | 0)} bg=${bgStr} fg=${fgStr} ` +
      `depthH=${heroDepth} depthBg=${bgDepth} depthFg=${fgDepth}`
    );
  }

  return {
    weaponId: model,
    heroPhase,
    dir: args.dir,
    variant: variant ?? "base",
    mode,
    resolvedAnim: (pair as any).anim,
    resolvedTile: (pair as any).tile,
    x,
    y,
    heroDepth,
    bgDepth,
    fgDepth,
    bg,
    fg
  };
}

// ----------------------------------------------------------
// Sync BG/FG sandwich to hero
// ----------------------------------------------------------

export function syncWeaponToHero(args: {
  scene: Phaser.Scene;
  heroSprite: Phaser.GameObjects.Sprite;
  weaponSprite: Phaser.GameObjects.Sprite;
  weaponId: WeaponId;
  heroPhase: string;
  dir: Dir4;
  heroFrameIndex: number;
  variant?: string;
  // Optional explicit override for "single frame" poses.
  // For our projectile crystal path, we treat this as an *absolute* frame index.
  frameColOverride?: number;
  frameColOverrideMode?: WeaponFrameOverrideMode;
}): void {
  const dbgOn = _weaponDebugEnabled();
  const model = String(args.weaponId || "").trim();
  if (!model) {
    args.weaponSprite.setVisible(false);
    return;
  }

  const mode: WeaponMode = weaponModeForHeroPhase(args.heroPhase);
  const tile = tileForWeaponMode(mode);
  const missKey = `${args.weaponId}|${args.heroPhase}|${mode}|${args.variant ?? ""}|single`;

  const sheet = resolveWeaponSheet({
    weaponId: args.weaponId,
    mode,
    heroPhase: args.heroPhase,
    variant: args.variant
  });

  if (!sheet) {
    args.weaponSprite.setVisible(false);
    return;
  }

  const textures = args.scene?.textures as any;
  if (textures && typeof textures.exists === "function" && !textures.exists(sheet.key)) {
    if (dbgOn) {
      const atlasDbg = _atlasDebugFields(args.scene, [sheet.key]);
      const loaderDbg = _loaderDebugFields(args.scene);
      _logWeaponMissingTexOnce(missKey, {
        weaponId: args.weaponId,
        heroPhase: args.heroPhase,
        usedPhase: args.heroPhase,
        mode,
        variant: args.variant ?? "base",
        dir: args.dir,
        heroFrameIndex: args.heroFrameIndex,
        missing: [sheet.key],
        keys: [sheet.key],
        atlasKeys: atlasDbg.atlasKeys,
        atlasExists: atlasDbg.atlasExists,
        atlasFrames: atlasDbg.atlasFrames,
        atlasImages: atlasDbg.atlasImages,
        loaderLoading: loaderDbg.loaderLoading,
        loaderList: loaderDbg.loaderList,
        loaderInflight: loaderDbg.loaderInflight,
        loaderQueue: loaderDbg.loaderQueue
      });
    }
    ensureWeaponSheetsLoaded(args.scene, model, args.variant);
    args.weaponSprite.setVisible(false);
    return;
  }

  // Defensive: if someone passes a WeaponSheetRef with mismatched tile, fix frameW/H.
  const fixedSheet: WeaponSheetRef = {
    key: sheet.key,
    frameW: tile,
    frameH: tile,
    totalFrames: sheet.totalFrames
  };

  if (args.weaponSprite.texture?.key !== fixedSheet.key) args.weaponSprite.setTexture(fixedSheet.key);

  // --------------------------------------------------
  // Dedicated single-frame override support:
  // If frameColOverride is provided, mode controls how we interpret it.
  // This avoids resolver math producing out-of-range frames (e.g., 48).
  // --------------------------------------------------
  let frameIndex: number;
  if (args.frameColOverride !== undefined && args.frameColOverride !== null) {
    const mode = args.frameColOverrideMode ?? "absFrame";
    if (mode === "absFrame") {
      frameIndex = (args.frameColOverride as any) | 0; // absolute frame index (0 = first frame)
    } else {
      frameIndex = resolveWeaponFrameIndexForLayer({
        scene: args.scene,
        sheet: fixedSheet,
        dir: args.dir,
        heroSprite: args.heroSprite,
        heroFrameIndex: args.heroFrameIndex,
        frameColOverride: args.frameColOverride,
        frameColOverrideMode: mode
      }) as any;
      frameIndex = (frameIndex as any) | 0;
    }
  } else {
    frameIndex = resolveWeaponFrameIndexForLayer({
      scene: args.scene,
      sheet: fixedSheet,
      dir: args.dir,
      heroSprite: args.heroSprite,
      heroFrameIndex: args.heroFrameIndex,
      frameColOverride: undefined
    }) as any;
    frameIndex = (frameIndex as any) | 0;
  }

  // Clamp to texture frame count if available (spritesheet safety)
  const tex: any = (args.weaponSprite.texture as any);
  const total = (tex && typeof tex.frameTotal === "number") ? (tex.frameTotal | 0) : -1;
  if (total > 0) {
    if (frameIndex < 0 || frameIndex >= total) {
      // For projectile/static poses, safest fallback is frame 0.
      frameIndex = 0;
    }
  }

  args.weaponSprite.setFrame(frameIndex);

  const off = WEAPON_OFFSET_BY_DIR[args.dir] ?? { x: 0, y: 0 };

  // Weapon overlay art assumes heroSprite.x/y are CENTER-anchored.
  // If heroSprite is feet-anchored (originY=1), convert back to visual center.
  const heroAny: any = args.heroSprite as any;
  const heroOx = (typeof heroAny.originX === "number") ? heroAny.originX : 0.5;
  const heroOy = (typeof heroAny.originY === "number") ? heroAny.originY : 0.5;
  const heroW = ((typeof heroAny.displayWidth === "number" && heroAny.displayWidth > 0)
    ? heroAny.displayWidth
    : (typeof heroAny.width === "number" ? heroAny.width : 0)) as number;
  const heroH = ((typeof heroAny.displayHeight === "number" && heroAny.displayHeight > 0)
    ? heroAny.displayHeight
    : (typeof heroAny.height === "number" ? heroAny.height : 0)) as number;

  const heroCenterX = args.heroSprite.x + (0.5 - heroOx) * (heroW || 0);
  const heroCenterY = args.heroSprite.y + (0.5 - heroOy) * (heroH || 0);

  args.weaponSprite.x = heroCenterX + off.x;
  args.weaponSprite.y = heroCenterY + off.y;

  // Match legacy behavior (weapon sprite center-anchored).
  try { (args.weaponSprite as any).setOrigin?.(0.5, 0.5); } catch { /* ignore */ }

  const heroDepth = (args.heroSprite as any).depth ?? 0;
  args.weaponSprite.setDepth(heroDepth + 1);
  args.weaponSprite.setVisible(true);
}


// ----------------------------------------------------------
// Back-compat: single-layer sync (FG preferred)
// ----------------------------------------------------------


// ----------------------------------------------------------
// Ghost trails (simple: show pending-add amount, uses one layer sprite)
// ----------------------------------------------------------

export function applyWeaponGhostTrails(args: {
  weaponSprite: Phaser.GameObjects.Sprite;
  ghosts: Phaser.GameObjects.Sprite[];
  phase01: number; // 0..1
  maxGhostsVisible: number;
}): { ghostCount: number } {
  const maxGhosts = Math.max(0, args.ghosts.length | 0);
  const wantMax = clampInt(args.maxGhostsVisible | 0, 0, maxGhosts);

  const t = Math.max(0, Math.min(1, Number(args.phase01) || 0));
  const ghostCount = clampInt(Math.round(t * wantMax), 0, wantMax);

  const weaponVisible = !!args.weaponSprite.visible;
  const weaponKey = args.weaponSprite.texture?.key ? String(args.weaponSprite.texture.key) : "";
  if (!weaponVisible || !weaponKey || weaponKey === "__MISSING") {
    for (const g of args.ghosts) g.setVisible(false);
    return { ghostCount: 0 };
  }

  const f0 = ((args.weaponSprite as any).frame?.name ?? (args.weaponSprite as any).frame?.index ?? 0) as any;

  for (let i = 0; i < args.ghosts.length; i++) {
    const g = args.ghosts[i];
    if (i < ghostCount) {
      g.setTexture(weaponKey);
      g.setFrame(f0);

      g.x = args.weaponSprite.x;
      g.y = args.weaponSprite.y;

      g.scaleX = (args.weaponSprite as any).scaleX ?? 1;
      g.scaleY = (args.weaponSprite as any).scaleY ?? 1;
      (g as any).rotation = (args.weaponSprite as any).rotation ?? 0;
      if (typeof (g as any).setFlipX === "function") (g as any).setFlipX(!!(args.weaponSprite as any).flipX);
      if (typeof (g as any).setFlipY === "function") (g as any).setFlipY(!!(args.weaponSprite as any).flipY);

      const wDepth = (args.weaponSprite as any).depth ?? 0;
      g.setDepth(wDepth - 1);

      const a = 0.35 * (1 - i / Math.max(1, ghostCount));
      g.setAlpha(a);
      g.setVisible(true);
    } else {
      g.setVisible(false);
    }
  }

  return { ghostCount };
}



export function setWeaponGhostCountExact(args: {
  weaponBg: Phaser.GameObjects.Sprite;
  weaponFg: Phaser.GameObjects.Sprite;
  ghostsBg: Phaser.GameObjects.Sprite[];
  ghostsFg: Phaser.GameObjects.Sprite[];
  ghostCount: number;
  dir: "up" | "down" | "left" | "right";
  spacingPx?: number;
}): void {
  const maxPairs = Math.min(args.ghostsBg.length | 0, args.ghostsFg.length | 0);
  let want = args.ghostCount | 0;
  if (want < 0) want = 0;
  if (want > maxPairs) want = maxPairs;

  const spacing = (args.spacingPx == null ? 10 : (args.spacingPx | 0));
  const dir = args.dir;

  let dx = 0, dy = 0;
  if (dir === "right") dx = 1;
  else if (dir === "left") dx = -1;
  else if (dir === "down") dy = 1;
  else dy = -1;

  // ---- VISIBILITY / “SHINY” KNOBS ----
  const BG_ALPHA_NEAR = 0.85;
  const BG_ALPHA_FAR  = 0.55;
  const FG_ALPHA_NEAR = 0.95;
  const FG_ALPHA_FAR  = 0.65;
  // -----------------------------------

  const bgVisible = !!args.weaponBg.visible;
  const fgVisible = !!args.weaponFg.visible;

  const bgKey = args.weaponBg.texture?.key ? String(args.weaponBg.texture.key) : "";
  const fgKey = args.weaponFg.texture?.key ? String(args.weaponFg.texture.key) : "";

  const bgOk = bgVisible && bgKey && bgKey !== "__MISSING";
  const fgOk = fgVisible && fgKey && fgKey !== "__MISSING";

  const bgFrame = ((args.weaponBg as any).frame?.name ?? (args.weaponBg as any).frame?.index ?? 0) as any;
  const fgFrame = ((args.weaponFg as any).frame?.name ?? (args.weaponFg as any).frame?.index ?? 0) as any;

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  // BG ghosts
  for (let i = 0; i < args.ghostsBg.length; i++) {
    const g = args.ghostsBg[i];
    if (i < want && bgOk) {
      g.setTexture(bgKey);
      g.setFrame(bgFrame);

      const step = (i + 1) * spacing;
      g.x = args.weaponBg.x + dx * step;
      g.y = args.weaponBg.y + dy * step;

      g.scaleX = (args.weaponBg as any).scaleX ?? 1;
      g.scaleY = (args.weaponBg as any).scaleY ?? 1;
      (g as any).rotation = (args.weaponBg as any).rotation ?? 0;
      if (typeof (g as any).setFlipX === "function") (g as any).setFlipX(!!(args.weaponBg as any).flipX);
      if (typeof (g as any).setFlipY === "function") (g as any).setFlipY(!!(args.weaponBg as any).flipY);

      const d = (args.weaponBg as any).depth ?? 0;
      g.setDepth(d - 1);

      // bright + shiny
      try { (g as any).setBlendMode?.(Phaser.BlendModes.ADD); } catch { }
      const t = (want <= 1) ? 0 : (i / Math.max(1, want - 1));
      g.setAlpha(lerp(BG_ALPHA_NEAR, BG_ALPHA_FAR, t));

      g.setVisible(true);
    } else {
      g.setVisible(false);
    }
  }

  // FG ghosts
  for (let i = 0; i < args.ghostsFg.length; i++) {
    const g = args.ghostsFg[i];
    if (i < want && fgOk) {
      g.setTexture(fgKey);
      g.setFrame(fgFrame);

      const step = (i + 1) * spacing;
      g.x = args.weaponFg.x + dx * step;
      g.y = args.weaponFg.y + dy * step;

      g.scaleX = (args.weaponFg as any).scaleX ?? 1;
      g.scaleY = (args.weaponFg as any).scaleY ?? 1;
      (g as any).rotation = (args.weaponFg as any).rotation ?? 0;
      if (typeof (g as any).setFlipX === "function") (g as any).setFlipX(!!(args.weaponFg as any).flipX);
      if (typeof (g as any).setFlipY === "function") (g as any).setFlipY(!!(args.weaponFg as any).flipY);

      const d = (args.weaponFg as any).depth ?? 0;
      g.setDepth(d - 1);

      // brighter than BG
      try { (g as any).setBlendMode?.(Phaser.BlendModes.ADD); } catch { }
      const t = (want <= 1) ? 0 : (i / Math.max(1, want - 1));
      g.setAlpha(lerp(FG_ALPHA_NEAR, FG_ALPHA_FAR, t));

      g.setVisible(true);
    } else {
      g.setVisible(false);
    }
  }
}



// ----------------------------------------------------------
// Global export hook (lets arcadeCompat find glue via globalThis)
// ----------------------------------------------------------

const WEAPON_ANIM_GLUE_GLOBAL_KEY = "weaponAnimGlue";



export function exportWeaponAnimGlueToGlobalOnce(): void {
  try {
    const g: any = globalThis as any;

    // If someone already provided one, don't overwrite.
    if (g[WEAPON_ANIM_GLUE_GLOBAL_KEY]) return;

    g[WEAPON_ANIM_GLUE_GLOBAL_KEY] = {
      // factory
      createWeaponOverlaySprites,

      // primary sandwich driver
      syncWeaponLayersToHero,

      // legacy single-layer driver
      syncWeaponToHero,

      // ghost helpers (YOU NEED THESE)
      applyWeaponGhostTrails,
      setWeaponGhostCountExact,

      // useful helpers
      resolveWeaponFrameIndexForLayer,
      resolveWeaponFrameIndexForDirAndCol
    };
  } catch {
    // ignore
  }
}

// Auto-export on module load (safe no-op if globalThis is unavailable)
exportWeaponAnimGlueToGlobalOnce();
