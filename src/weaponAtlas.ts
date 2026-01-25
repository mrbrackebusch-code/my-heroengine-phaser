// src/weaponAtlas.ts
// Weapon pack discovery + loader + resolver for Phaser.
//
// Source of truth: filenames (no JSON).
//
// Expected asset layout (under src/):
//   ../assets/weapons/t064/<category>/*.png
//   ../assets/weapons/t128/<category>/*.png
//   ../assets/weapons/t192/<category>/*.png
//
// Filename format (base name, without .png):
//   t{TILE}__{CATEGORY}__{MODEL}__{ANIM}__{LAYER}__v{VARIANT}
// Example:
//   t192__polearm__dragon_spear__walk__fg__vbase



import type Phaser from "phaser";
import {
  WEAPON_DEBUG,
  WEAPON_DEBUG_VERBOSE,
  DEBUG_WPN_USE_ORIGINALS_SUBDIR,
  DEBUG_WPN_FORCE_ORIGINALS_BY_FAMILY,
  DEBUG_WPN_COMPARE_ORIGINALS_RUNTIME
} from "./debugFlags";
import { queueAtlasOnce, queueSpritesheetOnce } from "./loaderCache";
import { WEAPON_ATLAS_SHEETS, WEAPON_ATLAS_DATA } from "./generated/weaponAtlasMeta";

// ----------------------------------------------------------
// Legacy-exported types (kept so other code can keep importing)
// ----------------------------------------------------------

export type WeaponId = string; // == MODEL
export type WeaponKind = "swing" | "thrust";
export type WeaponMode = "normal" | "mid" | "oversize";
export type Dir4 = "up" | "down" | "left" | "right";


// ----------------------------------------------------------
// Default hero phases to audit for weapon coverage.
// We include multiple spellings so you can see what's missing
// regardless of whether your engine emits camelCase or snake_case.
// ----------------------------------------------------------
const DEFAULT_HERO_PHASES_FOR_WEAPON_AUDIT: string[] = [
  // common baseline phases
  "idle",
  "run",
  "combatIdle",

  // core combat phases
  "slash",
  "thrust",
  "cast",

  // one-hand specials (camelCase)
  "oneHandSlash",
  "oneHandBackslash",
  "oneHandHalfslash",

  // one-hand specials (snake_case variants)
  "one_hand_slash",
  "one_hand_backslash",
  "one_hand_halfslash",

  // oversize legacy spellings (if they still exist anywhere)
  "slashOversize",
  "thrustOversize",
  "slash_oversize",
  "thrust_oversize",
];


export interface WeaponSheetRef {
  key: string; // Phaser texture key (and PNG base filename)
  frameW: number;
  frameH: number;
  totalFrames?: number; // optional hint; usually omitted because we can derive from texture
  cols?: number;
  rows?: number;
}

// ----------------------------------------------------------
// Weapon-pack-specific types
// ----------------------------------------------------------

export type WeaponTile = 64 | 128 | 192;
export type WeaponLayer = "bg" | "fg";

export interface WeaponPngMeta {
  key: string;          // base filename (no .png) – used as Phaser texture key
  tile: WeaponTile;     // 64 / 128 / 192
  category: string;
  model: string;        // weaponId
  anim: string;         // one anim per file
  layer: WeaponLayer;   // bg / fg
  variant: string;      // e.g. base, gold, steel
  atlasKey: string;     // atlas texture key (model+anim)
  frameW: number;
  frameH: number;
  totalFrames: number;
  cols: number;
  rows: number;
}

export interface WeaponLayerPair {
  tile: WeaponTile;
  model: string;
  variant: string;
  anim: string;
  bg?: WeaponSheetRef;
  fg?: WeaponSheetRef;
}

// ----------------------------------------------------------
// Weapon atlas discovery (eager URL map)
// ----------------------------------------------------------

const WEAPON_ATLAS_DIR = "../assets/weapons/_atlas";
const WEAPON_ATLAS_ORIGINALS_SUBDIR = "../assets/weapons/_atlas/originals to use";
const WEAPON_ORIGINAL_REF_SUFFIX = "__origref";
const WEAPON_ATLAS_BUST_TOKEN = WEAPON_DEBUG ? Date.now().toString(36) : "";

const weaponAtlasPngs = import.meta.glob("../assets/weapons/_atlas/**/*.png", {
  as: "url",
  eager: true
}) as Record<string, string>;

function _weaponAtlasUrl(atlasKey: string): string {
  const relBase = `${WEAPON_ATLAS_DIR}/${atlasKey}.png`;
  const relOrig = `${WEAPON_ATLAS_ORIGINALS_SUBDIR}/${atlasKey}.png`;
  return weaponAtlasPngs[relBase] || weaponAtlasPngs[relOrig] || "";
}

function _weaponOriginalSheetUrl(sheetKey: string): string {
  const relOrig = `${WEAPON_ATLAS_ORIGINALS_SUBDIR}/${sheetKey}.png`;
  return weaponAtlasPngs[relOrig] || "";
}

export function getWeaponOriginalRefKey(sheetKey: string): string {
  const key = String(sheetKey || "").trim();
  return key ? (key + WEAPON_ORIGINAL_REF_SUFFIX) : "";
}

function _cacheBustUrl(url: string, token: string): string {
  if (!url) return url;
  const sep = url.includes("?") ? "&" : "?";
  return url + sep + "v=" + token;
}

// ----------------------------------------------------------
// Build an in-memory index at module load time
// ----------------------------------------------------------

const ALL_WEAPON_SHEETS: WeaponPngMeta[] = WEAPON_ATLAS_SHEETS.map((meta: any) => ({
  key: String(meta.key || ""),
  atlasKey: String(meta.atlasKey || ""),
  tile: meta.tile as WeaponTile,
  category: String(meta.category || ""),
  model: String(meta.model || ""),
  anim: String(meta.anim || ""),
  layer: meta.layer as WeaponLayer,
  variant: String(meta.variant || ""),
  frameW: meta.frameW | 0,
  frameH: meta.frameH | 0,
  totalFrames: meta.totalFrames | 0,
  cols: meta.cols | 0,
  rows: meta.rows | 0
}));

