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
}

// ----------------------------------------------------------
// Weapon-pack-specific types
// ----------------------------------------------------------

export type WeaponTile = 64 | 128 | 192;
export type WeaponLayer = "bg" | "fg";

export interface WeaponPngMeta {
  key: string;          // base filename (no .png) – used as Phaser texture key
  url: string;          // resolved by Vite import
  tile: WeaponTile;     // 64 / 128 / 192
  category: string;
  model: string;        // weaponId
  anim: string;         // one anim per file
  layer: WeaponLayer;   // bg / fg
  variant: string;      // e.g. base, gold, steel
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
// Vite discovery (eager URL map)
// ----------------------------------------------------------

// OLD (example)
// const weaponPngs = import.meta.glob("../assets/weapons/**/*.png", { ... })

// NEW (explicit tile folders; matches your structure)
const weaponPngs = import.meta.glob("../assets/weapons/t{064,128,192}/**/*.png", {
  as: "url",
  eager: true
}) as Record<string, string>;


function basenameNoExt(p: string): string {
  const file = p.split(/[\\/]/).pop() || p;
  return file.replace(/\.png$/i, "");
}

function parseWeaponFilename(base: string): WeaponPngMeta | null {
  // base is already filename without .png
  const parts = base.split("__");
  if (parts.length !== 6) return null;

  const tPart = parts[0];
  const category = parts[1];
  const model = parts[2];
  const anim = parts[3];
  const layer = parts[4] as WeaponLayer;
  const vPart = parts[5];

  if (!/^t(064|128|192)$/.test(tPart)) return null;
  if (layer !== "bg" && layer !== "fg") return null;
  if (!/^v.+/i.test(vPart)) return null;

  const tileNum = Number(tPart.slice(1));
  const tile = (tileNum === 64 ? 64 : tileNum === 128 ? 128 : 192) as WeaponTile;
  const variant = vPart.slice(1); // strip leading "v"

  // minimal sanity
  if (!category || !model || !anim || !variant) return null;

  // NOTE: url is injected later by the discovery loop.
  return {
    key: base,
    url: "",
    tile,
    category,
    model,
    anim,
    layer,
    variant
  };
}

// ----------------------------------------------------------
// Build an in-memory index at module load time
// ----------------------------------------------------------

const ALL_WEAPON_SHEETS: WeaponPngMeta[] = [];

// model -> variant -> tile -> anim -> pair
type PairLeaf = { bg?: WeaponPngMeta; fg?: WeaponPngMeta };
const INDEX = new Map<string, Map<string, Map<WeaponTile, Map<string, PairLeaf>>>>();

for (const [path, url] of Object.entries(weaponPngs)) {
  const base = basenameNoExt(path);
  const meta = parseWeaponFilename(base);
  if (!meta) continue;
  meta.url = url;

  ALL_WEAPON_SHEETS.push(meta);

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
// Loader (preload)
// ----------------------------------------------------------

/**
 * Registers ALL discovered weapon spritesheets in Phaser.
 * Call this from Scene.preload().
 */
export function loadWeaponAtlases(scene: Phaser.Scene): void {
  const loaded = new Set<string>();
  for (const meta of ALL_WEAPON_SHEETS) {
    if (loaded.has(meta.key)) continue;
    loaded.add(meta.key);
    scene.load.spritesheet(meta.key, meta.url, {
      frameWidth: meta.tile,
      frameHeight: meta.tile
    });
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
  return { key: meta.key, frameW: meta.tile, frameH: meta.tile };
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

  const desiredVariant = String(args.variant || "base").trim() || "base";

  const byVariant = INDEX.get(model);
  if (!byVariant) return null;

  // Try: desired variant, then vbase, then any available
  const variantOrder = [desiredVariant, "base", ...Array.from(byVariant.keys())];
  const tried = new Set<string>();

  const animCandidates = candidatesForHeroPhase(args.heroPhase);

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

        return {
          tile,
          model,
          variant: vv,
          anim: key,
          bg: leaf.bg ? toSheetRef(leaf.bg) : undefined,
          fg: leaf.fg ? toSheetRef(leaf.fg) : undefined
        };
      }
    }
  }

  return null;
}




export function resolveAnyWeaponLayerPair(args: {
  weaponId: WeaponId;
  variant?: string; // without leading "v"
}): WeaponLayerPair | null {
  const model = String(args.weaponId || "").trim();
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
