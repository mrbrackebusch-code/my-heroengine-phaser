// src/weaponAnimGlue.ts
// Phaser-side weapon overlay sprites (weapon + ghost trails) and deterministic
// pose/frame resolution utilities.

import type Phaser from "phaser";

import {
  type Dir4,
  type WeaponId,
  type WeaponKind,
  type WeaponMode,
  WEAPONS,
  weaponModeForHeroPhase,
  resolveWeaponSheet
} from "./weaponAtlas";

// ----------------------------------------------------------
// Constants / knobs (tweak freely)
// ----------------------------------------------------------

const DIR_ORDER: Dir4[] = ["up", "left", "down", "right"]; // matches hero tester ordering

// If a WeaponSheetRef.totalFrames is not supplied, we assume an LPC-ish row length.
// (This is only used to keep deterministic pose defaults from exploding.)
const DEFAULT_ROW_LEN = 13;

// Depth policy: where weapon should sit relative to hero.
// You can override later by moving this policy into per-weapon offsets.
const WEAPON_DEPTH_DELTA_BY_DIR: Record<Dir4, number> = {
  up: -1,
  down: +1,
  left: +1,
  right: +1
};

// Optional positional nudges (in pixels), in case you later want slight hand offsets.
// Leave at 0 for now so the overlay is perfectly centered.
const WEAPON_OFFSET_BY_DIR: Record<Dir4, { x: number; y: number }> = {
  up: { x: 0, y: 0 },
  down: { x: 0, y: 0 },
  left: { x: 0, y: 0 },
  right: { x: 0, y: 0 }
};

// ----------------------------------------------------------
// 5) Create overlay sprites (weapon + ghosts)
// ----------------------------------------------------------

export function createWeaponOverlaySprites(args: {
  scene: Phaser.Scene;
  maxGhosts: number;
}): {
  weapon: Phaser.GameObjects.Sprite;
  ghosts: Phaser.GameObjects.Sprite[];
} {
  const { scene } = args;

  // Create with a dummy texture; we'll swap texture+frame on first sync.
  // Phaser requires a valid texture key; "__MISSING" is always available.
  const weapon = scene.add.sprite(0, 0, "__MISSING", 0);
  weapon.setVisible(false);

  const ghosts: Phaser.GameObjects.Sprite[] = [];
  const n = Math.max(0, args.maxGhosts | 0);
  for (let i = 0; i < n; i++) {
    const g = scene.add.sprite(0, 0, "__MISSING", 0);
    g.setVisible(false);
    g.setAlpha(0.35);
    ghosts.push(g);
  }

  return { weapon, ghosts };
}

// ----------------------------------------------------------
// 6) Pose frames resolver (1–N frames)
// ----------------------------------------------------------

function dirIndex(dir: Dir4): number {
  const i = DIR_ORDER.indexOf(dir);
  return i >= 0 ? i : 0;
}