const SHEET_META_BY_KEY = new Map<string, WeaponPngMeta>();
const SHEETS_BY_ATLAS = new Map<string, WeaponPngMeta[]>();
for (const meta of ALL_WEAPON_SHEETS) {
  if (!meta.key) continue;
  SHEET_META_BY_KEY.set(meta.key, meta);
  if (meta.atlasKey) {
    const list = SHEETS_BY_ATLAS.get(meta.atlasKey) ?? [];
    list.push(meta);
    SHEETS_BY_ATLAS.set(meta.atlasKey, list);
  }
}

export function getWeaponSheetMeta(sheetKey: string): WeaponPngMeta | null {
  const key = String(sheetKey || "");
  return SHEET_META_BY_KEY.get(key) ?? null;
}

export function getWeaponAtlasFrameForSheet(sheetKey: string): {
  atlasKey: string;
  image: string;
  frame: { x: number; y: number; w: number; h: number };
} | null {
  const meta = getWeaponSheetMeta(sheetKey);
  if (!meta || !meta.atlasKey) return null;
  const atlas: any = (WEAPON_ATLAS_DATA as Record<string, unknown>)[meta.atlasKey] as any;
  const frame = atlas?.frames?.[meta.key]?.frame;
  if (!frame) return null;
  return {
    atlasKey: meta.atlasKey,
    image: String(atlas?.meta?.image ?? ""),
    frame: {
      x: frame.x | 0,
      y: frame.y | 0,
      w: frame.w | 0,
      h: frame.h | 0
    }
  };
}

// model -> variant -> tile -> anim -> pair
type PairLeaf = { bg?: WeaponPngMeta; fg?: WeaponPngMeta };

function _isDupSheetKey(key: string): boolean {
  return /__dup\d+$/i.test(String(key || ""));
}
const INDEX = new Map<string, Map<string, Map<WeaponTile, Map<string, PairLeaf>>>>();

// Composite weapon models: allow bg/fg to come from different source models.
const WEAPON_MODEL_COMPOSITES: Record<string, { bg?: string; fg?: string }> = {
  // Skeleton archer: quiver on back (bg) + bow in hand (fg).
  skeleton_bow: { bg: "quiver", fg: "bow_normal" }
};

for (const meta of ALL_WEAPON_SHEETS) {
  let byVariant = INDEX.get(meta.model);
  if (!byVariant) INDEX.set(meta.model, (byVariant = new Map()));

  let byTile = byVariant.get(meta.variant);
  if (!byTile) byVariant.set(meta.variant, (byTile = new Map()));

  let byAnim = byTile.get(meta.tile);
  if (!byAnim) byTile.set(meta.tile, (byAnim = new Map()));

  const animKey = normalizeAnimToken(meta.anim);
  let leaf = byAnim.get(animKey);
  if (!leaf) byAnim.set(animKey, (leaf = {}));

  const isDup = _isDupSheetKey(meta.key);
  if (meta.layer === "bg") {
    if (!leaf.bg) {
      leaf.bg = meta;
    } else {
      const existingDup = _isDupSheetKey(leaf.bg.key);
      if (existingDup && !isDup) leaf.bg = meta;
      // If existing is non-dup, keep it (ignore dup).
    }
  } else {
    if (!leaf.fg) {
      leaf.fg = meta;
    } else {
      const existingDup = _isDupSheetKey(leaf.fg.key);
      if (existingDup && !isDup) leaf.fg = meta;
      // If existing is non-dup, keep it (ignore dup).
    }
  }
}

export function listAllWeaponSheets(): WeaponPngMeta[] {
  return ALL_WEAPON_SHEETS.slice();
}

export function listWeaponModels(): string[] {
  return Array.from(INDEX.keys()).sort();
}

export function listWeaponVariants(model: string): string[] {
  const v = INDEX.get(model);
  if (!v) return [];
  return Array.from(v.keys()).sort();
}

// ----------------------------------------------------------
// Load / cache helpers
// ----------------------------------------------------------

const WEAPON_SHEETS_BY_MODEL_VARIANT = new Map<string, WeaponPngMeta[]>();

const _WEAPON_ATLAS_RESOLVE_ONCE = new Set<string>();
const _WEAPON_ATLAS_LOAD_ONCE = new Set<string>();
const _WEAPON_ATLAS_SHEET_ONCE = new Set<string>();
const _WEAPON_ATLAS_SHEET_FAIL_ONCE = new Set<string>();
const _WEAPON_ATLAS_RELOAD_ONCE = new Set<string>();
const _WEAPON_ATLAS_LOADER_HOOKED = new WeakSet<Phaser.Scene>();

function _scenePendingAtlases(scene: Phaser.Scene): Set<string> {
  const anyScene = scene as any;
  let set: Set<string> = anyScene.__wpnPendingAtlases;
  if (!set) {
    set = new Set<string>();
    anyScene.__wpnPendingAtlases = set;
  }
  return set;
}

