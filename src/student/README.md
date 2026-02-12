# Student Systems

This folder is reserved for student-developed systems. Each student works only inside their own folder:

- src/student/Alan/
- src/student/Marcel/
- src/student/Jordyn/
- src/student/Angel/
- src/student/Nixie/
- src/student/Hanna/
- src/student/Mehki/
- src/student/Lourdes/
- src/student/Jason/
- src/student/Daniel/
- src/student/Elizabeth/
- src/student/Kyle/
- src/student/Khaliyah/
- src/student/Addisyn/
- src/student/ChrisP/
- src/student/Abraham/
- src/student/ChrisS/
- src/student/Cortez/
- src/student/Esau/

Rules
- Do not edit files outside your folder unless the maintainer asks.
- Keep changes scoped to the requested feature. Avoid refactors.
- Do not edit assets/ or src/generated/.
- Logging must be behind debug flags in src/debugFlags.ts.
- Keep an index.ts in your folder; it is auto-discovered.

GitHub usernames (PR guard)
- Alan: kindalqn
- Daniel: dmaradia
- Jason: Scooperd00per

Student debug flags (safe to edit)
- Use `src/student/studentDebugOverrides.ts` to toggle curated debug logs without touching core.
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

Debug start floor (per-student)
- In your `src/student/<Name>/index.ts`, inside your system register, call:
  - `api.debug.setStartFloor({ enabled: true, floorIndex: 1, kind: "shop" })`
- `floorIndex` 0 always forces entrance; for shop/story/treasure/combat use >= 1.
- `kind` supports: `entrance`, `shop` (aka `safe`), `combat`, `story`, `treasure` (aka `relic`), `hall`.
- If your player profile name differs from your system name, pass `profile: "YourProfile"`.
- If multiple profiles set overrides, the first connected hero/profile wins.

Entry point
- Your system entry file is src/student/<Name>/index.ts.
- Use src/studentSdk.ts for registration and safe hooks.

If you need new hooks or APIs, add them to src/student/<Name>/<Name>Needs.md and ask the maintainer.
