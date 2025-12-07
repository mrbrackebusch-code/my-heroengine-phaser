

import Phaser from "phaser";

console.log(">>> [main.ts] dynamic-import version loaded");

import {
    preloadMonsterSheets,
    buildMonsterAtlas,
    type MonsterAtlas
} from "./monsterAtlas";

import { applyMonsterAnimationForSprite } from "./monsterAnimGlue";



// Somewhere near the top of main.ts:
declare const globalThis: any;


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

    constructor() {
        super("hero");
    }

    preload() {
        console.log(">>> [HeroScene.preload] loading LPC monster sheets");
        preloadMonsterSheets(this);
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





        // ---------------------------
        // HOST vs NON-HOST
        // ---------------------------


        const params = new URLSearchParams(window.location.search);
        const isHostParam = params.get("host") === "1";
        (globalThis as any).__isHost = isHostParam;
        console.log(">>> [HeroScene.create] isHost (URL guess) =", isHostParam);

        console.log(">>> [HeroScene.create] importing compat + extensions (+ HeroEngine via host hook)");

        // IMPORTANT: load modules in MakeCode-like order
        const compatMod = await import("./arcadeCompat");
        await import("./text");
        await import("./status-bars");
        await import("./sprite-data");
        await import ("./heroEnginePhaserGlue");





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
    } else {
        console.warn(">>> [HeroScene.create] HeroEngine.start not found on engine module or globalThis");
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


        
        // If we're in a pure single-player / offline scenario and __isHost
        // was set before networking, we can start immediately. In the
        // multiplayer case, the network assign handler will also call this
        // once it knows who player 1 really is.
        if (g.__isHost) {
            g.__startHeroEngineHost();
        }



        console.log(">>> [HeroScene.create] imports finished");


        // --- Build LPC monster atlas after assets + HeroEngine are ready ---
        try {
            this.monsterAtlas = buildMonsterAtlas(this);
            (this as any).__monsterAtlas = this.monsterAtlas;
            (globalThis as any).__monsterAtlas = this.monsterAtlas;

            console.log(
                ">>> [HeroScene.create] monster atlas built; ids =",
                Object.keys(this.monsterAtlas)
            );
        } catch (e) {
            console.error(">>> [HeroScene.create] FAILED to build monster atlas", e);
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

        // --- NEW: drive monster animations from name/phase/dir ---
        this.children.each((obj: Phaser.GameObjects.GameObject) => {
            // Only interested in sprites that can play animations
            const sprite = obj as Phaser.GameObjects.Sprite;
            if (!sprite.anims || typeof sprite.getData !== "function") return;

            const monsterName = sprite.getData("name");
            if (!monsterName) return; // not labeled as a monster

            applyMonsterAnimationForSprite(sprite);
        });


    }




}






// -------------------------------------
// PHASER GAME CONFIG
// -------------------------------------

new Phaser.Game({
    type: Phaser.AUTO,

    // Keep your actual game world at 320×240
    width: 640, //320,
    height: 480, // 240,

    parent: "app",
    backgroundColor: "#000000",

    // Pixel art ON (crisp scaling, no smoothing)
    pixelArt: true,
    roundPixels: true,

    // Controls the on-screen enlargement
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        zoom: 3
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
});