function _hookWeaponAtlasLoaderDebug(scene: Phaser.Scene): void {
  if (!_weaponDebugEnabled()) return;
  const loader: any = scene?.load;
  if (!loader) return;
  if (_WEAPON_ATLAS_LOADER_HOOKED.has(scene)) return;
  _WEAPON_ATLAS_LOADER_HOOKED.add(scene);

  loader.on("filecomplete", (key: string, type: string) => {
    try {
      const pending = _scenePendingAtlases(scene);
      if (!pending.has(key)) return;
      pending.delete(key);
      const textures: any = scene.textures as any;
      const hasAtlas = textures && typeof textures.exists === "function" ? textures.exists(key) : false;
      let sizeStr = "";
      const atlasData = (WEAPON_ATLAS_DATA as Record<string, unknown>)[key];
      const actual = hasAtlas ? _atlasActualSize(scene, key) : null;
      const expected = atlasData ? _atlasExpectedSize(atlasData) : null;
      if (actual && expected) {
        sizeStr =
          " actual=" + actual.w + "x" + actual.h +
          " expected=" + expected.w + "x" + expected.h;
      } else if (actual) {
        sizeStr = " actual=" + actual.w + "x" + actual.h;
      }
      const line =
        "atlasKey=" + key +
        " type=" + String(type || "") +
        " hasAtlas=" + (hasAtlas ? 1 : 0) +
        sizeStr +
        " pending=" + pending.size;
      console.log("[WPN-ATLAS-FILE] " + line);
    } catch {
      // ignore loader debug failures
    }
  });

  loader.on("complete", () => {
    try {
      const pending = _scenePendingAtlases(scene);
      const line = "pending=" + pending.size;
      console.log("[WPN-ATLAS-LOADER] " + line);
    } catch {
      // ignore loader debug failures
    }
  });
}

function _atlasExpectedSize(atlasData: any): { w: number; h: number } | null {
  const w = (atlasData?.meta?.size?.w ?? 0) | 0;
  const h = (atlasData?.meta?.size?.h ?? 0) | 0;
  if (w > 0 && h > 0) return { w, h };
  return null;
}

function _atlasActualSize(scene: Phaser.Scene, atlasKey: string): { w: number; h: number; src?: string } | null {
  try {
    const tex: any = scene?.textures?.get?.(atlasKey);
    if (!tex) return null;
    const src: any = tex.getSourceImage?.() ?? tex?.source?.[0]?.image ?? null;
    const w = (src?.width ?? 0) | 0;
    const h = (src?.height ?? 0) | 0;
    if (w <= 0 || h <= 0) return null;
    const srcUrl = typeof src?.src === "string" ? src.src : "";
    return { w, h, src: srcUrl };
  } catch {
    return null;
  }
}

function _logWeaponAtlasReloadOnce(sig: string, payload: any): void {
  if (!_weaponDebugEnabled()) return;
  if (_WEAPON_ATLAS_RELOAD_ONCE.has(sig)) return;
  _WEAPON_ATLAS_RELOAD_ONCE.add(sig);
  console.log("[WPN-ATLAS-RELOAD] " + payload);
}

function _reloadAtlasIfSizeMismatch(scene: Phaser.Scene, atlasKey: string, atlasData: any): boolean {
  try {
    const textures: any = scene?.textures;
    if (!textures || typeof textures.exists !== "function") return false;
    if (!textures.exists(atlasKey)) return false;
    const expected = _atlasExpectedSize(atlasData);
    if (!expected) return false;
    const actual = _atlasActualSize(scene, atlasKey);
    if (!actual) return false;
    if (actual.w === expected.w && actual.h === expected.h) return false;

    const msg =
      "atlasKey=" + atlasKey +
      " expected=" + expected.w + "x" + expected.h +
      " actual=" + actual.w + "x" + actual.h +
      (actual.src ? (" src=" + actual.src) : "");
    _logWeaponAtlasReloadOnce(atlasKey, msg);

    try { textures.remove(atlasKey); } catch { /* ignore */ }
    const metas = SHEETS_BY_ATLAS.get(atlasKey) ?? [];
    for (const meta of metas) {
      if (!meta?.key) continue;
      try { if (textures.exists(meta.key)) textures.remove(meta.key); } catch { /* ignore */ }
    }
    return true;
  } catch {
    return false;
  }
}

function _weaponDebugEnabled(): boolean {
  if (WEAPON_DEBUG) return true;
  try {
    return !!(globalThis as any).WEAPON_DEBUG;
  } catch { }
  return false;
}

function _weaponDebugVerbose(): boolean {
  if (WEAPON_DEBUG_VERBOSE) return true;
  try {
    return !!(globalThis as any).WEAPON_DEBUG_VERBOSE;
  } catch { }
  return false;
}

function _logWeaponAtlasResolveOnce(sig: string, payload: any): void {
  if (!_weaponDebugEnabled()) return;
  if (_WEAPON_ATLAS_RESOLVE_ONCE.has(sig)) return;
  _WEAPON_ATLAS_RESOLVE_ONCE.add(sig);
  console.log("[WPN-ATLAS-RESOLVE] " + _fmtWeaponAtlasResolveOneLine(payload));
}

function _logWeaponAtlasLoadOnce(sig: string, payload: any): void {
  if (!_weaponDebugEnabled()) return;
  if (_WEAPON_ATLAS_LOAD_ONCE.has(sig)) return;
  _WEAPON_ATLAS_LOAD_ONCE.add(sig);
  console.log("[WPN-ATLAS-LOAD]", payload);
}

function _logWeaponAtlasSheetOnce(sig: string, payload: any): void {
  if (!_weaponDebugVerbose()) return;
  if (_WEAPON_ATLAS_SHEET_ONCE.has(sig)) return;
  _WEAPON_ATLAS_SHEET_ONCE.add(sig);
  console.log("[WPN-ATLAS-SHEET]", payload);
}

function _logWeaponAtlasSheetFailOnce(sig: string, payload: any): void {
  if (!_weaponDebugEnabled()) return;
  if (_WEAPON_ATLAS_SHEET_FAIL_ONCE.has(sig)) return;
  _WEAPON_ATLAS_SHEET_FAIL_ONCE.add(sig);
  console.warn("[WPN-ATLAS-SHEET-FAIL]", payload);
}

function _fmtWeaponAtlasResolveOneLine(payload: any): string {
  const model = payload?.model ?? "";
  const heroPhase = payload?.heroPhase ?? "";
  const variant = payload?.variant ?? "";
  const anim = payload?.anim ?? "";
  const tile = payload?.tile ?? "";
  const bg = payload?.bg ?? "";
  const bgAtlas = payload?.bgAtlas ?? "";
  const fg = payload?.fg ?? "";
  const fgAtlas = payload?.fgAtlas ?? "";

  // Keep this stable + grep-friendly
  return (
    "model=" + model +
    " heroPhase=" + heroPhase +
    " variant=" + variant +
    " anim=" + anim +
    " tile=" + tile +
    " bg=" + bg +
    " bgAtlas=" + bgAtlas +
    " fg=" + fg +
    " fgAtlas=" + fgAtlas
  );
}

