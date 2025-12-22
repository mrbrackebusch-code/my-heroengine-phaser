// src/weaponAtlas.ts
// Weapon registry + loader + sheet resolver for Phaser.
//
// Contract source: "Weapon Layer API Contract" (see chat).
//
// Conventions this file assumes:
//   1) Weapon spritesheets live in: ../assets/weapons/*.png (Vite glob).
//   2) WeaponSheetRef.key is BOTH the Phaser texture key AND the PNG base filename.
//      e.g. assets/weapons/iron_sword_swing_normal.png
//           => WeaponSheetRef.key = "iron_sword_swing_normal"

import type Phaser from "phaser";

// ----------------------------------------------------------
// Types (as specified)
// ----------------------------------------------------------

export type WeaponId = string;
export type WeaponKind = "swing" | "thrust";
export type WeaponMode = "normal" | "mid" | "oversize";
export type Dir4 = "up" | "down" | "left" | "right";

export interface WeaponSheetRef {
  key: string;          // Phaser texture key (and PNG base filename)
  frameW: number;       // 64 / 128 / 192-ish
  frameH: number;
  totalFrames?: number; // optional validation hint
}

export interface WeaponDef {
  id: WeaponId;
  defaultKind: WeaponKind;
  sheets: Partial<Record<WeaponKind, Partial<Record<WeaponMode, WeaponSheetRef>>>>;

  // Optional: explicit pose mapping overrides
  // posesByDir[dir][pose] = frame indices (absolute indices into the sheet)
  posesByDir?: Partial<Record<Dir4, Record<string, number[]>>>;
}

// ----------------------------------------------------------
// Registry
// ----------------------------------------------------------

// NOTE: Start empty. Add weapon defs as you add weapon sheets.
// This keeps the core API usable without forcing a particular weapon list.
export const WEAPONS: Record<WeaponId, WeaponDef> = {};

// ----------------------------------------------------------
// Asset discovery (Vite)
// ----------------------------------------------------------

const weaponPngs = import.meta.glob(
  "../assets/weapons/*.png",
  { as: "url", eager: true }
) as Record<string, string>;

function weaponUrlForKey(key: string): string | null {
  // Vite's glob keys include the relative path string we used.
  // We match by filename base so users don't have to care about slash direction.
  const target = `${key}.png`.toLowerCase();
  for (const [p, url] of Object.entries(weaponPngs)) {
    const file = (p.split(/[\\/]/).pop() || "").toLowerCase();
    if (file === target) return url;
  }
  return null;
}

// ----------------------------------------------------------
// Loader
// ----------------------------------------------------------

/**
 * Registers all weapon spritesheets in Phaser.
 * Call this from your Phaser Scene.preload().
 */
export function loadWeaponAtlases(scene: Phaser.Scene): void {
  const loadedKeys = new Set<string>();

  for (const def of Object.values(WEAPONS)) {
    for (const kind of Object.keys(def.sheets) as WeaponKind[]) {
      const byMode = def.sheets[kind];
      if (!byMode) continue;
      for (const mode of Object.keys(byMode) as WeaponMode[]) {
        const ref = byMode[mode];
        if (!ref) continue;
        if (!ref.key) continue;
        if (loadedKeys.has(ref.key)) continue;
        loadedKeys.add(ref.key);

        const url = weaponUrlForKey(ref.key);
        if (!url) {
          // Hard fail: if you declared a sheet ref, you meant to ship the PNG.
          throw new Error(
            `[weaponAtlas.loadWeaponAtlases] Missing PNG for key=${ref.key}. ` +
              `Expected assets/weapons/${ref.key}.png`
          );
        }

        scene.load.spritesheet(ref.key, url, {
          frameWidth: ref.frameW,
          frameHeight: ref.frameH
        });
      }
    }
  }
}

// ----------------------------------------------------------
// Phase -> mode
// ----------------------------------------------------------

// Knobs (single source of truth) — tweak as needed.
const OVERSIZE_PHASES = new Set<string>([
  "thrustOversize",
  "slashOversize"
]);

const MID_PHASES = new Set<string>([
  // optional: treat one-hand phases as "mid" if you want a slightly larger weapon view
  "oneHandSlash",
  "oneHandBackslash",
  "oneHandHalfslash"
]);

export function weaponModeForHeroPhase(phase: string): WeaponMode {
  const p = String(phase || "").trim();
  if (!p) return "normal";
  if (OVERSIZE_PHASES.has(p)) return "oversize";
  if (MID_PHASES.has(p)) return "mid";
  return "normal";
}

// ----------------------------------------------------------
// Resolver (kind/mode fallbacks)
// ----------------------------------------------------------

export function resolveWeaponSheet(args: {
  weaponId: WeaponId;
  kind?: WeaponKind; // if omitted, use weapon.defaultKind
  mode: WeaponMode;
}): WeaponSheetRef | null {
  const def = WEAPONS[args.weaponId];
  if (!def) return null;

  const requestedKind: WeaponKind = args.kind ?? def.defaultKind;
  const requestedMode: WeaponMode = args.mode;

  const otherKind: WeaponKind = requestedKind === "swing" ? "thrust" : "swing";
  const modeOrder: WeaponMode[] = ["normal", "mid", "oversize"]; // stable

  const tryGet = (k: WeaponKind, m: WeaponMode): WeaponSheetRef | null => {
    const byMode = def.sheets[k];
    const ref = byMode ? byMode[m] : undefined;
    return ref ?? null;
  };

  // 1) requested kind+mode
  {
    const r = tryGet(requestedKind, requestedMode);
    if (r) return r;
  }

  // 2) requested kind other modes
  for (const m of modeOrder) {
    if (m === requestedMode) continue;
    const r = tryGet(requestedKind, m);
    if (r) return r;
  }

  // 3) other kind (defaultKind first) requested mode
  {
    const r = tryGet(otherKind, requestedMode);
    if (r) return r;
  }

  // 4) other kind other modes
  for (const m of modeOrder) {
    if (m === requestedMode) continue;
    const r = tryGet(otherKind, m);
    if (r) return r;
  }

  // 5) null
  return null;
}
