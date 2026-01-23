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
import { WEAPON_DEBUG, WEAPON_DEBUG_VERBOSE } from "./debugFlags";
import { queueAtlasOnce } from "./loaderCache";
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

const weaponAtlasPngs = import.meta.glob("../assets/weapons/_atlas/*.png", {
  as: "url",
  eager: true
}) as Record<string, string>;

function _weaponAtlasUrl(atlasKey: string): string {
  const rel = `../assets/weapons/_atlas/${atlasKey}.png`;
  return weaponAtlasPngs[rel] || "";
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
for (const meta of ALL_WEAPON_SHEETS) {
  if (!meta.key) continue;
  SHEET_META_BY_KEY.set(meta.key, meta);
}

// model -> variant -> tile -> anim -> pair
type PairLeaf = { bg?: WeaponPngMeta; fg?: WeaponPngMeta };
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

  if (meta.layer === "bg") leaf.bg = meta;
  else leaf.fg = meta;
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
// Lazy-load helpers
// ----------------------------------------------------------

const WEAPON_LAZY_REQUESTED = new Set<string>();
const WEAPON_LAZY_REQUESTED_ATLAS = new Set<string>();
const WEAPON_SHEETS_BY_MODEL_VARIANT = new Map<string, WeaponPngMeta[]>();

const _WEAPON_ATLAS_RESOLVE_ONCE = new Set<string>();
const _WEAPON_ATLAS_LOAD_ONCE = new Set<string>();
const _WEAPON_ATLAS_SHEET_ONCE = new Set<string>();
const _WEAPON_ATLAS_SHEET_FAIL_ONCE = new Set<string>();

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
  console.log("[WPN-ATLAS-RESOLVE]", payload);
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

function _loaderIsLoading(loader: any): boolean {
  if (!loader) return false;
  try {
    if (typeof loader.isLoading === "function") return !!loader.isLoading();
    if (typeof loader.isLoading === "boolean") return loader.isLoading;
    if (typeof loader.loading === "boolean") return loader.loading;
  } catch {}
  return false;
}

function _startWeaponLoader(scene: Phaser.Scene): void {
  try {
    const loader: any = (scene as any).load;
    if (!loader) return;
    if (_loaderIsLoading(loader)) return;
    if (typeof loader.start === "function") loader.start();
  } catch { }
}

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
  let loaded = 0;
  let queued = 0;
  const dbg = _weaponDebugEnabled();
  const dbgVerbose = _weaponDebugVerbose();

  for (const meta of metas) {
    const key = meta.key;
    if (textures && typeof textures.exists === "function" && textures.exists(key)) {
      loaded++;
      continue;
    }

    const atlasKey = meta.atlasKey;
    if (atlasKey) {
      if (dbg && dbgVerbose) {
        _logWeaponAtlasLoadOnce(
          `atlas:${atlasKey}`,
          { atlasKey, sheetKey: key, tile: meta.tile, layer: meta.layer, variant: meta.variant }
        );
      }
      if (dbg && !textures.exists(atlasKey)) {
        _logWeaponAtlasLoadOnce(
          `atlas-missing-in-textures:${atlasKey}`,
          { atlasKey, sheetKey: key, queued: WEAPON_LAZY_REQUESTED_ATLAS.has(atlasKey) }
        );
      }
      if (!textures.exists(atlasKey) && !WEAPON_LAZY_REQUESTED_ATLAS.has(atlasKey)) {
        const atlasUrl = _weaponAtlasUrl(atlasKey);
        const atlasData = (WEAPON_ATLAS_DATA as Record<string, unknown>)[atlasKey];
        const didQueue = atlasUrl && atlasData
          ? queueAtlasOnce(scene, atlasKey, atlasUrl, atlasData)
          : false;
        if (didQueue) queued++;
        WEAPON_LAZY_REQUESTED_ATLAS.add(atlasKey);
        if (dbg && (!atlasUrl || !atlasData)) {
          _logWeaponAtlasLoadOnce(
            `atlas-missing:${atlasKey}`,
            { atlasKey, hasUrl: !!atlasUrl, hasData: !!atlasData }
          );
        }
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
          WEAPON_LAZY_REQUESTED.add(key);
          loaded++;
        }
      }
      continue;
    }
  }

  if (queued > 0) _startWeaponLoader(scene);

  const ready = loaded >= metas.length;
  return { ready, queued, total: metas.length };
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
  let queued = 0;
  let missingUrl = 0;
  for (const atlasKey of Object.keys(atlasData)) {
    if (loaded.has(atlasKey)) continue;
    loaded.add(atlasKey);
    const atlasUrl = _weaponAtlasUrl(atlasKey);
    if (!atlasUrl) missingUrl++;
    if (queueAtlasOnce(scene, atlasKey, atlasUrl, atlasData[atlasKey])) queued++;
  }
  if (_weaponDebugEnabled()) {
    console.log("[WPN-ATLAS-PRELOAD]", { total: loaded.size, queued, missingUrl });
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
  if (base === "run") return ["walk", "move"];
  if (base === "walk") return ["walk", "move"];

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