function _weaponSheetsCacheKey(model: string, variant?: string): string {
  return `${String(model || "").trim()}::${String(variant || "").trim()}`;
}

function _pickVariantForModel(model: string, desiredVariant?: string): string | null {
  const byVariant = INDEX.get(model);
  if (!byVariant) return null;
  const order = [String(desiredVariant || "").trim(), "base", ...Array.from(byVariant.keys())];
  const tried = new Set<string>();
  for (const v of order) {
    const vv = String(v || "").trim();
    if (!vv || tried.has(vv)) continue;
    tried.add(vv);
    if (byVariant.has(vv)) return vv;
  }
  return null;
}

function _listSheetsForModelVariant(model: string, variant?: string): WeaponPngMeta[] {
  const cacheKey = _weaponSheetsCacheKey(model, variant);
  const cached = WEAPON_SHEETS_BY_MODEL_VARIANT.get(cacheKey);
  if (cached) return cached.slice();

  const byVariant = INDEX.get(model);
  if (!byVariant) {
    WEAPON_SHEETS_BY_MODEL_VARIANT.set(cacheKey, []);
    return [];
  }
  const picked = _pickVariantForModel(model, variant);
  if (!picked) {
    WEAPON_SHEETS_BY_MODEL_VARIANT.set(cacheKey, []);
    return [];
  }
  const byTile = byVariant.get(picked);
  if (!byTile) {
    WEAPON_SHEETS_BY_MODEL_VARIANT.set(cacheKey, []);
    return [];
  }

  const out = new Map<string, WeaponPngMeta>();
  for (const byAnim of byTile.values()) {
    for (const leaf of byAnim.values()) {
      if (leaf.bg) out.set(leaf.bg.key, leaf.bg);
      if (leaf.fg) out.set(leaf.fg.key, leaf.fg);
    }
  }

  const list = Array.from(out.values());
  WEAPON_SHEETS_BY_MODEL_VARIANT.set(cacheKey, list);
  return list.slice();
}

export function listWeaponSheetsForModel(weaponId: WeaponId, variant?: string): WeaponPngMeta[] {
  const model = String(weaponId || "").trim();
  if (!model) return [];

  const composite = WEAPON_MODEL_COMPOSITES[model];
  if (composite) {
    const merged = new Map<string, WeaponPngMeta>();
    if (composite.bg) {
      for (const meta of _listSheetsForModelVariant(composite.bg, variant)) {
        merged.set(meta.key, meta);
      }
    }
    if (composite.fg) {
      for (const meta of _listSheetsForModelVariant(composite.fg, variant)) {
        merged.set(meta.key, meta);
      }
    }
    return Array.from(merged.values());
  }

  return _listSheetsForModelVariant(model, variant);
}

// No lazy queuing here; this only registers sheet keys from already-preloaded atlases.
export function ensureWeaponSheetsLoaded(
  scene: Phaser.Scene,
  weaponId: WeaponId,
  variant?: string
): { ready: boolean; queued: number; total: number } {
  const model = String(weaponId || "").trim();
  if (!model || !scene) return { ready: false, queued: 0, total: 0 };

  const metas = listWeaponSheetsForModel(model, variant);
  if (!metas.length) return { ready: false, queued: 0, total: 0 };

  const textures = scene.textures;
  _hookWeaponAtlasLoaderDebug(scene);
  const pendingAtlases = _scenePendingAtlases(scene);
  let loaded = 0;
  let queuedAtlases = 0;
  let needsLoaderStart = false;
  const dbg = _weaponDebugEnabled();
  const dbgVerbose = _weaponDebugVerbose();
  const originalsMode = DEBUG_WPN_USE_ORIGINALS_SUBDIR || DEBUG_WPN_FORCE_ORIGINALS_BY_FAMILY;
  const originalsRefMode = DEBUG_WPN_COMPARE_ORIGINALS_RUNTIME && !originalsMode;
  const checkedAtlas = new Set<string>();

  for (const meta of metas) {
    const key = meta.key;
    if (textures && typeof textures.exists === "function" && textures.exists(key)) {
      loaded++;
      continue;
    }

    if (originalsRefMode) {
      const origRefKey = getWeaponOriginalRefKey(key);
      if (origRefKey && !textures.exists(origRefKey)) {
        const origUrl = _weaponOriginalSheetUrl(key);
        if (origUrl) {
          const queuedOrig = queueSpritesheetOnce(scene, origRefKey, origUrl, meta.frameW, meta.frameH);
          if (queuedOrig) {
            needsLoaderStart = true;
            queuedAtlases++;
          }
        }
      }
    }

    const atlasKey = meta.atlasKey;
    if (atlasKey) {
      if (!checkedAtlas.has(atlasKey)) {
        checkedAtlas.add(atlasKey);
        const atlasData = (WEAPON_ATLAS_DATA as Record<string, unknown>)[atlasKey];
        const reloaded = _reloadAtlasIfSizeMismatch(scene, atlasKey, atlasData);
        if (reloaded || !textures.exists(atlasKey)) {
          const atlasUrlBase = _weaponAtlasUrl(atlasKey);
          const bustToken = reloaded ? Date.now().toString(36) : WEAPON_ATLAS_BUST_TOKEN;
          const atlasUrl = bustToken ? _cacheBustUrl(atlasUrlBase, bustToken) : atlasUrlBase;
          const queued = queueAtlasOnce(scene, atlasKey, atlasUrl, atlasData);
          if (queued) {
            needsLoaderStart = true;
            queuedAtlases++;
            pendingAtlases.add(atlasKey);
          }
          if (dbg && (reloaded || queued)) {
            const line =
              "atlasKey=" + atlasKey +
              " reloaded=" + (reloaded ? 1 : 0) +
              " queued=" + (queued ? 1 : 0) +
              " hasUrl=" + (atlasUrl ? 1 : 0) +
              " bust=" + (bustToken ? 1 : 0);
            _logWeaponAtlasLoadOnce(`atlas-requeue:${atlasKey}`, line);
          }
        }
      }
      if (dbg && dbgVerbose) {
        _logWeaponAtlasLoadOnce(
          `atlas:${atlasKey}`,
          { atlasKey, sheetKey: key, tile: meta.tile, layer: meta.layer, variant: meta.variant }
        );
      }
      if (dbg && !textures.exists(atlasKey)) {
        _logWeaponAtlasLoadOnce(
          `atlas-missing-in-textures:${atlasKey}`,
          { atlasKey, sheetKey: key }
        );
      }
      if (textures.exists(atlasKey)) {
        let created = false;
        if (!textures.exists(key)) {
          try {
            textures.addSpriteSheetFromAtlas(key, {
              atlas: atlasKey,
              frame: key,
              frameWidth: meta.frameW,
              frameHeight: meta.frameH
            });
            created = true;
          } catch (err) {
            if (dbg) {
              _logWeaponAtlasSheetFailOnce(`sheet:${key}`, {
                sheetKey: key,
                atlasKey,
                error: String(err && (err as any).message ? (err as any).message : err)
              });
            }
          }
        }
        if (dbg && created) {
          _logWeaponAtlasSheetOnce(`sheet:${key}`, {
            sheetKey: key,
            atlasKey,
            tile: meta.tile,
            layer: meta.layer,
            variant: meta.variant,
            frameW: meta.frameW,
            frameH: meta.frameH
          });
        }
        if (textures.exists(key)) {
          loaded++;
        }
      }
      continue;
    }
  }
  if (needsLoaderStart) {
    try {
      const loader: any = scene.load;
      if (loader && typeof loader.isLoading === "function" && !loader.isLoading()) {
        loader.start();
      }
    } catch {
      // Ignore loader start failures; missing textures will surface in debug logs.
    }
  }
  const ready = loaded >= metas.length;
  return { ready, queued: queuedAtlases, total: metas.length };
}

