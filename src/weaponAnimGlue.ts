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

function _weaponDebugEnabled(): boolean {
  return !!(globalThis as any).__weaponDebug;
}
function _weaponDebugVerbose(): boolean {
  return !!(globalThis as any).__weaponDebugVerbose;
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
  // Optional explicit override ("single frame" support). If provided, it is treated as
  // a *column index* in the weapon sheet grid (0..cols-1), and ignores hero progress.
  frameColOverride?: number;
}): number {
  const grid = getSheetGrid(args.scene, args.sheet);
  const weaponCols = grid.cols;
  const weaponRows = grid.rows;

  // Row selection: most sheets are 4 rows; hurt is 1 row.
  const row = weaponRows >= 4 ? dirIndex(args.dir) : 0;

  // Optional single-frame override: treat as a column index in the weapon sheet.
  // This is the knob used for charge poses and future ghost copies.
  let col = 0;
  if (args.frameColOverride !== undefined && args.frameColOverride !== null) {
    col = clampInt(args.frameColOverride | 0, 0, Math.max(0, weaponCols - 1));
  } else {
    // Preferred mapping: use animation progress, not raw frame index.
    // This makes 9-frame hero walks map cleanly onto 8-frame weapon walks.
    const animState: any = (args.heroSprite as any).anims;
    if (animState && typeof animState.getProgress === "function") {
      const p = Number(animState.getProgress()) || 0;
      col = clampInt(Math.round(p * Math.max(0, weaponCols - 1)), 0, weaponCols - 1);
    } else {
      // Fallback: attempt to mirror within-row column index from absolute frame index.
      // Compute hero cols from hero texture source dimensions.
      const hf = (args.heroSprite as any).frame;
      const heroTile = (hf?.width ?? 0) | 0;
      const heroTex = args.scene.textures.get((args.heroSprite as any).texture?.key);
      const heroSrc: any = heroTex?.getSourceImage?.();
      const heroW = (heroSrc?.width ?? 0) | 0;
      const heroCols = heroTile > 0 ? Math.max(1, Math.floor(heroW / heroTile)) : 1;
      col = clampInt((args.heroFrameIndex | 0) % heroCols, 0, weaponCols - 1);
    }
  }

  const idx = row * weaponCols + col;
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
  const x = args.heroSprite.x + off.x;
  const y = args.heroSprite.y + off.y;

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
  // NEW: phase fallback chain
  // -----------------------------
  const rawPhase = String(args.heroPhase || "").trim();
  const snake = rawPhase
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();

  const phaseTry: string[] = [args.heroPhase];

  // If charge forces combatIdle, but pack doesn't have it, fall back to “something”
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
  // This is a *column index* (0..cols-1) in the weapon sheet.
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

  const frameIndex = resolveWeaponFrameIndexForLayer({
    scene: args.scene,
    sheet: fixedSheet,
    dir: args.dir,
    heroSprite: args.heroSprite,
    heroFrameIndex: args.heroFrameIndex,
    frameColOverride: args.frameColOverride
  });
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
