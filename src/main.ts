

import Phaser from "phaser";

console.log(">>> [main.ts] dynamic-import version loaded");

import { preloadMonsterSheets, buildMonsterAtlas, type MonsterAtlas } from "./monsterAtlas";
import { applyMonsterAnimationForSprite } from "./monsterAnimGlue";

import { preloadHeroSheets, buildHeroAtlas } from "./heroAtlas";
import { debugSpawnHeroWithAnim } from "./heroAnimGlue";

import { installHeroAnimTester } from "./heroAnimGlue";

// NEW:
import { preloadTileSheets, buildTileAtlas, type TileAtlas } from "./tileAtlas";
import { WorldTileRenderer } from "./tileMapGlue";


import { prewarmHeroAuraOutlinesAsync } from "./heroAnimGlue";



// Somewhere near the top of main.ts:
declare const globalThis: any;


const ENABLE_HERO_ANIM_DEBUG = true;

function getProfileFromUrl(): string | null {
    try {
        const params = new URLSearchParams(window.location.search);
        const p = params.get("profile");
        return p ? decodeURIComponent(p) : null;
    } catch {
        return null;
    }
}

function applyUrlProfileToGlobals() {
    const profile = getProfileFromUrl();
    const g: any = (globalThis as any);

    // Store the raw name if anyone wants it
    g.__localHeroProfileName = profile;

    if (!g.__heroProfiles) {
        g.__heroProfiles = ["Default", "Default", "Default", "Default"];
    }

    if (profile && typeof profile === "string") {
        // Apply to slot 0 (player 1)
        g.__heroProfiles[0] = profile;
        console.log("[main] URL profile override for P1:", profile);
    } else {
        console.log("[main] no ?profile= URL param; using defaults");
    }
}










class HeroScene extends Phaser.Scene {

    private monsterAtlas?: MonsterAtlas;

    // NEW:
    private tileAtlas?: TileAtlas;
    private tileRenderer?: WorldTileRenderer;

    constructor() {
        super("hero");
    }