// ----------------------------------------------------------
// Loader (preload)
// ----------------------------------------------------------

/**
 * Registers ALL discovered weapon spritesheets in Phaser.
 * Call this from Scene.preload().
 */
export function loadWeaponAtlases(scene: Phaser.Scene): void {
  const loaded = new Set<string>();
  const atlasData = WEAPON_ATLAS_DATA as Record<string, unknown>;
  _hookWeaponAtlasLoaderDebug(scene);
  const pendingAtlases = _scenePendingAtlases(scene);
  let queued = 0;
  let missingUrl = 0;
  for (const atlasKey of Object.keys(atlasData)) {
    if (loaded.has(atlasKey)) continue;
    loaded.add(atlasKey);
    const reloaded = _reloadAtlasIfSizeMismatch(scene, atlasKey, atlasData[atlasKey]);
    const atlasUrlBase = _weaponAtlasUrl(atlasKey);
    const bustToken = reloaded ? Date.now().toString(36) : WEAPON_ATLAS_BUST_TOKEN;
    const atlasUrl = bustToken ? _cacheBustUrl(atlasUrlBase, bustToken) : atlasUrlBase;
    if (!atlasUrl) missingUrl++;
    if (queueAtlasOnce(scene, atlasKey, atlasUrl, atlasData[atlasKey])) {
      queued++;
      pendingAtlases.add(atlasKey);
    }
  }
  let originalsFound = 0;
  let originalsQueued = 0;
  let originalsMissingMeta = 0;
  const originalsMode = DEBUG_WPN_USE_ORIGINALS_SUBDIR || DEBUG_WPN_FORCE_ORIGINALS_BY_FAMILY;
  const originalsRefMode = DEBUG_WPN_COMPARE_ORIGINALS_RUNTIME && !originalsMode;
  if (originalsMode || originalsRefMode) {
    const prefix = `${WEAPON_ATLAS_ORIGINALS_SUBDIR}/`;
    for (const relPath of Object.keys(weaponAtlasPngs)) {
      if (!relPath.startsWith(prefix)) continue;
      const file = relPath.split("/").pop() || "";
      const sheetKey = file.replace(/\.png$/i, "");
      if (!sheetKey) continue;
      const meta = SHEET_META_BY_KEY.get(sheetKey);
      if (!meta) {
        originalsMissingMeta++;
        continue;
      }
      const url = _weaponOriginalSheetUrl(sheetKey);
      if (!url) continue;
      originalsFound++;
      const texKey = originalsMode ? sheetKey : getWeaponOriginalRefKey(sheetKey);
      if (!texKey) continue;
      if (queueSpritesheetOnce(scene, texKey, url, meta.frameW, meta.frameH)) {
        originalsQueued++;
      }
    }
  }
  if (_weaponDebugEnabled()) {
    const line =
      "total=" + loaded.size +
      " queued=" + queued +
      " missingUrl=" + missingUrl +
      " originalsMode=" + (originalsMode ? 1 : 0) +
      " originalsRefMode=" + (originalsRefMode ? 1 : 0) +
      " originalsFound=" + originalsFound +
      " originalsQueued=" + originalsQueued +
      " originalsMissingMeta=" + originalsMissingMeta;
    console.log("[WPN-ATLAS-PRELOAD] " + line);
  }
}

// ----------------------------------------------------------
// Mode mapping
// ----------------------------------------------------------

// Accept both camelCase and snake_case spellings (and a few common variants)
const OVERSIZE_PHASES_RAW = new Set<string>(["thrustOversize", "slashOversize"]);
const MID_PHASES_RAW = new Set<string>(["oneHandSlash", "oneHandBackslash", "oneHandHalfslash"]);

