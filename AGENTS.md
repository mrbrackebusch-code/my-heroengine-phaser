# Agent Notes

This repository hosts a Phaser + HeroEngine integration. Keep debug/logging centralized and avoid noisy output by default.

## Logging & Debug Flags
- All log toggles live in `src/debugFlags.ts`.
- Do not add `console.*` without a flag check; prefer existing flags first.
- New flags must default to `false` and be documented in `DEBUG_FLAGS.md`.
- Keep log tags consistent and bracketed (e.g., `[SCOPE]`, `[SCOPE][DETAIL]`).
- Prefer consolidated, copy-pasteable text logs: one combined entry that includes all needed fields (avoid multi-line or fragmented logs).

## Code Edits
- Prefer `rg` for search.
- Keep edits ASCII unless the file already uses non-ASCII.
- Avoid touching `assets/` or `src/generated/` unless explicitly requested. If generation is needed, use the scripts in `scripts/`.
- Keep changes scoped to the request; avoid refactors that aren’t asked for.

## Runs / Tests
- Ask before running long or destructive commands.