    preload() {
        console.log(">>> [HeroScene.preload] loading LPC monster sheets");
        preloadMonsterSheets(this);

        console.log(">>> [HeroScene.preload] loading hero spritesheets");
        preloadHeroSheets(this);

        console.log(">>> [HeroScene.preload] loading tile sheets");
        preloadTileSheets(this);
        // I included our preemptive logging here: [HeroScene.preload – tiles]
    }




    
async create() {
    const g = globalThis as any;
    console.log(">>> [HeroScene.create] running");

    // Make this scene globally accessible to arcadeCompat
    (globalThis as any).__phaserScene = this;
    console.log(
        ">>> [HeroScene.create] __phaserScene set =",
        !!(globalThis as any).__phaserScene
    );

    // Apply URL-driven hero profile (e.g., ?profile=Demo%20Hero)
    applyUrlProfileToGlobals();

    this.registry.set("heroAnimDebug", ENABLE_HERO_ANIM_DEBUG);

    // NEW: runtime toggle from console or other code
    (g as any).toggleHeroAnimDebug = (on?: boolean) => {
        const cur = !!this.registry.get("heroAnimDebug");
        const next = (on === undefined) ? !cur : !!on;
        this.registry.set("heroAnimDebug", next);
        console.log("[heroAnimDebug] set to", next);
    };

    const loadingText = this.add.text(12, 12, "Loading…", {
        fontFamily: "monospace",
        fontSize: "18px",
    }).setScrollFactor(0).setDepth(9999);

    buildHeroAtlas(this);

    // ------------------------------------------------------------
    // PREWARM (awaitable) – blocks network join until caches ready
    // Spritesheet-only aura pipeline: this is now basically a validation pass
    // that checks `${texKey}_aura_r2` exists for chosen texKey(s).
    // ------------------------------------------------------------
    const AURA_R = 2;
    const parsedSheets = (this.registry.get("__heroParsedSheets") || []) as any[];

    // Gather tex keys we want to warm:
    // - Always include baseKey if it exists
    // - Include key192 ONLY if BOTH key192 AND key192_aura_r2 exist
    const texKeysToWarmSet = new Set<string>();

    for (const sheet of parsedSheets) {
        const baseKey = sheet.textureKey;
        const key192 = baseKey + "_192";
        const auraKey192 = key192 + "_aura_r2";

        if (this.textures.exists(baseKey)) {
            texKeysToWarmSet.add(baseKey);
        }

        if (this.textures.exists(key192) && this.textures.exists(auraKey192)) {
            texKeysToWarmSet.add(key192);
        }
    }

    const texKeysToWarm = Array.from(texKeysToWarmSet);

    // Count total frames across all textures (for stable percent)
    const frameCounts: Record<string, number> = {};
    let grandTotal = 0;

    for (const k of texKeysToWarm) {
        const tex = this.textures.get(k);
        const names = (tex?.getFrameNames ? tex.getFrameNames() : []) as any[];
        const count = names.filter((f: any) => String(f) !== "__BASE").length;
        frameCounts[k] = count;
        grandTotal += count;
    }
    if (grandTotal <= 0) grandTotal = 1;

    // Progress
    let grandDone = 0;
    loadingText.setText("Loading… 0%");

    // Run all warmups (in parallel). Each warmup time-slices itself via delayedCall.
    await Promise.all(
        texKeysToWarm.map(async (k) => {
            let lastDoneForThisTex = 0;

            await prewarmHeroAuraOutlinesAsync(
                this,
                k,
                AURA_R,
                (done, _total) => {
                    // Increment global progress by the delta for this texture
                    const delta = done - lastDoneForThisTex;
                    if (delta > 0) {
                        lastDoneForThisTex = done;
                        grandDone += delta;

                        const pct = Math.min(100, Math.floor((grandDone / grandTotal) * 100));
                        loadingText.setText(`Loading… ${pct}%`);
                    }
                }
                // optional budgetMsPerTick as 5th arg if you want, e.g. , 6
            );
        })
    );

    loadingText.setText("Loading… 100%");
    loadingText.destroy();
    // ------------------------------------------------------------

    console.log(">>> [HeroScene.create] building tile atlas");
    this.tileAtlas = buildTileAtlas(this);

    // ---------------------------
    // HOST vs NON-HOST
    // ---------------------------
    if (typeof g.__isHost === "boolean") {
        console.log(">>> [HeroScene.create] host flag from network =", g.__isHost);
    } else {
        console.log(">>> [HeroScene.create] no host flag yet; defaulting to follower");
        g.__isHost = false;
    }
    // ---------------------------

    console.log(">>> [HeroScene.create] importing compat + extensions (+ HeroEngine via host hook)");

    // IMPORTANT: load modules in MakeCode-like order
    const compatMod = await import("./arcadeCompat");
    await import("./text");
    await import("./status-bars");
    await import("./sprite-data");
    await import("./heroEnginePhaserGlue");

    (globalThis as any).__startHeroEngineHost = async () => {
        const g: any = globalThis as any;
        if (g.__heroEngineHostStarted) return;
        g.__heroEngineHostStarted = true;

        console.log(">>> [HeroScene.create] __startHeroEngineHost: importing HeroEngineInPhaser");

        // 1) Load the wrapped HeroEngine module (with Phaser shims)
        const engineMod: any = await import("./HeroEngineInPhaser");

        // 2) Load the Phaser glue and install the host overrides
        const glue: any = await import("./heroEnginePhaserGlue");
        if (glue && typeof glue.initHeroEngineHostOverrides === "function") {
            glue.initHeroEngineHostOverrides();
        }

        // 3) Load heroLogicHost (auto-registers <Name>HeroLogic from studentLogicAll)
        await import("./heroLogicHost");

        // 4) Patch SpriteKind.create on ANY SpriteKind we can see
        const skGlobal: any = (globalThis as any).SpriteKind;
        const skMod: any = engineMod.SpriteKind;

        let sk: any = skMod || skGlobal;

        if (!sk) {
            sk = {};
            (globalThis as any).SpriteKind = sk;
        }

        if (typeof sk.create !== "function") {
            let _nextKind = 10;
            sk.create = function (): number {
                const id = _nextKind;
                _nextKind++;
                return id;
            };
        }

        if (skMod && skMod !== sk) {
            engineMod.SpriteKind = sk;
        }
        if (skGlobal && skGlobal !== sk) {
            (globalThis as any).SpriteKind = sk;
        }

        // 5) Start the HeroEngine world (from the module first, then global fallback)
        const HE: any = engineMod.HeroEngine || (globalThis as any).HeroEngine;
        if (HE && typeof HE.start === "function") {
            console.log(">>> [HeroScene.create] starting HeroEngine from host");
            HE.start();

            // ---------------------------
            // TILES: sync from HeroEngine
            // ---------------------------
            try {
                const g: any = globalThis as any;
                const internals = g.__HeroEnginePhaserInternals;

                const hasInternals =
                    internals &&
                    typeof internals.getWorldTileMap === "function" &&
                    typeof internals.getWorldTileSize === "function";

                if (!hasInternals) {
                    console.warn(
                        ">>> [HeroScene.create] __HeroEnginePhaserInternals missing or incomplete – cannot sync tiles yet"
                    );
                } else {
                    const grid: number[][] = internals.getWorldTileMap();
                    const tileSize: number = internals.getWorldTileSize();

                    const scene: any = g.__phaserScene;
                    const atlas: TileAtlas | undefined = scene?.tileAtlas;

                    if (!scene || !atlas) {
                        console.warn(
                            ">>> [HeroScene.create] no scene/tileAtlas when trying to sync tiles"
                        );
                    } else {
                        if (!scene.tileRenderer) {
                            console.log(
                                ">>> [HeroScene.create] creating WorldTileRenderer (host)"
                            );
                            scene.tileRenderer = new WorldTileRenderer(scene, atlas, {
                                debugLocal: true
                                // For now use default tileValueToFamily mapper inside WorldTileRenderer.
                            });
                        }

                        console.log(
                            ">>> [HeroScene.create] syncing WorldTileRenderer from HeroEngine grid",
                            { rows: grid.length, cols: grid[0]?.length, tileSize }
                        );
                        scene.tileRenderer.syncFromEngineGrid(grid);

                        // NEW: update physics & camera bounds to match the full tilemap
                        const rows = grid.length;
                        const cols = grid[0]?.length || 0;

                        const worldWidth = cols * tileSize;
                        const worldHeight = rows * tileSize;

                        scene.physics.world.setBounds(0, 0, worldWidth, worldHeight);
                        scene.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

                        console.log(
                            ">>> [HeroScene.create] set physics/camera bounds from tilemap:",
                            { worldWidth, worldHeight, rows, cols, tileSize }
                        );

                    }
                }
            } catch (e) {
                console.error(
                    ">>> [HeroScene.create] ERROR while syncing tiles from HeroEngine:",
                    e
                );
            }

        } else {
            console.warn(
                ">>> [HeroScene.create] HeroEngine.start not found on engine module or globalThis"
            );
        }

        // 6) Schedule a sprite dump to verify everything
        console.log(">>> [HeroScene.create] scheduling sprite dump (host only)");
        setTimeout(() => {
            console.log(">>> [HeroScene.create] RUNNING SPRITE DUMP");
            import("./arcadeCompat")
                .then((compat: any) => {
                    if (compat && typeof compat.dumpAllSprites === "function") {
                        compat.dumpAllSprites();
                    } else {
                        console.log("[HeroScene.create] dumpAllSprites not found on arcadeCompat");
                    }
                })
                .catch((e: any) => {
                    console.log("[HeroScene.create] sprite dump import error: " + e);
                });
        }, 1000);
    };

    // ---------------------------
    // NETWORK INITIALIZATION
    // (all clients: host + non-hosts)
    // ---------------------------
    if (typeof (compatMod as any).initNetwork === "function") {
        console.log(">>> [HeroScene.create] initNetwork()");
        (compatMod as any).initNetwork();
    } else {
        console.warn(">>> [HeroScene.create] compat.initNetwork missing");
    }

    // ---------------------------
    // KEYBOARD → CONTROLLER
    // (all clients send input; host will *apply* it)
    // ---------------------------
    const controllerNS: any = (globalThis as any).controller;
    if (controllerNS && typeof controllerNS._wireKeyboard === "function") {
        console.log(
            ">>> [HeroScene.create] wiring keyboard to controller (network-aware)"
        );
        controllerNS._wireKeyboard(this);
    } else {
        console.warn(
            ">>> [HeroScene.create] controller._wireKeyboard missing",
            controllerNS
        );
    }

    console.log(">>> [HeroScene.create] imports finished");

    // --- Build LPC monster atlas after assets + HeroEngine are ready ---
    try {
        this.monsterAtlas = buildMonsterAtlas(this);

        // keep these if you want the extra access points:
        (this as any).__monsterAtlas = this.monsterAtlas;
        (globalThis as any).__monsterAtlas = this.monsterAtlas;

        // *** KEY LINE: make it visible via scene.registry ***
        this.registry.set("monsterAtlas", this.monsterAtlas);

        console.log(
            ">>> [HeroScene.create] monster atlas built; ids =",
            Object.keys(this.monsterAtlas)
        );
    } catch (e) {
        console.error(">>> [HeroScene.create] FAILED to build monster atlas", e);
    }

    // 🔹 HERO ANIM TESTER: call this behind a simple flag if you like
    const paramsHero = new URLSearchParams(window.location.search);
    const heroAnimTest = paramsHero.get("heroAnimTest") === "1";
    if (heroAnimTest) {
        installHeroAnimTester(this);
    }
}