// snake / normalized variants
const OVERSIZE_PHASES_SNAKE = new Set<string>(["thrust_oversize", "slash_oversize"]);
const MID_PHASES_SNAKE = new Set<string>([
  "one_hand_slash",
  "one_hand_backslash",
  "one_hand_halfslash",
  "onehand_slash",
  "onehand_backslash",
  "onehand_halfslash"
]);

export function weaponModeForHeroPhase(phase: string): WeaponMode {
  const raw = String(phase || "").trim();
  if (!raw) return "normal";

  // Fast path: original camelCase names
  if (OVERSIZE_PHASES_RAW.has(raw)) return "oversize";
  if (MID_PHASES_RAW.has(raw)) return "mid";

  // Normalize: camelCase -> snake_case, plus whitespace/hyphen -> underscore
  let snake = camelToSnake(raw).replace(/-+/g, "_").replace(/\s+/g, "_");
  snake = snake.replace(/_+/g, "_").toLowerCase();

  // Oversize: accept suffix style (e.g., thrust_oversize, slash_oversize)
  if (snake.endsWith("_oversize")) {
    // If someone passes "cast_oversize" someday, oversize is still the intent.
    return "oversize";
  }
  if (OVERSIZE_PHASES_SNAKE.has(snake)) return "oversize";

  // Mid: accept one-hand variants in several spellings
  if (MID_PHASES_SNAKE.has(snake)) return "mid";

  return "normal";
}


export function tileForWeaponMode(mode: WeaponMode): WeaponTile {
  if (mode === "oversize") return 192;
  if (mode === "mid") return 128;
  return 64;
}

// ----------------------------------------------------------
// Resolver helpers
// ----------------------------------------------------------

function normalizeAnimToken(s: string): string {
  return String(s || "")
    .trim()
    .replace(/\.png$/i, "")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_")
    .toLowerCase();
}

function camelToSnake(s: string): string {
  return String(s || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/\s+/g, "_")
    .toLowerCase();
}



// We no longer treat "mid/oversize" as semantic.
// We search all tile sizes and pick the first match by preference.
const WEAPON_TILE_SEARCH_ORDER: WeaponTile[] = [64, 128, 192];

function candidatesForHeroPhase(heroPhase: string): string[] {
  const raw = String(heroPhase || "").trim();
  const snake = camelToSnake(raw);

  // Normalize oversize phase names -> base phase name
  const base = snake.replace(/_oversize$/i, "");

  // Strength sub-phases should still use slash assets.
  if (base.startsWith("slash_")) {
    return ["slash", "attack_slash", "slash_oversize", "slashOversize", "slashoversize"];
  }

  // Movement
  if (base === "run") return ["run"];
  if (base === "walk") return ["walk", "universal_walk"];

  // Idle
  if (base === "idle") return ["idle", "universal_idle"];

  // NEW: combo is a *render token* for "weapon out / ready"
  if (base === "combo") {
    return [
      "universal_combat_idle",
      "combat_idle",
      "combatidle",
      "idle",
      "universal_idle",
    ];
  }

  // Combat idle (your pack uses universal_combat_idle sometimes)
  if (base === "combat_idle" || base === "combatidle") {
    return [
      "universal_combat_idle",
      "combat_idle",
      "combatidle",
      "idle",
      "universal_idle",
    ];
  }

  // Hurt
  if (base === "hurt") return ["hurt", "universal_hurt"];

  // One-hand phases
  if (base === "one_hand_slash") return ["attack_slash", "one_hand_slash", "onehand_slash"];
  if (base === "one_hand_backslash") return ["attack_backslash", "one_hand_backslash", "onehand_backslash", "backslash"];
  if (base === "one_hand_halfslash") return ["attack_halfslash", "one_hand_halfslash", "onehand_halfslash", "halfslash"];

  // Cast mapping
  if (base === "cast") return ["cast", "spellcast", "spell_cast"];

  // Shoot / bow mapping
  if (base === "shoot" || base === "bow") {
    return ["shoot", "universal_shoot", "bow", "attack_shoot"];
  }

  // Slash / Thrust (attack_* variants exist)
  if (base === "slash") {
    return ["slash", "attack_slash", "slash_oversize", "slashOversize", "slashoversize"];
  }
  if (base === "thrust") {
    return ["thrust", "attack_thrust", "thrust_oversize", "thrustOversize", "thrustoversize"];
  }

  return [base, normalizeAnimToken(raw)];
}



function toSheetRef(meta: WeaponPngMeta): WeaponSheetRef {
  return {
    key: meta.key,
    frameW: meta.tile,
    frameH: meta.tile,
    totalFrames: meta.totalFrames | 0,
    cols: meta.cols | 0,
    rows: meta.rows | 0
  };
}

/**
 * Resolve bg/fg layer sheets for one weapon model.
 *
 * - weaponId is the MODEL field from filenames
 * - heroPhase is used to choose an ANIM token with a small set of fallbacks
 * - variant defaults to "base" (i.e. vbase)
 * - mode chooses tile size: normal=64, mid=128, oversize=192
 */
export function resolveWeaponLayerPair(args: {
  weaponId: WeaponId;
  heroPhase: string;
  mode: WeaponMode;          // kept for signature compat (ignored for tile selection)
  variant?: string;          // without leading "v" (e.g. "base", "gold")
}): WeaponLayerPair | null {
  const model = String(args.weaponId || "").trim();
  if (!model) return null;

  const composite = WEAPON_MODEL_COMPOSITES[model];
  if (composite) {
    const fgPair = composite.fg
      ? _resolveWeaponLayerPairForModel({
        model: composite.fg,
        heroPhase: args.heroPhase,
        mode: args.mode,
        variant: args.variant
      })
      : null;
    const bgPair = composite.bg
      ? _resolveWeaponLayerPairForModel({
        model: composite.bg,
        heroPhase: args.heroPhase,
        mode: args.mode,
        variant: args.variant
      })
      : null;

    const bg = bgPair ? (bgPair.bg ?? bgPair.fg) : undefined;
    const fg = fgPair ? (fgPair.fg ?? fgPair.bg) : undefined;
    if (!bg && !fg) return null;

    return {
      tile: (fgPair?.tile ?? bgPair?.tile ?? tileForWeaponMode(args.mode)),
      model,
      variant: (fgPair?.variant ?? bgPair?.variant ?? String(args.variant || "base")),
      anim: (fgPair?.anim ?? bgPair?.anim ?? ""),
      bg,
      fg
    };
  }

  return _resolveWeaponLayerPairForModel({
    model,
    heroPhase: args.heroPhase,
    mode: args.mode,
    variant: args.variant
  });
}

