// heroLogicHost.ts – Phaser side
declare const globalThis: any;

import * as StudentLogic from "./studentLogicAll";

import { tryRunBlocklyHeroLogic } from "./blocklyHeroLogicRuntime";

// ==========================================
// Types
// ==========================================
type HeroLogicFn = (
    button: string,
    heroIndex: number,
    enemiesArr: Sprite[],
    heroesArr: Sprite[]
) => any[];


const DEBUG_HOST_LOGIC = false;

// ==========================================
// Registries (kept global for debugging)
// ==========================================
globalThis.__heroLogicByProfile = globalThis.__heroLogicByProfile || {};
globalThis.__heroLogicByIndex = globalThis.__heroLogicByIndex || {};

const heroLogicByProfile: { [name: string]: HeroLogicFn } =
    globalThis.__heroLogicByProfile;
const heroLogicByIndex: { [idx: number]: HeroLogicFn } =
    globalThis.__heroLogicByIndex;

// Grab engine enums if we need a totally generic fallback
const FAMILY: any = (globalThis as any).FAMILY || {};
const ELEM: any = (globalThis as any).ELEM || {};
const ANIM: any = (globalThis as any).ANIM || { ID: {} };

// Prefer the student DemoHeroLogic if it exists
const SL: any = StudentLogic;
const DemoHeroLogic: HeroLogicFn =
    typeof SL.DemoHeroLogic === "function"
        ? SL.DemoHeroLogic
        : (button, heroIndex, enemiesArr, heroesArr) => {
              // Ultra-safe boring fallback
              return [
                  FAMILY.STRENGTH || 0,
                  0, 20, 20, 20,
                  ELEM.NONE || 0,
                  (ANIM.ID && ANIM.ID.IDLE) || 0
              ];
          };

// ==========================================
// REGISTER PROFILE-BASED LOGIC
//   export function JasonHeroLogic(...) { ... }
// → heroLogicByProfile["Jason"] = JasonHeroLogic
// ==========================================
for (const key of Object.keys(SL)) {
    const fn = SL[key];
    if (typeof fn !== "function") continue;

    if (key.endsWith("HeroLogic") &&
        key !== "hero1Logic" &&
        key !== "hero2Logic" &&
        key !== "hero3Logic" &&
        key !== "hero4Logic") {

        const profile = key.substring(0, key.length - "HeroLogic".length);
        heroLogicByProfile[profile] = fn as HeroLogicFn;

        if (DEBUG_HOST_LOGIC) {
            console.log(
                "[heroLogicHost] registered profile logic",
                profile, "→", key
            );
        }
    }
}

// Also wire classic hero1Logic..hero4Logic to indexes 0..3 if present
if (typeof SL.hero1Logic === "function") {
    heroLogicByIndex[0] = SL.hero1Logic as HeroLogicFn;
    if (DEBUG_HOST_LOGIC) console.log("[heroLogicHost] index 0 → hero1Logic");
}
if (typeof SL.hero2Logic === "function") {
    heroLogicByIndex[1] = SL.hero2Logic as HeroLogicFn;
    if (DEBUG_HOST_LOGIC) console.log("[heroLogicHost] index 1 → hero2Logic");
}
if (typeof SL.hero3Logic === "function") {
    heroLogicByIndex[2] = SL.hero3Logic as HeroLogicFn;
    if (DEBUG_HOST_LOGIC) console.log("[heroLogicHost] index 2 → hero3Logic");
}
if (typeof SL.hero4Logic === "function") {
    heroLogicByIndex[3] = SL.hero4Logic as HeroLogicFn;
    if (DEBUG_HOST_LOGIC) console.log("[heroLogicHost] index 3 → hero4Logic");
}

// ==========================================
// WIRE ANIMATION HOOKS FROM STUDENT LOGIC FILE
// ==========================================
const HE: any = (globalThis as any).HeroEngine;

