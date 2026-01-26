import type Phaser from "phaser";
import { queueSpritesheetOnce } from "./loaderCache";
import { HOOKSHOT_THRUST_SHEET, HOOKSHOT_THRUST_FRAMES, type HookshotWeaponFrame } from "./generated/hookshotWeaponMeta";
export { HOOKSHOT_THRUST_SHEET };

const HOOKSHOT_THRUST_PNG = new URL("../assets/weapons/_hookshot/hookshot_thrust.png", import.meta.url).toString();

const FRAME_BY_KEY = new Map<string, HookshotWeaponFrame>();
for (const f of HOOKSHOT_THRUST_FRAMES) {
  const key = `${f.weaponId}|${f.variant}|${f.anim}`;
  FRAME_BY_KEY.set(key, f);
}

function _frameKey(weaponId: string, variant: string, anim: string): string {
  return `${String(weaponId || "").trim().toLowerCase()}|${String(variant || "").trim().toLowerCase()}|${String(anim || "").trim().toLowerCase()}`;
}

export function preloadHookshotThrustSheet(scene: Phaser.Scene): void {
  if (!scene) return;
  queueSpritesheetOnce(
    scene,
    HOOKSHOT_THRUST_SHEET.key,
    HOOKSHOT_THRUST_PNG,
    HOOKSHOT_THRUST_SHEET.frameW,
    HOOKSHOT_THRUST_SHEET.frameH
  );
}

export function ensureHookshotThrustSheetLoaded(scene: Phaser.Scene): { ready: boolean; queued: boolean } {
  if (!scene) return { ready: false, queued: false };
  const textures: any = scene.textures;
  const exists = textures && typeof textures.exists === "function"
    ? !!textures.exists(HOOKSHOT_THRUST_SHEET.key)
    : false;
  if (exists) return { ready: true, queued: false };
  const queued = queueSpritesheetOnce(
    scene,
    HOOKSHOT_THRUST_SHEET.key,
    HOOKSHOT_THRUST_PNG,
    HOOKSHOT_THRUST_SHEET.frameW,
    HOOKSHOT_THRUST_SHEET.frameH
  );
  if (queued) {
    try {
      const loader: any = scene.load;
      if (loader && typeof loader.isLoading === "function" && !loader.isLoading()) {
        loader.start();
      }
    } catch { /* ignore */ }
  }
  return { ready: false, queued };
}

export function resolveHookshotThrustFrame(
  weaponId: string,
  variant: string,
  anim: string
): HookshotWeaponFrame | null {
  const id = String(weaponId || "").trim().toLowerCase();
  const v = String(variant || "").trim().toLowerCase();
  const a = String(anim || "").trim().toLowerCase();
  if (!id) return null;
  const hit = FRAME_BY_KEY.get(_frameKey(id, v, a));
  if (hit) return hit;
  if (v && v !== "base") {
    const baseHit = FRAME_BY_KEY.get(_frameKey(id, "base", a));
    if (baseHit) return baseHit;
  }
  // Fallback anim token
  if (a !== "attack_thrust") {
    const alt = FRAME_BY_KEY.get(_frameKey(id, v, "attack_thrust"));
    if (alt) return alt;
    const altBase = FRAME_BY_KEY.get(_frameKey(id, "base", "attack_thrust"));
    if (altBase) return altBase;
  }
  return null;
}