function _resolveWeaponLayerPairForModel(args: {
  model: string;
  heroPhase: string;
  mode: WeaponMode;
  variant?: string;
}): WeaponLayerPair | null {
  const model = String(args.model || "").trim();
  if (!model) return null;

  const desiredVariant = String(args.variant || "base").trim() || "base";

  const byVariant = INDEX.get(model);
  if (!byVariant) return null;

  // Try: desired variant, then vbase, then any available
  const variantOrder = [desiredVariant, "base", ...Array.from(byVariant.keys())];
  const tried = new Set<string>();

  const animCandidates = candidatesForHeroPhase(args.heroPhase);
  const dbg = _weaponDebugEnabled();
  const dbgVerbose = _weaponDebugVerbose();

  for (const v of variantOrder) {
    const vv = String(v || "").trim();
    if (!vv || tried.has(vv)) continue;
    tried.add(vv);

    const byTile = byVariant.get(vv);
    if (!byTile) continue;

    // ✅ Search all tile sizes; "mode" no longer restricts tile.
    for (const tile of WEAPON_TILE_SEARCH_ORDER) {
      const byAnim = byTile.get(tile);
      if (!byAnim) continue;

      for (const a of animCandidates) {
        const key = normalizeAnimToken(a);
        const leaf = byAnim.get(key);
        if (!leaf) continue;
        if (!leaf.bg && !leaf.fg) continue;

        const bg = leaf.bg ? toSheetRef(leaf.bg) : undefined;
        const fg = leaf.fg ? toSheetRef(leaf.fg) : undefined;

        if (dbg) {
          const sig = [
            model,
            args.heroPhase,
            vv,
            tile,
            key,
            bg?.key || "",
            fg?.key || ""
          ].join("|");
          const bgMeta = bg?.key ? SHEET_META_BY_KEY.get(bg.key) : undefined;
          const fgMeta = fg?.key ? SHEET_META_BY_KEY.get(fg.key) : undefined;
          _logWeaponAtlasResolveOnce(sig, {
            model,
            heroPhase: args.heroPhase,
            variant: vv,
            anim: key,
            tile,
            bg: bg?.key || "",
            bgAtlas: bgMeta?.atlasKey || "",
            fg: fg?.key || "",
            fgAtlas: fgMeta?.atlasKey || ""
          });
          if (dbgVerbose && (!bg || !fg)) {
            _logWeaponAtlasResolveOnce(sig + ":missing", {
              model,
              heroPhase: args.heroPhase,
              variant: vv,
              anim: key,
              tile,
              bgFound: !!bg,
              fgFound: !!fg
            });
          }
        }

        return {
          tile,
          model,
          variant: vv,
          anim: key,
          bg,
          fg
        };
      }
    }
  }

  if (dbg) {
    const sig = [model, args.heroPhase, desiredVariant].join("|");
    _logWeaponAtlasResolveOnce(sig + ":miss", {
      model,
      heroPhase: args.heroPhase,
      variant: desiredVariant,
      animCandidates
    });
  }

  return null;
}




export function resolveAnyWeaponLayerPair(args: {
  weaponId: WeaponId;
  variant?: string; // without leading "v"
}): WeaponLayerPair | null {
  const model = String(args.weaponId || "").trim();
  if (!model) return null;

  const composite = WEAPON_MODEL_COMPOSITES[model];
  if (composite) {
    const fgPair = composite.fg
      ? _resolveAnyWeaponLayerPairForModel({ model: composite.fg, variant: args.variant })
      : null;
    const bgPair = composite.bg
      ? _resolveAnyWeaponLayerPairForModel({ model: composite.bg, variant: args.variant })
      : null;

    const bg = bgPair ? (bgPair.bg ?? bgPair.fg) : undefined;
    const fg = fgPair ? (fgPair.fg ?? fgPair.bg) : undefined;
    if (!bg && !fg) return null;

    return {
      tile: (fgPair?.tile ?? bgPair?.tile ?? 64),
      model,
      variant: (fgPair?.variant ?? bgPair?.variant ?? String(args.variant || "base")),
      anim: (fgPair?.anim ?? bgPair?.anim ?? ""),
      bg,
      fg
    };
  }

  return _resolveAnyWeaponLayerPairForModel({ model, variant: args.variant });
}

function _resolveAnyWeaponLayerPairForModel(args: {
  model: string;
  variant?: string;
}): WeaponLayerPair | null {
  const model = String(args.model || "").trim();
  if (!model) return null;

  const desiredVariant = String(args.variant || "base").trim() || "base";

  const byVariant = INDEX.get(model);
  if (!byVariant) return null;

  // Try: desired variant, then base, then any available
  const variantOrder = [desiredVariant, "base", ...Array.from(byVariant.keys())];
  const tried = new Set<string>();

  for (const v of variantOrder) {
    const vv = String(v || "").trim();
    if (!vv || tried.has(vv)) continue;
    tried.add(vv);

    const byTile = byVariant.get(vv);
    if (!byTile) continue;

    for (const tile of WEAPON_TILE_SEARCH_ORDER) {
      const byAnim = byTile.get(tile);
      if (!byAnim) continue;

      const animKeys = Array.from(byAnim.keys()).sort(); // deterministic
      for (const anim of animKeys) {
        const leaf = byAnim.get(anim);
        if (!leaf) continue;
        if (!leaf.bg && !leaf.fg) continue;

        return {
          tile,
          model,
          variant: vv,
          anim,
          bg: leaf.bg ? toSheetRef(leaf.bg) : undefined,
          fg: leaf.fg ? toSheetRef(leaf.fg) : undefined
        };
      }
    }
  }

  return null;
}