if (HE) {
    if (typeof SL.animateHero1 === "function") {
        HE.animateHero1Hook = SL.animateHero1;
        if (DEBUG_HOST_LOGIC) console.log("[heroLogicHost] animateHero1Hook wired");
    }
    if (typeof SL.animateHero2 === "function") {
        HE.animateHero2Hook = SL.animateHero2;
        if (DEBUG_HOST_LOGIC) console.log("[heroLogicHost] animateHero2Hook wired");
    }
    if (typeof SL.animateHero3 === "function") {
        HE.animateHero3Hook = SL.animateHero3;
        if (DEBUG_HOST_LOGIC) console.log("[heroLogicHost] animateHero3Hook wired");
    }
    if (typeof SL.animateHero4 === "function") {
        HE.animateHero4Hook = SL.animateHero4;
        if (DEBUG_HOST_LOGIC) console.log("[heroLogicHost] animateHero4Hook wired");
    }
}

// ==========================================
// RESOLVER → used by heroEnginePhaserGlue.ts
// ==========================================


const setResolver: ((fn: (
    profile: string,
    heroIndex: number,
    button: string,
    enemiesArr: Sprite[],
    heroesArr: Sprite[]
) => number[] | null) => void) | undefined =
    (globalThis as any).__setHostHeroLogicResolver;


function _he_posX(s: any): number {
  const v = (s && typeof s.x === "number") ? s.x : 0;
  return (v | 0);
}
function _he_posY(s: any): number {
  const v = (s && typeof s.y === "number") ? s.y : 0;
  return (v | 0);
}

function _he_readDataNumber(s: any, key: string, fallback = 0): number {
  try {
    const spritesNS: any = (globalThis as any).sprites;
    if (spritesNS && typeof spritesNS.readDataNumber === "function") {
      const v = spritesNS.readDataNumber(s, key);
      if (typeof v === "number" && Number.isFinite(v)) return v;
    }
  } catch {}
  // last-ditch fallback if someone stored fields directly
  const v2 = s ? (s as any)[key] : undefined;
  if (typeof v2 === "number" && Number.isFinite(v2)) return v2;
  return fallback;
}

function _he_buildReadonlyHeroLogicCtx(heroIndex: number, enemiesArr: Sprite[], heroesArr: Sprite[]) {
  const me = heroesArr && heroesArr[heroIndex] ? (heroesArr[heroIndex] as any) : null;
  const meX = _he_posX(me);
  const meY = _he_posY(me);

  const enemyX: number[] = [];
  const enemyY: number[] = [];
  const enemyHp: number[] = [];
  const enemyDistSq: number[] = [];

  for (let i = 0; i < (enemiesArr ? enemiesArr.length : 0); i++) {
    const e: any = enemiesArr[i];
    const ex = _he_posX(e);
    const ey = _he_posY(e);

    const dx = (ex - meX) | 0;
    const dy = (ey - meY) | 0;

    enemyX.push(ex);
    enemyY.push(ey);
    enemyHp.push(_he_readDataNumber(e, "hp", 0) | 0);
    enemyDistSq.push(((dx * dx) + (dy * dy)) | 0);
  }

  const heroX: number[] = [];
  const heroY: number[] = [];
  const heroHp: number[] = [];

  for (let i = 0; i < (heroesArr ? heroesArr.length : 0); i++) {
    const h: any = heroesArr[i];
    heroX.push(_he_posX(h));
    heroY.push(_he_posY(h));
    heroHp.push(_he_readDataNumber(h, "hp", 0) | 0);
  }

  Object.freeze(enemyX);
  Object.freeze(enemyY);
  Object.freeze(enemyHp);
  Object.freeze(enemyDistSq);
  Object.freeze(heroX);
  Object.freeze(heroY);
  Object.freeze(heroHp);

  const ctx = {
    heroIndex: heroIndex | 0,

    meX: meX | 0,
    meY: meY | 0,
    meHp: _he_readDataNumber(me, "hp", 0) | 0,

    enemyCount: enemyX.length | 0,
    enemyX,
    enemyY,
    enemyHp,
    enemyDistSq,

    heroCount: heroX.length | 0,
    heroX,
    heroY,
    heroHp,
  };

  return Object.freeze(ctx);
}

