# ChrisS Solo Repo Transition Guide

This guide helps you move your amulet system into a new repo that is yours only.

## What You Already Own (Core Feature Files)

Copy these files first:

- `src/student/ChrisS/index.ts`
- `src/student/ChrisS/amuletData.ts`
- `src/student/ChrisS/amuletEffects.ts`
- `src/student/ChrisS/amuletChest.ts`
- `src/student/ChrisS/amuletSelectionUI.ts`
- `src/student/ChrisS/amuletHud.ts`
- `src/student/ChrisS/amuletUtils.ts`
- `src/student/ChrisS/debug.ts`
- `src/student/ChrisS/vfx/*`

## External Dependencies Your Code Currently Uses

Your files import these host-side APIs:

- `src/studentApi.ts`
- `src/studentSystemsHooks.ts`
- `src/studentSdk.ts`
- `src/studentHooks.ts`

Your runtime also expects some global engine hooks:

- `globalThis.__HeroEnginePhaserInternals`
- `globalThis.__heroEngineVfxRegistry`
- `globalThis.addRelicToHero`
- `globalThis.__heRelicCatalog`
- `globalThis.sprites`
- `globalThis.SpriteKind`

## Fastest Path To "Runs Solo"

1. Start from a fresh copy of this repo in your own new GitHub repo (keeps engine glue intact).
2. Remove teacher/student-owner workflow files in the new repo if you want a clean personal setup.
3. Keep your amulet feature in a top-level feature folder (for example `src/features/amulets/`).
4. Add a thin adapter layer so feature code imports from your own local API instead of school-specific student hooks.

## Clean Architecture Target

In your new repo, plan this shape:

- `src/features/amulets/` (your current amulet files)
- `src/features/amulets/engineAdapter.ts` (maps your feature calls to your engine)
- `src/features/amulets/index.ts` (feature entry)

The adapter should own all global reads/writes and host API calls.

## AP Create Task Safety

Keep your AP slice intact in the new repo:

- List focus: `AMULETS` in `amuletData.ts`
- Procedure focus: `buildAmuletPreviewData(...)` in `amuletSelectionUI.ts`

Do not rewrite these into a toy project. Keep the real feature context.

## Automation

Use `export_solo_handoff.ps1` in this same folder to create a transfer packet.
