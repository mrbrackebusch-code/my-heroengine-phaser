# Agent Notes

This repository hosts a Phaser + HeroEngine integration. Keep debug/logging centralized and avoid noisy output by default.

## Logging & Debug Flags
- All log toggles live in `src/debugFlags.ts`.
- Do not add `console.*` without a flag check; prefer existing flags first.
- New flags must default to `false` and be documented in `DEBUG_FLAGS.md`.
- Keep log tags consistent and bracketed (e.g., `[SCOPE]`, `[SCOPE][DETAIL]`).
- Prefer consolidated, copy-pasteable text logs: one combined entry that includes all needed fields (avoid multi-line or fragmented logs).

## Collision Mask Rule (Ironclad)
- For props/decor that collide, ALWAYS use the aura/mask collision data for close‑quarters collisions.
- Never disable or bypass mask-based collisions; do not fall back to plain bounding boxes for colliding props.

## Code Edits
- Prefer `rg` for search.
- Keep edits ASCII unless the file already uses non-ASCII.
- Avoid touching `assets/` or `src/generated/` unless explicitly requested. If generation is needed, use the scripts in `scripts/`.
- Keep changes scoped to the request; avoid refactors that aren’t asked for.

## Student Folder Boundary (Ironclad)
- For the maintainer and Codex: do NOT edit anything inside named student folders under `src/student/<Name>/` after initial creation unless explicitly directed to do so.
- Top-level repo docs (e.g., `STUDENTS.md`, `STUDENT_SYSTEMS_GROUPS.md`, `copilot.md`, `DEBUG_FLAGS.md`, `AGENTS.md`) are maintainer-owned and may be edited as needed.
- The maintainer/Codex edit surface and the student/AI edit surface are intentionally separate and must never overlap.

## Runs / Tests
- Ask before running long or destructive commands.

## Communication
- If asking the user to re-verify something basic they likely already did, acknowledge that and explain why you need the confirmation.
- Use phrasing like: "I understand you likely already did this, but for my algorithms to proceed could you please verify..." or "I know this is frustrating; to continue I need to confirm..."
- When discussing debug flags, always open `src/debugFlags.ts` and reference the current value before asking the user to toggle or verify a flag.
- When the user says "check the logs," interpret it as "check the output file" (debug dump), not the console.

## Recency Rule (Critical)
- Always prioritize the most recent user instructions over older context.
- If an older instruction conflicts with a newer one, STOP and ask for clarification.
- When resuming a long thread, explicitly restate the latest request before acting.
- If the user says "no changes," do not modify any files until they say "go."

## Asset Rules (Ironclad)
- All asset PNG filenames MUST include their frame size as `WxH` (e.g., `Book 32x40.png`). No exceptions.
- Never trim or auto-fix PNG dimensions at runtime. If a sheet is not an exact multiple of its frame size, HARD FAIL.
- If asked to fix an asset, edit the ORIGINAL and create a backup copy in the repo before changing it.
