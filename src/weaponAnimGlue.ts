// src/weaponAnimGlue.ts
// Phaser-side weapon overlay sprites (BG/FG sandwich + optional ghost trails)
// and deterministic frame resolution utilities.

import type Phaser from "phaser";

import {
  type Dir4,
  type WeaponId,
  type WeaponMode,
  type WeaponSheetRef,
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


// ----------------------------------------------------------
// Debug: gated, once-per-key logging for resolve failures/success
// Enable with: ?weaponDebug=1 (and optionally &weaponDebugVerbose=1)
// main.ts sets globalThis.__weaponDebug / __weaponDebugVerbose.
// ----------------------------------------------------------

const _WEAPON_RESOLVE_MISS_ONCE = new Set<string>();
const _WEAPON_RESOLVE_HIT_ONCE = new Set<string>();



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


// ------------------------------------------------------------
// WEAPON DEBUG FLAGS (code switch — no browser console toggles)
// ------------------------------------------------------------
// Turn this on to print weapon placement logs.
const WEAPON_DEBUG = false; 

// Turn this on to log placement every time it changes (otherwise “once per signature”).
const WEAPON_DEBUG_VERBOSE = false;

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
  console.warn("[WPN-RESOLVE-MISS]", payload);
}
function _logWeaponResolveHitOnce(key: string, payload: any): void {
  if (_WEAPON_RESOLVE_HIT_ONCE.has(key)) return;
  _WEAPON_RESOLVE_HIT_ONCE.add(key);
  console.log("[WPN-RESOLVE-HIT] " + _fmtWeaponResolveHitOneLine(payload));
}

function _logWeaponPlacedOnce(key: string, payload: any): void {
  if (_WEAPON_PLACED_ONCE.has(key)) return;
  _WEAPON_PLACED_ONCE.add(key);
  console.log("[WPN-PLACED]", payload);
}

function _logWeaponHiddenOnce(key: string, payload: any): void {
  if (_WEAPON_HIDDEN_ONCE.has(key)) return;
  _WEAPON_HIDDEN_ONCE.add(key);
  console.log("[WPN-HIDDEN]", payload);
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
    depth: number
  ): WeaponResolvedLayer | undefined => {
    if (!layerRef) {
      try { spr.setVisible(false); } catch { }
      return undefined;
    }

    if (spr.texture?.key !== layerRef.key) spr.setTexture(layerRef.key);

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

    return { key: layerRef.key, frameIndex };
  };

  const bgDepth = heroDepth - 1;
  const fgDepth = heroDepth + 1;

  const bg = applyOne(args.weaponBg, (pair as any).bg, bgDepth);
  const fg = applyOne(args.weaponFg, (pair as any).fg, fgDepth);

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

