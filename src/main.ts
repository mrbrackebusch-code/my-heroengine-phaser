

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


//import { prewarmHeroAuraOutlinesAsync } from "./heroAnimGlue";
//import { prewarmHeroAuraOutlinesAsync } from "./heroAnimGlue";
import { loadWeaponAtlases, runWeaponAudit } from "./weaponAtlas";



// Somewhere near the top of main.ts:
declare const globalThis: any;


const ENABLE_HERO_ANIM_DEBUG = true;

const DEBUG_TILEMAP = true;



// ------------------------------------------------------------
// Weapon debug flags (no URL params / no console commands needed)
// ------------------------------------------------------------
const ENABLE_WEAPON_DEBUG = true;          // logs missing weapon resolves (once per key)
const ENABLE_WEAPON_DEBUG_VERBOSE = true; // also logs first successful resolve (once per key)
const ENABLE_WEAPON_AUDIT_ON_START = true; // prints model support summary at startup
const ENABLE_WEAPON_AUDIT_PRINT_ALL_MODELS = true; // huge log; leave false



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

    // Latest tilemap rev actually applied to the Phaser scene
    private _tilemapAppliedRev: number = 0;


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

        console.log(">>> [HeroScene.preload] loading weapon sheets");
        loadWeaponAtlases(this);

    }



    async create() {
        this.setupGlobalsAndDebug();

        const loadingText = this.createLoadingText();

        buildHeroAtlas(this);
        this.validateHeroAuras(loadingText);

        loadingText.destroy();

        this.initTileAtlasAndInstallTilemapHook();
        this.ensureHostFlagInitialized();

        const compatMod = await this.importMakeCodeModules();
        this.installStartHeroEngineHostHook();

        this.initNetwork(compatMod);
        this.wireKeyboardToController();

        console.log(">>> [HeroScene.create] imports finished");

        this.buildMonsterAtlasAndRegistry();
        this.maybeInstallHeroAnimTester();
    }



    




    private ensureWorldTileRenderer(atlas: TileAtlas): WorldTileRenderer {
        if (!this.tileRenderer) {
            if (DEBUG_TILEMAP) {
                console.log(">>> [HeroScene.tilemap] creating WorldTileRenderer");
            }
            this.tileRenderer = new WorldTileRenderer(this, atlas, {
                debugLocal: true
            });
        }
        return this.tileRenderer;
    }



    private applyTilemapToScene(grid: number[][], tileSize: number) {
        const atlas = this.tileAtlas;
        if (!atlas) {
            if (DEBUG_TILEMAP) console.warn(">>> [HeroScene.tilemap] applyTilemapToScene: missing tileAtlas");
            return;
        }

        const renderer = this.ensureWorldTileRenderer(atlas);

        if (DEBUG_TILEMAP) {
            console.log(">>> [HeroScene.tilemap] syncing from grid", {
                rows: grid.length,
                cols: grid[0]?.length,
                tileSize
            });
        }
        renderer.syncFromEngineGrid(grid);

        const rows = grid.length;
        const cols = grid[0]?.length || 0;

        const worldWidth = cols * tileSize;
        const worldHeight = rows * tileSize;

        this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

        if (DEBUG_TILEMAP) {
            console.log(">>> [HeroScene.tilemap] bounds set", {
                worldWidth,
                worldHeight,
                rows,
                cols,
                tileSize
            });
        }
    }


private setupGlobalsAndDebug() {
    const g = globalThis as any;

    console.log(">>> [HeroScene.create] running");

    // Make this scene globally accessible to arcadeCompat
    (globalThis as any).__phaserScene = this;
    console.log(
        ">>> [HeroScene.create] __phaserScene set =",
        !!(globalThis as any).__phaserScene
    );

    // Apply URL-driven hero profile (e.g., ?profile=Demo%20Hero)
    // (kept as-is; profile selection is not "debug")
    applyUrlProfileToGlobals();

    // Existing hero anim debug registry flag
    this.registry.set("heroAnimDebug", ENABLE_HERO_ANIM_DEBUG);

    // ------------------------------------------------------------
    // WEAPON DEBUG (flag-driven; no URL params / no console toggles)
    // These globals are consumed by weaponAnimGlue.ts
    // ------------------------------------------------------------
    (g as any).__weaponDebug = ENABLE_WEAPON_DEBUG;
    (g as any).__weaponDebugVerbose = ENABLE_WEAPON_DEBUG_VERBOSE;

    // Optional: expose audit runner (you never have to call it)
    (g as any).runWeaponAudit = (opts?: any) => runWeaponAudit(opts);

    // Optional: run audit at startup (prints counts + examples)
    if (ENABLE_WEAPON_AUDIT_ON_START) {
        runWeaponAudit({
            logAllModels: ENABLE_WEAPON_AUDIT_PRINT_ALL_MODELS,
            //phases: ["slash", "thrust", "cast"],
            variant: "base",
        });
    }

    // runtime toggle from console or other code (kept as-is)
    (g as any).toggleHeroAnimDebug = (on?: boolean) => {
        const cur = !!this.registry.get("heroAnimDebug");
        const next = (on === undefined) ? !cur : !!on;
        this.registry.set("heroAnimDebug", next);
        console.log("[heroAnimDebug] set to", next);
    };
}


