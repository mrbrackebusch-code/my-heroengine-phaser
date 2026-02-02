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
- relics: register (adds to core relic catalog)
- vfx: register (adds to VFX registry)
- ui: createOverlay, getOverlay, removeOverlay
- debug: setStartFloor (optional start floor override for your profile)
- Prefer importing from src/studentSystemsHooks.ts for all hooks.

Notes
- Keys are automatically namespaced per student. Use the returned key for references.
- NPC ids should use the <Name>NPC convention (example: ShopkeeperNPC).
- Student props can alias visuals/specs via visualKey/specKey; interactAction can be "prop" or "npc".
- Student NPCs are tagged when you spawn an LPC NPC with npcRole or profileName matching the NPC id.
- If you need new hooks or APIs in core, ask the maintainer.

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
