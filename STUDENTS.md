# Student Developed Systems

This repo is open to student contributions. Student work is isolated to avoid conflicts with core development.

Where to work
- All student code lives under src/student/<Name>/.
- Do not edit files outside your folder unless the maintainer asks.
- Do not edit assets/ or src/generated/.

Entry point (auto-discovery)
- Your system entry file is src/student/<Name>/index.ts.
- These index files are auto-discovered; keep them in place.
- Use src/studentSdk.ts for safe hooks and registration.

Student SDK (safe hooks)
- assets: registerImage, registerSpritesheet, registerAtlas, registerAudio, registerJson, registerTileSheet
- data: register, list, get (materials, songs, items, etc.)
- props: registerSpec, registerVisual, registerDecal
- npc/prop registry: registerStudentNpc, listStudentNpcs, registerStudentNpcInteractHandler; registerStudentProp, listStudentProps, registerStudentPropInteractHandler
- traps: registerDefinition
- maze: registerStudentMaze, listStudentMazes, getStudentMaze, registerStudentMazeHooks
- terrain: listStudentTerrainFamilies, listStudentFloorFamilies, listStudentWallFamilies
- bosses: registerBossPhaseConfig, listBossPhaseConfigs, getStudentBossPhaseConfig, registerStudentBossHooks (boss lifecycle + move/phase hooks + intro jump/move pick/barrage/poison/charge observation; debug-gated overrides)
- pets/inventory: registerPetAtlas, listPetAtlases, registerPetBehavior, listPetBehaviors, registerPetStats, listPetStats, registerPetAcquisition, listPetAcquisitions, registerInventoryItem, registerInventoryHooks, registerAlly
- relics: register (adds to core relic catalog)
- vfx: register (adds to VFX registry)
- ui: createOverlay, getOverlay, removeOverlay
- debug: setStartFloor (optional start floor override for your profile)
- Prefer importing from src/studentSystemsHooks.ts for all hooks.

**Maze Options**
- `listStudentTerrainFamilies()` returns all terrain families with `id`, `kind`, and a label.
- `listStudentFloorFamilies()` filters to floor families (ground + water).
- `listStudentWallFamilies()` filters to wall families (chasm + hedge).
- Maze grids can include `theme` with `baseFamily`, `wallFamily`, `palette`, and `textureSeed`.
- Maze grids can include `traps`, a list of `{ r, c, kind, mode, propBase, trapId }`.
- Trap coordinates `r`/`c` are 0-based tile indices into the maze grid.
- `kind` values: `trap` or `shrine` (default `trap`).
- `mode` values: `kill` or `block` (default `kill`).
- `propBase` overrides the prop art (defaults to `fire_totem` for traps, `shrine` for shrines).
- `trapId` forces a specific Blockly puzzle id (optional).
- When `traps` has entries, default trap/shrine spawns are skipped for that floor.

Notes
- Keys are automatically namespaced per student. Use the returned key for references.
- NPC ids should use the <Name>NPC convention (example: ShopkeeperNPC).
- Student props can alias visuals/specs via visualKey/specKey; interactAction can be "prop" or "npc".
- Student NPCs are tagged when you spawn an LPC NPC with npcRole or profileName matching the NPC id.
- If you need new hooks or APIs in core, add them to src/student/<Name>/<Name>Needs.md and ask the maintainer.

Debug flags (student-friendly)
- Edit `src/student/studentDebugOverrides.ts` to toggle curated debug logs without touching core.
- Flip booleans to true/false, then rebuild/reload.
- These override the corresponding flags in `src/debugFlags.ts`.
- Keys:
  - overlayLogs -> overlay manager logs (create/show/hide/remove + input gate)
  - systemsLogs -> student system register/init logs
  - uiLogs -> UI state logs
  - uiApiLogs -> UI API hook install logs
  - interactLogs -> interact pipeline logs
  - propInteractLogs -> prop interact logs
  - trapLogs -> trap prompt/effect logs
  - shrineOverlayLogs -> shrine overlay logs
  - bossOverrideMove -> boss move override hook (debug)
  - bossOverridePhase -> boss phase override hook (debug)
  - bossOverrideDamage -> boss damage override hook (debug)
  - bossOverrideSpawn -> boss spawn override hook (debug)

Boss hooks (phase registry + overrides)
- Register per-boss phase configs with `registerBossPhaseConfig({ monsterId, phases })`.
- Phases use `minHpPct`/`maxHpPct` ranges; optional `moveWeights` can bias move selection.
- Register lifecycle hooks with `registerStudentBossHooks({ ... })`.
- Observation hooks: `onBossIntroJumpStart`, `onBossIntroJumpLand`, `onBossMovePicked`, `onBossBarrageVolley`, `onBossPoisonRing`, `onBossChargeHit`.
- Override hooks (`pickBossMove`, `overrideBossPhase`, `overrideBossDamage`, `overrideBossSpawnStats`) only run when the corresponding boss override debug flags are enabled in `src/student/studentDebugOverrides.ts`.