function stableHash32(s: string): number {
  // FNV-1a-ish, tiny and stable.
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function clampInt(v: number, lo: number, hi: number): number {
  v |= 0;
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

function computeDefaultRowLen(totalFrames: number | undefined): number {
  const t = (totalFrames ?? 0) | 0;
  if (t > 0 && t % 4 === 0) {
    const row = (t / 4) | 0;
    if (row > 0) return row;
  }
  return DEFAULT_ROW_LEN;
}

function computeRowStart(totalFrames: number | undefined, dir: Dir4): number {
  const rowLen = computeDefaultRowLen(totalFrames);
  return dirIndex(dir) * rowLen;
}

function poseToWithinRowFrames(pose: string, rowLen: number): number[] {
  const p = String(pose || "").trim();
  const rl = Math.max(1, rowLen | 0);

  // Stable defaults (cheap + deterministic).
  // The idea: you can author 1–2 frame idles and 2–4 frame accents.
  // Adjust these later once weapon sheets exist.
  switch (p) {
    case "held":
      return [0];
    case "idle2":
      return [0, Math.min(1, rl - 1)];
    case "slashA":
      return [Math.min(2, rl - 1), Math.min(3, rl - 1)];
    case "slashB":
      return [Math.min(4, rl - 1), Math.min(5, rl - 1)];
    default: {
      // Unknown pose: pick 1 deterministic frame within the row.
      const h = stableHash32(p);
      return [h % rl];
    }
  }
}

export function resolveWeaponPoseFrames(args: {
  weaponId: WeaponId;
  kind?: WeaponKind;
  mode: WeaponMode;
  dir: Dir4;
  pose: string; // e.g. "held", "idle2", "slashA", "slashB"
}): number[] {
  const def = WEAPONS[args.weaponId];
  const pose = String(args.pose || "held");

  // 1) Explicit override mapping if provided.
  const override =
    def?.posesByDir?.[args.dir]?.[pose] ??
    def?.posesByDir?.[args.dir]?.[String(pose).toLowerCase()];

  if (override && override.length > 0) {
    return override.slice();
  }

  // 2) Deterministic defaults.
  const sheet = resolveWeaponSheet({
    weaponId: args.weaponId,
    kind: args.kind,
    mode: args.mode
  });

  // Even if the sheet is missing, we must return at least 1 frame.
  const totalFrames = sheet?.totalFrames;
  const rowLen = computeDefaultRowLen(totalFrames);
  const rowStart = computeRowStart(totalFrames, args.dir);
  const within = poseToWithinRowFrames(pose, rowLen);

  const out: number[] = [];
  for (const w of within) {
    const idx = rowStart + (w | 0);
    if (typeof totalFrames === "number" && totalFrames > 0) {
      out.push(clampInt(idx, 0, totalFrames - 1));
    } else {
      out.push(Math.max(0, idx | 0));
    }
  }

  return out.length > 0 ? out : [0];
}

// ----------------------------------------------------------
// 7) Frame index resolver for “sync to hero” cases
// ----------------------------------------------------------

export function resolveWeaponFrameIndex(args: {
  weaponId: WeaponId;
  kind?: WeaponKind;
  mode: WeaponMode;
  dir: Dir4;
  heroPhase: string;
  heroFrameIndex: number;
}): number {
  const sheet = resolveWeaponSheet({
    weaponId: args.weaponId,
    kind: args.kind,
    mode: args.mode
  });

  const total = sheet?.totalFrames;
  const heroIdx = args.heroFrameIndex | 0;

  // If weapon sheet layout matches hero phase layout, return heroFrameIndex.
  // Our concrete test is simply: is heroFrameIndex in bounds (when totalFrames is known)?
  if (typeof total === "number" && total > 0) {
    if (heroIdx >= 0 && heroIdx < total) return heroIdx;
  }

  // Otherwise, deterministic fallback: held[0] for this dir.
  const held = resolveWeaponPoseFrames({
    weaponId: args.weaponId,
    kind: args.kind,
    mode: args.mode,
    dir: args.dir,
    pose: "held"
  });
  return (held[0] ?? 0) | 0;
}

// ----------------------------------------------------------
// 8) Sync weapon sprite to hero sprite (position/depth/frame)
// ----------------------------------------------------------

export function syncWeaponToHero(args: {
  heroSprite: Phaser.GameObjects.Sprite;
  weaponSprite: Phaser.GameObjects.Sprite;
  weaponId: WeaponId;
  kind?: WeaponKind;
  heroPhase: string;
  dir: Dir4;
  heroFrameIndex: number;
}): void {
  const mode = weaponModeForHeroPhase(args.heroPhase);
  const sheet = resolveWeaponSheet({
    weaponId: args.weaponId,
    kind: args.kind,
    mode
  });

  if (!sheet) {
    args.weaponSprite.setVisible(false);
    return;
  }

  // Texture + frame
  if (args.weaponSprite.texture?.key !== sheet.key) {
    args.weaponSprite.setTexture(sheet.key);
  }

  const frameIndex = resolveWeaponFrameIndex({
    weaponId: args.weaponId,
    kind: args.kind,
    mode,
    dir: args.dir,
    heroPhase: args.heroPhase,
    heroFrameIndex: args.heroFrameIndex
  });
  args.weaponSprite.setFrame(frameIndex);

  // Position (centered + optional offsets)
  const off = WEAPON_OFFSET_BY_DIR[args.dir] ?? { x: 0, y: 0 };
  args.weaponSprite.x = args.heroSprite.x + off.x;
  args.weaponSprite.y = args.heroSprite.y + off.y;

  // Match hero origin/scale/flip/rotation so overlay stays glued.
  if (typeof (args.weaponSprite as any).setOrigin === "function") {
    const hx = (args.heroSprite as any).originX;
    const hy = (args.heroSprite as any).originY;
    if (typeof hx === "number" && typeof hy === "number") {
      args.weaponSprite.setOrigin(hx, hy);
    }
  }

  args.weaponSprite.scaleX = (args.heroSprite as any).scaleX ?? 1;
  args.weaponSprite.scaleY = (args.heroSprite as any).scaleY ?? 1;
  (args.weaponSprite as any).rotation = (args.heroSprite as any).rotation ?? 0;

  if (typeof (args.weaponSprite as any).setFlipX === "function") {
    (args.weaponSprite as any).setFlipX(!!(args.heroSprite as any).flipX);
  }
  if (typeof (args.weaponSprite as any).setFlipY === "function") {
    (args.weaponSprite as any).setFlipY(!!(args.heroSprite as any).flipY);
  }

  // Depth policy (lives here)
  const heroDepth = (args.heroSprite as any).depth ?? 0;
  const dd = WEAPON_DEPTH_DELTA_BY_DIR[args.dir] ?? 1;
  args.weaponSprite.setDepth(heroDepth + dd);

  args.weaponSprite.setVisible(true);
}

// ----------------------------------------------------------
// 9) Apply ghost trails with pendulum (pending add amount only)
// ----------------------------------------------------------

export function applyWeaponGhostTrails(args: {
  weaponSprite: Phaser.GameObjects.Sprite;
  ghosts: Phaser.GameObjects.Sprite[];
  // pendulum inputs
  phase01: number; // 0..1
  maxGhostsVisible: number;
  // pose selection for trails
  weaponId: WeaponId;
  kind?: WeaponKind;
  heroPhase: string;
  dir: Dir4;
  heroFrameIndex: number;
  trailsPose?: string; // default "held"
}): { ghostCount: number } {
  const maxGhosts = Math.max(0, args.ghosts.length | 0);
  const wantMax = clampInt(args.maxGhostsVisible | 0, 0, maxGhosts);

  // "phase01" is assumed to already be the pendulum-like 0..1 value.
  // We map it directly to a count (pending add amount visualization).
  const t = Math.max(0, Math.min(1, Number(args.phase01) || 0));
  const ghostCount = clampInt(Math.round(t * wantMax), 0, wantMax);

  // If weapon sprite isn't visible / has no valid texture, hide ghosts.
  const weaponVisible = !!args.weaponSprite.visible;
  const weaponKey = args.weaponSprite.texture?.key ? String(args.weaponSprite.texture.key) : "";
  if (!weaponVisible || !weaponKey || weaponKey === "__MISSING") {
    for (const g of args.ghosts) g.setVisible(false);
    return { ghostCount: 0 };
  }

  const mode = weaponModeForHeroPhase(args.heroPhase);
  const pose = args.trailsPose ?? "held";
  const frames = resolveWeaponPoseFrames({
    weaponId: args.weaponId,
    kind: args.kind,
    mode,
    dir: args.dir,
    pose
  });
  const f0 = (frames[0] ?? 0) | 0;

  // Visible ghosts
  for (let i = 0; i < args.ghosts.length; i++) {
    const g = args.ghosts[i];
    if (i < ghostCount) {
      g.setTexture(weaponKey);
      g.setFrame(f0);

      g.x = args.weaponSprite.x;
      g.y = args.weaponSprite.y;

      // Keep transform glue
      g.scaleX = (args.weaponSprite as any).scaleX ?? 1;
      g.scaleY = (args.weaponSprite as any).scaleY ?? 1;
      (g as any).rotation = (args.weaponSprite as any).rotation ?? 0;
      if (typeof (g as any).setFlipX === "function") (g as any).setFlipX(!!(args.weaponSprite as any).flipX);
      if (typeof (g as any).setFlipY === "function") (g as any).setFlipY(!!(args.weaponSprite as any).flipY);

      // Depth just behind weapon
      const wDepth = (args.weaponSprite as any).depth ?? 0;
      g.setDepth(wDepth - 1);

      // Alpha falloff (deterministic)
      const a = 0.35 * (1 - i / Math.max(1, ghostCount));
      g.setAlpha(a);
      g.setVisible(true);
    } else {
      g.setVisible(false);
    }
  }

  return { ghostCount };
}
