// scripts/updateHeroEngine.js
//
// 1) Downloads HeroEngine.ts from your GitHub repo:
//    https://github.com/mrbrackebusch-code/hero-engine
// 2) Optionally saves a plain copy in codeFromMakeCodeArcade/HeroEngine.ts
// 3) Wraps it with Phaser-only shims and glue
// 4) Writes the combined file to src/HeroEngineInPhaser.ts

const https = require("https");
const fs = require("fs");
const path = require("path");

// Adjust "main" to "master" here if your default branch is named differently
const RAW_URL =
  "https://raw.githubusercontent.com/mrbrackebusch-code/hero-engine/master/HeroEngine.ts";

// Helper: fetch text from a URL
function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(
            new Error("HTTP " + res.statusCode + " while fetching " + url)
          );
          res.resume();
          return;
        }

        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      })
      .on("error", (err) => reject(err));
  });
}

async function run() {
  try {
    console.log("[updateHeroEngine] Fetching core from:", RAW_URL);
    const coreSource = await fetchText(RAW_URL);
    console.log(
      "[updateHeroEngine] Downloaded core HeroEngine.ts (" +
        coreSource.length +
        " bytes)"
    );

    // 1) Optional: keep a plain copy under codeFromMakeCodeArcade/
    const coreDir = path.join(__dirname, "..", "codeFromMakeCodeArcade");
    const corePath = path.join(coreDir, "HeroEngine.ts");
    if (!fs.existsSync(coreDir)) {
      fs.mkdirSync(coreDir, { recursive: true });
    }
    fs.writeFileSync(corePath, coreSource, "utf8");
    console.log("[updateHeroEngine] Wrote plain core to:", corePath);

    // 2) Phaser-only TOP shim
    const TOP = `
// -----------------------------------------------------
// MakeCode-compatible randint helper for Phaser build
// (safe in Arcade too; just shadows the built-in)
// -----------------------------------------------------
function randint(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// --------------------------------------------------------------
// Sprite kinds - type declarations for TS (no top-level create())
// --------------------------------------------------------------
namespace SpriteKind {
    export let Hero: number
    export let HeroWeapon: number
    export let HeroAura: number
    export let EnemySpawner: number
    export let SupportBeam: number
    export let SupportIcon: number
    export let Wall: number
}

// =====================================================================
// PHASER-ONLY SHIM – DO NOT COPY THIS BLOCK INTO MAKECODE ARCADE
// =====================================================================
(function phaserSpriteKindShim() {
    // In the Phaser build, this module has its own SpriteKind object
    // that does NOT see Player/Enemy created in arcadeCompat.ts.
    // Here we force this module's SpriteKind to use the same ids
    // that arcadeCompat expects.
    const SK: any = SpriteKind as any;

    // Match arcadeCompat's ids
    if (SK.Player == null) SK.Player = 1;
    if (SK.Enemy == null) SK.Enemy = 2;

    // Stabilize custom kinds for the compat layer
    SK.Hero = 50;
    SK.HeroWeapon = 51;
    SK.HeroAura = 52;
    SK.EnemySpawner = 53;
    SK.SupportBeam = 54;
    SK.SupportIcon = 55;
    SK.Wall = 56;
})();
// =====================================================================
// END PHASER-ONLY SHIM
// =====================================================================

`;

    // 3) Phaser-only BOTTOM glue (includes our new tile internals side channel)
    const BOTTOM = `

// --------------------------------------------------------------
// Phaser-only glue: expose HeroEngine namespace on globalThis
// (Safe in MakeCode Arcade: guarded by typeof globalThis.)
// --------------------------------------------------------------
if (typeof globalThis !== "undefined") {
    (globalThis as any).HeroEngine = HeroEngine;
}

// ----------------------------------------------------------
// Phaser-only side channel: expose tile internals via global
// WITHOUT changing namespace HeroEngine.
// ----------------------------------------------------------
(() => {
    try {
        const g: any = globalThis as any;
        g.__HeroEnginePhaserInternals = g.__HeroEnginePhaserInternals || {};

        g.__HeroEnginePhaserInternals.getWorldTileMap = function (): number[][] {
            return _engineWorldTileMap;
        };

        g.__HeroEnginePhaserInternals.getWorldTileSize = function (): number {
            return WORLD_TILE_SIZE;
        };

        console.log(">>> [HeroEngineInPhaser] exposed __HeroEnginePhaserInternals (tile map + size)");
    } catch {
        // If globalThis isn't available (e.g., PXT runtime), just silently skip.
    }
})();

`;

    // 4) Build combined content
    const combined = `${TOP}\n${coreSource}\n${BOTTOM}\n`;

    // 5) Write combined file into src/HeroEngineInPhaser.ts
    const outPath = path.join(__dirname, "..", "src", "HeroEngineInPhaser.ts");
    fs.writeFileSync(outPath, combined, "utf8");
    console.log(
      "[updateHeroEngine] Wrote combined Phaser wrapper to:",
      outPath
    );

    console.log("[updateHeroEngine] Done.");
  } catch (err) {
    console.error("[updateHeroEngine] ERROR:", err.message);
    process.exit(1);
  }
}

run();
`;

This way, every time you run `node scripts/updateHeroEngine.js`:

- It pulls the latest `HeroEngine.ts`.
- Wraps it with the TOP shim.
- Appends **both**:

  - `globalThis.HeroEngine = HeroEngine;`
  - The `__HeroEnginePhaserInternals` IIFE.

So your “end” block is always preserved and you never have to re-hand-edit `HeroEngineInPhaser.ts` after updating the engine.