private createLoadingText(): Phaser.GameObjects.Text {
    return this.add.text(12, 12, "Loading…", {
        fontFamily: "monospace",
        fontSize: "18px",
    }).setScrollFactor(0).setDepth(9999);
}

private validateHeroAuras(loadingText: Phaser.GameObjects.Text) {
    // AURA PIPELINE (spritesheet-only)
    // No runtime generation. We only validate required aura textures exist.
    const AURA_R = 2;
    const parsedSheets = (this.registry.get("__heroParsedSheets") || []) as any[];

    const isValid192Sheet = (texKey192: string): boolean => {
        if (!this.textures.exists(texKey192)) return false;

        try {
            const tex = this.textures.get(texKey192);
            const src: any = (tex as any)?.getSourceImage?.();
            const w = (src && (src.width | 0)) || 0;
            const h = (src && (src.height | 0)) || 0;
            if (w <= 0 || h <= 0) return false;

            // must be a clean 192 grid
            return (w % 192) === 0 && (h % 192) === 0;
        } catch (_e) {
            return false;
        }
    };

    const texKeysToUseSet = new Set<string>();

    loadingText.setText("Loading… validating auras");

    for (const sheet of parsedSheets) {
        const baseKey = sheet.textureKey;
        const auraBaseKey = `${baseKey}_aura_r${AURA_R}`;

        const key192 = baseKey + "_192";
        const auraKey192 = `${key192}_aura_r${AURA_R}`;

        if (this.textures.exists(baseKey)) {
            if (!this.textures.exists(auraBaseKey)) {
                throw new Error(
                    `[AURA-MISSING] Texture not loaded: ${auraBaseKey}. Run: npm run gen-auras`
                );
            }
            texKeysToUseSet.add(baseKey);
        }

        const hasReal192 = isValid192Sheet(key192);
        if (hasReal192) {
            if (!this.textures.exists(auraKey192)) {
                throw new Error(
                    `[AURA-MISSING] Texture not loaded: ${auraKey192}. Run: npm run gen-auras`
                );
            }
            texKeysToUseSet.add(key192);
        }
    }

    const texKeysToUse = Array.from(texKeysToUseSet);
    if (texKeysToUse.length === 0) {
        console.warn(">>> [HeroScene.create] no hero textures found to validate for auras");
    }

    loadingText.setText("Loading… 100%");
}

private initTileAtlasAndInstallTilemapHook() {
    console.log(">>> [HeroScene.create] building tile atlas");
    this.tileAtlas = buildTileAtlas(this);

    // TILEMAP NETWORK HOOK (followers + host)
    (globalThis as any).__onNetTilemap = (msg: any) => {
        try {
            if (!msg || msg.type !== "tilemap") return;

            const rev = typeof msg.rev === "number" ? msg.rev : 0;
            if (rev <= this._tilemapAppliedRev) return;
            this._tilemapAppliedRev = rev;

            const tileSize = msg.tileSize | 0;

            if (msg.encoding !== "raw") {
                console.warn(
                    ">>> [HeroScene] __onNetTilemap: unsupported encoding (for now):",
                    msg.encoding,
                    "rev=",
                    rev
                );
                return;
            }

            const grid: number[][] = msg.data;
            if (!Array.isArray(grid) || !Array.isArray(grid[0])) {
                console.warn(">>> [HeroScene] __onNetTilemap: malformed raw grid", {
                    rev,
                    tileSize,
                });
                return;
            }

            if (DEBUG_TILEMAP) {
                console.log(">>> [HeroScene.tilemap] applying network tilemap", {
                    rev,
                    rows: msg.rows,
                    cols: msg.cols,
                    tileSize,
                });
            }

            this.applyTilemapToScene(grid, tileSize);
        } catch (e) {
            console.error(">>> [HeroScene] __onNetTilemap ERROR:", e);
        }
    };

    // If a tilemap arrived before the hook was installed, apply it now.
    const pending = (globalThis as any).__lastTilemapMsg;
    if (pending && pending.type === "tilemap") {
        if (DEBUG_TILEMAP) {
            console.log(">>> [HeroScene.tilemap] applying pending cached tilemap on create()");
        }
        (globalThis as any).__onNetTilemap(pending);
    }
}

