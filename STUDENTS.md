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
- traps: registerDefinition
- relics: register (adds to core relic catalog)
- vfx: register (adds to VFX registry)
- ui: createOverlay, getOverlay, removeOverlay
- Prefer importing from src/studentSystemsHooks.ts for all hooks.

Notes
- Keys are automatically namespaced per student. Use the returned key for references.
- If you need new hooks or APIs in core, ask the maintainer.

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
- Kyle: src/student/Kyle/
- Jason: src/student/Jason/
- Abraham: src/student/Abraham/
- ChrisS: src/student/ChrisS/
- ChrisP: src/student/ChrisP/