function _he_setBlocklyReadonlyCtx(heroIndex: number, enemiesArr: Sprite[], heroesArr: Sprite[]) {
  (globalThis as any).__heBlocklyRO = _he_buildReadonlyHeroLogicCtx(heroIndex, enemiesArr, heroesArr);
}


function _he_normFamily(v: any): number {
    if (typeof v === "number" && isFinite(v)) return v | 0;
    if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (s === "strength") return (FAMILY.STRENGTH ?? 0) | 0;
        if (s === "agility") return (FAMILY.AGILITY ?? 1) | 0;
        if (s === "intellect" || s === "intelligence") return (FAMILY.INTELLECT ?? 2) | 0;
        if (s === "wisdom" || s === "support" || s === "heal") return (FAMILY.HEAL ?? 3) | 0;
    }
    return (FAMILY.STRENGTH ?? 0) | 0;
}

function _he_normElem(v: any): number {
    // Ensure WIND exists (non-breaking; new id)
    if ((ELEM as any).WIND == null) (ELEM as any).WIND = 6;

    if (typeof v === "number" && isFinite(v)) return v | 0;
    if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (s === "none") return (ELEM.NONE ?? 0) | 0;

        if (s === "fire") return (ELEM.FIRE ?? 2) | 0;
        if (s === "water") return (ELEM.WATER ?? 3) | 0;
        if (s === "earth") return (ELEM.EARTH ?? 5) | 0;
        if (s === "wind") return ((ELEM as any).WIND ?? 6) | 0;

        // Keep legacy/extra names (won’t hurt)
        if (s === "grass") return (ELEM.GRASS ?? 1) | 0;
        if (s === "electric" || s === "lightning") return (ELEM.ELECTRIC ?? 4) | 0;
    }
    return (ELEM.NONE ?? 0) | 0;
}

function _he_normAnimId(v: any): number {
    const ID: any = (ANIM && ANIM.ID) ? ANIM.ID : {};
    const IDLE = (ID.IDLE ?? 0) | 0;
    if (typeof v === "number" && isFinite(v)) return v | 0;

    if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (s === "a") return (ID.A ?? 1) | 0;
        if (s === "b") return (ID.B ?? 2) | 0;
        if (s === "ab" || s === "a+b") return (ID.AB ?? 3) | 0;
        if (s === "idle") return IDLE;
    }
    return IDLE;
}

function _he_normOut(profile: string, button: string, out: any[] | null): number[] | null {
    if (!out || !Array.isArray(out) || out.length < 7) return null;

    const fam = _he_normFamily(out[0]);
    const t1 = (out[1] | 0);
    const t2 = (out[2] | 0);
    const t3 = (out[3] | 0);
    const t4 = (out[4] | 0);
    const elem = _he_normElem(out[5]);
    const animId = _he_normAnimId(out[6]);

    const norm = [fam, t1, t2, t3, t4, elem, animId];

    if (DEBUG_HOST_LOGIC) {
        // Helpful proof line: raw vs normalized
        console.log(
            "[heroLogicHost] NORM profile=" + profile +
            " button=" + button +
            " raw=" + JSON.stringify(out) +
            " norm=" + JSON.stringify(norm)
        );
    }

    return norm;
}



