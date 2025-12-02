// heroLogicHost.ts – Phaser side
declare const globalThis: any;

import * as StudentLogic from "./studentLogicAll";

// ==========================================
// Types
// ==========================================
type HeroLogicFn = (
    button: string,
    heroIndex: number,
    enemiesArr: Sprite[],
    heroesArr: Sprite[]
) => number[];

const DEBUG_HOST_LOGIC = true;

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




// Somewhere near the bottom of heroLogicHost.ts, where setResolver is used

if (typeof setResolver === "function") {
    setResolver((profile, heroIndex, button, enemiesArr, heroesArr) => {
        const effectiveProfile = profile || "Demo";

        if (DEBUG_HOST_LOGIC) {
            console.log(
                "[heroLogicHost] RESOLVE profile=" + effectiveProfile +
                " heroIndex=" + heroIndex +
                " button=" + button
            );
        }

        // 1) Profile-based
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
            const out = byProfile(button, heroIndex, enemiesArr, heroesArr);
            if (out && out.length) return out;
        }

        // 2) Index-based
        const byIndex = heroLogicByIndex[heroIndex | 0];
        if (byIndex) {
            if (DEBUG_HOST_LOGIC) {
                console.log(
                    "[heroLogicHost] USING index-based logic heroIndex=" + heroIndex,
                    "fn=",
                    byIndex.name
                );
            }
            return byIndex(button, heroIndex, enemiesArr, heroesArr);
        }

        // 3) Optional Demo fallback (if you wired one)
        if (DemoHeroLogic) {
            if (DEBUG_HOST_LOGIC) {
                console.log("[heroLogicHost] USING DemoHeroLogic fallback");
            }
            return DemoHeroLogic(button, heroIndex, enemiesArr, heroesArr);
        }

        if (DEBUG_HOST_LOGIC) {
            console.log("[heroLogicHost] NO logic found, returning null");
        }
        return null;
    });
}


else {
    console.warn(
        "[heroLogicHost] __setHostHeroLogicResolver not found on globalThis; " +
        "host hero logic will not override engine defaults."
    );
}