Student debug sandbox (blank canvas)
- Start the dev server, then open: debug.html?student=<Name> (or ?profile=<Name>)
- Your optional debug entry file is: src/student/<Name>/debug.ts
- The debug page auto-discovers students from src/student/*/index.ts (no registration needed).
- This page does not boot the full game; it is a blank sandbox canvas.
- Export either:
  - default function (ctx) { ... } OR
  - const studentDebug = { preload, create, update }
- Use ctx.api.assets.register* to queue assets in preload; use ctx.api.ui.createOverlay for DOM.
- Helpers available: ctx.api.helpers.addLabel, addPlaceholderHero, addGrid, spawnHero, spawnProfileHero.
- If you want types, import from src/studentSystemsHooks.ts (allowed).

Debug start floor (per-student, no merge conflicts)
- In your `src/student/<Name>/index.ts`, inside your system register, call:
  - `api.debug.setStartFloor({ enabled: true, floorIndex: 1, kind: "shop" })`
- `floorIndex` 0 always forces entrance; for shop/story/treasure/combat use >= 1.
- `kind` supports: `entrance`, `shop` (aka `safe`), `combat`, `story`, `treasure` (aka `relic`), `hall`.
- If your player profile name differs from your system name, pass `profile: "YourProfile"`.
- If multiple profiles set overrides, the first connected hero/profile wins.

Assets
- PNG filenames MUST include their frame size as WxH (example: "Book 32x40.png").
- Sheets must be exact multiples of frame size. No runtime trimming.
- Student assets live inside your folder (top level or an assets/ subfolder).
- Use assets.registerTileSheet for prop/decal sheets so tileAtlas can resolve frame columns.
- If a prop must collide, it MUST use aura/mask collision data. For new art, ask the maintainer to generate aura masks and set requireAura: true in registerTileSheet.
- Student monster sheets must be registered in `src/student/<Name>/assets/registry.js` (or `.mjs`). The game does NOT auto-discover monster PNGs.
- Each registry entry uses the same monster filename format as core (id + WxH + ULDR + tokens like `w=`, `a1=`, `d=` and `drows=`).
- Monster PNGs live in `src/student/<Name>/assets/enemies/monsters/` (or `.../bosses/`), and the filename must exactly match the `name` you register (minus `.png`).
- Generate monster auras inside your folder with `npm run gen-monster-auras` and `npm run gen-monster-feet` (creates `auras/` next to your sheets).
- Do not place student monster art in `assets/enemies/*`; keep it under your student folder.

Example registry (src/student/<Name>/assets/registry.js)
```js
export const monsterSheets = [
  {
    name: "squirrel 32x32 ULDR w=4 a1=3 drows=0",
    url: new URL("./enemies/monsters/squirrel 32x32 ULDR w=4 a1=3 drows=0.png", import.meta.url),
  },
];

export const bossSheets = [
  {
    name: "ogre king 96x96 ULDR w=4 a1=4 drows=1",
    url: new URL("./enemies/bosses/ogre king 96x96 ULDR w=4 a1=4 drows=1.png", import.meta.url),
  },
];
```

How to start a system
- Create a new folder inside your name folder (example: src/student/Kyle/Crafting/).
- Keep your code self-contained and avoid touching core files.

Copilot guidance
- Copilot should only edit files inside your student folder.
- If asked to change core or shared files, Copilot should stop and ask.

PR guardrails
- PRs that touch files outside src/student/ should not be merged unless the maintainer approves.
- When GitHub usernames are added to .github/student-owners.json, PRs will be limited to each student folder.

Student folders
- Alan: src/student/Alan/
- Marcel: src/student/Marcel/
- Jordyn: src/student/Jordyn/
- Angel: src/student/Angel/
- Nixie: src/student/Nixie/
- Hanna: src/student/Hanna/
- Mehki: src/student/Mehki/
- Lourdes: src/student/Lourdes/
- Jason: src/student/Jason/
- Daniel: src/student/Daniel/
- Elizabeth: src/student/Elizabeth/
- Kyle: src/student/Kyle/
- Khaliyah: src/student/Khaliyah/
- Addisyn: src/student/Addisyn/
- ChrisP: src/student/ChrisP/
- Abraham: src/student/Abraham/
- ChrisS: src/student/ChrisS/
- Cortez: src/student/Cortez/
- Esau: src/student/Esau/

GitHub usernames (PR guard)
- Alan: kindalqn
- Daniel: dmaradia
- Jason: Scooperd00per