    update(time: number, delta: number) {
        const gAny: any = (globalThis as any);
        const isHost = !!gAny.__isHost;

        // Only the host should actually tick the HeroEngine game loop.
        if (!isHost) return;

        const game = gAny.game;
        if (game && typeof game._tick === "function") {
            try {
                game._tick();
            } catch (e) {
                console.error(">>> [HeroScene.update] _tick ERROR:", e);
            }
        }


    }




}





// -------------------------------------
// PHASER GAME CONFIG
// -------------------------------------

function shouldStartGameFromUrl(): boolean {
    try {
        const params = new URLSearchParams(window.location.search);
        // Require at least a profile; host defaults are handled elsewhere
        return !!params.get("profile");
    } catch {
        return false;
    }
}


// Choose a target max size and aspect ratio
const MAX_WIDTH = 1536;
const MAX_HEIGHT = 864;
const TARGET_ASPECT = 16 / 9;

// Compute a size that fits this browser window, but not bigger than your max
let width = Math.min(window.innerWidth, MAX_WIDTH);
let height = Math.min(window.innerHeight, MAX_HEIGHT);

// Adjust to keep 16:9 without exceeding the window
if (width / height > TARGET_ASPECT) {
    // Too wide → clamp by height
    width = Math.floor(height * TARGET_ASPECT);
} else {
    // Too tall → clamp by width
    height = Math.floor(width / TARGET_ASPECT);
}

const gameConfig: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,

    width,
    height,

    parent: "app",
    backgroundColor: "#000000",

    pixelArt: true,
    roundPixels: true,

    scale: {
        mode: Phaser.Scale.NONE,              // no extra scaling
        autoCenter: Phaser.Scale.CENTER_BOTH  // center inside #app
    },

    physics: {
        default: "arcade",
        arcade: { debug: false }
    },

    fps: {
        target: 60,
        min: 30,
        forceSetTimeOut: false
    },

    scene: [HeroScene]
};




if (shouldStartGameFromUrl()) {
    console.log("[main] profile found in URL; starting Phaser game.");
    new Phaser.Game(gameConfig);
} else {
    console.log("[main] no ?profile= URL param; waiting for landing page redirect.");
}