function getSheetGrid(scene: Phaser.Scene, ref: WeaponSheetRef): SheetGrid {
  const key = ref.key;
  const cached = GRID_CACHE.get(key);
  if (cached) return cached;

  const tex = scene.textures.get(key);
  const src: any = tex?.getSourceImage?.();
  const w = (src?.width ?? 0) | 0;
  const h = (src?.height ?? 0) | 0;
  const tile = ref.frameW | 0;

  const cols = tile > 0 ? Math.max(1, Math.floor(w / tile)) : 1;
  const rows = tile > 0 ? Math.max(1, Math.floor(h / tile)) : 1;
  const total = cols * rows;

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



// ----------------------------------------------------------
// Core “sync to hero” frame mapping
// ----------------------------------------------------------

// Returned by syncWeaponLayersToHero / syncWeaponToHero.
// Useful later for single-frame poses, ghost copies, and free-floating weapon effects.
export type WeaponResolvedLayer = {
  key: string;
  frameIndex: number;
};

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
  const row = weaponRows >= 4 ? dirIndex(args.dir) : 0;
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
}): number {
  const grid = getSheetGrid(args.scene, args.sheet);
  const weaponCols = grid.cols;
  const weaponRows = grid.rows;

  const row = weaponRows >= 4 ? dirIndex(args.dir) : 0;

  // Explicit override (treated as *column*, not absolute frame index)
  if (args.frameColOverride !== undefined && args.frameColOverride !== null) {
    const col = clampInt(args.frameColOverride | 0, 0, Math.max(0, weaponCols - 1));
    const idx = row * weaponCols + col;
    return clampInt(idx, 0, Math.max(0, grid.total - 1));
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

  if (frameInClip >= 0 && clipLen > 0 && weaponCols > 1) {
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
}): WeaponRenderResolve | null {
  const mode: WeaponMode = weaponModeForHeroPhase(args.heroPhase);

  const dbgOn = _weaponDebugEnabled();
  const dbgVerbose = _weaponDebugVerbose();
  const missKey = `${args.weaponId}|${args.heroPhase}|${mode}|${args.variant ?? ""}`;

  const heroDepth = (args.heroSprite as any).depth ?? 0;
  const off = WEAPON_OFFSET_BY_DIR[args.dir] ?? { x: 0, y: 0 };

  // Optional per-hero weapon offset (lets us “fake” center / placement)
  const wpnOx = (args.heroSprite as any).getData?.("wpnOx") ?? 0;
  const wpnOy = (args.heroSprite as any).getData?.("wpnOy") ?? 0;

  const x = args.heroSprite.x + (wpnOx | 0) + off.x;
  const y = args.heroSprite.y + (wpnOy | 0) + off.y;

  // For debug reuse across blocks
  let dbgHeroName = "";
  let dbgHeroFamily = "";

  const applyOne = (
    spr: Phaser.GameObjects.Sprite,
    layerRef: WeaponSheetRef | undefined,
    depth: number
  ): WeaponResolvedLayer | undefined => {
    if (!layerRef) {
      spr.setVisible(false);
      return undefined;
    }

    if (spr.texture?.key !== layerRef.key) spr.setTexture(layerRef.key);

    const frameIndex = resolveWeaponFrameIndexForLayer({
      scene: args.scene,
      sheet: layerRef,
      dir: args.dir,
      heroSprite: args.heroSprite,
      heroFrameIndex: args.heroFrameIndex,
      frameColOverride: args.frameColOverride
    });
    spr.setFrame(frameIndex);

    spr.x = x;
    spr.y = y;

    if (typeof (spr as any).setOrigin === "function") {
      const hx = (args.heroSprite as any).originX;
      const hy = (args.heroSprite as any).originY;
      if (typeof hx === "number" && typeof hy === "number") spr.setOrigin(hx, hy);
    }

    spr.scaleX = (args.heroSprite as any).scaleX ?? 1;
    spr.scaleY = (args.heroSprite as any).scaleY ?? 1;
    (spr as any).rotation = (args.heroSprite as any).rotation ?? 0;

    if (typeof (spr as any).setFlipX === "function") (spr as any).setFlipX(!!(args.heroSprite as any).flipX);
    if (typeof (spr as any).setFlipY === "function") (spr as any).setFlipY(!!(args.heroSprite as any).flipY);

    spr.setDepth(depth);
    spr.setVisible(true);

    return { key: layerRef.key, frameIndex };
  };

  // -----------------------------
  // phase fallback chain
  // -----------------------------
  const rawPhase = String(args.heroPhase || "").trim();
  const snake = rawPhase
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();

  const phaseTry: string[] = [args.heroPhase];

  if (snake === "combat_idle" || snake === "combatidle") {
    phaseTry.push("idle", "slash", "attack_slash", "thrust", "walk");
  } else if (snake === "idle") {
    phaseTry.push("combatIdle", "slash", "attack_slash", "thrust", "walk");
  }

  let pair: ReturnType<typeof resolveWeaponLayerPair> = null;
  let usedPhase = args.heroPhase;

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

  // Final fallback: if the specific phase(s) don't exist, pick ANY anim for this weapon.
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
    args.weaponBg.setVisible(false);
    args.weaponFg.setVisible(false);

    if (dbgOn) {
      _logWeaponResolveMissOnce(missKey, {
        weaponId: args.weaponId,
        heroPhase: args.heroPhase,
        mode,
        variant: args.variant ?? "base",
        note: "resolve failed (phase candidates + any-anim fallback all missed)"
      });
    }
    return null;
  }

  if (dbgOn && dbgVerbose) {
    _logWeaponResolveHitOnce(missKey, {
      weaponId: args.weaponId,
      heroPhase: `${args.heroPhase}->${usedPhase}`,
      mode,
      variant: args.variant ?? "base",
      bg: (pair as any).bg?.key ?? null,
      fg: (pair as any).fg?.key ?? null,
      anim: (pair as any).anim ?? null
    });
  }

  // Sandwich: bg behind hero, fg in front
  const bgDepth = heroDepth - 1;
  const fgDepth = heroDepth + 1;
  const bg = applyOne(args.weaponBg, (pair as any).bg, bgDepth);
  const fg = applyOne(args.weaponFg, (pair as any).fg, fgDepth);

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
    const placedKey = `${args.weaponId}|${dbgHeroName}|${dbgHeroFamily}|${args.heroPhase}|${usedPhase}|${args.dir}|${args.variant ?? ""}|${args.frameColOverride ?? -1}`;

    const bgVis = !!(args.weaponBg as any).visible;
    const fgVis = !!(args.weaponFg as any).visible;

    _logWeaponPlacedOnce(placedKey, {
      weaponId: args.weaponId,
      heroName: dbgHeroName,
      heroFamily: dbgHeroFamily,
      heroPhase: args.heroPhase,
      usedPhase,
      mode,
      dir: args.dir,
      heroFrameIndex: args.heroFrameIndex,
      frameColOverride: args.frameColOverride ?? -1,
      variant: args.variant ?? "base",
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
        weaponId: args.weaponId,
        heroPhase: args.heroPhase,
        usedPhase,
        mode,
        dir: args.dir,
        variant: args.variant ?? "base",
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
      `WPN|wid=${args.weaponId}|hero=${dbgHeroName}|fam=${dbgHeroFamily}` +
      `|phase=${args.heroPhase}->${usedPhase}|dir=${args.dir}` +
      `|v=${args.variant ?? ""}|fco=${args.frameColOverride ?? -1}` +
      `|hfi=${args.heroFrameIndex}|x=${x | 0}|y=${y | 0}|bg=${bgStr}|fg=${fgStr}`;

    _logWeaponPlace(
      dbgVerbose,
      sig,
      `[WPN-PLACE] wid=${args.weaponId} hero=${dbgHeroName} fam=${dbgHeroFamily} ` +
      `phase=${args.heroPhase} used=${usedPhase} mode=${mode} dir=${args.dir} heroFrame=${args.heroFrameIndex} ` +
      `heroXY=${((args.heroSprite.x) | 0)},${((args.heroSprite.y) | 0)} ` +
      `wpnOxOy=${(wpnOx | 0)},${(wpnOy | 0)} off=${(off.x | 0)},${(off.y | 0)} ` +
      `WXY=${(x | 0)},${(y | 0)} bg=${bgStr} fg=${fgStr} ` +
      `depthH=${heroDepth} depthBg=${bgDepth} depthFg=${fgDepth}`
    );
  }

  return {
    weaponId: args.weaponId,
    heroPhase: args.heroPhase,
    dir: args.dir,
    variant: args.variant ?? "base",
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
}): void {
  const mode: WeaponMode = weaponModeForHeroPhase(args.heroPhase);
  const tile = tileForWeaponMode(mode);

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
  // If frameColOverride is provided, treat it as an ABSOLUTE frame index.
  // This avoids resolver math producing out-of-range frames (e.g., 48).
  // --------------------------------------------------
  let frameIndex: number;
  if (args.frameColOverride !== undefined && args.frameColOverride !== null) {
    frameIndex = (args.frameColOverride as any) | 0; // absolute frame index (0 = first frame)
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
  args.weaponSprite.x = args.heroSprite.x + off.x;
  args.weaponSprite.y = args.heroSprite.y + off.y;

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
