
// Use the global img`` implementation provided by arcadeCompat.ts
declare function img(strings: TemplateStringsArray, ...expr: any[]): Image;




// Exists in both MC and Phaser builds.
// In MC: nobody calls this → hostHeroLogicResolver stays null.
// In Phaser: heroLogicHost.ts calls it via globalThis (see below).
function __setHostHeroLogicResolver(fn: HeroLogicResolver) {
    hostHeroLogicResolver = fn
}

// Make it visible to the Phaser side without using `export` in this file.
const __g_any: any = (globalThis as any)
__g_any.__setHostHeroLogicResolver = __setHostHeroLogicResolver




// ==========================================
// Optional host hero-logic hook (Phaser/VS)
// ==========================================
type HeroLogicFn = (
    button: string,
    heroIndex: number,
    enemiesArr: Sprite[],
    heroesArr: Sprite[]
) => number[]



// ==========================================
// Phaser-only hero logic override for HeroEngine
// ==========================================

type HeroLogicResolver = (
    profile: string,
    heroIndex: number,
    button: string,
    enemiesArr: Sprite[],
    heroesArr: Sprite[]
) => number[] | null;

let hostHeroLogicResolver: HeroLogicResolver | null = null;






// Called AFTER WorkingHeroEngine25 has been imported.
export function initHeroEngineHostOverrides() {
    const g: any = globalThis as any;

    // Allow host code (heroLogicHost.ts) to register a resolver
    g.__setHostHeroLogicResolver = function (fn: HeroLogicResolver) {
        hostHeroLogicResolver = fn;
    };

    // Get the HeroEngine namespace from globalThis
    const engineNS: any = g.HeroEngine;
    if (!engineNS) {
        console.warn("[heroEnginePhaserGlue] HeroEngine namespace not found on globalThis");
        return;
    }

    // Capture the default engine implementation so we can fall back to it.
    const defaultRun: any = engineNS.runHeroLogicForHeroHook;

    function buildLiveViewsFromCompat(): { heroesArr: Sprite[]; enemiesArr: Sprite[] } {
        // Build live views of the current heroes and enemies from the compat registry.
        const allSprites = (sprites as any)._getAllSprites
            ? ((sprites as any)._getAllSprites() as Sprite[])
            : ([] as Sprite[]);

        const heroesArr: Sprite[] = [];
        const enemiesArr: Sprite[] = [];

        // NOTE: this is intentionally "push order" for now.
        // Later, when we bridge to N-player properly, we'll replace this with stable slot ordering.
        for (const s of allSprites) {
            if (!s) continue;
            if (s.kind === SpriteKind.Player) heroesArr.push(s);
            else if (s.kind === SpriteKind.Enemy) enemiesArr.push(s);
        }

        return { heroesArr, enemiesArr };
    }

    function resolveProfileForHeroIndex(heroIndex: number, heroesArr: Sprite[]): string {
        // Mirror engine logic: prefer OWNER slot if present
        let slotIndex = heroIndex;
        try {
            const hero = heroesArr[heroIndex];
            if (hero) {
                const ownerId = sprites.readDataNumber(hero, HERO_DATA.OWNER) | 0;
                if (ownerId > 0) slotIndex = ownerId - 1;
            }
        } catch (_e) {
            // If HERO_DATA or sprites.readDataNumber are not available, just keep heroIndex
        }

        // Optional override from host (main.ts) via globalThis.__heroProfiles
        try {
            const gAny: any = globalThis as any;
            if (gAny && gAny.__heroProfiles && typeof gAny.__heroProfiles[slotIndex] === "string") {
                return gAny.__heroProfiles[slotIndex];
            }
        } catch (_e) {
            // In Arcade builds, globalThis might not exist
        }

        return "Default";
    }

    // Override the engine's hook with a wrapper:
    //   1) Build Sprite[] arrays from the compat layer
    //   2) Ask host resolver for a move
    //   3) Fall back to engine default if needed
    engineNS.runHeroLogicForHeroHook = function (heroIndex: number, button: string) {
        const { heroesArr, enemiesArr } = buildLiveViewsFromCompat();

        const hero = heroesArr[heroIndex];
        if (!hero) {
            // No sprite for this hero index → let the engine handle it.
            if (typeof defaultRun === "function") return defaultRun(heroIndex, button);
            return null;
        }

        const profile = resolveProfileForHeroIndex(heroIndex, heroesArr);

        if (hostHeroLogicResolver) {
            try {
                const out = hostHeroLogicResolver(profile, heroIndex, button, enemiesArr, heroesArr);
                if (out && out.length) return out;
            } catch (e) {
                console.log(
                    "[heroEnginePhaserGlue] ERROR in hostHeroLogicResolver heroIndex=" +
                        heroIndex +
                        " button=" +
                        button +
                        " error=" +
                        e
                );
            }
        }

        if (typeof defaultRun === "function") return defaultRun(heroIndex, button);
        return null;
    };
}







//Keep this at the end of the file
// Export HeroEngine runtime to global for netWorld snapshots
game.onUpdate(function () {
    const now = game.runtime() | 0;
    (globalThis as any).__heroEngineWorldRuntimeMs = now;
});
//Keep this at the end of the file
//Keep this at the end of the file




