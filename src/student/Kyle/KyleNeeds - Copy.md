# Kyle Needs & External Hooks

This file tracks external hooks, required core changes, and TODOs needed to implement Kyle's student systems while respecting the rule: only edit files inside `src/student/Kyle/`.

## Constraints (enforced)
- All code changes must be inside `src/student/Kyle/`.
- Do NOT modify core files under `src/` (except inside `src/student/` for Kyle).
- If a change requires a core hook or API, list it here with a precise signature and rationale.

## Hook placeholders (examples)
- `registerKyleSystem(systemName: string, impl: SystemImpl): void`
  - Purpose: allow core to discover/initialize Kyle's system without editing core discovery logic.
  - Needed in: core loader (implementer must add call or allow plugin registration).
  - TODO: Ask core maintainer to expose a plugin registration entry in `src/studentSdk.ts` or similar.

- `emitGameEvent(eventName: string, payload: any): void`
  - Purpose: let Kyle code notify core/game about events (damage, state changes, UI hints).
  - TODO: Provide a typed wrapper or a safe import path the student code can call.

- `getAuraMask(maskId: string): AuraMaskData`
  - Purpose: access aura/mask collision data from core without duplicating it.
  - TODO: Core should expose a read-only accessor; if unavailable, the maintainer must add one.

## Dependencies (maintainer: update root package.json)
- `tone` (^14.8.49) — Audio/Transport engine for PopSong system.
- `@tonaljs/tonal` (^4.8.1) — Music theory helpers (scales, chords, intervals).

Add these to the root `package.json` dependencies and run `npm install` + commit.

## Current TODOs for Kyle (student-side)
- [ ] Create this file (done).
- [ ] Add `src/student/Kyle/index.ts` to register student systems with core hooks (when available).
- [ ] Create scaffolding for the dreamed system under `src/student/Kyle/popSong/` (done).

## Notes for maintainers / reviewers
- Student code will call the hooks above; please implement the minimal glue in core (or advise student how to adapt).
- Keep all core-facing hook additions backward-compatible and minimal.

## Next steps (what I need from you)
1. Confirm I should only edit within `src/student/Kyle/` — acknowledged by creating this file.
2. Provide the first concrete task for the system you want (features, input/output, any existing student files to extend).
3. If you want me to scaffold the system now, confirm preferred system name and any assets to include.

---
Created: 2026-02-03 — Automated note by assistant