private ensureHostFlagInitialized() {
    const g: any = globalThis as any;

    if (typeof g.__isHost === "boolean") {
        console.log(">>> [HeroScene.create] host flag from network =", g.__isHost);
    } else {
        console.log(">>> [HeroScene.create] no host flag yet; defaulting to follower");
        g.__isHost = false;
    }
}

private async importMakeCodeModules(): Promise<any> {
    console.log(">>> [HeroScene.create] importing compat + extensions (+ HeroEngine via host hook)");

    // IMPORTANT: load modules in MakeCode-like order
    const compatMod = await import("./arcadeCompat");
    await import("./text");
    await import("./status-bars");
    await import("./sprite-data");
    await import("./heroEnginePhaserGlue");

    return compatMod;
}

private installStartHeroEngineHostHook() {
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

        // 5) Start the HeroEngine world
        const HE: any = engineMod.HeroEngine || (globalThis as any).HeroEngine;
        if (HE && typeof HE.start === "function") {
            console.log(">>> [HeroScene.create] starting HeroEngine from host");
            HE.start();

            // TILES: sync from HeroEngine and publish to server once
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

                    if (!scene || typeof scene.applyTilemapToScene !== "function") {
                        console.warn(
                            ">>> [HeroScene.create] no scene/applyTilemapToScene when trying to sync tiles"
                        );
                    } else {
                        scene.applyTilemapToScene(grid, tileSize);

                        // NETWORK: publish tilemap once (host authoritative)
                        const gAny: any = globalThis as any;

                        if (!gAny.__tilemapSentOnce) {
                            gAny.__tilemapSentOnce = true;

                            const netAny: any = gAny.__net;
                            const wsAny: any = netAny && netAny.ws;

                            const rows = grid.length;
                            const cols = grid[0]?.length || 0;

                            const tilemapMsg = {
                                type: "tilemap",
                                rev: 1,
                                tileSize,
                                rows,
                                cols,
                                encoding: "raw",
                                data: grid
                            };

                            try {
                                if (wsAny && wsAny.readyState === WebSocket.OPEN) {
                                    wsAny.send(JSON.stringify(tilemapMsg));
                                    if (DEBUG_TILEMAP) {
                                        console.log(">>> [HeroScene.tilemap] host sent tilemap to server", {
                                            rev: tilemapMsg.rev,
                                            rows,
                                            cols,
                                            tileSize
                                        });
                                    }
                                } else {
                                    console.warn(">>> [HeroScene.create] could not send tilemap (no ws / not open)");
                                }
                            } catch (e) {
                                console.error(">>> [HeroScene.create] ERROR sending tilemap:", e);
                            }
                        }
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
}

private initNetwork(compatMod: any) {
    if (typeof (compatMod as any).initNetwork === "function") {
        console.log(">>> [HeroScene.create] initNetwork()");
        (compatMod as any).initNetwork();
    } else {
        console.warn(">>> [HeroScene.create] compat.initNetwork missing");
    }
}

private wireKeyboardToController() {
    const controllerNS: any = (globalThis as any).controller;
    if (controllerNS && typeof controllerNS._wireKeyboard === "function") {
        console.log(">>> [HeroScene.create] wiring keyboard to controller (network-aware)");
        controllerNS._wireKeyboard(this);
    } else {
        console.warn(">>> [HeroScene.create] controller._wireKeyboard missing", controllerNS);
    }
}

private buildMonsterAtlasAndRegistry() {
    try {
        this.monsterAtlas = buildMonsterAtlas(this);

        (this as any).__monsterAtlas = this.monsterAtlas;
        (globalThis as any).__monsterAtlas = this.monsterAtlas;

        this.registry.set("monsterAtlas", this.monsterAtlas);

        console.log(
            ">>> [HeroScene.create] monster atlas built; ids =",
            Object.keys(this.monsterAtlas)
        );
    } catch (e) {
        console.error(">>> [HeroScene.create] FAILED to build monster atlas", e);
    }
}

private maybeInstallHeroAnimTester() {
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