// ----------------------------------------------------------
// Compatibility shim (old API surface)
// ----------------------------------------------------------

/**
 * Old resolver returned exactly ONE sheet. We keep it for any older glue code,
 * but it now picks the FG layer if available, otherwise BG.
 */
export function resolveWeaponSheet(args: {
  weaponId: WeaponId;
  kind?: WeaponKind; // ignored (kept for signature compat)
  mode: WeaponMode;
  heroPhase?: string;
  variant?: string;
}): WeaponSheetRef | null {
  const pair = resolveWeaponLayerPair({
    weaponId: args.weaponId,
    heroPhase: args.heroPhase ?? (args.kind === "thrust" ? "thrust" : "slash"),
    mode: args.mode,
    variant: args.variant
  });
  if (!pair) return null;
  return pair.fg ?? pair.bg ?? null;
}



// ----------------------------------------------------------
// Debug / audit helpers (Step 1)
// ----------------------------------------------------------

export interface WeaponAuditPhaseReport {
  phase: string;
  mode: WeaponMode;
  tile: WeaponTile;
  modelsScanned: number;

  // count + lists
  modelsSupportingPhase: number;

  // first N models (small)
  exampleModels: string[];

  // full (or truncated) list of models that resolve for this phase
  supportingModels: string[];
  supportingModelsTruncated: boolean;
}

export interface WeaponAuditReport {
  totalSheets: number;
  totalModels: number;
  modelsScanned: number;
  scanWasTruncated: boolean;
  phases: WeaponAuditPhaseReport[];
  modelSample: string[];
}

export function runWeaponAudit(opts?: {
  phases?: string[];                 // default: DEFAULT_HERO_PHASES_FOR_WEAPON_AUDIT
  variant?: string;                  // default: "base"
  exampleLimit?: number;             // default: 12
  supportingModelsLimit?: number;    // default: 9999 (print all unless you cap it)
  maxModelsToScan?: number;          // default: 2000
  logAllModels?: boolean;            // default: false
  printSupportingModels?: boolean;   // default: true
}): WeaponAuditReport {
  const phases = (opts?.phases?.length ? opts.phases : DEFAULT_HERO_PHASES_FOR_WEAPON_AUDIT).map(s => String(s));
  const variant = String(opts?.variant ?? "base").trim() || "base";
  const exampleLimit = Math.max(1, (opts?.exampleLimit ?? 12) | 0);
  const supportingModelsLimit = Math.max(1, (opts?.supportingModelsLimit ?? 9999) | 0);
  const maxModelsToScan = Math.max(1, (opts?.maxModelsToScan ?? 2000) | 0);
  const printSupportingModels = (opts?.printSupportingModels !== false);

  const totalSheets = ALL_WEAPON_SHEETS.length;
  const allModels = listWeaponModels();
  const totalModels = allModels.length;

  const scanWasTruncated = totalModels > maxModelsToScan;
  const modelsToScan = scanWasTruncated ? allModels.slice(0, maxModelsToScan) : allModels;

  const phaseReports: WeaponAuditPhaseReport[] = [];
  for (const phase of phases) {
    const mode = weaponModeForHeroPhase(phase);
    const tile = tileForWeaponMode(mode);

    const examples: string[] = [];
    const supportingAll: string[] = [];

    for (const model of modelsToScan) {
      const pair = resolveWeaponLayerPair({
        weaponId: model,
        heroPhase: phase,
        mode,
        variant
      });
      if (!pair) continue;

      supportingAll.push(model);
      if (examples.length < exampleLimit) examples.push(model);
    }

    const truncated = supportingAll.length > supportingModelsLimit;
    const supportingModels = truncated ? supportingAll.slice(0, supportingModelsLimit) : supportingAll;

    phaseReports.push({
      phase,
      mode,
      tile,
      modelsScanned: modelsToScan.length,
      modelsSupportingPhase: supportingAll.length,
      exampleModels: examples,
      supportingModels,
      supportingModelsTruncated: truncated
    });
  }

  const modelSample = allModels.slice(0, 40);

  const report: WeaponAuditReport = {
    totalSheets,
    totalModels,
    modelsScanned: modelsToScan.length,
    scanWasTruncated,
    phases: phaseReports,
    modelSample
  };

  // Console output (human-friendly)
  try {
    const tag = "[WEAPON-AUDIT]";
    console.log(`${tag} sheets discovered = ${totalSheets}`);
    console.log(`${tag} weapon models discovered = ${totalModels}`);

    if (scanWasTruncated) {
      console.warn(`${tag} model scan truncated: scanned first ${modelsToScan.length} of ${totalModels}`);
    }

    if (opts?.logAllModels) {
      console.log(`${tag} ALL MODELS:`, allModels);
    } else {
      console.log(`${tag} model sample (first ${modelSample.length}):`, modelSample);
    }

    for (const pr of phaseReports) {
      console.log(
        `${tag} phase='${pr.phase}' mode='${pr.mode}' tile=${pr.tile}: supports=${pr.modelsSupportingPhase}/${pr.modelsScanned}`,
        pr.exampleModels
      );

      if (printSupportingModels) {
        if (pr.supportingModelsTruncated) {
          console.log(`${tag} phase='${pr.phase}' supporting models (first ${pr.supportingModels.length}, truncated):`, pr.supportingModels);
        } else {
          console.log(`${tag} phase='${pr.phase}' supporting models:`, pr.supportingModels);
        }
      }
    }
  } catch (_e) {
    // Never let audit logging break startup.
  }

  return report;
}