if (typeof setResolver === "function") {
    setResolver((profile, heroIndex, button, enemiesArr, heroesArr) => {
        const g: any = globalThis as any;
        const _setLogicSource = (source: string, prof: string) => {
            try {
                if (!g.__heLogicSourceByButton) g.__heLogicSourceByButton = {};
                g.__heLogicSourceByButton[String(button || "")] = {
                    source,
                    profile: String(prof || ""),
                    at: Date.now() | 0
                };
            } catch {}
        };

        // Switch:
        //   "blocklyIfPresent" (default): try Blockly; if null → fall back to TS
        //   "forceBlockly": Blockly-or-nothing; if null → return null (no move)
        //   "ts": disable Blockly completely
        const mode: string = (g.__heHeroLogicMode || "blocklyIfPresent");

        const effectiveProfile = (profile && String(profile).trim()) ? String(profile).trim() : "Demo";

        // Try profile candidates in case of mismatches
        const cand: string[] = [];
        cand.push(effectiveProfile);

        if (typeof g.__localHeroProfileName === "string" && g.__localHeroProfileName.trim()) {
            cand.push(g.__localHeroProfileName.trim());
        }

        // If you ever use __heroProfiles, try that too (P1 is slot 0)
        if (g.__heroProfiles && typeof g.__heroProfiles[0] === "string" && g.__heroProfiles[0].trim()) {
            cand.push(g.__heroProfiles[0].trim());
        }

        // Unique preserve order
        const seen = new Set<string>();
        const profilesToTry = cand.filter(p => (p && !seen.has(p) && (seen.add(p), true)));

        if (DEBUG_HOST_LOGIC) {
            console.log(
                "[heroLogicHost] RESOLVE mode=" + mode +
                " profile=" + effectiveProfile +
                " heroIndex=" + heroIndex +
                " button=" + button +
                " tryProfiles=" + JSON.stringify(profilesToTry)
            );
        }

        // 0) Blockly (optional/forced)
        if (mode !== "ts") {
            for (const p of profilesToTry) {
                const key = "he_blockly_ws_v1:" + encodeURIComponent(p);
                const hasXml = (() => {
                    try { return !!(localStorage.getItem(key) || "").trim(); } catch { return false; }
                })();

                _he_setBlocklyReadonlyCtx(heroIndex, enemiesArr, heroesArr)
                const raw = tryRunBlocklyHeroLogic(p, button)

                const out = _he_normOut(p, button, raw);

                if (out && out.length) {
                    if (DEBUG_HOST_LOGIC) {
                        console.log(
                            "[heroLogicHost] USING Blockly profile=" + p +
                            " out=" + JSON.stringify(out)
                        );
                    }
                    _setLogicSource("blockly", p);
                    return out;
                }

                if (DEBUG_HOST_LOGIC) {
                    console.log(
                        "[heroLogicHost] Blockly MISS profile=" + p +
                        " hasXml=" + hasXml +
                        " key=" + key
                    );
                }
            }

            // If forced, do NOT fall back to TS
            if (mode === "forceBlockly") {
                if (DEBUG_HOST_LOGIC) {
                    console.log("[heroLogicHost] FORCE Blockly: returning null (no move)");
                }
                _setLogicSource("blockly:miss", effectiveProfile);
                return null;
            }
        }

        // 1) Profile-based (TS)
        const byProfile = heroLogicByProfile[effectiveProfile];
        if (byProfile) {
            if (DEBUG_HOST_LOGIC) {
                console.log(
                    "[heroLogicHost] USING profile logic",
                    effectiveProfile,
                    "fn=",
                    byProfile.name
                );
            }
            const raw = byProfile(button, heroIndex, enemiesArr, heroesArr);
            const out = _he_normOut(effectiveProfile, button, raw);
            if (out && out.length) {
                _setLogicSource("ts:profile", effectiveProfile);
                return out;
            }
        }

        // 2) Index-based (TS)
        const byIndex = heroLogicByIndex[heroIndex | 0];
        if (byIndex) {
            if (DEBUG_HOST_LOGIC) {
                console.log(
                    "[heroLogicHost] USING index-based logic heroIndex=" + heroIndex,
                    "fn=",
                    byIndex.name
                );
            }
            _setLogicSource("ts:index", effectiveProfile);
            return byIndex(button, heroIndex, enemiesArr, heroesArr);
        }

        // 3) Demo fallback
        if (DemoHeroLogic) {
            if (DEBUG_HOST_LOGIC) {
                console.log("[heroLogicHost] USING DemoHeroLogic fallback");
            }
            _setLogicSource("demo", effectiveProfile);
            return DemoHeroLogic(button, heroIndex, enemiesArr, heroesArr);
        }

        if (DEBUG_HOST_LOGIC) {
            console.log("[heroLogicHost] NO logic found, returning null");
        }
        _setLogicSource("none", effectiveProfile);
        return null;
    });
} else {
    console.warn(
        "[heroLogicHost] __setHostHeroLogicResolver not found on globalThis; " +
        "host hero logic will not override engine defaults."
    );
}
